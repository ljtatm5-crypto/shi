const chunks = require("../data/research_chunks.json");
const nutritionDb = require("../data/nutrition-db.json");

const NUTRITION_KEYS = ["calories_kcal", "protein_g", "fat_g", "carbohydrate_g", "sodium_mg"];

function findFood(name) {
  const input = String(name || "").replace(/[（）()\s]/g, "");
  return Object.entries(nutritionDb).find(([food, item]) => [food].concat(item.aliases || []).some((alias) => input.includes(alias) || alias.includes(input)));
}

function calcNutritionFromIngredients(ingredients) {
  const total = { calories_kcal: 0, protein_g: 0, fat_g: 0, carbohydrate_g: 0, sodium_mg: 0 };
  const matched = [];
  (Array.isArray(ingredients) ? ingredients : []).forEach((ingredient) => {
    const found = findFood(ingredient.name);
    if (!found) return;
    const [food, item] = found;
    const factor = Math.max(1, Number(ingredient.weight_g) || 0) / 100;
    NUTRITION_KEYS.forEach((key) => { total[key] += Number(item[key] || 0) * factor; });
    matched.push({ name: ingredient.name, database_food: food, weight_g: Number(ingredient.weight_g) || 0 });
  });
  NUTRITION_KEYS.forEach((key) => { total[key] = Math.round(total[key] * 10) / 10; });
  return { nutrition: total, matched };
}

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

// ---------- 检索：分词 ----------
function words(text) {
  const source = String(text || "").toLowerCase();
  const tokens = source.match(/[a-z0-9.%-]+/g) || [];
  const cjk = source.match(/[一-鿿]+/g) || [];
  cjk.forEach((seg) => {
    if (seg.length <= 2) { tokens.push(seg); return; }
    for (let i = 0; i < seg.length - 1; i += 1) tokens.push(seg.slice(i, i + 2));
  });
  return tokens;
}

// ---------- 论文特征重要性 → 检索概念加权 ----------
// 依据论文决策树特征权重（信任32%、感知易用性22%、情感价值20%为前三，
// 合计74.1%）与随机森林（情感+信任63.9%）的结论，对核心概念词做检索加权。
const CONCEPT_WEIGHTS = {
  "信任": 3.2,
  "感知易用性": 2.2,
  "易用性": 1.6,
  "情感价值": 2.0,
  "主观规范": 1.0,
  "感知有用性": 0.9,
  "有用性": 0.5,
  "付费意愿": 0.7
};

// ---------- 语料预计算（BM25 / TF-IDF） ----------
const corpusDocs = chunks.map((chunk) => ({ chunk, tokens: words(`${chunk.topic} ${chunk.keywords.join(" ")} ${chunk.text}`) }));
const docFreq = {};
corpusDocs.forEach((doc) => {
  new Set(doc.tokens).forEach((term) => { docFreq[term] = (docFreq[term] || 0) + 1; });
});
const avgDocLen = corpusDocs.reduce((sum, doc) => sum + doc.tokens.length, 0) / Math.max(1, corpusDocs.length);
const corpusTotal = corpusDocs.length;

function termFreq(tokens, term) {
  let count = 0;
  tokens.forEach((t) => { if (t === term) count += 1; });
  return count;
}

function bm25Score(docTokens, queryTokens) {
  let score = 0;
  const dl = Math.max(1, docTokens.length);
  const seen = new Set();
  queryTokens.forEach((term) => {
    if (seen.has(term)) return;
    seen.add(term);
    const df = docFreq[term] || 0;
    if (!df) return;
    const tf = termFreq(docTokens, term);
    const idf = Math.log(1 + (corpusTotal - df + 0.5) / (df + 0.5));
    score += idf * ((tf * 2.5) / (tf + 1.2 * (0.25 + 0.75 * dl / avgDocLen)));
  });
  return score;
}

function tfidfScore(docTokens, queryTokens) {
  let score = 0;
  const dl = Math.max(1, docTokens.length);
  const seen = new Set();
  queryTokens.forEach((term) => {
    if (seen.has(term)) return;
    seen.add(term);
    const df = docFreq[term] || 0;
    if (!df) return;
    const tf = termFreq(docTokens, term) / dl;
    const idf = Math.log(corpusTotal / (df + 1)) + 1;
    score += tf * idf;
  });
  return score;
}

// 关键词路：中文二元组 + 关键词表双向匹配（原 retrieve 的评分逻辑）
function keywordScores(query) {
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
  });
}

function retrieve(query, limit = 4) {
  return keywordScores(query)
    .sort((a, b) => b.score - a.score)
    .filter((item) => item.score > 0)
    .slice(0, limit)
    .map((item) => item.chunk);
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

// ---------- 多路召回融合 ----------
// FinalScore = w1·BM25 + w2·Embedding + w3·TF-IDF + w4·关键词 + 论文概念加权
// 嵌入不可用时自动重分配权重（BM25/关键词为主）。
async function fusedRetrieve(query, limit = 4) {
  const queryTokens = words(query);
  const kwAll = keywordScores(query);

  let embMap = null;
  try {
    const embeddedChunks = chunks.filter((chunk) => Array.isArray(chunk.embedding));
    if (embeddedChunks.length) {
      const vectors = await embed([query]);
      if (vectors) {
        embMap = new Map();
        embeddedChunks.forEach((chunk) => embMap.set(chunk.id, cosine(vectors[0], chunk.embedding)));
      }
    }
  } catch (error) {
    console.error("embed-fallback", error.message);
  }

  const candidates = kwAll.map(({ chunk, score }) => {
    const docTokens = corpusDocs.find((doc) => doc.chunk.id === chunk.id)?.tokens || [];
    return {
      chunk,
      kw: score,
      bm25: bm25Score(docTokens, queryTokens),
      tfidf: tfidfScore(docTokens, queryTokens),
      emb: embMap ? (embMap.get(chunk.id) || 0) : 0
    };
  });

  const normalize = (key) => {
    const vals = candidates.map((c) => c[key]);
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    if (max === min) { candidates.forEach((c) => { c[key] = 0; }); return; }
    candidates.forEach((c) => { c[key] = (c[key] - min) / (max - min); });
  };
  normalize("kw"); normalize("bm25"); normalize("tfidf"); normalize("emb");

  const weights = embMap
    ? { kw: 0.20, bm25: 0.30, tfidf: 0.10, emb: 0.30, concept: 0.10 }
    : { kw: 0.35, bm25: 0.40, tfidf: 0.15, concept: 0.10 };

  const conceptHits = Object.entries(CONCEPT_WEIGHTS).filter(([term]) => String(query).includes(term));
  candidates.forEach((c) => {
    c.final = weights.kw * c.kw + weights.bm25 * c.bm25 + weights.tfidf * c.tfidf + (weights.emb ? weights.emb * c.emb : 0);
    conceptHits.forEach(([term, w]) => {
      if (c.chunk.keywords.includes(term)) c.final += w;
    });
  });

  return candidates
    .filter((c) => c.final > 0.05)
    .sort((a, b) => b.final - a.final)
    .slice(0, limit)
    .map((c) => c.chunk);
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

module.exports = { cors, json, rateLimit, retrieve, semanticRetrieve, fusedRetrieve, rerank, deepseek, findFood, calcNutritionFromIngredients };
