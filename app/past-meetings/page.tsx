'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HOME_BUTTON_3D_SECONDARY } from '@/lib/home-button-styles';

export interface PastMeeting {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  attendees: string[];
  minutes: string[];
  qa: { question: string; answer: string }[];
  transcript: string;
}

export const DUMMY_PAST_MEETINGS: PastMeeting[] = [
  {
    id: 'pm-1',
    title: 'Q1 Drone Fleet Review',
    category: 'Operations',
    date: 'May 05, 2026',
    time: '10:00 AM',
    attendees: ['Jayesh Shete', 'Anika Verma', 'Tom Langley', 'Soo-Jin Park'],
    minutes: [
      'Reviewed current drone fleet utilization rate — 78% across all active zones.',
      'Discussed the aging of DJI Dock Gen 1 units; 4 units flagged for end-of-life replacement.',
      'Approved procurement of 6 DJI Dock 2 units for the Western region expansion.',
      'SOP update for drone maintenance windows to be drafted by Tom by May 15.',
      'Anika to lead pilot training for two new hires joining in June.',
    ],
    qa: [
      { question: 'What is the expected ROI on the new dock procurement?', answer: 'Estimated 22% increase in delivery coverage leading to ~€45k/month additional revenue based on current pricing models.' },
      { question: 'Are any regulatory approvals pending for Western expansion?', answer: 'Yes — BVLOS permits for 3 new corridors are under review with DGAC. Expected clearance by end of June.' },
      { question: 'What maintenance interval is recommended for the fleet?', answer: 'Full inspection every 150 flight hours, with a motor & battery check at every 50 hours per the updated SOP.' },
    ],
    transcript: `[10:01] Jayesh: Alright, let's get started. Tom, can you pull up the fleet utilization dashboard?\n[10:02] Tom: Sure, so we're looking at 78% across all zones. Eastern is at 89%, Western is at 62%.\n[10:04] Anika: The Western dip is expected — we've had two docks offline for planned maintenance.\n[10:06] Jayesh: Right. And on the topic of older hardware, how many Gen 1 units are we flagging?\n[10:07] Tom: Four units. Two in the Northern corridor, two in the Eastern hub. They're beyond the 2-year operational threshold.\n[10:10] Soo-Jin: I've been in contact with the DJI rep about Dock 2 pricing. We can get a 6-unit bundle at an 8% discount if ordered before June 1.\n[10:12] Jayesh: Let's approve that. Soo-Jin, go ahead and raise the PO. Tom, please have the SOP update ready by the 15th.\n[10:15] Anika: I'll coordinate the June training schedule with HR.\n[10:18] Jayesh: Perfect. Let's wrap up there — I'll share minutes by EOD.`,
  },
  {
    id: 'pm-2',
    title: 'Client Onboarding — Agrico SA',
    category: 'Sales',
    date: 'Apr 28, 2026',
    time: '2:30 PM',
    attendees: ['Jayesh Shete', 'Lucas Bernard', 'Marie Dupont (Agrico)'],
    minutes: [
      'Introduced Agrico SA team to the platform capabilities and dashboard walkthrough.',
      "Discussed Agrico's primary use case: crop monitoring across 3 vineyard estates.",
      'Agreed on a 90-day pilot with 2 drones deployed at Château Miremonde.',
      'Data storage and GDPR compliance requirements reviewed and confirmed met.',
      'Follow-up call scheduled for May 12 to review first 30-day telemetry data.',
    ],
    qa: [
      { question: 'Can the system detect early signs of vine disease?', answer: 'Yes, using multispectral imaging combined with our NDVI analysis layer. Results are typically visible 2–3 weeks earlier than ground-level scouting.' },
      { question: 'What is the data refresh rate during active flights?', answer: 'Real-time telemetry at 1Hz, with processed imagery available in the dashboard within 4 hours of flight completion.' },
      { question: "Is the platform compatible with existing Agrico ERP?", answer: "We support CSV and REST API export. Lucas will connect with Agrico's IT team to confirm integration scope." },
    ],
    transcript: `[14:31] Jayesh: Welcome, Marie. Great to finally have Agrico onboard. Lucas will walk you through the main dashboard.\n[14:32] Lucas: Thanks Jayesh. Marie, let me start with the map view — this is where your drone feeds and flight logs will live.\n[14:38] Marie: This looks excellent. Our main concern is the vine disease detection — is that built in?\n[14:40] Jayesh: Absolutely, and I can show you a sample NDVI analysis from a previous vineyard client if that helps.\n[14:41] Marie: Yes, please.\n[14:48] Jayesh: As you can see, the red zones indicated early-stage Esca disease 18 days before it was physically visible.\n[14:50] Marie: Impressive. We'll want this for Château Miremonde first.\n[14:52] Jayesh: Perfect, we'll kick off the 90-day pilot there. Lucas will set up the credentials this week.`,
  },
  {
    id: 'pm-3',
    title: 'Platform Incident Retrospective',
    category: 'Engineering',
    date: 'Apr 18, 2026',
    time: '11:00 AM',
    attendees: ['Jayesh Shete', 'Dev Team', 'Priya Nair', 'Carlos Mendez'],
    minutes: [
      'Root cause identified: Race condition in the flight scheduler service triggered by concurrent zone unlock events.',
      'Incident duration: 47 minutes of degraded service on April 15, affecting 12 active clients.',
      'Hotfix deployed within 4 hours of detection; no data loss confirmed.',
      'Carlos to lead a full refactor of the scheduler module with proper mutex locking by end of sprint.',
      'Priya to update the incident response playbook and SLA breach notification templates.',
      'Post-mortem report to be published internally by April 22.',
    ],
    qa: [
      { question: 'Were any clients permanently impacted?', answer: 'No. All affected flights were automatically rescheduled and completed within the same operational window. SLA was breached for 3 clients — credits issued.' },
      { question: 'What monitoring was in place that detected the incident?', answer: 'Our Datadog alert fired 11 minutes into the degradation. The alert threshold was updated post-incident from p99 > 5s to p99 > 2s.' },
      { question: 'How do we prevent recurrence?', answer: 'Mutex locking in the scheduler, load testing for concurrent unlock scenarios, and a new chaos engineering test added to the CI pipeline.' },
    ],
    transcript: `[11:01] Jayesh: Let's be direct — what happened on the 15th?\n[11:02] Carlos: Race condition. Two zone unlock events fired simultaneously and the scheduler tried to assign the same drone to both. Classic mutex issue.\n[11:05] Priya: We caught it at 11 minutes in, via Datadog. I've already updated the alert threshold.\n[11:08] Jayesh: Good. Carlos, what's the timeline for the full refactor?\n[11:09] Carlos: One sprint — two weeks. We'll have it under load testing by the 28th.\n[11:12] Jayesh: SLA credits — Priya, handle those?\n[11:13] Priya: Already sent to 3 clients. Templates are being updated to auto-trigger for future incidents.\n[11:18] Jayesh: Good work recovering fast. Let's get the post-mortem published by the 22nd.`,
  },
];

