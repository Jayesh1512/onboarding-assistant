'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DUMMY_PAST_MEETINGS, CATEGORY_COLORS } from '../page';
import { HOME_BUTTON_3D_SECONDARY } from '@/lib/home-button-styles';

type ActiveTab = 'minutes' | 'qa' | 'transcript';

export default function PastMeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const meeting = DUMMY_PAST_MEETINGS.find((m) => m.id === id);
  const [activeTab, setActiveTab] = useState<ActiveTab>('minutes');

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-slate-900">Meeting not found</p>
        <Link href="/past-meetings" className={`${HOME_BUTTON_3D_SECONDARY} px-4 py-2 text-sm`}>
          ← Back to Past Meetings
        </Link>
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[meeting.category] ?? CATEGORY_COLORS.Default;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Past Meeting</p>
            <h1 className="text-lg font-semibold truncate max-w-sm">{meeting.title}</h1>
          </div>
          <Link href="/past-meetings" className={`${HOME_BUTTON_3D_SECONDARY} inline-block px-4 py-2 text-sm whitespace-nowrap`}>
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-10 space-y-6">

        {/* Meeting info card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-2xl font-semibold text-slate-900">{meeting.title}</h2>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${catColor}`}>
              {meeting.category}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Date</p>
              <p className="text-slate-800 font-medium">{meeting.date}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Time</p>
              <p className="text-slate-800 font-medium">{meeting.time}</p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-2">Attendees</p>
              <div className="flex flex-wrap gap-1.5">
                {meeting.attendees.map((a, i) => (
                  <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Content tabs */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          {/* Tab bar */}
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit mb-6">
            {(['minutes', 'qa', 'transcript'] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2 text-sm font-semibold rounded-lg capitalize transition-all ${
                  activeTab === tab
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'qa' ? 'Q & A' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Minutes */}
          {activeTab === 'minutes' && (
            <ul className="space-y-3">
              {meeting.minutes.map((point, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                  <span className="mt-0.5 w-5 h-5 flex-shrink-0 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[11px] font-bold">
                    {i + 1}
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          )}

          {/* Q&A */}
          {activeTab === 'qa' && (
            <div className="space-y-4">
              {meeting.qa.map((item, i) => (
                <div key={i} className="rounded-xl bg-slate-50 border border-slate-200 p-5">
                  <p className="text-sm font-semibold text-slate-900 mb-3 flex gap-2">
                    <span className="text-orange-500 shrink-0">Q.</span>
                    {item.question}
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed flex gap-2">
                    <span className="font-bold text-slate-500 shrink-0">A.</span>
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Transcript */}
          {activeTab === 'transcript' && (
            <div>
              <p className="text-xs text-slate-500 mb-3">Full conversation transcript</p>
              <div className="bg-slate-900 rounded-xl p-5 font-mono text-xs text-slate-300 leading-7 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {meeting.transcript}
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
