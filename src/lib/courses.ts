export type Resource = { label: string; url: string };
export type Lesson = {
  id: string; course_id: string; module_id: string; title: string; video_url: string | null; notes: string | null;
  takeaways: string[]; resources: Resource[]; duration_minutes: number | null; position: number;
};
export type Module = { id: string; course_id: string; title: string; position: number; lessons?: Lesson[] };
export type Course = {
  id: string; exam: "jamb" | "waec"; subject_id: string; title: string; description: string | null; syllabus: string | null;
  cover_url: string | null; status: "draft" | "published"; subjects?: { name: string } | null;
};

export type VideoSource =
  | { kind: "youtube"; id: string }
  | { kind: "vimeo"; id: string }
  | { kind: "file"; url: string }
  | { kind: "none" };

export function parseVideo(url: string | null | undefined): VideoSource {
  if (!url?.trim()) return { kind: "none" };
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return { kind: "youtube", id: u.pathname.slice(1).split("/")[0]! };
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return { kind: "youtube", id: v };
      const m = u.pathname.match(/\/(embed|shorts|live)\/([^/?]+)/);
      if (m) return { kind: "youtube", id: m[2]! };
    }
    if (host.endsWith("vimeo.com")) {
      const m = u.pathname.match(/(\d+)/);
      if (m) return { kind: "vimeo", id: m[1]! };
    }
    if (u.protocol === "https:" || u.protocol === "http:") return { kind: "file", url: u.toString() };
  } catch { /* fallthrough */ }
  return { kind: "none" };
}

export const sortByPos = <T extends { position: number }>(a: T[] = []) => [...a].sort((x, y) => x.position - y.position);
