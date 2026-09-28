import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — StudyAI" },
      { name: "description", content: "Choose a new password for your StudyAI account." },
      { property: "og:title", content: "Set a new password — StudyAI" },
      { property: "og:description", content: "Reset your StudyAI password." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    navigate({ to: "/dashboard" });
  }
  return (
    <div className="grid min-h-screen place-items-center bg-hero px-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-card p-8 shadow-soft">
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <div><Label htmlFor="pw">New password</Label><Input id="pw" type="password" minLength={8} required value={pw} onChange={(e) => setPw(e.target.value)} /></div>
        <Button className="w-full">Update password</Button>
      </form>
    </div>
  );
}
