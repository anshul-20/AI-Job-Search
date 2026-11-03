import OpenAI from "openai";
import { config } from "./config.js";

export class LLMError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = "LLMError";
  }
}

export function makeClient(apiKey = config.OPENROUTER_API_KEY, baseURL = config.OPENROUTER_BASE_URL) {
  const isLocal = baseURL.includes("localhost") || baseURL.includes("127.0.0.1");
  if (!apiKey && !isLocal) {
    throw new LLMError("API Key is not set. Add OPENROUTER_API_KEY in your .env file.");
  }
  return new OpenAI({ apiKey: apiKey || "local-key", baseURL });
}

export function stripThink(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/i, "").trim();
}

/** Find the first balanced {...} object, aware of strings and escapes. */
export function firstBalancedObject(text) {
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}" && --depth === 0) {
        const candidate = text.slice(start, i + 1);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          break; // balanced but invalid; try the next "{"
        }
      }
    }
  }
  return null;
}

export function extractJson(raw) {
  const text = stripThink(raw);
  try {
    return JSON.parse(text);
  } catch {
    const obj = firstBalancedObject(text);
    if (obj === null) throw new SyntaxError("No JSON object found in model reply");
    return JSON.parse(obj);
  }
}

async function complete(client, params, useJsonMode) {
  const req = {
    model: config.OPENROUTER_MODEL,
    temperature: config.LLM_TEMPERATURE,
    ...params,
    ...(useJsonMode ? { response_format: { type: "json_object" } } : {}),
  };
  const isDeepSeekOrCustom = client.baseURL && !client.baseURL.includes("openrouter.ai");
  const headers = isDeepSeekOrCustom
    ? {}
    : { "HTTP-Referer": "http://localhost", "X-Title": "resume-tailor" };
  const res = await client.chat.completions.create(req, { headers });
  return res.choices?.[0]?.message?.content ?? "";
}

/**
 * Ask the model for a JSON object. Returns the parsed (unvalidated) value;
 * callers must pass it through zod.
 */
export async function chatJson(system, user, { client } = {}) {
  const c = client ?? makeClient();
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  let jsonMode = true;
  let lastErr;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let reply;
    try {
      reply = await complete(c, { messages }, jsonMode);
    } catch (err) {
      if (jsonMode && err?.status === 400) {
        jsonMode = false; // provider rejected response_format; retry once without it
        try {
          reply = await complete(c, { messages }, false);
        } catch (err2) {
          throw apiError(err2);
        }
      } else {
        throw apiError(err);
      }
    }
    try {
      return extractJson(reply);
    } catch (err) {
      lastErr = err;
      messages.push(
        { role: "assistant", content: reply },
        { role: "user", content: "That was not valid JSON. Reply with ONLY the JSON object." },
      );
    }
  }
  throw new LLMError(`Model did not return valid JSON after 3 attempts (${lastErr?.message})`, {
    cause: lastErr,
  });
}

function apiError(err) {
  if (err instanceof LLMError) return err;
  const status = err?.status ? ` (HTTP ${err.status})` : "";
  return new LLMError(`OpenRouter request failed${status}: ${err?.message ?? err}`, { cause: err });
}
