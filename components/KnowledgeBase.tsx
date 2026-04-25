'use client';

import { useState, useRef } from 'react';

export interface KBSource {
  id: string;
  label: string;
  content: string;
  addedAt: string;
}

interface Props {
  sources: KBSource[];
  onAdd: (source: KBSource) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function wordCount(sources: KBSource[]) {
  return sources.reduce((acc, s) => acc + s.content.split(/\s+/).length, 0);
}

export default function KnowledgeBase({ sources, onAdd, onRemove, onClear }: Props) {
  const [urlInput, setUrlInput] = useState('');
  const [maxPages, setMaxPages] = useState(50);
  const [crawlLog, setCrawlLog] = useState<string[]>([]);
  const [crawling, setCrawling] = useState(false);

  const [pasteText, setPasteText] = useState('');
  const [pasteLabel, setPasteLabel] = useState('');

  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const wc = wordCount(sources);

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
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter((l) => l.startsWith('data: '));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'progress') {
            setCrawlLog((p) => [...p.slice(-30), `[${data.crawled}/${data.total}] ${data.currentUrl}`]);
          } else if (data.type === 'done') {
            for (const page of data.pages as { url: string; text: string }[]) {
              onAdd({ id: `${Date.now()}-${page.url}`, label: page.url, content: page.text, addedAt: new Date().toISOString() });
            }
            setCrawlLog((p) => [...p, `Done! Added ${data.pagesAdded} pages`]);
            setUrlInput('');
          } else if (data.type === 'error') {
            setCrawlLog((p) => [...p, `Error: ${data.message}`]);
          }
        }
      }
    } catch (e) {
      setCrawlLog((p) => [...p, `Failed: ${String(e)}`]);
    } finally {
      setCrawling(false);
    }
  };

  const addPaste = () => {
    if (!pasteText.trim()) return;
    const label = pasteLabel.trim() || `Pasted text (${new Date().toLocaleTimeString()})`;
    onAdd({ id: Date.now().toString(), label, content: pasteText.replace(/\s+/g, ' ').trim(), addedAt: new Date().toISOString() });
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
          onAdd({ id: Date.now().toString() + r.file, label: r.file, content: r.text, addedAt: new Date().toISOString() });
        }
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${wc > 0 ? 'bg-green-400' : 'bg-slate-500'}`} />
          <span className="text-sm text-slate-300">
            {wc > 0 ? `${wc.toLocaleString()} words · ${sources.length} source${sources.length !== 1 ? 's' : ''}` : 'No knowledge base loaded'}
          </span>
        </div>
        {sources.length > 0 && (
          <button onClick={() => { if (confirm('Clear all knowledge base content?')) onClear(); }} className="text-xs text-red-400 hover:text-red-300 transition-colors">
            Clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Website Crawl */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="text-blue-400">Web</span> Website Crawl
          </h3>
          <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://yourcompany.com"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && crawl()} />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Max pages:</label>
            <input type="number" value={maxPages} onChange={(e) => setMaxPages(Number(e.target.value))} min={1} max={200}
              className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-xs text-slate-100 focus:outline-none focus:border-blue-500" />
          </div>
          <button onClick={crawl} disabled={crawling || !urlInput.trim()}
            className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors">
            {crawling ? 'Crawling...' : 'Start Crawl'}
          </button>
          {crawlLog.length > 0 && (
            <div className="max-h-32 overflow-y-auto scrollbar-thin rounded bg-slate-900 p-2 space-y-0.5">
              {crawlLog.map((line, i) => <p key={i} className="text-xs text-slate-400 font-mono truncate">{line}</p>)}
            </div>
          )}
        </div>

        {/* File Upload */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="text-purple-400">File</span> Upload Documents
          </h3>
          <p className="text-xs text-slate-400">PDF, DOCX, DOC, TXT, MD</p>
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-purple-500 transition-colors"
            onClick={() => fileRef.current?.click()}>
            <p className="text-sm text-slate-400">{uploading ? 'Uploading...' : 'Click to select files'}</p>
            <p className="text-xs text-slate-500 mt-1">or drag and drop</p>
          </div>
          <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.doc,.txt,.md" className="hidden" onChange={upload} />
        </div>

        {/* Paste */}
        <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700 space-y-3 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span className="text-green-400">Text</span> Paste Content
          </h3>
          <input type="text" value={pasteLabel} onChange={(e) => setPasteLabel(e.target.value)}
            placeholder="Label (optional — e.g. 'Pricing FAQ')"
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-green-500" />
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste any company content — FAQs, product descriptions, pricing, policies..."
            rows={5}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-green-500 resize-none" />
          <button onClick={addPaste} disabled={!pasteText.trim()}
            className="px-4 py-2 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors">
            Add to Knowledge Base
          </button>
        </div>
      </div>

      {/* Sources list */}
      {sources.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Loaded Sources</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/30 border border-slate-700/50 group">
                <span className="text-xs text-slate-300 truncate flex-1">{s.label}</span>
                <button onClick={() => onRemove(s.id)}
                  className="ml-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all text-xs">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
