import { NextResponse } from 'next/server';

const SCOPES = 'https://www.googleapis.com/auth/calendar';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${origin}/api/integrations/google-calendar/callback`,
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
