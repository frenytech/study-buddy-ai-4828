import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Timer, Bot, CalendarDays, CreditCard, Shield, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/brand";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: AppLayout,
});

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cbt", label: "CBT Practice", icon: Timer },
  { to: "/tutor", label: "AI Tutor", icon: Bot },
  { to: "/planner", label: "Planner", icon: CalendarDays },
  { to: "/billing", label: "Plan", icon: CreditCard },
] as const;

function AppLayout() {
  const { isAdmin, plan, user } = useAuth();
  const navigate = useNavigate();
  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }
  const all = isAdmin ? [...links, { to: "/admin", label: "Admin", icon: Shield } as const] : links;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar p-4 text-sidebar-foreground md:flex">
        <div className="[&_span]:text-sidebar-foreground"><Logo to="/dashboard" /></div>
        <nav className="mt-8 flex-1 space-y-1">
          {all.map((l) => (
            <Link key={l.to} to={l.to} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-primary font-semibold" }}>
              <l.icon className="h-4 w-4" />{l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border pt-4 text-xs">
          <p className="truncate">{user?.email}</p>
          <Badge className="mt-2 bg-sidebar-primary text-sidebar-primary-foreground capitalize">{plan}</Badge>
          <button onClick={logout} className="mt-4 flex items-center gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground"><LogOut className="h-4 w-4" />Log out</button>
          <p className="mt-4 text-sidebar-foreground/50">Powered by FrenyTech</p>
        </div>
      </aside>
      <header className="flex items-center justify-between border-b border-border px-4 py-3 md:hidden">
        <Logo to="/dashboard" />
        <button onClick={logout} aria-label="Log out"><LogOut className="h-5 w-5" /></button>
      </header>
      <main className="flex-1 pb-20 md:pb-0"><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border bg-card py-2 md:hidden">
        {all.map((l) => (
          <Link key={l.to} to={l.to} className="flex flex-col items-center gap-0.5 px-2 text-[11px] text-muted-foreground" activeProps={{ className: "text-primary" }}>
            <l.icon className="h-5 w-5" />{l.label.split(" ")[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
