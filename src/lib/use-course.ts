import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { sortByPos, type Course, type Lesson, type Module } from "@/lib/courses";

export function useCourse(courseId: string) {
  return useQuery({
    queryKey: ["course", courseId],
    queryFn: async () => {
      const [{ data: c }, { data: m }, { data: l }, { data: p }] = await Promise.all([
        supabase.from("courses").select("*, subjects(name)").eq("id", courseId).maybeSingle(),
        supabase.from("course_modules").select("*").eq("course_id", courseId),
        supabase.from("lessons").select("*").eq("course_id", courseId),
        supabase.from("lesson_progress").select("lesson_id,completed,last_position_seconds,updated_at").eq("course_id", courseId),
      ]);
      const lessons = (l ?? []) as Lesson[];
      const modules = sortByPos((m ?? []) as Module[]).map((mod) => ({ ...mod, lessons: sortByPos(lessons.filter((x) => x.module_id === mod.id)) }));
      const progress = new Map((p ?? []).map((x) => [x.lesson_id, x]));
      const ordered = modules.flatMap((x) => x.lessons);
      return { course: c as Course | null, modules, ordered, progress };
    },
  });
}

