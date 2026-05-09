import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CALLS_TABLE, CALLS_LIST_LIMIT } from '@/lib/constants';
import type { CallListItem, CallRow, Question, SerializableTranscriptEntry } from '@/lib/call-types';

function parseCallRow(row: Record<string, unknown>): CallRow | null {
  const id = row.id;
  const created_at = row.created_at;
  const ended_at = row.ended_at;
  if (typeof id !== 'string' || typeof created_at !== 'string' || typeof ended_at !== 'string') {
    return null;
  }
  const transcript = row.transcript;
  const questions = row.questions;
  if (!Array.isArray(transcript) || !Array.isArray(questions)) {
    return null;
  }
  return {
    id,
    created_at,
    ended_at,
    title: typeof row.title === 'string' ? row.title : null,
    model: typeof row.model === 'string' ? row.model : null,
    transcript: transcript as SerializableTranscriptEntry[],
    questions: questions as Question[],
    summary: typeof row.summary === 'string' ? row.summary : null,
    utterance_count: Number(row.utterance_count ?? 0),
    questions_asked_count: Number(row.questions_asked_count ?? 0),
  };
}

export async function listCallsFromDb(
  supabase: SupabaseClient,
): Promise<{ ok: true; calls: CallListItem[] } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from(SUPABASE_CALLS_TABLE)
    .select('id, created_at, ended_at, title, model, utterance_count, questions_asked_count, summary')
    .order('created_at', { ascending: false })
    .limit(CALLS_LIST_LIMIT);

  if (error) {
    return { ok: false, error: error.message };
  }

  const calls: CallListItem[] = (data ?? []).map((row) => ({
    id: row.id as string,
    created_at: row.created_at as string,
    ended_at: row.ended_at as string,
    title: (row.title as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    utterance_count: Number(row.utterance_count ?? 0),
    questions_asked_count: Number(row.questions_asked_count ?? 0),
    has_summary: Boolean(row.summary && String(row.summary).trim().length > 0),
  }));

  return { ok: true, calls };
}

export async function getCallByIdFromDb(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true; call: CallRow } | { ok: false; error: string; notFound?: boolean }> {
  const { data, error } = await supabase
    .from(SUPABASE_CALLS_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: 'Not found', notFound: true };
  }

  const call = parseCallRow(data as Record<string, unknown>);
  if (!call) {
    return { ok: false, error: 'Malformed row' };
  }

  return { ok: true, call };
}

export async function insertCallRow(
  supabase: SupabaseClient,
  userId: string,
  input: {
    ended_at: string;
    model: string | null;
    transcript: SerializableTranscriptEntry[];
    questions: Question[];
    utterance_count: number;
    questions_asked_count: number;
  },
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from(SUPABASE_CALLS_TABLE)
    .insert({
      user_id: userId,
      ended_at: input.ended_at,
      model: input.model,
      transcript: input.transcript,
      questions: input.questions,
      utterance_count: input.utterance_count,
      questions_asked_count: input.questions_asked_count,
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, id: (data as { id: string }).id };
}

export async function updateCallSummary(
  supabase: SupabaseClient,
  id: string,
  updates: { summary?: string; title?: string },
): Promise<{ ok: true } | { ok: false; error: string; notFound?: boolean }> {
  const { data, error } = await supabase
    .from(SUPABASE_CALLS_TABLE)
    .update(updates)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: 'Not found', notFound: true };
  }

  return { ok: true };
}
