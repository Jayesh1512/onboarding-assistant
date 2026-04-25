export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import Groq from 'groq-sdk';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioBlob = formData.get('audio') as File | null;
  const speaker = (formData.get('speaker') as string) || 'unknown';

  if (!audioBlob || audioBlob.size < 1000) {
    // Skip tiny/empty chunks
    return Response.json({ text: '', speaker });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: 'GROQ_API_KEY not set' }, { status: 500 });

  try {
    const groq = new Groq({ apiKey });

    // Groq Whisper needs a proper filename with extension
    const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });

    const result = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo', // fastest + free on Groq
      language: 'en',
      response_format: 'json',
    });

    const text = result.text?.trim() ?? '';
    return Response.json({ text, speaker });
  } catch (err) {
    // Don't crash the whole session on a single bad chunk
    console.error('Whisper error:', err);
    return Response.json({ text: '', speaker, error: String(err) });
  }
}
