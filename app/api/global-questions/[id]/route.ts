import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const body = await request.json();

  await supabase
    .from('user_global_questions')
    .update({ text: body.text, category: body.category ?? null })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  await supabase.from('user_global_questions').delete().eq('id', id);
  return NextResponse.json({ ok: true });
}
