import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getRequestUser, activateFromPaystack } from "@/lib/server-auth.server";

export const Route = createFileRoute("/api/paystack/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        const parsed = z.object({ reference: z.string().min(5).max(100) }).safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) return Response.json({ error: "Invalid reference" }, { status: 400 });
        try {
          return Response.json(await activateFromPaystack(parsed.data.reference));
        } catch (e) {
          console.error(e);
          return Response.json({ ok: false, reason: "Verification failed" }, { status: 500 });
        }
      },
    },
  },
});
