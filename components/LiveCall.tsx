'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Question } from './QuestionChecklist';
import MeetingSummary from './MeetingSummary';
import { serializeTranscript } from '@/lib/call-types';
import { HOME_BUTTON_3D_PRIMARY, HOME_BUTTON_3D_SECONDARY } from '@/lib/home-button-styles';

type Speaker = 'you' | 'client';

interface TranscriptEntry {
  id: string;
  speaker: Speaker;
  text: string;
  isQuestion: boolean;
  aiAnswer?: string;
  aiLoading?: boolean;
  matchedQuestionId?: string;
  answeredQuestionId?: string;
}

interface Props {
  questions: Question[];
  context: string;
  onToggleQuestion: (id: string) => void;
  onAnswerQuestion: (id: string, answer: string) => void;
  prepareHref?: string;
}

const QUESTION_STARTERS = /^(what|how|why|when|where|who|which|is|are|do|does|can|could|would|will|should|have|has|did|tell me|explain|describe)/i;
const isLikelyQuestion = (t: string) => t.trim().endsWith('?') || QUESTION_STARTERS.test(t.trim());

const STOP = new Set(['a','an','the','is','are','do','does','your','my','our','you','we','i','it','in','of','to','for','and','or','what','how','where','when','who','which','that','this','have','has','did','can','could','would','will','be','been','with','at','by','from','on','as']);
function fuzzyMatch(spoken: string, prepared: string): boolean {
  const tok = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
  const a = new Set(tok(spoken));
  const b = tok(prepared);
  if (!a.size || !b.length) return false;
  const overlap = b.filter((w) => a.has(w)).length;
  return overlap / b.length >= 0.4;
}

// ─── Level meter ──────────────────────────────────────────────────────────────
function useLevelMeter(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    if (!stream) { setLevel(0); return; }
    const ctx = new AudioContext(); ctx.resume();
    const analyser = ctx.createAnalyser(); analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      let peak = 0; for (let i = 0; i < data.length; i++) if (data[i] > peak) peak = data[i];
      setLevel(peak); rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); ctx.close(); };
  }, [stream]);
  return level;
}

function LevelBar({ level, label, color }: { level: number; label: string; color: string }) {
  const pct = Math.min(100, (level / 255) * 100);
  const isActive = level > 15;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-slate-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-75" style={{ width: `${pct}%`, background: isActive ? color : '#cbd5e1' }} />
      </div>
      <span className={`text-xs w-16 shrink-0 font-mono ${isActive ? 'text-slate-700' : 'text-slate-400'}`}>
        {Math.round(level)} {isActive ? '✓' : '—'}
      </span>
    </div>
  );
}

