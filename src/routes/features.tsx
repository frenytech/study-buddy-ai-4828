import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/site-layout";
import { FeatureGrid } from "@/components/marketing";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — StudyAI" },
      { name: "description", content: "AI Tutor, summaries, flashcards, quizzes, JAMB and WAEC CBT, study planner and progress tracking." },
      { property: "og:title", content: "Features — StudyAI" },
      { property: "og:description", content: "Every tool you need to prepare for JAMB and WAEC." },
    ],
  }),
  component: () => (
    <PublicPage>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-4xl font-bold">Features</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Tools designed around how Nigerian students actually prepare for exams.</p>
        <div className="mt-10"><FeatureGrid /></div>
      </section>
    </PublicPage>
  ),
});
