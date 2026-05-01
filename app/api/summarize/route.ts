export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import OpenAI from 'openai';

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

function makeClient() {
  const base = process.env.OLLAMA_URL || 'http://localhost:11434/v1';
  return new OpenAI({ baseURL: base, apiKey: 'ollama' });
}

export async function POST(req: NextRequest) {
  const { transcript, questions, model } = await req.json();

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
        const completion = await makeClient().chat.completions.create({
          model: model || process.env.OLLAMA_SUMMARIZE_MODEL || 'llama3.2',
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
        const msg = String(err);
        send({
          error: msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
            ? 'Cannot reach Ollama. Run: ollama serve'
            : msg,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
