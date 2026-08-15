const { fusedRetrieve, retrieve } = require("../api/_shared");

const questions = [
  "你们为什么选择广州作为调查地区？",
  "你们调查了多少人？",
  "信任对付费意愿有什么影响？",
  "用户分为哪几类？",
  "Keep的评分是多少？",
  "AI了解程度有什么调节作用？"
];

(async () => {
  for (const q of questions) {
    const results = await fusedRetrieve(q, 3);
    console.log(`\nQ: ${q}`);
    results.forEach((chunk) => console.log(`  -> [${chunk.id}] ${chunk.topic}`));
  }
})().catch((error) => { console.error(error); process.exit(1); });
