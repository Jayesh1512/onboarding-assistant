import OpenAI from 'openai';

export const MODEL_PRIORITY: string[] = [
  'gemma4',
  'llama3.3',
  'llama3.2',
  'llama3.1',
  'llama3',
  'mistral-large',
  'mixtral',
  'mistral',
  'gemma3',
  'gemma2',
  'phi4',
  'phi3',
  'phi',
  'llama2',
];

export function modelScore(name: string): number {
  const lower = name.toLowerCase();
  const idx = MODEL_PRIORITY.findIndex((p) => lower.startsWith(p));
  return idx === -1 ? MODEL_PRIORITY.length : idx;
}

export function makeOllamaClient(): OpenAI {
  const base = process.env.OLLAMA_URL || 'http://localhost:11434/v1';
  return new OpenAI({ baseURL: base, apiKey: 'ollama' });
}

export function ollamaError(msg: string): string {
  return msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
    ? 'Cannot reach Ollama — run: ollama serve'
    : msg;
}

const FALLBACK_MODEL = 'gemma4:latest';
let _cachedModel: string | null = null;
let _cacheExpiry = 0;

/** Returns the highest-priority model available in Ollama. Falls back to gemma4:latest. */
export async function getBestModel(): Promise<string> {
  const now = Date.now();
  if (_cachedModel && now < _cacheExpiry) return _cachedModel;

  const base = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/v1\/?$/, '');
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const sorted = ((data.models ?? []) as { name: string }[])
      .map((m) => m.name)
      .sort((a, b) => modelScore(a) - modelScore(b));
    const best = sorted[0] ?? FALLBACK_MODEL;
    _cachedModel = best;
    _cacheExpiry = now + 60_000;
    return best;
  } catch {
    return FALLBACK_MODEL;
  }
}
