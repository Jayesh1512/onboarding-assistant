export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

const SYSTEM_PROMPT = `You are a precise onboarding assistant. You help answer questions during a client onboarding call.

RULES:
1. Answer ONLY using the provided company knowledge base below.
2. Be concise and direct — one or two sentences when possible.
3. If the answer is NOT in the knowledge base, respond with: "I don't have information about that in our knowledge base."
4. Never guess, infer, or fabricate information.
5. If the question is ambiguous, answer the most likely interpretation and note your assumption.`;

export async function POST(req: NextRequest) {
  const { question, context, model = 'llama-3.1-8b-instant' } = await req.json();

  if (!question?.trim()) {
    return Response.json({ error: 'Question is required' }, { status: 400 });
  }
  if (!context?.trim()) {
    return Response.json({ answer: 'No knowledge base loaded. Add company content in the Prep tab first.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GROQ_API_KEY is not set. Add it to your environment variables.' }, { status: 500 });
  }

  const groq = new Groq({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const completion = await groq.chat.completions.create({
          model,
          stream: true,
          temperature: 0.1,
          max_tokens: 512,
          messages: [
            {
              role: 'system',
              content: `${SYSTEM_PROMPT}\n\n--- COMPANY KNOWLEDGE BASE ---\n${context.slice(0, 120000)}\n--- END ---`,
            },
            { role: 'user', content: question },
          ],
        });

        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content || '';
          if (text) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        const msg = String(err);
        const friendly = msg.includes('401') ? 'Invalid GROQ_API_KEY.' : msg.includes('429') ? 'Rate limit hit. Try again shortly.' : msg;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: friendly })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
