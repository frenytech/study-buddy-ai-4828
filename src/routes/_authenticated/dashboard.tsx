import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Timer, Bot, Trophy, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — StudyAI" }, { name: "description", content: "Your StudyAI learning dashboard." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, plan } = useAuth();
  const { data: sessions } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: async () => (await supabase.from("cbt_sessions").select("id, exam, score, total, submitted_at, subjects(name)")
      .not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(20)).data ?? [],
  });
  const { data: usage } = useQuery({
    queryKey: ["ai-usage-today"],
    queryFn: async () => (await supabase.from("ai_usage").select("count").eq("day", new Date().toISOString().slice(0, 10)).maybeSingle()).data?.count ?? 0,
  });
  const done = sessions ?? [];
  const avg = done.length ? Math.round(done.reduce((a, s: any) => a + (s.score / s.total) * 100, 0) / done.length) : 0;
  const best = done.length ? Math.max(...done.map((s: any) => Math.round((s.score / s.total) * 100))) : 0;
  const bySubject = new Map<string, { sum: number; n: number }>();
  done.forEach((s: any) => {
    const k = `${s.exam.toUpperCase()} · ${s.subjects?.name}`;
    const v = bySubject.get(k) ?? { sum: 0, n: 0 };
    v.sum += (s.score / s.total) * 100; v.n++; bySubject.set(k, v);
  });
  const name = (user?.user_metadata?.["full_name"] as string | undefined)?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">Hi {name} 👋</h1>
      <p className="text-muted-foreground">You're on the <span className="font-semibold capitalize text-foreground">{plan}</span> plan.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Timer} label="Tests taken" value={done.length} />
        <Stat icon={Target} label="Average score" value={`${avg}%`} />
        <Stat icon={Trophy} label="Best score" value={`${best}%`} />
        <Stat icon={Bot} label="Tutor messages today" value={usage ?? 0} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild><Link to="/cbt">Start a CBT test</Link></Button>
        <Button variant="outline" asChild><Link to="/tutor">Ask the AI Tutor</Link></Button>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Progress by subject</h2>
          {bySubject.size === 0 && <p className="mt-3 text-sm text-muted-foreground">Take a test to see your progress here.</p>}
          <div className="mt-4 space-y-3">
            {[...bySubject.entries()].map(([k, v]) => {
              const pct = Math.round(v.sum / v.n);
              return (
                <div key={k}>
                  <div className="flex justify-between text-sm"><span>{k}</span><span className="font-medium">{pct}%</span></div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${pct >= 50 ? "bg-primary" : "bg-accent"}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h2 className="font-semibold">Recent tests</h2>
          {done.length === 0 && <p className="mt-3 text-sm text-muted-foreground">No tests yet.</p>}
          <ul className="mt-3 divide-y divide-border">
            {done.slice(0, 6).map((s: any) => (
              <li key={s.id}>
                <Link to="/results/$sessionId" params={{ sessionId: s.id }} className="flex justify-between py-2 text-sm hover:text-primary">
                  <span>{s.exam.toUpperCase()} · {s.subjects?.name}</span>
                  <span className="font-medium">{s.score}/{s.total}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
