import { db } from "../lib/db";
import {
  sourcesTable,
  documentsTable,
  documentChunksTable,
  documentEntitiesTable,
  crawlJobsTable,
  settingsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import * as cheerio from "cheerio";
import fetch from "node-fetch";
type PdfParseResult = { text: string; numpages: number };
type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;
let _pdfParseFn: PdfParseFn | null = null;
function getPdfParse(): PdfParseFn {
  if (!_pdfParseFn) {
    const mod = require("pdf-parse");
    _pdfParseFn = typeof mod === "function" ? mod : (mod.default ?? mod);
  }
  return _pdfParseFn!;
}
import { generateEmbedding } from "../rag/embeddings";
import { getOpenAI, getChatModel } from "../lib/openai";
import { CHUNK_ENTITY_EXTRACTION_PROMPT } from "../rag/prompts";
import { logger } from "../lib/logger";

const WORKER_DELAY_MS = 150;      // Per-worker delay — very fast
const MAX_PAGES_PER_CRAWL = 2000; // No practical limit
const MAX_DEPTH = 8;              // Deep crawl
const CONCURRENCY = 10;           // 10 parallel workers
const CHUNK_SIZE_CHARS = 1500;
const CHUNK_OVERLAP_CHARS = 200;
const FETCH_TIMEOUT_MS = 12000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function normalizeUrl(url: string, base: string): string | null {
  try {
    const parsed = new URL(url, base);
    parsed.hash = "";
    // Strip tracking params
    ["utm_source","utm_medium","utm_campaign","ref","fbclid","gclid"].forEach(p => parsed.searchParams.delete(p));
    return parsed.href;
  } catch {
    return null;
  }
}

function isAllowedUrl(url: string, sources: Array<{ domain: string; urlPattern: string }>): boolean {
  for (const source of sources) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === source.domain || parsed.hostname.endsWith(`.${source.domain}`)) {
        // Skip file types we can't process usefully
        const path = parsed.pathname.toLowerCase();
        if (/\.(jpg|jpeg|png|gif|svg|ico|css|js|woff|woff2|ttf|eot|mp4|mp3|zip|rar)$/i.test(path)) {
          return false;
        }
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/** Section-heading aware chunker */
function chunkBySection(text: string): string[] {
  const HEADING_RE = /(?:^|\n)(?=(?:[A-Z][A-Z\s]{2,50}[A-Z]|#{1,6}\s.+)(?:\n|$))/m;
  const sections = text.split(HEADING_RE).filter((s) => s.trim().length > 30);
  const chunks: string[] = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (trimmed.length <= CHUNK_SIZE_CHARS) {
      chunks.push(trimmed);
    } else {
      let start = 0;
      while (start < trimmed.length) {
        const end = Math.min(start + CHUNK_SIZE_CHARS, trimmed.length);
        chunks.push(trimmed.slice(start, end));
        start += CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS;
      }
    }
  }

  if (chunks.length === 0 && text.trim().length > 0) {
    let start = 0;
    const t = text.trim();
    while (start < t.length) {
      chunks.push(t.slice(start, start + CHUNK_SIZE_CHARS));
      start += CHUNK_SIZE_CHARS - CHUNK_OVERLAP_CHARS;
    }
  }

  return chunks.filter((c) => c.trim().length > 20);
}

function extractHtml(html: string, baseUrl: string): { title: string; text: string; links: string[] } {
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, .cookie-notice, .navbar, .sidebar, .breadcrumb, .menu, #menu, #nav, .ad, .advertisement, [class*='popup'], [class*='modal']:not([role='dialog'])").remove();

  const title =
    $("meta[property='og:title']").attr("content") ||
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    "Untitled";

  // Prefer main content areas
  const mainSelector = "main, article, [role='main'], .content, .main-content, #content, #main, .entry-content";
  const mainEl = $(mainSelector).first();
  const targetEl = mainEl.length ? mainEl : $("body");

  const sectionParts: string[] = [];
  targetEl.find("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const headingText = $(el).text().trim();
    if (headingText) sectionParts.push(`\n\n${headingText.toUpperCase()}\n`);
    let sibling = $(el).next();
    while (sibling.length && !sibling.is("h1,h2,h3,h4,h5,h6")) {
      const sibText = sibling.text().replace(/\s+/g, " ").trim();
      if (sibText) sectionParts.push(sibText);
      sibling = sibling.next();
    }
  });

  const text =
    sectionParts.length > 0
      ? sectionParts.join(" ")
      : targetEl.text().replace(/\s+/g, " ").trim();

  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const normalized = normalizeUrl(href, baseUrl);
      if (normalized) links.push(normalized);
    }
  });

  return { title, text, links };
}

