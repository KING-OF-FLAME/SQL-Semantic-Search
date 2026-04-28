import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import {
  documentsTable,
  documentChunksTable,
  documentEntitiesTable,
  crawlJobsTable,
  sourcesTable,
  queryLogsTable,
  usersTable,
  rolesTable,
  settingsTable,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/auth";
import { auditLog } from "../lib/audit";
import { crawlSources } from "../crawler/crawler";
import { eq, sql, lt, desc, count, or, ilike } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();
router.use("/admin", requireAdmin);

/* ─── Stats ───────────────────────────────────────────────────── */

router.get("/admin/stats", async (req, res) => {
  const [docCount, chunkCount, failedCount, sourceCount, lowConfCount] = await Promise.all([
    db.select({ count: count() }).from(documentsTable).where(eq(documentsTable.isActive, true)),
    db.select({ count: count() }).from(documentChunksTable),
    db.select({ count: count() }).from(documentsTable).where(eq(documentsTable.isActive, false)),
    db.select({ count: count() }).from(sourcesTable).where(eq(sourcesTable.isActive, true)),
    db.select({ count: count() }).from(queryLogsTable).where(lt(queryLogsTable.confidenceScore, 60)),
  ]);

  const recentJobs = await db
    .select()
    .from(crawlJobsTable)
    .orderBy(desc(crawlJobsTable.createdAt))
    .limit(10);

  const activeJob = recentJobs.find((j) => ["running", "pending", "discovering"].includes(j.status)) ?? null;

  res.json({
    totalDocuments: docCount[0]?.count ?? 0,
    totalChunks: chunkCount[0]?.count ?? 0,
    failedPages: failedCount[0]?.count ?? 0,
    totalSources: sourceCount[0]?.count ?? 0,
    activeJob: activeJob
      ? {
          id: activeJob.id,
          status: activeJob.status,
          pagesFound: activeJob.pagesFound,
          totalPagesDiscovered: activeJob.totalPagesDiscovered,
          pagesProcessed: activeJob.pagesProcessed,
          pagesFailed: activeJob.pagesFailed,
          startedAt: activeJob.startedAt?.toISOString(),
          completedAt: activeJob.completedAt?.toISOString(),
        }
      : null,
    recentJobs: recentJobs.map((j) => ({
      id: j.id,
      status: j.status,
      pagesFound: j.pagesFound,
      totalPagesDiscovered: j.totalPagesDiscovered,
      pagesProcessed: j.pagesProcessed,
      pagesFailed: j.pagesFailed,
      startedAt: j.startedAt?.toISOString(),
      completedAt: j.completedAt?.toISOString(),
    })),
    lowConfidenceCount: lowConfCount[0]?.count ?? 0,
  });
});

/* ─── Documents ───────────────────────────────────────────────── */

router.get("/admin/documents", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const source = req.query.source as string | undefined;

  const whereClause = source
    ? ilike(documentsTable.sourceUrl, `%${source}%`)
    : undefined;

  const docs = await db
    .select({
      id: documentsTable.id,
      title: documentsTable.title,
      sourceUrl: documentsTable.sourceUrl,
      contentType: documentsTable.contentType,
      isActive: documentsTable.isActive,
      createdAt: documentsTable.createdAt,
      updatedAt: documentsTable.updatedAt,
      chunkCount: sql<number>`(SELECT COUNT(*) FROM document_chunks WHERE document_id = ${documentsTable.id})`,
    })
    .from(documentsTable)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(desc(documentsTable.createdAt));

  const [totalRow] = whereClause
    ? await db.select({ count: count() }).from(documentsTable).where(whereClause)
    : await db.select({ count: count() }).from(documentsTable);

  res.json({
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      sourceUrl: d.sourceUrl,
      contentType: d.contentType,
      isActive: d.isActive,
      chunkCount: Number(d.chunkCount),
      createdAt: d.createdAt?.toISOString(),
      updatedAt: d.updatedAt?.toISOString(),
    })),
    total: totalRow?.count ?? 0,
    page,
    limit,
  });
});

router.delete("/admin/documents/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  const chunks = await db
    .select({ id: documentChunksTable.id })
    .from(documentChunksTable)
    .where(eq(documentChunksTable.documentId, id));
  if (chunks.length > 0) {
    const chunkIds = chunks.map((c) => c.id);
    for (const cid of chunkIds) {
      await db.delete(documentEntitiesTable).where(eq(documentEntitiesTable.chunkId, cid));
    }
    await db.delete(documentChunksTable).where(eq(documentChunksTable.documentId, id));
  }
  await db.delete(documentsTable).where(eq(documentsTable.id, id));
  await auditLog({ userId: req.user?.userId, action: "delete_document", resource: "documents", resourceId: id, ipAddress: req.ip });
  res.json({ success: true });
});

