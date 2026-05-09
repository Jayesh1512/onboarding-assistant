'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { HOME_BUTTON_3D_SECONDARY } from '@/lib/home-button-styles';
import type { CallListItem } from '@/lib/call-types';

export default function PastMeetingsPage() {
  const [calls, setCalls] = useState<CallListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTitle, setFilterTitle] = useState('');
  const [filterDate, setFilterDate] = useState('');

  useEffect(() => {
    fetch('/api/calls')
      .then((r) => r.json())
      .then(({ calls: data, error: err }) => {
        if (err) setError(err);
        else setCalls(data ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const filtered = calls.filter((c) => {
    const title = c.title ?? 'Untitled meeting';
    const matchTitle = !filterTitle || title.toLowerCase().includes(filterTitle.toLowerCase());
    const matchDate =
      !filterDate || new Date(c.ended_at).toLocaleString().toLowerCase().includes(filterDate.toLowerCase());
    return matchTitle && matchDate;
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
        <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase font-semibold tracking-widest text-slate-500">Title</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by title..."
                value={filterTitle}
                onChange={(e) => setFilterTitle(e.target.value)}
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
                placeholder="e.g. May, 2026..."
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {(filterTitle || filterDate) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {filterTitle && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-medium">
                Title: {filterTitle}
                <button onClick={() => setFilterTitle('')} className="text-orange-500 hover:text-orange-800">✕</button>
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

        {/* States */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-sm font-medium text-red-700">Failed to load calls</p>
            <p className="mt-1 text-xs text-red-500">{error}</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <p className="text-sm font-medium text-slate-900">
                  {calls.length === 0 ? 'No past meetings yet' : 'No meetings match your filters'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {calls.length === 0
                    ? 'Meetings recorded via the live assistant will appear here.'
                    : 'Try adjusting your search criteria.'}
                </p>
              </div>
            ) : (
              filtered.map((call) => {
                const title = call.title ?? 'Untitled meeting';
                const date = new Date(call.ended_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                });
                return (
                  <Link
                    key={call.id}
                    href={`/past-meetings/${call.id}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-5 hover:border-orange-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h2 className="text-base font-semibold text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                            {title}
                          </h2>
                          {call.has_summary && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 shrink-0">
                              Summary
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mb-3">{date}</p>
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            {call.utterance_count} utterances
                          </span>
                          {call.questions_asked_count > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-50 text-[11px] font-medium text-orange-600">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                              {call.questions_asked_count} questions asked
                            </span>
                          )}
                          {call.model && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-500">
                              {call.model}
                            </span>
                          )}
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
        )}
      </main>
    </div>
  );
}
