import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authHeader } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/billing/callback")({
  validateSearch: z.object({ reference: z.string().optional(), trxref: z.string().optional() }),
  head: () => ({ meta: [{ title: "Payment — StudyAI" }, { name: "robots", content: "noindex" }] }),
  component: Callback,
});

function Callback() {
  const { reference, trxref } = Route.useSearch();
  const ref = reference ?? trxref;
  const { refresh } = useAuth();
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");
  const [plan, setPlan] = useState("");
  useEffect(() => {
    if (!ref) { setState("fail"); return; }
    (async () => {
      const res = await fetch("/api/paystack/verify", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ reference: ref }) });
      const b = await res.json().catch(() => ({}));
      if (b.ok) { setPlan(b.plan); setState("ok"); await refresh(); } else setState("fail");
    })();
  }, [ref]);
  return (
    <div className="mx-auto mt-20 max-w-md p-4 text-center">
      {state === "loading" && <><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /><p className="mt-4">Confirming your payment…</p></>}
      {state === "ok" && <><CheckCircle2 className="mx-auto h-12 w-12 text-success" /><h1 className="mt-4 text-2xl font-bold">You're on <span className="capitalize">{plan}</span>!</h1><Button className="mt-6" asChild><Link to="/dashboard">Go to dashboard</Link></Button></>}
      {state === "fail" && <><XCircle className="mx-auto h-12 w-12 text-destructive" /><h1 className="mt-4 text-2xl font-bold">Payment not confirmed</h1><p className="mt-2 text-muted-foreground">If you were charged, it will be applied automatically within a few minutes.</p><Button className="mt-6" variant="outline" asChild><Link to="/billing">Back to plans</Link></Button></>}
    </div>
  );
}
