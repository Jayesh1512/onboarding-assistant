export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const SYSTEM = `You analyze a live sales/onboarding call in real time.
Given the latest utterance, recent conversation, and a list of prepared questions, return ONLY a JSON object — no markdown, no explanation — with exactly these fields:

"matchedPreparedQuestionId": string | null
  If speaker is "you" and they asked something that SEMANTICALLY MATCHES a prepared question (fuzzy ok — paraphrasing, singular/plural, reordering all count), return that question's id. Otherwise null.

"clientAnswerForId": string | null
  If speaker is "client" AND lastAskedQuestionId is not "none", return lastAskedQuestionId (the client is answering it). Otherwise null.

"isCompanyQuestion": boolean
  true only if speaker is "client" and they are asking about the company, product, pricing, or service.

Return raw JSON only.`;

function makeClient() {
  const base = process.env.OLLAMA_URL || 'http://localhost:11434/v1';
  return new OpenAI({ baseURL: base, apiKey: 'ollama' });
}

async function callModel(messages: OpenAI.Chat.ChatCompletionMessageParam[], withJsonMode: boolean) {
  const params: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
    model:       process.env.OLLAMA_ANALYZE_MODEL || 'llama3.2',
    temperature: 0,
    max_tokens:  200,
    messages,
    ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
  };
  const result = await makeClient().chat.completions.create(params);
  return result.choices[0]?.message?.content ?? '{}';
}

export async function POST(req: NextRequest) {
  const { latestEntry, recentEntries, pendingQuestions, lastAskedQuestionId, hasKB } = await req.json();

  const contextStr = (recentEntries as { speaker: string; text: string }[])
    .map((e) => `[${e.speaker}] ${e.text}`).join('\n');

  const questionsStr = (pendingQuestions as { id: string; text: string }[]).length
    ? (pendingQuestions as { id: string; text: string }[]).map((q) => `  id:${q.id} → "${q.text}"`).join('\n')
    : '  (none)';

  const userMsg =
    `LATEST: [${latestEntry.speaker}] "${latestEntry.text}"\n\n` +
    `RECENT CONVERSATION:\n${contextStr}\n\n` +
    `PREPARED QUESTIONS NOT YET ASKED:\n${questionsStr}\n\n` +
    `LAST ASKED QUESTION (awaiting client answer): ${lastAskedQuestionId ?? 'none'}\n` +
    `KB available: ${hasKB}\n\nReturn raw JSON only.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user',   content: userMsg },
  ];

  const parse = (raw: string) => {
    const cleaned = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
    // Extract first JSON object if model adds extra text
    const match = cleaned.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    return {
      matchedPreparedQuestionId: parsed.matchedPreparedQuestionId ?? null,
      clientAnswerForId:         parsed.clientAnswerForId         ?? null,
      isCompanyQuestion:         Boolean(parsed.isCompanyQuestion),
    };
  };

  try {
    const raw = await callModel(messages, true);
    return Response.json(parse(raw));
  } catch (err) {
    // Retry without json_object mode — not all Ollama models support it
    try {
      const raw = await callModel(messages, false);
      return Response.json(parse(raw));
    } catch (err2) {
      console.error('Analyze failed:', err2);
      return Response.json({ matchedPreparedQuestionId: null, clientAnswerForId: null, isCompanyQuestion: false });
    }
  }
}
