import { NextResponse } from 'next/server';
import { getIntegration } from '@/lib/integrations/token-store';
import { fetchCalendlyEvents } from '@/lib/integrations/calendly';

export async function GET() {
  const row = await getIntegration('calendly');
  if (!row) return NextResponse.json({ events: [] });

  try {
    const events = await fetchCalendlyEvents(row);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('Calendly fetch error:', err);
    return NextResponse.json({ events: [] });
  }
}
