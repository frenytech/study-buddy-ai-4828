import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — StudyAI" }, { name: "description", content: "Manage your StudyAI account, level, department and preferences." }] }),
  component: Profile,
});

const LIMITS: Record<string, number> = { free: 10, pro: 100, premium: 500 };

function Profile() {
  const { user, plan } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [p, l, u, s] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("academic_levels").select("label").order("position"),
        supabase.from("ai_usage").select("count").eq("user_id", user!.id).eq("day", today).maybeSingle(),
        supabase.from("subscriptions").select("plan,current_period_end,status").eq("user_id", user!.id).maybeSingle(),
      ]);
      return { profile: p.data, levels: (l.data ?? []).map((x) => x.label), used: u.data?.count ?? 0, sub: s.data };
    },
  });
  const [f, setF] = useState({ full_name: "", academic_level: "", department: "", exam_target: "", reminders: true });
  const [pw, setPw] = useState("");
  useEffect(() => {
    const p = data?.profile;
    if (p) setF({ full_name: p.full_name ?? "", academic_level: p.academic_level ?? "", department: p.department ?? "", exam_target: p.exam_target ?? "", reminders: p.preferences?.reminders ?? true });
  }, [data?.profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name, academic_level: f.academic_level, department: f.department, exam_target: f.exam_target,
      preferences: { ...(data?.profile?.preferences ?? {}), reminders: f.reminders },
    }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  async function avatar(file: File) {
    if (file.size > 2 * 1024 * 1024) return toast.error("Please choose an image under 2 MB.");
    const path = `${user!.id}/avatar-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", user!.id);
    qc.invalidateQueries({ queryKey: ["profile"] });
  }
  async function changePw() {
    if (pw.length < 8) return toast.error("Use at least 8 characters.");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error(error.message);
    setPw(""); toast.success("Password updated");
  }
  async function logout() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  const limit = LIMITS[plan] ?? 10;
  const initials = (f.full_name || user?.email || "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <h1 className="font-display text-3xl font-bold">My profile</h1>
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        {data?.profile?.avatar_url
          ? <img src={data.profile.avatar_url} alt="Your avatar" className="h-16 w-16 rounded-full object-cover" />
          : <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-lg font-bold text-primary-foreground">{initials}</div>}
        <div className="flex-1">
          <p className="font-semibold">{f.full_name || "Student"}</p>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
          <Upload className="h-4 w-4" />Change photo
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && avatar(e.target.files[0])} />
        </label>
      </div>

      <form onSubmit={save} className="grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
        <div><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
        <div><Label>Academic level</Label>
          <select value={f.academic_level} onChange={(e) => setF({ ...f, academic_level: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Choose…</option>{(data?.levels ?? []).map((l) => <option key={l}>{l}</option>)}
          </select></div>
        <div><Label>Department / course of study</Label><Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} /></div>
        <div><Label>Exam target</Label>
          <select value={f.exam_target} onChange={(e) => setF({ ...f, exam_target: e.target.value })} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Not set</option><option value="jamb">JAMB</option><option value="waec">WAEC</option><option value="both">Both</option>
          </select></div>
        <div className="flex items-center justify-between rounded-md border border-border px-3"><Label>Study reminders</Label><Switch checked={f.reminders} onCheckedChange={(v) => setF({ ...f, reminders: v })} /></div>
        <div className="md:col-span-2"><Button>Save changes</Button></div>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Subscription</p>
          <p className="mt-1 text-xl font-bold capitalize">{plan} <Badge variant="outline" className="ml-1">{data?.sub?.status ?? "free"}</Badge></p>
          {data?.sub?.current_period_end && <p className="text-sm text-muted-foreground">Renews/ends {new Date(data.sub.current_period_end).toLocaleDateString()}</p>}
          <Button variant="outline" className="mt-3" asChild><Link to="/billing">Manage plan</Link></Button>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">AI usage today</p>
          <p className="mt-1 text-xl font-bold">{data?.used ?? 0} / {limit}</p>
          <div className="mt-3 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, ((data?.used ?? 0) / limit) * 100)}%` }} /></div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-semibold">Account settings</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Input type="password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} className="max-w-xs" />
          <Button variant="outline" onClick={changePw}>Update password</Button>
        </div>
        <Button variant="destructive" className="mt-5" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
      </div>
    </div>
  );
}
