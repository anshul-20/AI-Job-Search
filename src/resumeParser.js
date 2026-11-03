import { PDFParse } from "pdf-parse";
import { chatJson } from "./llm.js";
import { parseResume } from "./resumeIO.js";

const SYSTEM_PROMPT = `You are a resume parsing specialist.
Your job is to parse ANY unstructured resume (from plain text, LinkedIn export, or PDF extraction)
into a structured JSON resume that strictly conforms to the required schema.

HARD REQUIREMENTS:
1. Every experience must have a unique "id" like "exp-1", "exp-2", etc.
2. Every experience bullet must have a unique "id" like "exp-1-1", "exp-1-2", "exp-2-1", etc.
3. Every project must have a unique "id" like "proj-1", "proj-2", etc.
4. Every project bullet must have a unique "id" like "proj-1-1", "proj-1-2", etc.
5. All IDs across the ENTIRE document MUST be completely unique.
6. Extract all real metrics, numbers, technologies, and achievements exactly as stated. Do NOT invent anything.
7. If certain fields (e.g., links or score) are missing, use reasonable empty defaults (empty array or empty string).

Return ONLY a JSON object with this exact structure:
{
  "basics": {
    "name": "Full Name",
    "title": "Professional Title (e.g. Senior Software Engineer)",
    "email": "email@example.com",
    "phone": "+1 ... or +91 ...",
    "location": "City, Country",
    "links": [
      { "label": "LinkedIn", "url": "linkedin.com/in/..." },
      { "label": "GitHub", "url": "github.com/..." }
    ],
    "summary": "Professional summary or objective statement..."
  },
  "skills": [
    { "category": "Languages", "items": ["JavaScript", "Python", ...] },
    { "category": "Frameworks & Libraries", "items": ["React", "Node.js", ...] },
    { "category": "Tools & Platforms", "items": ["Docker", "Git", ...] }
  ],
  "experience": [
    {
      "id": "exp-1",
      "company": "Company Name",
      "role": "Job Title",
      "location": "City, Country",
      "start": "Month Year",
      "end": "Month Year or null if current",
      "bullets": [
        { "id": "exp-1-1", "text": "Action verb + task + quantifiable metric/impact..." },
        { "id": "exp-1-2", "text": "..." }
      ]
    }
  ],
  "projects": [
    {
      "id": "proj-1",
      "name": "Project Name",
      "link": "github.com/... or project link (or empty string)",
      "tech": ["React", "Node.js"],
      "bullets": [
        { "id": "proj-1-1", "text": "Description of project and outcome..." }
      ]
    }
  ],
  "education": [
    {
      "degree": "Degree and Major",
      "institution": "University / College Name",
      "start": "Year",
      "end": "Year",
      "score": "GPA or Grade (or empty string)"
    }
  ],
  "certifications": [
    "AWS Certified Solutions Architect",
    "..."
  ]
}`;

/**
 * Extracts raw text from a PDF, JSON, or text buffer.
 */
export async function extractTextFromBuffer(buffer, filename = "") {
  // If it's already a JSON file
  if (filename.toLowerCase().endsWith(".json")) {
    const text = buffer.toString("utf8");
    try {
      const parsed = JSON.parse(text);
      if (parsed.basics && parsed.experience) {
        return { isStructuredJson: true, data: parseResume(parsed) };
      }
    } catch {
      // not valid JSON; fall through to text parsing
    }
  }

  // Check if buffer is a PDF
  const isPdf = filename.toLowerCase().endsWith(".pdf") || buffer.slice(0, 5).toString("utf8") === "%PDF-";
  if (isPdf) {
    const parser = new PDFParse({ data: buffer });
    await parser.load();
    const result = await parser.getText();
    const extracted = result.text || "";
    if (extracted.trim().length > 50) {
      return { isStructuredJson: false, rawText: extracted.trim() };
    }
  }

  // Default: Plain text or UTF-8 buffer
  return { isStructuredJson: false, rawText: buffer.toString("utf8").trim() };
}

/**
 * Uses LLM to convert raw resume text into the validated, canonical resume schema.
 */
export async function parseRawResumeToSchema(rawText, { client } = {}) {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error("Resume content is too short or empty to parse.");
  }

  const prompt = `CANDIDATE RESUME RAW TEXT:\n\n${rawText}`;
  const parsedJson = await chatJson(SYSTEM_PROMPT, prompt, { client });

  // Guarantee IDs are unique and well-formatted
  let expIdx = 1;
  for (const exp of parsedJson.experience || []) {
    exp.id = `exp-${expIdx}`;
    let bulletIdx = 1;
    for (const b of exp.bullets || []) {
      b.id = `exp-${expIdx}-${bulletIdx++}`;
    }
    expIdx++;
  }

  let projIdx = 1;
  for (const proj of parsedJson.projects || []) {
    proj.id = `proj-${projIdx}`;
    let bulletIdx = 1;
    for (const b of proj.bullets || []) {
      b.id = `proj-${projIdx}-${bulletIdx++}`;
    }
    projIdx++;
  }

  // Ensure arrays exist
  parsedJson.skills ??= [];
  parsedJson.education ??= [];
  parsedJson.certifications ??= [];
  parsedJson.basics ??= {};
  parsedJson.basics.links ??= [];

  // Validate through schema
  return parseResume(parsedJson);
}
