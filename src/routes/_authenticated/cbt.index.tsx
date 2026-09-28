import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/cbt/")({
  head: () => ({ meta: [{ title: "CBT Practice — StudyAI" }, { name: "description", content: "Set up a JAMB or WAEC CBT practice test." }] }),
  component: CbtSetup,
});

function CbtSetup() {
  const [exam, setExam] = useState<"jamb" | "waec">("jamb");
  const [subject, setSubject] = useState<string>("");
  const [count, setCount] = useState("20");
  const [minutes, setMinutes] = useState("20");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const { data: subjects } = useQuery({
    queryKey: ["subjects-with-counts"],
    queryFn: async () => {
      const [{ data: s }, { data: c }] = await Promise.all([
        supabase.from("subjects").select("id,name,exam").order("name"),
        supabase.rpc("question_counts"),
      ]);
      const counts = new Map((c ?? []).map((r: any) => [r.subject_id, Number(r.total)]));
      return (s ?? []).map((x) => ({ ...x, total: counts.get(x.id) ?? 0 }));
    },
  });
  const list = (subjects ?? []).filter((s) => s.exam === exam);

  async function start() {
    if (!subject) return toast.error("Pick a subject");
    setBusy(true);
    const { data, error } = await supabase.rpc("start_cbt", { _subject_id: subject, _count: Number(count), _minutes: Number(minutes) });
    setBusy(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/cbt/$sessionId", params: { sessionId: data as string } });
  }

  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">CBT Practice</h1>
      <p className="text-muted-foreground">Choose your exam and subject. The timer starts as soon as you begin.</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {(["jamb", "waec"] as const).map((e) => (
          <button key={e} onClick={() => { setExam(e); setSubject(""); }}
            className={`rounded-2xl border p-5 text-left transition ${exam === e ? "border-primary bg-secondary ring-2 ring-primary/20" : "border-border bg-card"}`}>
            <p className="font-display text-xl font-bold">{e.toUpperCase()}</p>
            <p className="text-sm text-muted-foreground">{e === "jamb" ? "UTME" : "SSCE"} practice</p>
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div>
          <Label>Subject</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger><SelectValue placeholder="Select a subject" /></SelectTrigger>
            <SelectContent>
              {list.map((s) => <SelectItem key={s.id} value={s.id} disabled={s.total === 0}>{s.name} {s.total ? `(${s.total} questions)` : "— coming soon"}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Questions</Label>
            <Select value={count} onValueChange={setCount}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["5", "10", "20", "40", "60"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Minutes</Label>
            <Select value={minutes} onValueChange={setMinutes}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["5", "10", "20", "30", "60", "120"].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button className="w-full" size="lg" onClick={start} disabled={busy}>{busy ? "Preparing…" : "Start test"}</Button>
      </div>
    </div>
  );
}
