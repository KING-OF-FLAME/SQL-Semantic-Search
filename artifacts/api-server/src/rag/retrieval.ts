import { db } from "../lib/db";
import { documentChunksTable, documentsTable } from "@workspace/db";
import { sql, eq, and, or, ilike } from "drizzle-orm";
import { cosineSimilarity, type Embedding } from "./embeddings";

export interface RetrievedChunk {
  chunkId: number;
  documentId: number;
  documentTitle: string;
  sourceUrl: string;
  content: string;
  chunkTitle: string | null;
  embedding: Embedding | null;
  keywordScore: number;
  semanticScore: number;
  combinedScore: number;
  createdAt: Date;
}

const CHUNK_SELECT = {
  chunkId: documentChunksTable.id,
  documentId: documentsTable.id,
  documentTitle: documentsTable.title,
  sourceUrl: documentsTable.sourceUrl,
  content: documentChunksTable.content,
  chunkTitle: documentChunksTable.title,
  embedding: documentChunksTable.embedding,
  createdAt: documentChunksTable.createdAt,
} as const;

function buildChunk(
  r: {
    chunkId: number;
    documentId: number;
    documentTitle: string;
    sourceUrl: string;
    content: string;
    chunkTitle: string | null;
    embedding: unknown;
    createdAt: Date;
  },
  queryEmbedding: Embedding,
): RetrievedChunk {
  const emb = r.embedding as Embedding | null;
  const sim = emb ? cosineSimilarity(queryEmbedding, emb) : 0;
  return {
    chunkId: r.chunkId,
    documentId: r.documentId,
    documentTitle: r.documentTitle,
    sourceUrl: r.sourceUrl,
    content: r.content,
    chunkTitle: r.chunkTitle,
    embedding: emb,
    createdAt: r.createdAt,
    keywordScore: 0,
    semanticScore: sim,
    combinedScore: sim,
  };
}

function normalizeWords(query: string): string[] {
  return query
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function buildLikeConditions(words: string[]) {
  return words.map((word) => ilike(documentChunksTable.content, `%${word}%`));
}

function countKeywordMatches(content: string, words: string[]): number {
  const lower = content.toLowerCase();
  return words.reduce((score, word) => score + (lower.includes(word.toLowerCase()) ? 1 : 0), 0);
}

export async function keywordSearch(query: string, limit = 20): Promise<RetrievedChunk[]> {
  const words = normalizeWords(query);
  if (words.length === 0) return [];

  const likeConditions = buildLikeConditions(words);

  const rows = await db
    .select(CHUNK_SELECT)
    .from(documentChunksTable)
    .innerJoin(documentsTable, eq(documentChunksTable.documentId, documentsTable.id))
    .where(
      and(
        or(...likeConditions),
        eq(documentsTable.isActive, true),
      ),
    )
    .limit(limit * 3);

  const scored = rows.map((r) => ({
    chunkId: r.chunkId,
    documentId: r.documentId,
    documentTitle: r.documentTitle,
    sourceUrl: r.sourceUrl,
    content: r.content,
    chunkTitle: r.chunkTitle,
    embedding: (r.embedding as Embedding | null),
    createdAt: r.createdAt,
    keywordScore: countKeywordMatches(r.content, words),
    semanticScore: 0,
    combinedScore: countKeywordMatches(r.content, words),
  }));

  return scored.sort((a, b) => b.keywordScore - a.keywordScore).slice(0, limit);
}

/**
 * Semantic search using cosine similarity.
 *
 * Strategy:
 * 1. Use keyword pre-filtering (LIKE) to narrow to the top 300 candidates.
 * 2. Compute cosine similarity across those candidates and return the top `limit`.
 * 3. If keyword filter returns zero results, fall back to a paginated scan of all chunks.
 */
export async function semanticSearch(
  queryEmbedding: Embedding,
  query: string,
  limit = 10,
): Promise<RetrievedChunk[]> {
  const words = normalizeWords(query);

  let rows: Array<{
    chunkId: number;
    documentId: number;
    documentTitle: string;
    sourceUrl: string;
    content: string;
    chunkTitle: string | null;
    embedding: unknown;
    createdAt: Date;
  }> = [];

  if (words.length > 0) {
    const likeConditions = buildLikeConditions(words);
    rows = await db
      .select(CHUNK_SELECT)
      .from(documentChunksTable)
      .innerJoin(documentsTable, eq(documentChunksTable.documentId, documentsTable.id))
      .where(
        and(
          or(...likeConditions),
          eq(documentsTable.isActive, true),
          sql`${documentChunksTable.embedding} IS NOT NULL`,
        ),
      )
      .limit(300);
  }

  if (rows.length === 0) {
    const PAGE_SIZE = 500;
    let pageOffset = 0;
    let bestSoFar: ReturnType<typeof buildChunk>[] = [];

    while (true) {
      const page = await db
        .select(CHUNK_SELECT)
        .from(documentChunksTable)
        .innerJoin(documentsTable, eq(documentChunksTable.documentId, documentsTable.id))
        .where(
          and(
            eq(documentsTable.isActive, true),
            sql`${documentChunksTable.embedding} IS NOT NULL`,
          ),
        )
        .limit(PAGE_SIZE)
        .offset(pageOffset);

      if (page.length === 0) break;

      const scored = page.map((r) => buildChunk(r, queryEmbedding));
      bestSoFar = [...bestSoFar, ...scored]
        .sort((a, b) => b.semanticScore - a.semanticScore)
        .slice(0, limit);

      if (page.length < PAGE_SIZE) break;
      pageOffset += PAGE_SIZE;
    }

    return bestSoFar;
  }

  return rows
    .map((r) => buildChunk(r, queryEmbedding))
    .sort((a, b) => b.semanticScore - a.semanticScore)
    .slice(0, limit);
}

export function mergeAndRerank(
  keywordResults: RetrievedChunk[],
  semanticResults: RetrievedChunk[],
  topK = 5,
): RetrievedChunk[] {
  const merged = new Map<number, RetrievedChunk>();

  for (const r of keywordResults) {
    merged.set(r.chunkId, r);
  }

  for (const r of semanticResults) {
    if (merged.has(r.chunkId)) {
      const existing = merged.get(r.chunkId)!;
      existing.semanticScore = r.semanticScore;
      existing.combinedScore = 0.5 * existing.keywordScore + 0.5 * r.semanticScore;
    } else {
      merged.set(r.chunkId, r);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, topK);
}
