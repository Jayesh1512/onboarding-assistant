export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll('files') as File[];
  if (!files.length) return Response.json({ error: 'No files provided' }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mammoth = require('mammoth') as { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> };

  const results = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name;
    const ext = name.split('.').pop()?.toLowerCase();

    try {
      let text = '';
      if (ext === 'pdf') {
        text = (await pdfParse(buffer)).text;
      } else if (ext === 'docx' || ext === 'doc') {
        text = (await mammoth.extractRawText({ buffer })).value;
      } else if (ext === 'txt' || ext === 'md') {
        text = buffer.toString('utf-8');
      } else {
        results.push({ file: name, status: 'skipped', reason: 'unsupported format' });
        continue;
      }
      // Return extracted text to client — no server-side storage
      results.push({ file: name, status: 'ok', text: text.replace(/\s+/g, ' ').trim() });
    } catch (err) {
      results.push({ file: name, status: 'error', reason: String(err) });
    }
  }

  return Response.json({ results });
}
