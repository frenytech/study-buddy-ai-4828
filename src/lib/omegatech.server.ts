// OmegaTech AICli (verified live): GET ?action=models -> {success,data:[{id,type}]}
// POST {action:"chat",model,query} -> {success,data:{model,reply}}. No API key required.
const BASE = "https://api.omegatech.app/api/ai/Aicli";
export const FALLBACK_MODEL = "gpt4o_mini";

let cache: { at: number; models: string[] } | null = null;

export async function listTextModels(): Promise<string[]> {
  if (cache && Date.now() - cache.at < 10 * 60_000) return cache.models;
  try {
    const r = await fetch(`${BASE}?action=models`, { signal: AbortSignal.timeout(15_000) });
    const j = (await r.json()) as any;
    if (!r.ok || !j?.success || !Array.isArray(j.data)) throw new Error("bad list");
    const models = j.data.filter((m: any) => m?.type === "text" && typeof m.id === "string").map((m: any) => m.id as string);
    cache = { at: Date.now(), models };
    return models;
  } catch {
    return cache?.models ?? [];
  }
}

export class OmegaError extends Error {
  constructor(public userMessage: string, public status: number) { super(userMessage); }
}

export async function omegaChat(model: string, query: string, signal?: AbortSignal): Promise<string> {
  let r: Response;
  try {
    r = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat", model, query }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
    });
  } catch (e: any) {
    if (e?.name === "AbortError" && signal?.aborted) throw e;
    throw new OmegaError(e?.name === "TimeoutError" ? "The AI took too long to answer. Please try again or pick another model." : "Couldn't reach the AI service. Check your connection and try again.", 504);
  }
  const j = (await r.json().catch(() => null)) as any;
  if (r.status === 429) throw new OmegaError("The AI is busy right now. Please wait a moment and try again.", 429);
  if (!r.ok || !j?.success) {
    console.error("OmegaTech error", r.status, j?.error);
    throw new OmegaError(/model/i.test(String(j?.error ?? "")) ? "That AI model is unavailable right now. Please choose another model." : "The AI service had a problem. Please try again or pick another model.", 502);
  }
  const reply = String(j?.data?.reply ?? "").trim();
  if (!reply) throw new OmegaError("The AI returned an empty answer. Please try again or pick another model.", 502);
  return reply;
}
