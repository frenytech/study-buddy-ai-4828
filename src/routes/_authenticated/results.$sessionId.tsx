import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { AiAnalysis } from "@/components/ai-analysis";

export const Route = createFileRoute("/_authenticated/results/$sessionId")({
  head: () => ({ meta: [{ title: "Test results — StudyAI" }, { name: "robots", content: "noindex" }] }),
  component: Results,
});

function Results() {
  const { sessionId } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["review", sessionId],
    queryFn: async () => {
      const { data: s } = await supabase.from("cbt_sessions").select("*, subjects(name)").eq("id", sessionId).single();
      const { data: r } = await supabase.rpc("get_cbt_review", { _session_id: sessionId });
      return { s: s as any, review: (r ?? []) as any[] };
    },
  });
  if (isLoading || !data) return <p className="p-8 text-muted-foreground">Loading results…</p>;
  const { s, review } = data;
  const pct = s.total ? Math.round((s.score / s.total) * 100) : 0;
  const used = s.submitted_at ? Math.round((new Date(s.submitted_at).getTime() - new Date(s.started_at).getTime()) / 60000) : 0;

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <p className="text-sm text-muted-foreground">{s.exam.toUpperCase()} · {s.subjects?.name}</p>
        <p className={`mt-2 font-display text-6xl font-bold ${pct >= 50 ? "text-primary" : "text-destructive"}`}>{pct}%</p>
        <p className="mt-1">{s.score} of {s.total} correct · {used} min</p>
        <p className="mt-3 text-sm text-muted-foreground">{pct >= 70 ? "Excellent work — keep it up!" : pct >= 50 ? "Good effort. Review the ones you missed." : "Keep practising. Go through the explanations below."}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Button asChild><Link to="/cbt">Take another test</Link></Button>
          <Button variant="outline" asChild><Link to="/tutor">Ask the Tutor</Link></Button>
        </div>
      </div>
      <AiAnalysis sessionId={sessionId} analysis={s.ai_analysis ?? null} analyzedAt={s.ai_analysis_at ?? null} />
      <h2 className="mt-10 text-xl font-bold">Review</h2>
      <div className="mt-4 space-y-4">
        {review.map((q, i) => {
          const mine = s.answers?.[q.id];
          const ok = mine && mine.toUpperCase() === q.answer.toUpperCase();
          return (
            <div key={q.id} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                {ok ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Q{i + 1}</span><Badge variant="outline">{q.source === "past" ? `Past question${q.year ? ` · ${q.year}` : ""}` : "AI practice"}</Badge>
                  </div>
                  <p className="mt-1 font-medium">{q.question}</p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {q.options.map((o: any) => (
                      <li key={o.key} className={`rounded-lg px-3 py-1.5 ${o.key === q.answer ? "bg-secondary font-medium text-primary" : o.key === mine ? "bg-destructive/10 text-destructive" : ""}`}>
                        {o.key}. {o.text}
                      </li>
                    ))}
                  </ul>
                  {!mine && <p className="mt-2 text-xs text-muted-foreground">Not answered</p>}
                  {q.explanation && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{q.explanation}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
