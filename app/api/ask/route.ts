export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are a precise onboarding assistant helping answer questions during a client onboarding call.

RULES:
1. Answer ONLY using the provided company knowledge base.
2. Be concise and direct — one or two sentences when possible.
3. If the answer is NOT in the knowledge base, say: "I don't have that information in our knowledge base."
4. Never guess, infer, or fabricate information.`;

export async function POST(req: NextRequest) {
  const { question, context, model = 'gemini-2.0-flash' } = await req.json();

  if (!question?.trim()) return Response.json({ error: 'Question is required' }, { status: 400 });
  if (!context?.trim())  return Response.json({ answer: 'No knowledge base loaded. Add company content in the Prep tab first.' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return Response.json({ error: 'GEMINI_API_KEY is not set.' }, { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const gemini = genAI.getGenerativeModel({
          model,
          systemInstruction: `${SYSTEM_PROMPT}\n\n--- COMPANY KNOWLEDGE BASE ---\n${context.slice(0, 120000)}\n--- END ---`,
        });

        const result = await gemini.generateContentStream(question);
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
