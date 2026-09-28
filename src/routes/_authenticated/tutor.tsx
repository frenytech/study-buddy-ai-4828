import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Plus, Send, Trash2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase, authHeader } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/tutor")({
  head: () => ({ meta: [{ title: "AI Tutor — StudyAI" }, { name: "description", content: "Chat with your StudyAI tutor." }] }),
  component: Tutor,
});

type Msg = { role: "user" | "assistant"; content: string };

function Tutor() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const { data: convos } = useQuery({
    queryKey: ["convos"],
    queryFn: async () => (await supabase.from("tutor_conversations").select("id,title").order("created_at", { ascending: false })).data ?? [],
  });

  useEffect(() => {
    if (!active) { setMessages([]); return; }
    supabase.from("tutor_messages").select("role,content").eq("conversation_id", active).order("created_at")
      .then(({ data }) => setMessages((data ?? []) as Msg[]));
  }, [active]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming || !user) return;
    setInput("");
    let cid = active;
    if (!cid) {
      const { data, error } = await supabase.from("tutor_conversations").insert({ user_id: user.id, title: text.slice(0, 60) }).select("id").single();
      if (error) return toast.error(error.message);
      cid = data.id; setActive(cid); qc.invalidateQueries({ queryKey: ["convos"] });
    }
    const history: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    await supabase.from("tutor_messages").insert({ conversation_id: cid, user_id: user.id, role: "user", content: text });
    setStreaming(true);
    abort.current = new AbortController();
    let full = "";
    try {
      const res = await fetch("/api/tutor", {
        method: "POST", signal: abort.current.signal,
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ messages: history.slice(-20) }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "The tutor couldn't answer right now.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: full }]);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") { toast.error(e.message); setMessages(history); }
    } finally {
      setStreaming(false);
      if (full) await supabase.from("tutor_messages").insert({ conversation_id: cid, user_id: user.id, role: "assistant", content: full });
      qc.invalidateQueries({ queryKey: ["ai-usage-today"] });
    }
  }

  async function remove(id: string) {
    await supabase.from("tutor_conversations").delete().eq("id", id);
    if (active === id) setActive(null);
    qc.invalidateQueries({ queryKey: ["convos"] });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card p-3 md:flex">
        <Button onClick={() => setActive(null)} className="w-full"><Plus className="h-4 w-4" />New chat</Button>
        <div className="mt-4 flex-1 space-y-1 overflow-y-auto">
          {(convos ?? []).map((c) => (
            <div key={c.id} className={`group flex items-center rounded-lg text-sm ${active === c.id ? "bg-secondary" : "hover:bg-muted"}`}>
              <button className="flex-1 truncate px-3 py-2 text-left" onClick={() => setActive(c.id)}>{c.title}</button>
              <button aria-label="Delete" onClick={() => remove(c.id)} className="px-2 opacity-0 group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </aside>
      <section className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {messages.length === 0 && (
            <div className="mx-auto mt-16 max-w-md text-center">
              <GraduationCap className="mx-auto h-12 w-12 rounded-2xl bg-primary p-2.5 text-primary-foreground" />
              <h1 className="mt-4 text-2xl font-bold">What shall we learn today?</h1>
              <div className="mt-6 grid gap-2">
                {["Explain photosynthesis simply", "How do I solve quadratic equations?", "Tips for JAMB Use of English comprehension"].map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="rounded-xl border border-border bg-card px-4 py-2 text-sm hover:border-primary">{s}</button>
                ))}
              </div>
            </div>
          )}
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((m, i) => m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">{m.content}</div>
            ) : (
              <div key={i} className="flex gap-3">
                <GraduationCap className="h-7 w-7 shrink-0 rounded-lg bg-accent p-1 text-accent-foreground" />
                <div className="min-w-0 flex-1 whitespace-pre-wrap leading-relaxed">{m.content || <span className="animate-pulse text-muted-foreground">Thinking…</span>}</div>
              </div>
            ))}
            <div ref={bottom} />
          </div>
        </div>
        <div className="border-t border-border bg-background p-3 md:p-4">
          <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything…" rows={1} className="max-h-40 min-h-11 resize-none"
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
            {streaming
              ? <Button type="button" size="icon" variant="outline" onClick={() => abort.current?.abort()} aria-label="Stop"><Square className="h-4 w-4" /></Button>
              : <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim()}><Send className="h-4 w-4" /></Button>}
          </form>
        </div>
      </section>
    </div>
  );
}
