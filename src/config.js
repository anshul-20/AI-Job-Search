import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  OPENROUTER_API_KEY: z.string().default(""),
  OPENROUTER_MODEL: z.string().default("deepseek/deepseek-chat"),
  OPENROUTER_BASE_URL: z.string().default("https://openrouter.ai/api/v1"),
  RESUME_PATH: z.string().default("data/resume.json"),
  OUTPUT_DIR: z.string().default("output"),
  MAX_BULLETS_PER_ROLE: z.coerce.number().int().positive().default(5),
  MAX_PROJECTS: z.coerce.number().int().positive().default(3),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.2),
  PORT: z.coerce.number().int().positive().default(3000),
  AUTO_SEARCH_KEYWORDS: z.string().default(""),
  AUTO_SEARCH_LOCATION: z.string().default("India and Remote"),
  AUTO_SEARCH_SOURCE: z.string().default("all"), // "all", "careers", "linkedin", "naukri", "indeed", "remoteok"
  AUTO_MIN_MATCH_PCT: z.coerce.number().min(0).max(100).default(70),
  AUTO_MAX_JOBS_PER_RUN: z.coerce.number().int().positive().default(25),
  AUTO_APPLY_ENABLED: z.coerce.boolean().default(true),
});

export function loadConfig(env = process.env) {
  // treat empty strings as unset so `KEY=` in .env falls back to defaults
  const cleaned = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined && v !== ""),
  );
  const parsed = schema.safeParse(cleaned);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration in .env: ${msg}`);
  }
  return parsed.data;
}

export const config = loadConfig();
