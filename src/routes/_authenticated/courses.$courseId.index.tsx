import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RichText } from "@/components/rich-text";
import { supabase } from "@/lib/supabase";
import { useCourse } from "@/lib/use-course";

export const Route = createFileRoute("/_authenticated/courses/$courseId/")({
  head: () => ({ meta: [{ title: "Course — StudyAI" }, { name: "robots", content: "noindex" }] }),
  component: CourseOverview,
});

function CourseOverview() {
  const { courseId } = Route.useParams();
  const { data, isLoading } = useCourse(courseId);
  if (isLoading) return <p className="p-8 text-muted-foreground">Loading course…</p>;
  if (!data?.course) return <p className="p-8 text-muted-foreground">Course not found.</p>;
  const { course, modules, ordered, progress } = data;
  const done = ordered.filter((l) => progress.get(l.id)?.completed).length;
  const pct = ordered.length ? Math.round((done / ordered.length) * 100) : 0;
  const recent = [...progress.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const next = (recent && ordered.find((l) => l.id === recent.lesson_id && !recent.completed)) ?? ordered.find((l) => !progress.get(l.id)?.completed) ?? ordered[0];

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <Link to="/courses" className="text-sm text-muted-foreground hover:text-primary">← All courses</Link>
      <div className="mt-3 rounded-3xl border border-border bg-card p-6 shadow-soft">
        <Badge variant="outline">{course.exam.toUpperCase()} · {course.subjects?.name}</Badge>
        <h1 className="mt-2 text-3xl font-bold">{course.title}</h1>
        {course.description && <p className="mt-2 text-muted-foreground">{course.description}</p>}
        <div className="mt-4 flex items-center gap-3"><Progress value={pct} className="h-2" /><span className="text-sm font-medium">{pct}%</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{done} of {ordered.length} lessons complete</p>
        {next && <Button asChild className="mt-4"><Link to="/courses/$courseId/lessons/$lessonId" params={{ courseId, lessonId: next.id }}>{done === 0 ? "Start course" : "Continue learning"}</Link></Button>}
      </div>
      {course.syllabus && (
        <div className="mt-6 rounded-2xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold">Syllabus</h2><RichText text={course.syllabus} /></div>
      )}
      <h2 className="mt-8 text-xl font-bold">Modules</h2>
      <div className="mt-3 space-y-4">
        {modules.map((m, i) => (
          <div key={m.id} className="rounded-2xl border border-border bg-card">
            <p className="border-b border-border p-4 font-semibold">Module {i + 1}: {m.title}</p>
            <ul className="divide-y divide-border">
              {m.lessons.map((l) => {
                const p = progress.get(l.id);
                return (
                  <li key={l.id}>
                    <Link to="/courses/$courseId/lessons/$lessonId" params={{ courseId, lessonId: l.id }} className="flex items-center gap-3 p-4 text-sm hover:bg-muted">
                      {p?.completed ? <CheckCircle2 className="h-5 w-5 text-success" /> : p ? <PlayCircle className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                      <span className="flex-1">{l.title}</span>
                      {l.duration_minutes && <span className="text-xs text-muted-foreground">{l.duration_minutes} min</span>}
                    </Link>
                  </li>
                );
              })}
              {m.lessons.length === 0 && <li className="p-4 text-sm text-muted-foreground">Lessons coming soon.</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
