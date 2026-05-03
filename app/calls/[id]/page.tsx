import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCallByIdFromDb } from '@/lib/calls-db';
import CallHistoryDetail from '@/components/CallHistoryDetail';

export const dynamic = 'force-dynamic';

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getCallByIdFromDb(id);

  if (!result.ok) {
    if (result.notFound) notFound();
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-slate-800 px-6 py-4">
          <Link href="/calls" className="text-sm font-medium text-indigo-400 hover:text-indigo-300">
            ← Call history
          </Link>
        </header>
        <main className="flex-1 p-6 max-w-3xl mx-auto">
          <p className="text-sm text-red-400">{result.error}</p>
        </main>
      </div>
    );
  }

  const { call } = result;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/calls" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
            ← Call history
          </Link>
          <h1 className="text-sm font-semibold text-slate-100 mt-2">Call · {new Date(call.created_at).toLocaleString()}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Ended {new Date(call.ended_at).toLocaleString()}
            {call.model ? ` · Model: ${call.model}` : ''}
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-slate-400 hover:text-slate-200">
          Assistant
        </Link>
      </header>

      <main className="flex-1 p-6 max-w-4xl mx-auto w-full">
        <CallHistoryDetail call={call} />
      </main>
    </div>
  );
}
