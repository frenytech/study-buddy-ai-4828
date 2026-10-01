import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/courses/")({
  head: () => ({ meta: [{ title: "Courses — StudyAI" }, { name: "description", content: "Video courses for JAMB and WAEC subjects." }] }),
  component: Courses,
});

function Courses() {
  const [exam, setExam] = useState<"jamb" | "waec">("jamb");
  const { data, isLoading } = useQuery({
    queryKey: ["courses-list"],
    queryFn: async () => {
      const [{ data: c }, { data: l }, { data: p }] = await Promise.all([
        supabase.from("courses").select("*, subjects(name)").eq("status", "published").order("title"),
        supabase.from("lessons").select("id,course_id"),
        supabase.from("lesson_progress").select("course_id,completed").eq("completed", true),
      ]);
      const total = new Map<string, number>(); (l ?? []).forEach((x) => total.set(x.course_id, (total.get(x.course_id) ?? 0) + 1));
      const done = new Map<string, number>(); (p ?? []).forEach((x) => done.set(x.course_id, (done.get(x.course_id) ?? 0) + 1));
      return ((c ?? []) as Course[]).map((x) => ({ ...x, total: total.get(x.id) ?? 0, done: done.get(x.id) ?? 0 }));
    },
  });
  const list = (data ?? []).filter((c) => c.exam === exam);
  const bySubject = new Map<string, typeof list>();
  list.forEach((c) => { const k = c.subjects?.name ?? "Other"; bySubject.set(k, [...(bySubject.get(k) ?? []), c]); });

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">Courses</h1>
      <p className="mt-1 text-muted-foreground">Video lessons, notes and key takeaways for every subject.</p>
      <Tabs value={exam} onValueChange={(v) => setExam(v as "jamb" | "waec")} className="mt-6">
        <TabsList><TabsTrigger value="jamb">JAMB</TabsTrigger><TabsTrigger value="waec">WAEC</TabsTrigger></TabsList>
      </Tabs>
      {isLoading && <p className="mt-6 text-muted-foreground">Loading courses…</p>}
      {!isLoading && list.length === 0 && <p className="mt-6 text-muted-foreground">No {exam.toUpperCase()} courses yet. Check back soon.</p>}
      {[...bySubject.entries()].map(([subject, cs]) => (
        <section key={subject} className="mt-8">
          <h2 className="text-lg font-semibold">{subject}</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cs.map((c) => {
              const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
              return (
                <Link key={c.id} to="/courses/$courseId" params={{ courseId: c.id }} className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5">
                  <div className="aspect-video bg-secondary">
                    {c.cover_url ? <img src={c.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center"><PlayCircle className="h-10 w-10 text-primary" /></div>}
                  </div>
                  <div className="p-4">
                    <p className="font-semibold group-hover:text-primary">{c.title}</p>
                    {c.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
                    <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Progress value={pct} className="h-2" /><span>{pct}%</span></div>
                    <p className="mt-1 text-xs text-muted-foreground">{c.done}/{c.total} lessons</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
