import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/site-layout";
import { PricingCards } from "@/components/marketing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — StudyAI" },
      { name: "description", content: "Free, Pro (₦1,000/month) and Premium (₦1,200/month) plans." },
      { property: "og:title", content: "Pricing — StudyAI" },
      { property: "og:description", content: "Affordable plans for every student. Pay securely with Paystack." },
    ],
  }),
  component: () => (
    <PublicPage>
      <section className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-4xl font-bold">Pricing</h1>
        <p className="mt-2 text-muted-foreground">Pay monthly with card, bank transfer or USSD via Paystack.</p>
        <div className="mt-10"><PricingCards /></div>
      </section>
    </PublicPage>
  ),
});
