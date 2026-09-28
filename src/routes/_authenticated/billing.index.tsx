import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PricingCards } from "@/components/marketing";
import { authHeader, type PlanId } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/billing/")({
  head: () => ({ meta: [{ title: "Your plan — StudyAI" }, { name: "description", content: "Manage your StudyAI subscription." }] }),
  component: Billing,
});

function Billing() {
  const { plan } = useAuth();
  const [busy, setBusy] = useState(false);
  async function choose(p: PlanId) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/paystack/init", {
        method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ plan: p }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not start payment");
      window.location.href = body.url;
    } catch (e: any) {
      toast.error(e.message);
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">Your plan</h1>
      <p className="text-muted-foreground">You're on <span className="font-semibold capitalize text-foreground">{plan}</span>. Plans last 30 days; pay securely with Paystack.</p>
      <div className="mt-8"><PricingCards onSelect={choose} current={plan} /></div>
    </div>
  );
}
