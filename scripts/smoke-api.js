const http = require("http");
const health = require("../api/health");
const chat = require("../api/research-chat");
const analyze = require("../api/analyze-food");

function invoke(handler, req) {
  return new Promise((resolve, reject) => {
    const res = {
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      status(code) { this.statusCode = code; return this; },
      json(body) { resolve({ status: this.statusCode || 200, body, headers: this.headers }); },
      end() { resolve({ status: this.statusCode || 204, headers: this.headers }); }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  const origin = "https://ljtatm5-crypto.github.io";
  const checks = [
    await invoke(health, { method: "GET", headers: { origin } }),
    await invoke(chat, { method: "POST", headers: { origin }, body: { message: "为什么选择广州？" } }),
    await invoke(analyze, { method: "POST", headers: { origin }, body: {} })
  ];
  if (checks[0].status !== 200 || checks[1].status !== 503 || checks[2].status !== 501) throw new Error(JSON.stringify(checks));
  console.log("API smoke tests passed", checks.map((item) => item.status).join(","));
})();
