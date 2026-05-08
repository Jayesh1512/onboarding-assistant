'use client';

import { useState, useEffect, useRef } from 'react';
import { HOME_BUTTON_3D_PRIMARY } from '@/lib/home-button-styles';
import type { KBEntry } from '@/lib/home-types';

type InputTab = 'url' | 'text' | 'file';

function wordCount(entries: KBEntry[]) {
  return entries.reduce((acc, e) => acc + e.content.split(/\s+/).filter(Boolean).length, 0);
}

export default function MeetingKnowledgeBase() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeInput, setActiveInput] = useState<InputTab>('url');

  // URL / crawl
  const [urlInput, setUrlInput] = useState('');
  const [maxPages, setMaxPages] = useState(20);
  const [crawling, setCrawling] = useState(false);
  const [crawlLog, setCrawlLog] = useState<string[]>([]);

  // Text paste
  const [pasteLabel, setPasteLabel] = useState('');
  const [pasteText, setPasteText] = useState('');

  // File upload
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/global-kb')
      .then((r) => r.json())
      .then(({ entries: e }) => setEntries(e ?? []))
      .finally(() => setLoading(false));
  }, []);

  const persist = async (entry: KBEntry) => {
    await fetch('/api/global-kb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  };

  const addEntry = (entry: KBEntry) => {
    setEntries((prev) => [...prev, entry]);
    persist(entry).catch(console.error);
  };

  const removeEntry = async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/global-kb/${id}`, { method: 'DELETE' });
  };

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
              setCrawlLog((p) => [...p.slice(-30), `[${data.crawled}/${data.total}] ${data.currentUrl}`]);
            } else if (data.type === 'page') {
              const entry: KBEntry = { id: `kb-${Date.now()}-${Math.random()}`, label: data.url, content: data.text, type: 'url', addedAt: new Date().toISOString() };
              addEntry(entry);
            } else if (data.type === 'done') {
              setCrawlLog((p) => [...p, `✓ Done — ${data.pagesAdded} page(s) added`]);
              setUrlInput('');
            } else if (data.type === 'error') {
              setCrawlLog((p) => [...p, `Error: ${data.message}`]);
            }
          } catch { /* skip malformed SSE */ }
        }
      }
    } catch (e) {
      setCrawlLog((p) => [...p, `Failed: ${String(e)}`]);
    } finally {
      setCrawling(false);
    }
  };

  // ── Paste ──────────────────────────────────────────────────────────────────
  const addText = () => {
    if (!pasteText.trim()) return;
    addEntry({ id: `kb-${Date.now()}`, label: pasteLabel.trim() || `Note (${new Date().toLocaleTimeString()})`, content: pasteText.trim(), type: 'text', addedAt: new Date().toISOString() });
    setPasteText('');
    setPasteLabel('');
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
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
          addEntry({ id: `kb-${Date.now()}-${r.file}`, label: r.file, content: r.text, type: 'file', addedAt: new Date().toISOString() });
        }
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const wc = wordCount(entries);
  const typeLabel: Record<KBEntry['type'], string> = { url: 'URL', text: 'Text', file: 'File' };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-sm">⭐️</div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Global Knowledge Base</h3>
            <p className="text-xs text-slate-500">
              {loading ? 'Loading…' : wc > 0 ? `${wc.toLocaleString()} words · ${entries.length} source${entries.length !== 1 ? 's' : ''}` : 'Add context available across all meetings'}
            </p>
          </div>
        </div>
        {wc > 0 && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-[11px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" /> Active
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {(['url', 'text', 'file'] as InputTab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveInput(tab)} className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeInput === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {tab === 'url' ? 'Web Crawl' : tab === 'file' ? 'Upload File' : 'Paste Text'}
            </button>
          ))}
        </div>

        {activeInput === 'url' && (
          <div className="space-y-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
              <input type="url" placeholder="https://company.com/about" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !crawling && crawl()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-500 shrink-0">Max pages:</label>
              <input type="number" value={maxPages} onChange={(e) => setMaxPages(Math.max(1, Math.min(200, Number(e.target.value))))} min={1} max={200}
                className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800 outline-none focus:border-indigo-400" />
              <button onClick={crawl} disabled={crawling || !urlInput.trim()} className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-1.5 text-xs disabled:opacity-40 disabled:cursor-not-allowed`}>
                {crawling ? 'Crawling…' : 'Start Crawl'}
              </button>
            </div>
            {crawlLog.length > 0 && (
              <div className="max-h-28 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-0.5">
                {crawlLog.map((line, i) => <p key={i} className="text-[11px] text-slate-500 font-mono truncate">{line}</p>)}
              </div>
            )}
          </div>
        )}

        {activeInput === 'text' && (
          <div className="space-y-2">
            <input type="text" placeholder="Label (e.g. Pricing FAQ)" value={pasteLabel} onChange={(e) => setPasteLabel(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-colors" />
            <textarea placeholder="Paste any context — FAQs, product sheets, pricing…" value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={4}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none" />
            <button onClick={addText} disabled={!pasteText.trim()} className={`${HOME_BUTTON_3D_PRIMARY} px-4 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed`}>
              Add to Knowledge Base
            </button>
          </div>
        )}

        {activeInput === 'file' && (
          <div className="space-y-2">
            <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/30 transition-all">
              <p className="text-2xl mb-2">📎</p>
              <p className="text-sm font-medium text-slate-700">{uploading ? 'Uploading…' : 'Click to upload files'}</p>
              <p className="text-xs text-slate-400 mt-1">PDF, DOCX, DOC, TXT, MD</p>
            </div>
            <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md" className="hidden" onChange={upload} />
          </div>
        )}

        {entries.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">Loaded Sources</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-600 shrink-0">{typeLabel[entry.type]}</span>
                    <span className="text-xs text-slate-700 truncate">{entry.label}</span>
                  </div>
                  <button onClick={() => removeEntry(entry.id)} className="ml-2 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs shrink-0">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