/* ─── Low-Confidence Questions ───────────────────────────────── */

router.get("/admin/questions/low-confidence", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const questions = await db
    .select()
    .from(queryLogsTable)
    .where(lt(queryLogsTable.confidenceScore, 60))
    .orderBy(desc(queryLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: count() })
    .from(queryLogsTable)
    .where(lt(queryLogsTable.confidenceScore, 60));

  res.json({
    questions: questions.map((q) => ({
      id: q.id,
      question: q.question,
      intent: q.intent,
      confidenceScore: q.confidenceScore / 100,
      confidenceLabel: q.confidenceLabel,
      createdAt: q.createdAt?.toISOString(),
      hasAnswer: true,
    })),
    total: totalRow?.count ?? 0,
    page,
    limit,
  });
});

/* ─── Sources ─────────────────────────────────────────────────── */

router.get("/admin/sources", async (req, res) => {
  const sources = await db.select().from(sourcesTable).orderBy(desc(sourcesTable.createdAt));
  res.json({
    sources: sources.map((s) => ({
      id: s.id,
      domain: s.domain,
      urlPattern: s.urlPattern,
      seedUrl: s.seedUrl,
      isActive: s.isActive,
      createdAt: s.createdAt?.toISOString(),
    })),
  });
});

const addSourceSchema = z.object({
  domain: z.string().min(1),
  urlPattern: z.string().min(1),
  seedUrl: z.string().optional(),
});

router.post("/admin/sources/add", async (req, res) => {
  const parsed = addSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid input" });
    return;
  }
  const [result] = await db.insert(sourcesTable).values(parsed.data).returning({ id: sourcesTable.id });
  const [source] = await db.select().from(sourcesTable).where(eq(sourcesTable.id, result.id)).limit(1);
  await auditLog({ userId: req.user?.userId, action: "add_source", resource: "sources", resourceId: source.id, details: parsed.data, ipAddress: req.ip });
  res.json({ id: source.id, domain: source.domain, urlPattern: source.urlPattern, isActive: source.isActive, createdAt: source.createdAt?.toISOString() });
});

router.patch("/admin/sources/:id/toggle", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }
  const [existing] = await db.select().from(sourcesTable).where(eq(sourcesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "not_found" }); return; }
  await db.update(sourcesTable).set({ isActive: !existing.isActive }).where(eq(sourcesTable.id, id));
  const [updated] = await db.select().from(sourcesTable).where(eq(sourcesTable.id, id)).limit(1);
  await auditLog({ userId: req.user?.userId, action: "toggle_source", resource: "sources", resourceId: id, ipAddress: req.ip });
  res.json({ id: updated.id, isActive: updated.isActive });
});

router.delete("/admin/sources/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }
  await db.delete(sourcesTable).where(eq(sourcesTable.id, id));
  await auditLog({ userId: req.user?.userId, action: "remove_source", resource: "sources", resourceId: id, ipAddress: req.ip });
  res.json({ success: true });
});

/* ─── Crawl ───────────────────────────────────────────────────── */

router.post("/admin/crawl/start", async (req, res) => {
  const crawlSetting = await db.select().from(settingsTable).where(eq(settingsTable.key, "crawl_enabled")).limit(1);
  if (crawlSetting[0]?.value === "false") {
    res.status(403).json({ error: "crawl_disabled", message: "Web crawling is currently disabled in Settings." });
    return;
  }

  await db.update(crawlJobsTable)
    .set({ status: "failed", completedAt: new Date(), errorLog: "Cancelled: new crawl started" })
    .where(or(eq(crawlJobsTable.status, "running"), eq(crawlJobsTable.status, "pending")));

  const [result] = await db.insert(crawlJobsTable).values({
    status: "pending",
    triggeredBy: req.user?.userId,
    startedAt: new Date(),
  }).returning({ id: crawlJobsTable.id });

  await auditLog({ userId: req.user?.userId, action: "start_crawl", resource: "crawl_jobs", resourceId: result.id, ipAddress: req.ip });
  crawlSources(result.id, false).catch((err) => console.error("Crawl error:", err));
  res.json({ jobId: result.id, status: "pending", message: "Crawl started" });
});

