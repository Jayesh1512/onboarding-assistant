import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('user_global_kb')
    .select('*')
    .order('added_at', { ascending: true });

  if (error) return NextResponse.json({ entries: [] });
  return NextResponse.json({
    entries: (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      content: r.content,
      type: r.type,
      addedAt: r.added_at,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { error } = await supabase.from('user_global_kb').insert({
    id: body.id,
    user_id: user.id,
    label: body.label,
    content: body.content,
    type: body.type ?? 'text',
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
