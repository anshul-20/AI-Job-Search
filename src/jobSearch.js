import * as cheerio from "cheerio";
import { extractJdText } from "./jdFetch.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Searches public LinkedIn job listings (no account or login required).
 */
export async function searchLinkedInJobs({ keywords, location = "India", limit = 10 } = {}) {
  const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
    keywords,
  )}&location=${encodeURIComponent(location)}&start=0`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new Error(`Failed to reach LinkedIn search: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`LinkedIn search returned HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs = [];

  $("li").each((_, el) => {
    if (jobs.length >= limit) return;
    const titleEl = $(el).find(".base-search-card__title");
    const companyEl = $(el).find(".base-search-card__subtitle");
    const locationEl = $(el).find(".job-search-card__location");
    const linkEl = $(el).find("a.base-card__full-link");
    const timeEl = $(el).find("time");

    const title = titleEl.text().trim();
    const company = companyEl.text().trim();
    const loc = locationEl.text().trim();
    let link = linkEl.attr("href") || "";
    const posted = timeEl.attr("datetime") || timeEl.text().trim();

    if (link.includes("?")) {
      link = link.split("?")[0];
    }

    if (title && company) {
      const jobId = extractLinkedInJobId(link);
      jobs.push({
        id: jobId || Buffer.from(link).toString("base64").slice(0, 12),
        title,
        company,
        location: loc,
        link,
        posted,
        source: "LinkedIn",
      });
    }
  });

  return jobs;
}

export function extractLinkedInJobId(linkOrId) {
  if (!linkOrId) return "";
  const str = String(linkOrId).trim();
  const m1 = str.match(/-([0-9]{8,12})(?:[/?#]|$)/);
  if (m1) return m1[1];
  const m2 = str.match(/view\/([0-9]{8,12})/);
  if (m2) return m2[1];
  const m3 = str.match(/[?&]currentJobId=([0-9]{8,12})/);
  if (m3) return m3[1];
  const m4 = str.match(/jobPosting\/([0-9]{8,12})/);
  if (m4) return m4[1];
  const m5 = str.match(/\b([0-9]{9,11})\b/);
  if (m5) return m5[1];
  return str;
}

/**
 * Fetches full job description for a LinkedIn job ID or public URL.
 */
export async function fetchLinkedInJd(jobIdOrUrl) {
  const jobId = extractLinkedInJobId(jobIdOrUrl);
  let html = "";
  const guestUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;

  try {
    const res = await fetch(guestUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      html = await res.text();
    }
  } catch {}

  // Fallback to public job page if guest API endpoint returns 429 or is unavailable
  if (!html || !html.includes("description") && !html.includes("show-more-less-html")) {
    const publicUrl = String(jobIdOrUrl).startsWith("http")
      ? jobIdOrUrl
      : `https://www.linkedin.com/jobs/view/${jobId}`;
    try {
      const res2 = await fetch(publicUrl, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (res2.ok) {
        html = await res2.text();
      }
    } catch {}
  }

  if (!html) {
    throw new Error(`Could not fetch details for job ID ${jobId}`);
  }

  const $ = cheerio.load(html);

  const title = $("h2.top-card-layout__title").text().trim() || $("h1").first().text().trim();
  const company = $("a.topcard__org-name-link").text().trim() || $(".topcard__flavor").first().text().trim();
  const descriptionHtml = $(".show-more-less-html__markup").html() || $(".description__text").html() || html;
  const description = extractJdText(descriptionHtml) || $.text();

  // Search description for any direct company apply link
  let directApplyUrl = null;
  const urlMatches = description.match(/https?:\/\/[^\s"'<>]*(?:greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|myworkdayjobs\.com|[a-z0-9.-]+\/careers|[a-z0-9.-]+\/jobs)[^\s"'<>]*/gi);
  if (urlMatches && urlMatches.length > 0) {
    directApplyUrl = urlMatches[0].replace(/[.,;:)]+$/, "");
  }

  return {
    jobId,
    title,
    company,
    description: (description || "").trim(),
    directApplyUrl,
  };
}

/**
 * Cleans noisy job titles by removing company prefixes, locations, brackets, and parentheticals.
 */
export function cleanJobTitle(title, company) {
  let t = title || "";
  if (company) {
    const esc = company.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    t = t.replace(new RegExp(`^${esc}\\s*[-–—:|]\\s*`, "i"), "");
    t = t.replace(new RegExp(`\\s*[-–—:|]\\s*${esc}\\s*$`, "i"), "");
  }
  // Remove trailing location or department after dash
  t = t.replace(
    /\s*[-–—]\s*(?:Gurugram|Bengaluru|Bangalore|Mumbai|Delhi|Noida|Pune|Hyderabad|Chennai|India|Remote|Worldwide|Hybrid|Onsite|Full[- ]?time|[A-Z][a-z]+, [A-Z]{2}).*$/i,
    "",
  );
  // Remove parentheticals and brackets
  t = t.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "");
  // Normalize slashes
  t = t.replace(/\s*\/\s*/g, " ");
  // Collapse whitespace
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Resolves a company's direct ATS or career portal URL using the job title and company name.
 * Used when a job posting on LinkedIn redirects offsite to the company career site.
 */
