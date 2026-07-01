import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

export const config = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),

  jwtSecret:
    process.env.JWT_SECRET ??
    (isProduction ? required("JWT_SECRET") : "dev-insecure-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  seedAdminEmail: process.env.ADMIN_EMAIL ?? "",
  seedAdminPassword: process.env.ADMIN_PASSWORD ?? "",
  seedAdminName: process.env.ADMIN_NAME ?? "Admin",

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  visionModel: process.env.VISION_MODEL ?? "claude-sonnet-4-5",
  visionMock: process.env.VISION_MOCK === "1",

  storageDir: process.env.STORAGE_DIR ?? "./storage",
  storagePublicPath: process.env.STORAGE_PUBLIC_PATH ?? "/photos",

  serveFrontend: process.env.SERVE_FRONTEND === "1" || isProduction,
  frontendDir: process.env.FRONTEND_DIR ?? "../frontend/dist",

  buildSha: process.env.BUILD_SHA ?? "dev",
  buildTime: process.env.BUILD_TIME ?? "",
};
