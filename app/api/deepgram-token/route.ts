export const dynamic = 'force-dynamic';

// Returns a short-lived Deepgram API key to the browser so the real key
// stays server-side. The browser opens the Deepgram WebSocket directly
// using this token (avoids proxying audio through our server).
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'DEEPGRAM_API_KEY not set' }, { status: 500 });
  }
  return Response.json({ key: apiKey });
}
