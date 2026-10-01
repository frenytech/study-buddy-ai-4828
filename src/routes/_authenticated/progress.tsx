import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Flame, BookOpen, Timer, Bot, Layers, Trophy } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({ meta: [{ title: "My Progress — StudyAI" }, { name: "description", content: "Track CBT scores, course completion, streaks and study time." }] }),
  component: ProgressPage,
});

const pct = (s: number | null, t: number) => (t ? Math.round(((s ?? 0) / t) * 100) : 0);

function ProgressPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [cbt, lp, quizzes, cards, usage] = await Promise.all([
        supabase.from("cbt_sessions").select("id,exam,score,total,started_at,submitted_at,subjects(name)").eq("user_id", user!.id).not("submitted_at", "is", null).order("started_at"),
        supabase.from("lesson_progress").select("course_id,completed,updated_at").eq("user_id", user!.id),
        supabase.from("quizzes").select("id,best_score,questions,created_at,materials(title)").eq("user_id", user!.id),
        supabase.from("flashcards").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase.from("ai_usage").select("day,count").eq("user_id", user!.id).order("day"),
      ]);
      return { cbt: (cbt.data ?? []) as any[], lp: lp.data ?? [], quizzes: (quizzes.data ?? []) as any[], cards: cards.count ?? 0, usage: usage.data ?? [] };
    },
  });
  if (isLoading || !data) return <div className="p-8 text-muted-foreground">Loading your progress…</div>;

  const avg = (rows: any[]) => rows.length ? Math.round(rows.reduce((a, r) => a + pct(r.score, r.total), 0) / rows.length) : 0;
  const jamb = data.cbt.filter((r) => r.exam === "jamb"), waec = data.cbt.filter((r) => r.exam === "waec");
  const lessonsDone = data.lp.filter((l) => l.completed).length;
  const courses = new Set(data.lp.map((l) => l.course_id)).size;
  const qz = data.quizzes.filter((q) => q.best_score != null);
  const quizAvg = qz.length ? Math.round(qz.reduce((a, q) => a + pct(q.best_score, q.questions?.length ?? 0), 0) / qz.length) : 0;
  const studySec = data.cbt.reduce((a, r) => a + Math.max(0, (new Date(r.submitted_at).getTime() - new Date(r.started_at).getTime()) / 1000), 0);
  const aiUses = data.usage.reduce((a, u) => a + u.count, 0);

  // Streak: consecutive days (ending today/yesterday) with any activity.
  const days = new Set<string>([
    ...data.cbt.map((r) => r.started_at.slice(0, 10)),
    ...data.lp.map((l) => l.updated_at.slice(0, 10)),
    ...data.usage.filter((u) => u.count > 0).map((u) => u.day),
  ]);
  let streak = 0; const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }

  const overall = Math.round((avg(data.cbt) + quizAvg + Math.min(100, lessonsDone * 5)) / 3);
  const trend = data.cbt.map((r, i) => ({ n: i + 1, score: pct(r.score, r.total), exam: r.exam.toUpperCase() }));
  const bySubject = Object.values(data.cbt.reduce((m: any, r) => {
    const k = `${r.exam.toUpperCase()} ${r.subjects?.name ?? ""}`; m[k] ??= { name: k, sum: 0, n: 0 }; m[k].sum += pct(r.score, r.total); m[k].n++; return m;
  }, {})).map((x: any) => ({ name: x.name, avg: Math.round(x.sum / x.n) }));

  const stats = [
    { label: "Overall progress", value: `${overall}%`, icon: Trophy },
    { label: "Day streak", value: streak, icon: Flame },
    { label: "Lessons completed", value: `${lessonsDone} · ${courses} courses`, icon: BookOpen },
    { label: "Test study time", value: `${Math.round(studySec / 60)} min`, icon: Timer },
    { label: "Quiz average", value: `${quizAvg}%`, icon: Layers },
    { label: "Flashcards", value: data.cards, icon: Layers },
    { label: "JAMB average", value: `${avg(jamb)}% (${jamb.length})`, icon: Trophy },
    { label: "WAEC average", value: `${avg(waec)}% (${waec.length})`, icon: Trophy },
    { label: "AI Tutor uses", value: aiUses, icon: Bot },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <h1 className="font-display text-3xl font-bold">My progress</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4">
            <s.icon className="h-5 w-5 text-primary" />
            <p className="mt-2 text-xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 font-semibold">CBT score trend</p>
          {trend.length ? <ResponsiveContainer width="100%" height={240}><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="n" /><YAxis domain={[0, 100]} /><Tooltip /><Line dataKey="score" stroke="var(--primary)" strokeWidth={2} /></LineChart></ResponsiveContainer> : <Empty />}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-3 font-semibold">Average by subject</p>
          {bySubject.length ? <ResponsiveContainer width="100%" height={240}><BarChart data={bySubject}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" hide /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="avg" fill="var(--primary)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty />}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 font-semibold">CBT history</p>
          {[...data.cbt].reverse().slice(0, 15).map((r) => (
            <Link key={r.id} to="/results/$sessionId" params={{ sessionId: r.id }} className="flex justify-between border-t border-border py-2 text-sm hover:text-primary">
              <span>{r.exam.toUpperCase()} · {r.subjects?.name}</span><span>{pct(r.score, r.total)}%</span>
            </Link>
          ))}
          {!data.cbt.length && <Empty />}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 font-semibold">Quiz history</p>
          {data.quizzes.map((q) => (
            <div key={q.id} className="flex justify-between border-t border-border py-2 text-sm">
              <span>{q.materials?.title ?? "Quiz"}</span><span>{q.best_score == null ? "Not taken" : `${pct(q.best_score, q.questions?.length ?? 0)}%`}</span>
            </div>
          ))}
          {!data.quizzes.length && <Empty />}
        </div>
      </div>
    </div>
  );
}

function Empty() { return <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet — start practising!</p>; }
