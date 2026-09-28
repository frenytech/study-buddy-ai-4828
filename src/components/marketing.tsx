import { Link } from "@tanstack/react-router";
import { Bot, FileText, Layers, ListChecks, Timer, BookOpenCheck, CalendarDays, LineChart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/supabase";

export const FEATURES = [
  { icon: Bot, title: "AI Tutor", text: "Learn with an AI-powered personal tutor." },
  { icon: FileText, title: "Smart Summaries", text: "Turn study materials into useful revision notes." },
  { icon: Layers, title: "Flashcards", text: "Learn and revise using interactive flashcards." },
  { icon: ListChecks, title: "Quizzes", text: "Test your understanding." },
  { icon: Timer, title: "JAMB CBT", text: "Practice JAMB-style examinations using the platform's approved question bank." },
  { icon: BookOpenCheck, title: "WAEC CBT", text: "Practice WAEC questions and prepare for examinations." },
  { icon: CalendarDays, title: "Study Planner", text: "Organize your learning schedule." },
  { icon: LineChart, title: "Progress Tracking", text: "See exactly where you are improving and where you need more practice." },
];

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((f) => (
        <div key={f.title} className="rounded-2xl border border-border bg-card p-5 shadow-soft transition hover:-translate-y-0.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary"><f.icon className="h-5 w-5" /></span>
          <h3 className="mt-4 font-semibold">{f.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
        </div>
      ))}
    </div>
  );
}

export function PricingCards({ onSelect, current }: { onSelect?: (p: PlanId) => void; current?: PlanId }) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {(Object.keys(PLANS) as PlanId[]).map((id) => {
        const p = PLANS[id];
        const featured = id === "pro";
        return (
          <div key={id} className={`relative rounded-3xl border p-6 shadow-soft ${featured ? "border-primary bg-card ring-2 ring-primary/20" : "border-border bg-card"}`}>
            {featured && <span className="absolute -top-3 left-6 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">Most popular</span>}
            <h3 className="text-lg font-semibold">{p.name}</h3>
            <p className="mt-2 font-display text-4xl font-bold">₦{p.price.toLocaleString()}<span className="text-sm font-normal text-muted-foreground">{p.price ? " / month" : ""}</span></p>
            <ul className="mt-5 space-y-2 text-sm">
              {p.perks.map((perk) => <li key={perk} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{perk}</li>)}
            </ul>
            <div className="mt-6">
              {onSelect ? (
                current === id ? <Button className="w-full" variant="outline" disabled>Current plan</Button>
                  : id === "free" ? <Button className="w-full" variant="outline" disabled>Included</Button>
                  : <Button className="w-full" variant={featured ? "default" : "outline"} onClick={() => onSelect(id)}>Upgrade to {p.name}</Button>
              ) : (
                <Button className="w-full" variant={featured ? "default" : "outline"} asChild>
                  <Link to="/auth" search={{ mode: "signup" }}>{id === "free" ? "Start free" : `Choose ${p.name}`}</Link>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
