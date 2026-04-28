import { db } from "./db";
import { auditLogsTable } from "@workspace/db";
import { logger } from "./logger";

export async function auditLog(params: {
  userId?: number;
  action: string;
  resource?: string;
  resourceId?: number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      details: params.details,
      ipAddress: params.ipAddress,
    });
  } catch (err) {
    logger.error({ err }, "Failed to write audit log");
  }
}
