// 阿里云函数计算 FC — Web 函数入口（Express）
// 复用现有 api/*.js 的 Vercel 风格 handler：(req, res) => {}
// req.body 由 express.json() 解析；res.status().json()/setHeader 与 Vercel 兼容。

const express = require("express");

const health = require("./api/health");
const researchChat = require("./api/research-chat");
const recalculateFood = require("./api/recalculate-food");
const analyzeFood = require("./api/analyze-food");

const app = express();
app.use(express.json({ limit: "1mb" }));

// FC/浏览器健康探针
app.get("/", (req, res) => res.status(200).json({ ok: true, service: "suishipai-ai-gateway" }));

const wrap = (handler) => (req, res) => {
  Promise.resolve(handler(req, res)).catch((error) => {
    console.error("handler-error", error && error.message);
    if (!res.headersSent) res.status(500).json({ error: "服务内部错误" });
  });
};

// CORS 预检：任一带 cors() 的 handler 都会在 OPTIONS 时回 204 并结束
app.options("/api/*", wrap(health));

app.get("/api/health", wrap(health));
app.post("/api/research-chat", wrap(researchChat));
app.post("/api/recalculate-food", wrap(recalculateFood));
app.post("/api/analyze-food", wrap(analyzeFood));

const port = process.env.FC_SERVER_PORT || process.env.PORT || 9000;
app.listen(port, () => console.log(`suishipai gateway listening on ${port}`));
