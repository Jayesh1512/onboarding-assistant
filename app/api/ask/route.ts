export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { makeOllamaClient, getBestModel, ollamaError } from '@/lib/ollama';

const SYSTEM_PROMPT = `You are a precise onboarding assistant helping answer questions during a client onboarding call.

RULES:
1. Answer ONLY using the provided company knowledge base.
2. Be concise and direct — one or two sentences when possible.
3. If the answer is NOT in the knowledge base, say: "I don't have that information in our knowledge base."
4. Never guess, infer, or fabricate information.`;

export async function POST(req: NextRequest) {
  const { question, context, model } = await req.json();
  const resolvedModel = model || await getBestModel();

  if (!question?.trim()) return Response.json({ error: 'Question is required' }, { status: 400 });
  if (!context?.trim())  return Response.json({ answer: 'No knowledge base loaded.' });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        const completion = await makeOllamaClient().chat.completions.create({
          model: resolvedModel,
          stream: true,
          temperature: 0.1,
          max_tokens: 512,
          messages: [
            {
              role: 'system',
              content: `${SYSTEM_PROMPT}\n\n--- COMPANY KNOWLEDGE BASE ---\n${context.slice(0, 80000)}\n--- END ---`,
            },
            { role: 'user', content: question },
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
