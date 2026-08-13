const { cors, json, rateLimit, deepseek } = require("./_shared");

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (rateLimit(req, res, 12)) return;
  const meal = req.body || {};
  if (!meal.dish || !Number.isFinite(Number(meal.estimated_weight_g))) return json(res, 400, { error: "缺少菜品或份量信息" });
  try {
    const content = await deepseek([
      { role: "system", content: "你是小穗膳食助手。根据用户确认的菜品、食材和重量做一般性营养估算。必须输出json，数字为合理估算，不得声称精确测量。字段必须包含nutrition(calories_kcal,protein_g,fat_g,carbohydrate_g,fiber_g,sodium_mg)、summary、suggestion、disclaimer。" },
      { role: "user", content: `请以json估算：${JSON.stringify({ dish: meal.dish, estimated_weight_g: Number(meal.estimated_weight_g), ingredients: meal.ingredients || [] })}` }
    ], { json: true, max_tokens: 600 });
    return json(res, 200, { success: true, result: JSON.parse(content) });
  } catch (error) {
    console.error("recalculate-food", error.message);
    return json(res, error instanceof SyntaxError ? 502 : 503, { error: "营养估算服务暂时不可用" });
  }
};