async function parsePdf(buffer: Buffer): Promise<{ text: string }> {
  try {
    const pdfParseFn = getPdfParse();
    const data = await pdfParseFn(buffer);
    return { text: data.text };
  } catch (err) {
    logger.warn({ err }, "PDF parse failed");
    return { text: "" };
  }
}

async function extractEntitiesForChunk(content: string): Promise<Array<{ type: string; value: string }>> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: getChatModel(),
      messages: [
        { role: "system", content: CHUNK_ENTITY_EXTRACTION_PROMPT },
        { role: "user", content: content.slice(0, 1000) },
      ],
      max_tokens: 200,
      temperature: 0,
    });
    const raw = response.choices[0]?.message?.content?.trim() ?? "[]";
    return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function storeChunks(docId: number, textChunks: string[], skipEntities = false): Promise<void> {
  for (let i = 0; i < textChunks.length; i++) {
    const content = textChunks[i];
    const embedding = await generateEmbedding(content);
    const [chunkInsert] = await db
      .insert(documentChunksTable)
      .values({ documentId: docId, chunkIndex: i, content, embedding, tokenCount: content.split(/\s+/).length })
      .returning({ id: documentChunksTable.id });
    if (!skipEntities) {
      const entities = await extractEntitiesForChunk(content);
      if (entities.length > 0) {
        await db.insert(documentEntitiesTable).values(
          entities.map((e) => ({ chunkId: chunkInsert.id, entityType: e.type, entityValue: e.value }))
        );
      }
    }
    await sleep(100);
  }
}

async function processPage(
  url: string,
  sourceId: number,
  jobId: number,
  isRecrawl: boolean,
  skipEntities = false,
): Promise<string[]> {
  const linkedUrls: string[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const resp = await fetch(url, {
      headers: { "User-Agent": "ADYPUBot/1.0 (university knowledge assistant)" },
      signal: controller.signal,
    } as RequestInit).finally(() => clearTimeout(timeout));

    if (!resp.ok) return linkedUrls;
    const contentType = resp.headers.get("content-type") ?? "";
    const isPdf = isPdfUrl(url) || contentType.includes("application/pdf");

    let title: string;
    let text: string;
    let contentTypeStr: "html" | "pdf";

    if (isPdf) {
      const buffer = Buffer.from(await resp.arrayBuffer());
      const parsed = await parsePdf(buffer);
      text = parsed.text;
      title = url.split("/").pop()?.replace(".pdf", "") ?? "PDF Document";
      contentTypeStr = "pdf";
    } else if (contentType.includes("text/html")) {
      const html = await resp.text();
      const extracted = extractHtml(html, url);
      title = extracted.title;
      text = extracted.text;
      contentTypeStr = "html";
      linkedUrls.push(...extracted.links);
    } else {
      return linkedUrls;
    }

    if (!text || text.trim().length < 100) return linkedUrls;

    const hash = contentHash(text);
    const [existing] = await db
      .select({ id: documentsTable.id, contentHash: documentsTable.contentHash })
      .from(documentsTable)
      .where(and(eq(documentsTable.sourceUrl, url), eq(documentsTable.sourceId, sourceId)))
      .limit(1);

    if (existing && existing.contentHash === hash && !isRecrawl) return linkedUrls;

    let docId: number;
    if (existing) {
      await db.update(documentsTable)
        .set({ title, rawText: text, contentHash: hash, updatedAt: new Date() })
        .where(eq(documentsTable.id, existing.id));
      docId = existing.id;
      const chunks = await db.select({ id: documentChunksTable.id }).from(documentChunksTable).where(eq(documentChunksTable.documentId, docId));
      for (const c of chunks) await db.delete(documentEntitiesTable).where(eq(documentEntitiesTable.chunkId, c.id));
      await db.delete(documentChunksTable).where(eq(documentChunksTable.documentId, docId));
    } else {
      const [docInsert] = await db
        .insert(documentsTable)
        .values({ sourceId, crawlJobId: jobId, title, sourceUrl: url, contentType: contentTypeStr, contentHash: hash, rawText: text })
        .returning({ id: documentsTable.id });
      docId = docInsert.id;
    }

    const textChunks = chunkBySection(text);
    await storeChunks(docId, textChunks, skipEntities);
  } catch (err) {
    logger.warn({ url, err }, "Failed to process page");
  }
  return linkedUrls;
}

