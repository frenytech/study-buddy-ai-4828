import { createClient } from "@supabase/supabase-js";

const url = () => import.meta.env["VITE_SUPABASE_URL"] as string;
const anon = () => import.meta.env["VITE_SUPABASE_ANON_KEY"] as string;

/** Verifies the bearer token and returns a user-scoped client (RLS applies). */
export async function getRequestUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabase = createClient(url(), anon(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return { user: data.user, supabase };
}

/** Privileged client; server-only. */
export function adminClient() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(url(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const PLAN_PRICES_KOBO: Record<string, number> = { pro: 100000, premium: 120000 };

/** Activates a plan for 30 days after a verified Paystack payment. Idempotent per reference. */
export async function activateFromPaystack(reference: string) {
  const secret = process.env["PAYSTACK_SECRET_KEY"];
  if (!secret) throw new Error("PAYSTACK_SECRET_KEY is not configured");
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = (await res.json()) as any;
  const tx = body?.data;
  const db = adminClient();
  const { data: payment } = await db.from("payments").select("*").eq("reference", reference).maybeSingle();
  if (!payment) return { ok: false, reason: "Unknown payment" };
  if (payment.status === "success") return { ok: true, plan: payment.plan };
  if (!res.ok || tx?.status !== "success" || tx.amount < payment.amount_kobo || tx.currency !== "NGN") {
    await db.from("payments").update({ status: tx?.status ?? "failed" }).eq("reference", reference);
    return { ok: false, reason: "Payment not successful" };
  }
  await db.from("payments").update({ status: "success" }).eq("reference", reference);
  const end = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  await db.from("subscriptions").upsert({
    user_id: payment.user_id, plan: payment.plan, status: "active", current_period_end: end, updated_at: new Date().toISOString(),
  });
  return { ok: true, plan: payment.plan };
}
