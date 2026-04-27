export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM = `You analyze a live sales/onboarding call in real time.
Given the latest utterance, recent context, and prepared questions, return ONLY a JSON object with:
- "matchedPreparedQuestionId": string|null — if the "you" speaker just asked one of the prepared questions (semantically), return its id; else null
- "clientAnswerForId": string|null — if the "client" speaker is directly answering the last-asked prepared question, return that question's id; else null
- "isCompanyQuestion": boolean — true ONLY if the "client" speaker is asking about the company, product, or service

Be strict — only match on clear semantic alignment. Return ONLY valid JSON, no explanation.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  const { latestEntry, recentEntries, pendingQuestions, lastAskedQuestionId, hasKB } = await req.json();

  const contextStr = (recentEntries as { speaker: string; text: string }[])
    .map((e) => `[${e.speaker}] ${e.text}`).join('\n');

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
    const genAI = new GoogleGenerativeAI(apiKey);
    const gemini = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-lite',   // fastest for real-time classification
      systemInstruction: SYSTEM,
      generationConfig: { responseMimeType: 'application/json', temperature: 0, maxOutputTokens: 120 },
    });

    const result = await gemini.generateContent(userMsg);
    const raw = result.response.text();
    const parsed = JSON.parse(raw);

    return Response.json({
      matchedPreparedQuestionId: parsed.matchedPreparedQuestionId ?? null,
      clientAnswerForId:         parsed.clientAnswerForId         ?? null,
      isCompanyQuestion:         Boolean(parsed.isCompanyQuestion),
    });
  } catch (err) {
    console.error('Analyze error:', err);
    return Response.json({ matchedPreparedQuestionId: null, clientAnswerForId: null, isCompanyQuestion: false });
  }
}
