import { upsertIntegration, type IntegrationRow } from './token-store';

const CALENDLY_API = 'https://api.calendly.com';

export interface CalendlyEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetLink?: string;
  attendees: string[];
}

async function refreshToken(row: IntegrationRow): Promise<string> {
  if (!row.refresh_token) throw new Error('No refresh token — reconnect Calendly');

  const credentials = Buffer.from(
    `${process.env.CALENDLY_CLIENT_ID}:${process.env.CALENDLY_CLIENT_SECRET}`,
  ).toString('base64');

  const res = await fetch('https://auth.calendly.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Calendly token refresh failed');

  await upsertIntegration('calendly', {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? row.refresh_token,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
    metadata: row.metadata,
  });

  return data.access_token as string;
}

async function calendlyFetch(row: IntegrationRow, path: string): Promise<Response> {
  const isExpired = row.expires_at && new Date(row.expires_at) < new Date(Date.now() + 60_000);
  const token = isExpired ? await refreshToken(row) : row.access_token;

  const res = await fetch(`${CALENDLY_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401 && !isExpired) {
    const newToken = await refreshToken(row);
    return fetch(`${CALENDLY_API}${path}`, { headers: { Authorization: `Bearer ${newToken}` } });
  }

  return res;
}

export async function fetchCalendlyEvents(row: IntegrationRow, days = 10): Promise<CalendlyEvent[]> {
  const userUri = row.metadata.user_uri;
  if (!userUri) throw new Error('No Calendly user URI stored');

  const minTime = new Date().toISOString();
  const maxTime = new Date(Date.now() + days * 86_400_000).toISOString();

  const res = await calendlyFetch(
    row,
    `/scheduled_events?user=${encodeURIComponent(userUri)}&min_start_time=${encodeURIComponent(minTime)}&max_start_time=${encodeURIComponent(maxTime)}&count=50&status=active`,
  );

  if (!res.ok) throw new Error(`Calendly fetch failed: ${res.status}`);
  const data = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.collection ?? []).map((item: any) => ({
    id: (item.uri as string).split('/').pop() ?? '',
    title: (item.name as string) ?? 'Calendly Meeting',
    startsAt: item.start_time as string,
    endsAt: item.end_time as string,
    meetLink: item.location?.join_url as string | undefined,
    attendees: [],
  }));
}
