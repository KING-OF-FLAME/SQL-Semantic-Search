import { Router, type IRouter } from "express";
import { db } from "../lib/db";
import { queryLogsTable, answerLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { eq, desc, and, count } from "drizzle-orm";

const router: IRouter = Router();
router.use(requireAuth);

// GET /api/user/history — paginated chat history for the logged-in user
router.get("/user/history", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const userId = req.user!.userId;

  const [history, countResult] = await Promise.all([
    db
      .select({
        id: queryLogsTable.id,
        question: queryLogsTable.question,
        intent: queryLogsTable.intent,
        confidenceLabel: queryLogsTable.confidenceLabel,
        confidenceScore: queryLogsTable.confidenceScore,
        createdAt: queryLogsTable.createdAt,
        answer: answerLogsTable.answer,
      })
      .from(queryLogsTable)
      .leftJoin(answerLogsTable, eq(answerLogsTable.queryLogId, queryLogsTable.id))
      .where(eq(queryLogsTable.userId, userId))
      .orderBy(desc(queryLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(queryLogsTable).where(eq(queryLogsTable.userId, userId)),
  ]);

  res.json({
    history: history.map((h) => ({
      id: h.id,
      question: h.question,
      answer: h.answer ?? null,
      intent: h.intent,
      confidence: {
        label: h.confidenceLabel ?? "unknown",
        score: (h.confidenceScore ?? 0) / 100,
      },
      createdAt: h.createdAt?.toISOString(),
    })),
    total: countResult[0]?.total ?? 0,
    page,
    limit,
  });
});

// DELETE /api/user/history/:id — delete a single history entry
router.delete("/user/history/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid_id" }); return; }
  const userId = req.user!.userId;

  const [entry] = await db
    .select({ id: queryLogsTable.id })
    .from(queryLogsTable)
    .where(and(eq(queryLogsTable.id, id), eq(queryLogsTable.userId, userId)))
    .limit(1);

  if (!entry) { res.status(404).json({ error: "not_found" }); return; }

  await db.delete(queryLogsTable).where(eq(queryLogsTable.id, id));
  res.json({ success: true });
});

// DELETE /api/user/history — clear ALL history for the logged-in user
router.delete("/user/history", async (req, res) => {
  const userId = req.user!.userId;
  await db.delete(queryLogsTable).where(eq(queryLogsTable.userId, userId));
  res.json({ success: true });
});

export default router;
