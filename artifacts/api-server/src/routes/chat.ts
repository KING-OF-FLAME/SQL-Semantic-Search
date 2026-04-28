import { Router, type IRouter } from "express";
import { db } from "../lib/db";
import { queryLogsTable, answerLogsTable, settingsTable } from "@workspace/db";
import { classifyIntent, rewriteQuery, extractEntities, generateGroundedAnswer } from "../rag/nlp";
import { generateEmbedding } from "../rag/embeddings";
import { keywordSearch, semanticSearch, mergeAndRerank } from "../rag/retrieval";
import type { RetrievedChunk } from "../rag/retrieval";
import { computeConfidence, scaleToInt } from "../rag/confidence";
import { searchDuckDuckGo } from "../rag/web-search";
import type { WebSearchResult } from "../rag/web-search";
import { updateOpenAIConfig } from "../lib/openai";
import { chatRateLimit } from "../middlewares/ratelimit";
import { verifyToken } from "../lib/jwt";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

/**
 * Build a structured markdown response from raw KB chunks and web results,
 * without calling OpenAI at all. Used when openai_enabled = false.
 */
function formatDirectResponse(
  chunks: RetrievedChunk[],
  webResults: WebSearchResult[],
): string {
  const parts: string[] = [];

  if (chunks.length > 0) {
    parts.push("### From ADYPU Knowledge Base\n");
    for (const chunk of chunks.slice(0, 3)) {
      const excerpt = chunk.content.slice(0, 500).trim();
      parts.push(
        `**${chunk.documentTitle || "ADYPU Document"}**\n\n${excerpt}\n\n[View Source](${chunk.sourceUrl})\n`,
      );
    }
  }

  if (webResults.length > 0) {
    parts.push("### From Web Search\n");
    for (const r of webResults.slice(0, 4)) {
      parts.push(`**[${r.title}](${r.url})**\n\n${r.snippet}\n`);
    }
  }

  if (parts.length === 0) {
    return (
      "No matching information was found in the ADYPU knowledge base or web search for your query.\n\n" +
      "Please visit [adypu.edu.in](https://adypu.edu.in) or contact the admissions office directly for assistance."
    );
  }

  return (
    "> **Note:** AI synthesis is currently disabled. Showing direct search results.\n\n" +
    parts.join("\n---\n\n")
  );
}

const chatSchema = z.object({
  question: z.string().min(1).max(2000),
  sessionId: z.string().optional(),
  useWebSearch: z.boolean().optional(),
});

