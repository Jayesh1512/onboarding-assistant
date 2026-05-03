'use client';

import { useState } from 'react';
import type { CallRow } from '@/lib/call-types';
import { MarkdownLine } from './MarkdownLine';

interface Props {
  call: CallRow;
}

export default function CallHistoryDetail({ call }: Props) {
  const [activeTab, setActiveTab] = useState<'summary' | 'qa' | 'transcript'>('summary');
  const askedQs = call.questions.filter((q) => q.asked);
  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'summary', label: '📋 Summary' },
    { id: 'qa', label: `❓ Q&A (${askedQs.length})` },
    { id: 'transcript', label: `📝 Transcript (${call.transcript.length})` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 border-b border-slate-800">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-1">
          {!call.summary?.trim() ? (
            <p className="text-sm text-slate-500 py-4">
              No AI summary was stored for this call. Open the meeting summary after a call to generate one, or Supabase may not have been configured when this call was saved.
            </p>
          ) : (
            call.summary.split('\n').map((line, i) => <MarkdownLine key={i} line={line} />)
          )}
        </div>
      )}

      {activeTab === 'qa' && (
        <div className="space-y-4">
          {askedQs.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No prepared questions were marked as asked.</p>
          ) : (
            askedQs.map((q) => (
              <div key={q.id} className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
                <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-700">
                  <p className="text-sm font-medium text-slate-200">❓ {q.text}</p>
                </div>
                <div className="px-4 py-3">
                  {q.clientAnswer ? (
                    <p className="text-sm text-emerald-300 leading-relaxed">{q.clientAnswer}</p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">Client answer not captured</p>
                  )}
                  {q.notes ? (
                    <p className="text-xs text-slate-500 mt-2 border-t border-slate-700 pt-2">Note: {q.notes}</p>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {call.questions.filter((q) => !q.asked).length > 0 && (
            <div className="mt-6 pt-4 border-t border-slate-800">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Questions not asked</p>
              {call.questions
                .filter((q) => !q.asked)
                .map((q) => (
                  <p key={q.id} className="text-sm text-slate-600 py-1 line-through">
                    {q.text}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'transcript' && (
        <div className="space-y-3">
          {call.transcript.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No transcript lines stored.</p>
          ) : (
            call.transcript.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5 ${
                    entry.speaker === 'you' ? 'bg-indigo-600' : 'bg-emerald-600'
                  }`}>
                  {entry.speaker === 'you' ? 'Y' : 'C'}
                </div>
                <div className="flex-1">
                  <div
                    className={`px-3 py-2 rounded-xl rounded-tl-sm text-sm leading-relaxed ${
                      entry.speaker === 'you'
                        ? 'bg-indigo-950/60 border border-indigo-800/40 text-indigo-100'
                        : entry.isQuestion
                          ? 'bg-amber-950/50 border border-amber-700/40 text-amber-100'
                          : 'bg-emerald-950/50 border border-emerald-800/30 text-emerald-100'
                    }`}>
                    {entry.text}
                    {entry.isQuestion && entry.speaker === 'client' && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-700/40 text-amber-300">Q</span>
                    )}
                  </div>
                  {entry.aiAnswer ? (
                    <div className="mt-1 ml-2 pl-3 border-l-2 border-amber-600/30">
                      <p className="text-xs text-amber-500 font-medium">AI Answer</p>
                      <p className="text-sm text-slate-300 leading-relaxed">{entry.aiAnswer}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
