import Link from 'next/link';
import { listCallsFromDb } from '@/lib/calls-db';

export const dynamic = 'force-dynamic';

export default async function CallsPage() {
  const result = await listCallsFromDb();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-sm font-semibold text-slate-100">Call history</h1>
          <p className="text-xs text-slate-500 mt-0.5">Transcripts and Q&A stored in Supabase</p>
        </div>
        <Link
          href="/"
          className="text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
          ← Back to assistant
        </Link>
      </header>

      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        {!result.ok ? (
          <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
            <p className="font-medium text-amber-100">Database unavailable</p>
            <p className="mt-2 text-amber-200/90">{result.error}</p>
            <p className="mt-3 text-xs text-slate-400">
              Add <code className="text-slate-300">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="text-slate-300">SUPABASE_SERVICE_ROLE_KEY</code> to your environment, run the SQL in{' '}
              <code className="text-slate-300">supabase/migrations/</code>, then restart the app.
            </p>
          </div>
        ) : result.calls.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12">
            No calls saved yet. End a live recording to store a call, then return here.
          </p>
        ) : (
          <ul className="space-y-3">
            {result.calls.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/calls/${c.id}`}
                  className="block rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 hover:border-indigo-700/50 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                    {c.has_summary ? (
                      <span className="text-xs text-emerald-400">Summary</span>
                    ) : (
                      <span className="text-xs text-slate-500">No summary</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {c.utterance_count} utterances · {c.questions_asked_count} questions asked
                    {c.model ? ` · ${c.model}` : ''}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
