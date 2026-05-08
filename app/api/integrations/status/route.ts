import { NextResponse } from 'next/server';
import { getIntegration } from '@/lib/integrations/token-store';

export async function GET() {
  const [gcal, calendly] = await Promise.allSettled([
    getIntegration('google_calendar'),
    getIntegration('calendly'),
  ]);

  return NextResponse.json({
    google_calendar: {
      connected: gcal.status === 'fulfilled' && !!gcal.value,
    },
    calendly: {
      connected: calendly.status === 'fulfilled' && !!calendly.value,
      bookingUrl: calendly.status === 'fulfilled' ? (calendly.value?.metadata?.booking_url ?? null) : null,
    },
  });
}
