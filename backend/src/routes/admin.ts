import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { hashPassword } from "../services/auth.js";
import { getVersionInfo } from "../lib/version.js";

export const adminRouter = Router();

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

/**
 * GET /version — public build/version info (also shown in the app footer).
 */
adminRouter.get("/version", (_req, res) => {
  res.json(getVersionInfo());
});

/** GET /admin/version — same info, behind admin (for the admin panel). */
adminRouter.get("/admin/version", requireAuth, requireAdmin, (_req, res) => {
  res.json(getVersionInfo());
});

/** GET /admin/users — list all users. */
adminRouter.get("/admin/users", requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: userSelect,
      orderBy: { createdAt: "asc" },
    });
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

/** POST /admin/users — create a user. Body: { email, password, name?, role? } */
adminRouter.post("/admin/users", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? "").toLowerCase().trim();
    const password = String(req.body?.password ?? "");
    const name = req.body?.name ? String(req.body.name) : null;
    const role = req.body?.role === "ADMIN" ? "ADMIN" : "USER";

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "A user with that email exists" });

    const user = await prisma.user.create({
      data: { email, name, role, passwordHash: await hashPassword(password) },
      select: userSelect,
    });
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /admin/users/:id — update role / active / name / password.
 */
adminRouter.patch("/admin/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const data: Record<string, unknown> = {};
    if (b.role === "ADMIN" || b.role === "USER") data.role = b.role;
    if (typeof b.active === "boolean") data.active = b.active;
    if (typeof b.name === "string") data.name = b.name;
    if (typeof b.password === "string") {
      if (b.password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }
      data.passwordHash = await hashPassword(b.password);
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    // Guard: don't let an admin lock everyone out by demoting/deactivating the
    // last active admin.
    if (data.role === "USER" || data.active === false) {
      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (target?.role === "ADMIN") {
        const activeAdmins = await prisma.user.count({
          where: { role: "ADMIN", active: true },
        });
        if (activeAdmins <= 1) {
          return res.status(400).json({ error: "Cannot demote/deactivate the last admin" });
        }
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
      select: userSelect,
    });
    res.json(user);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    next(err);
  }
});

/** DELETE /admin/users/:id — remove a user (not the last admin). */
adminRouter.delete("/admin/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.role === "ADMIN") {
      const activeAdmins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
      if (activeAdmins <= 1) {
        return res.status(400).json({ error: "Cannot delete the last admin" });
      }
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