export default function LiveCall({ questions, context, onToggleQuestion, onAnswerQuestion, prepareHref }: Props) {
  const [recording, setRecording]       = useState(false);
  const [transcript, setTranscript]     = useState<TranscriptEntry[]>([]);
  const [model, setModel]               = useState('llama3.2');
  const [ollamaModels, setOllamaModels] = useState<{ id: string; name: string }[]>([]);
  const [ollamaError, setOllamaError]   = useState('');
  const [manualInput, setManualInput]   = useState('');
  const [status, setStatus]             = useState('');
  const [error, setError]               = useState('');
  const [micStream, setMicStream]       = useState<MediaStream | null>(null);
  const [sysStream, setSysStream]       = useState<MediaStream | null>(null);
  const [liveYou, setLiveYou]           = useState('');
  const [liveClient, setLiveClient]     = useState('');
  const [showSummary, setShowSummary]   = useState(false);
  const [callEnded, setCallEnded]       = useState(false);
  const [savedCallId, setSavedCallId]   = useState<string | null>(null);
  const [saveCallError, setSaveCallError] = useState('');

  const micWsRef  = useRef<WebSocket | null>(null);
  const sysWsRef  = useRef<WebSocket | null>(null);
  const micRecRef = useRef<MediaRecorder | null>(null);
  const sysRecRef = useRef<MediaRecorder | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const hasKB     = context.length > 0;

  const transcriptRef          = useRef<TranscriptEntry[]>([]);
  const questionsRef           = useRef<Question[]>(questions);
  const lastAskedQuestionIdRef = useRef<string | null>(null);
  const contextRef             = useRef(context);
  const modelRef               = useRef(model);

  useEffect(() => { transcriptRef.current = transcript; },  [transcript]);
  useEffect(() => { questionsRef.current  = questions;  },  [questions]);
  useEffect(() => { contextRef.current    = context;    },  [context]);
  useEffect(() => { modelRef.current      = model;      },  [model]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript, liveYou, liveClient]);

  useEffect(() => {
    fetch('/api/lm-models')
      .then((r) => r.json())
      .then((d) => {
        if (d.models?.length) { setOllamaModels(d.models); setModel(d.models[0].id); }
        else setOllamaError(d.error || 'No models found');
      })
      .catch(() => setOllamaError('Cannot reach Ollama'));
  }, []);

  const getAiAnswer = useCallback(async (entryId: string, question: string) => {
    setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, aiLoading: true, aiAnswer: '' } : e));
    try {
      const res = await fetch('/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context: contextRef.current, model: modelRef.current }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder('utf-8', { fatal: false });
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.text)  setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, aiAnswer: (e.aiAnswer || '') + d.text } : e));
            if (d.done)  setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, aiLoading: false } : e));
            if (d.error) setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, aiLoading: false, aiAnswer: `⚠️ ${d.error}` } : e));
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setTranscript((p) => p.map((en) => en.id === entryId ? { ...en, aiLoading: false, aiAnswer: `⚠️ ${String(e)}` } : en));
    }
  }, []);

  const analyzeUtterance = useCallback(async (entryId: string, speaker: Speaker, text: string) => {
    const pendingQuestions = questionsRef.current.filter((q) => !q.asked).map((q) => ({ id: q.id, text: q.text }));
    const recentEntries = transcriptRef.current.slice(-6).map((e) => ({ speaker: e.speaker, text: e.text }));
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latestEntry: { speaker, text }, recentEntries, pendingQuestions, lastAskedQuestionId: lastAskedQuestionIdRef.current, hasKB }),
      });
      const analysis = await res.json();

      let matchedId: string | null = analysis.matchedPreparedQuestionId ?? null;
      if (!matchedId && speaker === 'you') {
        const pending = questionsRef.current.filter((q) => !q.asked);
        const found = pending.find((q) => fuzzyMatch(text, q.text));
        if (found) matchedId = found.id;
      }
      if (matchedId) {
        onToggleQuestion(matchedId);
        lastAskedQuestionIdRef.current = matchedId;
        setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, matchedQuestionId: matchedId! } : e));
      }

      let answeredId: string | null = analysis.clientAnswerForId ?? null;
      if (!answeredId && speaker === 'client' && lastAskedQuestionIdRef.current) answeredId = lastAskedQuestionIdRef.current;
      if (answeredId) {
        onAnswerQuestion(answeredId, text);
        lastAskedQuestionIdRef.current = null;
        setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, answeredQuestionId: answeredId! } : e));
      }

      if (hasKB && speaker === 'client' && isLikelyQuestion(text)) getAiAnswer(entryId, text);
    } catch { /* never crash the call */ }
  }, [hasKB, onToggleQuestion, onAnswerQuestion, getAiAnswer]);

  const handleFinalRef = useRef<(text: string, speaker: Speaker) => void>(() => {});
  useEffect(() => {
    handleFinalRef.current = (text: string, speaker: Speaker) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const entryId = `${Date.now()}-${Math.random().toString(36).slice(2)}-${speaker}`;
      setTranscript((p) => [...p, { id: entryId, speaker, text: trimmed, isQuestion: isLikelyQuestion(trimmed) }]);
      analyzeUtterance(entryId, speaker, trimmed);
    };
  }, [analyzeUtterance]);

  const connectDeepgram = useCallback(async (
    stream: MediaStream, speaker: Speaker, setLive: (t: string) => void,
  ): Promise<{ ws: WebSocket; recorder: MediaRecorder }> => {
    const res = await fetch('/api/deepgram-token');
    if (!res.ok) throw new Error('Deepgram API key not configured');
    const { key, error: keyErr } = await res.json();
    if (keyErr || !key) throw new Error(keyErr || 'No Deepgram key returned');
    const params = new URLSearchParams({ model: 'nova-3', language: 'en-US', punctuate: 'true', interim_results: 'true', endpointing: '300', smart_format: 'true', no_delay: 'true' });
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', key]);
    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string);
        if (data.type === 'Results') {
          const text: string = data.channel?.alternatives?.[0]?.transcript ?? '';
          if (data.is_final) { setLive(''); if (text.trim()) handleFinalRef.current(text, speaker); }
          else setLive(text);
        }
      } catch { /* ignore */ }
    };
    ws.onerror = () => setError('Deepgram WebSocket error — check DEEPGRAM_API_KEY');
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      setTimeout(() => reject(new Error('Deepgram connection timed out')), 6000);
    });
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data); };
    recorder.start(250);
    return { ws, recorder };
  }, []);

  const startRecording = useCallback(async () => {
    setError(''); setLiveYou(''); setLiveClient(''); setCallEnded(false);
    setSavedCallId(null); setSaveCallError('');
    setStatus('Requesting microphone…');
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 } });
      setMicStream(mic);
      setStatus('Connecting to Deepgram…');
      const { ws: mWs, recorder: mRec } = await connectDeepgram(mic, 'you', setLiveYou);
      micWsRef.current = mWs; micRecRef.current = mRec;
      setStatus('Requesting system audio — share your Google Meet tab with "Share tab audio" checked…');
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true as any, audio: true });
        display.getVideoTracks().forEach((t) => t.stop());
        setSysStream(display);
        if (display.getAudioTracks().length) {
          const { ws: sWs, recorder: sRec } = await connectDeepgram(display, 'client', setLiveClient);
          sysWsRef.current = sWs; sysRecRef.current = sRec;
          setStatus('');
        }
      } catch { setStatus('⚠️ No system audio — only your mic will be transcribed.'); }
      setRecording(true);
    } catch (e) { setError(`Could not start: ${String(e)}`); setStatus(''); }
  }, [connectDeepgram]);

  const stopRecording = useCallback(async () => {
    micRecRef.current?.stop(); sysRecRef.current?.stop();
    micWsRef.current?.close(); sysWsRef.current?.close();
    micRecRef.current = null; sysRecRef.current = null;
    micWsRef.current  = null; sysWsRef.current  = null;
    micStream?.getTracks().forEach((t) => t.stop());
    sysStream?.getTracks().forEach((t) => t.stop());
    setMicStream(null); setSysStream(null);
    setLiveYou(''); setLiveClient('');
    setRecording(false); setStatus(''); setCallEnded(true);

    const lines = transcriptRef.current;
    if (lines.length === 0) return;
    setSaveCallError('');
    try {
      const res = await fetch('/api/calls', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: serializeTranscript(lines), questions: questionsRef.current, model: modelRef.current, ended_at: new Date().toISOString() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setSaveCallError(typeof data.error === 'string' ? data.error : 'Could not save call'); return; }
      if (typeof data.id === 'string') setSavedCallId(data.id);
      else setSaveCallError('Save response missing id');
    } catch (e) { setSaveCallError(String(e)); }
  }, [micStream, sysStream]);

  const askManual = async () => {
    const q = manualInput.trim();
    if (!q) return;
    const entryId = `manual-${Date.now()}`;
    setTranscript((p) => [...p, { id: entryId, speaker: 'client', text: q, isQuestion: true }]);
    setManualInput('');
    if (hasKB) getAiAnswer(entryId, q);
  };

  const micLevel = useLevelMeter(micStream);
  const sysLevel = useLevelMeter(sysStream);
  const pending  = questions.filter((q) => !q.asked);
  const askedQs  = questions.filter((q) => q.asked);

  return (
    <>
      {showSummary && (
        <MeetingSummary transcript={transcript} questions={questions} model={model} savedCallId={savedCallId} onClose={() => setShowSummary(false)} />
      )}

      <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 100px)' }}>

        {/* Controls bar */}
        <div className="flex items-center gap-3 flex-wrap rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={recording
              ? 'flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-red-500 hover:bg-red-400 text-white border border-red-400 transition-all shadow-sm'
              : `${HOME_BUTTON_3D_PRIMARY} flex items-center gap-2 px-4 py-2 text-sm`
            }
          >
            <span className={`w-2 h-2 rounded-full ${recording ? 'bg-white animate-pulse' : 'bg-orange-200'}`} />
            {recording ? 'Stop Recording' : 'Start Recording'}
          </button>

          {callEnded && transcript.length > 0 && saveCallError && (
            <span className="text-xs text-red-500 max-w-xs" title={saveCallError}>⚠️ {saveCallError}</span>
          )}
          {callEnded && transcript.length > 0 && savedCallId && !saveCallError && (
            <span className="text-xs text-emerald-600 font-medium">✓ Saved to history</span>
          )}
          {callEnded && transcript.length > 0 && (
            <button onClick={() => setShowSummary(true)} className={`${HOME_BUTTON_3D_SECONDARY} flex items-center gap-2 px-4 py-2 text-sm`}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Summary &amp; PDF
            </button>
          )}

          <select
            value={model} onChange={(e) => setModel(e.target.value)}
            className="ml-auto px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-orange-400"
          >
            {ollamaModels.length
              ? ollamaModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)
              : <option value="llama3.2">llama3.2 (default)</option>
            }
          </select>

          {ollamaError
            ? (
              <span className="text-xs text-amber-600 font-medium" title={ollamaError}>
                ⚠️ Ollama not running —{' '}
                <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800">ollama serve</code>
              </span>
            )
            : ollamaModels.length > 0 && <span className="text-xs text-emerald-600 font-medium">✓ Ollama ready</span>
          }

          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border font-medium ${hasKB ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${hasKB ? 'bg-emerald-400' : 'bg-slate-300'}`} />
            {hasKB ? 'KB loaded' : 'No KB'}
          </span>

          {transcript.length > 0 && (
            <button
              onClick={() => { if (confirm('Clear transcript?')) { setTranscript([]); setCallEnded(false); setSavedCallId(null); setSaveCallError(''); lastAskedQuestionIdRef.current = null; } }}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Level meters */}
        {recording && (
          <div className="px-4 py-3 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-2">
            <p className="text-xs text-slate-500 font-medium mb-2">Live audio · Deepgram streaming · AI parsing every utterance</p>
            <LevelBar level={micLevel} label="You (mic)"    color="#f97316" />
            <LevelBar level={sysLevel} label="Client (sys)" color="#10b981" />
          </div>
        )}

        {/* Status / instructions */}
        {(error || status || !recording) && (
          <div className={`px-4 py-3 rounded-2xl border text-sm ${error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-slate-200 text-slate-500'}`}>
            {error || status || (
              <span>
                Press <strong className="text-slate-700">Start Recording</strong> → allow mic → share your{' '}
                <strong className="text-slate-700">Google Meet tab</strong> with{' '}
                <strong className="text-slate-700">"Share tab audio"</strong> checked.
                The AI listens in real time: auto-answers client questions from the KB, captures client responses to your prepared questions, and generates full meeting minutes when you stop.
              </span>
            )}
          </div>
        )}

        {/* Main layout */}
        <div className="flex gap-4 flex-1 min-h-0">

          {/* Transcript */}
          <div className="flex-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Live Transcript</h3>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-indigo-400" />You</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-400" />Client</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-400" />Client Q + AI</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              {transcript.length === 0 && !liveYou && !liveClient && (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm text-center">
                  {recording
                    ? <span className="flex items-center gap-2">
                        <span className="inline-flex gap-1">
                          {[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                        </span>
                        Listening…
                      </span>
                    : callEnded
                    ? 'Call ended. Click "Summary & PDF" to view minutes.'
                    : 'Transcript will appear here once you start recording.'}
                </div>
              )}

              {transcript.map((entry) => (
                <div key={entry.id}>
                  <div className="flex items-start gap-2">
                    <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 text-white ${entry.speaker === 'you' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                      {entry.speaker === 'you' ? 'Y' : 'C'}
                    </div>
                    <div className="flex-1">
                      <div className={`px-3 py-2 rounded-xl rounded-tl-sm text-sm leading-relaxed ${
                        entry.speaker === 'you'
                          ? 'bg-indigo-50 border border-indigo-200 text-indigo-900'
                          : entry.isQuestion
                          ? 'bg-amber-50 border border-amber-200 text-amber-900'
                          : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      }`}>
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="flex-1">{entry.text}</span>
                          <div className="flex gap-1 shrink-0">
                            {entry.isQuestion && entry.speaker === 'client' && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-medium">Q</span>
                            )}
                            {entry.matchedQuestionId && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-800 font-medium">✓ prep Q</span>
                            )}
                            {entry.answeredQuestionId && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800 font-medium">✓ captured</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {(entry.aiAnswer !== undefined || entry.aiLoading) && (
                        <div className="mt-2 ml-2 pl-3 border-l-2 border-amber-400">
                          <p className="text-xs text-amber-600 font-semibold mb-1">💡 AI Answer (from KB)</p>
                          {entry.aiLoading && !entry.aiAnswer
                            ? <span className="flex items-center gap-1.5 text-slate-400 text-sm">
                                <span className="inline-flex gap-1">{[0,150,300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</span>
                                Looking up answer…
                              </span>
                            : <p className="text-sm text-slate-700 leading-relaxed">
                                {entry.aiAnswer}
                                {entry.aiLoading && <span className="inline-block w-1.5 h-4 bg-amber-400 ml-0.5 animate-pulse" />}
                              </p>
                          }
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {liveYou && (
                <div className="flex items-start gap-2 opacity-60">
                  <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 text-white bg-indigo-500">Y</div>
                  <div className="flex-1 px-3 py-2 rounded-xl rounded-tl-sm text-sm italic bg-indigo-50 border border-indigo-200 text-indigo-700">
                    {liveYou}<span className="inline-block w-1 h-4 bg-indigo-400 ml-1 animate-pulse align-middle" />
                  </div>
                </div>
              )}
              {liveClient && (
                <div className="flex items-start gap-2 opacity-60">
                  <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 text-white bg-emerald-500">C</div>
                  <div className="flex-1 px-3 py-2 rounded-xl rounded-tl-sm text-sm italic bg-emerald-50 border border-emerald-200 text-emerald-700">
                    {liveClient}<span className="inline-block w-1 h-4 bg-emerald-400 ml-1 animate-pulse align-middle" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Manual input */}
            <div className="space-y-1.5">
              <p className="text-xs text-slate-400">Manual lookup — type a client question to search the knowledge base instantly:</p>
              <div className="flex gap-2">
                <input
                  type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)}
                  placeholder={hasKB ? 'Type client question…' : 'Load a knowledge base first…'}
                  disabled={!hasKB}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-orange-400 disabled:opacity-50 shadow-sm"
                  onKeyDown={(e) => e.key === 'Enter' && askManual()}
                />
                <button onClick={askManual} disabled={!manualInput.trim() || !hasKB} className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed`}>
                  Ask
                </button>
              </div>
            </div>
          </div>

          {/* Questions sidebar */}
          <div className="w-72 shrink-0 flex flex-col gap-3 min-h-0">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Your Questions
              {pending.length > 0 && <span className="ml-2 text-orange-500">{pending.length} left</span>}
            </h3>

            {questions.length === 0
              ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 text-center space-y-2">
                  <p className="text-xs text-slate-400">No questions added for this meeting.</p>
                  {prepareHref && (
                    <a href={prepareHref} className="text-xs text-orange-500 hover:underline font-medium">
                      ← Go to Prepare to add questions
                    </a>
                  )}
                </div>
              )
              : (
                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {pending.map((q) => (
                    <button key={q.id} onClick={() => onToggleQuestion(q.id)}
                      className="w-full text-left px-3 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 transition-colors group shadow-sm">
                      <p className="text-xs text-slate-700 leading-relaxed">{q.text}</p>
                      <p className="text-xs text-slate-400 mt-0.5 group-hover:text-orange-500">Tap to mark asked</p>
                    </button>
                  ))}

                  {askedQs.length > 0 && (
                    <>
                      <p className="text-xs text-slate-400 pt-2 pb-1 border-t border-slate-100 mt-2">Asked</p>
                      {askedQs.map((q) => (
                        <div key={q.id} className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                          <p className="text-xs text-slate-400 line-through leading-relaxed">{q.text}</p>
                          {q.clientAnswer && (
                            <p className="text-xs text-emerald-600 mt-1 leading-relaxed">
                              ↳ {q.clientAnswer.length > 80 ? q.clientAnswer.slice(0, 80) + '…' : q.clientAnswer}
                            </p>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )
            }

            {questions.length > 0 && (
              <div className="space-y-1 shrink-0">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{askedQs.length}/{questions.length} asked</span>
                  <span>{Math.round((askedQs.length / questions.length) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-orange-400 transition-all duration-500"
                    style={{ width: `${(askedQs.length / questions.length) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
