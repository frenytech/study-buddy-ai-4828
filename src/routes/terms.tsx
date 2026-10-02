import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/site-layout";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — StudyAI" },
      { name: "description", content: "The terms for using StudyAI, the JAMB and WAEC learning platform." },
      { property: "og:title", content: "Terms of Service — StudyAI" },
      { property: "og:description", content: "The terms for using StudyAI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <PublicPage>
      <article className="mx-auto max-w-3xl space-y-5 px-4 py-12 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-3xl font-bold text-foreground">Terms of Service</h1>
        <p>Last updated: October 2026</p>
        <p>By using StudyAI you agree to these terms. Use the service for personal study only and keep your account details safe.</p>
        <p>AI answers are study aids and may contain mistakes; always check important information. Practice questions are not official JAMB or WAEC papers.</p>
        <p>Paid plans (Pro and Premium) are billed through Paystack and give the features listed on the pricing page for the paid period.</p>
        <p>We may suspend accounts that misuse the service. These terms may be updated; continued use means you accept the changes.</p>
      </article>
    </PublicPage>
  );
}
