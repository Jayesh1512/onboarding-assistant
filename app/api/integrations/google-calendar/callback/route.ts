import { NextResponse } from 'next/server';
import { upsertIntegration } from '@/lib/integrations/token-store';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code || searchParams.get('error')) {
    return NextResponse.redirect(`${origin}/home?gcal_error=1`);
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/integrations/google-calendar/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await res.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${origin}/home?gcal_error=1`);
  }

  await upsertIntegration('google_calendar', {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    metadata: {},
  });

  return NextResponse.redirect(`${origin}/home?gcal_connected=1`);
}
