import { NextResponse } from 'next/server';
import { getIntegration } from '@/lib/integrations/token-store';
import { fetchGCalEvents, createGCalEvent } from '@/lib/integrations/google-calendar';

export async function GET() {
  const row = await getIntegration('google_calendar');
  if (!row) return NextResponse.json({ events: [] });

  try {
    const events = await fetchGCalEvents(row);
    return NextResponse.json({ events });
  } catch (err) {
    console.error('GCal fetch error:', err);
    return NextResponse.json({ events: [] });
  }
}

export async function POST(request: Request) {
  const row = await getIntegration('google_calendar');
  if (!row) return NextResponse.json({ error: 'Not connected' }, { status: 400 });

  const body = await request.json();
  try {
    const id = await createGCalEvent(row, body);
    return NextResponse.json({ id });
  } catch (err) {
    console.error('GCal create error:', err);
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
