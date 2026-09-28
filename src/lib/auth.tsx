import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, type PlanId } from "./supabase";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  plan: PlanId;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthState>({
  session: null, user: null, loading: true, isAdmin: false, plan: "free", refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState<PlanId>("free");

  async function loadExtras(s: Session | null) {
    if (!s) { setIsAdmin(false); setPlan("free"); return; }
    const [{ data: admin }, { data: p }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: s.user.id, _role: "admin" }),
      supabase.rpc("current_plan", { _user_id: s.user.id }),
    ]);
    setIsAdmin(Boolean(admin));
    setPlan(((p as PlanId) ?? "free"));
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadExtras(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void loadExtras(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, isAdmin, plan, refresh: () => loadExtras(session) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
