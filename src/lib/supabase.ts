import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL =
  (import.meta.env["VITE_SUPABASE_URL"] as string) || "https://ruvuuafauqtqqpfjmrme.supabase.co";
export const SUPABASE_ANON_KEY = (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string) || "missing-anon-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: typeof window !== "undefined",
    autoRefreshToken: typeof window !== "undefined",
    detectSessionInUrl: typeof window !== "undefined",
  },
});

export async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export const PLANS = {
  free: { name: "Free", price: 0, perks: ["10 AI Tutor messages/day", "JAMB & WAEC CBT practice", "Study planner", "Basic progress"] },
  pro: { name: "Pro", price: 500, perks: ["100 AI Tutor messages/day", "AI explanations & tutor actions", "Quizzes & flashcards", "Unlimited CBT & study tools", "Additional learning resources"] },
  premium: { name: "Premium", price: 700, perks: ["500 AI Tutor messages/day", "Everything in Pro", "ElevenLabs Voice Tutor", "Video learning recommendations", "Personalized learning support"] },
} as const;
export type PlanId = keyof typeof PLANS;
