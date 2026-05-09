'use client';

import { use, useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useLocalStorage } from '@/lib/use-local-storage';
import LiveCall from '@/components/LiveCall';
import type { Question } from '@/components/QuestionChecklist';
import type { KBEntry, GlobalQuestion } from '@/lib/home-types';
import { HOME_DASHBOARD_DEFAULT_STATE, HOME_DASHBOARD_STORAGE_KEY } from '@/lib/home-storage';

export default function MeetingLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, , hydrated] = useLocalStorage(HOME_DASHBOARD_STORAGE_KEY, HOME_DASHBOARD_DEFAULT_STATE);

  const [globalKbEntries, setGlobalKbEntries] = useState<KBEntry[]>([]);
  const [globalQuestions, setGlobalQuestions] = useState<GlobalQuestion[]>([]);
  const [kbLoaded, setKbLoaded] = useState(false);
  const [questionsApiLoaded, setQuestionsApiLoaded] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);

  // Fetch both API sources in parallel; track completion separately
  useEffect(() => {
    fetch('/api/global-kb')
      .then((r) => r.json())
      .then(({ entries }) => { setGlobalKbEntries(entries ?? []); setKbLoaded(true); })
      .catch(() => setKbLoaded(true));

    fetch('/api/global-questions')
      .then((r) => r.json())
      .then(({ questions: q }) => { setGlobalQuestions(q ?? []); setQuestionsApiLoaded(true); })
      .catch(() => setQuestionsApiLoaded(true));
  }, []);

  const meeting = useMemo(
    () => (hydrated ? state.meetings.find((m) => m.id === id) : undefined),
    [hydrated, state.meetings, id],
  );

  // Build question list only after both API calls complete and meeting is known.
  // All global questions from DB are included + meeting-specific custom questions.
  useEffect(() => {
    if (!meeting || !hydrated || !questionsApiLoaded) return;
    const globalQs = globalQuestions.map(
      (q): Question => ({ id: q.id, text: q.text, asked: false, notes: q.category ?? '' }),
    );
    const customQs = meeting.customQuestions.map(
      (q): Question => ({ id: q.id, text: q.text, asked: false, notes: '' }),
    );
    setQuestions([...globalQs, ...customQs]);
  }, [meeting, globalQuestions, hydrated, questionsApiLoaded]);

  const context = useMemo(() => {
    if (!meeting || !kbLoaded) return '';
    const selectedGlobal = globalKbEntries.filter((e) =>
      (meeting.selectedGlobalKbIds ?? []).includes(e.id),
    );
    const meetingSpecific = meeting.meetingKbEntries ?? [];
    return [...selectedGlobal, ...meetingSpecific]
      .map((e) => `[Source: ${e.label}]\n${e.content}`)
      .join('\n\n---\n\n');
  }, [meeting, globalKbEntries, kbLoaded]);

  const toggleQuestion = useCallback(
    (qid: string) => setQuestions((p) => p.map((q) => q.id === qid ? { ...q, asked: !q.asked } : q)),
    [],
  );
  const answerQuestion = useCallback(
    (qid: string, answer: string) => setQuestions((p) => p.map((q) => q.id === qid ? { ...q, clientAnswer: answer } : q)),
    [],
  );

  const ready = hydrated && kbLoaded && questionsApiLoaded;

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <p className="text-slate-500 text-sm">Meeting not found.</p>
        <Link href="/home" className="text-orange-500 hover:underline text-sm">← Back to dashboard</Link>
      </div>
    );
  }

  const kbSourceCount = (meeting.selectedGlobalKbIds?.length ?? 0) + (meeting.meetingKbEntries?.length ?? 0);
  const pendingCount = questions.filter((q) => !q.asked).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">

      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Live Call</p>
              <h1 className="text-sm font-semibold text-slate-900 leading-tight">{meeting.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-medium ${kbSourceCount > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${kbSourceCount > 0 ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              {kbSourceCount > 0 ? `${kbSourceCount} KB source${kbSourceCount !== 1 ? 's' : ''}` : 'No KB'}
            </span>
            {questions.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-orange-200 bg-orange-50 text-orange-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                {pendingCount} question{pendingCount !== 1 ? 's' : ''} left
              </span>
            )}
            {meeting.meetLink && (
              <a
                href={meeting.meetLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors font-medium shadow-sm"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                Open Meet
              </a>
            )}
            <Link
              href={`/meeting/${id}`}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors font-medium shadow-sm"
            >
              ← Prepare
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-6">
        <div className="mx-auto w-full max-w-7xl">
          {ready ? (
            <LiveCall
              questions={questions}
              context={context}
              onToggleQuestion={toggleQuestion}
              onAnswerQuestion={answerQuestion}
              prepareHref={`/meeting/${id}`}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400">Loading knowledge base and questions…</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
