import { NextResponse } from 'next/server';
import { deleteIntegration } from '@/lib/integrations/token-store';

export async function DELETE() {
  await deleteIntegration('google_calendar');
  return NextResponse.json({ ok: true });
}
