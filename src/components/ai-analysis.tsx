import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, TrendingUp, AlertTriangle, Brain, CalendarDays, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authHeader } from "@/lib/supabase";

type Analysis = {
  readiness: string; summary: string; time_management?: string;
  strengths: { topic: string; note: string }[];
  weaknesses: { topic: string; note: string; severity?: string }[];
  errors: { question: number; misconception: string; fix: string }[];
  plan: { day: number; focus: string; tasks: string[] }[];
};

export function AiAnalysis({ sessionId, analysis, analyzedAt }: { sessionId: string; analysis: Analysis | null; analyzedAt: string | null }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch("/api/cbt/analyze", {
        method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ sessionId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? "Analysis failed"); return; }
      await qc.invalidateQueries({ queryKey: ["review", sessionId] });
      qc.invalidateQueries({ queryKey: ["my-sessions"] });
    } finally { setBusy(false); }
  }

  if (!analysis) {
    return (
      <div className="mt-6 rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <Sparkles className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-2 text-lg font-bold">Get your AI diagnosis</h2>
        <p className="mt-1 text-sm text-muted-foreground">See your readiness, weak topics, why you missed questions, and a 7-day revision plan. Uses 1 AI credit.</p>
        <Button className="mt-4" onClick={run} disabled={busy}>{busy ? "Analysing… (up to a minute)" : "Analyze Performance with AI"}</Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <Section icon={Sparkles} title="Performance summary">
        <Badge className="mb-2">{analysis.readiness}</Badge>
        <p className="text-sm leading-relaxed">{analysis.summary}</p>
        {analysis.time_management && <p className="mt-3 flex gap-2 rounded-lg bg-muted p-3 text-sm"><Clock className="mt-0.5 h-4 w-4 shrink-0" />{analysis.time_management}</p>}
      </Section>
      <Section icon={TrendingUp} title="Topic-by-topic breakdown">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-success">Strengths</p>
            {analysis.strengths.length === 0 && <p className="text-sm text-muted-foreground">None clear yet.</p>}
            <ul className="space-y-2">{analysis.strengths.map((s, i) => <li key={i} className="rounded-lg border border-border p-3 text-sm"><p className="font-medium">{s.topic}</p><p className="text-muted-foreground">{s.note}</p></li>)}</ul>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-destructive">Weak areas</p>
            {analysis.weaknesses.length === 0 && <p className="text-sm text-muted-foreground">No major gaps found.</p>}
            <ul className="space-y-2">{analysis.weaknesses.map((w, i) => (
              <li key={i} className="rounded-lg border border-border p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">{w.topic}{w.severity && <Badge variant={w.severity === "critical" ? "destructive" : "secondary"} className="capitalize">{w.severity}</Badge>}</p>
                <p className="text-muted-foreground">{w.note}</p>
              </li>
            ))}</ul>
          </div>
        </div>
      </Section>
      {analysis.errors.length > 0 && (
        <Section icon={Brain} title="Misconceptions & errors">
          <ul className="space-y-3">{analysis.errors.map((e, i) => (
            <li key={i} className="text-sm"><p className="font-medium">Q{e.question}: {e.misconception}</p><p className="text-muted-foreground">Fix: {e.fix}</p></li>
          ))}</ul>
        </Section>
      )}
      <Section icon={CalendarDays} title="7-day revision plan">
        <ol className="space-y-3">{analysis.plan.map((d) => (
          <li key={d.day} className="rounded-lg border border-border p-3 text-sm">
            <p className="font-semibold">Day {d.day}: {d.focus}</p>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">{d.tasks.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </li>
        ))}</ol>
      </Section>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />AI analysis{analyzedAt ? ` · ${new Date(analyzedAt).toLocaleString()}` : ""}</span>
        <Button size="sm" variant="ghost" onClick={run} disabled={busy}>{busy ? "Analysing…" : "Re-analyze"}</Button>
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h3 className="mb-3 flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-primary" />{title}</h3>
      {children}
    </div>
  );
}