export async function resolveDirectAtsUrl(title, company) {
  if (!company) return null;
  const cleanTitle = cleanJobTitle(title, company);
  if (!cleanTitle) return null;

  const coreTitle = cleanTitle.replace(/^(?:Senior|Lead|Junior|Staff|Principal|Associate)\s+/i, "");

  const queries = [
    `"${company}" "${cleanTitle}" (site:greenhouse.io OR site:lever.co OR site:ashbyhq.com OR site:workable.com OR site:smartrecruiters.com OR site:myworkdayjobs.com OR site:careers)`,
    `"${company}" "${coreTitle}" careers apply`,
  ];

  for (const query of queries) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent": UA,
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;

      const html = await res.text();
      const $ = cheerio.load(html);
      let foundUrl = null;

      $(".result").each((_, el) => {
        if (foundUrl) return;
        const titleEl = $(el).find(".result__title a");
        const rawHref = titleEl.attr("href") || "";
        if (rawHref.includes("uddg=")) {
          try {
            const parsed = new URL(`https://duckduckgo.com${rawHref}`);
            const cleanUrl = decodeURIComponent(parsed.searchParams.get("uddg") || "");
            if (
              cleanUrl &&
              !cleanUrl.includes("linkedin.com") &&
              !cleanUrl.includes("duckduckgo.com") &&
              !cleanUrl.includes("glassdoor.") &&
              !cleanUrl.includes("indeed.")
            ) {
              foundUrl = cleanUrl;
            }
          } catch {}
        }
      });

      if (foundUrl) return foundUrl;
    } catch {}
  }

  return null;
}

/**
 * Searches Indeed public jobs via syndication RSS feeds.
 */
export async function searchIndeedJobs({ keywords, location = "India", limit = 10 } = {}) {
  const isIndia = /india|bangalore|bengaluru|delhi|mumbai|pune|hyderabad|chennai|noida|gurgaon/i.test(location);
  const domain = isIndia ? "https://in.indeed.com" : "https://www.indeed.com";
  const url = `${domain}/rss?q=${encodeURIComponent(keywords)}&l=${encodeURIComponent(location)}`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/rss+xml,application/xml,text/xml",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new Error(`Failed to reach Indeed RSS: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Indeed returned HTTP ${res.status}`);
  }

  const xml = await res.text();
  const $ = cheerio.load(xml, { xmlMode: true });
  const jobs = [];

  $("item").each((_, el) => {
    if (jobs.length >= limit) return;
    const title = $(el).find("title").text().trim();
    let link = $(el).find("link").text().trim();
    const description = $(el).find("description").text().trim();
    const source = $(el).find("source").text().trim();
    const pubDate = $(el).find("pubDate").text().trim();

    if (link.includes("?")) {
      link = link.split("?")[0];
    }

    if (title && link) {
      jobs.push({
        id: Buffer.from(link).toString("base64").slice(0, 12),
        title,
        company: source || "Indeed Employer",
        location,
        link,
        posted: pubDate,
        description: cheerio.load(description).text().trim(),
        source: "Indeed",
      });
    }
  });

  return jobs;
}

/**
 * Searches Naukri public job listings via public search endpoint.
 */
export async function searchNaukriJobs({ keywords, location = "India", limit = 10 } = {}) {
  const url = `https://www.naukri.com/jobapi/v3/search?noOfResults=${limit}&urlType=search_by_keyword&searchType=adv&keyword=${encodeURIComponent(
    keywords,
  )}&location=${encodeURIComponent(location)}`;

  let res;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        appid: "109",
        systemid: "109",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new Error(`Failed to reach Naukri search: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Naukri returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const rawJobs = data.jobDetails || [];
  const jobs = [];

  for (const item of rawJobs) {
    if (jobs.length >= limit) break;
    const title = item.title || "";
    const company = item.companyName || "Naukri Employer";
    const link = item.jdURL
      ? item.jdURL.startsWith("http")
        ? item.jdURL
        : `https://www.naukri.com${item.jdURL}`
      : "";
    const loc = item.placeholders?.find((p) => p.type === "location")?.label || location;
    const exp = item.placeholders?.find((p) => p.type === "experience")?.label || "";
    const desc = item.jobDescription || "";

    if (title) {
      jobs.push({
        id: String(item.jobId || jobs.length),
        title,
        company,
        location: loc,
        experience: exp,
        link,
        description: cheerio.load(desc).text().trim(),
        source: "Naukri",
      });
    }
  }

  return jobs;
}

