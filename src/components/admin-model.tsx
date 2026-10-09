import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase, authHeader } from "@/lib/supabase";

export function AdminModelSetting() {
  const qc = useQueryClient();
  const [pick, setPick] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["tutor-models"],
    queryFn: async () => {
      const r = await fetch("/api/tutor/models", { headers: await authHeader() });
      return r.ok ? ((await r.json()) as { models: string[]; default: string }) : { models: [] as string[], default: "" };
    },
  });
  async function save() {
    if (!pick) return;
    const { error } = await supabase.from("app_settings").upsert({ key: "default_tutor_model", value: pick, updated_at: new Date().toISOString() });
    if (error) { toast.error(error.message); return; }
    toast.success("Default AI Tutor model saved");
    qc.invalidateQueries({ queryKey: ["tutor-models"] });
  }
  return (
    <div className="mt-4 max-w-lg rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Default AI Tutor Model</h2>
      <p className="mt-1 text-sm text-muted-foreground">Students use this model unless they choose another. The list comes live from OmegaTech.</p>
      {isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading models…</p> : (data?.models.length ?? 0) === 0 ? (
        <p className="mt-4 text-sm text-destructive">Couldn't load the model list from OmegaTech right now.</p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <select value={pick || data!.default} onChange={(e) => setPick(e.target.value)} className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm">
            {data!.models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <Button onClick={save} disabled={!pick || pick === data!.default}>Save</Button>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Current default: {data?.default ?? "—"}</p>
    </div>
  );
}
