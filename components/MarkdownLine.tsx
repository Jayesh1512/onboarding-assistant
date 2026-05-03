'use client';

/** Minimal markdown → JSX for summary lines (headings, lists, bold). */
export function MarkdownLine({ line }: { line: string }) {
  if (line.startsWith('## ')) {
    return (
      <h2 className="text-base font-semibold text-indigo-400 mt-6 mb-2 border-b border-slate-700 pb-1">
        {line.slice(3)}
      </h2>
    );
  }
  if (line.startsWith('### ')) {
    return <h3 className="text-sm font-semibold text-slate-300 mt-3 mb-1">{line.slice(4)}</h3>;
  }
  if (line.startsWith('- ') || line.startsWith('* ')) {
    return <li className="text-sm text-slate-300 ml-4 list-disc">{line.slice(2)}</li>;
  }
  if (!line.trim()) return <div className="h-2" />;
  const parts = line.split(/\*\*(.+?)\*\*/g);
  return (
    <p className="text-sm text-slate-300 leading-relaxed">
      {parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="text-slate-100">{p}</strong> : p))}
    </p>
  );
}
