import { createFileRoute } from "@tanstack/react-router";
import { getRequestUser } from "@/lib/server-auth.server";
import { listTextModels, FREE_MODELS, FALLBACK_MODEL } from "@/lib/omegatech.server";

export const Route = createFileRoute("/api/tutor/models")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await getRequestUser(request);
        if (!auth) return Response.json({ error: "Please sign in first." }, { status: 401 });
        const models = listTextModels();
        const { data: setting } = await auth.supabase.from("app_settings").select("value").eq("key", "default_tutor_model").maybeSingle();
        const configured = setting?.value as string | undefined;
        const def = configured && FREE_MODELS.includes(configured)
          ? configured
          : FREE_MODELS.includes(FALLBACK_MODEL) ? FALLBACK_MODEL : FREE_MODELS[0] ?? FALLBACK_MODEL;
        return Response.json({ models, default: def }, { headers: { "Cache-Control": "private, max-age=300" } });
      },
    },
  },
});