export const CATEGORY_COLORS: Record<string, string> = {
  Operations: 'bg-emerald-100 text-emerald-700',
  Sales: 'bg-blue-100 text-blue-700',
  Engineering: 'bg-violet-100 text-violet-700',
  Default: 'bg-slate-100 text-slate-600',
};

export default function PastMeetingsPage() {
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAttendee, setFilterAttendee] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const allCategories = Array.from(new Set(DUMMY_PAST_MEETINGS.map((m) => m.category)));

  const filtered = DUMMY_PAST_MEETINGS.filter((m) => {
    const matchCategory = !filterCategory || m.category === filterCategory;
    const matchAttendee =
      !filterAttendee ||
      m.attendees.some((a) => a.toLowerCase().includes(filterAttendee.toLowerCase()));
    const matchDate = !filterDate || m.date.toLowerCase().includes(filterDate.toLowerCase());
    return matchCategory && matchAttendee && matchDate;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">History</p>
            <h1 className="text-lg font-semibold">Past Meetings</h1>
          </div>
          <Link href="/home" className={`${HOME_BUTTON_3D_SECONDARY} inline-block px-4 py-2 text-sm`}>
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold tracking-widest text-slate-500">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 shadow-sm"
            >
              <option value="">All categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold tracking-widest text-slate-500">Attendee</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search attendee..."
                value={filterAttendee}
                onChange={(e) => setFilterAttendee(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 shadow-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold tracking-widest text-slate-500">Date</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <input
                type="text"
                placeholder="e.g. Apr, May 2026..."
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {(filterCategory || filterAttendee || filterDate) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filterCategory && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                Category: {filterCategory}
                <button onClick={() => setFilterCategory('')} className="text-orange-500 hover:text-orange-800">✕</button>
              </span>
            )}
            {filterAttendee && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                Attendee: {filterAttendee}
                <button onClick={() => setFilterAttendee('')} className="text-orange-500 hover:text-orange-800">✕</button>
              </span>
            )}
            {filterDate && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                Date: {filterDate}
                <button onClick={() => setFilterDate('')} className="text-orange-500 hover:text-orange-800">✕</button>
              </span>
            )}
          </div>
        )}

        {/* Results */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-medium text-slate-900">No meetings match your filters</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting your search criteria.</p>
            </div>
          ) : (
            filtered.map((meeting) => {
              const catColor = CATEGORY_COLORS[meeting.category] ?? CATEGORY_COLORS.Default;
              return (
                <Link
                  key={meeting.id}
                  href={`/past-meetings/${meeting.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-5 hover:border-orange-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h2 className="text-base font-semibold text-slate-900 group-hover:text-orange-600 transition-colors">{meeting.title}</h2>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${catColor}`}>
                          {meeting.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{meeting.date} · {meeting.time}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {meeting.attendees.map((a, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                    <svg className="text-slate-300 group-hover:text-orange-400 transition-colors mt-1 shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
