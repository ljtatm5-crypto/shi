const { cors, json, rateLimit, retrieve, fusedRetrieve, rerank, deepseek } = require("./_shared");
const healthKnowledge = require("../data/health_knowledge.json");

const SYSTEM = `你是“穗食拍”项目的智能助手“小穗”，一个身兼多种能力的单一助手。
你会根据用户问题的内容自动选择回答方式：
1）项目研究类（关于本项目网页、调查报告、论文、调研数据的问题）：只根据提供的项目知识回答，将论文语言转换成普通用户容易理解的中文；不得编造数据，材料不足时明确说“目前项目材料不足以支持这个结论”。
2）膳食记录类（关于用户今天吃了什么、营养解读、下一餐建议）：给出的营养数字必须来自输入数据，不得自己编造或重新估算热量；结合用户目标（如减脂、增肌）给出可执行的建议，优先推荐粤式家常餐食；用户没有餐食记录时，友好说明并给出一般性膳食建议。
3）一般营养健康类：优先依据提供的营养知识回答；知识库没有的内容，可基于公认的膳食指南常识回答。
统一要求：直接回答，不提章节、页码、分片、Embedding、RAG或内部检索；回答自然、专业、简洁，通常不超过300字；可用少量 emoji 和 markdown 列表；涉及疾病、药物、严重过敏、孕期、进食障碍等敏感话题时，只提供一般性信息，并明确建议咨询医生或注册营养师。`;

function bigramTokens(query) {
  const queryWords = String(query || "").toLowerCase().match(/[一-鿿]+|[a-z0-9.%-]+/g) || [];
  const tokens = [];
  queryWords.forEach((w) => { for (let i = 0; i < w.length - 1; i += 1) tokens.push(w.slice(i, i + 2)); });
  return tokens;
}

function healthRetrieve(query, limit = 3) {
  const tokens = bigramTokens(query);
  return healthKnowledge.map((chunk) => {
    const haystack = `${chunk.topic} ${chunk.keywords.join(" ")} ${chunk.text}`.toLowerCase();
    let score = 0;
    tokens.forEach((word) => {
      if (word.length < 2) return;
      if (haystack.includes(word)) score += word.length > 2 ? 3 : 1;
      chunk.keywords.forEach((keyword) => {
        if (word.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(word)) score += 2;
      });
    });
    if (chunk.topic && query.includes(chunk.topic)) score += 4;
    return { chunk, score };
  }).sort((a, b) => b.score - a.score).slice(0, limit).filter((item) => item.score > 0).map((item) => item.chunk);
}

function routeQuery(message) {
  const q = String(message || "").toLowerCase();
  const mealHits = ["今天", "今日", "早餐", "午餐", "晚餐", "夜宵", "本餐", "这餐", "我的膳食", "餐食记录", "下一餐", "晚上吃什么"];
  const researchHits = ["研究", "报告", "论文", "调查", "问卷", "样本", "调研", "项目", "穗食拍", "团队", "作品", "竞赛", "挑战杯", "为什么", "结论", "数据", "模型", "聚类", "决策树", "结构方程"];
  const mealScore = mealHits.reduce((sum, word) => sum + (q.includes(word) ? 1 : 0), 0);
  const researchScore = researchHits.reduce((sum, word) => sum + (q.includes(word) ? 1 : 0), 0);
  if (mealScore > researchScore && mealScore > 0) return "meal";
  if (researchScore >= mealScore && researchScore > 0) return "research";
  return "health";
}

async function researchMode(message, history) {
  let context;
  try {
    const candidates = await fusedRetrieve(message, 8);
    context = await rerank(message, candidates, 4);
  } catch (error) {
    console.error("retrieval-fallback", error.message);
    context = retrieve(message, 4);
  }
  const knowledgeText = context.length
    ? `项目知识：\n${context.map((item, i) => `[资料${i + 1}] ${item.text}`).join("\n")}`
    : "项目知识：本次没有检索到匹配资料。";
  const reply = await deepseek([
    { role: "system", content: SYSTEM },
    ...history,
    { role: "user", content: `${knowledgeText}\n\n用户问题：${message}` }
  ]);
  return { reply, sources: context.map(({ id, topic, source }) => ({ id, topic, source })) };
}

async function healthMode(message, history) {
  const context = healthRetrieve(message, 3);
  const knowledgeText = context.length
    ? `营养知识：\n${context.map((item, i) => `[知识${i + 1}] ${item.text}`).join("\n")}`
    : "营养知识：本次没有检索到匹配资料，请基于公认膳食常识谨慎回答。";
  const reply = await deepseek([
    { role: "system", content: SYSTEM },
    ...history,
    { role: "user", content: `${knowledgeText}\n\n用户问题：${message}` }
  ]);
  return { reply, sources: context.map(({ id, topic }) => ({ id, topic })) };
}

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

async function mealMode(message, history, day) {
  const hasMeals = Array.isArray(day.meals) && day.meals.length > 0;
  if (!hasMeals) {
    const context = healthRetrieve(message, 3);
    const knowledgeText = context.length
      ? `营养知识：\n${context.map((item, i) => `[知识${i + 1}] ${item.text}`).join("\n")}`
      : "营养知识：本次没有检索到匹配资料，请基于公认膳食常识谨慎回答。";
    const reply = await deepseek([
      { role: "system", content: SYSTEM },
      ...history,
      { role: "user", content: `${knowledgeText}\n\n说明：用户目前还没有今天的餐食记录（可在「产品体验」页拍照识餐保存）。请友好说明这一点，然后就用户问题给出一般性膳食建议。\n\n用户问题：${message}` }
    ]);
    return { reply, day: { meals: 0, target: Number(day.target_kcal) || 1800 } };
  }
  const ctx = buildDayContext(day);
  const reply = await deepseek([
    { role: "system", content: SYSTEM },
    ...history,
    { role: "user", content: `用户健康目标：${day.goal || "未设置（按均衡饮食处理）"}\n今日已记录：\n${ctx.lines.join("\n")}\n今日累计热量 ${Math.round(ctx.total.calories_kcal)} kcal，目标 ${ctx.target} kcal，剩余约 ${ctx.remain} kcal。\n\n用户问题：${message || "今天吃得怎么样？接下来怎么安排？"}` }
  ], { max_tokens: 600 });
  return { reply, day: { total: ctx.total, target: ctx.target, remain: ctx.remain } };
}

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (rateLimit(req, res)) return;
  const message = String(req.body?.message || "").trim();
  if (!message || message.length > 600) return json(res, 400, { error: "请输入1至600字的问题" });

  const rawHistory = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
  const history = rawHistory.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map((item) => ({ role: item.role, content: item.content.slice(0, 600) }));

  try {
    const mode = routeQuery(message);
    if (mode === "meal") {
      const day = req.body?.day || {};
      const data = await mealMode(message, history, day);
      return json(res, 200, { success: true, mode, ...data });
    }
    const data = mode === "research" ? await researchMode(message, history) : await healthMode(message, history);
    return json(res, 200, { success: true, mode, ...data });
  } catch (error) {
    console.error("chat-error", error.message);
    return json(res, error.message === "DEEPSEEK_API_KEY_NOT_CONFIGURED" ? 503 : 502, { error: "小穗暂时无法连接AI服务，请稍后再试" });
  }
};