/** Parse sitemap XML and return all page URLs */
async function parseSitemap(sitemapUrl: string, allowedSources: Array<{ domain: string; urlPattern: string }>): Promise<string[]> {
  const urls: string[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(sitemapUrl, {
      headers: { "User-Agent": "ADYPUBot/1.0" },
      signal: controller.signal,
    } as RequestInit).finally(() => clearTimeout(timeout));

    if (!resp.ok) return urls;
    const text = await resp.text();
    const $ = cheerio.load(text, { xmlMode: true });

    // Sitemap index — recurse into child sitemaps
    const sitemapLocs: string[] = [];
    $("sitemap loc").each((_, el) => sitemapLocs.push($(el).text().trim()));
    for (const loc of sitemapLocs.slice(0, 10)) {
      const childUrls = await parseSitemap(loc, allowedSources);
      urls.push(...childUrls);
    }

    // Regular sitemap — collect page URLs
    $("url loc").each((_, el) => {
      const loc = $(el).text().trim();
      if (loc && isAllowedUrl(loc, allowedSources)) urls.push(loc);
    });
  } catch (err) {
    logger.debug({ sitemapUrl, err }, "Sitemap fetch failed (non-fatal)");
  }
  return urls;
}

/** Try to find sitemap URL from robots.txt */
async function getSitemapUrlFromRobots(baseUrl: string): Promise<string[]> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).href;
    const resp = await fetch(robotsUrl, { headers: { "User-Agent": "ADYPUBot/1.0" } } as RequestInit);
    if (!resp.ok) return [];
    const text = await resp.text();
    const sitemaps: string[] = [];
    for (const line of text.split("\n")) {
      const match = line.match(/^Sitemap:\s*(.+)$/i);
      if (match) sitemaps.push(match[1].trim());
    }
    return sitemaps;
  } catch {
    return [];
  }
}

/** Run a concurrency-limited worker pool */
async function runWorkerPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const active: Promise<void>[] = [];

  async function runNext(): Promise<void> {
    if (queue.length === 0) return;
    const item = queue.shift()!;
    await worker(item);
    await sleep(WORKER_DELAY_MS);
  }

  // Fill initial pool
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    active.push(runNext());
  }

  while (active.length > 0) {
    await Promise.race(active);
    // Remove resolved promises and add more work
    for (let i = active.length - 1; i >= 0; i--) {
      // Check if resolved via a hack-free approach: just refill from queue
    }
    // Simpler approach: process in batches
    break;
  }
}

