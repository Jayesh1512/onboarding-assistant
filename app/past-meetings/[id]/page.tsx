'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { HOME_BUTTON_3D_SECONDARY } from '@/lib/home-button-styles';
import type { CallRow } from '@/lib/call-types';

type ActiveTab = 'summary' | 'qa' | 'transcript';

export default function PastMeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [call, setCall] = useState<CallRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('summary');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/calls/${id}`)
      .then((r) => r.json())
      .then(({ call: data, error: err }) => {
        if (err) setError(err);
        else setCall(data ?? null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !call) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold text-slate-900">{error ?? 'Meeting not found'}</p>
        <Link href="/past-meetings" className={`${HOME_BUTTON_3D_SECONDARY} px-4 py-2 text-sm`}>
          ← Back to Past Meetings
        </Link>
      </div>
    );
  }

  const title = call.title ?? 'Untitled meeting';
  const date = new Date(call.ended_at).toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' });
  const hasSummary = Boolean(call.summary?.trim());
  const askedQuestions = call.questions.filter((q) => q.asked);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Past Meeting</p>
            <h1 className="text-lg font-semibold truncate max-w-sm">{title}</h1>
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
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
            {hasSummary && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                Summary
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Date</p>
              <p className="text-slate-800 font-medium">{date}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Utterances</p>
              <p className="text-slate-800 font-medium">{call.utterance_count}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Questions Asked</p>
              <p className="text-slate-800 font-medium">{call.questions_asked_count}</p>
            </div>
            {call.model && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 mb-1">Model</p>
                <p className="text-slate-800 font-medium">{call.model}</p>
              </div>
            )}
          </div>
        </section>

        {/* Content tabs */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit mb-6">
            {(['summary', 'qa', 'transcript'] as ActiveTab[]).map((tab) => (
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

          {/* Summary */}
          {activeTab === 'summary' && (
            <div>
              {call.summary ? (
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {call.summary}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-sm font-medium text-slate-500">No summary available</p>
                  <p className="mt-1 text-xs text-slate-400">A summary is generated at the end of a live call.</p>
                </div>
              )}
            </div>
          )}

          {/* Q&A */}
          {activeTab === 'qa' && (
            <div className="space-y-4">
              {askedQuestions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-sm font-medium text-slate-500">No questions were asked in this meeting</p>
                </div>
              ) : (
                askedQuestions.map((q, i) => (
                  <div key={q.id ?? i} className="rounded-xl bg-slate-50 border border-slate-200 p-5">
                    <p className="text-sm font-semibold text-slate-900 mb-3 flex gap-2">
                      <span className="text-orange-500 shrink-0">Q.</span>
                      {q.text}
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed flex gap-2">
                      <span className="font-bold text-slate-500 shrink-0">A.</span>
                      {q.clientAnswer?.trim() || <span className="italic text-slate-400">Answer not captured</span>}
                    </p>
                    {q.notes?.trim() && (
                      <p className="mt-2 text-xs text-slate-400 italic pl-4 border-l-2 border-slate-200">
                        Note: {q.notes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Transcript */}
          {activeTab === 'transcript' && (
            <div>
              {call.transcript.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
                  <p className="text-sm font-medium text-slate-500">No transcript available</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {call.transcript.map((entry, i) => {
                    const isYou = entry.speaker === 'you';
                    return (
                      <div key={entry.id ?? i} className={`flex gap-2 ${isYou ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            isYou
                              ? 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                              : entry.isQuestion
                              ? 'bg-amber-50 border border-amber-200 text-amber-900'
                              : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                          }`}
                        >
                          <p className={`text-[10px] font-semibold uppercase mb-1 ${
                            isYou ? 'text-indigo-400' : entry.isQuestion ? 'text-amber-500' : 'text-emerald-500'
                          }`}>
                            {isYou ? 'You' : entry.isQuestion ? 'Client (question)' : 'Client'}
                          </p>
                          <p>{entry.text}</p>
                          {entry.aiAnswer && (
                            <div className="mt-2 pt-2 border-t border-current/20">
                              <p className="text-[10px] font-semibold uppercase mb-1 opacity-60">AI Answer</p>
                              <p className="opacity-80">{entry.aiAnswer}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
