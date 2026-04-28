import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import { usersTable, rolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken } from "../lib/jwt";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";

const router: IRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: z.string().min(6).max(100),
});

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: "Invalid input" });
    return;
  }

  const { username, password } = parsed.data;

  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      passwordHash: usersTable.passwordHash,
      roleId: usersTable.roleId,
      isActive: usersTable.isActive,
      roleName: rolesTable.name,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.username, username))
    .limit(1);

  if (!user || !user.isActive) {
    res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
    return;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, username: user.username, role: user.roleName });
  res.json({ token, user: { id: user.id, username: user.username, role: user.roleName } });
});

router.post("/auth/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "validation_error", message: parsed.error.errors[0]?.message ?? "Invalid input" });
    return;
  }

  const { username, password } = parsed.data;

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "conflict", message: "Username is already taken" });
    return;
  }

  const [userRole] = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.name, "user"))
    .limit(1);

  if (!userRole) {
    res.status(500).json({ error: "internal_error", message: "Default role not configured" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [insertResult] = await db
    .insert(usersTable)
    .values({ username, passwordHash, roleId: userRole.id, isActive: true })
    .returning({ id: usersTable.id });
  const [newUser] = await db
    .select({ id: usersTable.id, username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, insertResult.id))
    .limit(1);

  const token = signToken({ userId: newUser.id, username: newUser.username, role: "user" });
  res.status(201).json({ token, user: { id: newUser.id, username: newUser.username, role: "user" } });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const [user] = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      roleName: rolesTable.name,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.id, req.user!.userId))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }

  res.json({ id: user.id, username: user.username, role: user.roleName, createdAt: user.createdAt?.toISOString() });
});

export default router;
