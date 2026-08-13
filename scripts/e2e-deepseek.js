const chat = require("../api/research-chat");
const recalculate = require("../api/recalculate-food");

function invoke(handler, body) {
  return new Promise((resolve, reject) => {
    const req = { method: "POST", headers: { origin: "https://ljtatm5-crypto.github.io" }, body };
    const res = {
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode || 200, body: payload }); },
      end() { resolve({ status: this.statusCode || 204 }); }
    };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is required");
  const answer = await invoke(chat, { message: "为什么选择广州作为调查地区？", history: [] });
  if (answer.status !== 200 || !answer.body.reply || !answer.body.reply.includes("广州")) throw new Error(`chat failed: ${JSON.stringify(answer)}`);
  console.log("CHAT_OK", answer.body.reply.slice(0, 100));

  const nutrition = await invoke(recalculate, {
    dish: "广式腊味煲仔饭",
    estimated_weight_g: 430,
    ingredients: ["米饭280g", "腊肠60g", "腊肉45g", "青菜45g"]
  });
  if (nutrition.status !== 200 || !nutrition.body.result?.nutrition?.calories_kcal) throw new Error(`nutrition failed: ${JSON.stringify(nutrition)}`);
  console.log("NUTRITION_OK", JSON.stringify(nutrition.body.result.nutrition));
})();
