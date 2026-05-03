'use client';

import { useState, useEffect, useRef } from 'react';
import type { Question } from './QuestionChecklist';
import { SUMMARY_PERSIST_DEBOUNCE_MS } from '@/lib/constants';
import { MarkdownLine } from './MarkdownLine';

interface TranscriptEntry {
  id: string;
  speaker: 'you' | 'client';
  text: string;
  isQuestion: boolean;
  aiAnswer?: string;
  matchedQuestionId?: string;
}

interface Props {
  transcript: TranscriptEntry[];
  questions: Question[];
  model: string;
  /** When set, AI summary text is PATCHed to `/api/calls/[id]` after generation finishes. */
  savedCallId?: string | null;
  onClose: () => void;
}

export default function MeetingSummary({ transcript, questions, model, savedCallId, onClose }: Props) {
  const [summary, setSummary]     = useState('');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [activeTab, setActiveTab] = useState<'summary' | 'qa' | 'transcript'>('summary');
  /** Latest summary text for PATCH after streaming (state + ref stay in sync for timing). */
  const summaryRef = useRef('');

  // Generate summary on mount
  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      try {
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, questions, model }),
        });
        const reader = res.body!.getReader();
        const dec = new TextDecoder('utf-8', { fatal: false });
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split('\n\n'); buf = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data: ')) continue;
            try {
              const d = JSON.parse(line.slice(6));
              if (d.text)  setSummary((p) => p + d.text);
              if (d.done)  setLoading(false);
              if (d.error) { setError(d.error); setLoading(false); }
            } catch { /* skip */ }
          }
        }
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) { setError(String(e)); setLoading(false); }
      }
    };
    generate();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  // After streaming finishes, wait one tick so the last summary chunk is committed, then PATCH.
  useEffect(() => {
    if (!savedCallId || loading) return;
    const id = savedCallId;
    const handle = window.setTimeout(() => {
      void fetch(`/api/calls/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: summaryRef.current }),
      });
    }, SUMMARY_PERSIST_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [savedCallId, loading]);

  // ─── PDF export ──────────────────────────────────────────────────────────────
  const exportPdf = () => {
    const askedQs = questions.filter((q) => q.asked);

    const qaHtml = askedQs.length
      ? askedQs.map((q) => `
          <div class="qa-item">
            <div class="question">❓ ${q.text}</div>
            <div class="answer">${q.clientAnswer?.trim() || '<em>Answer not captured</em>'}</div>
          </div>`).join('')
      : '<p>No prepared questions were asked.</p>';

    const transcriptHtml = transcript.map((e) => `
      <div class="entry ${e.speaker}">
        <span class="speaker">${e.speaker === 'you' ? 'You' : 'Client'}:</span>
        ${e.text}
        ${e.aiAnswer ? `<div class="ai-ans">💡 AI: ${e.aiAnswer}</div>` : ''}
      </div>`).join('');

    // Convert basic markdown to HTML for the summary section
    const summaryHtml = summary
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/## (.+)/g, '<h2>$1</h2>')
      .replace(/### (.+)/g, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n/g, '<br>');

    const win = window.open('', '_blank');
    if (!win) { alert('Please allow pop-ups to export PDF.'); return; }

    win.document.write(`<!DOCTYPE html><html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Meeting Summary · ${new Date().toLocaleDateString()}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;max-width:820px;margin:40px auto;color:#111;font-size:14px;line-height:1.7;padding:0 24px}
    h1{font-size:24px;color:#1e1b4b;border-bottom:3px solid #4f46e5;padding-bottom:10px;margin-bottom:4px}
    h2{font-size:15px;color:#4f46e5;margin-top:28px;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
    h3{font-size:13px;color:#374151;margin-top:14px;margin-bottom:4px}
    p{margin:6px 0}
    ul{padding-left:20px;margin:6px 0}
    li{margin:3px 0}
    strong{font-weight:600}
    .meta{color:#6b7280;font-size:12px;margin:8px 0 32px}
    .qa-item{margin:12px 0;padding:12px 16px;background:#f5f3ff;border-left:4px solid #4f46e5;border-radius:4px}
    .question{font-weight:600;color:#1e1b4b;margin-bottom:6px}
    .answer{color:#374151}
    .entry{padding:5px 10px;border-radius:4px;margin:4px 0;font-size:13px}
    .entry.you{background:#eff6ff}
    .entry.client{background:#f0fdf4}
    .speaker{font-weight:700}
    .entry.you .speaker{color:#4338ca}
    .entry.client .speaker{color:#059669}
    .ai-ans{margin-top:6px;padding:6px 10px;background:#fffbeb;border-left:2px solid #f59e0b;font-size:12px;color:#78350f;border-radius:2px}
    hr{border:none;border-top:1px solid #e5e7eb;margin:28px 0}
    @media print{body{margin:20px auto}button{display:none}}
  </style>
</head>
<body>
  <h1>Minutes of Meeting</h1>
  <p class="meta">
    Date: ${new Date().toLocaleString()} &nbsp;·&nbsp;
    Duration: ~${Math.ceil(transcript.length / 6)} min (est.) &nbsp;·&nbsp;
    ${transcript.length} utterances &nbsp;·&nbsp;
    ${askedQs.length}/${questions.length} prepared questions asked
  </p>

  <h2>📋 AI-Generated Summary</h2>
  <div>${summaryHtml || '<p>Summary not available.</p>'}</div>

  ${askedQs.length ? `<hr/><h2>❓ Prepared Questions & Client Responses</h2>${qaHtml}` : ''}

  <hr/>
  <h2>📝 Full Transcript</h2>
  ${transcriptHtml || '<p>No transcript available.</p>'}
</body>
</html>`);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  const askedQs = questions.filter((q) => q.asked);
  const tabs: { id: 'summary' | 'qa' | 'transcript'; label: string }[] = [
    { id: 'summary',    label: '📋 Summary' },
    { id: 'qa',         label: `❓ Q&A (${askedQs.length})` },
    { id: 'transcript', label: `📝 Transcript (${transcript.length})` },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Meeting Summary</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {new Date().toLocaleString()} · {transcript.length} utterances · {askedQs.length}/{questions.length} questions asked
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportPdf}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-medium transition-colors text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Export PDF
          </button>
          <button onClick={onClose}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors">
            Close
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-4 border-b border-slate-800 flex-shrink-0">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 max-w-4xl mx-auto w-full">

        {/* ── Summary tab ── */}
        {activeTab === 'summary' && (
          <div className="space-y-1">
            {loading && !summary && (
              <div className="flex items-center gap-3 text-slate-400 text-sm py-8">
                <span className="inline-flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${d}ms` }} />
                  ))}
                </span>
                Generating meeting summary…
              </div>
            )}
            {error && <p className="text-red-400 text-sm">⚠️ {error}</p>}
            {summary.split('\n').map((line, i) => <MarkdownLine key={i} line={line} />)}
            {loading && summary && (
              <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-1 align-middle" />
            )}
          </div>
        )}

        {/* ── Q&A tab ── */}
        {activeTab === 'qa' && (
          <div className="space-y-4">
            {askedQs.length === 0
              ? <p className="text-slate-500 text-sm py-8 text-center">No prepared questions were asked during the call.</p>
              : askedQs.map((q) => (
                <div key={q.id} className="rounded-xl border border-slate-700 bg-slate-800/40 overflow-hidden">
                  <div className="px-4 py-3 bg-slate-800/60 border-b border-slate-700">
                    <p className="text-sm font-medium text-slate-200">❓ {q.text}</p>
                  </div>
                  <div className="px-4 py-3">
                    {q.clientAnswer
                      ? <p className="text-sm text-emerald-300 leading-relaxed">{q.clientAnswer}</p>
                      : <p className="text-sm text-slate-500 italic">Client answer not captured</p>
                    }
                    {q.notes && (
                      <p className="text-xs text-slate-500 mt-2 border-t border-slate-700 pt-2">
                        Note: {q.notes}
                      </p>
                    )}
                  </div>
                </div>
              ))
            }
            {questions.filter(q => !q.asked).length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-800">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">
                  Questions not asked
                </p>
                {questions.filter(q => !q.asked).map((q) => (
                  <p key={q.id} className="text-sm text-slate-600 py-1 line-through">{q.text}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Transcript tab ── */}
        {activeTab === 'transcript' && (
          <div className="space-y-3">
            {transcript.length === 0
              ? <p className="text-slate-500 text-sm py-8 text-center">No transcript recorded.</p>
              : transcript.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mt-0.5 ${
                    entry.speaker === 'you' ? 'bg-indigo-600' : 'bg-emerald-600'
                  }`}>
                    {entry.speaker === 'you' ? 'Y' : 'C'}
                  </div>
                  <div className="flex-1">
                    <div className={`px-3 py-2 rounded-xl rounded-tl-sm text-sm leading-relaxed ${
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
                    {entry.aiAnswer && (
                      <div className="mt-1 ml-2 pl-3 border-l-2 border-amber-600/30">
                        <p className="text-xs text-amber-500 font-medium">AI Answer</p>
                        <p className="text-sm text-slate-300 leading-relaxed">{entry.aiAnswer}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
