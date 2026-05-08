'use client';

import Link from 'next/link';

import type { Meeting } from '@/lib/home-types';
import { HOME_BUTTON_3D_SECONDARY } from '@/lib/home-button-styles';

interface Props {
  meetings: Meeting[];
  onSelectMeeting: (meetingId: string) => void;
  onDeleteMeeting: (meetingId: string) => void;
}

function formatDate(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return startsAt;
  return date.toLocaleString();
}

export default function MeetingsList({
  meetings,
  onSelectMeeting,
  onDeleteMeeting,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Meetings</h3>
          <p className="mt-1 text-xs text-slate-500">Sorted by nearest date.</p>
        </div>
      </div>

      {meetings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 text-center">
          No upcoming meetings scheduled.
        </p>
      ) : (
        <ul className="space-y-2">
          {meetings.map((meeting) => {
            return (
              <li
                key={meeting.id}
                className={`rounded-xl border p-3 transition border-slate-200 bg-white hover:border-slate-300`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onSelectMeeting(meeting.id)}
                    className={`${HOME_BUTTON_3D_SECONDARY} text-left px-3 py-2 w-full`}
                  >
                    <p className="text-sm font-semibold text-slate-900">{meeting.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatDate(meeting.startsAt)}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {meeting.participants.length} participants · {meeting.questionIds.length + meeting.customQuestions.length} questions
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteMeeting(meeting.id)}
                    className={`${HOME_BUTTON_3D_SECONDARY} px-2 py-1 text-xs shrink-0`}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
