// eslint-disable-next-line @typescript-eslint/no-require-imports
const { load } = require('cheerio') as typeof import('cheerio');
type CheerioAPI = ReturnType<typeof load>;

export interface CrawlResult {
  url: string;
  text: string;
}

function normalizeUrl(base: string, href: string): string | null {
  try {
    const url = new URL(href, base);
    // Strip hash and query for dedup
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function isSameDomain(base: string, target: string): boolean {
  try {
    return new URL(base).hostname === new URL(target).hostname;
  } catch {
    return false;
  }
}

function extractText($: CheerioAPI): string {
  // Remove non-content elements
  $('script, style, nav, footer, header, noscript, iframe, svg').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

function extractLinks($: CheerioAPI, baseUrl: string, origin: string): string[] {
  const links: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  $('a[href]').each((_: number, el: any) => {
    const href = $(el).attr('href') || '';
    const normalized = normalizeUrl(baseUrl, href);
    if (normalized && isSameDomain(origin, normalized)) {
      links.push(normalized);
    }
  });
  return links;
}

export async function crawlSite(
  startUrl: string,
  maxPages = 50,
  onProgress?: (crawled: number, total: number, url: string) => void
): Promise<CrawlResult[]> {
  const visited = new Set<string>();
  const queue: string[] = [startUrl];
  const results: CrawlResult[] = [];

  // Normalize start URL
  const origin = new URL(startUrl).origin;

  while (queue.length > 0 && visited.size < maxPages) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'OnboardingAssistant/1.0' },
        signal: AbortSignal.timeout(10000),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;

      const html = await res.text();
      const $ = load(html);

      const text = extractText($);
      if (text.length > 100) {
        results.push({ url, text });
      }

      const links = extractLinks($, url, origin);
      for (const link of links) {
        if (!visited.has(link) && !queue.includes(link)) {
          queue.push(link);
        }
      }

      onProgress?.(visited.size, Math.min(queue.length + visited.size, maxPages), url);
    } catch {
      // Skip failed pages silently
    }
  }

  return results;
}
