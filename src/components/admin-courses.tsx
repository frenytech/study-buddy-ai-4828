import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { parseVideo, sortByPos, type Course, type Lesson, type Module } from "@/lib/courses";

export function AdminCourses() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const { data: subjects } = useQuery({ queryKey: ["subjects-all"], queryFn: async () => (await supabase.from("subjects").select("id,name,exam").order("name")).data ?? [] });
  const { data: courses } = useQuery({
    queryKey: ["admin-courses"],
    queryFn: async () => ((await supabase.from("courses").select("*, subjects(name)").order("created_at", { ascending: false })).data ?? []) as Course[],
  });
  const [nf, setNf] = useState({ exam: "jamb", subject_id: "", title: "" });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!nf.subject_id) { toast.error("Pick a subject"); return; }
    const { data, error } = await supabase.from("courses").insert({ ...nf, created_by: user?.id }).select("id").single();
    if (error) { toast.error(error.message); return; }
    setNf({ ...nf, title: "" });
    await qc.invalidateQueries({ queryKey: ["admin-courses"] });
    setSelected(data.id);
  }

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4">
        <form onSubmit={create} className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-soft">
          <h2 className="font-semibold">New course</h2>
          <Select value={nf.exam} onValueChange={(v) => setNf({ ...nf, exam: v, subject_id: "" })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="jamb">JAMB</SelectItem><SelectItem value="waec">WAEC</SelectItem></SelectContent></Select>
          <Select value={nf.subject_id} onValueChange={(v) => setNf({ ...nf, subject_id: v })}><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>{(subjects ?? []).filter((s) => s.exam === nf.exam).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          <Input required placeholder="Course title" value={nf.title} onChange={(e) => setNf({ ...nf, title: e.target.value })} />
          <Button className="w-full"><Plus className="mr-1 h-4 w-4" />Create</Button>
        </form>
        <ul className="space-y-2">
          {(courses ?? []).map((c) => (
            <li key={c.id}>
              <button onClick={() => setSelected(c.id)} className={`w-full rounded-xl border p-3 text-left text-sm ${selected === c.id ? "border-primary bg-secondary" : "border-border bg-card"}`}>
                <p className="font-medium">{c.title}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">{c.exam.toUpperCase()} · {c.subjects?.name}
                  <Badge variant={c.status === "published" ? "default" : "secondary"}>{c.status}</Badge></p>
              </button>
            </li>
          ))}
          {courses?.length === 0 && <p className="text-sm text-muted-foreground">No courses yet.</p>}
        </ul>
      </div>
      {selected ? <CourseEditor key={selected} id={selected} onDeleted={() => setSelected(null)} /> : <p className="text-sm text-muted-foreground">Pick or create a course to edit it.</p>}
    </div>
  );
}

