'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Question { id: string; text: string; asked: boolean; notes: string }
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
const isLikelyQuestion = (t: string) => t.trim().endsWith('?') || QUESTION_STARTERS.test(t.trim());

const GROQ_MODELS = [
  { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B (fast)' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (smart)' },
  { value: 'gemma2-9b-it',            label: 'Gemma 2 9B' },
  { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B' },
];

const CHUNK_INTERVAL = 5000;      // ms between transcription sends
// Peak level threshold (0–255 from AnalyserNode getByteFrequencyData).
// Silence ≈ 0–5, background noise ≈ 5–15, speech ≈ 15–80+
const SPEECH_THRESHOLD = 12;
const HALLUCINATIONS = new Set([  // known Whisper noise hallucinations to silently drop
  'thank you', 'thanks', 'thank you.', 'thanks.', 'you', 'the',
  'thanks for watching', 'thank you for watching', 'bye', 'bye.',
  'please subscribe', 'like and subscribe', '...', '. . .',
]);

// ─── Live level meter using AnalyserNode ────────────────────────────────────
// Also exposes a peakRef so the recorder can check if speech occurred in a
// chunk interval WITHOUT needing to decode the WebM blob (unreliable).
function useLevelMeter(stream: MediaStream | null) {
  const [level, setLevel] = useState(0);
  const peakRef = useRef(0);   // tracks highest avg level seen since last reset
  const rafRef  = useRef<number>(0);

  useEffect(() => {
    if (!stream) { setLevel(0); peakRef.current = 0; return; }
    const ctx      = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      setLevel(avg);
      if (avg > peakRef.current) peakRef.current = avg;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => { cancelAnimationFrame(rafRef.current); ctx.close(); };
  }, [stream]);

  return { level, peakRef };
}

// ─── Level bar component ─────────────────────────────────────────────────────
function LevelBar({ level, label, color }: { level: number; label: string; color: string }) {
  const pct = Math.min(100, (level / 60) * 100);
  const isActive = level > SPEECH_THRESHOLD;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-xs text-slate-500 w-14 flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-75"
          style={{ width: `${pct}%`, background: isActive ? color : '#334155' }} />
      </div>
      <span className={`text-xs w-12 flex-shrink-0 ${isActive ? 'text-slate-300' : 'text-slate-600'}`}>
        {isActive ? 'Speech' : 'Silence'}
      </span>
    </div>
  );
}

