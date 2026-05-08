import { NextResponse } from 'next/server';
import { upsertIntegration } from '@/lib/integrations/token-store';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code || searchParams.get('error')) {
    return NextResponse.redirect(`${origin}/home?calendly_error=1`);
  }

  const credentials = Buffer.from(
    `${process.env.CALENDLY_CLIENT_ID}:${process.env.CALENDLY_CLIENT_SECRET}`,
  ).toString('base64');

  const tokenRes = await fetch('https://auth.calendly.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      redirect_uri: `${origin}/api/integrations/calendly/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${origin}/home?calendly_error=1`);
  }

  // Fetch user info to get URI + scheduling URL
  const userRes = await fetch('https://api.calendly.com/users/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userData = await userRes.json();
  const userUri = (userData.resource?.uri as string) ?? '';
  const bookingUrl = (userData.resource?.scheduling_url as string) ?? '';

  await upsertIntegration('calendly', {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
    metadata: { user_uri: userUri, booking_url: bookingUrl },
  });

  return NextResponse.redirect(`${origin}/home?calendly_connected=1`);
}
