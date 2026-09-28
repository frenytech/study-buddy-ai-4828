import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicPage } from "@/components/site-layout";

export const Route = createFileRoute("/ai-tutor")({
  head: () => ({
    meta: [
      { title: "AI Tutor — StudyAI" },
      { name: "description", content: "A patient AI tutor that explains any JAMB or WAEC topic step by step." },
      { property: "og:title", content: "AI Tutor — StudyAI" },
      { property: "og:description", content: "Ask anything, get clear step-by-step explanations." },
    ],
  }),
  component: () => (
    <PublicPage>
      <section className="bg-hero">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <Bot className="mx-auto h-14 w-14 rounded-2xl bg-primary p-3 text-primary-foreground" />
          <h1 className="mt-6 text-4xl font-bold md:text-5xl">Your personal AI Tutor</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">Stuck on a topic? Ask the StudyAI Tutor. It explains step by step, shows working for calculations, and remembers your conversations.</p>
          <Button size="lg" className="mt-8" asChild><Link to="/tutor">Chat with the Tutor</Link></Button>
        </div>
      </section>
    </PublicPage>
  ),
});
