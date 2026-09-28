import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestUser, adminClient, PLAN_PRICES_KOBO } from "@/lib/server-auth.server";

export const Route = createFileRoute("/api/paystack/init")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        const parsed = z.object({ plan: z.enum(["pro", "premium"]) }).safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return Response.json({ error: "Invalid plan" }, { status: 400 });
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return Response.json({ error: "Payments are not configured yet." }, { status: 503 });
        const plan = parsed.data.plan;
        const amount = PLAN_PRICES_KOBO[plan];
        const reference = `studyai_${plan}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
        const origin = new URL(request.url).origin;
        const res = await fetch("https://api.paystack.co/transaction/initialize", {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            email: auth.user.email, amount, currency: "NGN", reference,
            callback_url: `${origin}/billing/callback`, metadata: { user_id: auth.user.id, plan },
          }),
        });
        const body = (await res.json()) as any;
        if (!res.ok || !body?.status) {
          console.error("Paystack init failed", body);
          return Response.json({ error: "Could not start payment. Please try again." }, { status: 502 });
        }
        await adminClient().from("payments").insert({ user_id: auth.user.id, reference, plan, amount_kobo: amount });
        return Response.json({ url: body.data.authorization_url });
      },
    },
  },
});
