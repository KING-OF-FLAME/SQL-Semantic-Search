import bcrypt from "bcryptjs";
import { eq, or } from "drizzle-orm";
import { db } from "./db";
import { rolesTable, usersTable, sourcesTable, crawlJobsTable, settingsTable } from "@workspace/db";
import { logger } from "./logger";

const DEFAULT_SETTINGS: Record<string, string> = {
  guest_search_limit: "5",
  limit_reset_hours: "24",
  web_search_enabled: "false",
  openai_enabled: "true",
  openai_model: "gpt-4o-mini",
  openai_api_key: "",
  crawl_enabled: "true",
};

export async function runStartupSeed(): Promise<void> {
  try {
    // Fix any stale "running" or "pending" crawl jobs from a previous server session
    const staleJobs = await db
      .select({ id: crawlJobsTable.id })
      .from(crawlJobsTable)
      .where(or(eq(crawlJobsTable.status, "running"), eq(crawlJobsTable.status, "pending")));

    if (staleJobs.length > 0) {
      await db
        .update(crawlJobsTable)
        .set({ status: "failed", completedAt: new Date(), errorLog: "Server restarted mid-crawl" })
        .where(or(eq(crawlJobsTable.status, "running"), eq(crawlJobsTable.status, "pending")));
      logger.info({ staleJobs: staleJobs.map((j) => j.id) }, "Startup: marked stale crawl jobs as failed");
    }

    // Ensure roles exist
    const existingRoles = await db.select().from(rolesTable);
    let adminRoleId: number;

    if (existingRoles.length === 0) {
      await db.insert(rolesTable).values([{ name: "admin" }, { name: "user" }]);
      const insertedRoles = await db.select().from(rolesTable);
      adminRoleId = insertedRoles.find((r) => r.name === "admin")!.id;
      logger.info("Startup seed: roles created");
    } else {
      adminRoleId = existingRoles.find((r) => r.name === "admin")!.id;
    }

    // Ensure admin user exists
    const existingAdmin = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, "admin"))
      .limit(1);

    if (existingAdmin.length === 0) {
      const passwordHash = await bcrypt.hash("adypu-admin-2024", 12);
      await db.insert(usersTable).values({
        username: "admin",
        passwordHash,
        roleId: adminRoleId,
        isActive: true,
      });
      logger.info("Startup seed: admin user created");
    }

    // Ensure ADYPU source domains exist
    const existingSources = await db.select().from(sourcesTable);
    if (existingSources.length === 0) {
      await db.insert(sourcesTable).values([
        {
          domain: "adypu.edu.in",
          urlPattern: "https://adypu.edu.in/*",
          seedUrl: "https://adypu.edu.in",
          isActive: true,
        },
        {
          domain: "admissions.adypu.edu.in",
          urlPattern: "https://admissions.adypu.edu.in/*",
          seedUrl: "https://admissions.adypu.edu.in",
          isActive: true,
        },
        {
          domain: "www.adypu.edu.in",
          urlPattern: "https://www.adypu.edu.in/*",
          seedUrl: "https://www.adypu.edu.in",
          isActive: true,
        },
      ]);
      logger.info("Startup seed: ADYPU source domains created");
    }

    // Seed default settings (only insert if they don't already exist)
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      const existing = await db.select().from(settingsTable).where(eq(settingsTable.key, key)).limit(1);
      if (existing.length === 0) {
        await db.insert(settingsTable).values({ key, value });
      }
    }
    logger.info("Startup seed: settings seeded");
  } catch (err) {
    logger.warn({ err }, "Startup seed failed (tables may not exist yet — run db:push first)");
  }
}
