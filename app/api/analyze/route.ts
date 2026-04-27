export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

// Fast, cheap classification of each live utterance.
// Returns JSON — used to drive real-time UI updates.
const SYSTEM = `You analyze a live sales/onboarding call in real time.
Given the latest utterance, recent context, and a list of prepared questions, return ONLY a JSON object with:
- "matchedPreparedQuestionId": string|null — if the "you" speaker just asked one of the prepared questions, return its id; else null
- "clientAnswerForId": string|null — if the "client" speaker is directly answering the last-asked prepared question, return that question's id; else null
- "isCompanyQuestion": boolean — true ONLY if the "client" speaker is asking a question about the company, product, or service

Be strict: only match when there is a clear semantic match. Return ONLY valid JSON, no explanation.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: 'GROQ_API_KEY not set' }, { status: 500 });

  const {
    latestEntry,          // { speaker, text }
    recentEntries,        // [{ speaker, text }] last ~5
    pendingQuestions,     // [{ id, text }]
    lastAskedQuestionId,  // string | null
    hasKB,                // boolean
  } = await req.json();

  const contextStr = (recentEntries as { speaker: string; text: string }[])
    .map((e) => `[${e.speaker}] ${e.text}`)
    .join('\n');

  const questionsStr = (pendingQuestions as { id: string; text: string }[]).length
    ? (pendingQuestions as { id: string; text: string }[]).map((q) => `  id:${q.id} → "${q.text}"`).join('\n')
    : '  (none)';

  const userMsg =
    `Latest utterance: [${latestEntry.speaker}] "${latestEntry.text}"\n\n` +
    `Recent context:\n${contextStr}\n\n` +
    `Prepared questions not yet asked:\n${questionsStr}\n\n` +
    `Last prepared question asked (awaiting client answer): ${lastAskedQuestionId ?? 'none'}\n` +
    `Knowledge base available: ${hasKB}`;

  try {
    const groq = new Groq({ apiKey });
    const result = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',   // fastest — classify in <300 ms
      temperature: 0,
      max_tokens: 120,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user',   content: userMsg },
      ],
    });

    const raw = result.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);
    return Response.json({
      matchedPreparedQuestionId: parsed.matchedPreparedQuestionId ?? null,
      clientAnswerForId:         parsed.clientAnswerForId         ?? null,
      isCompanyQuestion:         Boolean(parsed.isCompanyQuestion),
    });
  } catch (err) {
    console.error('Analyze error:', err);
    // Never crash the call — return safe defaults
    return Response.json({ matchedPreparedQuestionId: null, clientAnswerForId: null, isCompanyQuestion: false });
  }
}
