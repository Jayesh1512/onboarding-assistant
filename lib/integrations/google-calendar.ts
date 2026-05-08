import { upsertIntegration, type IntegrationRow } from './token-store';

const GCAL_API = 'https://www.googleapis.com/calendar/v3';

export interface GCalEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetLink?: string;
  attendees: string[];
}

async function refreshToken(row: IntegrationRow): Promise<string> {
  if (!row.refresh_token) throw new Error('No refresh token — reconnect Google Calendar');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Google token refresh failed');

  await upsertIntegration('google_calendar', {
    access_token: data.access_token,
    refresh_token: row.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    metadata: row.metadata,
  });

  return data.access_token as string;
}

async function gcalFetch(row: IntegrationRow, path: string, init: RequestInit = {}): Promise<Response> {
  const isExpired = row.expires_at && new Date(row.expires_at) < new Date(Date.now() + 60_000);
  const token = isExpired ? await refreshToken(row) : row.access_token;

  const res = await fetch(`${GCAL_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });

  if (res.status === 401 && !isExpired) {
    const newToken = await refreshToken(row);
    return fetch(`${GCAL_API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${newToken}`, 'Content-Type': 'application/json', ...init.headers },
    });
  }

  return res;
}

export async function fetchGCalEvents(row: IntegrationRow, days = 10): Promise<GCalEvent[]> {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86_400_000).toISOString();

  const res = await gcalFetch(
    row,
    `/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=50`,
  );

  if (!res.ok) throw new Error(`GCal fetch failed: ${res.status}`);
  const data = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.items ?? []).map((item: any) => ({
    id: item.id as string,
    title: (item.summary as string) ?? '(No title)',
    startsAt: item.start?.dateTime ?? item.start?.date ?? '',
    endsAt: item.end?.dateTime ?? item.end?.date ?? '',
    meetLink: (item.hangoutLink as string | undefined) ?? item.conferenceData?.entryPoints?.[0]?.uri,
    attendees: (item.attendees ?? []).map((a: { email: string }) => a.email),
  }));
}

export async function createGCalEvent(
  row: IntegrationRow,
  event: { title: string; startsAt: string; meetLink?: string },
): Promise<string> {
  const start = new Date(event.startsAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const body: Record<string, unknown> = {
    summary: event.title,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };

  // If no external meet link, ask Google to generate one
  const path = event.meetLink
    ? '/calendars/primary/events'
    : '/calendars/primary/events?conferenceDataVersion=1';

  if (!event.meetLink) {
    body.conferenceData = { createRequest: { requestId: `meet-${Date.now()}` } };
  }

  const res = await gcalFetch(row, path, { method: 'POST', body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`GCal create failed: ${res.status}`);

  const created = await res.json();
  return created.id as string;
}
