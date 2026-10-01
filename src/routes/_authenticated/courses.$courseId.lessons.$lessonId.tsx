import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RichText } from "@/components/rich-text";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { parseVideo } from "@/lib/courses";
import { useCourse } from "./courses.$courseId.index";

export const Route = createFileRoute("/_authenticated/courses/$courseId/lessons/$lessonId")({
  head: () => ({ meta: [{ title: "Lesson — StudyAI" }, { name: "robots", content: "noindex" }] }),
  component: LessonPage,
});

function LessonPage() {
  const { courseId, lessonId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useCourse(courseId);

  const save = useCallback(async (patch: { completed?: boolean; last_position_seconds?: number }) => {
    if (!user) return;
    const { error } = await supabase.from("lesson_progress").upsert(
      { user_id: user.id, lesson_id: lessonId, course_id: courseId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) console.error(error);
  }, [user, lessonId, courseId]);

  if (isLoading) return <p className="p-8 text-muted-foreground">Loading lesson…</p>;
  const lesson = data?.ordered.find((l) => l.id === lessonId);
  if (!data?.course || !lesson) return <p className="p-8 text-muted-foreground">Lesson not found.</p>;
  const { ordered, progress, modules } = data;
  const idx = ordered.indexOf(lesson);
  const prev = ordered[idx - 1]; const next = ordered[idx + 1];
  const p = progress.get(lesson.id);
  const done = ordered.filter((l) => progress.get(l.id)?.completed).length;
  const pct = ordered.length ? Math.round((done / ordered.length) * 100) : 0;

  async function toggleComplete() {
    await save({ completed: !p?.completed });
    await qc.invalidateQueries({ queryKey: ["course", courseId] });
    qc.invalidateQueries({ queryKey: ["courses-list"] });
    if (!p?.completed) toast.success("Lesson marked as complete");
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 p-4 md:p-8 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <Link to="/courses/$courseId" params={{ courseId }} className="text-sm text-muted-foreground hover:text-primary">← {data.course.title}</Link>
        <h1 className="mt-2 text-2xl font-bold">{lesson.title}</h1>
        <div className="mt-4"><Player key={lesson.id} url={lesson.video_url} start={p?.completed ? 0 : p?.last_position_seconds ?? 0} onPosition={(s) => save({ last_position_seconds: s })} /></div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={toggleComplete} variant={p?.completed ? "outline" : "default"}>
            <CheckCircle2 className="mr-1 h-4 w-4" />{p?.completed ? "Completed — undo" : "Mark as complete"}
          </Button>
          <div className="ml-auto flex gap-2">
            {prev && <Button variant="outline" size="sm" asChild><Link to="/courses/$courseId/lessons/$lessonId" params={{ courseId, lessonId: prev.id }}><ChevronLeft className="h-4 w-4" />Previous</Link></Button>}
            {next && <Button variant="outline" size="sm" asChild><Link to="/courses/$courseId/lessons/$lessonId" params={{ courseId, lessonId: next.id }}>Next<ChevronRight className="h-4 w-4" /></Link></Button>}
          </div>
        </div>
        {lesson.takeaways.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-secondary p-5">
            <h2 className="flex items-center gap-2 font-semibold"><Lightbulb className="h-5 w-5 text-primary" />Key takeaways</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{lesson.takeaways.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        )}
        {lesson.notes && <div className="mt-6 rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold">Lesson notes</h2><RichText text={lesson.notes} /></div>}
        {lesson.resources.length > 0 && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 font-semibold">Resources</h2>
            <ul className="space-y-2 text-sm">{lesson.resources.map((r, i) => (
              <li key={i}><a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline"><ExternalLink className="h-4 w-4" />{r.label || r.url}</a></li>
            ))}</ul>
          </div>
        )}
      </div>
      <aside className="h-fit rounded-2xl border border-border bg-card p-4 lg:sticky lg:top-4">
        <div className="flex items-center gap-2"><Progress value={pct} className="h-2" /><span className="text-xs font-medium">{pct}%</span></div>
        {modules.map((m) => (
          <div key={m.id} className="mt-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{m.title}</p>
            <ul className="mt-1 space-y-0.5">{m.lessons.map((l) => (
              <li key={l.id}>
                <Link to="/courses/$courseId/lessons/$lessonId" params={{ courseId, lessonId: l.id }}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${l.id === lessonId ? "bg-secondary font-medium text-primary" : "hover:bg-muted"}`}>
                  <CheckCircle2 className={`h-4 w-4 shrink-0 ${progress.get(l.id)?.completed ? "text-success" : "text-muted-foreground/40"}`} />
                  <span className="truncate">{l.title}</span>
                </Link>
              </li>
            ))}</ul>
          </div>
        ))}
      </aside>
    </div>
  );
}

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void } }

function loadYouTubeApi(): Promise<any> {
  return new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    if (!document.getElementById("yt-api")) {
      const s = document.createElement("script"); s.id = "yt-api"; s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
    }
  });
}

/** Plays YouTube / Vimeo / direct video and reports the watched position about every 10 seconds. */
function Player({ url, start, onPosition }: { url: string | null; start: number; onPosition: (s: number) => void }) {
  const src = parseVideo(url);
  const ytRef = useRef<HTMLDivElement>(null);
  const report = useRef(onPosition); report.current = onPosition;
  const lastSaved = useRef(start);
  const tick = (t: number) => { const s = Math.floor(t); if (Math.abs(s - lastSaved.current) >= 10) { lastSaved.current = s; report.current(s); } };

  useEffect(() => {
    if (src.kind !== "youtube" || !ytRef.current) return;
    let player: any; let timer: number | undefined; let cancelled = false;
    loadYouTubeApi().then((YT) => {
      if (cancelled || !ytRef.current) return;
      player = new YT.Player(ytRef.current, { videoId: src.id, playerVars: { start: Math.floor(start), rel: 0, modestbranding: 1 }, width: "100%", height: "100%" });
      timer = window.setInterval(() => { try { if (player?.getPlayerState?.() === 1) tick(player.getCurrentTime()); } catch { /* not ready */ } }, 2000);
    });
    return () => {
      cancelled = true; if (timer) window.clearInterval(timer);
      try { const t = player?.getCurrentTime?.(); if (t) report.current(Math.floor(t)); player?.destroy?.(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src.kind === "youtube" ? src.id : ""]);

  if (src.kind === "none") return <div className="grid aspect-video place-items-center rounded-2xl bg-muted text-sm text-muted-foreground">No video for this lesson. Read the notes below.</div>;
  return (
    <div className="aspect-video overflow-hidden rounded-2xl bg-foreground [&_iframe]:h-full [&_iframe]:w-full">
      {src.kind === "youtube" && <div ref={ytRef} />}
      {src.kind === "vimeo" && <iframe title="Lesson video" src={`https://player.vimeo.com/video/${src.id}#t=${Math.floor(start)}s`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />}
      {src.kind === "file" && (
        <video className="h-full w-full" controls preload="metadata" src={src.url}
          onLoadedMetadata={(e) => { if (start > 0) e.currentTarget.currentTime = start; }}
          onTimeUpdate={(e) => tick(e.currentTarget.currentTime)}
          onPause={(e) => report.current(Math.floor(e.currentTarget.currentTime))} />
      )}
    </div>
  );
}