function CourseEditor({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-course", id],
    queryFn: async () => {
      const [{ data: c }, { data: m }, { data: l }] = await Promise.all([
        supabase.from("courses").select("*").eq("id", id).single(),
        supabase.from("course_modules").select("*").eq("course_id", id),
        supabase.from("lessons").select("*").eq("course_id", id),
      ]);
      const lessons = (l ?? []) as Lesson[];
      return { course: c as Course, modules: sortByPos((m ?? []) as Module[]).map((x) => ({ ...x, lessons: sortByPos(lessons.filter((y) => y.module_id === x.id)) })) };
    },
  });
  const [f, setF] = useState({ title: "", description: "", syllabus: "", cover_url: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [newModule, setNewModule] = useState("");
  useEffect(() => { if (data?.course) setF({ title: data.course.title, description: data.course.description ?? "", syllabus: data.course.syllabus ?? "", cover_url: data.course.cover_url ?? "" }); }, [data?.course]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin-course", id] }); qc.invalidateQueries({ queryKey: ["admin-courses"] }); };
  if (!data) return <p className="text-muted-foreground">Loading…</p>;
  const { course, modules } = data;

  const run = async (p: PromiseLike<{ error: any }>, ok?: string) => { const { error } = await p; if (error) toast.error(error.message); else { if (ok) toast.success(ok); refresh(); } };
  const saveCourse = () => run(supabase.from("courses").update({ title: f.title, description: f.description || null, syllabus: f.syllabus || null, cover_url: f.cover_url || null }).eq("id", id), "Course saved");
  const togglePublish = () => run(supabase.from("courses").update({ status: course.status === "published" ? "draft" : "published" }).eq("id", id), course.status === "published" ? "Unpublished" : "Published");
  async function del() { if (!confirm("Delete this course and all its lessons?")) return; const { error } = await supabase.from("courses").delete().eq("id", id); if (error) toast.error(error.message); else { refresh(); onDeleted(); } }
  async function addModule(e: React.FormEvent) { e.preventDefault(); if (!newModule.trim()) return; await run(supabase.from("course_modules").insert({ course_id: id, title: newModule.trim(), position: modules.length })); setNewModule(""); }
  async function swap<T extends { id: string; position: number }>(table: "course_modules" | "lessons", list: T[], i: number, dir: -1 | 1) {
    const a = list[i], b = list[i + dir]; if (!a || !b) return;
    // Normalise positions to their index, then swap the pair.
    await Promise.all(list.map((x, n) => { const pos = n === i ? i + dir : n === i + dir ? i : n; return x.position === pos ? null : supabase.from(table).update({ position: pos }).eq("id", x.id); }));
    refresh();
  }
  async function addLesson(m: Module & { lessons: Lesson[] }) {
    const { data: row, error } = await supabase.from("lessons").insert({ course_id: id, module_id: m.id, title: "New lesson", position: m.lessons.length }).select("id").single();
    if (error) { toast.error(error.message); return; }
    refresh(); setEditing(row.id);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-semibold">Course details</h2>
          <Badge variant={course.status === "published" ? "default" : "secondary"}>{course.status}</Badge>
          <Button size="sm" variant="outline" onClick={togglePublish}>{course.status === "published" ? "Unpublish" : "Publish"}</Button>
          <Button size="sm" variant="ghost" onClick={del}><Trash2 className="h-4 w-4" /></Button>
        </div>
        <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><Label>Short description</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><Label>Syllabus breakdown</Label><Textarea rows={5} placeholder={"## Topics\n- Indices and logarithms\n- Quadratic equations"} value={f.syllabus} onChange={(e) => setF({ ...f, syllabus: e.target.value })} /></div>
        <div><Label>Cover image URL (optional)</Label><Input value={f.cover_url} onChange={(e) => setF({ ...f, cover_url: e.target.value })} /></div>
        <Button onClick={saveCourse}>Save details</Button>
      </div>

      <div className="space-y-4">
        <h2 className="font-semibold">Modules & lessons</h2>
        {modules.map((m, mi) => (
          <div key={m.id} className="rounded-2xl border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <Input defaultValue={m.title} className="font-medium" onBlur={(e) => e.target.value.trim() && e.target.value !== m.title && run(supabase.from("course_modules").update({ title: e.target.value.trim() }).eq("id", m.id))} />
              <Button size="icon" variant="ghost" aria-label="Move module up" disabled={mi === 0} onClick={() => swap("course_modules", modules, mi, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Move module down" disabled={mi === modules.length - 1} onClick={() => swap("course_modules", modules, mi, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" aria-label="Delete module" onClick={() => confirm("Delete this module and its lessons?") && run(supabase.from("course_modules").delete().eq("id", m.id))}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <ul className="divide-y divide-border">
              {m.lessons.map((l, li) => (
                <li key={l.id} className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-1 font-medium">{l.title}</span>
                    {!l.video_url && <Badge variant="outline">no video</Badge>}
                    <Button size="icon" variant="ghost" aria-label="Move lesson up" disabled={li === 0} onClick={() => swap("lessons", m.lessons, li, -1)}><ArrowUp className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label="Move lesson down" disabled={li === m.lessons.length - 1} onClick={() => swap("lessons", m.lessons, li, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(editing === l.id ? null : l.id)}>{editing === l.id ? "Close" : "Edit"}</Button>
                  </div>
                  {editing === l.id && <LessonForm lesson={l} onSaved={() => { refresh(); setEditing(null); }} />}
                </li>
              ))}
            </ul>
            <div className="p-3"><Button size="sm" variant="ghost" onClick={() => addLesson(m)}><Plus className="mr-1 h-4 w-4" />Add lesson</Button></div>
          </div>
        ))}
        <form onSubmit={addModule} className="flex gap-2">
          <Input placeholder="New module title" value={newModule} onChange={(e) => setNewModule(e.target.value)} />
          <Button variant="outline"><Plus className="mr-1 h-4 w-4" />Add module</Button>
        </form>
      </div>
    </div>
  );
}

function LessonForm({ lesson, onSaved }: { lesson: Lesson; onSaved: () => void }) {
  const [f, setF] = useState({
    title: lesson.title, video_url: lesson.video_url ?? "", notes: lesson.notes ?? "", duration: lesson.duration_minutes?.toString() ?? "",
    takeaways: lesson.takeaways.join("\n"), resources: lesson.resources.map((r) => `${r.label} | ${r.url}`).join("\n"),
  });
  const video = parseVideo(f.video_url);
  async function save() {
    if (f.video_url.trim() && video.kind === "none") { toast.error("That video link doesn't look right"); return; }
    const resources = f.resources.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [a, b] = l.includes("|") ? l.split("|").map((x) => x.trim()) : ["", l];
      return { label: a || b!, url: b! };
    });
    if (resources.some((r) => !/^https?:\/\//.test(r.url))) { toast.error("Each resource needs a link starting with https://"); return; }
    const { error } = await supabase.from("lessons").update({
      title: f.title.trim() || "Untitled lesson", video_url: f.video_url.trim() || null, notes: f.notes || null,
      duration_minutes: f.duration ? Number(f.duration) : null,
      takeaways: f.takeaways.split("\n").map((t) => t.trim()).filter(Boolean), resources,
    }).eq("id", lesson.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Lesson saved"); onSaved();
  }
  async function del() {
    if (!confirm("Delete this lesson?")) return;
    const { error } = await supabase.from("lessons").delete().eq("id", lesson.id);
    if (error) toast.error(error.message); else onSaved();
  }
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="mt-3 space-y-3 rounded-xl bg-muted p-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_120px]">
        <div><Label>Title</Label><Input value={f.title} onChange={set("title")} /></div>
        <div><Label>Minutes</Label><Input type="number" min={0} value={f.duration} onChange={set("duration")} /></div>
      </div>
      <div><Label>Video link (YouTube, Vimeo or direct .mp4)</Label><Input value={f.video_url} onChange={set("video_url")} placeholder="https://youtu.be/..." />
        {f.video_url && <p className="mt-1 text-xs text-muted-foreground">{video.kind === "none" ? "Not recognised" : `Detected: ${video.kind === "file" ? "direct video" : video.kind}`}</p>}</div>
      <div><Label>Lesson notes</Label><Textarea rows={8} value={f.notes} onChange={set("notes")} placeholder={"## Heading\nUse **bold**, *italic*, - bullet points and [links](https://...)"} /></div>
      <div><Label>Key takeaways (one per line)</Label><Textarea rows={3} value={f.takeaways} onChange={set("takeaways")} /></div>
      <div><Label>Resources (one per line: Label | https://link)</Label><Textarea rows={3} value={f.resources} onChange={set("resources")} placeholder="Past questions PDF | https://..." /></div>
      <div className="flex gap-2"><Button size="sm" onClick={save}>Save lesson</Button><Button size="sm" variant="ghost" onClick={del}>Delete lesson</Button></div>
    </div>
  );
}
