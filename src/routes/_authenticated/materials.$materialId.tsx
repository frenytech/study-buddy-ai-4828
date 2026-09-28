import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Loader2, Check, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { generateStudySet } from "./materials.index";

export const Route = createFileRoute("/_authenticated/materials/$materialId")({
  head: () => ({ meta: [{ title: "Study set — StudyAI" }, { name: "robots", content: "noindex" }] }),
  component: MaterialPage,
});

function MaterialPage() {
  const { materialId } = Route.useParams();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["material", materialId],
    queryFn: async () => {
      const [{ data: m }, { data: cards }, { data: quiz }] = await Promise.all([
        supabase.from("materials").select("*").eq("id", materialId).single(),
        supabase.from("flashcards").select("*").eq("material_id", materialId).order("created_at"),
        supabase.from("quizzes").select("*").eq("material_id", materialId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return { m: m as any, cards: (cards ?? []) as any[], quiz: quiz as any };
    },
  });

  async function regenerate() {
    setBusy(true);
    try { await generateStudySet(materialId); toast.success("Study set refreshed"); }
    catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); qc.invalidateQueries({ queryKey: ["material", materialId] }); }
  }
  async function openPdf() {
    const { data: s } = await supabase.storage.from("materials").createSignedUrl(data!.m.file_path, 600);
    if (s?.signedUrl) window.open(s.signedUrl, "_blank", "noopener");
  }

  if (isLoading || !data) return <p className="p-8 text-muted-foreground">Loading…</p>;
  if (!data.m) return <p className="p-8">Material not found.</p>;
  const { m, cards, quiz } = data;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <Link to="/materials" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All materials</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">{m.title}</h1>
          <p className="text-sm text-muted-foreground">{m.page_count} pages</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openPdf}><ExternalLink className="h-4 w-4" />Open PDF</Button>
          <Button variant="outline" size="sm" onClick={regenerate} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}Regenerate</Button>
        </div>
      </div>

      {m.status !== "ready" ? (
        <div className="mt-8 rounded-2xl border border-border bg-card p-8 text-center">
          {m.status === "processing" || busy ? <><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /><p className="mt-3">Creating your study set…</p></>
            : <><p className="font-medium">{m.status === "failed" ? m.error ?? "Generation failed." : "Your study set hasn't been created yet."}</p>
              <Button className="mt-4" onClick={regenerate} disabled={busy}>Create study set</Button></>}
        </div>
      ) : (
        <Tabs defaultValue="summary" className="mt-6">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="cards">Flashcards ({cards.length})</TabsTrigger>
            <TabsTrigger value="quiz">Quiz ({quiz?.questions?.length ?? 0})</TabsTrigger>
          </TabsList>
          <TabsContent value="summary"><Summary text={m.summary ?? ""} /></TabsContent>
          <TabsContent value="cards"><Flashcards cards={cards} /></TabsContent>
          <TabsContent value="quiz">{quiz ? <Quiz quiz={quiz} /> : <p className="mt-4 text-muted-foreground">No quiz yet.</p>}</TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// Minimal, safe Markdown rendering: headings, bullets, bold.
function Summary({ text }: { text: string }) {
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p);
  return (
    <article className="mt-4 space-y-2 rounded-2xl border border-border bg-card p-5 leading-relaxed shadow-soft md:p-8">
      {text.split("\n").map((line, i) => {
        const l = line.trim();
        if (!l) return null;
        if (l.startsWith("### ")) return <h4 key={i} className="pt-2 font-semibold">{bold(l.slice(4))}</h4>;
        if (l.startsWith("## ")) return <h3 key={i} className="pt-4 text-lg font-bold text-primary">{bold(l.slice(3))}</h3>;
        if (l.startsWith("# ")) return <h2 key={i} className="text-xl font-bold">{bold(l.slice(2))}</h2>;
        if (/^[-*•]\s/.test(l)) return <p key={i} className="flex gap-2 pl-2"><span className="text-primary">•</span><span>{bold(l.slice(2))}</span></p>;
        if (/^\d+\.\s/.test(l)) return <p key={i} className="pl-2">{bold(l)}</p>;
        return <p key={i}>{bold(l)}</p>;
      })}
    </article>
  );
}

function Flashcards({ cards }: { cards: any[] }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Record<string, boolean>>(() => Object.fromEntries(cards.map((c) => [c.id, c.known])));
  if (!cards.length) return <p className="mt-4 text-muted-foreground">No flashcards yet.</p>;
  const c = cards[i]!;
  const go = (d: number) => { setFlipped(false); setI((i + d + cards.length) % cards.length); };
  async function mark(v: boolean) {
    setKnown({ ...known, [c.id]: v });
    await supabase.from("flashcards").update({ known: v }).eq("id", c.id);
    go(1);
  }
  const knownCount = Object.values(known).filter(Boolean).length;
  return (
    <div className="mt-4">
      <div className="mb-3 flex justify-between text-sm text-muted-foreground"><span>Card {i + 1} of {cards.length}</span><span>{knownCount} known</span></div>
      <button onClick={() => setFlipped(!flipped)} className="w-full [perspective:1200px]" aria-label="Flip card">
        <div className={`relative h-72 w-full transition-transform duration-500 [transform-style:preserve-3d] ${flipped ? "[transform:rotateY(180deg)]" : ""}`}>
          <div className="absolute inset-0 grid place-items-center rounded-3xl border border-border bg-card p-8 text-center text-xl font-semibold shadow-soft [backface-visibility:hidden]">
            {c.front}<span className="absolute bottom-4 text-xs font-normal text-muted-foreground">Tap to reveal</span>
          </div>
          <div className="absolute inset-0 grid place-items-center rounded-3xl bg-primary p-8 text-center text-lg text-primary-foreground shadow-soft [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {c.back}
          </div>
        </div>
      </button>
      <div className="mt-5 flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" onClick={() => go(-1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mark(false)}><X className="h-4 w-4" />Still learning</Button>
          <Button onClick={() => mark(true)}><Check className="h-4 w-4" />I know this</Button>
        </div>
        <Button variant="outline" size="icon" onClick={() => go(1)} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function Quiz({ quiz }: { quiz: any }) {
  const qs = quiz.questions as { question: string; options: { key: string; text: string }[]; answer: string; explanation?: string }[];
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);
  const score = qs.filter((q, i) => answers[i] === q.answer).length;

  async function submit() {
    setDone(true);
    if (quiz.best_score == null || score > quiz.best_score) await supabase.from("quizzes").update({ best_score: score }).eq("id", quiz.id);
  }

  return (
    <div className="mt-4 space-y-4">
      {done && (
        <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-soft">
          <p className="font-display text-4xl font-bold text-primary">{score}/{qs.length}</p>
          <p className="text-sm text-muted-foreground">{quiz.best_score != null ? `Previous best: ${quiz.best_score}/${qs.length}` : "First attempt"}</p>
          <Button className="mt-3" variant="outline" onClick={() => { setAnswers({}); setDone(false); }}>Try again</Button>
        </div>
      )}
      {qs.map((q, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-5">
          <p className="font-medium">{i + 1}. {q.question}</p>
          <div className="mt-3 grid gap-2">
            {q.options.map((o) => {
              const sel = answers[i] === o.key;
              const cls = done
                ? o.key === q.answer ? "border-success bg-success/10 font-medium" : sel ? "border-destructive bg-destructive/10" : "border-border"
                : sel ? "border-primary bg-secondary font-medium" : "border-border hover:border-primary/50";
              return (
                <button key={o.key} disabled={done} onClick={() => setAnswers({ ...answers, [i]: o.key })} className={`rounded-xl border px-4 py-2.5 text-left text-sm ${cls}`}>
                  <span className="mr-2 font-semibold">{o.key}.</span>{o.text}
                </button>
              );
            })}
          </div>
          {done && q.explanation && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{q.explanation}</p>}
        </div>
      ))}
      {!done && <Button size="lg" className="w-full" onClick={submit} disabled={Object.keys(answers).length === 0}>Submit quiz</Button>}
    </div>
  );
}
