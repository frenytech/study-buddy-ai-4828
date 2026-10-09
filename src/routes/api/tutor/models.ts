import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth.server";
import { listTextModels, FALLBACK_MODEL } from "@/lib/omegatech.server";

export const Route = createFileRoute("/api/tutor/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        const [models, { data: setting }] = await Promise.all([
          listTextModels(),
          auth.supabase.from("app_settings").select("value").eq("key", "default_tutor_model").maybeSingle(),
        ]);
        const configured = setting?.value as string | undefined;
        const def = configured && models.includes(configured) ? configured : models.includes(FALLBACK_MODEL) ? FALLBACK_MODEL : models[0] ?? FALLBACK_MODEL;
        return Response.json({ models, default: def }, { headers: { "Cache-Control": "private, max-age=300" } });
      },
    },
  },
});
