export const dynamic = 'force-dynamic';

// Returns the list of models currently available in Ollama.
// Ollama's native tags endpoint gives richer info than /v1/models.
export async function GET() {
  const base = (process.env.OLLAMA_URL || 'http://localhost:11434').replace('/v1', '');
  try {
    const res = await fetch(`${base}/api/tags`);
    if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
    const data = await res.json();
    // data.models = [{ name, size, ... }]
    const models = (data.models ?? []).map((m: { name: string }) => ({ id: m.name, name: m.name }));
    return Response.json({ models });
  } catch (err) {
    return Response.json({ models: [], error: String(err) });
  }
}
