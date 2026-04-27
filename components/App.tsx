'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from '@/lib/use-local-storage';
import KnowledgeBase, { type KBSource } from './KnowledgeBase';
import QuestionChecklist, { type Question } from './QuestionChecklist';
import LiveCall from './LiveCall';

type Tab = 'prep' | 'live';
type PrepTab = 'knowledge' | 'questions';

export default function App() {
  const [tab, setTab] = useState<Tab>('prep');
  const [prepTab, setPrepTab] = useState<PrepTab>('knowledge');

  // All state in localStorage — survives refresh, works on Vercel
  const [sources, setSources, hydrated] = useLocalStorage<KBSource[]>('kb-sources', []);
  const [questions, setQuestions] = useLocalStorage<Question[]>('onboarding-questions', []);

  // Build full context string from all sources (passed to API per-request)
  const context = useMemo(
    () => sources.map((s) => `[Source: ${s.label}]\n${s.content}`).join('\n\n---\n\n'),
    [sources]
  );

  const addSource = useCallback((source: KBSource) => setSources((prev) => [...prev, source]), [setSources]);
  const removeSource = useCallback((id: string) => setSources((prev) => prev.filter((s) => s.id !== id)), [setSources]);
  const clearSources = useCallback(() => setSources([]), [setSources]);

  const toggleQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, asked: !q.asked } : q));
  }, [setQuestions]);

  const answerQuestion = useCallback((id: string, answer: string) => {
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, clientAnswer: answer } : q));
  }, [setQuestions]);

  const wordCount = useMemo(() => sources.reduce((acc, s) => acc + s.content.split(/\s+/).length, 0), [sources]);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Onboarding Assistant</h1>
            <p className="text-xs text-slate-500">AI-powered onboarding call helper</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800 border border-slate-700">
          <button onClick={() => setTab('prep')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'prep' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}>
            Prep
          </button>
          <button onClick={() => setTab('live')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'live' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tab === 'live' ? 'bg-red-400 animate-pulse' : 'bg-slate-500'}`} />
            Live Call
          </button>
        </div>

        {/* Status chips */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${wordCount > 0 ? 'border-green-800 bg-green-900/30 text-green-400' : 'border-slate-700 bg-slate-800/50 text-slate-500'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${wordCount > 0 ? 'bg-green-400' : 'bg-slate-500'}`} />
            {wordCount > 0 ? `${wordCount.toLocaleString()} words` : 'No knowledge base'}
          </div>
          {questions.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-indigo-800 bg-indigo-900/30 text-indigo-400">
              {questions.filter((q) => !q.asked).length} questions left
            </div>
          )}
        </div>
      </header>

      {/* Body */}
      <main className="flex-1 p-6">
        {tab === 'prep' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="flex gap-1 border-b border-slate-800">
              {(['knowledge', 'questions'] as const).map((t) => (
                <button key={t} onClick={() => setPrepTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${prepTab === t ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                  {t === 'knowledge' ? 'Knowledge Base' : `Questions (${questions.length})`}
                </button>
              ))}
            </div>

            {prepTab === 'knowledge' && (
              <KnowledgeBase sources={sources} onAdd={addSource} onRemove={removeSource} onClear={clearSources} />
            )}
            {prepTab === 'questions' && (
              <QuestionChecklist questions={questions} onChange={setQuestions} />
            )}
          </div>
        )}

        {tab === 'live' && (
          <div className="max-w-6xl mx-auto">
            <LiveCall questions={questions} context={context} onToggleQuestion={toggleQuestion} onAnswerQuestion={answerQuestion} />
          </div>
        )}
      </main>
    </div>
  );
}
