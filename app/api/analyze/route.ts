export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM = `You are analyzing a live sales/onboarding call transcript in real time.

Your job: classify the LATEST utterance by looking at the recent conversation and a list of prepared questions.

Return ONLY a JSON object — no explanation, no markdown, just raw JSON — with these fields:

"matchedPreparedQuestionId": string | null
  → If the speaker is "you" and they just asked something that SEMANTICALLY MATCHES any prepared question, return that question's id.
  → Use FUZZY / SEMANTIC matching — minor wording differences, singular vs plural, paraphrasing, reordering all count as a match.
  → Example: "Where is your HQ?" matches "Where is your headquarter located?"
  → Example: "How many drones do you operate?" matches "How many docks does your company use?"
  → If speaker is "client", always return null here.

"clientAnswerForId": string | null
  → If the speaker is "client" AND there is a recently-asked prepared question (provided as lastAskedQuestionId), return that question's id to indicate this is the client's answer.
  → Even partial answers count — e.g. "So we are located in Maharashtra" answers "Where is your headquarters located?"
  → If lastAskedQuestionId is "none" or speaker is "you", return null.

"isCompanyQuestion": boolean
  → true ONLY if speaker is "client" and they are asking a specific question about the other party's company, product, pricing, or service.
  → false for everything else (greetings, answers, statements, filler).`;

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
    `LATEST UTTERANCE: [${latestEntry.speaker}] "${latestEntry.text}"\n\n` +
    `RECENT CONVERSATION (for context):\n${contextStr}\n\n` +
    `PREPARED QUESTIONS NOT YET ASKED:\n${questionsStr}\n\n` +
    `LAST PREPARED QUESTION ASKED (awaiting client answer): ${lastAskedQuestionId ?? 'none'}\n` +
    `Knowledge base available: ${hasKB}\n\n` +
    `Remember: use fuzzy/semantic matching for questions. Return ONLY raw JSON.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const gemini = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',   // upgraded from flash-lite for better semantic matching
      systemInstruction: SYSTEM,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 150,
      },
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
    // Never crash the call — return safe defaults
    return Response.json({ matchedPreparedQuestionId: null, clientAnswerForId: null, isCompanyQuestion: false });
  }
}
