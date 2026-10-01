import { BookOpen, Bot, ListChecks, Layers, TrendingUp, Lightbulb, GraduationCap } from "lucide-react";

const planets = [
  { label: "Courses", icon: BookOpen },
  { label: "AI", icon: Bot },
  { label: "Quizzes", icon: ListChecks },
  { label: "Flashcards", icon: Layers },
  { label: "Progress", icon: TrendingUp },
  { label: "Knowledge", icon: Lightbulb },
];

export function LearningUniverse() {
  return (
    <div className="universe" role="img" aria-label="StudyAI learning universe: courses, AI, quizzes, flashcards, progress and knowledge orbiting a central learning core">
      <div className="universe-tilt">
        <div className="universe-ring universe-ring-1" />
        <div className="universe-ring universe-ring-2" />
        <div className="universe-orbit">
          {planets.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={p.label} className="universe-arm" style={{ transform: `rotate(${(360 / planets.length) * i}deg)` }}>
                <div className="universe-planet" style={{ transform: `rotate(${-(360 / planets.length) * i}deg)` }}>
                  <div className="universe-planet-inner">
                    <Icon className="h-5 w-5 text-primary" aria-hidden />
                    <span className="text-[10px] font-semibold">{p.label}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="universe-core">
        <GraduationCap className="h-10 w-10" aria-hidden />
      </div>
    </div>
  );
}