/**
 * Fetches remote developer & tech jobs from RemoteOK public API.
 */
export async function searchRemoteOkJobs({ tag = "react", limit = 10 } = {}) {
  const url = `https://remoteok.com/api?tag=${encodeURIComponent(tag)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`RemoteOK returned HTTP ${res.status}`);
  const data = await res.json();
  const postings = data.filter((item) => item.position && item.company).slice(0, limit);

  return postings.map((p) => ({
    id: String(p.id),
    title: p.position,
    company: p.company,
    location: p.location || "Remote",
    link: p.url,
    description: p.description ? cheerio.load(p.description).text().trim() : "",
    tags: p.tags || [],
    source: "RemoteOK",
  }));
}

/**
 * Searches direct company career pages (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Breezy)
 * via web query, finding positions in India and Remote worldwide.
 */
export async function searchCareerPages({ keywords, location = "India and Remote", limit = 10 } = {}) {
  // Top modern ATS portals where companies host official career pages
  const sites = [
    "site:boards.greenhouse.io",
    "site:jobs.lever.co",
    "site:jobs.ashbyhq.com",
    "site:apply.workable.com",
    "site:jobs.smartrecruiters.com",
  ].join(" OR ");

  // Support both India and Remote Worldwide
  let locFilter = '("India" OR "Bengaluru" OR "Bangalore" OR "Remote" OR "Worldwide" OR "Anywhere")';
  if (location && !location.toLowerCase().includes("both") && !location.toLowerCase().includes("remote") && !location.toLowerCase().includes("india")) {
    locFilter = `"${location}"`;
  }

  const query = `(${sites}) "${keywords}" ${locFilter}`.trim();
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  let res;
  try {
    res = await fetch(searchUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new Error(`Failed to query career pages: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`Career search returned HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const jobs = [];

  const ATS_DOMAINS = [
    "boards.greenhouse.io",
    "jobs.lever.co",
    "jobs.ashbyhq.com",
    "apply.workable.com",
    "jobs.smartrecruiters.com",
  ];

  $(".result").each((_, el) => {
    if (jobs.length >= limit) return;
    const titleEl = $(el).find(".result__title a");
    const snippetEl = $(el).find(".result__snippet");
    let link = $(el).find(".result__url").text().trim();
    const rawHref = titleEl.attr("href") || "";

    // Extract actual link from DuckDuckGo redirect or text
    let cleanUrl = "";
    if (rawHref.includes("uddg=")) {
      try {
        const parsed = new URL(`https://duckduckgo.com${rawHref}`);
        cleanUrl = decodeURIComponent(parsed.searchParams.get("uddg") || "");
      } catch {
        cleanUrl = "";
      }
    }
    if (!cleanUrl) {
      for (const domain of ATS_DOMAINS) {
        if (link.startsWith(domain)) {
          cleanUrl = `https://${link}`;
          break;
        }
      }
    }

    if (cleanUrl) {
      const fullTitle = titleEl.text().trim().replace(/\s*-\s*(Greenhouse|Lever|Ashby|Workable|SmartRecruiters).*/i, "");
      let company = "Company Direct";

      // Detect hiring company name from ATS URL structure
      if (cleanUrl.includes("greenhouse.io/")) {
        company = cleanUrl.split("greenhouse.io/")[1]?.split("/")[0] || "Greenhouse";
      } else if (cleanUrl.includes("lever.co/")) {
        company = cleanUrl.split("lever.co/")[1]?.split("/")[0] || "Lever";
      } else if (cleanUrl.includes("ashbyhq.com/")) {
        company = cleanUrl.split("ashbyhq.com/")[1]?.split("/")[0] || "Ashby";
      } else if (cleanUrl.includes("workable.com/")) {
        company = cleanUrl.split("workable.com/")[1]?.split("/")[0] || "Workable";
      } else if (cleanUrl.includes("smartrecruiters.com/")) {
        company = cleanUrl.split("smartrecruiters.com/")[1]?.split("/")[0] || "SmartRecruiters";
      }

      company = company.replace(/[-_]+/g, " ");
      company = company.charAt(0).toUpperCase() + company.slice(1);

      // Detect location from snippet
      const snippet = snippetEl.text().trim();
      let jobLoc = "India / Remote";
      if (/remote|anywhere|worldwide|wfh/i.test(snippet) && !/india/i.test(snippet)) {
        jobLoc = "Remote (Worldwide)";
      } else if (/india|bengaluru|bangalore|pune|hyderabad|delhi|mumbai|noida|gurgaon/i.test(snippet)) {
        jobLoc = "India (Onsite/Hybrid/Remote)";
      }

      jobs.push({
        id: Buffer.from(cleanUrl).toString("base64").slice(0, 12),
        title: fullTitle || keywords,
        company,
        location: jobLoc,
        link: cleanUrl,
        description: snippet,
        source: "Direct Career Page (ATS)",
      });
    }
  });

  return jobs;
}

