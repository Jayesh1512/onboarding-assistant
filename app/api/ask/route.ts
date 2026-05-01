export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are a precise onboarding assistant helping answer questions during a client onboarding call.

RULES:
1. Answer ONLY using the provided company knowledge base.
2. Be concise and direct — one or two sentences when possible.
3. If the answer is NOT in the knowledge base, say: "I don't have that information in our knowledge base."
4. Never guess, infer, or fabricate information.`;

function makeClient() {
  const base = process.env.OLLAMA_URL || 'http://localhost:11434/v1';
  return new OpenAI({ baseURL: base, apiKey: 'ollama' });
}

export async function POST(req: NextRequest) {
  const { question, context, model = 'llama3.2' } = await req.json();

  if (!question?.trim()) return Response.json({ error: 'Question is required' }, { status: 400 });
  if (!context?.trim())  return Response.json({ answer: 'No knowledge base loaded.' });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        const completion = await makeClient().chat.completions.create({
          model,
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
        const msg = String(err);
        send({
          error: msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
            ? 'Cannot reach Ollama. Make sure it is running: ollama serve'
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
