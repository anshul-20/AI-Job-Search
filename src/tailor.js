import { z } from "zod";
import { chatJson } from "./llm.js";

const bullets = z
  .array(z.object({ source_id: z.string(), text: z.string() }))
  .nullish()
  .transform((v) => v ?? []);

export const ProposalSchema = z.object({
  summary: z.string().nullish().transform((v) => v ?? ""),
  skills_priority: z.array(z.string()).nullish().transform((v) => v ?? []),
  experience: z
    .array(z.object({ id: z.string(), bullets }))
    .nullish()
    .transform((v) => v ?? []),
  projects: z
    .array(z.object({ id: z.string(), bullets }))
    .nullish()
    .transform((v) => v ?? []),
  notes: z.string().nullish().transform((v) => v ?? ""),
});

const SYSTEM = `You tailor an existing resume to a job description. You may only SELECT, REORDER and REPHRASE
content that already exists in the resume JSON you are given.

HARD RULES
1. Never invent skills, tools, employers, titles, dates, metrics or achievements.
2. Each output bullet rephrases exactly ONE source bullet, referenced by source_id. Keep every number and
   named technology exactly as in the source.
3. Allowed: select, reorder, tighten wording, use the job description's vocabulary only where the source genuinely matches.
4. Missing skills are left out, never implied.
5. Use strong past-tense verbs, no first person.

Reply with ONLY a JSON object of this shape:
{
  "summary": string,
  "skills_priority": string[],
  "experience": [{ "id": string, "bullets": [{ "source_id": string, "text": string }] }],
  "projects":   [{ "id": string, "bullets": [{ "source_id": string, "text": string }] }],
  "notes": string
}
"skills_priority" lists skills ALREADY in the resume, most relevant to the job first.
"id" values are experience/project ids from the resume; "source_id" values are bullet ids from the resume.
"notes" is a short remark for the candidate (e.g. gaps you noticed).`;

export async function proposeTailoring(resume, analysis, { client } = {}) {
  const user = `JOB ANALYSIS:\n${JSON.stringify(analysis, null, 2)}\n\nRESUME (with ids):\n${JSON.stringify(resume, null, 2)}`;
  const raw = await chatJson(SYSTEM, user, { client });
  const parsed = ProposalSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Model returned an unusable tailoring proposal: ${parsed.error.issues[0]?.message}`);
  }
  return { proposal: parsed.data, raw };
}
