// OmegaTech Claude-pro (verified live): POST {action:"chat",prompt,model,sessionId?}
// -> {success,sessionId,model,response,historyCount}. No API key required.
// The endpoint's default model returns {"status":"Only paid accounts can use genius"} as its
// response, so a model must always be sent. Models below were each verified to answer.
const BASE = "https://api.omegatech.app/api/ai/Claude-pro";
export const MODELS = ["claude-3-7-sonnet", "claude-3-5-sonnet", "deepseek-v3", "gemini-2.5-flash"] as const;
export const FALLBACK_MODEL = "claude-3-7-sonnet";

export async function listTextModels(): Promise<string[]> {
  return [...MODELS];
}

export class OmegaError extends Error {
  constructor(public userMessage: string, public status: number) { super(userMessage); }
}

export async function omegaChat(model: string, prompt: string, signal?: AbortSignal, sessionId?: string): Promise<{ reply: string; sessionId: string | null }> {
  let r: Response;
  try {
    r = await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "chat", prompt, model, chatStyle: "chat", ...(sessionId ? { sessionId } : {}) }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
    });
  } catch (e: any) {
    if (e?.name === "AbortError" && signal?.aborted) throw e;
    console.error("Claude-pro network error", e?.name, e?.message);
    throw new OmegaError(e?.name === "TimeoutError" ? "The AI took too long to answer. Please try again." : "Couldn't reach the AI service. Check your connection and try again.", 504);
  }
  const text = await r.text();
  let j: any = null;
  try { j = JSON.parse(text); } catch { /* not JSON */ }
  if (r.status === 429) throw new OmegaError("The AI is getting a lot of requests right now. Please wait a moment and try again.", 429);
  if (!j) { console.error("Claude-pro non-JSON", r.status, text.slice(0, 300)); throw new OmegaError("The AI service sent an unexpected reply. Please try again.", 502); }
  if (!r.ok || !j.success) {
    console.error("Claude-pro error", r.status, j.error);
    if (r.status === 400) throw new OmegaError("The request to the AI was invalid. Please rephrase and try again.", 400);
    throw new OmegaError("The AI service is temporarily unavailable. Please try again shortly.", 502);
  }
  const reply = String(j.response ?? "").trim();
  if (/only paid accounts/i.test(reply)) {
    console.error("Claude-pro paid-only model", model);
    throw new OmegaError("This AI model needs a paid OmegaTech account. Please choose another model.", 402);
  }
  if (!reply) throw new OmegaError("The AI returned an empty answer. Please try again.", 502);
  return { reply, sessionId: typeof j.sessionId === "string" ? j.sessionId : null };
}
