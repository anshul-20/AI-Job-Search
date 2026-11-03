import { z } from "zod";
import { chatJson } from "./llm.js";
import { flattenText } from "./resumeIO.js";

const list = z
  .array(z.string())
  .nullish()
  .transform((v) => (v ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 15));

const SENIORITY = ["intern", "junior", "mid", "senior", "lead", "principal", "manager", "unknown"];

export const AnalysisSchema = z.object({
  job_title: z.string().default("Unknown role"),
  company: z.string().nullish().transform((v) => v || null),
  seniority: z
    .string()
    .nullish()
    .transform((v) => {
      const s = (v ?? "").toLowerCase();
      return SENIORITY.includes(s) ? s : "unknown";
    }),
  years_experience: z.union([z.number(), z.string()]).nullish().transform((v) => v ?? null),
  required_skills: list,
  nice_to_have_skills: list,
  keywords: list,
  responsibilities: list,
  domain: z.string().nullish().transform((v) => v || null),
});

const SYSTEM = `You analyse job descriptions. Reply with ONLY a JSON object of this exact shape:
{
  "job_title": string,
  "company": string | null,
  "seniority": "intern" | "junior" | "mid" | "senior" | "lead" | "principal" | "manager" | "unknown",
  "years_experience": number | string | null,
  "required_skills": string[],
  "nice_to_have_skills": string[],
  "keywords": string[],
  "responsibilities": string[],
  "domain": string | null
}
Rules: use short canonical skill names (e.g. "React Native", "TypeScript", "REST APIs"); at most 15 items per list;
only include what the job description actually states; never invent details; use null when unknown.`;

export async function analyzeJob(jdText, { client } = {}) {
  const jd = jdText.trim();
  if (jd.length < 100) {
    throw new Error("The job description is too short (under 100 characters). Paste the full text.");
  }
  const raw = await chatJson(SYSTEM, `JOB DESCRIPTION:\n\n${jd}`, { client });
  const parsed = AnalysisSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Model returned an unusable job analysis: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}

export function skillCoverage(resume, analysis) {
  const text = flattenText(resume).toLowerCase();
  const split = (skills) => {
    const matched = [];
    const missing = [];
    for (const s of skills) (text.includes(s.toLowerCase()) ? matched : missing).push(s);
    return [matched, missing];
  };
  const [required_matched, required_missing] = split(analysis.required_skills);
  const [nice_matched, nice_missing] = split(analysis.nice_to_have_skills);
  const total = analysis.required_skills.length;
  const required_match_pct = total === 0 ? 100 : Math.round((required_matched.length / total) * 100);
  return { required_matched, required_missing, nice_matched, nice_missing, required_match_pct };
}
