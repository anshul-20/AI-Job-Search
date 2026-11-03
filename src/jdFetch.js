import * as cheerio from "cheerio";

export class JdFetchError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "JdFetchError";
  }
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const SELECTORS = [
  "div.show-more-less-html__markup",
  "div.description__text",
  "#content",
  "div.posting-page",
  "[data-automation-id='jobPostingDescription']",
  "main",
  "article",
];

const PASTE_HINT = "Please paste the job description text instead (LinkedIn and many sites require login).";

export function extractJdText(html) {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  for (const sel of SELECTORS) {
    const el = $(sel).first();
    if (!el.length) continue;
    // keep line breaks for block elements
    el.find("br").replaceWith("\n");
    el.find("p, li, div, h1, h2, h3, h4, h5, h6").each((_, n) => {
      $(n).append("\n");
    });
    const text = el.text().replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    if (text.length > 300) return text;
  }
  return null;
}

export async function fetchJd(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new JdFetchError(`"${url}" is not a valid URL.`);
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new JdFetchError("Only http(s) URLs are supported.");

  let res;
  try {
    res = await fetch(parsed, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new JdFetchError(`Could not fetch ${url}: ${err.message}. ${PASTE_HINT}`, { cause: err });
  }
  if (!res.ok) throw new JdFetchError(`Fetching ${url} returned HTTP ${res.status}. ${PASTE_HINT}`);

  const text = extractJdText(await res.text());
  if (!text) throw new JdFetchError(`Could not extract a job description from ${url}. ${PASTE_HINT}`);
  return text;
}
