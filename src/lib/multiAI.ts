/**
 * Multi-AI: Gemini, OpenAI, Claude.
 * Tries each provider in order and returns the first successful JSON response.
 */

import { GoogleGenAI } from "@google/genai";

export type AIKeys = { gemini?: string; openai?: string; claude?: string };
const GEMINI_NOT_FOUND_COOLDOWN_MS = 10 * 60 * 1000;
let geminiBlockedUntil = 0;
const GEMINI_BLOCK_KEY = 'bscale:ai:geminiBlockedUntil';

if (typeof window !== 'undefined') {
  const persisted = Number(window.localStorage.getItem(GEMINI_BLOCK_KEY) || '0');
  if (Number.isFinite(persisted) && persisted > Date.now()) {
    geminiBlockedUntil = persisted;
  }
}

function isGeminiTemporarilyBlocked() {
  return Date.now() < geminiBlockedUntil;
}

function normalizeProviderKey(value: string | undefined): string {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (
    lower === 'server-managed' ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower === 'none' ||
    lower.startsWith('your_')
  ) {
    return '';
  }
  return trimmed;
}

export function getAIKeysFromConnections(
  connections: { id: string; settings?: Record<string, string> }[]
): AIKeys {
  const gemini = normalizeProviderKey(connections.find((c) => c.id === "gemini")?.settings?.apiKey);
  const openai = normalizeProviderKey(connections.find((c) => c.id === "openai")?.settings?.apiKey);
  const claude = normalizeProviderKey(connections.find((c) => c.id === "claude")?.settings?.apiKey);
  return { gemini, openai, claude };
}

function parseJsonSafe<T>(text: string, fallback: T): T {
  if (!text || !text.trim()) return fallback;
  const raw = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function tryGemini(prompt: string, apiKey: string): Promise<string> {
  if (Date.now() < geminiBlockedUntil) {
    throw new Error("Gemini temporarily disabled after repeated 404 responses.");
  }
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash-001",
    contents: prompt,
    config: { responseMimeType: "application/json" },
  });
  return (response as { text?: string }).text ?? "";
}

function isGeminiNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '');
  const lower = message.toLowerCase();
  return (
    lower.includes('404') ||
    lower.includes('not found') ||
    lower.includes('models/gemini-2.0-flash') ||
    lower.includes('no longer available')
  );
}

// OpenAI and Claude APIs don't support CORS from browsers.
// Route all requests through our server-side proxy to avoid CORS errors
// and to keep user API keys out of browser network logs.
const AI_PROXY_URL = '/api/proxy/ai';

async function tryOpenAI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "openai", apiKey, prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(String(err?.message || res.statusText));
  }
  const data = await res.json() as Record<string, unknown>;
  const choices = data?.choices as Array<{ message?: { content?: string } }> | undefined;
  return choices?.[0]?.message?.content ?? "";
}

async function tryClaude(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(AI_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider: "claude", apiKey, prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(String(err?.message || res.statusText));
  }
  const data = await res.json() as Record<string, unknown>;
  const content = data?.content as Array<{ text?: string }> | undefined;
  return content?.[0]?.text ?? "";
}

/**
 * Run prompt with first available provider (Gemini → OpenAI → Claude).
 * Returns parsed JSON and which provider was used.
 */
export async function requestJSON<T = unknown>(
  prompt: string,
  keys: AIKeys
): Promise<{ data: T; provider: string }> {
  const errors: string[] = [];
  const normalizedKeys: AIKeys = {
    gemini: normalizeProviderKey(keys.gemini),
    openai: normalizeProviderKey(keys.openai),
    claude: normalizeProviderKey(keys.claude),
  };

  if (normalizedKeys.gemini) {
    try {
      const text = await tryGemini(prompt, normalizedKeys.gemini);
      const data = parseJsonSafe<T>(text, null as unknown as T);
      if (data != null) return { data, provider: "gemini" };
    } catch (e) {
      if (isGeminiNotFoundError(e)) {
        geminiBlockedUntil = Date.now() + GEMINI_NOT_FOUND_COOLDOWN_MS;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(GEMINI_BLOCK_KEY, String(geminiBlockedUntil));
        }
      }
      errors.push(`Gemini: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (normalizedKeys.openai) {
    try {
      const text = await tryOpenAI(prompt, normalizedKeys.openai);
      const data = parseJsonSafe<T>(text, null as unknown as T);
      if (data != null) return { data, provider: "openai" };
    } catch (e) {
      errors.push(`OpenAI: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (normalizedKeys.claude) {
    try {
      const text = await tryClaude(prompt, normalizedKeys.claude);
      const data = parseJsonSafe<T>(text, null as unknown as T);
      if (data != null) return { data, provider: "claude" };
    } catch (e) {
      errors.push(`Claude: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  throw new Error(
    "No AI provider responded successfully. " +
      (errors.length ? errors.join("; ") : "Add Gemini, OpenAI or Claude API key in Integrations.")
  );
}

/** Check if at least one AI key is configured */
export function hasAnyAIKey(keys: AIKeys): boolean {
  const geminiKey = normalizeProviderKey(keys.gemini);
  const openaiKey = normalizeProviderKey(keys.openai);
  const claudeKey = normalizeProviderKey(keys.claude);
  const hasFallbackProvider = Boolean(openaiKey || claudeKey);
  const hasUsableGemini = Boolean(geminiKey) && (!isGeminiTemporarilyBlocked() || hasFallbackProvider);
  return Boolean(hasUsableGemini || hasFallbackProvider);
}