router.post("/admin/crawl/recrawl", async (req, res) => {
  const crawlSetting = await db.select().from(settingsTable).where(eq(settingsTable.key, "crawl_enabled")).limit(1);
  if (crawlSetting[0]?.value === "false") {
    res.status(403).json({ error: "crawl_disabled", message: "Web crawling is currently disabled in Settings." });
    return;
  }

  await db.update(crawlJobsTable)
    .set({ status: "failed", completedAt: new Date(), errorLog: "Cancelled: new recrawl started" })
    .where(or(eq(crawlJobsTable.status, "running"), eq(crawlJobsTable.status, "pending")));

  const [result] = await db.insert(crawlJobsTable).values({
    status: "pending",
    triggeredBy: req.user?.userId,
    startedAt: new Date(),
  }).returning({ id: crawlJobsTable.id });

  await auditLog({ userId: req.user?.userId, action: "recrawl_stale", resource: "crawl_jobs", resourceId: result.id, ipAddress: req.ip });
  crawlSources(result.id, true).catch((err) => console.error("Recrawl error:", err));
  res.json({ jobId: result.id, status: "pending", message: "Recrawl started" });
});

router.post("/admin/crawl/cancel", async (req, res) => {
  const stale = await db
    .select({ id: crawlJobsTable.id })
    .from(crawlJobsTable)
    .where(or(eq(crawlJobsTable.status, "running"), eq(crawlJobsTable.status, "pending")));

  if (stale.length > 0) {
    await db.update(crawlJobsTable)
      .set({ status: "failed", completedAt: new Date(), errorLog: "Manually cancelled by admin" })
      .where(or(eq(crawlJobsTable.status, "running"), eq(crawlJobsTable.status, "pending")));
  }

  await auditLog({ userId: req.user?.userId, action: "cancel_crawl", resource: "crawl_jobs", ipAddress: req.ip });
  res.json({ success: true, cancelled: stale.length });
});

/* ─── Users (Admin Management) ───────────────────────────────── */

router.get("/admin/users", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  const [users, totalRow] = await Promise.all([
    db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        isActive: usersTable.isActive,
        roleId: usersTable.roleId,
        roleName: rolesTable.name,
        createdAt: usersTable.createdAt,
        updatedAt: usersTable.updatedAt,
      })
      .from(usersTable)
      .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(usersTable),
  ]);

  res.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.roleName,
      isActive: u.isActive,
      createdAt: u.createdAt?.toISOString(),
    })),
    total: totalRow[0]?.count ?? 0,
    page,
    limit,
  });
});

const createUserSchema = z.object({
  username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(6).max(100),
  role: z.enum(["admin", "user"]).default("user"),
});

router.post("/admin/users", async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }
  const { username, password, role } = parsed.data;

  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing) { res.status(409).json({ error: "conflict", message: "Username already taken" }); return; }

  const [roleRow] = await db.select({ id: rolesTable.id }).from(rolesTable).where(eq(rolesTable.name, role)).limit(1);
  if (!roleRow) { res.status(400).json({ error: "bad_role", message: "Role not found" }); return; }

  const passwordHash = await bcrypt.hash(password, 12);
  const [insertResult] = await db.insert(usersTable).values({ username, passwordHash, roleId: roleRow.id, isActive: true }).returning({ id: usersTable.id });
  const [newUser] = await db.select({ id: usersTable.id, username: usersTable.username }).from(usersTable).where(eq(usersTable.id, insertResult.id)).limit(1);

  await auditLog({ userId: req.user?.userId, action: "create_user", resource: "users", resourceId: newUser.id, ipAddress: req.ip });
  res.status(201).json({ id: newUser.id, username: newUser.username, role });
});

router.patch("/admin/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }

  const patchSchema = z.object({
    isActive: z.boolean().optional(),
    role: z.enum(["admin", "user"]).optional(),
    password: z.string().min(6).max(100).optional(),
  });

  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "validation_error" }); return; }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  if (parsed.data.password) updates.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  if (parsed.data.role) {
    const [roleRow] = await db.select({ id: rolesTable.id }).from(rolesTable).where(eq(rolesTable.name, parsed.data.role)).limit(1);
    if (!roleRow) { res.status(400).json({ error: "bad_role" }); return; }
    updates.roleId = roleRow.id;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, id));
  await auditLog({ userId: req.user?.userId, action: "update_user", resource: "users", resourceId: id, ipAddress: req.ip });
  res.json({ success: true });
});

router.delete("/admin/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }
  if (id === req.user?.userId) { res.status(400).json({ error: "cannot_delete_self", message: "You cannot delete your own account" }); return; }

  await db.delete(usersTable).where(eq(usersTable.id, id));
  await auditLog({ userId: req.user?.userId, action: "delete_user", resource: "users", resourceId: id, ipAddress: req.ip });
  res.json({ success: true });
});

