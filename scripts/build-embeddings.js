// 批量生成知识库分片的 embedding 并写回 data/research_chunks.json。
// 用法（配置好 EMBEDDING_API_URL / EMBEDDING_API_KEY / EMBEDDING_MODEL 后）：
//   node scripts/build-embeddings.js
"use strict";

const fs = require("fs");
const path = require("path");

const CHUNKS_FILE = path.join(__dirname, "..", "data", "research_chunks.json");

async function embed(input) {
  const url = process.env.EMBEDDING_API_URL;
  const key = process.env.EMBEDDING_API_KEY;
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
  if (!url || !key) throw new Error("请先配置 EMBEDDING_API_URL / EMBEDDING_API_KEY");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, input })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(data.data)) {
    throw new Error(`嵌入失败：${response.status} ${data.error?.message || ""}`);
  }
  return data.data.map((item) => item.embedding);
}

(async () => {
  const chunks = JSON.parse(fs.readFileSync(CHUNKS_FILE, "utf8"));
  const pending = chunks.filter((c) => !Array.isArray(c.embedding));
  if (!pending.length) {
    console.log("所有分片均已有 embedding，无需处理。");
    return;
  }
  console.log(`待嵌入分片：${pending.length}`);
  for (let i = 0; i < pending.length; i += 20) {
    const batch = pending.slice(i, i + 20);
    const vectors = await embed(batch.map((c) => c.text));
    vectors.forEach((vector, j) => { batch[j].embedding = vector; });
    console.log(`已完成 ${Math.min(i + 20, pending.length)}/${pending.length}`);
  }
  fs.writeFileSync(CHUNKS_FILE, JSON.stringify(chunks, null, 2), "utf8");
  console.log("已写回 data/research_chunks.json");
})();
