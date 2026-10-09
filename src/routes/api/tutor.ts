import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestUser } from "@/lib/server-auth.server";
import { ACTIONS, buildContext, type TutorAction } from "@/lib/tutor-context.server";
import { listTextModels, omegaChat, OmegaError, FALLBACK_MODEL } from "@/lib/omegatech.server";

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) })).min(1).max(40),
  action: z.enum(Object.keys(ACTIONS) as [TutorAction, ...TutorAction[]]).default("chat"),
  materialId: z.string().uuid().optional(),
  voice: z.boolean().optional(),
  model: z.string().max(60).optional(),
});

const SYSTEM = `You are StudyAI Tutor, a patient, encouraging teacher for Nigerian secondary school and pre-university students preparing for JAMB UTME and WAEC SSCE.
Explain step by step, use simple language and Nigerian context where helpful. Use Markdown for structure and show working for calculations.
Never invent that a question appeared in a particular exam year.
Honesty about sources: only say you used the student's PDF or a StudyAI lesson if that material appears in the CONTEXT below. If the context has nothing relevant, answer from general knowledge and do not claim a source.`;

export const Route = createFileRoute("/api/tutor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid message." }, { status: 400 });

        const { data: allowed, error } = await auth.supabase.rpc("consume_ai_credit");
        if (error) return Response.json({ error: "Could not check your usage." }, { status: 500 });
        if (!allowed) return Response.json({ error: "You've reached today's AI Tutor limit. Upgrade your plan for more." }, { status: 429 });

        const { messages, action, materialId, voice } = parsed.data;
        const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
        const recentTopic = messages.filter((m) => m.role === "user").slice(-3).map((m) => m.content).join(" ");
        const ctx = await buildContext(auth.supabase, auth.user.id, `${lastUser} ${recentTopic}`, materialId).catch(() => ({ text: "", sources: [] as string[] }));

        const system = [
          SYSTEM,
          `CURRENT MODE: ${ACTIONS[action]}`,
          voice ? "VOICE MODE: your reply will be spoken aloud. Use short conversational paragraphs, no tables, no Markdown symbols, no LaTeX; say formulas in words. Keep it under 180 words and end with a short question to keep the student engaged." : "",
          ctx.text ? `CONTEXT (the student's real data):\n${ctx.text}` : "CONTEXT: none relevant found — use general knowledge.",
        ].filter(Boolean).join("\n\n");

        const models = await listTextModels();
        let model: string = parsed.data.model ?? "";
        if (!model || !models.includes(model)) {
          const { data: setting } = await auth.supabase.from("app_settings").select("value").eq("key", "default_tutor_model").maybeSingle();
          model = setting?.value && models.includes(setting.value) ? setting.value : FALLBACK_MODEL;
        }
        const transcript = messages.slice(-12).map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`).join("\n\n");
        const query = `${system}\n\n--- CONVERSATION SO FAR ---\n${transcript}\n\nReply as the Tutor to the student's last message, following the CURRENT MODE.`;

        let reply: string;
        try {
          reply = await omegaChat(model, query.slice(0, 24000), request.signal);
        } catch (e: any) {
          if (e instanceof OmegaError) return Response.json({ error: e.userMessage }, { status: e.status });
          if (e?.name === "AbortError") return new Response(null, { status: 499 });
          return Response.json({ error: "The AI Tutor had a problem. Please try again." }, { status: 502 });
        }
        return new Response(reply, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store",
            "X-Tutor-Sources": encodeURIComponent(JSON.stringify(ctx.sources)),
            "X-Tutor-Model": model,
          },
        });
      },
    },
  },
});