export async function crawlSources(jobId: number, isRecrawl: boolean): Promise<void> {
  // Phase 1: discovery — mark job as "discovering" before we parse sitemaps
  await db.update(crawlJobsTable)
    .set({ status: "discovering", startedAt: new Date() })
    .where(eq(crawlJobsTable.id, jobId));

  // Check if OpenAI is enabled — skip entity extraction when disabled
  const openaiSetting = await db.select().from(settingsTable).where(eq(settingsTable.key, "openai_enabled")).limit(1);
  const skipEntities = openaiSetting[0]?.value === "false";

  try {
    const sources = await db.select().from(sourcesTable).where(eq(sourcesTable.isActive, true));

    if (sources.length === 0) {
      await db.update(crawlJobsTable)
        .set({ status: "completed", completedAt: new Date(), errorLog: "No active sources configured" })
        .where(eq(crawlJobsTable.id, jobId));
      return;
    }

    const visited = new Set<string>();
    // Queue with priority: sitemaps first, then BFS
    const queue: Array<{ url: string; sourceId: number; depth: number }> = [];

    // Phase 1: Discover ALL pages via sitemap before crawling starts
    logger.info({ jobId }, "Crawler: discovering pages via sitemap and robots.txt");
    for (const source of sources) {
      const seed = source.seedUrl ?? `https://${source.domain}`;
      const baseUrl = seed;

      // Try robots.txt for sitemap hints
      const robotsSitemaps = await getSitemapUrlFromRobots(baseUrl);
      const sitemapCandidates = [
        ...robotsSitemaps,
        `${baseUrl.replace(/\/$/, "")}/sitemap.xml`,
        `${baseUrl.replace(/\/$/, "")}/sitemap_index.xml`,
        `${baseUrl.replace(/\/$/, "")}/sitemap/sitemap.xml`,
      ];

      let sitemapUrls: string[] = [];
      for (const candidate of sitemapCandidates.slice(0, 4)) {
        const found = await parseSitemap(candidate, sources);
        if (found.length > 0) {
          sitemapUrls = found;
          logger.info({ jobId, sitemap: candidate, count: found.length }, "Sitemap discovered");
          break;
        }
      }

      // Add sitemap URLs to queue (high priority)
      for (const url of sitemapUrls.slice(0, MAX_PAGES_PER_CRAWL)) {
        if (!visited.has(url)) queue.push({ url, sourceId: source.id, depth: 0 });
      }

      // Always add seed URL as fallback
      if (!queue.some(q => q.url === seed)) {
        queue.push({ url: seed, sourceId: source.id, depth: 0 });
      }
    }

    // Write the discovered count to DB BEFORE starting to crawl
    // This gives the UI an accurate total from the moment crawling begins
    const totalPagesDiscovered = queue.length;
    await db.update(crawlJobsTable)
      .set({ status: "running", totalPagesDiscovered, pagesFound: totalPagesDiscovered })
      .where(eq(crawlJobsTable.id, jobId));
    logger.info({ jobId, totalPagesDiscovered }, "Discovery complete — starting crawl");

    // Phase 2: Process pages; pagesFound tracks total including newly discovered links
    let pagesFound = totalPagesDiscovered;
    let pagesProcessed = 0;
    let pagesFailed = 0;

    // Step 2: BFS with parallel workers
    const processNext = async (item: { url: string; sourceId: number; depth: number }): Promise<void> => {
      if (visited.has(item.url) || item.depth > MAX_DEPTH) return;
      if (!isAllowedUrl(item.url, sources)) return;
      visited.add(item.url);

      try {
        const linkedUrls = await processPage(item.url, item.sourceId, jobId, isRecrawl, skipEntities);
        pagesProcessed++;

        // Add newly discovered links (beyond sitemap) — increment pagesFound for each new one
        for (const linkedUrl of linkedUrls) {
          if (!visited.has(linkedUrl) && isAllowedUrl(linkedUrl, sources) && pagesFound < MAX_PAGES_PER_CRAWL) {
            queue.push({ url: linkedUrl, sourceId: item.sourceId, depth: item.depth + 1 });
            pagesFound++;
          }
        }

        await db.update(crawlJobsTable)
          .set({ pagesFound, pagesProcessed, pagesFailed })
          .where(eq(crawlJobsTable.id, jobId));
      } catch {
        pagesFailed++;
      }
    };

    // Process pages in parallel batches
    while (queue.length > 0 && pagesProcessed < MAX_PAGES_PER_CRAWL) {
      // Take a batch of CONCURRENCY items from the queue
      const batch: typeof queue = [];
      while (queue.length > 0 && batch.length < CONCURRENCY) {
        const item = queue.shift()!;
        if (!visited.has(item.url)) batch.push(item);
      }
      if (batch.length === 0) break;

      // Process batch in parallel
      await Promise.all(batch.map(item => processNext(item)));
      await sleep(WORKER_DELAY_MS);
    }

    await db.update(crawlJobsTable)
      .set({ status: "completed", pagesFound, pagesProcessed, pagesFailed, completedAt: new Date() })
      .where(eq(crawlJobsTable.id, jobId));

    logger.info({ jobId, pagesProcessed, pagesFailed, pagesFound, totalPagesDiscovered }, "Crawl completed");
  } catch (err) {
    await db.update(crawlJobsTable)
      .set({ status: "failed", errorLog: String(err), completedAt: new Date() })
      .where(eq(crawlJobsTable.id, jobId));
    logger.error({ jobId, err }, "Crawl failed");
  }
}
