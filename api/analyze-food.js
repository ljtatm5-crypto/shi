const { cors, json, rateLimit } = require("./_shared");
const nutritionDb = require("../data/nutrition-db.json");

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function stripFence(value) {
  return String(value || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function cleanVisionResult(value) {
  const ingredients = Array.isArray(value.ingredients) ? value.ingredients.slice(0, 12).map((item) => ({
    name: String(item.name || "未知食材").trim().slice(0, 40),
    weight_g: Math.max(1, Math.min(2000, Math.round(Number(item.weight_g) || 0)))
  })).filter((item) => item.name && item.weight_g) : [];
  return {
    dish: String(value.dish || "待确认餐食").trim().slice(0, 60),
    confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)),
    ingredients
  };
}

function findFood(name) {
  const input = String(name || "").replace(/[（）()\s]/g, "");
  return Object.entries(nutritionDb).find(([food, item]) => [food].concat(item.aliases || []).some((alias) => input.includes(alias) || alias.includes(input)));
}

function calculateNutrition(ingredients) {
  const total = { calories_kcal: 0, protein_g: 0, fat_g: 0, carbohydrate_g: 0, sodium_mg: 0 };
  const matched = [];
  ingredients.forEach((ingredient) => {
    const found = findFood(ingredient.name);
    if (!found) return;
    const [food, item] = found;
    const factor = ingredient.weight_g / 100;
    Object.keys(total).forEach((key) => { total[key] += Number(item[key] || 0) * factor; });
    matched.push({ name: ingredient.name, database_food: food, weight_g: ingredient.weight_g });
  });
  Object.keys(total).forEach((key) => { total[key] = Math.round(total[key] * 10) / 10; });
  return { nutrition: total, matched };
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (rateLimit(req, res, 8)) return;
  const imageData = String(req.body?.image_data || "");
  const match = imageData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return json(res, 400, { error: "请上传 JPG、PNG 或 WebP 餐食图片" });
  if (Buffer.byteLength(match[2], "base64") > MAX_IMAGE_BYTES) return json(res, 413, { error: "图片不能超过 8MB" });
  if (!process.env.DASHSCOPE_API_KEY || !process.env.DASHSCOPE_COMPATIBLE_URL) {
    return json(res, 503, { error: "视觉识别服务尚未配置", code: "VISION_MODEL_NOT_CONFIGURED" });
  }

  const prompt = "识别这张餐食照片中的主要菜品和可见食材。只返回合法 JSON，不要 Markdown 或解释。格式：{\"dish\":\"菜品名称\",\"confidence\":0到1的小数,\"ingredients\":[{\"name\":\"食材名称\",\"weight_g\":整数}]}。无法确认时使用未知食材，不要虚构不可见食材。重量只作视觉估算，合计应接近一人份。";
  try {
    const response = await fetch(`${process.env.DASHSCOPE_COMPATIBLE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}` },
      body: JSON.stringify({
        model: process.env.DASHSCOPE_MODEL || "qwen3-vl-plus",
        messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: imageData } }, { type: "text", text: prompt }] }],
        stream: false,
        temperature: 0.1,
        max_tokens: 500
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || `VISION_${response.status}`);
    const raw = data.choices?.[0]?.message?.content;
    let identified;
    try { identified = cleanVisionResult(JSON.parse(stripFence(raw))); } catch { throw new Error("VISION_RESULT_INVALID"); }
    if (!identified.ingredients.length) throw new Error("VISION_NO_FOOD");
    const calculation = calculateNutrition(identified.ingredients);
    return json(res, 200, {
      success: true,
      result: {
        ...identified,
        estimated_weight_g: identified.ingredients.reduce((sum, item) => sum + item.weight_g, 0),
        ...calculation,
        summary: `已识别为${identified.dish}，请在下一步确认菜品与份量。营养结果按本地食物数据表和确认份量估算。`,
        usage: data.usage ? { total_tokens: data.usage.total_tokens } : undefined
      }
    });
  } catch (error) {
    console.error("vision-error", error && error.message);
    return json(res, 502, { error: "识餐服务暂时不可用，请稍后重试或手动填写菜品与份量。", code: "VISION_REQUEST_FAILED" });
  }
};
