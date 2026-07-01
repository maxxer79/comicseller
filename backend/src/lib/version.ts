import { readFileSync } from "node:fs";
import path from "node:path";
import { config } from "./config.js";

function readVersion(): string {
  const candidates = [
    path.resolve(process.cwd(), "VERSION"),
    path.resolve(process.cwd(), "..", "VERSION"),
    "/app/VERSION",
  ];
  for (const p of candidates) {
    try {
      const v = readFileSync(p, "utf8").trim();
      if (v) return v;
    } catch {
      /* try next */
    }
  }
  return config.buildSha !== "dev" ? config.buildSha : "0.0.0";
}

export interface VersionInfo {
  version: string;
  buildSha: string;
  buildTime: string;
  nodeEnv: string;
}

export function getVersionInfo(): VersionInfo {
  return {
    version: readVersion(),
    buildSha: config.buildSha,
    buildTime: config.buildTime,
    nodeEnv: config.nodeEnv,
  };
}
