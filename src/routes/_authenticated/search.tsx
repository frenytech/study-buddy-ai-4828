import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "Search — StudyAI" }, { name: "description", content: "Search courses, materials, subjects and topics." }] }),
  component: SearchPage,
});

function SearchPage() {
  const { isAdmin } = useAuth();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 300); return () => clearTimeout(t); }, [q]);
  const like = `%${term.replace(/[%_,()]/g, " ")}%`;
  const { data, isFetching } = useQuery({
    queryKey: ["search", term, isAdmin],
    enabled: term.length >= 2,
    queryFn: async () => {
      const [courses, materials, subjects, lessons, questions] = await Promise.all([
        supabase.from("courses").select("id,title,exam,subjects(name)").or(`title.ilike.${like},description.ilike.${like}`).limit(10),
        supabase.from("materials").select("id,title").ilike("title", like).limit(10),
        supabase.from("subjects").select("id,name,exam").ilike("name", like).limit(10),
        supabase.from("lessons").select("id,title,course_id").ilike("title", like).limit(10),
        isAdmin ? supabase.from("questions").select("id,question,exam,topic").or(`question.ilike.${like},topic.ilike.${like}`).limit(10) : Promise.resolve({ data: [] as any[] }),
      ]);
      return { courses: (courses.data ?? []) as any[], materials: materials.data ?? [], subjects: subjects.data ?? [], lessons: lessons.data ?? [], questions: (questions.data ?? []) as any[] };
    },
  });
  const empty = data && !Object.values(data).some((a) => a.length);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <h1 className="font-display text-3xl font-bold">Search</h1>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses, lessons, materials, JAMB/WAEC subjects…" className="pl-9" />
      </div>
      {isFetching && <p className="text-sm text-muted-foreground">Searching…</p>}
      {empty && <p className="text-sm text-muted-foreground">No results for “{term}”.</p>}
      {data && (
        <div className="space-y-5">
          <Group title="Subjects" items={data.subjects.map((s) => (
            <Link key={s.id} to="/cbt" className="flex items-center justify-between"><span>{s.name}</span><Badge variant="outline">{s.exam.toUpperCase()}</Badge></Link>
          ))} />
          <Group title="Courses" items={data.courses.map((c) => (
            <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="flex items-center justify-between"><span>{c.title}</span><Badge variant="outline">{c.exam.toUpperCase()} · {c.subjects?.name}</Badge></Link>
          ))} />
          <Group title="Lessons" items={data.lessons.map((l) => (
            <Link key={l.id} to="/courses/$courseId/lessons/$lessonId" params={{ courseId: l.course_id, lessonId: l.id }}>{l.title}</Link>
          ))} />
          <Group title="My materials" items={data.materials.map((m) => (
            <Link key={m.id} to="/materials/$materialId" params={{ materialId: m.id }}>{m.title}</Link>
          ))} />
          {isAdmin && <Group title="Questions (admin)" items={data.questions.map((x) => (
            <div key={x.id} className="flex justify-between gap-3"><span className="line-clamp-1">{x.question}</span><Badge variant="outline">{x.exam.toUpperCase()}{x.topic ? ` · ${x.topic}` : ""}</Badge></div>
          ))} />}
        </div>
      )}
    </div>
  );
}

function Group({ title, items }: { title: string; items: React.ReactNode[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="divide-y divide-border text-sm [&>*]:block [&>*]:py-2 [&_a:hover]:text-primary">{items}</div>
    </div>
  );
}
