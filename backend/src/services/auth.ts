import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../lib/config.js";
import { prisma } from "../lib/prisma.js";

export interface TokenPayload {
  sub: string;
  email: string;
  role: "ADMIN" | "USER";
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: TokenPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  };
  return jwt.sign(payload, config.jwtSecret, options);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as TokenPayload;
  } catch {
    return null;
  }
}

export async function seedAdmin(): Promise<void> {
  const count = await prisma.user.count();
  if (count > 0) return;
  if (!config.seedAdminEmail || !config.seedAdminPassword) {
    console.warn(
      "[auth] No users and no ADMIN_EMAIL/ADMIN_PASSWORD set — set them to create the first admin."
    );
    return;
  }
  await prisma.user.create({
    data: {
      email: config.seedAdminEmail.toLowerCase(),
      name: config.seedAdminName,
      passwordHash: await hashPassword(config.seedAdminPassword),
      role: "ADMIN",
    },
  });
  console.log(`[auth] Seeded admin user: ${config.seedAdminEmail}`);
}
