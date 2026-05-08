'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocalStorage } from '@/lib/use-local-storage';
import MeetingQuestionManager from '@/components/home/MeetingQuestionManager';
import MeetingLocalKnowledgeBase from '@/components/home/MeetingLocalKnowledgeBase';
import type { KBEntry, GlobalQuestion } from '@/lib/home-types';
import {
  HOME_DASHBOARD_DEFAULT_STATE,
  HOME_DASHBOARD_STORAGE_KEY,
} from '@/lib/home-storage';
import { HOME_BUTTON_3D_SECONDARY, HOME_BUTTON_3D_PRIMARY } from '@/lib/home-button-styles';

export default function MeetingPreparePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const [state, setState, hydrated] = useLocalStorage(
    HOME_DASHBOARD_STORAGE_KEY,
    HOME_DASHBOARD_DEFAULT_STATE,
  );

  const [globalKbEntries, setGlobalKbEntries] = useState<KBEntry[]>([]);
  const [globalQuestions, setGlobalQuestions] = useState<GlobalQuestion[]>([]);

  useEffect(() => {
    fetch('/api/global-kb')
      .then((r) => r.json())
      .then(({ entries }) => setGlobalKbEntries(entries ?? []))
      .catch(console.error);

    fetch('/api/global-questions')
      .then((r) => r.json())
      .then(({ questions }) => setGlobalQuestions(questions ?? []))
      .catch(console.error);
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const meeting = state.meetings.find((m) => m.id === id);

  if (!meeting) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <h1 className="text-xl font-semibold mb-4 text-slate-900">Meeting not found</h1>
        <button onClick={() => router.back()} className={HOME_BUTTON_3D_SECONDARY + " px-4 py-2"}>
          Go back
        </button>
      </div>
    );
  }

  const toggleKbEntry = (entryId: string) => {
    const nextMeetings = state.meetings.map((m) => {
      if (m.id !== id) return m;
      const current = m.selectedGlobalKbIds ?? [];
      const next = current.includes(entryId)
        ? current.filter((x) => x !== entryId)
        : [...current, entryId];
      return { ...m, selectedGlobalKbIds: next };
    });
    setState({ ...state, meetings: nextMeetings });
  };

  const addMeetingKbEntry = (entry: KBEntry) => {
    const nextMeetings = state.meetings.map((m) => {
      if (m.id !== id) return m;
      return { ...m, meetingKbEntries: [...(m.meetingKbEntries ?? []), entry] };
    });
    setState({ ...state, meetings: nextMeetings });
  };

  const removeMeetingKbEntry = (entryId: string) => {
    const nextMeetings = state.meetings.map((m) => {
      if (m.id !== id) return m;
      return { ...m, meetingKbEntries: (m.meetingKbEntries ?? []).filter(e => e.id !== entryId) };
    });
    setState({ ...state, meetings: nextMeetings });
  };

  const toggleMeetingGlobalQuestion = (meetingId: string, questionId: string) => {
    const nextMeetings = state.meetings.map((m) => {
      if (m.id !== meetingId) return m;
      const exists = m.questionIds.includes(questionId);
      return {
        ...m,
        questionIds: exists
          ? m.questionIds.filter((qid) => qid !== questionId)
          : [...m.questionIds, questionId],
      };
    });
    setState({ ...state, meetings: nextMeetings });
  };

  const addMeetingCustomQuestion = (meetingId: string, text: string) => {
    const nextMeetings = state.meetings.map((m) => {
      if (m.id !== meetingId) return m;
      return {
        ...m,
        customQuestions: [
          ...m.customQuestions,
          { id: `cq-${Date.now()}`, text },
        ],
      };
    });
    setState({ ...state, meetings: nextMeetings });
  };

  const removeMeetingCustomQuestion = (meetingId: string, customQuestionId: string) => {
    const nextMeetings = state.meetings.map((m) => {
      if (m.id !== meetingId) return m;
      return {
        ...m,
        customQuestions: m.customQuestions.filter((q) => q.id !== customQuestionId),
      };
    });
    setState({ ...state, meetings: nextMeetings });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Prepare for Meeting</p>
            <h1 className="text-lg font-semibold">{meeting.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/home" className={`${HOME_BUTTON_3D_SECONDARY} inline-block px-4 py-2 text-sm`}>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 py-10 space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
           <div className="flex items-center justify-between mb-4">
             <h2 className="text-xl font-semibold text-slate-900">Meeting Details</h2>
             <a
               href={`/meeting/${id}/live`}
               target="_blank"
               rel="noreferrer"
               onClick={() => { if (meeting.meetLink) window.open(meeting.meetLink, '_blank'); }}
               className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-2 text-sm inline-flex items-center`}
             >
               Join Meeting
             </a>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
             <div>
               <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Time</p>
               <p className="text-sm font-medium text-slate-800">{new Date(meeting.startsAt).toLocaleString()}</p>
             </div>

             {meeting.participants.length > 0 && (
               <div>
                 <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Participants</p>
                 <p className="text-sm font-medium text-slate-800">{meeting.participants.join(', ')}</p>
               </div>
             )}

             {meeting.meetLink && (
               <div>
                 <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Link</p>
                 <a href={meeting.meetLink} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
                   {meeting.meetLink}
                 </a>
               </div>
             )}
           </div>

           {meeting.notes && (
             <div className="mt-4 border-t border-slate-100 pt-4">
               <p className="text-xs text-slate-500 uppercase font-semibold mb-2">Notes</p>
               <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-xl border border-slate-200">
                 {meeting.notes}
               </div>
             </div>
           )}
        </section>

        <MeetingLocalKnowledgeBase
          globalEntries={globalKbEntries}
          selectedGlobalKbIds={meeting.selectedGlobalKbIds ?? []}
          meetingEntries={meeting.meetingKbEntries ?? []}
          onToggleKbEntry={toggleKbEntry}
          onAddMeetingEntry={addMeetingKbEntry}
          onRemoveMeetingEntry={removeMeetingKbEntry}
        />

        <div>
          <MeetingQuestionManager
            meeting={meeting}
            globalQuestions={globalQuestions}
            onToggleGlobalQuestion={toggleMeetingGlobalQuestion}
            onAddCustomQuestion={addMeetingCustomQuestion}
            onRemoveCustomQuestion={removeMeetingCustomQuestion}
          />
        </div>
      </main>
    </div>
  );
}
