import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Timer, ShieldCheck, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/components/site-layout";
import { FeatureGrid, PricingCards } from "@/components/marketing";
import { LearningUniverse } from "@/components/learning-universe";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyAI — Your Smart Learning Partner for JAMB & WAEC" },
      { name: "description", content: "AI tutor, JAMB and WAEC CBT practice, quizzes, flashcards and progress tracking in one platform." },
      { property: "og:title", content: "StudyAI — Your Smart Learning Partner" },
      { property: "og:description", content: "Study smarter with an AI tutor and realistic JAMB & WAEC CBT practice." },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <PublicPage>
      <section className="bg-hero">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Built for JAMB & WAEC candidates
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-6xl">
              Study Smarter. <span className="text-primary">Learn Faster.</span> Prepare Better.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              StudyAI combines AI-powered learning, personalized study tools, JAMB CBT preparation, WAEC practice, quizzes, flashcards, and progress tracking in one platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild><Link to="/auth" search={{ mode: "signup" }}>Start Learning <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
              <Button size="lg" variant="outline" asChild><Link to="/cbt">Practice CBT</Link></Button>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">JAMB · Mathematics</span>
                <span className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 font-mono text-primary"><Timer className="h-3.5 w-3.5" /> 28:41</span>
              </div>
              <p className="mt-5 font-medium">Question 7 of 40</p>
              <p className="mt-2 text-muted-foreground">Solve for x: 2x + 5 = 17</p>
              <div className="mt-4 grid gap-2">
                {["5", "6", "7", "8"].map((o, i) => (
                  <div key={o} className={`rounded-xl border px-4 py-3 text-sm ${i === 1 ? "border-primary bg-secondary font-medium" : "border-border"}`}>
                    <span className="mr-3 font-semibold">{"ABCD"[i]}.</span>{o}
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-10 gap-1">
                {Array.from({ length: 20 }).map((_, i) => (
                  <span key={i} className={`h-6 rounded-md text-center text-[10px] leading-6 ${i < 6 ? "bg-primary text-primary-foreground" : i === 6 ? "bg-accent" : "bg-muted"}`}>{i + 1}</span>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-6 -left-4 hidden items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft sm:flex">
              <Bot className="h-8 w-8 rounded-lg bg-accent p-1.5 text-accent-foreground" />
              <p className="text-xs"><span className="font-semibold">AI Tutor:</span> Subtract 5 from both sides first…</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <h2 className="text-3xl font-bold">Your learning universe</h2>
          <p className="mt-3 text-muted-foreground">Courses, AI help, quizzes, flashcards and progress tracking all work together around one goal: helping you pass JAMB and WAEC.</p>
        </div>
        <LearningUniverse />
      </section>


      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-3xl font-bold">Everything you need to pass</h2>
        <p className="mt-2 text-muted-foreground">One platform for learning, practice and revision.</p>
        <div className="mt-8"><FeatureGrid /></div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20">
        <h2 className="text-3xl font-bold">Simple, affordable plans</h2>
        <p className="mt-2 text-muted-foreground">Start free. Upgrade when you need more.</p>
        <div className="mt-8"><PricingCards /></div>
      </section>
    </PublicPage>
  );
}
