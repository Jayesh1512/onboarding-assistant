export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { makeOllamaClient, getBestModel, ollamaError } from '@/lib/ollama';

const SYSTEM = `You write professional Minutes of Meeting (MOM) for a sales/onboarding call.
Format your response in clean Markdown with these sections:

## Meeting Overview
2–3 sentence summary of what the call covered and the outcome.

## Key Topics Discussed
Bullet list of main subjects.

## Prepared Questions & Client Responses
For each asked question, show the question and the client's answer. If no answer captured, say "Answer not captured".

## Client Questions & Answers Provided
Questions the client asked and the answers given.

## Key Takeaways
Most important facts, decisions, or points.

## Next Steps & Action Items
Concrete follow-up actions.

Be concise and factual. Only use information from the transcript.`;

export async function POST(req: NextRequest) {
  const { transcript, questions, model } = await req.json();
  const resolvedModel = model || await getBestModel();

  const transcriptStr = (transcript as { speaker: string; text: string }[])
    .map((e) => `[${e.speaker === 'you' ? 'YOU' : 'CLIENT'}] ${e.text}`)
    .join('\n');

  const qaStr = (questions as { text: string; asked: boolean; clientAnswer?: string }[])
    .filter((q) => q.asked)
    .map((q) => `Q: ${q.text}\nClient: ${q.clientAnswer?.trim() || '(not captured)'}`)
    .join('\n\n');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        const completion = await makeOllamaClient().chat.completions.create({
          model: resolvedModel,
          stream: true,
          temperature: 0.2,
          max_tokens: 2000,
          messages: [
            { role: 'system', content: SYSTEM },
            {
              role: 'user',
              content:
                `TRANSCRIPT:\n${transcriptStr || '(empty)'}\n\n` +
                `PREPARED Q&A:\n${qaStr || '(none)'}`,
            },
          ],
        });
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) send({ text });
        }
        send({ done: true });
      } catch (err) {
        send({ error: ollamaError(String(err)) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
