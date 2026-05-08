'use client';

import { useState, useRef } from 'react';
import { HOME_BUTTON_3D_PRIMARY } from '@/lib/home-button-styles';
import type { KBEntry } from '@/lib/home-types';

interface Props {
  globalEntries: KBEntry[];
  selectedGlobalKbIds: string[];
  meetingEntries: KBEntry[];
  onToggleKbEntry: (id: string) => void;
  onAddMeetingEntry: (entry: KBEntry) => void;
  onRemoveMeetingEntry: (id: string) => void;
}

type InputTab = 'url' | 'text' | 'file';
const typeLabel: Record<KBEntry['type'], string> = { url: 'URL', text: 'Text', file: 'File' };

export default function MeetingLocalKnowledgeBase({
  globalEntries,
  selectedGlobalKbIds,
  meetingEntries,
  onToggleKbEntry,
  onAddMeetingEntry,
  onRemoveMeetingEntry,
}: Props) {
  const [activeInput, setActiveInput] = useState<InputTab>('url');
  const [pasteLabel, setPasteLabel] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [crawling, setCrawling] = useState(false);
  const [crawlLog, setCrawlLog] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedCount = selectedGlobalKbIds.length + meetingEntries.length;

  // ── Crawl ──────────────────────────────────────────────────────────────────
  const crawl = async () => {
    if (!urlInput.trim()) return;
    setCrawling(true);
    setCrawlLog([`Starting crawl: ${urlInput}`]);
    try {
      const res = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), maxPages }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder('utf-8', { fatal: false });
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'progress') {
              setCrawlLog((p) => [...p.slice(-20), `[${data.crawled}/${data.total}] ${data.currentUrl}`]);
            } else if (data.type === 'page') {
              onAddMeetingEntry({ id: `mkb-${Date.now()}-${Math.random()}`, label: data.url, content: data.text, type: 'url', addedAt: new Date().toISOString() });
            } else if (data.type === 'done') {
              setCrawlLog((p) => [...p, `✓ Done — ${data.pagesAdded} page(s) added`]);
              setUrlInput('');
            } else if (data.type === 'error') {
              setCrawlLog((p) => [...p, `Error: ${data.message}`]);
            }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setCrawlLog((p) => [...p, `Failed: ${String(e)}`]);
    } finally {
      setCrawling(false);
    }
  };

  const addText = () => {
    if (!pasteText.trim()) return;
    onAddMeetingEntry({ id: `mkb-${Date.now()}`, label: pasteLabel.trim() || `Note (${new Date().toLocaleTimeString()})`, content: pasteText.trim(), type: 'text', addedAt: new Date().toISOString() });
    setPasteText('');
    setPasteLabel('');
  };

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const form = new FormData();
    for (const f of files) form.append('files', f);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      for (const r of data.results as { file: string; status: string; text?: string }[]) {
        if (r.status === 'ok' && r.text) {
          onAddMeetingEntry({ id: `mkb-${Date.now()}-${r.file}`, label: r.file, content: r.text, type: 'file', addedAt: new Date().toISOString() });
        }
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm">⭐️</div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Meeting Knowledge Base</h3>
            <p className="text-xs text-slate-500">
              {selectedCount > 0 ? `${selectedCount} source${selectedCount !== 1 ? 's' : ''} active for this meeting` : 'Select global sources or add meeting-specific context'}
            </p>
          </div>
        </div>
        {selectedCount > 0 && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />{selectedCount} active
          </span>
        )}
      </div>

      <div className="p-5 space-y-5">
        {/* Global KB — individual checkboxes */}
        <div>
          <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400 mb-3">Global Knowledge Base</p>
          {globalEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-center">
              <p className="text-xs text-slate-500">
                No global KB yet.{' '}
                <a href="/home" className="text-indigo-500 hover:underline">Add from the dashboard.</a>
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {globalEntries.map((entry) => {
                const checked = selectedGlobalKbIds.includes(entry.id);
                return (
                  <li key={entry.id}>
                    <label className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${checked ? 'border-indigo-300 bg-indigo-50/60' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleKbEntry(entry.id)}
                        className="mt-0.5 w-4 h-4 rounded accent-indigo-500 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1 py-0.5 rounded bg-indigo-100 text-indigo-600">{typeLabel[entry.type]}</span>
                          <span className="text-xs font-medium text-slate-800 truncate">{entry.label}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">{entry.content.slice(0, 80)}…</p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Meeting-specific sources */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">Meeting-Specific Sources</p>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {(['url', 'text', 'file'] as InputTab[]).map((tab) => (
              <button key={tab} onClick={() => setActiveInput(tab)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeInput === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {tab === 'url' ? '🌐 Web Crawl' : tab === 'file' ? '📎 File' : '📝 Text'}
              </button>
            ))}
          </div>

          {activeInput === 'url' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input type="url" placeholder="https://…" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !crawling && crawl()}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
                <input type="number" value={maxPages} onChange={(e) => setMaxPages(Math.max(1, Number(e.target.value)))} min={1} max={50} title="Max pages"
                  className="w-16 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400 text-center" />
              </div>
              <button onClick={crawl} disabled={crawling || !urlInput.trim()} className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed`}>
                {crawling ? 'Crawling…' : 'Start Crawl'}
              </button>
              {crawlLog.length > 0 && (
                <div className="max-h-24 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-0.5">
                  {crawlLog.map((line, i) => <p key={i} className="text-[11px] text-slate-500 font-mono truncate">{line}</p>)}
                </div>
              )}
            </div>
          )}

          {activeInput === 'text' && (
            <div className="space-y-2">
              <input type="text" placeholder="Label (optional)" value={pasteLabel} onChange={(e) => setPasteLabel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
              <textarea placeholder="Paste notes, context, FAQs…" value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none" />
              <button onClick={addText} disabled={!pasteText.trim()} className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed`}>Add Text</button>
            </div>
          )}

          {activeInput === 'file' && (
            <div>
              <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
                <p className="text-2xl mb-1">📎</p>
                <p className="text-sm font-medium text-slate-700">{uploading ? 'Uploading…' : 'Click to upload'}</p>
                <p className="text-xs text-slate-400 mt-0.5">PDF, DOCX, DOC, TXT, MD</p>
              </div>
              <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md" className="hidden" onChange={upload} />
            </div>
          )}

          {meetingEntries.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {meetingEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 shrink-0">{typeLabel[entry.type]}</span>
                    <span className="text-xs text-slate-700 truncate">{entry.label}</span>
                  </div>
                  <button onClick={() => onRemoveMeetingEntry(entry.id)} className="ml-2 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs shrink-0">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
