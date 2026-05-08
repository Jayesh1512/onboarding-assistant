import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('user_global_questions')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ questions: [] });
  return NextResponse.json({
    questions: (data ?? []).map((r) => ({
      id: r.id,
      text: r.text,
      category: r.category ?? undefined,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { error } = await supabase.from('user_global_questions').insert({
    id: body.id,
    user_id: user.id,
    text: body.text,
    category: body.category ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
