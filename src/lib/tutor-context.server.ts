import type { SupabaseClient } from "@supabase/supabase-js";

export const ACTIONS = {
  chat: "Answer naturally as a tutor and continue the conversation.",
  explain: "Give a clear, thorough explanation of the concept with key definitions and why it matters.",
  simple: "Explain it very simply, as if to a 12-year-old. Short sentences, everyday Nigerian examples, no jargon.",
  steps: "Break it into numbered steps. Show every step of working; explain the reason for each step.",
  example: "Give 2 worked examples (one easy, one exam-level), each fully solved and explained.",
  hint: "Do NOT give the full answer. Give one helpful hint that nudges the student toward the next step, then ask them to try.",
  practice: "Create 3 practice questions on this topic (increasing difficulty). Do not show the answers yet — tell the student to reply with their answers.",
  check: "The student is submitting an answer. Say clearly whether it is correct, point out any mistake precisely, show the correct working, and encourage them.",
  quiz: "Quiz the student: ask ONE multiple-choice question (A–D) at a time in JAMB/WAEC style. Wait for their reply before revealing the answer. After they answer, mark it, explain, then ask the next question.",
  flashcards: "Create 8 flashcards as a Markdown list in the form **Front:** … / **Back:** … covering the key facts of the topic.",
  summarize: "Summarize the topic (or the conversation so far) into concise bullet points with the key formulas/facts and a one-line takeaway.",
} as const;
export type TutorAction = keyof typeof ACTIONS;

const STOP = new Set("what which where when there their about would could should explain please tell with from that this have into your does give simply step example".split(" "));

function keywords(text: string) {
  return [...new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)))].slice(0, 5);
}

/** Builds real learning context from the student's own data (RLS applies). Returns text + sources actually used. */
export async function buildContext(supabase: SupabaseClient, userId: string, query: string, materialId?: string) {
  const sources: string[] = [];
  const parts: string[] = [];
  const words = keywords(query);
  const like = words.map((w) => `content.ilike.%${w}%`).join(",");

  const [{ data: prof }, { data: tests }] = await Promise.all([
    supabase.from("profiles").select("full_name,academic_level,department,exam_target").eq("id", userId).maybeSingle(),
    supabase.from("cbt_sessions").select("exam,score,total,subjects(name)").eq("user_id", userId).not("submitted_at", "is", null).order("submitted_at", { ascending: false }).limit(5),
  ]);
  if (prof) parts.push(`Student: ${prof.full_name ?? "student"}; level: ${prof.academic_level ?? "unknown"}; department: ${prof.department ?? "unknown"}; exam target: ${prof.exam_target ?? "JAMB/WAEC"}.`);
  if (tests?.length) {
    parts.push("Recent CBT results: " + tests.map((t: any) => `${t.exam.toUpperCase()} ${t.subjects?.name ?? ""} ${t.score}/${t.total}`).join("; ") + ". Focus extra help on weak subjects when relevant.");
  }

  let chunkQ = supabase.from("material_chunks").select("content,material_id,materials(title)").eq("user_id", userId).limit(4);
  if (materialId) chunkQ = chunkQ.eq("material_id", materialId);
  if (like) chunkQ = chunkQ.or(like);
  if (materialId || like) {
    const { data: chunks } = await chunkQ;
    if (chunks?.length) {
      for (const c of chunks as any[]) {
        const title = c.materials?.title ?? "Uploaded PDF";
        if (!sources.includes(`PDF: ${title}`)) sources.push(`PDF: ${title}`);
        parts.push(`[From the student's PDF "${title}"]\n${String(c.content).slice(0, 1500)}`);
      }
    }
  }

  if (words.length) {
    const { data: lessons } = await supabase.from("lessons").select("title,notes,courses!inner(title,status)")
      .or(words.map((w) => `title.ilike.%${w}%`).join(",")).limit(2);
    for (const l of (lessons ?? []) as any[]) {
      sources.push(`Lesson: ${l.courses?.title} — ${l.title}`);
      parts.push(`[From StudyAI lesson "${l.title}" in course "${l.courses?.title}"]\n${String(l.notes ?? "").slice(0, 1200)}`);
    }
  }
  return { text: parts.join("\n\n"), sources };
}

export async function isPremium(supabase: SupabaseClient, userId: string) {
  const [{ data: plan }, { data: admin }] = await Promise.all([
    supabase.rpc("current_plan", { _user_id: userId }),
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
  ]);
  return plan === "premium" || Boolean(admin);
}
