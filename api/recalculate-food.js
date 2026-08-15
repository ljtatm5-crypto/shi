const { cors, json, rateLimit, deepseek, calcNutritionFromIngredients } = require("./_shared");

function parseIngredients(raw) {
  if (Array.isArray(raw)) {
    return raw.slice(0, 12).map((item) => {
      if (typeof item === "string") {
        const m = String(item).match(/^(.+?)(\d+(?:\.\d+)?)\s*g?$/);
        return m ? { name: m[1].trim(), weight_g: Number(m[2]) } : { name: String(item).trim(), weight_g: 0 };
      }
      return { name: String(item.name || "").trim(), weight_g: Number(item.weight_g) || 0 };
    }).filter((item) => item.name);
  }
  if (typeof raw === "string") {
    return raw.split(/[、，,;；\n]/).map((part) => {
      const m = part.trim().match(/^(.+?)(\d+(?:\.\d+)?)\s*g?$/);
      return m ? { name: m[1].trim(), weight_g: Number(m[2]) } : { name: part.trim(), weight_g: 0 };
    }).filter((item) => item.name);
  }
  return [];
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (rateLimit(req, res, 12)) return;
  const meal = req.body || {};
  if (!meal.dish || !Number.isFinite(Number(meal.estimated_weight_g))) return json(res, 400, { error: "缺少菜品或份量信息" });
  const ingredients = parseIngredients(meal.ingredients);
  // 1. 本地食物库确定性计算
  const { nutrition, matched } = calcNutritionFromIngredients(ingredients);
  const unmatched = ingredients.filter((item) => !matched.some((m) => m.name === item.name)).map((item) => item.name);
  const baseResult = {
    nutrition,
    matched,
    unmatched,
    summary: matched.length
      ? `营养结果按本地食物数据表计算：${matched.map((m) => `${m.name}（${m.database_food}）`).join("、")}。${unmatched.length ? `另有 ${unmatched.length} 项食材未匹配食物库：${unmatched.join("、")}。` : ""}`
      : "本次食材未能匹配本地食物库，营养结果均为0，请检查食材名称。",
    suggestion: "",
    disclaimer: "以上为食物数据库的确定性计算值，份量为用户确认值，实际营养会因食材与烹饪方式而变化，不构成医疗建议。"
  };
  // 2. DeepSeek 只负责把结果解释成人话（不负责算数）
  try {
    const content = await deepseek([
      { role: "system", content: "你是小穗膳食助手。用户已通过本地食物数据库完成确定性营养计算，你的任务只是把结果解释成人话：点评本餐特点、给出下一餐搭配建议，并附一句免责声明。必须输出json，字段为 suggestion、summary、disclaimer。不得重新计算或修改任何营养数字。" },
      { role: "user", content: `菜品：${meal.dish}，确认总重量 ${meal.estimated_weight_g} g。食材：${ingredients.map((i) => `${i.name}${i.weight_g}g`).join("、") || "未填"}。确定性计算结果：${JSON.stringify(nutrition)}。未匹配食物库的食材：${unmatched.join("、") || "无"}。请给出一段80字以内的点评+下一餐建议（suggestion），一段一句话总结（summary），和免责声明（disclaimer）。` }
    ], { json: true, max_tokens: 600 });
    const ai = JSON.parse(content);
    return json(res, 200, {
      success: true,
      result: {
        ...baseResult,
        summary: ai.summary ? `${baseResult.summary}${ai.summary}` : baseResult.summary,
        suggestion: ai.suggestion || "",
        disclaimer: ai.disclaimer || baseResult.disclaimer
      }
    });
  } catch (error) {
    console.error("recalculate-ai-summary-fallback", error.message);
    return json(res, 200, { success: true, result: baseResult });
  }
};
