import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestUser } from "@/lib/server-auth.server";

const Input = z.object({
  exam: z.enum(["jamb", "waec"]),
  subjectId: z.string().uuid(),
  topic: z.string().trim().min(2).max(200),
  difficulty: z.enum(["easy", "medium", "hard"]),
  count: z.number().int().min(1).max(30),
});

const Output = z.object({
  questions: z.array(z.object({
    question: z.string().min(5),
    options: z.array(z.string().min(1)).length(4),
    answer: z.string().min(1),
    explanation: z.string().min(1),
  })).min(1),
});

export const Route = createFileRoute("/api/admin/generate-questions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        const { supabase, user } = auth;
        const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) return Response.json({ error: "Admins only." }, { status: 403 });
        const parsed = Input.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Please fill in every field (1–30 questions)." }, { status: 400 });
        const key = process.env["OPENROUTER_API_KEY"];
        if (!key) return Response.json({ error: "AI is not configured yet." }, { status: 503 });
        const d = parsed.data;

        const { data: subject } = await supabase.from("subjects").select("id,name,exam").eq("id", d.subjectId).maybeSingle();
        if (!subject || subject.exam !== d.exam) return Response.json({ error: "Subject not found for that exam." }, { status: 404 });

        const examName = d.exam === "jamb" ? "JAMB UTME" : "WAEC WASSCE";
        const prompt = `You are an experienced Nigerian examiner writing original ${examName} objective questions.
Follow the official ${examName} syllabus for ${subject.name} strictly. Stay within the topic given. Match real exam style, wording and difficulty.
Difficulty: ${d.difficulty} (easy = direct recall; medium = application; hard = multi-step reasoning or analysis).
Each question has exactly 4 options (A-D), exactly one correct answer, plausible distractors, and a detailed step-by-step explanation of why the answer is right and why the others are wrong.
Do not copy real past questions verbatim. Use Nigerian context where natural. Use plain text (no LaTeX); write powers like x^2.
Return strict JSON: {"questions":[{"question":"...","options":["...","...","...","..."],"answer":"A","explanation":"..."}]}
Option texts must NOT start with a letter label.`;

        let res: Response;
        try {
          res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": new URL(request.url).origin, "X-Title": "StudyAI" },
            body: JSON.stringify({
              model: process.env["OPENROUTER_MODEL"] || "openai/gpt-4o-mini",
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: prompt },
                { role: "user", content: `Write ${d.count} ${d.difficulty} questions on the topic: "${d.topic}".` },
              ],
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
        let out: z.infer<typeof Output>;
        try {
          const raw = String(body?.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "");
          out = Output.parse(JSON.parse(raw));
        } catch (e) {
          console.error("Bad AI output", e);
          return Response.json({ error: "The AI returned an unexpected result. Please try again." }, { status: 502 });
        }

        const L = "ABCD";
        const rows = out.questions.slice(0, d.count).map((q) => {
          const a = q.answer.trim().toUpperCase().charAt(0);
          const byText = q.options.findIndex((o) => o.trim() === q.answer.trim());
          return {
            exam: d.exam, subject_id: d.subjectId, topic: d.topic, difficulty: d.difficulty,
            question: q.question.trim(),
            options: q.options.map((t, i) => ({ key: L[i]!, text: t.replace(/^\s*[A-D][.)]\s*/, "").trim() })),
            answer: L.includes(a) ? a : L[Math.max(0, byText)]!,
            explanation: q.explanation.trim(),
            source: "ai_practice", status: "pending_review", created_by: user.id,
          };
        });
        const { error } = await supabase.from("questions").insert(rows);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, count: rows.length });
      },
    },
  },
});
