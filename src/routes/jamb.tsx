import { createFileRoute } from "@tanstack/react-router";
import { ExamLanding } from "@/components/exam-page";

export const Route = createFileRoute("/jamb")({
  head: () => ({
    meta: [
      { title: "JAMB CBT Practice — StudyAI" },
      { name: "description", content: "Timed JAMB UTME computer-based test practice with instant scoring and explanations." },
      { property: "og:title", content: "JAMB CBT Practice — StudyAI" },
      { property: "og:description", content: "Practise JAMB UTME exactly how you'll sit it." },
    ],
  }),
  component: () => <ExamLanding exam="jamb" title="JAMB CBT Practice" blurb="Sit timed JAMB-style tests, get instant scores, and review every answer with explanations." />,
});
