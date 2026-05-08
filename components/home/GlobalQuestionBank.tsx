'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GlobalQuestion } from '@/lib/home-types';
import { HOME_BUTTON_3D_PRIMARY, HOME_BUTTON_3D_SECONDARY } from '@/lib/home-button-styles';

export default function GlobalQuestionBank() {
  const [questions, setQuestions] = useState<GlobalQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetch('/api/global-questions')
      .then((r) => r.json())
      .then(({ questions: q }) => setQuestions(q ?? []))
      .finally(() => setLoading(false));
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setText('');
    setCategory('');
    setShowModal(true);
  };

  const beginEdit = (q: GlobalQuestion) => {
    setEditingId(q.id);
    setText(q.text);
    setCategory(q.category ?? '');
    setShowModal(true);
  };

  const submit = async () => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    if (editingId) {
      await fetch(`/api/global-questions/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmedText, category: category.trim() }),
      });
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === editingId ? { ...q, text: trimmedText, category: category.trim() || undefined } : q,
        ),
      );
    } else {
      const newQ: GlobalQuestion = {
        id: `gq-${Date.now()}`,
        text: trimmedText,
        category: category.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await fetch('/api/global-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQ),
      });
      setQuestions((prev) => [...prev, newQ]);
    }

    setText('');
    setCategory('');
    setEditingId(null);
    setShowModal(false);
  };

  const deleteQuestion = async (id: string) => {
    const inUse = false; // server enforces nothing; just confirm
    if (!window.confirm('Delete this question?')) return;
    await fetch(`/api/global-questions/${id}`, { method: 'DELETE' });
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col h-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Global question bank</h3>
          <p className="mt-1 text-xs text-slate-500">Reusable questions available across all meetings.</p>
        </div>
        <button onClick={openAdd} className={`${HOME_BUTTON_3D_PRIMARY} px-3 py-1.5 text-xs whitespace-nowrap flex items-center gap-1`}>
          <span>+</span> Add
        </button>
      </div>

      {loading ? (
        <div className="mt-4 flex justify-center">
          <div className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : questions.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500 text-center">
          No global questions yet. Add one to reuse across meetings.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {questions.map((q) => (
            <li key={q.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-800">{q.text}</p>
                  {q.category && (
                    <span className="mt-1 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{q.category}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => beginEdit(q)} className={`${HOME_BUTTON_3D_SECONDARY} px-2 py-1 text-xs`}>Edit</button>
                  <button onClick={() => deleteQuestion(q.id)} className={`${HOME_BUTTON_3D_SECONDARY} px-2 py-1 text-xs`}>Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl pointer-events-auto border border-slate-200"
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Question' : 'Add Global Question'}</h3>
                  <button onClick={() => setShowModal(false)} className={`${HOME_BUTTON_3D_SECONDARY} !rounded-full w-8 h-8 flex items-center justify-center p-0`}>✕</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Question Text</label>
                    <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. What is your expected go-live date?" rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400 resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category (Optional)</label>
                    <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Timeline"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-orange-400" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setShowModal(false)} className={`${HOME_BUTTON_3D_SECONDARY} px-4 py-2 text-sm`}>Cancel</button>
                  <button onClick={submit} disabled={!text.trim()} className={`${HOME_BUTTON_3D_PRIMARY} px-6 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed`}>
                    {editingId ? 'Save Changes' : 'Add Question'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
