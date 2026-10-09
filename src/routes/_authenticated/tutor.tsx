import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Plus, Send, Trash2, Square, Copy, RefreshCw, Eraser, Mic, MicOff, Volume2, Pause, Play, PlayCircle, MessageSquare, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase, authHeader } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/tutor")({
  head: () => ({ meta: [{ title: "AI Tutor — StudyAI" }, { name: "description", content: "Chat or talk with your StudyAI tutor." }] }),
  component: Tutor,
});

type Msg = { role: "user" | "assistant"; content: string; sources?: string[] };
type Video = { id: string; title: string; channel: string; thumbnail: string; duration: string; topic: string };

const ACTIONS = [
  ["explain", "Explain"], ["simple", "Explain Simply"], ["steps", "Step-by-Step"], ["example", "Give Example"], ["hint", "Hint"],
  ["practice", "Practice"], ["check", "Check My Answer"], ["quiz", "Quiz Me"], ["flashcards", "Create Flashcards"], ["summarize", "Summarize"],
] as const;
type Action = (typeof ACTIONS)[number][0] | "chat";

function Tutor() {
  const { user, plan, isAdmin } = useAuth();
  const premium = plan === "premium" || isAdmin;
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [materialId, setMaterialId] = useState("");
  const [videos, setVideos] = useState<Video[]>([]);
  const [playing, setPlaying] = useState<Video | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [model, setModel] = useState("");
  const { data: modelList } = useQuery({
    queryKey: ["tutor-models"], staleTime: 5 * 60_000,
    queryFn: async () => {
      const r = await fetch("/api/tutor/models", { headers: await authHeader() });
      return r.ok ? ((await r.json()) as { models: string[]; default: string }) : { models: [] as string[], default: "" };
    },
  });
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const { data: convos } = useQuery({
    queryKey: ["convos"],
    queryFn: async () => (await supabase.from("tutor_conversations").select("id,title").order("created_at", { ascending: false })).data ?? [],
  });
  const { data: materials } = useQuery({
    queryKey: ["tutor-materials"],
    queryFn: async () => (await supabase.from("materials").select("id,title").eq("status", "ready").order("created_at", { ascending: false })).data ?? [],
  });

  useEffect(() => {
    setVideos([]); setPlaying(null);
    if (!active) { setMessages([]); return; }
    supabase.from("tutor_messages").select("role,content").eq("conversation_id", active).order("created_at")
      .then(({ data }) => setMessages((data ?? []) as Msg[]));
  }, [active]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, videos]);

  async function ensureConvo(title: string) {
    if (active) return active;
    const { data, error } = await supabase.from("tutor_conversations").insert({ user_id: user!.id, title: title.slice(0, 60) }).select("id").single();
    if (error) { toast.error(error.message); return null; }
    setActive(data.id); qc.invalidateQueries({ queryKey: ["convos"] });
    return data.id as string;
  }

  /** Streams a real OpenRouter reply for the given history. Returns the final text. */
  async function ask(history: Msg[], action: Action, cid: string, opts: { voice?: boolean } = {}) {
    setMessages([...history, { role: "assistant", content: "" }]);
    setStreaming(true);
    abort.current = new AbortController();
    let full = ""; let sources: string[] = [];
    try {
      const res = await fetch("/api/tutor", {
        method: "POST", signal: abort.current.signal,
        headers: { "Content-Type": "application/json", ...(await authHeader()) },
        body: JSON.stringify({ messages: history.slice(-20).map(({ role, content }) => ({ role, content })), action, materialId: materialId || undefined, voice: opts.voice, model: model || undefined }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "The tutor couldn't answer right now.");
      }
      try { sources = JSON.parse(decodeURIComponent(res.headers.get("X-Tutor-Sources") ?? "%5B%5D")); } catch { sources = []; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: full, sources }]);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") { toast.error(e.message); setMessages(history); }
    } finally {
      setStreaming(false);
      if (full) await supabase.from("tutor_messages").insert({ conversation_id: cid, user_id: user!.id, role: "assistant", content: full });
      qc.invalidateQueries({ queryKey: ["ai-usage-today"] });
    }
    if (full && premium && !opts.voice) void loadVideos(history.filter((m) => m.role === "user").slice(-1)[0]?.content ?? "");
    return full;
  }

  async function send(action: Action = "chat", override?: string, voice = false) {
    const text = (override ?? input).trim() || (action !== "chat" && messages.length ? `(${ACTIONS.find((a) => a[0] === action)?.[1]} — on what we've been discussing)` : "");
    if (!text || streaming || !user) return "";
    setInput("");
    const cid = await ensureConvo(text);
    if (!cid) return "";
    const history: Msg[] = [...messages, { role: "user", content: text }];
    await supabase.from("tutor_messages").insert({ conversation_id: cid, user_id: user.id, role: "user", content: text });
    return ask(history, action, cid, { voice });
  }

  async function regenerate() {
    if (streaming || !active) return;
    const lastUser = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUser < 0) return;
    const history = messages.slice(0, lastUser + 1);
    const { data: last } = await supabase.from("tutor_messages").select("id").eq("conversation_id", active).eq("role", "assistant").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (last) await supabase.from("tutor_messages").delete().eq("id", last.id);
    void ask(history, "chat", active);
  }

  async function clearChat() {
    if (!active) { setMessages([]); return; }
    await supabase.from("tutor_messages").delete().eq("conversation_id", active);
    setMessages([]); setVideos([]); setPlaying(null);
    toast.success("Chat cleared");
  }

  async function loadVideos(query: string) {
    if (!query) return;
    const res = await fetch("/api/tutor/videos", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ query }) });
    const b = await res.json().catch(() => ({}));
    if (res.ok) setVideos(b.videos ?? []);
    else if (res.status !== 403) console.warn(b.error);
  }

  async function remove(id: string) {
    await supabase.from("tutor_conversations").delete().eq("id", id);
    if (active === id) setActive(null);
    qc.invalidateQueries({ queryKey: ["convos"] });
  }

  const lastAssistant = messages.length > 0 && messages[messages.length - 1]!.role === "assistant";

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
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 text-sm">
          <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setActive(null)}><Plus className="h-4 w-4" />New</Button>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} aria-label="Use one of my PDFs"
            className="h-8 min-w-0 max-w-[55vw] rounded-md border border-input bg-background px-2 text-xs md:max-w-xs">
            <option value="">All my materials & courses</option>
            {(materials ?? []).map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>
          <select value={model} onChange={(e) => setModel(e.target.value)} aria-label="AI model"
            className="h-8 min-w-0 max-w-[40vw] rounded-md border border-input bg-background px-2 text-xs md:max-w-[12rem]">
            <option value="">StudyAI Recommended{modelList?.default ? ` (${modelList.default})` : ""}</option>
            {(modelList?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant={voiceMode ? "default" : "outline"} onClick={() => setVoiceMode(!voiceMode)}>
              {voiceMode ? <><MessageSquare className="h-4 w-4" />Text chat</> : <><Mic className="h-4 w-4" />Voice Mode</>}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearChat} disabled={streaming || messages.length === 0} aria-label="Clear chat"><Eraser className="h-4 w-4" /></Button>
          </div>
        </div>

        {voiceMode ? (
          <VoicePanel premium={premium} streaming={streaming} onAsk={(t) => send("chat", t, true)} onStop={() => abort.current?.abort()} messages={messages} />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
              {messages.length === 0 && (
                <div className="mx-auto mt-10 max-w-md text-center">
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
                  <div key={i} className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground">{m.content}</div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <GraduationCap className="h-7 w-7 shrink-0 rounded-lg bg-accent p-1 text-accent-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="whitespace-pre-wrap break-words leading-relaxed">{m.content || <span className="animate-pulse text-muted-foreground">Thinking…</span>}</div>
                      {m.sources && m.sources.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Used: {m.sources.join(" · ")}</p>}
                      {m.content && (
                        <div className="mt-1 flex gap-1 text-muted-foreground">
                          <button className="rounded p-1 hover:bg-muted" aria-label="Copy" onClick={() => { void navigator.clipboard.writeText(m.content); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5" /></button>
                          {i === messages.length - 1 && !streaming && <button className="rounded p-1 hover:bg-muted" aria-label="Regenerate" onClick={regenerate}><RefreshCw className="h-3.5 w-3.5" /></button>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {lastAssistant && !streaming && videos.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-3">
                    <p className="mb-2 text-sm font-semibold">Watch next, then practise</p>
                    {playing && (
                      <div className="mb-3">
                        <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
                          <iframe className="absolute inset-0 h-full w-full" src={`https://www.youtube-nocookie.com/embed/${playing.id}?autoplay=1&rel=0`} title={playing.title}
                            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm font-medium">{playing.title}</p>
                          <Button size="sm" onClick={() => { setPlaying(null); void send("quiz", `Quiz me on ${playing.topic}`); }}>Quiz me on this</Button>
                          <Button size="sm" variant="ghost" onClick={() => setPlaying(null)} aria-label="Close video"><X className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      {videos.map((v) => (
                        <button key={v.id} onClick={() => setPlaying(v)} className="flex gap-2 rounded-xl p-1.5 text-left hover:bg-muted">
                          <div className="relative w-28 shrink-0">
                            <img src={v.thumbnail} alt="" className="aspect-video w-full rounded-lg object-cover" loading="lazy" />
                            <span className="absolute bottom-1 right-1 rounded bg-foreground/80 px-1 text-[10px] text-background">{v.duration}</span>
                            <PlayCircle className="absolute inset-0 m-auto h-7 w-7 text-background drop-shadow" />
                          </div>
                          <div className="min-w-0 text-xs">
                            <p className="line-clamp-2 font-medium">{v.title}</p>
                            <p className="mt-1 text-muted-foreground">{v.channel}</p>
                            <p className="text-muted-foreground">Topic: {v.topic.slice(0, 40)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottom} />
              </div>
            </div>
            <div className="border-t border-border bg-background p-3 md:p-4">
              <div className="mx-auto mb-2 flex max-w-3xl gap-1.5 overflow-x-auto pb-1">
                {ACTIONS.map(([id, label]) => (
                  <button key={id} disabled={streaming || (!input.trim() && messages.length === 0)} onClick={() => void send(id)}
                    className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-xs hover:border-primary disabled:opacity-50">{label}</button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="mx-auto flex max-w-3xl items-end gap-2">
                <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything…" rows={1} className="max-h-40 min-h-11 resize-none"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
                {streaming
                  ? <Button type="button" size="icon" variant="outline" onClick={() => abort.current?.abort()} aria-label="Stop"><Square className="h-4 w-4" /></Button>
                  : <Button type="submit" size="icon" aria-label="Send" disabled={!input.trim()}><Send className="h-4 w-4" /></Button>}
              </form>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function VoicePanel({ premium, streaming, onAsk, onStop, messages }: { premium: boolean; streaming: boolean; onAsk: (t: string) => Promise<string>; onStop: () => void; messages: Msg[] }) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing" | "thinking" | "speaking" | "paused">("idle");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);

  useEffect(() => () => { rec.current?.stream.getTracks().forEach((t) => t.stop()); audio.current?.pause(); if (audioUrl.current) URL.revokeObjectURL(audioUrl.current); }, []);

  if (!premium) return (
    <div className="grid flex-1 place-items-center p-6 text-center">
      <div className="max-w-sm">
        <Mic className="mx-auto h-12 w-12 rounded-2xl bg-primary p-2.5 text-primary-foreground" />
        <h2 className="mt-4 text-xl font-bold">Voice Tutor is a Premium feature</h2>
        <p className="mt-2 text-sm text-muted-foreground">Talk to your tutor and hear spoken answers for ₦700/month.</p>
        <Button asChild className="mt-4"><Link to="/billing">Upgrade to Premium</Link></Button>
      </div>
    </div>
  );

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const type = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: BlobPart[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      r.onstop = () => { stream.getTracks().forEach((t) => t.stop()); void handle(new Blob(chunks, { type: r.mimeType || "audio/webm" })); };
      rec.current = r; r.start(); setState("recording");
    } catch { toast.error("Please allow microphone access to use Voice Mode."); }
  }

  async function handle(blob: Blob) {
    setState("transcribing");
    const fd = new FormData(); fd.append("audio", blob, "speech");
    const res = await fetch("/api/tutor/stt", { method: "POST", headers: await authHeader(), body: fd });
    const b = await res.json().catch(() => ({}));
    if (!res.ok || !b.text) { toast.error(b.error ?? "I didn't catch that."); setState("idle"); return; }
    setQuestion(b.text); setAnswer(""); setState("thinking");
    const reply = await onAsk(b.text);
    if (!reply) { setState("idle"); return; }
    setAnswer(reply);
    await speak(reply);
  }

  async function speak(text: string) {
    setState("thinking");
    const res = await fetch("/api/tutor/tts", { method: "POST", headers: { "Content-Type": "application/json", ...(await authHeader()) }, body: JSON.stringify({ text: text.slice(0, 4500) }) });
    if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.error ?? "Couldn't play the voice reply."); setState("idle"); return; }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = URL.createObjectURL(await res.blob());
    play();
  }

  function play() {
    if (!audioUrl.current) return;
    audio.current?.pause();
    const a = new Audio(audioUrl.current);
    a.onended = () => setState("idle");
    audio.current = a;
    void a.play().then(() => setState("speaking")).catch(() => setState("paused"));
  }

  const last = messages[messages.length - 1];
  const shown = streaming && last?.role === "assistant" ? last.content : answer;

  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto p-4 md:p-8">
      <div className="w-full max-w-xl space-y-4">
        {question && <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-primary-foreground"><p className="text-[10px] uppercase opacity-70">You said</p>{question}</div>}
        {shown && <div className="flex gap-3"><GraduationCap className="h-7 w-7 shrink-0 rounded-lg bg-accent p-1 text-accent-foreground" /><p className="min-w-0 flex-1 whitespace-pre-wrap break-words leading-relaxed">{shown}</p></div>}
      </div>
      <div className="mt-auto flex flex-col items-center gap-3 pt-8">
        <p className="text-sm text-muted-foreground">
          {{ idle: "Tap the mic and ask your question", recording: "Listening… tap to stop", transcribing: "Writing down what you said…", thinking: "Your tutor is thinking…", speaking: "Speaking…", paused: "Paused" }[state]}
        </p>
        <button
          onClick={() => state === "recording" ? rec.current?.stop() : state === "idle" || state === "paused" ? start() : undefined}
          disabled={state === "transcribing" || state === "thinking" || state === "speaking"}
          aria-label={state === "recording" ? "Stop recording" : "Start speaking"}
          className={`grid h-20 w-20 place-items-center rounded-full text-primary-foreground shadow-soft transition disabled:opacity-60 ${state === "recording" ? "animate-pulse bg-destructive" : "bg-primary"}`}>
          {state === "recording" ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
        </button>
        <div className="flex gap-2">
          {state === "speaking" && <Button size="sm" variant="outline" onClick={() => { audio.current?.pause(); setState("paused"); }}><Pause className="h-4 w-4" />Pause</Button>}
          {state === "paused" && <Button size="sm" variant="outline" onClick={() => { void audio.current?.play(); setState("speaking"); }}><Play className="h-4 w-4" />Resume</Button>}
          {(state === "speaking" || state === "paused") && <Button size="sm" variant="outline" onClick={() => { audio.current?.pause(); if (audio.current) audio.current.currentTime = 0; setState("idle"); }}><Square className="h-4 w-4" />Stop</Button>}
          {state === "thinking" && streaming && <Button size="sm" variant="outline" onClick={onStop}><Square className="h-4 w-4" />Stop</Button>}
          {state === "idle" && audioUrl.current && <Button size="sm" variant="outline" onClick={play}><Volume2 className="h-4 w-4" />Replay</Button>}
        </div>
      </div>
    </div>
  );
}