router.post("/chat", chatRateLimit, async (req, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid input" });
    return;
  }

  // Detect authenticated user (optional — guests also allowed up to limit)
  let authenticatedUserId: number | null = null;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = verifyToken(authHeader.slice(7));
      authenticatedUserId = payload.userId;
    } catch {
      // Invalid token — treat as guest
    }
  }

  const { question, sessionId, useWebSearch } = parsed.data;

  // Load all settings in one query
  const settings = await getAllSettings();
  const guestLimit = Math.max(1, parseInt(settings["guest_search_limit"] ?? "5", 10) || 5);
  const resetHours = Math.max(1, parseInt(settings["limit_reset_hours"] ?? "24", 10) || 24);
  const webSearchEnabled = settings["web_search_enabled"] === "true";
  const openaiEnabled = settings["openai_enabled"] !== "false";

  // Apply dynamic OpenAI config (key + model) from DB settings
  updateOpenAIConfig(settings["openai_api_key"], settings["openai_model"]);

  // Effective web search: admin enabled AND user wants it (useWebSearch !== false)
  const effectiveWebSearch = webSearchEnabled && useWebSearch !== false;

  // Enforce guest search limit
  if (!authenticatedUserId && sessionId) {
    const windowStart = new Date(Date.now() - resetHours * 60 * 60 * 1000);
    const [{ total }] = await db
      .select({ total: count() })
      .from(queryLogsTable)
      .where(
        and(
          eq(queryLogsTable.sessionId, sessionId),
          sql`${queryLogsTable.userId} IS NULL`,
          gte(queryLogsTable.createdAt, windowStart),
        ),
      );
    const used = Number(total);
    if (used >= guestLimit) {
      res.status(429).json({
        error: "limit_reached",
        message: `You've used all ${guestLimit} free searches. Sign in or register (free) for unlimited access.`,
        used,
        limit: guestLimit,
        remaining: 0,
      });
      return;
    }
    res.setHeader("X-Searches-Used", String(used + 1));
    res.setHeader("X-Searches-Limit", String(guestLimit));
    res.setHeader("X-Searches-Remaining", String(Math.max(0, guestLimit - used - 1)));
  }

  try {
    // ── OpenAI DISABLED: keyword search + web search only, no AI synthesis ──
    if (!openaiEnabled) {
      const [keywordResults, webResults] = await Promise.all([
        keywordSearch(question, 10),
        effectiveWebSearch ? searchDuckDuckGo(question, 5) : Promise.resolve([]),
      ]);

      const topChunks = keywordResults.slice(0, 5);
      const webSearchUsed = effectiveWebSearch && webResults.length > 0;
      const answer = formatDirectResponse(topChunks, webSearchUsed ? webResults : []);

      const [queryLogInsert] = await db
        .insert(queryLogsTable)
        .values({
          userId: authenticatedUserId,
          question,
          rewrittenQuery: question,
          intent: "general",
          entities: [],
          confidenceScore: topChunks.length > 0 ? 30 : 0,
          confidenceLabel: topChunks.length > 0 ? "low" : "low",
          sessionId,
        })
        .returning({ id: queryLogsTable.id });

      const citations = topChunks.map((c) => ({
        chunkId: c.chunkId,
        documentTitle: c.documentTitle,
        sourceUrl: c.sourceUrl,
        excerpt: c.content.slice(0, 300),
        relevanceScore: Math.round(c.combinedScore * 100) / 100,
      }));

      const webCitations = webSearchUsed
        ? webResults.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet }))
        : [];

      let searchesUsed: number | null = null;
      let searchesRemaining: number | null = null;
      if (!authenticatedUserId && sessionId) {
        const usedHeader = res.getHeader("X-Searches-Used");
        searchesUsed = usedHeader ? Number(usedHeader) : null;
        searchesRemaining = usedHeader
          ? Math.max(0, Number(res.getHeader("X-Searches-Limit") || "5") - Number(usedHeader))
          : null;
      }

      res.json({
        answer,
        intent: "general",
        entities: [],
        citations,
        webSearchUsed,
        webCitations,
        confidence: {
          score: topChunks.length > 0 ? 0.3 : 0,
          label: "low",
          breakdown: { retrieval: 0.3, rerank: 0, sourceAgreement: 0, freshness: 0, answerability: 0 },
        },
        queryLogId: queryLogInsert?.id ?? null,
        rewrittenQuery: question,
        savedToHistory: authenticatedUserId !== null,
        openaiDisabled: true,
        guest: !authenticatedUserId
          ? { used: searchesUsed, limit: guestLimit, remaining: searchesRemaining }
          : null,
      });
      return;
    }

    // ── OpenAI ENABLED: full RAG pipeline ──

    // Launch intent and entity extraction immediately
    const intentPromise = classifyIntent(question);
    const entitiesPromise = extractEntities(question);

    // Rewrite query then run retrieval + web search in parallel
    const rewrittenQuery = await rewriteQuery(question);

    const [queryEmbedding, keywordResults, webResults] = await Promise.all([
      generateEmbedding(rewrittenQuery),
      keywordSearch(rewrittenQuery, 20),
      effectiveWebSearch ? searchDuckDuckGo(rewrittenQuery, 5) : Promise.resolve([]),
    ]);

    const [semanticResults, intent, entities] = await Promise.all([
      queryEmbedding ? semanticSearch(queryEmbedding, rewrittenQuery, 20) : Promise.resolve([]),
      intentPromise,
      entitiesPromise,
    ]);

    const topChunks = mergeAndRerank(keywordResults, semanticResults, 5);
    const webSearchUsed = effectiveWebSearch && webResults.length > 0;
    const answer = await generateGroundedAnswer(question, topChunks, webSearchUsed ? webResults : undefined);
    const confidence = computeConfidence(topChunks, answer);

    const [queryLogInsert] = await db
      .insert(queryLogsTable)
      .values({
        userId: authenticatedUserId,
        question,
        rewrittenQuery,
        intent,
        entities,
        confidenceScore: scaleToInt(confidence.score),
        confidenceLabel: confidence.label,
        sessionId,
      })
      .returning({ id: queryLogsTable.id });
    const queryLog = queryLogInsert ?? null;

    if (queryLog && topChunks.length > 0) {
      await db.insert(answerLogsTable).values({
        queryLogId: queryLog.id,
        answer,
        chunkIds: topChunks.map((c) => c.chunkId),
        retrievalScore: scaleToInt(confidence.breakdown.retrieval),
        rerankScore: scaleToInt(confidence.breakdown.rerank),
        sourceAgreementScore: scaleToInt(confidence.breakdown.sourceAgreement),
        freshnessScore: scaleToInt(confidence.breakdown.freshness),
        answerabilityScore: scaleToInt(confidence.breakdown.answerability),
      });
    }

    const citations = topChunks.map((c) => ({
      chunkId: c.chunkId,
      documentTitle: c.documentTitle,
      sourceUrl: c.sourceUrl,
      excerpt: c.content.slice(0, 300),
      relevanceScore: Math.round(c.combinedScore * 100) / 100,
    }));

    const webCitations = webSearchUsed
      ? webResults.map((r) => ({ title: r.title, url: r.url, snippet: r.snippet }))
      : [];

    let searchesUsed: number | null = null;
    let searchesRemaining: number | null = null;
    if (!authenticatedUserId && sessionId) {
      const usedHeader = res.getHeader("X-Searches-Used");
      searchesUsed = usedHeader ? Number(usedHeader) : null;
      searchesRemaining = usedHeader
        ? Math.max(0, Number(res.getHeader("X-Searches-Limit") || "5") - Number(usedHeader))
        : null;
    }

    res.json({
      answer,
      intent,
      entities,
      citations,
      webSearchUsed,
      webCitations,
      confidence: { score: confidence.score, label: confidence.label, breakdown: confidence.breakdown },
      queryLogId: queryLog?.id,
      rewrittenQuery,
      savedToHistory: authenticatedUserId !== null,
      openaiDisabled: false,
      guest: !authenticatedUserId
        ? { used: searchesUsed, limit: guestLimit, remaining: searchesRemaining }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "Chat pipeline failed");
    res.status(500).json({ error: "internal_error", message: "Something went wrong" });
  }
});

export default router;
