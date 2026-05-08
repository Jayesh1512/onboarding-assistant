import { NextResponse } from 'next/server';
import { deleteIntegration } from '@/lib/integrations/token-store';

export async function DELETE() {
  await deleteIntegration('calendly');
  return NextResponse.json({ ok: true });
}
