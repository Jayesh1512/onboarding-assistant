'use client';

import { useState } from 'react';

export interface Question {
  id: string;
  text: string;
  asked: boolean;
  notes: string;
}

interface Props {
  questions: Question[];
  onChange: (questions: Question[]) => void;
}

export default function QuestionChecklist({ questions, onChange }: Props) {
  const [newQ, setNewQ] = useState('');
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');

  const add = () => {
    if (!newQ.trim()) return;
    onChange([...questions, { id: Date.now().toString(), text: newQ.trim(), asked: false, notes: '' }]);
    setNewQ('');
  };

  const toggle = (id: string) =>
    onChange(questions.map((q) => q.id === id ? { ...q, asked: !q.asked } : q));

  const remove = (id: string) => onChange(questions.filter((q) => q.id !== id));

  const saveNotes = (id: string) => {
    onChange(questions.map((q) => q.id === id ? { ...q, notes: notesValue } : q));
    setEditingNotes(null);
  };

  const asked = questions.filter((q) => q.asked).length;
  const total = questions.length;

  return (
    <div className="space-y-4">
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>{asked} of {total} asked</span>
            <span>{Math.round((asked / total) * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-700">
            <div className="h-full rounded-full bg-indigo-500 transition-all duration-300" style={{ width: `${total ? (asked / total) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input type="text" value={newQ} onChange={(e) => setNewQ(e.target.value)}
          placeholder="Add a question to ask the client..."
          className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button onClick={add} disabled={!newQ.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition-colors">
          Add
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No questions yet. Add the questions you want to ask your client.</p>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={q.id} className={`rounded-xl border transition-colors ${q.asked ? 'bg-slate-800/20 border-slate-700/40' : 'bg-slate-800/50 border-slate-700'}`}>
              <div className="flex items-start gap-3 p-3">
                <button onClick={() => toggle(q.id)}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${q.asked ? 'bg-green-500 border-green-500' : 'border-slate-500 hover:border-indigo-400'}`}>
                  {q.asked && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${q.asked ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                    <span className="text-slate-500 mr-1.5">{i + 1}.</span>{q.text}
                  </p>
                  {q.notes && editingNotes !== q.id && <p className="text-xs text-slate-400 mt-1 italic">{q.notes}</p>}
                  {editingNotes === q.id && (
                    <div className="mt-2 flex gap-2">
                      <input autoFocus type="text" value={notesValue} onChange={(e) => setNotesValue(e.target.value)}
                        placeholder="Add notes..."
                        className="flex-1 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        onKeyDown={(e) => { if (e.key === 'Enter') saveNotes(q.id); if (e.key === 'Escape') setEditingNotes(null); }} />
                      <button onClick={() => saveNotes(q.id)} className="text-xs text-indigo-400 hover:text-indigo-300">Save</button>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => { setEditingNotes(q.id); setNotesValue(q.notes); }} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Notes</button>
                  <button onClick={() => remove(q.id)} className="text-xs text-slate-600 hover:text-red-400 transition-colors">×</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
