'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Question {
  id: string;
  text: string;
  asked: boolean;
  notes: string;
}

type Speaker = 'you' | 'client';

interface TranscriptEntry {
  id: string;
  speaker: Speaker;
  text: string;
  isQuestion: boolean;
  aiAnswer?: string;
  aiLoading?: boolean;
  matchedQuestionId?: string;
}

interface Props {
  questions: Question[];
  context: string;
  onToggleQuestion: (id: string) => void;
}

const QUESTION_STARTERS = /^(what|how|why|when|where|who|which|is|are|do|does|can|could|would|will|should|have|has|did|tell me|explain|describe)/i;

function isLikelyQuestion(text: string): boolean {
  const t = text.trim();
  return t.endsWith('?') || QUESTION_STARTERS.test(t);
}

const GROQ_MODELS = [
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fast, free)' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (smart, free)' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B (free)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (free)' },
];

export default function LiveCall({ questions, context, onToggleQuestion }: Props) {
  const [recording, setRecording] = useState(false);
  const [speaker, setSpeaker] = useState<Speaker>('you');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interim, setInterim] = useState('');
  const [model, setModel] = useState('llama-3.1-8b-instant');
  const [manualInput, setManualInput] = useState('');
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const speakerRef = useRef<Speaker>('you');
  const bottomRef = useRef<HTMLDivElement>(null);
  const restartingRef = useRef(false);

  useEffect(() => { speakerRef.current = speaker; }, [speaker]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript, interim]);

  const hasKB = context.length > 0;

  const getAiAnswer = useCallback(async (entryId: string, question: string) => {
    setTranscript((prev) => prev.map((e) => e.id === entryId ? { ...e, aiLoading: true, aiAnswer: '' } : e));
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context, model }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split('\n').filter((l) => l.startsWith('data: '))) {
          const data = JSON.parse(line.slice(6));
          if (data.text) setTranscript((prev) => prev.map((e) => e.id === entryId ? { ...e, aiAnswer: (e.aiAnswer || '') + data.text } : e));
          else if (data.done) setTranscript((prev) => prev.map((e) => e.id === entryId ? { ...e, aiLoading: false } : e));
          else if (data.error) setTranscript((prev) => prev.map((e) => e.id === entryId ? { ...e, aiLoading: false, aiAnswer: `⚠️ ${data.error}` } : e));
        }
      }
    } catch (e) {
      setTranscript((prev) => prev.map((entry) => entry.id === entryId ? { ...entry, aiLoading: false, aiAnswer: `⚠️ ${String(e)}` } : entry));
    }
  }, [model, context]);

  const tryMatchYourQuestion = useCallback(async (spoken: string) => {
    try {
      const res = await fetch('/api/match-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spoken, questions }),
      });
      const data = await res.json();
      if (data.match) { onToggleQuestion(data.match); return data.match as string; }
    } catch { /* silent */ }
    return null;
  }, [onToggleQuestion, questions]);

  const handleFinalTranscript = useCallback(async (text: string) => {
    if (!text.trim()) return;
    const currentSpeaker = speakerRef.current;
    const isQuestion = isLikelyQuestion(text);
    const entryId = Date.now().toString();
    setTranscript((prev) => [...prev, { id: entryId, speaker: currentSpeaker, text: text.trim(), isQuestion }]);
    if (currentSpeaker === 'client' && isQuestion && hasKB) {
      getAiAnswer(entryId, text.trim());
    } else if (currentSpeaker === 'you') {
      const matchedId = await tryMatchYourQuestion(text.trim());
      if (matchedId) setTranscript((prev) => prev.map((e) => e.id === entryId ? { ...e, matchedQuestionId: matchedId } : e));
    }
  }, [hasKB, getAiAnswer, tryMatchYourQuestion]);

  const startRecording = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) { handleFinalTranscript(event.results[i][0].transcript); setInterim(''); }
        else interimText += event.results[i][0].transcript;
      }
      setInterim(interimText);
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') { setError(`Mic error: ${event.error}`); setRecording(false); }
    };
    rec.onend = () => { if (restartingRef.current) try { rec.start(); } catch { /* ok */ } };
    recognitionRef.current = rec;
    restartingRef.current = true;
    setError('');
    try { rec.start(); setRecording(true); } catch { setError('Could not start mic. Check browser permissions.'); }
  }, [handleFinalTranscript]);

  const stopRecording = useCallback(() => {
    restartingRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
    setInterim('');
  }, []);

  const askManual = async () => {
    const q = manualInput.trim();
    if (!q) return;
    const entryId = Date.now().toString();
    setTranscript((prev) => [...prev, { id: entryId, speaker: 'client', text: q, isQuestion: true }]);
    setManualInput('');
    if (hasKB) getAiAnswer(entryId, q);
  };

  if (!supported) {
    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div className="space-y-2">
          <p className="text-slate-300 font-medium">Speech recognition not supported</p>
          <p className="text-slate-500 text-sm">Use Chrome or Edge for live transcription.</p>
        </div>
      </div>
    );
  }

  const pending = questions.filter((q) => !q.asked);
  const askedQs = questions.filter((q) => q.asked);

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 120px)' }}>

      {/* Controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${recording ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40' : 'bg-slate-700 hover:bg-slate-600 text-slate-100'}`}
        >
          <span className={`w-2 h-2 rounded-full ${recording ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
          {recording ? 'Stop Recording' : 'Start Recording'}
        </button>

        {/* Speaker toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800 border border-slate-700">
          <button onClick={() => setSpeaker('you')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${speaker === 'you' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            You speaking
          </button>
          <button onClick={() => setSpeaker('client')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${speaker === 'client' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            Client speaking
          </button>
        </div>

        {/* Model picker */}
        <select value={model} onChange={(e) => setModel(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-indigo-500">
          {GROQ_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        {/* KB status */}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${hasKB ? 'border-green-800 bg-green-900/20 text-green-400' : 'border-slate-700 text-slate-500'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${hasKB ? 'bg-green-400' : 'bg-slate-500'}`} />
          {hasKB ? `Knowledge base loaded` : 'No knowledge base — add content in Prep tab'}
        </div>

        {transcript.length > 0 && (
          <button onClick={() => { if (confirm('Clear transcript?')) setTranscript([]); }}
            className="ml-auto text-xs text-slate-500 hover:text-red-400 transition-colors">
            Clear transcript
          </button>
        )}
      </div>

      {error && <div className="px-4 py-2 rounded-lg bg-red-900/30 border border-red-700 text-red-300 text-sm">{error}</div>}

      {/* Main area */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Transcript panel */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Transcript</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-indigo-500/60 inline-block" />You</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/60 inline-block" />Client</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500/60 inline-block" />Client Q + AI answer</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 pr-1 rounded-xl bg-slate-900/50 border border-slate-800 p-4">
            {transcript.length === 0 && !interim && (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm text-center">
                {recording
                  ? `Listening… (${speaker === 'you' ? 'You' : 'Client'} speaking)`
                  : 'Press Start Recording, then toggle who is speaking as the conversation flows'}
              </div>
            )}

            {transcript.map((entry) => (
              <div key={entry.id}>
                <div className="flex items-start gap-2">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${entry.speaker === 'you' ? 'bg-indigo-600' : 'bg-emerald-600'} text-white`}>
                    {entry.speaker === 'you' ? 'Y' : 'C'}
                  </div>
                  <div className="flex-1">
                    <div className={`px-3 py-2 rounded-xl rounded-tl-sm text-sm leading-relaxed ${
                      entry.speaker === 'you'
                        ? 'bg-indigo-950/60 border border-indigo-800/50 text-indigo-100'
                        : entry.isQuestion
                        ? 'bg-amber-950/50 border border-amber-700/50 text-amber-100'
                        : 'bg-emerald-950/50 border border-emerald-800/40 text-emerald-100'
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className="flex-1">{entry.text}</span>
                        {entry.isQuestion && entry.speaker === 'client' && (
                          <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-amber-700/40 text-amber-300 font-medium">Q</span>
                        )}
                        {entry.matchedQuestionId && (
                          <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-indigo-700/40 text-indigo-300 font-medium">✓ matched</span>
                        )}
                      </div>
                    </div>

                    {/* AI Answer */}
                    {(entry.aiAnswer !== undefined || entry.aiLoading) && (
                      <div className="mt-2 ml-2 pl-3 border-l-2 border-amber-600/40">
                        <p className="text-xs text-amber-500 font-medium mb-1">AI Answer</p>
                        {entry.aiLoading && !entry.aiAnswer ? (
                          <span className="flex items-center gap-1.5 text-slate-500 text-sm">
                            <span className="inline-flex gap-1">
                              {[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                            </span>
                            Looking up answer…
                          </span>
                        ) : (
                          <p className="text-sm text-slate-200 leading-relaxed">
                            {entry.aiAnswer}
                            {entry.aiLoading && <span className="inline-block w-1.5 h-4 bg-amber-400 ml-0.5 animate-pulse" />}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Interim live text */}
            {interim && (
              <div className="flex items-start gap-2 opacity-60">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${speaker === 'you' ? 'bg-indigo-600' : 'bg-emerald-600'} text-white`}>
                  {speaker === 'you' ? 'Y' : 'C'}
                </div>
                <div className={`px-3 py-2 rounded-xl rounded-tl-sm text-sm italic ${speaker === 'you' ? 'bg-indigo-950/40 border border-indigo-800/30 text-indigo-300' : 'bg-emerald-950/40 border border-emerald-800/30 text-emerald-300'}`}>
                  {interim}<span className="inline-block w-1 h-4 bg-current ml-0.5 animate-pulse" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Manual input */}
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500">Manual lookup — type a client question to get an answer instantly:</p>
            <div className="flex gap-2">
              <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)}
                placeholder={hasKB ? 'Type client question manually…' : 'Load knowledge base first…'}
                disabled={!hasKB}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                onKeyDown={(e) => e.key === 'Enter' && askManual()} />
              <button onClick={askManual} disabled={!manualInput.trim() || !hasKB}
                className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-sm font-medium transition-colors">
                Ask
              </button>
            </div>
          </div>
        </div>

        {/* Right: checklist sidebar */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3 min-h-0">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Your Questions
            {pending.length > 0 && <span className="ml-2 text-indigo-400">{pending.length} left</span>}
          </h3>

          {questions.length === 0 ? (
            <p className="text-xs text-slate-500">Add questions in the Prep tab</p>
          ) : (
            <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5 min-h-0">
              {pending.map((q) => (
                <button key={q.id} onClick={() => onToggleQuestion(q.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-800/70 border border-slate-700 hover:border-indigo-500/60 hover:bg-indigo-950/30 transition-colors group">
                  <p className="text-xs text-slate-300 leading-relaxed">{q.text}</p>
                  <p className="text-xs text-slate-600 mt-0.5 group-hover:text-indigo-400 transition-colors">Tap to mark asked</p>
                </button>
              ))}
              {askedQs.length > 0 && (
                <>
                  <p className="text-xs text-slate-600 pt-2 pb-1 border-t border-slate-800 mt-2">Asked</p>
                  {askedQs.map((q) => (
                    <button key={q.id} onClick={() => onToggleQuestion(q.id)}
                      className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/20 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                      <p className="text-xs text-slate-600 line-through leading-relaxed">{q.text}</p>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {questions.length > 0 && (
            <div className="space-y-1 flex-shrink-0">
              <div className="flex justify-between text-xs text-slate-600">
                <span>{askedQs.length}/{questions.length} asked</span>
                <span>{Math.round((askedQs.length / questions.length) * 100)}%</span>
              </div>
              <div className="h-1 rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${(askedQs.length / questions.length) * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
