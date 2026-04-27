export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM = `You write professional Minutes of Meeting (MOM) for a sales/onboarding call.
Format your response in clean Markdown with these exact sections:

## Meeting Overview
2–3 sentence summary of what the call covered and the main outcome.

## Key Topics Discussed
Bullet list of the main subjects discussed.

## Prepared Questions & Client Responses
For each question that was asked, list the question and summarise the client's answer. If no answer was captured, say "Answer not captured".

## Client Questions & Answers Provided
Questions the client asked and the answers given.

## Key Takeaways
The most important points, decisions, or facts from the call.

## Next Steps & Action Items
Concrete follow-up actions with implied owners where possible.

Be concise and factual. Only use information from the transcript — do not invent details.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  const { transcript, questions, model } = await req.json();

  const transcriptStr = (transcript as { speaker: string; text: string }[])
    .map((e) => `[${e.speaker === 'you' ? 'YOU' : 'CLIENT'}] ${e.text}`)
    .join('\n');

  const qaStr = (questions as { text: string; asked: boolean; clientAnswer?: string }[])
    .filter((q) => q.asked)
    .map((q) => `Q: ${q.text}\nClient response: ${q.clientAnswer?.trim() || '(not captured)'}`)
    .join('\n\n');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const gemini = genAI.getGenerativeModel({
          model: model || 'gemini-2.5-pro',   // use smart model for meeting minutes
          systemInstruction: SYSTEM,
          generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
        });

        const userMsg =
          `FULL CALL TRANSCRIPT:\n${transcriptStr || '(no transcript)'}\n\n` +
          `PREPARED Q&A CAPTURED:\n${qaStr || '(none)'}`;

        const result = await gemini.generateContentStream(userMsg);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) send({ text });
        }
        send({ done: true });
      } catch (err) {
        send({ error: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
