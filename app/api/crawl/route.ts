export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { crawlSite } from '@/lib/crawler';

export async function POST(req: NextRequest) {
  const { url, maxPages = 50 } = await req.json();
  if (!url) return Response.json({ error: 'URL is required' }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        // Safely serialize — truncate any single field > 200KB to avoid broken JSON
        const str = JSON.stringify(data);
        controller.enqueue(encoder.encode(`data: ${str}\n\n`));
      };

      try {
        send({ type: 'start', message: `Starting crawl: ${url}` });

        const results = await crawlSite(url, maxPages, (crawled, total, currentUrl) => {
          send({ type: 'progress', crawled, total, currentUrl });
        });

        // Send each page as a separate event (avoids single giant JSON payload)
        for (const result of results) {
          send({
            type: 'page',
            url: result.url,
            // Truncate per-page text to 50KB to keep events manageable
            text: result.text.slice(0, 50000),
          });
        }

        send({ type: 'done', pagesAdded: results.length });
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
