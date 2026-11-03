import { z } from "zod";
import { chatJson } from "./llm.js";

export const CoverLetterSchema = z.object({
  paragraphs: z.array(z.string()).min(2).max(5),
  summary_pitch: z.string().nullish().transform((v) => v ?? ""),
});

const SYSTEM = `You write targeted, professional, and authentic cover letters.
You must use ONLY genuine details from the candidate's resume and connect them meaningfully to the job description.

RULES:
1. Ground every claim in the candidate's actual resume (do NOT invent degrees, companies, metrics, or technologies).
2. Tone: Confident, professional, forward-looking, and authentic. Avoid clichés like "I am writing to express my enthusiasm for...".
3. Structure (3-4 paragraphs):
   - Paragraph 1: Direct, compelling opening stating why this specific role and company align with the candidate's background.
   - Paragraph 2-3: Core impact narrative: link 1-2 concrete achievements or projects from the resume directly to the company's stated requirements.
   - Paragraph 4: Enthusiastic closing paragraph indicating readiness to discuss how they can contribute.
4. Length: Fit comfortably on a single A4 page (approximately 250-350 words total).

Reply with ONLY a JSON object of this shape:
{
  "paragraphs": [
    "First paragraph...",
    "Second paragraph...",
    "Third paragraph...",
    "Fourth paragraph..."
  ],
  "summary_pitch": "One-line hook summarizing why the candidate is a strong fit"
}`;

export async function generateCoverLetter(resume, analysis, { client } = {}) {
  const user = `JOB ANALYSIS:\n${JSON.stringify(analysis, null, 2)}\n\nCANDIDATE RESUME:\n${JSON.stringify(resume, null, 2)}`;
  const raw = await chatJson(SYSTEM, user, { client });
  const parsed = CoverLetterSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`Model returned an unusable cover letter structure: ${parsed.error.issues[0]?.message}`);
  }
  return parsed.data;
}
