import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Timer, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/cbt/$sessionId")({
  head: () => ({ meta: [{ title: "CBT Test in progress — StudyAI" }, { name: "robots", content: "noindex" }] }),
  component: CbtEngine,
});

type Q = { id: string; question: string; options: { key: string; text: string }[]; year: number | null; source: string };

function CbtEngine() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["cbt", sessionId],
    queryFn: async () => {
      const { data: s, error: e1 } = await supabase.from("cbt_sessions").select("*, subjects(name)").eq("id", sessionId).single();
      if (e1) throw e1;
      const { data: qs, error: e2 } = await supabase.rpc("get_cbt_questions", { _session_id: sessionId });
      if (e2) throw e2;
      return { session: s as any, questions: (qs ?? []) as Q[] };
    },
    staleTime: Infinity,
  });
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [now, setNow] = useState(Date.now());
  const submitted = useRef(false);

  useEffect(() => {
    if (!data) return;
    if (data.session.submitted_at) navigate({ to: "/results/$sessionId", params: { sessionId }, replace: true });
    const local = localStorage.getItem(`cbt:${sessionId}`);
    setAnswers({ ...(data.session.answers ?? {}), ...(local ? JSON.parse(local) : {}) });
  }, [data]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Autosave locally every change, remotely every 15s
  useEffect(() => { localStorage.setItem(`cbt:${sessionId}`, JSON.stringify(answers)); }, [answers]);
  useEffect(() => {
    const t = setInterval(() => { void supabase.from("cbt_sessions").update({ answers }).eq("id", sessionId); }, 15000);
    return () => clearInterval(t);
  }, [answers]);

  const endsAt = data ? new Date(data.session.started_at).getTime() + data.session.duration_seconds * 1000 : 0;
  const left = Math.max(0, Math.floor((endsAt - now) / 1000));

  async function submit() {
    if (submitted.current) return;
    submitted.current = true;
    const { error } = await supabase.rpc("submit_cbt", { _session_id: sessionId, _answers: answers });
    if (error) { submitted.current = false; return toast.error(error.message); }
    localStorage.removeItem(`cbt:${sessionId}`);
    navigate({ to: "/results/$sessionId", params: { sessionId } });
  }
  useEffect(() => { if (data && left === 0 && !data.session.submitted_at) { toast.info("Time's up! Submitting…"); void submit(); } }, [left, data]);

  if (isLoading) return <p className="p-8 text-muted-foreground">Loading test…</p>;
  if (error || !data) return <div className="p-8"><p>Couldn't load this test.</p><Link to="/cbt" className="text-primary">Back</Link></div>;

  const qs = data.questions;
  const q = qs[idx];
  const answered = Object.keys(answers).filter((k) => qs.some((x) => x.id === k)).length;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  const palette = (
    <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
      {qs.map((x, i) => (
        <button key={x.id} onClick={() => setIdx(i)}
          className={`h-9 rounded-lg text-xs font-medium ${i === idx ? "ring-2 ring-primary" : ""} ${answers[x.id] ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{i + 1}</button>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <div className="sticky top-0 z-20 -mx-4 mb-4 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:rounded-2xl md:border md:bg-card">
        <div>
          <p className="text-xs text-muted-foreground">{data.session.exam.toUpperCase()}</p>
          <p className="font-semibold">{data.session.subjects?.name}</p>
        </div>
        <div className={`flex items-center gap-2 rounded-full px-4 py-2 font-mono text-lg font-semibold ${left < 60 ? "bg-destructive text-destructive-foreground" : "bg-secondary text-primary"}`}>
          <Timer className="h-4 w-4" />{mm}:{ss}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft md:p-8">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Question {idx + 1} of {qs.length}</span>
            <Badge variant="outline">{q.source === "past" ? `Past question${q.year ? ` · ${q.year}` : ""}` : "AI practice question"}</Badge>
          </div>
          <p className="mt-4 text-lg leading-relaxed">{q.question}</p>
          <div className="mt-6 grid gap-3">
            {q.options.map((o) => {
              const sel = answers[q.id] === o.key;
              return (
                <button key={o.key} onClick={() => setAnswers({ ...answers, [q.id]: o.key })}
                  className={`flex min-h-12 items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${sel ? "border-primary bg-secondary font-medium" : "border-border hover:border-primary/50"}`}>
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${sel ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{o.key}</span>
                  <span>{o.text}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex items-center justify-between gap-2">
            <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft className="h-4 w-4" />Prev</Button>
            <Sheet>
              <SheetTrigger asChild><Button variant="ghost" className="lg:hidden"><Grid3x3 className="h-4 w-4" />{answered}/{qs.length}</Button></SheetTrigger>
              <SheetContent side="bottom"><SheetHeader><SheetTitle>Questions</SheetTitle></SheetHeader><div className="p-4">{palette}</div></SheetContent>
            </Sheet>
            {idx < qs.length - 1
              ? <Button onClick={() => setIdx(idx + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
              : <SubmitButton onConfirm={submit} answered={answered} total={qs.length} />}
          </div>
        </div>
        <aside className="hidden space-y-4 lg:block">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
            <p className="mb-3 text-sm font-semibold">Answered {answered} of {qs.length}</p>
            {palette}
          </div>
          <SubmitButton onConfirm={submit} answered={answered} total={qs.length} full />
        </aside>
      </div>
    </div>
  );
}

function SubmitButton({ onConfirm, answered, total, full }: { onConfirm: () => void; answered: number; total: number; full?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="default" className={full ? "w-full" : ""}>Submit</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit your test?</AlertDialogTitle>
          <AlertDialogDescription>You've answered {answered} of {total} questions. You can't change answers after submitting.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Keep going</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Submit</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
