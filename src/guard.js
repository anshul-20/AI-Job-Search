import { config } from "./config.js";
import { flattenText } from "./resumeIO.js";

const TOKEN_RE = /\d[\d.,]*%?|[A-Za-z][A-Za-z0-9.+#/\-]*[A-Za-z0-9+#]/g;

const isNumber = (tok) => /^\d/.test(tok);
const cleanNumber = (tok) => tok.replace(/[.,]+$/, "");

function tokens(text) {
  const out = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const before = text.slice(0, m.index).trimEnd();
    const sentenceStart = before === "" || /[.!?:\n•\-*]$/.test(before);
    out.push({ tok: m[0], sentenceStart });
  }
  return out;
}

function techLooking({ tok, sentenceStart }) {
  if (/\d/.test(tok) || /[.+#/]/.test(tok)) return true;
  return /[A-Z]/.test(tok) && !sentenceStart;
}

/**
 * Terms in `text` that are not backed by the resume.
 * - numbers/percentages must occur in `sourceText`
 * - tech-looking tokens must occur in `corpus` (lowercased resume text)
 */
export function unsupportedTerms(text, sourceText, corpus) {
  const sourceNums = new Set(tokens(sourceText).filter((t) => isNumber(t.tok)).map((t) => cleanNumber(t.tok)));
  const lowerCorpus = corpus.toLowerCase();
  const bad = [];
  for (const t of tokens(text)) {
    if (isNumber(t.tok)) {
      const n = cleanNumber(t.tok);
      if (!sourceNums.has(n)) bad.push(n);
    } else if (techLooking(t) && !lowerCorpus.includes(t.tok.toLowerCase())) {
      bad.push(t.tok);
    }
  }
  return [...new Set(bad)];
}

const norm = (s) => s.trim().toLowerCase();

function pickBullets(originalBullets, candidates, max, label, corpus, warnings) {
  const byId = new Map(originalBullets.map((b) => [b.id, b]));
  const used = new Set();
  const out = [];
  for (const c of candidates) {
    const src = byId.get(c.source_id);
    if (!src) continue; // ownership/unknown handled by caller
    if (used.has(c.source_id)) {
      warnings.push(`${label}: dropped duplicate bullet for ${c.source_id}.`);
      continue;
    }
    if (out.length >= max) {
      warnings.push(`${label}: dropped bullet ${c.source_id} (cap of ${max} reached).`);
      continue;
    }
    used.add(c.source_id);
    const bad = unsupportedTerms(c.text, src.text, corpus);
    if (bad.length) {
      warnings.push(`${label}: reverted ${c.source_id} to original; rewrite had unsupported terms: ${bad.join(", ")}.`);
      out.push({ id: src.id, text: src.text });
    } else {
      out.push({ id: src.id, text: c.text.trim() || src.text });
    }
  }
  if (out.length === 0) {
    if (candidates.length) warnings.push(`${label}: no usable model bullets; using first ${max} original bullets.`);
    return originalBullets.slice(0, max).map((b) => ({ id: b.id, text: b.text }));
  }
  return out;
}

export function applyProposal(original, proposal, opts = {}) {
  const maxBullets = opts.maxBulletsPerRole ?? config.MAX_BULLETS_PER_ROLE;
  const maxProjects = opts.maxProjects ?? config.MAX_PROJECTS;
  const warnings = [];
  const corpus = flattenText(original).toLowerCase();
  const final = structuredClone(original);

  // Summary
  if (proposal.summary.trim()) {
    const bad = unsupportedTerms(proposal.summary, flattenText(original), corpus);
    if (bad.length) {
      warnings.push(`Summary: kept original; model version had unsupported terms: ${bad.join(", ")}.`);
    } else {
      final.basics.summary = proposal.summary.trim();
    }
  } else {
    warnings.push("Summary: model returned none; kept original.");
  }

  // Which item owns which bullet
  const owner = new Map();
  for (const e of original.experience) e.bullets.forEach((b) => owner.set(b.id, e.id));
  for (const p of original.projects) p.bullets.forEach((b) => owner.set(b.id, p.id));

  const gather = (entries) => {
    const perItem = new Map();
    for (const entry of entries) {
      for (const b of entry.bullets) {
        const o = owner.get(b.source_id);
        if (!o) {
          warnings.push(`Dropped bullet with unknown source_id "${b.source_id}".`);
          continue;
        }
        if (!perItem.has(o)) perItem.set(o, []);
        perItem.get(o).push(b);
      }
    }
    return perItem;
  };

  // Experience: keep every role, original order
  const expBullets = gather(proposal.experience);
  final.experience = original.experience.map((role) => ({
    ...role,
    bullets: pickBullets(
      role.bullets,
      expBullets.get(role.id) ?? [],
      maxBullets,
      `Experience "${role.company}"`,
      corpus,
      warnings,
    ),
  }));

  // Projects: model's order, existing ids only
  const projBullets = gather(proposal.projects);
  const projById = new Map(original.projects.map((p) => [p.id, p]));
  const seen = new Set();
  const chosen = [];
  for (const entry of proposal.projects) {
    const p = projById.get(entry.id);
    if (!p) {
      warnings.push(`Dropped unknown project id "${entry.id}".`);
      continue;
    }
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (chosen.length >= maxProjects) {
      warnings.push(`Project "${p.name}" dropped (cap of ${maxProjects} reached).`);
      continue;
    }
    chosen.push({
      ...p,
      bullets: pickBullets(p.bullets, projBullets.get(p.id) ?? [], maxBullets, `Project "${p.name}"`, corpus, warnings),
    });
  }
  if (chosen.length === 0) {
    if (proposal.projects.length) warnings.push(`No usable projects from model; using first ${maxProjects} originals.`);
    final.projects = original.projects.slice(0, maxProjects).map((p) => structuredClone(p));
  } else {
    final.projects = chosen;
  }

  // Skills: never add, only reorder
  const priority = proposal.skills_priority.map(norm).filter(Boolean);
  const known = new Set(original.skills.flatMap((s) => [norm(s.category), ...s.items.map(norm)]));
  for (const s of proposal.skills_priority) {
    if (!known.has(norm(s)) && !corpus.includes(norm(s))) {
      warnings.push(`Model named skill "${s}" which is not in your resume; ignored.`);
    }
  }
  const rank = (name) => {
    const i = priority.indexOf(norm(name));
    return i === -1 ? Infinity : i;
  };
  const cats = original.skills.map((cat, idx) => {
    const items = cat.items
      .map((item, i) => ({ item, i, r: rank(item) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map((x) => x.item);
    const score = Math.min(rank(cat.category), ...cat.items.map(rank));
    return { cat: { category: cat.category, items }, score, idx };
  });
  cats.sort((a, b) => a.score - b.score || a.idx - b.idx);
  final.skills = cats.map((c) => c.cat);

  return { final, warnings };
}
