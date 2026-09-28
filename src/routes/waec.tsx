import { createFileRoute } from "@tanstack/react-router";
import { ExamLanding } from "@/components/exam-page";

export const Route = createFileRoute("/waec")({
  head: () => ({
    meta: [
      { title: "WAEC CBT Practice — StudyAI" },
      { name: "description", content: "WAEC SSCE objective question practice with timed tests and explanations." },
      { property: "og:title", content: "WAEC CBT Practice — StudyAI" },
      { property: "og:description", content: "Prepare for WAEC SSCE with realistic objective practice." },
    ],
  }),
  component: () => <ExamLanding exam="waec" title="WAEC CBT Practice" blurb="Practise WAEC objective questions subject by subject and track your improvement over time." />,
});
