import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const usersTable = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 100 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    roleId: integer("role_id")
      .notNull()
      .references(() => rolesTable.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("users_username_idx").on(t.username)],
);

export const sourcesTable = pgTable(
  "sources",
  {
    id: serial("id").primaryKey(),
    domain: varchar("domain", { length: 255 }).notNull(),
    urlPattern: varchar("url_pattern", { length: 500 }).notNull(),
    seedUrl: varchar("seed_url", { length: 500 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("sources_domain_idx").on(t.domain)],
);

export const crawlJobsTable = pgTable(
  "crawl_jobs",
  {
    id: serial("id").primaryKey(),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    pagesFound: integer("pages_found").notNull().default(0),
    totalPagesDiscovered: integer("total_pages_discovered").notNull().default(0),
    pagesProcessed: integer("pages_processed").notNull().default(0),
    pagesFailed: integer("pages_failed").notNull().default(0),
    triggeredBy: integer("triggered_by").references(() => usersTable.id),
    errorLog: text("error_log"),
    startedAt: timestamp("started_at", { mode: "date" }),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("crawl_jobs_status_idx").on(t.status)],
);

export const documentsTable = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sourcesTable.id),
    crawlJobId: integer("crawl_job_id").references(() => crawlJobsTable.id),
    title: text("title").notNull(),
    sourceUrl: varchar("source_url", { length: 1000 }).notNull(),
    contentType: varchar("content_type", { length: 50 }).notNull().default("html"),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    rawText: text("raw_text"),
    metadata: json("metadata"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("documents_source_id_idx").on(t.sourceId),
    index("documents_content_hash_idx").on(t.contentHash),
  ],
);

export const documentChunksTable = pgTable(
  "document_chunks",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documentsTable.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    title: text("title"),
    content: text("content").notNull(),
    embedding: json("embedding"),
    tokenCount: integer("token_count"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("chunks_document_id_idx").on(t.documentId)],
);

export const documentEntitiesTable = pgTable(
  "document_entities",
  {
    id: serial("id").primaryKey(),
    chunkId: integer("chunk_id")
      .notNull()
      .references(() => documentChunksTable.id, { onDelete: "cascade" }),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityValue: text("entity_value").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("entities_chunk_id_idx").on(t.chunkId),
    index("entities_type_idx").on(t.entityType),
  ],
);

export const queryLogsTable = pgTable(
  "query_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    rewrittenQuery: text("rewritten_query"),
    intent: varchar("intent", { length: 100 }),
    entities: json("entities"),
    confidenceScore: integer("confidence_score").notNull().default(0),
    confidenceLabel: varchar("confidence_label", { length: 20 }),
    sessionId: varchar("session_id", { length: 100 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("query_logs_user_idx").on(t.userId),
    index("query_logs_intent_idx").on(t.intent),
    index("query_logs_confidence_idx").on(t.confidenceScore),
    index("query_logs_created_idx").on(t.createdAt),
  ],
);

export const answerLogsTable = pgTable("answer_logs", {
  id: serial("id").primaryKey(),
  queryLogId: integer("query_log_id")
    .notNull()
    .references(() => queryLogsTable.id, { onDelete: "cascade" }),
  answer: text("answer").notNull(),
  chunkIds: json("chunk_ids"),
  retrievalScore: integer("retrieval_score").notNull().default(0),
  rerankScore: integer("rerank_score").notNull().default(0),
  sourceAgreementScore: integer("source_agreement_score").notNull().default(0),
  freshnessScore: integer("freshness_score").notNull().default(0),
  answerabilityScore: integer("answerability_score").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const feedbackTable = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    queryLogId: integer("query_log_id")
      .notNull()
      .references(() => queryLogsTable.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [index("feedback_query_log_idx").on(t.queryLogId)],
);

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id),
    action: varchar("action", { length: 100 }).notNull(),
    resource: varchar("resource", { length: 100 }),
    resourceId: integer("resource_id"),
    details: json("details"),
    ipAddress: varchar("ip_address", { length: 50 }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_logs_user_idx").on(t.userId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const insertSourceSchema = createInsertSchema(sourcesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSource = z.infer<typeof insertSourceSchema>;
export type Source = typeof sourcesTable.$inferSelect;

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;

export const insertChunkSchema = createInsertSchema(documentChunksTable).omit({
  id: true,
  createdAt: true,
});
export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type DocumentChunk = typeof documentChunksTable.$inferSelect;
