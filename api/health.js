const { cors, json } = require("./_shared");

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  return json(res, 200, {
    ok: true,
    service: "suishipai-ai-gateway",
    deepseekConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    visionConfigured: Boolean(process.env.DASHSCOPE_API_KEY || process.env.VISION_API_KEY),
    time: new Date().toISOString()
  });
};
