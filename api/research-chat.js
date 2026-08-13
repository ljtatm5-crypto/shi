const { cors, json, rateLimit, retrieve, semanticRetrieve, rerank, deepseek } = require("./_shared");

const SYSTEM = `你是“穗食拍”项目的智能研究助手“小穗”。
只根据提供的项目知识回答，将论文语言转换成普通用户容易理解的中文。
直接回答，不提章节、页码、分片、Embedding、RAG或内部检索。
不得编造数据；材料不足时明确说“目前项目材料不足以支持这个结论”。
涉及医疗、疾病、过敏或用药时，只提供一般信息并建议咨询专业人员。
回答自然、专业、简洁，通常不超过300字。`;

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });
  if (rateLimit(req, res)) return;
  const message = String(req.body?.message || "").trim();
  if (!message || message.length > 600) return json(res, 400, { error: "请输入1至600字的问题" });
  let context;
  try {
    const candidates = await semanticRetrieve(message, 10);
    context = await rerank(message, candidates, 4);
  } catch (error) {
    console.error("retrieval-fallback", error.message);
    context = retrieve(message, 4);
  }
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [];
  const safeHistory = history.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map((item) => ({ role: item.role, content: item.content.slice(0, 600) }));
  try {
    const reply = await deepseek([
      { role: "system", content: SYSTEM },
      ...safeHistory,
      { role: "user", content: `项目知识：\n${context.map((item, i) => `[资料${i + 1}] ${item.text}`).join("\n")}\n\n用户问题：${message}` }
    ]);
    return json(res, 200, { success: true, reply, sources: context.map(({ id, topic }) => ({ id, topic })) });
  } catch (error) {
    console.error("research-chat", error.message);
    return json(res, error.message === "DEEPSEEK_API_KEY_NOT_CONFIGURED" ? 503 : 502, { error: "小穗暂时无法连接AI服务，请稍后再试" });
  }
};
