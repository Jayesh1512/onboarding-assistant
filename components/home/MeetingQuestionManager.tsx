'use client';

import { useState } from 'react';
import type { GlobalQuestion, Meeting } from '@/lib/home-types';
import {
  HOME_BUTTON_3D_PRIMARY,
  HOME_BUTTON_3D_SECONDARY,
} from '@/lib/home-button-styles';

interface Props {
  meeting: Meeting | null;
  globalQuestions: GlobalQuestion[];
  onToggleGlobalQuestion: (meetingId: string, questionId: string) => void;
  onAddCustomQuestion: (meetingId: string, text: string) => void;
  onRemoveCustomQuestion: (meetingId: string, customQuestionId: string) => void;
}

export default function MeetingQuestionManager({
  meeting,
  globalQuestions,
  onToggleGlobalQuestion,
  onAddCustomQuestion,
  onRemoveCustomQuestion,
}: Props) {
  const [customText, setCustomText] = useState('');

  if (!meeting) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Meeting question manager</h3>
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
          Select a meeting to manage its questions.
        </p>
      </section>
    );
  }

  const addCustom = () => {
    const trimmed = customText.trim();
    if (!trimmed) return;
    onAddCustomQuestion(meeting.id, trimmed);
    setCustomText('');
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="text-base font-semibold text-slate-900">Meeting questions · {meeting.title}</h3>
      <p className="mt-1 text-xs text-slate-500">
        Toggle global questions for this meeting, plus add custom questions.
      </p>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Global bank mapping</p>
        {globalQuestions.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No global questions available.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {globalQuestions.map((question) => {
              const selected = meeting.questionIds.includes(question.id);
              return (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => onToggleGlobalQuestion(meeting.id, question.id)}
                    className={`w-full text-left px-3 py-2 text-sm ${
                      selected
                        ? HOME_BUTTON_3D_PRIMARY
                        : HOME_BUTTON_3D_SECONDARY
                    }`}
                  >
                    {question.text}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Meeting-specific custom questions</p>
        <div className="mt-3 flex gap-2">
          <input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Add a custom question for this meeting"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400"
          />
          <button
            type="button"
            onClick={addCustom}
            className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-2 text-sm`}
          >
            Add
          </button>
        </div>

        {meeting.customQuestions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No custom meeting questions yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {meeting.customQuestions.map((question) => (
              <li key={question.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-sm text-slate-700">{question.text}</p>
                <button
                  type="button"
                  onClick={() => onRemoveCustomQuestion(meeting.id, question.id)}
                  className={`${HOME_BUTTON_3D_SECONDARY} px-2 py-1 text-xs`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
