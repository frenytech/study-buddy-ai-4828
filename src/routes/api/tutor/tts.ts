import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestUser } from "@/lib/server-auth.server";
import { isPremium } from "@/lib/tutor-context.server";

const Body = z.object({ text: z.string().trim().min(1).max(4500) });
const VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah — warm teacher voice

export const Route = createFileRoute("/api/tutor/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        if (!(await isPremium(auth.supabase, auth.user.id))) return Response.json({ error: "Voice Tutor is a Premium feature." }, { status: 403 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Nothing to speak." }, { status: 400 });
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return Response.json({ error: "Voice Tutor is not configured yet." }, { status: 503 });
        const text = parsed.data.text.replace(/[#*_`>|]/g, "");
        const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream?output_format=mp3_44100_128`, {
          method: "POST", signal: request.signal,
          headers: { "xi-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true } }),
        });
        if (!r.ok || !r.body) {
          console.error("ElevenLabs TTS", r.status, await r.text().catch(() => ""));
          return Response.json({ error: r.status === 401 ? "The ElevenLabs key is invalid." : "Couldn't create the voice reply." }, { status: 502 });
        }
        return new Response(r.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
      },
    },
  },
});
