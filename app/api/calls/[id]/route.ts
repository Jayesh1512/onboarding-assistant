import { NextRequest } from 'next/server';
import { getCallByIdFromDb, updateCallSummary } from '@/lib/calls-db';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!id || typeof id !== 'string') {
    return Response.json({ error: 'Invalid id' }, { status: 400 });
  }

  const result = await getCallByIdFromDb(id);
  if (!result.ok) {
    if (result.notFound) {
      return Response.json({ error: result.error }, { status: 404 });
    }
    const status = result.error === 'Supabase is not configured' ? 503 : 500;
    return Response.json({ error: result.error }, { status });
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
  if (typeof summary !== 'string') {
    return Response.json({ error: 'summary must be a string' }, { status: 400 });
  }

  const updated = await updateCallSummary(id, summary);
  if (!updated.ok) {
    if (updated.notFound) {
      return Response.json({ error: updated.error }, { status: 404 });
    }
    const status = updated.error === 'Supabase is not configured' ? 503 : 500;
    return Response.json({ error: updated.error }, { status });
  }

  return Response.json({ ok: true });
}
