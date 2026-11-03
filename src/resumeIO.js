import fs from "node:fs";
import { z } from "zod";
import { config } from "./config.js";

const bullet = z.object({ id: z.string().min(1), text: z.string().min(1) });

export const ResumeSchema = z.object({
  basics: z.object({
    name: z.string(),
    title: z.string(),
    email: z.string(),
    phone: z.string(),
    location: z.string(),
    links: z.array(z.object({ label: z.string(), url: z.string() })),
    summary: z.string(),
  }),
  skills: z.array(z.object({ category: z.string(), items: z.array(z.string()) })),
  experience: z.array(
    z.object({
      id: z.string().min(1),
      company: z.string(),
      role: z.string(),
      location: z.string(),
      start: z.string(),
      end: z.string().nullable(),
      bullets: z.array(bullet),
    }),
  ),
  projects: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string(),
      link: z.string().optional().default(""),
      tech: z.array(z.string()).optional().default([]),
      bullets: z.array(bullet),
    }),
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      start: z.string(),
      end: z.string(),
      score: z.string().optional().default(""),
    }),
  ),
  certifications: z.array(z.string()).optional().default([]),
});

function assertUniqueIds(resume) {
  const seen = new Set();
  const dupes = new Set();
  const add = (id) => (seen.has(id) ? dupes.add(id) : seen.add(id));
  for (const item of [...resume.experience, ...resume.projects]) {
    add(item.id);
    item.bullets.forEach((b) => add(b.id));
  }
  if (dupes.size) {
    throw new Error(`resume.json has duplicate ids: ${[...dupes].join(", ")}. All ids must be unique.`);
  }
}

export function parseResume(data) {
  const parsed = ResumeSchema.safeParse(data);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`resume.json is invalid:\n${msg}`);
  }
  assertUniqueIds(parsed.data);
  return parsed.data;
}

export function loadResume(path = config.RESUME_PATH) {
  let raw;
  try {
    raw = fs.readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(`Cannot read resume file at ${path}: ${err.message}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(`resume.json is not valid JSON: ${err.message}`);
  }
  return parseResume(data);
}

/** All free text of the resume, concatenated. */
export function flattenText(resume) {
  const parts = [
    resume.basics.title,
    resume.basics.summary,
    ...resume.skills.flatMap((s) => [s.category, ...s.items]),
    ...resume.experience.flatMap((e) => [e.company, e.role, ...e.bullets.map((b) => b.text)]),
    ...resume.projects.flatMap((p) => [p.name, ...p.tech, ...p.bullets.map((b) => b.text)]),
    ...resume.education.flatMap((e) => [e.degree, e.institution]),
    ...resume.certifications,
  ];
  return parts.join("\n");
}

export function allSkillItems(resume) {
  return resume.skills.flatMap((s) => s.items);
}
