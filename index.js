// 阿里云 FC 3.0 Node.js 20 标准运行时入口。
// 将 HTTP 触发器的 event 转为现有 api/*.js 所需的 req/res 形态，避免 custom runtime 的端口监听依赖。
"use strict";

const health = require("./api/health");
const chat = require("./api/chat");
const researchChat = require("./api/research-chat");
const recalculateFood = require("./api/recalculate-food");
const analyzeFood = require("./api/analyze-food");
const mealAdvice = require("./api/meal-advice");

const routes = {
  "GET /": health,
  "GET /api/health": health,
  "POST /api/chat": chat,
  "POST /api/research-chat": researchChat,
  "POST /api/recalculate-food": recalculateFood,
  "POST /api/analyze-food": analyzeFood,
  "POST /api/meal-advice": mealAdvice
};

function responseBridge(resolve) {
  const state = { statusCode: 200, headers: {}, body: "", headersSent: false };
  const finish = (body) => {
    if (state.headersSent) return;
    state.headersSent = true;
    if (body !== undefined) state.body = body;
    resolve({ statusCode: state.statusCode, headers: state.headers, body: state.body });
  };
  return {
    get headersSent() { return state.headersSent; },
    setHeader(name, value) { state.headers[name] = String(value); },
    status(code) { state.statusCode = code; return this; },
    json(value) {
      if (!state.headers["Content-Type"]) state.headers["Content-Type"] = "application/json; charset=utf-8";
      finish(JSON.stringify(value));
    },
    end(value) { finish(value || ""); }
  };
}

function parseEvent(event) {
  const rawEvent = Buffer.isBuffer(event) ? event.toString("utf8") : event;
  const payload = typeof rawEvent === "string" ? JSON.parse(rawEvent || "{}") : (rawEvent || {});
  const headers = Object.fromEntries(Object.entries(payload.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
  let body = payload.body;
  if (payload.isBase64Encoded && body) body = Buffer.from(body, "base64").toString("utf8");
  if (typeof body === "string" && body && (headers["content-type"] || "").includes("application/json")) {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return {
    method: String(payload.requestContext?.http?.method || payload.httpMethod || "GET").toUpperCase(),
    path: payload.requestContext?.http?.path || payload.rawPath || "/",
    headers,
    body: body || {}
  };
}

exports.handler = async function handler(event) {
  const req = parseEvent(event);
  const route = req.method === "OPTIONS" ? health : routes[`${req.method} ${req.path}`];
  if (!route) {
    return { statusCode: 404, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ error: "接口不存在" }) };
  }
  return new Promise((resolve) => {
    const res = responseBridge(resolve);
    Promise.resolve(route(req, res)).catch((error) => {
      console.error("handler-error", error && error.message);
      if (!res.headersSent) res.status(500).json({ error: "服务内部错误" });
    });
  });
};
