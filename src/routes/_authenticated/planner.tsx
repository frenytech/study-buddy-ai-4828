import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/planner")({
  head: () => ({ meta: [{ title: "Study Planner — StudyAI" }, { name: "description", content: "Plan your study schedule." }] }),
  component: Planner,
});

function Planner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const { data } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("study_tasks").select("*").order("done").order("due_date", { nullsFirst: false })).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks"] });
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;
    await supabase.from("study_tasks").insert({ user_id: user.id, title: title.trim(), due_date: due || null });
    setTitle(""); setDue(""); refresh();
  }
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">Study Planner</h1>
      <form onSubmit={add} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="e.g. Revise Organic Chemistry" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-44" />
        <Button>Add</Button>
      </form>
      <ul className="mt-6 space-y-2">
        {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No tasks yet. Add your first study goal above.</p>}
        {(data ?? []).map((t: any) => (
          <li key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
            <Checkbox checked={t.done} onCheckedChange={async (v) => { await supabase.from("study_tasks").update({ done: !!v }).eq("id", t.id); refresh(); }} />
            <div className="flex-1">
              <p className={t.done ? "text-muted-foreground line-through" : ""}>{t.title}</p>
              {t.due_date && <p className="text-xs text-muted-foreground">Due {new Date(t.due_date).toLocaleDateString()}</p>}
            </div>
            <button aria-label="Delete" onClick={async () => { await supabase.from("study_tasks").delete().eq("id", t.id); refresh(); }}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
