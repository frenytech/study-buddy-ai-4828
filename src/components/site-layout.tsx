import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./brand";
import { useAuth } from "@/lib/auth";

const nav = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/jamb", label: "JAMB CBT" },
  { to: "/waec", label: "WAEC CBT" },
  { to: "/ai-tutor", label: "AI Tutor" },
  { to: "/pricing", label: "Pricing" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className="text-sm font-medium text-muted-foreground hover:text-foreground"
              activeProps={{ className: "text-foreground" }} activeOptions={{ exact: true }}>{n.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button asChild><Link to="/dashboard">Dashboard</Link></Button>
          ) : (
            <>
              <Button variant="ghost" asChild><Link to="/auth">Login</Link></Button>
              <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Get Started</Link></Button>
            </>
          )}
        </div>
        <button className="md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="border-t border-border bg-background px-4 py-3 md:hidden">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block py-2 text-sm font-medium">{n.label}</Link>
          ))}
          <div className="mt-2 flex gap-2">
            {user ? <Button className="flex-1" asChild><Link to="/dashboard">Dashboard</Link></Button> : (
              <>
                <Button variant="outline" className="flex-1" asChild><Link to="/auth">Login</Link></Button>
                <Button className="flex-1" asChild><Link to="/auth" search={{ mode: "signup" }}>Get Started</Link></Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3 text-sm text-muted-foreground">Your Smart Learning Partner.</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold">Explore</p>
          <div className="grid grid-cols-2 gap-1 text-muted-foreground">
            {nav.map((n) => <Link key={n.to} to={n.to} className="hover:text-foreground">{n.label}</Link>)}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="mb-2 font-semibold text-foreground">About</p>
          <p>StudyAI helps students prepare for JAMB and WAEC with AI-powered learning and realistic CBT practice.</p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} StudyAI · Powered by FrenyTech ·{" "}
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link> ·{" "}
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
      </div>
    </footer>
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
