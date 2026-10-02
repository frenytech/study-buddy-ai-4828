import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/site-layout";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — StudyAI" },
      { name: "description", content: "How StudyAI collects, uses and protects your personal information." },
      { property: "og:title", content: "Privacy Policy — StudyAI" },
      { property: "og:description", content: "How StudyAI collects, uses and protects your data." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <PublicPage>
      <article className="mx-auto max-w-3xl space-y-5 px-4 py-12 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p>Last updated: October 2026</p>
        <p>StudyAI ("we", "us"), built by FrenyTech, helps students prepare for JAMB and WAEC. This policy explains what information we collect and how we use it.</p>
        <h2 className="text-lg font-semibold text-foreground">Information we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Account details: your name, email address and profile photo (including from Google sign-in).</li>
          <li>Study details: academic level, department, exam target, test results, study plans and uploaded materials.</li>
          <li>Payment records: plan and transaction reference. Card details are handled by Paystack and never stored by us.</li>
          <li>Messages you send to the AI Tutor.</li>
        </ul>
        <h2 className="text-lg font-semibold text-foreground">How we use it</h2>
        <p>To run your account, show your progress, generate AI study help, process subscriptions and keep the service secure. We do not sell your personal information.</p>
        <h2 className="text-lg font-semibold text-foreground">Google sign-in</h2>
        <p>If you sign in with Google we only receive your name, email address and profile picture. We use them solely to create and identify your StudyAI account.</p>
        <h2 className="text-lg font-semibold text-foreground">Service providers</h2>
        <p>We use Supabase (account and data storage), OpenRouter (AI responses) and Paystack (payments). They process data only to provide these services.</p>
        <h2 className="text-lg font-semibold text-foreground">Your choices</h2>
        <p>You can update your profile at any time. To delete your account and data, contact us and we will remove it.</p>
        <h2 className="text-lg font-semibold text-foreground">Contact</h2>
        <p>Questions about this policy? Contact the StudyAI team via the support email shown on our sign-in screen.</p>
      </article>
    </PublicPage>
  );
}
