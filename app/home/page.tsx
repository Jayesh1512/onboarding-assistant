'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect, useRef } from 'react';
import AddMeetingForm from '@/components/home/AddMeetingForm';
import GlobalQuestionBank from '@/components/home/GlobalQuestionBank';
import ScheduledCalendarWindow from '@/components/home/ScheduledCalendarWindow';
import MeetingKnowledgeBase from '@/components/home/MeetingKnowledgeBase';
import { useLocalStorage } from '@/lib/use-local-storage';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Meeting, ExternalEvent } from '@/lib/home-types';
import { HOME_BUTTON_3D_SECONDARY } from '@/lib/home-button-styles';
import { HOME_DASHBOARD_DEFAULT_STATE, HOME_DASHBOARD_STORAGE_KEY } from '@/lib/home-storage';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Suspense } from 'react';

interface IntegrationStatus {
  google_calendar: { connected: boolean };
  calendly: { connected: boolean; bookingUrl: string | null };
}

function HomeContent() {
  const [state, setState, hydrated] = useLocalStorage(HOME_DASHBOARD_STORAGE_KEY, HOME_DASHBOARD_DEFAULT_STATE);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [showLogout, setShowLogout] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    google_calendar: { connected: false },
    calendly: { connected: false, bookingUrl: null },
  });
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const gcalConnectedRef = useRef(false);

  // Fetch current user
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          name: data.user.user_metadata?.full_name ?? data.user.email ?? '',
          email: data.user.email ?? '',
        });
      }
    });
  }, []);

  // Show banners from OAuth callbacks
  useEffect(() => {
    if (searchParams.get('gcal_connected')) {
      setBanner({ type: 'success', msg: 'Google Calendar connected!' });
    } else if (searchParams.get('gcal_error')) {
      setBanner({ type: 'error', msg: 'Failed to connect Google Calendar.' });
    } else if (searchParams.get('calendly_connected')) {
      setBanner({ type: 'success', msg: 'Calendly connected!' });
    } else if (searchParams.get('calendly_error')) {
      setBanner({ type: 'error', msg: 'Failed to connect Calendly.' });
    }
  }, [searchParams]);

  // Fetch integration status + external events
  useEffect(() => {
    fetch('/api/integrations/status')
      .then((r) => r.json())
      .then((status: IntegrationStatus) => {
        setIntegrations(status);
        gcalConnectedRef.current = status.google_calendar.connected;

        // Fetch events from connected providers in parallel
        const fetches: Promise<void>[] = [];

        if (status.google_calendar.connected) {
          fetches.push(
            fetch('/api/integrations/google-calendar/events')
              .then((r) => r.json())
              .then(({ events }) => {
                if (!Array.isArray(events)) return;
                // Merge GCal events as real meetings (deduplicate by gcalId)
                setState((prev) => {
                  const existingGcalIds = new Set(
                    prev.meetings.filter((m) => m.gcalId).map((m) => m.gcalId!),
                  );
                  const incoming = events
                    .filter((e: { id: string }) => !existingGcalIds.has(e.id))
                    .map((e: { id: string; title: string; startsAt: string; attendees: string[]; meetLink?: string }) => ({
                      id: `gcal-${e.id}`,
                      gcalId: e.id,
                      title: e.title,
                      startsAt: e.startsAt,
                      participants: e.attendees ?? [],
                      meetLink: e.meetLink,
                      questionIds: [] as string[],
                      customQuestions: [] as import('@/lib/home-types').MeetingCustomQuestion[],
                      selectedGlobalKbIds: [] as string[],
                      meetingKbEntries: [] as import('@/lib/home-types').KBEntry[],
                    }));
                  if (incoming.length === 0) return prev;
                  return { ...prev, meetings: [...prev.meetings, ...incoming] };
                });
              })
              .catch(console.error),
          );
        }

        if (status.calendly.connected) {
          fetches.push(
            fetch('/api/integrations/calendly/events')
              .then((r) => r.json())
              .then(({ events }) => {
                if (Array.isArray(events)) {
                  setExternalEvents((prev) => [
                    ...prev.filter((e) => e.source !== 'calendly'),
                    ...events.map((e) => ({ ...e, source: 'calendly' as const })),
                  ]);
                }
              })
              .catch(console.error),
          );
        }

        return Promise.all(fetches);
      })
      .catch(console.error);
  }, []);

  async function handleDisconnect(provider: 'google_calendar' | 'calendly') {
    const path = provider === 'google_calendar'
      ? '/api/integrations/google-calendar/disconnect'
      : '/api/integrations/calendly/disconnect';

    await fetch(path, { method: 'DELETE' });
    setIntegrations((prev) => ({
      ...prev,
      [provider]: provider === 'calendly' ? { connected: false, bookingUrl: null } : { connected: false },
    }));
    if (provider === 'google_calendar') gcalConnectedRef.current = false;
    setExternalEvents((prev) => prev.filter((e) => e.source !== provider));
    setBanner({ type: 'success', msg: `${provider === 'google_calendar' ? 'Google Calendar' : 'Calendly'} disconnected.` });
  }

  const meetings = useMemo(() => {
    const now = Date.now();
    return [...state.meetings]
      .filter((m) => new Date(m.startsAt).getTime() >= now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [state.meetings]);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const setMeetings = (next: Meeting[]) => setState({ ...state, meetings: next });

  const addMeeting = async (input: { title: string; startsAt: string; participants: string[]; meetLink?: string; notes?: string }) => {
    const meeting: Meeting = {
      id: `meeting-${Date.now()}`,
      ...input,
      questionIds: [],
      customQuestions: [],
      selectedGlobalKbIds: [],
      meetingKbEntries: [],
    };
    setMeetings([...state.meetings, meeting]);

    // Push to Google Calendar if connected (use ref to avoid stale closure)
    if (gcalConnectedRef.current) {
      fetch('/api/integrations/google-calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: input.title, startsAt: input.startsAt, meetLink: input.meetLink }),
      }).catch(console.error);
    }
  };

  const deleteMeeting = (id: string) => setMeetings(state.meetings.filter((m) => m.id !== id));

  const gcalConnected = integrations.google_calendar.connected;
  const calendlyConnected = integrations.calendly.connected;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Banner */}
      {banner && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg border ${
          banner.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {banner.msg}
          <button className="ml-3 text-xs opacity-60 hover:opacity-100" onClick={() => setBanner(null)}>✕</button>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Meetings dashboard</p>
            <h1 className="text-lg font-semibold">Scheduled Meetings Home</h1>
          </div>
          <div className="flex items-center gap-3 relative">
            <Link
              href="/past-meetings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium transition-colors shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="hidden sm:inline">Past Meetings</span>
            </Link>

            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

            {/* Google Calendar button */}
            {gcalConnected ? (
              <button
                onClick={() => handleDisconnect('google_calendar')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white border-emerald-200 text-slate-800 shadow-sm ring-1 ring-emerald-500/20 text-xs font-medium transition-colors hover:border-red-200 hover:ring-red-200 group"
                title="Disconnect Google Calendar"
              >
                <div className="relative flex items-center justify-center">
                  <GCalIcon />
                  <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white group-hover:bg-red-400" />
                </div>
                <span className="hidden sm:inline">Google Calendar</span>
              </button>
            ) : (
              <a
                href="/api/integrations/google-calendar/connect"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors"
              >
                <GCalIcon />
                <span className="hidden sm:inline">Google Calendar</span>
              </a>
            )}

            {/* Calendly button */}
            {calendlyConnected ? (
              <button
                onClick={() => handleDisconnect('calendly')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-white border-blue-200 text-slate-800 shadow-sm ring-1 ring-blue-500/20 text-xs font-medium transition-colors hover:border-red-200 hover:ring-red-200 group"
                title="Disconnect Calendly"
              >
                <div className="relative flex items-center justify-center">
                  <CalendlyIcon />
                  <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-white group-hover:bg-red-400" />
                </div>
                <span className="hidden sm:inline">Calendly</span>
              </button>
            ) : (
              <a
                href="/api/integrations/calendly/connect"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors"
              >
                <CalendlyIcon />
                <span className="hidden sm:inline">Calendly</span>
              </a>
            )}

            <div className="w-px h-6 bg-slate-200 mx-1" />

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowLogout(!showLogout)}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
                title="Account"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </button>

              {showLogout && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLogout(false)} />
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50">
                    <div className="px-4 py-2 border-b border-slate-100 mb-1">
                      <p className="text-sm font-medium text-slate-900">{user?.name ?? '—'}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email ?? '—'}</p>
                    </div>
                    {calendlyConnected && integrations.calendly.bookingUrl && (
                      <a
                        href={integrations.calendly.bookingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 transition-colors"
                        onClick={() => setShowLogout(false)}
                      >
                        <CalendlyIcon />
                        My Calendly link
                      </a>
                    )}
                    <button
                      onClick={async () => {
                        const supabase = createSupabaseBrowserClient();
                        await supabase.auth.signOut();
                        window.location.href = '/login';
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
            Manage scheduled meetings and reusable questions.
          </h2>
          <p className="mt-3 max-w-3xl text-sm text-slate-600">
            Flow includes meetings dashboard, add meeting, global question bank, and per-meeting question management.
          </p>
        </section>

        <section>
          <ScheduledCalendarWindow
            meetings={meetings}
            externalEvents={externalEvents}
            onSelectMeeting={(id) => router.push(`/meeting/${id}`)}
            onAddMeeting={addMeeting}
            onDeleteMeeting={deleteMeeting}
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="space-y-4">
            <MeetingKnowledgeBase />
            <AddMeetingForm onAddMeeting={addMeeting} />
          </div>
          <div className="h-full">
            <GlobalQuestionBank />
          </div>
        </section>
      </main>
    </div>
  );
}

function GCalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16 2V6" stroke="#34A853" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8 2V6" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 10H21" stroke="#FBBC04" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 14H14V18H10V14Z" fill="#4285F4"/>
    </svg>
  );
}

function CalendlyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#006BFF" strokeWidth="2"/>
      <path d="M14.5 12C14.5 13.3807 13.3807 14.5 12 14.5C10.6193 14.5 9.5 13.3807 9.5 12C9.5 10.6193 10.6193 9.5 12 9.5" stroke="#006BFF" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

export default function HomePackagingPage() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
