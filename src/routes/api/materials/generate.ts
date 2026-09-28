import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestUser } from "@/lib/server-auth.server";

const Input = z.object({ materialId: z.string().uuid() });

const Output = z.object({
  summary: z.string().min(20),
  flashcards: z.array(z.object({ front: z.string().min(1), back: z.string().min(1) })).min(1),
  quiz: z.array(z.object({
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2).max(5),
    answer: z.string().min(1),
    explanation: z.string().optional().default(""),
  })).min(1),
});

const MAX_CHARS = 45000;

const PROMPT = `You are StudyAI, creating revision material for a Nigerian secondary/pre-university student from their uploaded study notes.
Use ONLY the provided material. Do not invent facts that are not supported by it.
Return strict JSON with this exact shape:
{
  "summary": "Markdown revision notes: a short overview, then ## headed sections with bullet points of key ideas, definitions and formulas, ending with a 'Key takeaways' list.",
  "flashcards": [{"front": "question or term", "back": "concise answer"}],   // 12-20 cards
  "quiz": [{"question": "...", "options": ["...","...","...","..."], "answer": "A", "explanation": "why"}]  // 10 multiple-choice questions, answer is the letter A-D
}`;

export const Route = createFileRoute("/api/materials/generate")({
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
        const id = parsed.data.materialId;

        const { data: material } = await supabase.from("materials").select("id,title,status").eq("id", id).maybeSingle();
        if (!material) return Response.json({ error: "Material not found" }, { status: 404 });
        if (material.status === "processing") return Response.json({ error: "Already processing" }, { status: 409 });

        const { data: chunks } = await supabase.from("material_chunks").select("idx,content").eq("material_id", id).order("idx");
        if (!chunks?.length) return Response.json({ error: "No readable text was found in this PDF." }, { status: 422 });

        const { data: allowed } = await supabase.rpc("consume_ai_credit");
        if (!allowed) return Response.json({ error: "You've reached today's AI limit. Upgrade your plan for more." }, { status: 429 });

        // Spread selection across the document when it's longer than the budget.
        const total = chunks.reduce((a, c) => a + c.content.length, 0);
        let picked = chunks;
        if (total > MAX_CHARS) {
          const n = Math.max(1, Math.floor(MAX_CHARS / (total / chunks.length)));
          const step = chunks.length / n;
          picked = Array.from({ length: n }, (_, i) => chunks[Math.floor(i * step)]!);
        }
        const text = picked.map((c) => c.content).join("\n\n");

        await supabase.from("materials").update({ status: "processing", error: null }).eq("id", id);
        const fail = async (msg: string, status = 502) => {
          await supabase.from("materials").update({ status: "failed", error: msg }).eq("id", id);
          return Response.json({ error: msg }, { status });
        };

        let res: Response;
        try {
          res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": new URL(request.url).origin, "X-Title": "StudyAI" },
            body: JSON.stringify({
              model: process.env["OPENROUTER_MODEL"] || "openai/gpt-4o-mini",
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: PROMPT },
                { role: "user", content: `Title: ${material.title}\n\nMaterial:\n${text}` },
              ],
            }),
          });
        } catch {
          return fail("Couldn't reach the AI service. Please try again.");
        }
        if (!res.ok) {
          console.error("OpenRouter", res.status, await res.text().catch(() => ""));
          return fail(res.status === 402 ? "The AI service is out of credits." : res.status === 429 ? "The AI is busy. Try again shortly." : "The AI had a problem. Please try again.", res.status === 429 ? 429 : 502);
        }
        const body = (await res.json()) as any;
        let out: z.infer<typeof Output>;
        try {
          const raw = String(body?.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "");
          out = Output.parse(JSON.parse(raw));
        } catch (e) {
          console.error("Bad AI output", e);
          return fail("The AI returned an unexpected result. Please try again.");
        }

        const letters = "ABCDE";
        const questions = out.quiz.map((q) => {
          const ans = q.answer.trim().toUpperCase().charAt(0);
          const idx = letters.indexOf(ans);
          const fallback = q.options.findIndex((o) => o.trim() === q.answer.trim());
          return {
            question: q.question,
            options: q.options.map((t, i) => ({ key: letters[i]!, text: t })),
            answer: idx >= 0 && idx < q.options.length ? ans : letters[Math.max(0, fallback)]!,
            explanation: q.explanation,
          };
        });

        await supabase.from("flashcards").delete().eq("material_id", id);
        await supabase.from("quizzes").delete().eq("material_id", id);
        await supabase.from("flashcards").insert(out.flashcards.slice(0, 30).map((f) => ({ material_id: id, user_id: user.id, front: f.front, back: f.back })));
        await supabase.from("quizzes").insert({ material_id: id, user_id: user.id, questions });
        await supabase.from("materials").update({ status: "ready", summary: out.summary }).eq("id", id);
        return Response.json({ ok: true });
      },
    },
  },
});