export default function LiveCall({ questions, context, onToggleQuestion }: Props) {
  const [recording, setRecording]       = useState(false);
  const [transcript, setTranscript]     = useState<TranscriptEntry[]>([]);
  const [model, setModel]               = useState('llama-3.1-8b-instant');
  const [manualInput, setManualInput]   = useState('');
  const [status, setStatus]             = useState('');
  const [error, setError]               = useState('');
  const [micStream, setMicStream]       = useState<MediaStream | null>(null);
  const [sysStream, setSysStream]       = useState<MediaStream | null>(null);
  const [skippedCount, setSkippedCount] = useState(0); // silence skips counter

  const micRecorderRef    = useRef<MediaRecorder | null>(null);
  const systemRecorderRef = useRef<MediaRecorder | null>(null);
  const micChunksRef      = useRef<Blob[]>([]);
  const sysChunksRef      = useRef<Blob[]>([]);
  const micIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const sysIntervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef         = useRef<HTMLDivElement>(null);
  const hasKB             = context.length > 0;

  // Live level meters — also expose peakRef for VAD gating
  const { level: micLevel, peakRef: micPeakRef } = useLevelMeter(micStream);
  const { level: sysLevel, peakRef: sysPeakRef } = useLevelMeter(sysStream);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [transcript]);

  // ─── AI answer ──────────────────────────────────────────────────────────────
  const getAiAnswer = useCallback(async (entryId: string, question: string) => {
    setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, aiLoading: true, aiAnswer: '' } : e));
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, context, model }),
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
            if (d.text) setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, aiAnswer: (e.aiAnswer || '') + d.text } : e));
            if (d.done) setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, aiLoading: false } : e));
            if (d.error) setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, aiLoading: false, aiAnswer: `⚠️ ${d.error}` } : e));
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setTranscript((p) => p.map((en) => en.id === entryId ? { ...en, aiLoading: false, aiAnswer: `⚠️ ${String(e)}` } : en));
    }
  }, [model, context]);

  // ─── Checklist match ─────────────────────────────────────────────────────────
  const tryMatchChecklist = useCallback(async (spoken: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/match-question', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spoken, questions }),
      });
      const d = await res.json();
      if (d.match) { onToggleQuestion(d.match); return d.match; }
    } catch { /* silent */ }
    return null;
  }, [questions, onToggleQuestion]);

  // ─── Process audio chunk with VAD ────────────────────────────────────────────
  // peakLevel comes from the AnalyserNode tick (already running) — no blob decoding needed
  const processChunk = useCallback(async (chunks: Blob[], speaker: Speaker, peakLevel: number) => {
    if (!chunks.length) return;
    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (blob.size < 500) return;

    // ── Voice Activity Detection via AnalyserNode peak ────────────────────────
    if (peakLevel < SPEECH_THRESHOLD) {
      setSkippedCount((n) => n + 1);
      return;
    }

    const fd = new FormData();
    fd.append('audio', blob, 'audio.webm');
    fd.append('speaker', speaker);

    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const { text } = await res.json() as { text: string };
      if (!text?.trim()) return;

      // ── Drop known Whisper hallucinations ────────────────────────────────────
      if (HALLUCINATIONS.has(text.trim().toLowerCase())) {
        setSkippedCount((n) => n + 1);
        return;
      }

      const entryId = `${Date.now()}-${speaker}`;
      const isQuestion = isLikelyQuestion(text);
      setTranscript((p) => [...p, { id: entryId, speaker, text: text.trim(), isQuestion }]);

      if (speaker === 'client' && isQuestion && hasKB) {
        getAiAnswer(entryId, text.trim());
      } else if (speaker === 'you') {
        const matchId = await tryMatchChecklist(text.trim());
        if (matchId) setTranscript((p) => p.map((e) => e.id === entryId ? { ...e, matchedQuestionId: matchId } : e));
      }
    } catch { /* ignore single bad chunk */ }
  }, [hasKB, getAiAnswer, tryMatchChecklist]);

  // ─── Build MediaRecorder ─────────────────────────────────────────────────────
  const buildRecorder = useCallback((
    stream: MediaStream,
    chunksRef: React.MutableRefObject<Blob[]>,
    intervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
    speaker: Speaker,
    peakRef: React.MutableRefObject<number>,
  ) => {
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    intervalRef.current = setInterval(() => {
      if (!chunksRef.current.length) return;
      const toSend   = [...chunksRef.current]; chunksRef.current = [];
      const peak     = peakRef.current;
      peakRef.current = 0;  // reset for next interval
      processChunk(toSend, speaker, peak);
    }, CHUNK_INTERVAL);
    recorder.start(1000);
    return recorder;
  }, [processChunk]);

  // ─── Start recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(''); setSkippedCount(0);
    setStatus('Requesting microphone…');
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      setMicStream(mic);
      setStatus('Requesting system audio — select your Google Meet tab and enable "Share tab audio"…');

      let sys: MediaStream | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true as any, audio: true });
        display.getVideoTracks().forEach((t) => t.stop());
        sys = display;
        setSysStream(display);
      } catch {
        setStatus('⚠️ No system audio — only your mic will be transcribed.');
      }

      micRecorderRef.current = buildRecorder(mic, micChunksRef, micIntervalRef, 'you', micPeakRef);
      if (sys?.getAudioTracks().length) {
        systemRecorderRef.current = buildRecorder(sys, sysChunksRef, sysIntervalRef, 'client', sysPeakRef);
        setStatus('');
      }
      setRecording(true);
    } catch (e) {
      setError(`Could not start: ${String(e)}`); setStatus('');
    }
  }, [buildRecorder]);

  // ─── Stop recording ───────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    [micIntervalRef, sysIntervalRef].forEach((r) => { if (r.current) clearInterval(r.current); });
    if (micChunksRef.current.length) processChunk([...micChunksRef.current], 'you', micPeakRef.current);
    if (sysChunksRef.current.length) processChunk([...sysChunksRef.current], 'client', sysPeakRef.current);
    micRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    systemRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    micRecorderRef.current?.stop(); systemRecorderRef.current?.stop();
    micRecorderRef.current = null; systemRecorderRef.current = null;
    micChunksRef.current = []; sysChunksRef.current = [];
    setMicStream(null); setSysStream(null);
    setRecording(false); setStatus('');
  }, [processChunk]);

  const askManual = async () => {
    const q = manualInput.trim();
    if (!q) return;
    const entryId = Date.now().toString();
    setTranscript((p) => [...p, { id: entryId, speaker: 'client', text: q, isQuestion: true }]);
    setManualInput('');
    if (hasKB) getAiAnswer(entryId, q);
  };

  const pending = questions.filter((q) => !q.asked);
  const askedQs = questions.filter((q) => q.asked);

  return (
    <div className="flex flex-col gap-3" style={{ height: 'calc(100vh - 120px)' }}>

      {/* Controls row */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={recording ? stopRecording : startRecording}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${recording ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40' : 'bg-slate-700 hover:bg-slate-600 text-slate-100'}`}>
          <span className={`w-2 h-2 rounded-full ${recording ? 'bg-white animate-pulse' : 'bg-slate-400'}`} />
          {recording ? 'Stop Recording' : 'Start Recording'}
        </button>

        <select value={model} onChange={(e) => setModel(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 focus:outline-none">
          {GROQ_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>

        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border ${hasKB ? 'border-green-800 bg-green-900/20 text-green-400' : 'border-slate-700 text-slate-500'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${hasKB ? 'bg-green-400' : 'bg-slate-500'}`} />
          {hasKB ? 'Knowledge base loaded' : 'No knowledge base'}
        </div>

        {skippedCount > 0 && (
          <span className="text-xs text-slate-500">
            {skippedCount} silence chunk{skippedCount !== 1 ? 's' : ''} skipped
          </span>
        )}

        {transcript.length > 0 && (
          <button onClick={() => { if (confirm('Clear transcript?')) { setTranscript([]); setSkippedCount(0); } }}
            className="ml-auto text-xs text-slate-500 hover:text-red-400 transition-colors">
            Clear transcript
          </button>
        )}
      </div>

      {/* Audio level meters — real-time VAD verification */}
      {recording && (
        <div className="px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
          <p className="text-xs text-slate-400 font-medium mb-1">Audio levels — speech detected above the threshold line</p>
          <LevelBar level={micLevel} label="You (mic)" color="#6366f1" />
          <LevelBar level={sysLevel} label="Client (sys)" color="#10b981" />
          <p className="text-xs text-slate-600 mt-1">
            Chunks below the speech threshold are silently dropped to prevent Whisper hallucinations (e.g. "Thank you" on silence).
          </p>
        </div>
      )}

      {/* Status / instructions */}
      {(error || status || !recording) && (
        <div className={`px-4 py-3 rounded-xl text-sm border ${error ? 'bg-red-900/30 border-red-700 text-red-300' : 'bg-slate-800/60 border-slate-700 text-slate-400'}`}>
          {error || status || (
            <span>
              Press <strong className="text-slate-200">Start Recording</strong>. Allow mic → then select your{' '}
              <strong className="text-slate-200">Google Meet tab</strong> in the share dialog and tick{' '}
              <strong className="text-slate-200">"Share tab audio"</strong>.
              Your mic = <span className="text-indigo-400">You</span> · Meet audio = <span className="text-emerald-400">Client</span>.
              Watch the audio meters to confirm both streams are active.
            </span>
          )}
        </div>
      )}

      {/* Main area */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Transcript */}
        <div className="flex-1 flex flex-col gap-3 min-h-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Transcript</h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-indigo-500/60" />You (mic)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500/60" />Client (system)</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500/60" />Client Q + AI answer</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin space-y-3 pr-1 rounded-xl bg-slate-900/50 border border-slate-800 p-4">
            {transcript.length === 0 && (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm text-center">
                {recording
                  ? <span className="flex items-center gap-2">
                      <span className="inline-flex gap-1">{[0,150,300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</span>
                      Listening — transcript appears every ~5 seconds when speech is detected
                    </span>
                  : 'Transcript will appear here once you start recording'}
              </div>
            )}

            {transcript.map((entry) => (
              <div key={entry.id}>
                <div className="flex items-start gap-2">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 text-white ${entry.speaker === 'you' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
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
                    {(entry.aiAnswer !== undefined || entry.aiLoading) && (
                      <div className="mt-2 ml-2 pl-3 border-l-2 border-amber-600/40">
                        <p className="text-xs text-amber-500 font-medium mb-1">AI Answer</p>
                        {entry.aiLoading && !entry.aiAnswer
                          ? <span className="flex items-center gap-1.5 text-slate-500 text-sm">
                              <span className="inline-flex gap-1">{[0,150,300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</span>
                              Looking up answer…
                            </span>
                          : <p className="text-sm text-slate-200 leading-relaxed">
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
            <div ref={bottomRef} />
          </div>

          {/* Manual input */}
          <div className="space-y-1.5">
            <p className="text-xs text-slate-500">Manual — type a client question to look up instantly:</p>
            <div className="flex gap-2">
              <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)}
                placeholder={hasKB ? 'Type client question…' : 'Load knowledge base first…'}
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

        {/* Checklist sidebar */}
        <div className="w-64 flex-shrink-0 flex flex-col gap-3 min-h-0">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Your Questions{pending.length > 0 && <span className="ml-2 text-indigo-400">{pending.length} left</span>}
          </h3>
          {questions.length === 0
            ? <p className="text-xs text-slate-500">Add questions in the Prep tab</p>
            : (
              <div className="flex-1 overflow-y-auto scrollbar-thin space-y-1.5 min-h-0">
                {pending.map((q) => (
                  <button key={q.id} onClick={() => onToggleQuestion(q.id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-800/70 border border-slate-700 hover:border-indigo-500/60 hover:bg-indigo-950/30 transition-colors group">
                    <p className="text-xs text-slate-300 leading-relaxed">{q.text}</p>
                    <p className="text-xs text-slate-600 mt-0.5 group-hover:text-indigo-400">Tap to mark asked</p>
                  </button>
                ))}
                {askedQs.length > 0 && (
                  <>
                    <p className="text-xs text-slate-600 pt-2 pb-1 border-t border-slate-800 mt-2">Asked</p>
                    {askedQs.map((q) => (
                      <button key={q.id} onClick={() => onToggleQuestion(q.id)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-slate-800/20 border border-slate-700/30 transition-colors">
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