/* ─── Settings ─────────────────────────────────────────────────── */

router.get("/admin/settings", async (_req, res) => {
  const rows = await db.select().from(settingsTable);
  const map: Record<string, string> = {};
  for (const r of rows) {
    // Mask the API key — never expose the raw value to the frontend
    if (r.key === "openai_api_key") {
      map[r.key] = r.value ? "***configured***" : "";
    } else {
      map[r.key] = r.value;
    }
  }
  res.json({ settings: map });
});

router.patch("/admin/settings", async (req, res) => {
  const schema = z.object({
    guest_search_limit: z.coerce.number().int().min(1).max(1000).optional(),
    limit_reset_hours: z.coerce.number().int().min(1).max(8760).optional(),
    web_search_enabled: z.boolean().optional(),
    openai_enabled: z.boolean().optional(),
    openai_model: z.string().min(1).max(100).optional(),
    openai_api_key: z.string().max(300).optional(),
    crawl_enabled: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "validation_error", details: parsed.error.flatten() }); return; }

  const { openai_api_key, ...rest } = parsed.data;

  // Save standard settings (booleans stored as "true"/"false")
  const entries = Object.entries(rest).filter(([, v]) => v !== undefined) as [string, unknown][];
  for (const [key, value] of entries) {
    const strValue = String(value);
    await db
      .insert(settingsTable)
      .values({ key, value: strValue })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: strValue, updatedAt: new Date() } });
  }

  // Save API key only if a non-empty value was provided (and it's not the masked placeholder)
  if (openai_api_key !== undefined && openai_api_key !== "***configured***") {
    await db
      .insert(settingsTable)
      .values({ key: "openai_api_key", value: openai_api_key })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value: openai_api_key, updatedAt: new Date() } });
  }

  await auditLog({ userId: req.user?.userId, action: "update_settings", resource: "settings", ipAddress: req.ip });
  res.json({ success: true });
});

/* ─── Sitemap Import ─────────────────────────────────────────── */

router.post("/admin/crawl/import-sitemap", async (req, res) => {
  const schema = z.object({ sitemapUrl: z.string().url() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "validation_error", message: "Provide a valid sitemapUrl" }); return; }

  const { sitemapUrl } = parsed.data;

  try {
    const fetchedUrls = new Set<string>();
    const processedSitemaps = new Set<string>();

    async function processSitemap(url: string): Promise<void> {
      if (processedSitemaps.has(url)) return;
      processedSitemaps.add(url);

      const response = await fetch(url, {
        headers: { "User-Agent": "ADYPUBot/1.0 (sitemap-importer)" },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
      const xml = await response.text();

      const sitemapMatches = xml.matchAll(/<sitemap>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/sitemap>/gi);
      const nestedSitemaps = [...sitemapMatches].map(m => m[1].trim());

      const urlMatches = xml.matchAll(/<url>[\s\S]*?<loc>(.*?)<\/loc>[\s\S]*?<\/url>/gi);
      for (const match of urlMatches) {
        const u = match[1].trim();
        if (u) fetchedUrls.add(u);
      }

      for (const nested of nestedSitemaps.slice(0, 10)) {
        await processSitemap(nested);
      }
    }

    await processSitemap(sitemapUrl);

    const domainMap = new Map<string, { domain: string; urlPattern: string; seedUrl: string }>();
    for (const u of fetchedUrls) {
      try {
        const parsedUrl = new URL(u);
        const domain = parsedUrl.hostname;
        if (!domainMap.has(domain)) {
          domainMap.set(domain, {
            domain,
            urlPattern: `${parsedUrl.protocol}//${domain}/*`,
            seedUrl: `${parsedUrl.protocol}//${domain}`,
          });
        }
      } catch {
        // skip malformed URLs
      }
    }

    const existing = await db.select({ domain: sourcesTable.domain }).from(sourcesTable);
    const existingDomains = new Set(existing.map(s => s.domain));

    const toInsert = [...domainMap.values()].filter(s => !existingDomains.has(s.domain));
    let addedCount = 0;
    for (const src of toInsert) {
      await db.insert(sourcesTable).values({ ...src, isActive: true });
      addedCount++;
    }

    await auditLog({ userId: req.user?.userId, action: "import_sitemap", resource: "sources", ipAddress: req.ip });

    res.json({
      success: true,
      totalUrls: fetchedUrls.size,
      domainsFound: domainMap.size,
      sourcesAdded: addedCount,
      sourcesSkipped: domainMap.size - addedCount,
      sitemapsProcessed: processedSitemaps.size,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(422).json({ error: "sitemap_fetch_failed", message });
  }
});

export default router;
