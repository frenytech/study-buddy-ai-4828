import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestUser } from "@/lib/server-auth.server";
import { isPremium } from "@/lib/tutor-context.server";

const Body = z.object({ query: z.string().trim().min(2).max(300) });

function isoDuration(d: string) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d) ?? [];
  const h = +(m[1] ?? 0), min = +(m[2] ?? 0), s = +(m[3] ?? 0);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(min).padStart(2, "0")}:${ss}` : `${min}:${ss}`;
}

export const Route = createFileRoute("/api/tutor/videos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        if (!(await isPremium(auth.supabase, auth.user.id))) return Response.json({ error: "Video recommendations are a Premium feature." }, { status: 403 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid topic." }, { status: 400 });
        const key = process.env["YOUTUBE_API_KEY"];
        if (!key) return Response.json({ error: "Video recommendations are not configured yet." }, { status: 503 });

        const topic = parsed.data.query.slice(0, 120);
        const q = new URLSearchParams({ part: "snippet", type: "video", maxResults: "4", safeSearch: "strict", videoEmbeddable: "true", relevanceLanguage: "en", q: `${topic} lesson explained`, key });
        const s = await fetch(`https://www.googleapis.com/youtube/v3/search?${q}`);
        if (!s.ok) { console.error("YouTube search", s.status, await s.text()); return Response.json({ error: "Couldn't load videos right now." }, { status: 502 }); }
        const sj = (await s.json()) as any;
        const ids = (sj.items ?? []).map((i: any) => i.id?.videoId).filter(Boolean);
        if (!ids.length) return Response.json({ videos: [] });
        const v = await fetch(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: "contentDetails,snippet", id: ids.join(","), key })}`);
        if (!v.ok) { console.error("YouTube videos", v.status, await v.text()); return Response.json({ error: "Couldn't load videos right now." }, { status: 502 }); }
        const vj = (await v.json()) as any;
        const videos = (vj.items ?? []).map((i: any) => ({
          id: i.id, title: i.snippet.title, channel: i.snippet.channelTitle,
          thumbnail: i.snippet.thumbnails?.medium?.url ?? i.snippet.thumbnails?.default?.url,
          duration: isoDuration(i.contentDetails?.duration ?? ""), topic,
        }));
        return Response.json({ videos });
      },
    },
  },
});
