// OmegaTech Claude-pro — verified live (GET):
// GET https://api.omegatech.app/api/ai/Claude-pro?action=chat&prompt=...&model=...&chatStyle=chat&tools=none&size=portrait&version=hd
// -> {statusCode,success,sessionId,model,chatStyle,tools,prompt,response,...}. No API key required.
// clearSession is never sent (per spec); conversation continuity comes from resending history.
// Model list is the complete set from the endpoint docs
// (https://api.omegatech.app/api.html?route=%2Fapi%2Fai%2FClaude-pro) plus claude-3-7-sonnet /
// claude-3-5-sonnet / gemini-2.5-flash, which the endpoint accepts and which were verified live.
// Every model below was tested with a real prompt on 2026-11-02. "paid" models answer with
// {"status":"Only paid accounts can use genius"} on the free plan.
const BASE = "https://api.omegatech.app/api/ai/Claude-pro";

export type ModelTier = "free" | "paid";
export type OmegaModel = { name: string; category: string; tier: ModelTier };

export const MODEL_CATALOG: OmegaModel[] = [
  { name: "claude-3-7-sonnet", category: "Claude", tier: "free" },
  { name: "claude-3-5-sonnet", category: "Claude", tier: "free" },
  { name: "claudeai_0", category: "Claude", tier: "free" },
  { name: "claudeai_1", category: "Claude", tier: "free" },
  { name: "gpt-5-nano", category: "OpenAI GPT", tier: "free" },
  { name: "gpt4_0", category: "OpenAI GPT", tier: "free" },
  { name: "gpt4_1", category: "OpenAI GPT", tier: "free" },
  { name: "gemini-2.5-flash", category: "Google Gemini", tier: "free" },
  { name: "gemini-2.5-flash-lite", category: "Google Gemini", tier: "free" },
  { name: "deepseek-v3.2", category: "DeepSeek", tier: "free" },
  { name: "llama-3.3-70b-instruct", category: "Meta Llama", tier: "free" },
  { name: "llama-4-scout", category: "Meta Llama", tier: "paid" },
  { name: "deepai_chat", category: "Assistant Personas", tier: "free" },
  { name: "helpful_assistant", category: "Assistant Personas", tier: "free" },
  { name: "code_assistant", category: "Assistant Personas", tier: "free" },
  { name: "creative_writer", category: "Assistant Personas", tier: "free" },
  { name: "debate_master", category: "Assistant Personas", tier: "free" },
  { name: "philosopher", category: "Assistant Personas", tier: "free" },
  { name: "genius", category: "Assistant Personas", tier: "paid" },
];

export const FALLBACK_MODEL = "claude-3-7-sonnet";
export const FREE_MODELS = MODEL_CATALOG.filter((m) => m.tier === "free").map((m) => m.name);
export const isKnownModel = (name: string) => MODEL_CATALOG.some((m) => m.name === name);

export function listTextModels(): OmegaModel[] {
  return MODEL_CATALOG;
}

export class OmegaError extends Error {
  constructor(public userMessage: string, public status: number) { super(userMessage); }
}

// The endpoint answers GET requests up to ~16k prompt chars and returns HTTP 431 beyond ~20k
// encoded chars (verified live), so the prompt is truncated before it is sent.
const MAX_QUERY_CHARS = 18000;

export async function omegaChat(model: string, prompt: string, signal?: AbortSignal): Promise<{ reply: string }> {
  const query = new URLSearchParams({
    action: "chat",
    prompt: prompt.slice(0, MAX_QUERY_CHARS),
    model,
    chatStyle: "chat",
    tools: "none",
    size: "portrait",
    version: "hd",
  });
  let r: Response;
  try {
    r = await fetch(`${BASE}?${query.toString()}`, {
      method: "GET",
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
  if (r.status === 431 || r.status === 414) throw new OmegaError("This question got too long to send. Start a new chat or ask a shorter question.", 413);
  if (!j) { console.error("Claude-pro non-JSON", r.status, text.slice(0, 300)); throw new OmegaError("The AI service sent an unexpected reply. Please try again.", 502); }
  if (!r.ok || !j.success) {
    console.error("Claude-pro error", r.status, j.error ?? j.status);
    if (r.status === 400) throw new OmegaError("The request to the AI was invalid. Please rephrase and try again.", 400);
    throw new OmegaError("The AI service is temporarily unavailable. Please try again shortly.", 502);
  }
  const reply = String(j.response ?? "").trim();
  if (/only paid accounts/i.test(reply)) {
    console.error("Claude-pro paid-only model", model);
    throw new OmegaError("This AI model needs a paid OmegaTech account. Please choose another model.", 402);
  }
  if (!reply) throw new OmegaError("The AI returned an empty answer. Please try again.", 502);
  return { reply };
}
