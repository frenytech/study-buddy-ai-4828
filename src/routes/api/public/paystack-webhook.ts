import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { activateFromPaystack } from "@/lib/server-auth.server";

export const Route = createFileRoute("/api/public/paystack-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYSTACK_SECRET_KEY"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const raw = await request.text();
        const sig = Buffer.from(request.headers.get("x-paystack-signature") ?? "");
        const exp = Buffer.from(createHmac("sha512", secret).update(raw).digest("hex"));
        if (sig.length !== exp.length || !timingSafeEqual(sig, exp)) return new Response("Bad signature", { status: 401 });
        const evt = JSON.parse(raw);
        if (evt?.event === "charge.success" && typeof evt?.data?.reference === "string") {
          await activateFromPaystack(evt.data.reference);
        }
        return new Response("ok");
      },
    },
  },
});
