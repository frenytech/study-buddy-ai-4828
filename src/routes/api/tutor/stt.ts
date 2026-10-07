import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth.server";
import { isPremium } from "@/lib/tutor-context.server";

export const Route = createFileRoute("/api/tutor/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        if (!(await isPremium(auth.supabase, auth.user.id))) return Response.json({ error: "Voice Tutor is a Premium feature." }, { status: 403 });
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return Response.json({ error: "Voice Tutor is not configured yet." }, { status: 503 });
        const form = await request.formData().catch(() => null);
        const audio = form?.get("audio");
        if (!(audio instanceof Blob) || audio.size < 500) return Response.json({ error: "I didn't catch that. Please try again." }, { status: 400 });
        if (audio.size > 20 * 1024 * 1024) return Response.json({ error: "Recording is too long." }, { status: 413 });
        const fd = new FormData();
        fd.append("file", audio, "speech.webm");
        fd.append("model_id", "scribe_v2");
        const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body: fd });
        if (!r.ok) {
          console.error("ElevenLabs STT", r.status, await r.text().catch(() => ""));
          return Response.json({ error: "Couldn't understand the recording." }, { status: 502 });
        }
        const j = (await r.json()) as any;
        return Response.json({ text: String(j.text ?? "").trim() });
      },
    },
  },
});
