import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const params = new URLSearchParams({
    client_id: process.env.CALENDLY_CLIENT_ID!,
    redirect_uri: `${origin}/api/integrations/calendly/callback`,
    response_type: 'code',
  });

  return NextResponse.redirect(`https://auth.calendly.com/oauth/authorize?${params}`);
}
