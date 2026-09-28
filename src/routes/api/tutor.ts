import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestUser } from "@/lib/server-auth.server";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) })).min(1).max(40),
});

const SYSTEM = `You are StudyAI Tutor, a patient, encouraging tutor for Nigerian secondary school and pre-university students preparing for JAMB UTME and WAEC SSCE.
Explain step by step, use simple language and Nigerian context where helpful. Use Markdown for structure and show working for calculations.
If asked about specific past exam questions, never invent that a question appeared in a particular year. Keep answers focused.`;

export const Route = createFileRoute("/api/tutor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid message." }, { status: 400 });
        const key = process.env["OPENROUTER_API_KEY"];
        if (!key) return Response.json({ error: "The AI Tutor is not configured yet." }, { status: 503 });

        const { data: allowed, error } = await auth.supabase.rpc("consume_ai_credit");
        if (error) return Response.json({ error: "Could not check your usage." }, { status: 500 });
        if (!allowed) return Response.json({ error: "You've reached today's AI Tutor limit. Upgrade your plan for more." }, { status: 429 });

        const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          signal: request.signal,
          headers: {
            Authorization: `Bearer ${key}`, "Content-Type": "application/json",
            "HTTP-Referer": new URL(request.url).origin, "X-Title": "StudyAI",
          },
          body: JSON.stringify({
            model: process.env["OPENROUTER_MODEL"] || "openai/gpt-4o-mini",
            stream: true,
            messages: [{ role: "system", content: SYSTEM }, ...parsed.data.messages],
          }),
        });
        if (!upstream.ok || !upstream.body) {
          const t = await upstream.text().catch(() => "");
          console.error("OpenRouter error", upstream.status, t);
          const msg = upstream.status === 402 ? "The AI service is out of credits." : upstream.status === 429 ? "The AI is busy. Try again shortly." : "The AI Tutor had a problem. Please try again.";
          return Response.json({ error: msg }, { status: upstream.status === 429 ? 429 : 502 });
        }
        // Convert OpenRouter SSE into a plain text stream of content deltas.
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buf = "";
        const stream = upstream.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, ctrl) {
            buf += decoder.decode(chunk, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              const l = line.trim();
              if (!l.startsWith("data:")) continue;
              const d = l.slice(5).trim();
              if (d === "[DONE]") continue;
              try {
                const delta = JSON.parse(d)?.choices?.[0]?.delta?.content;
                if (delta) ctrl.enqueue(encoder.encode(delta));
              } catch { /* partial */ }
            }
          },
        }));
        return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
      },
    },
  },
});
