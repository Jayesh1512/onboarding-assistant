import { NextRequest } from 'next/server';
import { insertCallRow, listCallsFromDb } from '@/lib/calls-db';
import type { Question, SerializableTranscriptEntry } from '@/lib/call-types';

function isTranscriptEntry(x: unknown): x is SerializableTranscriptEntry {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    (o.speaker === 'you' || o.speaker === 'client') &&
    typeof o.text === 'string' &&
    typeof o.isQuestion === 'boolean'
  );
}

function isQuestion(x: unknown): x is Question {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.text === 'string' &&
    typeof o.asked === 'boolean' &&
    typeof o.notes === 'string'
  );
}

export async function GET() {
  const result = await listCallsFromDb();
  if (!result.ok) {
    const status = result.error === 'Supabase is not configured' ? 503 : 500;
    return Response.json({ error: result.error, calls: [] }, { status });
  }
  return Response.json({ calls: result.calls });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Expected JSON object' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const transcriptRaw = b.transcript;
  const questionsRaw = b.questions;
  const model = typeof b.model === 'string' ? b.model : null;
  const endedAt = typeof b.ended_at === 'string' ? b.ended_at : new Date().toISOString();

  if (!Array.isArray(transcriptRaw) || !transcriptRaw.every(isTranscriptEntry)) {
    return Response.json({ error: 'Invalid transcript array' }, { status: 400 });
  }
  if (!Array.isArray(questionsRaw) || !questionsRaw.every(isQuestion)) {
    return Response.json({ error: 'Invalid questions array' }, { status: 400 });
  }

  const transcript = transcriptRaw as SerializableTranscriptEntry[];
  const questions = questionsRaw as Question[];
  const utterance_count = transcript.length;
  const questions_asked_count = questions.filter((q) => q.asked).length;

  const inserted = await insertCallRow({
    ended_at: endedAt,
    model,
    transcript,
    questions,
    utterance_count,
    questions_asked_count,
  });

  if (!inserted.ok) {
    const status = inserted.error === 'Supabase is not configured' ? 503 : 500;
    console.error('Supabase insert call:', inserted.error);
    return Response.json({ error: inserted.error }, { status });
  }

  return Response.json({ id: inserted.id });
}
