import { Router, type IRouter } from "express";
import { db } from "../lib/db";
import { settingsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/config", async (_req, res) => {
  try {
    const rows = await db.select().from(settingsTable);
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value;

    const guestSearchLimit = Math.max(1, parseInt(map["guest_search_limit"] ?? "5", 10) || 5);
    const webSearchEnabled = map["web_search_enabled"] === "true";
    const openaiEnabled = map["openai_enabled"] !== "false";
    const crawlEnabled = map["crawl_enabled"] !== "false";
    const openaiModel = map["openai_model"] || "gpt-4o-mini";

    res.json({ guestSearchLimit, webSearchEnabled, openaiEnabled, crawlEnabled, openaiModel });
  } catch {
    res.json({ guestSearchLimit: 5, webSearchEnabled: false, openaiEnabled: true, crawlEnabled: true, openaiModel: "gpt-4o-mini" });
  }
});

export default router;
