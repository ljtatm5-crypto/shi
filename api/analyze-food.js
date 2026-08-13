const { cors, json, rateLimit } = require("./_shared");

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (rateLimit(req, res, 8)) return;
  return json(res, 501, {
    error: "视觉模型尚未配置。DeepSeek当前文本接口不接收餐食图片，请先选择示例餐或人工填写菜品与份量。",
    code: "VISION_MODEL_NOT_CONFIGURED"
  });
};
