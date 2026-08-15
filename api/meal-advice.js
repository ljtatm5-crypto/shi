const { cors, json, rateLimit, deepseek } = require("./_shared");

// 组装发给模型的今日膳食摘要
function buildDayContext(day) {
  const meals = Array.isArray(day.meals) ? day.meals : [];
  const total = { calories_kcal: 0, protein_g: 0, fat_g: 0, carbohydrate_g: 0, sodium_mg: 0 };
  const lines = [];
  meals.forEach((meal, i) => {
    const n = meal.nutrition || {};
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    total.calories_kcal += num(n.calories_kcal);
    total.protein_g += num(n.protein_g);
    total.fat_g += num(n.fat_g);
    total.carbohydrate_g += num(n.carbohydrate_g);
    total.sodium_mg += num(n.sodium_mg);
    lines.push(`第${i + 1}餐：${meal.dish || "未命名"}（${meal.weight_g ? `${meal.weight_g} g，` : ""}热量 ${num(n.calories_kcal)} kcal，蛋白质 ${num(n.protein_g)} g，脂肪 ${num(n.fat_g)} g，碳水 ${num(n.carbohydrate_g)} g，钠 ${num(n.sodium_mg)} mg）`);
  });
  const target = Number(day.target_kcal) || 1800;
  const remain = Math.max(0, Math.round(target - total.calories_kcal));
  return { lines, total, target, remain };
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (rateLimit(req, res, 12)) return;
  const day = req.body?.day || {};
  const question = String(req.body?.question || "").trim().slice(0, 600);
  if (!Array.isArray(day.meals) || !day.meals.length) {
    return json(res, 400, { error: "还没有今日餐食记录，请先在「产品体验」页拍照识餐并保存本餐。", code: "NO_MEALS" });
  }
  const ctx = buildDayContext(day);
  try {
    const content = await deepseek([
      { role: "system", content: "你是小穗膳食助手。根据用户今日已记录的餐食（确定性计算数据）回答膳食问题。规则：1）给出的营养数字必须来自输入数据，不得自己编造或重新估算热量；2）结合用户目标（如减脂、增肌）给出可执行的下一餐建议，优先推荐粤式家常餐食；3）回答简洁，200字以内；4）涉及疾病、过敏、孕期时只给一般性信息并建议咨询医生或营养师；5）数据不足时明确说明，不要假装知道用户没记录的内容。" },
      { role: "user", content: `用户健康目标：${day.goal || "未设置（按均衡饮食处理）"}\n今日已记录：\n${ctx.lines.join("\n")}\n今日累计热量 ${Math.round(ctx.total.calories_kcal)} kcal，目标 ${ctx.target} kcal，剩余约 ${ctx.remain} kcal。\n\n用户问题：${question || "今天吃得怎么样？接下来怎么安排？"}` }
    ], { max_tokens: 600 });
    return json(res, 200, { success: true, reply: content, day: { total: ctx.total, target: ctx.target, remain: ctx.remain } });
  } catch (error) {
    console.error("meal-advice", error.message);
    return json(res, 503, { error: "小穗暂时无法连接AI服务，请稍后再试" });
  }
};
