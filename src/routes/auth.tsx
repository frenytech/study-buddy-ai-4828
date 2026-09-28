import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["login", "signup", "forgot"]).optional() }),
  head: () => ({
    meta: [
      { title: "Sign in — StudyAI" },
      { name: "description", content: "Sign in or create your free StudyAI account." },
      { property: "og:title", content: "Sign in — StudyAI" },
      { property: "og:description", content: "Create your free StudyAI account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const [mode, setMode] = useState(initial ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else toast.success("Check your email to confirm your account.");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        toast.success("Password reset link sent. Check your email.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/dashboard` } });
    if (error) toast.error(error.message);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-hero px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">{mode === "signup" ? "Create your account" : mode === "login" ? "Welcome back" : "Reset your password"}</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div><Label htmlFor="name">Full name</Label><Input id="name" required value={name} onChange={(e) => setName(e.target.value)} /></div>
          )}
          <div><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {mode !== "forgot" && (
            <div><Label htmlFor="pw">Password</Label><Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          )}
          <Button className="w-full" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "login" ? "Log in" : "Send reset link"}</Button>
        </form>
        {mode !== "forgot" && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
            <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
          </>
        )}
        <div className="mt-6 space-y-1 text-center text-sm text-muted-foreground">
          {mode === "login" && <>
            <p>New here? <button className="font-medium text-primary" onClick={() => setMode("signup")}>Create an account</button></p>
            <p><button className="text-primary" onClick={() => setMode("forgot")}>Forgot password?</button></p>
          </>}
          {mode !== "login" && <p>Have an account? <button className="font-medium text-primary" onClick={() => setMode("login")}>Log in</button></p>}
        </div>
      </div>
    </div>
  );
}
