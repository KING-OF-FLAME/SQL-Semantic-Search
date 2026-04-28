import { Router, type IRouter } from "express";
import { db } from "../lib/db";
import { feedbackTable } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const feedbackSchema = z.object({
  queryLogId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

router.post("/feedback", async (req, res) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid input" });
    return;
  }

  await db.insert(feedbackTable).values(parsed.data);

  res.json({ success: true });
});

export default router;
