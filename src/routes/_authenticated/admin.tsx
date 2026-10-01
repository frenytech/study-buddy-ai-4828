import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase, authHeader } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { AdminCourses } from "@/components/admin-courses";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Control Room — StudyAI" }, { name: "robots", content: "noindex" }] }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <p className="p-8 text-muted-foreground">You don't have access to this page.</p>;
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">Admin Control Room</h1>
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ai">AI Question Generator</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="import">Bulk upload</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="ai"><AiGenerator /></TabsContent>
        <TabsContent value="questions"><Questions /></TabsContent>
        <TabsContent value="courses"><AdminCourses /></TabsContent>
        <TabsContent value="import"><BulkImport /></TabsContent>
        <TabsContent value="users"><Users /></TabsContent>
        <TabsContent value="payments"><Payments /></TabsContent>
      </Tabs>
    </div>
  );
}

function useSubjects() {
  return useQuery({ queryKey: ["subjects-all"], queryFn: async () => (await supabase.from("subjects").select("id,name,exam").order("name")).data ?? [] });
}

function Overview() {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const c = async (t: string, f?: (q: any) => any) => { let q: any = supabase.from(t).select("*", { count: "exact", head: true }); if (f) q = f(q); return (await q).count ?? 0; };
      return {
        users: await c("profiles"),
        questions: await c("questions"),
        published: await c("questions", (q) => q.eq("status", "published")),
        tests: await c("cbt_sessions", (q) => q.not("submitted_at", "is", null)),
        paid: await c("subscriptions", (q) => q.neq("plan", "free")),
      };
    },
  });
  const items = [["Students", data?.users], ["Questions", data?.questions], ["Published", data?.published], ["Tests taken", data?.tests], ["Paid subscribers", data?.paid]];
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(([l, v]) => <div key={l as string} className="rounded-2xl border border-border bg-card p-5 shadow-soft"><p className="font-display text-2xl font-bold">{v ?? "–"}</p><p className="text-sm text-muted-foreground">{l}</p></div>)}
    </div>
  );
}

const empty = { exam: "jamb", subject_id: "", year: "", question: "", A: "", B: "", C: "", D: "", answer: "A", explanation: "", source: "past" };

