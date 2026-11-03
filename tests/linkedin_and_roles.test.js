import { describe, it, expect } from "vitest";
import { resolveDirectAtsUrl, deriveSearchTermsFromResume, cleanJobTitle } from "../src/jobSearch.js";
import { isEligibleJobPortalUrl } from "../src/formFiller.js";

describe("Role Derivation and Custom Roles", () => {
  it("derives target roles cleanly from resume title", () => {
    const fakeResume = {
      basics: {
        title: "Senior Full Stack Engineer | React & Node.js | Cloud Architect",
        location: "Bengaluru, India",
      },
      skills: [{ items: ["React", "Node.js", "TypeScript", "AWS", "Docker"] }],
    };
    const derived = deriveSearchTermsFromResume(fakeResume);
    expect(derived.primaryKeyword).toBe("Senior Full Stack Engineer");
    expect(derived.roles.length).toBeGreaterThanOrEqual(2);
    expect(derived.roles).toContain("Senior Full Stack Engineer");
    expect(derived.roles).toContain("React & Node.js");
  });

  it("handles single-role resume title without error", () => {
    const fakeResume = {
      basics: {
        title: "Machine Learning Engineer",
        location: "Remote",
      },
      skills: [{ items: ["Python", "PyTorch", "Transformers"] }],
    };
    const derived = deriveSearchTermsFromResume(fakeResume);
    expect(derived.primaryKeyword).toBe("Machine Learning Engineer");
    expect(derived.roles).toEqual(["Machine Learning Engineer"]);
  });
});

describe("Title Cleaning for ATS Search", () => {
  it("cleans messy title with company name, parens, and location", () => {
    const raw = "Oliver Wyman – Senior / Lead Data Scientist (AI and Generative AI) - Gurugram";
    const cleaned = cleanJobTitle(raw, "Oliver Wyman");
    expect(cleaned).toBe("Senior Lead Data Scientist");
  });
});

describe("ATS Career Portal Resolver", () => {
  it("returns null gracefully if company is empty", async () => {
    const res = await resolveDirectAtsUrl("Software Engineer", "");
    expect(res).toBeNull();
  });
});

describe("Job Portal Eligibility Guard", () => {
  it("rejects Google Sign-in and Chrome sync URLs", () => {
    const googleSync = "https://accounts.google.com/v3/signin/identifier?continue=https://accounts.google.com/signin/chrome/sync/finish";
    expect(isEligibleJobPortalUrl(googleSync)).toBe(false);
  });

  it("rejects LinkedIn, about:blank, and internal browser schemes", () => {
    expect(isEligibleJobPortalUrl("https://in.linkedin.com/jobs/view/12345")).toBe(false);
    expect(isEligibleJobPortalUrl("about:blank")).toBe(false);
    expect(isEligibleJobPortalUrl("chrome://welcome")).toBe(false);
  });

  it("accepts valid ATS company portals", () => {
    expect(isEligibleJobPortalUrl("https://jobs.lever.co/rapidclaims/123")).toBe(true);
    expect(isEligibleJobPortalUrl("https://boards.greenhouse.io/videosdk/jobs/456")).toBe(true);
    expect(isEligibleJobPortalUrl("https://careers.tvsnext.com/job/ai-engineer")).toBe(true);
    expect(isEligibleJobPortalUrl("https://rapidclaims.ai/careers")).toBe(true);
  });
});

