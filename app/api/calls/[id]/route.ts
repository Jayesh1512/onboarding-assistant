import { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCallByIdFromDb, updateCallSummary } from '@/lib/calls-db';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id || typeof id !== 'string') {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const result = await getCallByIdFromDb(supabase, id);
  if (!result.ok) {
    if (result.notFound) return Response.json({ error: result.error }, { status: 404 });
    return Response.json({ error: result.error }, { status: 500 });
  }

  return Response.json({ call: result.call });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id || typeof id !== 'string') {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return Response.json({ error: 'Expected JSON object' }, { status: 400 });
  }

  const summary = (body as Record<string, unknown>).summary;
  const title = (body as Record<string, unknown>).title;
  if (summary !== undefined && typeof summary !== 'string') {
    return Response.json({ error: 'summary must be a string when provided' }, { status: 400 });
  }
  if (title !== undefined && typeof title !== 'string') {
    return Response.json({ error: 'title must be a string when provided' }, { status: 400 });
  }
  if (summary === undefined && title === undefined) {
    return Response.json({ error: 'Provide summary and/or title' }, { status: 400 });
  }

  const updated = await updateCallSummary(supabase, id, {
    ...(summary !== undefined ? { summary } : {}),
    ...(title !== undefined ? { title } : {}),
  });

  if (!updated.ok) {
    if (updated.notFound) return Response.json({ error: updated.error }, { status: 404 });
    return Response.json({ error: updated.error }, { status: 500 });
  }

  return Response.json({ ok: true });
}
