export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

interface Question { id: string; text: string; asked: boolean }

function tokenize(text: string): Set<string> {
  const stopwords = new Set(['i','a','the','is','are','was','were','to','of','and','in','it','you','we','do','did','can','will','be','have','has','had','this','that','with','for','on','at','from','by','an','as','or','your','our','me','my','about']);
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter((w) => w.length > 2 && !stopwords.has(w)));
}

function similarity(a: string, b: string): number {
  const ta = tokenize(a), tb = tokenize(b);
  if (!ta.size || !tb.size) return 0;
  const intersection = [...ta].filter((w) => tb.has(w)).length;
  return intersection / Math.max(ta.size, tb.size);
}

export async function POST(req: NextRequest) {
  const { spoken, questions } = await req.json() as { spoken: string; questions: Question[] };
  if (!spoken?.trim() || !questions?.length) return Response.json({ match: null });

  const pending = questions.filter((q) => !q.asked);
  if (!pending.length) return Response.json({ match: null });

  let best = { id: '', score: 0 };
  for (const q of pending) {
    const score = similarity(spoken, q.text);
    if (score > best.score) best = { id: q.id, score };
  }

  return Response.json(best.score >= 0.4 ? { match: best.id, score: best.score } : { match: null });
}
