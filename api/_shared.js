const chunks = require("../data/research_chunks.json");

const ALLOWED_ORIGINS = new Set([
  "https://ljtatm5-crypto.github.io",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "http://localhost:3000"
]);
const requestBuckets = new Map();

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.has(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

function json(res, status, body) { return res.status(status).json(body); }

function rateLimit(req, res, max = 20) {
  const ip = String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "local").split(",")[0].trim();
  const now = Date.now();
  const bucket = requestBuckets.get(ip) || { count: 0, reset: now + 60000 };
  if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + 60000; }
  bucket.count += 1;
  requestBuckets.set(ip, bucket);
  res.setHeader("X-RateLimit-Limit", String(max));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - bucket.count)));
  if (bucket.count > max) { json(res, 429, { error: "请求过于频繁，请稍后再试" }); return true; }
  return false;
}

function words(text) {
  return String(text || "").toLowerCase().match(/[\u4e00-\u9fff]{2,}|[a-z0-9.%-]+/g) || [];
}

function retrieve(query, limit = 4) {
  const queryWords = words(query);
  return chunks.map((chunk) => {
    const haystack = `${chunk.topic} ${chunk.keywords.join(" ")} ${chunk.text}`.toLowerCase();
    let score = 0;
    queryWords.forEach((word) => {
      if (haystack.includes(word)) score += word.length > 2 ? 3 : 1;
      chunk.keywords.forEach((keyword) => {
        if (word.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(word)) score += 2;
      });
    });
    if (chunk.topic && query.includes(chunk.topic)) score += 4;
    return { chunk, score };
  }).sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.chunk);
}

function cosine(a, b) {
  let dot = 0, aa = 0, bb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    dot += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i];
  }
  return dot / (Math.sqrt(aa) * Math.sqrt(bb) || 1);
}

async function embed(input) {
  if (!process.env.EMBEDDING_API_KEY || !process.env.EMBEDDING_API_URL) return null;
  const response = await fetch(process.env.EMBEDDING_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.EMBEDDING_API_KEY}` },
    body: JSON.stringify({ model: process.env.EMBEDDING_MODEL || "text-embedding-3-small", input })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.data)) throw new Error("EMBEDDING_API_FAILED");
  return data.data.map((item) => item.embedding);
}

async function semanticRetrieve(query, limit = 10) {
  const embeddedChunks = chunks.filter((chunk) => Array.isArray(chunk.embedding));
  if (!embeddedChunks.length) return retrieve(query, limit);
  const vectors = await embed([query]);
  if (!vectors) return retrieve(query, limit);
  return embeddedChunks.map((chunk) => ({ chunk, score: cosine(vectors[0], chunk.embedding) }))
    .sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.chunk);
}

async function rerank(query, candidates, limit = 4) {
  if (!process.env.RERANK_API_KEY || !process.env.RERANK_API_URL) return candidates.slice(0, limit);
  const response = await fetch(process.env.RERANK_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.RERANK_API_KEY}` },
    body: JSON.stringify({
      model: process.env.RERANK_MODEL,
      query,
      documents: candidates.map((item) => item.text),
      top_n: limit
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.results)) return candidates.slice(0, limit);
  return data.results.map((item) => candidates[item.index]).filter(Boolean);
}

async function deepseek(messages, options = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY_NOT_CONFIGURED");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      messages,
      stream: false,
      thinking: { type: "disabled" },
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens || 800,
      ...(options.json ? { response_format: { type: "json_object" } } : {})
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message || `DEEPSEEK_${response.status}`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("DEEPSEEK_EMPTY_RESPONSE");
  return content;
}

module.exports = { cors, json, rateLimit, retrieve, semanticRetrieve, rerank, deepseek };
