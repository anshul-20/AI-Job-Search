import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { chatJson, extractJson, LLMError } from "../src/llm.js";
import { unsupportedTerms, applyProposal } from "../src/guard.js";
import { loadResume, flattenText, parseResume } from "../src/resumeIO.js";
import { skillCoverage } from "../src/analyzer.js";
import { run } from "../src/pipeline.js";
import { closeBrowser } from "../src/renderer.js";

const resume = loadResume("tests/fixtures/sample_resume.json");
const corpus = flattenText(resume).toLowerCase();

/** Fake OpenAI-style client returning queued replies. */
function fakeClient(replies) {
  const queue = [...replies];
  const calls = [];
  return {
    calls,
    chat: {
      completions: {
        create: async (req) => {
          calls.push(req);
          const next = queue.shift();
          if (next instanceof Error) throw next;
          if (next === undefined) throw new Error("fake client queue empty");
          return { choices: [{ message: { content: next } }] };
        },
      },
    },
  };
}

afterAll(closeBrowser);

describe("JSON extraction", () => {
  it("handles <think> blocks, fences, prose and braces in strings", () => {
    expect(extractJson('<think>{"x":1}</think>{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('Sure! Here you go: {"a":3} hope it helps')).toEqual({ a: 3 });
    expect(extractJson('noise {"a":"has } and { braces \\" ok"} tail')).toEqual({ a: 'has } and { braces " ok' });
  });

  it("retries on bad JSON, then succeeds", async () => {
    const client = fakeClient(["not json at all", '{"ok":true}']);
    expect(await chatJson("s", "u", { client })).toEqual({ ok: true });
    expect(client.calls).toHaveLength(2);
  });

  it("retries without response_format on a 400", async () => {
    const err = Object.assign(new Error("bad request"), { status: 400 });
    const client = fakeClient([err, '{"ok":1}']);
    expect(await chatJson("s", "u", { client })).toEqual({ ok: 1 });
    expect(client.calls[1].response_format).toBeUndefined();
  });

  it("throws LLMError after 3 bad replies", async () => {
    const client = fakeClient(["x", "y", "z"]);
    await expect(chatJson("s", "u", { client })).rejects.toBeInstanceOf(LLMError);
  });
});

describe("resume validation", () => {
  it("rejects duplicate ids", () => {
    const bad = structuredClone(resume);
    bad.projects[0].id = bad.experience[0].id;
    expect(() => parseResume(bad)).toThrow(/duplicate ids/);
  });
});

describe("unsupportedTerms", () => {
  const src = "Reduced app startup time by 35% by lazy-loading modules in Redux.";
  it("passes a legitimate rewrite", () => {
    expect(unsupportedTerms("Cut startup time by 35% through lazy-loading modules in Redux.", src, corpus)).toEqual([]);
  });
  it("flags a changed percentage", () => {
    expect(unsupportedTerms("Reduced startup time by 50%.", src, corpus)).toContain("50%");
  });
  it("flags a new tech term", () => {
    expect(unsupportedTerms("Reduced startup time using Kubernetes.", src, corpus)).toContain("Kubernetes");
  });
});

describe("applyProposal", () => {
  const base = () => ({
    summary: "",
    skills_priority: [],
    experience: [],
    projects: [],
    notes: "",
  });

  it("keeps good rewrites and reverts bad ones", () => {
    const p = base();
    p.experience = [
      {
        id: "exp-pay",
        bullets: [
          { source_id: "exp-pay-2", text: "Cut app startup time by 35% via lazy-loading modules and optimizing Redux store initialization." },
          { source_id: "exp-pay-3", text: "Built reusable UI components in TypeScript and Kubernetes, cutting screen development time by 40%." },
          { source_id: "exp-pay-4", text: "Integrated REST APIs and Firebase push notifications, improving re-engagement by 50%." },
          { source_id: "nope-1", text: "Invented bullet." },
        ],
      },
    ];
    const { final, warnings } = applyProposal(resume, p);
    const bullets = final.experience[0].bullets;
    expect(bullets[0].text).toMatch(/^Cut app startup time by 35%/);
    expect(bullets[1].text).toBe(resume.experience[0].bullets[2].text);
    expect(bullets[2].text).toBe(resume.experience[0].bullets[3].text);
    expect(bullets.map((b) => b.id)).not.toContain("nope-1");
    expect(warnings.join("\n")).toMatch(/Kubernetes/);
    expect(warnings.join("\n")).toMatch(/50%/);
    expect(warnings.join("\n")).toMatch(/nope-1/);
  });

  it("keeps all roles and falls back to original bullets", () => {
    const { final } = applyProposal(resume, base());
    expect(final.experience.map((e) => e.id)).toEqual(resume.experience.map((e) => e.id));
    expect(final.experience[1].bullets).toHaveLength(4);
    expect(final.experience[0].bullets).toHaveLength(5);
    expect(final.projects.length).toBe(3);
  });

  it("never adds skills and reorders by priority", () => {
    const p = base();
    p.skills_priority = ["GraphQL", "Tools", "Redux"];
    const { final, warnings } = applyProposal(resume, p);
    const all = final.skills.flatMap((s) => s.items);
    expect(all).not.toContain("GraphQL");
    expect(all.sort()).toEqual(resume.skills.flatMap((s) => s.items).sort());
    expect(warnings.join("\n")).toMatch(/GraphQL/);
    expect(final.skills[0].category).toBe("Tools");
    expect(final.skills[1].category).toBe("Mobile");
    expect(final.skills[1].items[0]).toBe("Redux");
  });

  it("keeps the original summary when the rewrite invents terms", () => {
    const p = base();
    p.summary = "Kubernetes expert with 10 years of experience.";
    expect(applyProposal(resume, p).final.basics.summary).toBe(resume.basics.summary);
  });

  it("orders projects by the model and drops unknown ids", () => {
    const p = base();
    p.projects = [{ id: "proj-chat", bullets: [] }, { id: "ghost", bullets: [] }, { id: "proj-fit", bullets: [] }];
    const { final } = applyProposal(resume, p);
    expect(final.projects.map((x) => x.id)).toEqual(["proj-chat", "proj-fit"]);
  });
});

describe("full pipeline (offline)", () => {
  it("produces a PDF and a report listing missing skills", async () => {
    const analysis = JSON.stringify({
      job_title: "Senior React Native Developer",
      company: "FinServe Labs",
      seniority: "senior",
      years_experience: 4,
      required_skills: ["React Native", "TypeScript", "Redux", "GraphQL"],
      nice_to_have_skills: ["Kubernetes", "Detox"],
      keywords: ["mobile"],
      responsibilities: ["Build features"],
      domain: "fintech",
    });
    const proposal = JSON.stringify({
      summary: "React Native developer with 4 years of experience building cross-platform mobile apps for fintech products.",
      skills_priority: ["React Native", "TypeScript", "Redux"],
      experience: [
        { id: "exp-pay", bullets: [{ source_id: "exp-pay-1", text: "Led development of a React Native payments app used by 500K+ users on Android and iOS." }] },
      ],
      projects: [{ id: "proj-fit", bullets: [] }],
      notes: "No GraphQL experience found.",
    });
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "rt-"));
    const jd = fs.readFileSync("sample-jd.txt", "utf8");
    const result = await run(jd, { outDir, withCoverLetter: false, client: fakeClient([analysis, proposal]), log: () => {} });

    const pdf = path.join(result.dir, result.resumePdfName);
    expect(fs.statSync(pdf).size).toBeGreaterThan(5000);
    const report = fs.readFileSync(path.join(result.dir, "report.md"), "utf8");
    expect(report).toMatch(/GraphQL/);
    expect(report).toMatch(/Required skills missing/);
    for (const f of ["resume.html", "job_description.txt", "analysis.json", "tailored_resume.json", "model_proposal.json"]) {
      expect(fs.existsSync(path.join(result.dir, f))).toBe(true);
    }
    expect(skillCoverage(resume, JSON.parse(analysis).required_skills ? { required_skills: ["GraphQL"], nice_to_have_skills: [] } : {}).required_missing).toEqual(["GraphQL"]);
  }, 60_000);
});
