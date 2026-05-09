export const dynamic = 'force-dynamic';

import { modelScore } from '@/lib/ollama';

export async function GET() {
  const base = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/v1\/?$/, '');
  try {
    const res = await fetch(`${base}/api/tags`);
    if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
    const data = await res.json();
    const models = ((data.models ?? []) as { name: string }[])
      .map((m) => ({ id: m.name, name: m.name }))
      .sort((a, b) => modelScore(a.id) - modelScore(b.id));
    return Response.json({ models });
  } catch (err) {
    return Response.json({ models: [], error: String(err) });
  }
}