/**
 * Automatically extracts targeted search terms and locations (India + Remote) from resume.
 */
export function deriveSearchTermsFromResume(resume) {
  const rawTitle = resume.basics?.title || "Data Scientist";
  const userCity = resume.basics?.location || "India";
  const allSkills = (resume.skills || []).flatMap((s) => s.items || []);
  const topSkills = allSkills.slice(0, 5);

  // Split title if it contains multiple roles (e.g. "Data Scientist | AI/ML Engineer | NLP | Generative AI")
  const candidateRoles = rawTitle
    .split(/[|/,•;]+/)
    .map((r) => r.trim())
    .filter((r) => r.length > 2);

  const primaryKeyword = candidateRoles[0] || rawTitle;

  return {
    title: rawTitle,
    roles: candidateRoles.length ? candidateRoles : [primaryKeyword],
    location: "India and Remote",
    city: userCity,
    targetLocations: ["India", "Remote", "Worldwide"],
    topSkills,
    primaryKeyword,
    combinedQuery: `${primaryKeyword} ${topSkills.slice(0, 2).join(" ")}`.trim(),
  };
}

function getRemoteOkTag(keyword = "") {
  const k = keyword.toLowerCase();
  if (k.includes("data") || k.includes("scientist") || k.includes("machine learning") || k.includes("ml")) return "data-science";
  if (k.includes("ai") || k.includes("llm") || k.includes("nlp") || k.includes("generative")) return "ai";
  if (k.includes("python")) return "python";
  if (k.includes("react")) return "react";
  if (k.includes("frontend")) return "frontend";
  if (k.includes("backend")) return "backend";
  if (k.includes("devops") || k.includes("cloud")) return "devops";
  return k.replace(/[^a-z0-9]/g, "-").slice(0, 15) || "engineer";
}

/**
 * Unified search across LinkedIn, Indeed, Naukri, RemoteOK, and Direct Career Pages.
 * Handles both India (Bengaluru, etc.) and Global Remote postings.
 */
export async function searchJobs({ keywords, location = "India and Remote", source = "all", limit = 12 } = {}) {
  let cleanKeywords = keywords || "";
  if (cleanKeywords.includes("|") || cleanKeywords.includes("/")) {
    cleanKeywords = cleanKeywords.split(/[|/]+/)[0].trim();
  }

  const src = source.toLowerCase();
  if (src === "linkedin") {
    return searchLinkedInJobs({ keywords: cleanKeywords, location: location.includes("India") ? "India" : location, limit });
  }
  if (src === "indeed") {
    return searchIndeedJobs({ keywords: cleanKeywords, location: location.includes("India") ? "India" : location, limit });
  }
  if (src === "naukri") {
    return searchNaukriJobs({ keywords: cleanKeywords, location: location.includes("India") ? "India" : location, limit });
  }
  if (src === "remoteok") {
    return searchRemoteOkJobs({ tag: getRemoteOkTag(cleanKeywords), limit });
  }
  if (src === "careers" || src === "direct") {
    return searchCareerPages({ keywords: cleanKeywords, location, limit });
  }

  // "all": query each source with full requested limit so user receives plenty of postings
  const roTag = getRemoteOkTag(cleanKeywords);
  const results = await Promise.allSettled([
    searchLinkedInJobs({ keywords: cleanKeywords, location: "India", limit: Math.max(20, limit) }),
    searchCareerPages({ keywords: cleanKeywords, location: "India and Remote", limit: Math.max(15, limit) }),
    searchRemoteOkJobs({ tag: roTag, limit: Math.max(15, limit) }),
    searchNaukriJobs({ keywords: cleanKeywords, location: "India", limit: Math.max(10, Math.floor(limit / 2)) }),
    searchIndeedJobs({ keywords: cleanKeywords, location: "India", limit: Math.max(10, Math.floor(limit / 2)) }),
  ]);

  const combined = [];
  const seenLinks = new Set();
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      for (const item of r.value) {
        if (!seenLinks.has(item.link)) {
          seenLinks.add(item.link);
          combined.push(item);
        }
      }
    }
  }
  return combined.slice(0, limit);
}
