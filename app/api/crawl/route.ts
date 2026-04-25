export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { crawlSite } from '@/lib/crawler';

export async function POST(req: NextRequest) {
  const { url, maxPages = 50 } = await req.json();
  if (!url) return Response.json({ error: 'URL is required' }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: 'start', message: `Starting crawl: ${url}` });

        const results = await crawlSite(url, maxPages, (crawled, total, currentUrl) => {
          send({ type: 'progress', crawled, total, currentUrl });
        });

        // Return extracted text to client — no server-side storage
        send({
          type: 'done',
          pages: results.map((r) => ({ url: r.url, text: r.text })),
          pagesAdded: results.length,
        });
      } catch (err) {
        send({ type: 'error', message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}