function AiGenerator() {
  const qc = useQueryClient();
  const { data: subjects } = useSubjects();
  const [exam, setExam] = useState("jamb");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [count, setCount] = useState("10");
  const [busy, setBusy] = useState(false);
  const { data: queue } = useQuery({
    queryKey: ["admin-review-queue"],
    queryFn: async () => (await supabase.from("questions").select("id,exam,question,options,answer,explanation,topic,difficulty,subjects(name)").eq("status", "pending_review").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-review-queue"] }); qc.invalidateQueries({ queryKey: ["admin-questions"] }); };

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!subject) { toast.error("Pick a subject"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/generate-questions", {
        method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ exam, subjectId: subject, topic, difficulty, count: Number(count) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error ?? "Generation failed"); return; }
      toast.success(`${body.count} questions added to the review queue`);
      refresh();
    } finally { setBusy(false); }
  }
  async function publishAll() {
    if (!queue?.length || !confirm(`Publish all ${queue.length} questions in the queue?`)) return;
    const { error } = await supabase.from("questions").update({ status: "published" }).in("id", queue.map((q: any) => q.id));
    if (error) toast.error(error.message); else toast.success("Published");
    refresh();
  }

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[340px_1fr]">
      <form onSubmit={generate} className="h-fit space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold">Generate questions</h2>
        <div><Label>Exam</Label><Select value={exam} onValueChange={(v) => { setExam(v); setSubject(""); }}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="jamb">JAMB</SelectItem><SelectItem value="waec">WAEC</SelectItem></SelectContent></Select></div>
        <div><Label>Subject</Label><Select value={subject} onValueChange={setSubject}><SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
          <SelectContent>{(subjects ?? []).filter((s) => s.exam === exam).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>Topic</Label><Input required minLength={2} placeholder="e.g. Quadratic equations" value={topic} onChange={(e) => setTopic(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Difficulty</Label><Select value={difficulty} onValueChange={setDifficulty}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="easy">Easy</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="hard">Hard</SelectItem></SelectContent></Select></div>
          <div><Label>How many</Label><Input type="number" min={1} max={30} value={count} onChange={(e) => setCount(e.target.value)} /></div>
        </div>
        <Button className="w-full" disabled={busy}>{busy ? "Generating… (up to a minute)" : "Generate"}</Button>
        <p className="text-xs text-muted-foreground">Generated questions wait in the review queue. Students only see them after you publish.</p>
      </form>
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Review queue ({queue?.length ?? 0})</h2>
          {!!queue?.length && <Button size="sm" variant="outline" onClick={publishAll}>Publish all</Button>}
        </div>
        {!queue?.length && <p className="mt-4 text-sm text-muted-foreground">Nothing to review. Generate some questions to get started.</p>}
        <div className="mt-4 space-y-3">{(queue ?? []).map((q: any) => <ReviewCard key={q.id} q={q} onDone={refresh} />)}</div>
      </div>
    </div>
  );
}

function ReviewCard({ q, onDone }: { q: any; onDone: () => void }) {
  const [question, setQuestion] = useState<string>(q.question);
  const [opts, setOpts] = useState<{ key: string; text: string }[]>(q.options);
  const [answer, setAnswer] = useState<string>(q.answer);
  const [explanation, setExplanation] = useState<string>(q.explanation ?? "");
  const [saving, setSaving] = useState(false);
  async function save(status: "pending_review" | "published") {
    if (!question.trim() || opts.some((o) => !o.text.trim())) { toast.error("Question and all options need text"); return; }
    setSaving(true);
    const { error } = await supabase.from("questions").update({ question: question.trim(), options: opts.map((o) => ({ ...o, text: o.text.trim() })), answer, explanation: explanation.trim() || null, status }).eq("id", q.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "published" ? "Published to the question bank" : "Changes saved");
    onDone();
  }
  async function discard() {
    if (!confirm("Discard this question?")) return;
    const { error } = await supabase.from("questions").delete().eq("id", q.id);
    if (error) toast.error(error.message); else onDone();
  }
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline">{q.exam.toUpperCase()} · {q.subjects?.name}</Badge>
        {q.topic && <Badge variant="secondary">{q.topic}</Badge>}
        {q.difficulty && <Badge variant="outline" className="capitalize">{q.difficulty}</Badge>}
      </div>
      <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} />
      {opts.map((o, i) => (
        <div key={o.key} className="flex items-center gap-2">
          <button type="button" onClick={() => setAnswer(o.key)} aria-label={`Mark ${o.key} correct`}
            className={`h-8 w-8 shrink-0 rounded-full border text-sm font-semibold ${answer === o.key ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{o.key}</button>
          <Input value={o.text} onChange={(e) => setOpts(opts.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Tap a letter to set the correct answer (currently {answer}).</p>
      <Textarea rows={4} placeholder="Explanation" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={saving} onClick={() => save("published")}>Approve & publish</Button>
        <Button size="sm" variant="outline" disabled={saving} onClick={() => save("pending_review")}>Save edits</Button>
        <Button size="sm" variant="ghost" disabled={saving} onClick={discard}>Discard</Button>
      </div>
    </div>
  );
}

function Questions() {
  const qc = useQueryClient();
  const { data: subjects } = useSubjects();
  const [f, setF] = useState(empty);
  const [filter, setFilter] = useState<string>("all");
  const { data: qs } = useQuery({
    queryKey: ["admin-questions", filter],
    queryFn: async () => {
      let q = supabase.from("questions").select("id,exam,question,answer,status,source,year,subjects(name)").order("created_at", { ascending: false }).limit(200);
      if (filter !== "all") q = q.eq("subject_id", filter);
      return (await q).data ?? [];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-questions"] });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.subject_id) { toast.error("Pick a subject"); return; }
    const options = (["A", "B", "C", "D"] as const).filter((k) => f[k].trim()).map((k) => ({ key: k, text: f[k].trim() }));
    const { error } = await supabase.from("questions").insert({
      exam: f.exam, subject_id: f.subject_id, year: f.year ? Number(f.year) : null, question: f.question, options,
      answer: f.answer, explanation: f.explanation || null, source: f.source, status: "draft",
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Saved as draft");
    setF({ ...empty, exam: f.exam, subject_id: f.subject_id, source: f.source });
    refresh();
  }
  const set = (k: keyof typeof empty) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={save} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <h2 className="font-semibold">Add question</h2>
        <div className="grid grid-cols-2 gap-2">
          <Select value={f.exam} onValueChange={(v) => setF({ ...f, exam: v, subject_id: "" })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="jamb">JAMB</SelectItem><SelectItem value="waec">WAEC</SelectItem></SelectContent></Select>
          <Input placeholder="Year" value={f.year} onChange={set("year")} />
        </div>
        <Select value={f.subject_id} onValueChange={(v) => setF({ ...f, subject_id: v })}><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>{(subjects ?? []).filter((s) => s.exam === f.exam).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
        <Textarea required placeholder="Question" value={f.question} onChange={set("question")} />
        {(["A", "B", "C", "D"] as const).map((k) => <Input key={k} required={k < "C"} placeholder={`Option ${k}`} value={f[k]} onChange={set(k)} />)}
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Answer</Label><Select value={f.answer} onValueChange={(v) => setF({ ...f, answer: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["A", "B", "C", "D"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Type</Label><Select value={f.source} onValueChange={(v) => setF({ ...f, source: v })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="past">Past question</SelectItem><SelectItem value="ai_practice">AI practice</SelectItem></SelectContent></Select></div>
        </div>
        <Textarea placeholder="Explanation (optional)" value={f.explanation} onChange={set("explanation")} />
        <Button className="w-full">Save draft</Button>
      </form>
      <div>
        <Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All subjects</SelectItem>{(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.exam.toUpperCase()} · {s.name}</SelectItem>)}</SelectContent></Select>
        <div className="mt-4 space-y-2">
          {(qs ?? []).map((q: any) => (
            <div key={q.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline">{q.exam.toUpperCase()} · {q.subjects?.name}</Badge>
                <Badge variant={q.status === "published" ? "default" : "secondary"}>{q.status}</Badge>
                <Badge variant="outline">{q.source === "past" ? `Past ${q.year ?? ""}` : "AI practice"}</Badge>
                <span className="text-muted-foreground">Answer: {q.answer}</span>
              </div>
              <p className="mt-2 text-sm">{q.question}</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" onClick={async () => { await supabase.from("questions").update({ status: q.status === "published" ? "draft" : "published" }).eq("id", q.id); refresh(); }}>
                  {q.status === "published" ? "Unpublish" : "Approve & publish"}
                </Button>
                <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Delete this question?")) { await supabase.from("questions").delete().eq("id", q.id); refresh(); } }}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BulkImport() {
  const { data: subjects } = useSubjects();
  const [exam, setExam] = useState("jamb");
  const [subject, setSubject] = useState("");
  const [source, setSource] = useState("past");
  const [text, setText] = useState("");
  async function run() {
    if (!subject) { toast.error("Pick a subject"); return; }
    let rows: any[];
    try { rows = JSON.parse(text); if (!Array.isArray(rows)) throw 0; } catch { { toast.error("Paste a valid JSON array"); return; } }
    const bad = rows.findIndex((r) => !r.question || !Array.isArray(r.options) || !r.answer);
    if (bad >= 0) { toast.error(`Row ${bad + 1} is missing question, options or answer`); return; }
    const { error } = await supabase.from("questions").insert(rows.map((r) => ({
      exam, subject_id: subject, source, status: "draft", question: String(r.question), answer: String(r.answer).toUpperCase(),
      year: r.year ? Number(r.year) : null, explanation: r.explanation ?? null,
      options: r.options.map((o: any, i: number) => typeof o === "string" ? { key: "ABCDE"[i], text: o } : o),
    })));
    if (error) { toast.error(error.message); return; }
    toast.success(`Imported ${rows.length} questions as drafts. Review and publish them in Questions.`);
    setText("");
  }
  return (
    <div className="mt-4 max-w-3xl space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <p className="text-sm text-muted-foreground">Paste a JSON array. Each item: {`{"question": "...", "options": ["...","...","...","..."], "answer": "B", "year": 2019, "explanation": "..."}`}. Imports land as drafts for review.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <Select value={exam} onValueChange={(v) => { setExam(v); setSubject(""); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="jamb">JAMB</SelectItem><SelectItem value="waec">WAEC</SelectItem></SelectContent></Select>
        <Select value={subject} onValueChange={setSubject}><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
          <SelectContent>{(subjects ?? []).filter((s) => s.exam === exam).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
        <Select value={source} onValueChange={setSource}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="past">Past questions</SelectItem><SelectItem value="ai_practice">AI practice</SelectItem></SelectContent></Select>
      </div>
      <Textarea rows={12} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      <Button onClick={run}>Import</Button>
    </div>
  );
}

function Users() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const [planF, setPlanF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: p }, { data: r }, { data: s }, { data: u }] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,created_at,academic_level,department,disabled").order("created_at", { ascending: false }).limit(1000),
        supabase.from("user_roles").select("user_id,role").eq("role", "admin"),
        supabase.from("subscriptions").select("user_id,plan,status,current_period_end"),
        supabase.from("ai_usage").select("user_id,count").eq("day", today),
      ]);
      const admins = new Set((r ?? []).map((x) => x.user_id));
      const subs = new Map((s ?? []).map((x) => [x.user_id, x]));
      const use = new Map((u ?? []).map((x) => [x.user_id, x.count]));
      return (p ?? []).map((x) => {
        const sub = subs.get(x.id);
        const active = sub && sub.status === "active" && (!sub.current_period_end || new Date(sub.current_period_end) > new Date());
        return { ...x, admin: admins.has(x.id), plan: active ? sub!.plan : "free", used: use.get(x.id) ?? 0 };
      });
    },
  });
  async function toggle(id: string, admin: boolean) {
    if (id === me?.id) return toast.error("You can't change your own role.");
    const { error } = admin
      ? await supabase.from("user_roles").delete().eq("user_id", id).eq("role", "admin")
      : await supabase.from("user_roles").insert({ user_id: id, role: "admin" });
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }
  async function setDisabled(id: string, disabled: boolean) {
    const { error } = await supabase.from("profiles").update({ disabled }).eq("id", id);
    if (error) toast.error(error.message); else toast.success(disabled ? "Account disabled" : "Account enabled");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }
  const t = q.toLowerCase();
  const rows = (data ?? []).filter((u) =>
    (!t || `${u.full_name ?? ""} ${u.email ?? ""} ${u.department ?? ""}`.toLowerCase().includes(t)) &&
    (planF === "all" || u.plan === planF) &&
    (statusF === "all" || (statusF === "admin" ? u.admin : statusF === "disabled" ? u.disabled : !u.disabled)));
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search name, email, department…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select value={planF} onChange={(e) => setPlanF(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All plans</option><option value="free">Free</option><option value="pro">Pro</option><option value="premium">Premium</option>
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="all">All accounts</option><option value="active">Active</option><option value="disabled">Disabled</option><option value="admin">Admins</option>
        </select>
        <span className="self-center text-sm text-muted-foreground">{rows.length} users</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Level / Dept</th><th className="p-3">Plan</th><th className="p-3">AI today</th><th className="p-3">Joined</th><th className="p-3"></th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3">{u.full_name ?? "—"} {u.admin && <Badge className="ml-1">admin</Badge>} {u.disabled && <Badge variant="destructive" className="ml-1">disabled</Badge>}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">{u.academic_level ?? "—"} · {u.department ?? "—"}</td>
                <td className="p-3 capitalize">{u.plan}</td>
                <td className="p-3">{u.used}</td>
                <td className="p-3">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="space-x-2 whitespace-nowrap p-3 text-right">
                  {u.id !== me?.id && <>
                    <Button size="sm" variant="outline" onClick={() => toggle(u.id, u.admin)}>{u.admin ? "Remove admin" : "Make admin"}</Button>
                    <Button size="sm" variant={u.disabled ? "outline" : "destructive"} onClick={() => setDisabled(u.id, !u.disabled)}>{u.disabled ? "Enable" : "Disable"}</Button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Payments() {
  const { data } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => (await supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(300)).data ?? [],
  });
  const total = (data ?? []).filter((p: any) => p.status === "success").reduce((a: number, p: any) => a + p.amount_kobo, 0) / 100;
  return (
    <div className="mt-4">
      <p className="mb-3 text-sm">Total received: <span className="font-semibold">₦{total.toLocaleString()}</span></p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left"><tr><th className="p-3">Reference</th><th className="p-3">Plan</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Date</th></tr></thead>
          <tbody>
            {(data ?? []).map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-3 font-mono text-xs">{p.reference}</td><td className="p-3 capitalize">{p.plan}</td>
                <td className="p-3">₦{(p.amount_kobo / 100).toLocaleString()}</td>
                <td className="p-3"><Badge variant={p.status === "success" ? "default" : "secondary"}>{p.status}</Badge></td>
                <td className="p-3">{new Date(p.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
