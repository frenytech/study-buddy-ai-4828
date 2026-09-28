import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase, authHeader } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { chunkText, extractPdfText } from "@/lib/pdf-extract";

export const Route = createFileRoute("/_authenticated/materials/")({
  head: () => ({ meta: [{ title: "My Materials — StudyAI" }, { name: "description", content: "Upload PDFs and turn them into summaries, flashcards and quizzes." }] }),
  component: Materials,
});

export async function generateStudySet(materialId: string) {
  const res = await fetch("/api/materials/generate", {
    method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ materialId }),
  });
  const b = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(b.error ?? "Couldn't generate study material");
}

function Materials() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => (await supabase.from("materials").select("id,title,status,page_count,created_at").order("created_at", { ascending: false })).data ?? [],
  });

  async function upload(file: File) {
    if (!user) return;
    if (file.type !== "application/pdf") { toast.error("Please choose a PDF file"); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("PDFs must be under 20MB"); return; }
    try {
      setStep("Reading your PDF…");
      const { pages, text } = await extractPdfText(file);
      if (text.length < 200) throw new Error("We couldn't find readable text. Scanned image PDFs aren't supported yet.");
      setStep("Uploading…");
      const path = `${user.id}/${crypto.randomUUID()}.pdf`;
      const { error: upErr } = await supabase.storage.from("materials").upload(path, file, { contentType: "application/pdf" });
      if (upErr) throw upErr;
      const title = file.name.replace(/\.pdf$/i, "");
      const { data: m, error } = await supabase.from("materials")
        .insert({ user_id: user.id, title, file_path: path, page_count: pages, char_count: text.length }).select("id").single();
      if (error) throw error;
      const chunks = chunkText(text);
      for (let i = 0; i < chunks.length; i += 100) {
        const { error: cErr } = await supabase.from("material_chunks")
          .insert(chunks.slice(i, i + 100).map((content, j) => ({ material_id: m.id, user_id: user.id, idx: i + j, content })));
        if (cErr) throw cErr;
      }
      setStep("Creating summary, flashcards and quiz…");
      await generateStudySet(m.id);
      qc.invalidateQueries({ queryKey: ["materials"] });
      navigate({ to: "/materials/$materialId", params: { materialId: m.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
      qc.invalidateQueries({ queryKey: ["materials"] });
    } finally {
      setStep(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(m: any) {
    if (!confirm(`Delete "${m.title}"?`)) return;
    const { data: row } = await supabase.from("materials").select("file_path").eq("id", m.id).single();
    if (row) await supabase.storage.from("materials").remove([row.file_path]);
    await supabase.from("materials").delete().eq("id", m.id);
    qc.invalidateQueries({ queryKey: ["materials"] });
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-3xl font-bold">My Materials</h1>
      <p className="text-muted-foreground">Upload class notes or textbooks as PDFs. StudyAI turns them into revision notes, flashcards and a quiz.</p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !step) void upload(f); }}
        className="mt-6 grid place-items-center rounded-3xl border-2 border-dashed border-border bg-card p-10 text-center"
      >
        {step ? (
          <><Loader2 className="h-10 w-10 animate-spin text-primary" /><p className="mt-3 font-medium">{step}</p><p className="text-sm text-muted-foreground">This can take up to a minute.</p></>
        ) : (
          <>
            <Upload className="h-10 w-10 text-primary" />
            <p className="mt-3 font-medium">Drag a PDF here, or</p>
            <Button className="mt-3" onClick={() => input.current?.click()}>Choose PDF</Button>
            <p className="mt-2 text-xs text-muted-foreground">Up to 20MB · text-based PDFs</p>
          </>
        )}
        <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
      </div>

      <div className="mt-8 space-y-2">
        {(data ?? []).length === 0 && <p className="text-sm text-muted-foreground">No materials yet.</p>}
        {(data ?? []).map((m: any) => (
          <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
            <FileText className="h-8 w-8 shrink-0 rounded-lg bg-secondary p-1.5 text-primary" />
            <Link to="/materials/$materialId" params={{ materialId: m.id }} className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.title}</p>
              <p className="text-xs text-muted-foreground">{m.page_count ?? "?"} pages · {new Date(m.created_at).toLocaleDateString()}</p>
            </Link>
            <Badge variant={m.status === "ready" ? "default" : m.status === "failed" ? "destructive" : "secondary"}>{m.status}</Badge>
            <button aria-label="Delete" onClick={() => remove(m)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
