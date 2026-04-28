import OpenAI from "openai";

export type Embedding = number[];
export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIMENSIONS = 1536;

// Embeddings MUST go directly to OpenAI — the Replit AI proxy only supports
// chat completions, not the embeddings API. Always use OPENAI_API_KEY directly.
function makeEmbeddingsClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

let _embeddingsClient: OpenAI | null | undefined = undefined;

function getEmbeddingsClient(): OpenAI | null {
  if (_embeddingsClient === undefined) {
    _embeddingsClient = makeEmbeddingsClient();
  }
  return _embeddingsClient;
}

export async function generateEmbedding(text: string): Promise<Embedding | null> {
  const client = getEmbeddingsClient();
  if (!client) return null;

  try {
    const response = await client.embeddings.create({
      model: EMBED_MODEL,
      input: text.slice(0, 8000),
    });
    return response.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("[embeddings] Failed to generate embedding:", (err as Error).message);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}
