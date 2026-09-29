import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestUser, adminClient } from "@/lib/server-auth.server";

const Input = z.object({ sessionId: z.string().uuid() });

const Analysis = z.object({
  readiness: z.string(),
  summary: z.string(),
  strengths: z.array(z.object({ topic: z.string(), note: z.string() })).default([]),
  weaknesses: z.array(z.object({ topic: z.string(), note: z.string(), severity: z.string().default("medium") })).default([]),
  errors: z.array(z.object({ question: z.number(), misconception: z.string(), fix: z.string() })).default([]),
  time_management: z.string().default(""),
  plan: z.array(z.object({ day: z.number(), focus: z.string(), tasks: z.array(z.string()) })).default([]),
});
export type CbtAnalysis = z.infer<typeof Analysis>;

const PROMPT = `You are StudyAI, an honest, encouraging exam coach for Nigerian students preparing for JAMB UTME and WAEC WASSCE.
Analyse one completed CBT attempt. Be specific and refer to question numbers. Be honest about readiness; do not flatter.
Return strict JSON:
{
 "readiness": "one of: Not ready | Needs work | Almost ready | Exam ready",
 "summary": "3-5 sentence performance summary & diagnostic, including an honest appraisal of readiness for the exam",
 "strengths": [{"topic":"...","note":"why this is a strength"}],
 "weaknesses": [{"topic":"...","note":"what is weak","severity":"critical|high|medium"}],
 "errors": [{"question": 3, "misconception":"the likely reasoning error behind the chosen answer", "fix":"the correct concept in one or two sentences"}],
 "time_management": "comment on pace vs the time allowed and advice",
 "plan": [{"day":1,"focus":"topic","tasks":["study X from the syllabus","review flashcards on Y","do a 20-question drill on Z"]}]
}
The plan must have exactly 7 days, targeting the weakest topics first, mixing study, flashcard review and timed practice drills, ending with a full mock on day 7.
If topics are not labelled, infer them from the question content using the official syllabus. Cover every wrong or unanswered question in "errors" (max 15).`;

export const Route = createFileRoute("/api/cbt/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        const parsed = Input.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const key = process.env["OPENROUTER_API_KEY"];
        if (!key) return Response.json({ error: "AI is not configured yet." }, { status: 503 });
        const { supabase, user } = auth;
        const id = parsed.data.sessionId;

        const { data: s } = await supabase.from("cbt_sessions").select("*, subjects(name)").eq("id", id).eq("user_id", user.id).maybeSingle();
        if (!s || !s.submitted_at) return Response.json({ error: "Test not found or not submitted." }, { status: 404 });
        const { data: review } = await supabase.rpc("get_cbt_review", { _session_id: id });
        if (!review?.length) return Response.json({ error: "No questions found for this test." }, { status: 422 });

        const { data: allowed } = await supabase.rpc("consume_ai_credit");
        if (!allowed) return Response.json({ error: "You've reached today's AI limit. Upgrade your plan for more." }, { status: 429 });

        const answers = (s.answers ?? {}) as Record<string, string>;
        const usedSec = Math.round((new Date(s.submitted_at).getTime() - new Date(s.started_at).getTime()) / 1000);
        const lines = (review as any[]).map((q, i) => {
          const mine = answers[q.id]?.toUpperCase() ?? null;
          const opts = (q.options as any[]).map((o) => `${o.key}. ${o.text}`).join(" | ");
          const status = !mine ? "UNANSWERED" : mine === q.answer.toUpperCase() ? "CORRECT" : "WRONG";
          return `Q${i + 1} [${status}]${q.topic ? ` topic: ${q.topic}` : ""}${q.difficulty ? ` (${q.difficulty})` : ""}\n${q.question}\nOptions: ${opts}\nCorrect: ${q.answer}; Student: ${mine ?? "none"}`;
        });
        const answered = Object.keys(answers).length;
        const header = `Exam: ${s.exam.toUpperCase()} · Subject: ${(s as any).subjects?.name}
Score: ${s.score}/${s.total} (${Math.round((s.score / s.total) * 100)}%) · Answered ${answered}/${s.total}
Time used: ${Math.round(usedSec / 60)} min of ${Math.round(s.duration_seconds / 60)} min allowed (${Math.round(usedSec / Math.max(1, answered))}s per answered question)`;

        let res: Response;
        try {
          res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": new URL(request.url).origin, "X-Title": "StudyAI" },
            body: JSON.stringify({
              model: process.env["OPENROUTER_MODEL"] || "openai/gpt-4o-mini",
              response_format: { type: "json_object" },
              messages: [{ role: "system", content: PROMPT }, { role: "user", content: `${header}\n\n${lines.join("\n\n")}` }],
            }),
          });
        } catch {
          return Response.json({ error: "Couldn't reach the AI service. Please try again." }, { status: 502 });
        }
        if (!res.ok) {
          console.error("OpenRouter", res.status, await res.text().catch(() => ""));
          const msg = res.status === 402 ? "The AI service is out of credits." : res.status === 429 ? "The AI is busy. Try again shortly." : "The AI had a problem. Please try again.";
          return Response.json({ error: msg }, { status: res.status === 429 ? 429 : 502 });
        }
        const body = (await res.json()) as any;
        let out: CbtAnalysis;
        try {
          const raw = String(body?.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "");
          out = Analysis.parse(JSON.parse(raw));
          out.plan = out.plan.slice(0, 7);
        } catch (e) {
          console.error("Bad AI output", e);
          return Response.json({ error: "The AI returned an unexpected result. Please try again." }, { status: 502 });
        }

        // Submitted sessions are read-only for students, so save with the server key after the ownership check above.
        const { error } = await adminClient().from("cbt_sessions")
          .update({ ai_analysis: out, ai_analysis_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
        if (error) { console.error(error); return Response.json({ error: "Couldn't save the analysis." }, { status: 500 }); }
        return Response.json({ analysis: out });
      },
    },
  },
});
