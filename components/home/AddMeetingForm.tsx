'use client';

import { useState } from 'react';
import { HOME_BUTTON_3D_PRIMARY } from '@/lib/home-button-styles';

interface AddMeetingInput {
  title: string;
  startsAt: string;
  participants: string[];
  meetLink?: string;
  notes?: string;
}

interface Props {
  onAddMeeting: (meeting: AddMeetingInput) => void;
}

export default function AddMeetingForm({ onAddMeeting }: Props) {
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [participantsInput, setParticipantsInput] = useState('');
  const [meetLink, setMeetLink] = useState('');
  const [notes, setNotes] = useState('');

  const reset = () => {
    setTitle('');
    setStartsAt('');
    setParticipantsInput('');
    setMeetLink('');
    setNotes('');
  };

  const submit = () => {
    const trimmedTitle = title.trim();
    const trimmedStartsAt = startsAt.trim();
    if (!trimmedTitle || !trimmedStartsAt) return;

    const participants = participantsInput
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    onAddMeeting({
      title: trimmedTitle,
      startsAt: trimmedStartsAt,
      participants,
      meetLink: meetLink.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    reset();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">Add meeting</h3>
      <p className="mt-1 text-xs text-slate-500">Schedule a meeting and add to calender</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Meeting title"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400"
        />
        <input
          type="datetime-local"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400"
        />
        <input
          value={participantsInput}
          onChange={(e) => setParticipantsInput(e.target.value)}
          placeholder="Participants (comma separated)"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 md:col-span-2"
        />
        <input
          value={meetLink}
          onChange={(e) => setMeetLink(e.target.value)}
          placeholder="Meeting link (optional)"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 md:col-span-2"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={3}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 md:col-span-2"
        />
      </div>
      <div className="mt-4">
        <button
          type="button"
          onClick={submit}
          className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-2 text-sm`}
        >
          Add scheduled meeting
        </button>
      </div>
    </section>
  );
}
