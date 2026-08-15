// 从 data/raw 报告原文构建知识库分片。
// 用法：node scripts/build-chunks.js
// 输出：data/research_chunks.json（保留既有分片的 embedding 字段，若有）
"use strict";

const fs = require("fs");
const path = require("path");

const RAW_DIR = path.join(__dirname, "..", "data", "raw");
const OUT_FILE = path.join(__dirname, "..", "data", "research_chunks.json");

function readText(file) {
  return fs.readFileSync(path.join(RAW_DIR, file), "utf8").trim();
}

// 按标题行（一二三四五六七八九十、第X部分、一、二、…）切分原始报告
function splitByHeadings(text, minLen = 200, maxLen = 900) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const sections = [];
  let current = null;
  const headingRe = /^(第[一二三四五六七八九十]+部分|([一二三四五六七八九十]+)、|（[一二三四五六七八九十]+）)/;
  for (const line of lines) {
    if (headingRe.test(line) && line.length <= 40) {
      if (current) sections.push(current);
      current = { heading: line, body: [] };
    } else if (current) {
      current.body.push(line);
    } else if (line.length > 60) {
      current = { heading: "", body: [line] };
    }
  }
  if (current) sections.push(current);

  const chunks = [];
  for (const sec of sections) {
    let text = sec.body.join("").replace(/\s+/g, " ");
    if (!text || text.length < minLen) continue;
    while (text.length > maxLen) {
      const cut = text.lastIndexOf("。", maxLen);
      const at = cut > minLen ? cut + 1 : maxLen;
      chunks.push(text.slice(0, at).trim());
      text = text.slice(at).trim();
    }
    if (text) chunks.push(text);
  }
  return chunks;
}

function build() {
  const zhengdabei = readText("zhengdabei-report.txt");
  const tongjian = readText("tongjian-paper.txt");
  const all = new Set();
  splitByHeadings(zhengdabei).forEach((t) => all.add(t));
  splitByHeadings(tongjian).forEach((t) => all.add(t));
  console.log(`候选分片数：${all.size}`);
  console.log("（当前手工整理版 29 分片为最终知识库，本脚本用于将来从新报告重新生成候选）");
}

if (require.main === module) {
  build();
}

module.exports = { splitByHeadings };
