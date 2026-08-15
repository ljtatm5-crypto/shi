# 小穗 RAG 全流程说明

> 本文档说明智能助手"小穗"的完整 RAG（检索增强生成）流程。代码位置：`api/research-chat.js`（问答接口）、`api/_shared.js`（检索与模型工具）、`data/research_chunks.json`（知识库）。

## 一、准备部分（提问前）

在用户提问之前，RAG 需要完成三件准备工作：

### 1.1 知识库来源

知识库内容来自项目两份实证研究报告，原文存于 `data/raw/`：

| 文件 | 来源 | 内容 |
|------|------|------|
| `zhengdabei-report.txt` | 正大杯报告 | 广州市 AI 膳食管理应用市场前景与用户付费意愿调查 |
| `tongjian-paper.txt` | 统建赛作品 | AI 膳食管理应用消费行为研究（SEM + 机器学习） |

### 1.2 分片（Chunking）

- 手工将报告内容按主题整理为 **30 个分片**，存于 `data/research_chunks.json`。
- 每个分片包含字段：
  - `id`：唯一标识（如 `research-01`）
  - `topic`：主题名（如"调查设计与样本"）
  - `keywords`：关键词数组，供关键词召回使用
  - `text`：正文（平均约 175 字）
  - `source`：来源标注（正大杯报告 / 统建赛作品 / 项目自述），保证"每个结论有出处"
- 若将来需要从新报告自动生成候选分片，可运行 `node scripts/build-chunks.js`。

### 1.3 索引（Embedding）

- 为每个分片生成向量嵌入（embedding）并存入 `chunks.embedding` 字段。
- 批量生成脚本：`node scripts/build-embeddings.js`（需要配置 `EMBEDDING_API_URL` / `EMBEDDING_API_KEY` / `EMBEDDING_MODEL`，推荐 `text-embedding-3-small`）。
- 该步骤**可选**：未配置时系统自动使用关键词召回（见 2.2）。

## 二、分片索引与召回（提问时）

用户提问后，`POST /api/research-chat` 执行两级召回策略，代码在 `_shared.js`：

### 2.1 语义召回（优先，需 embedding）

```
用户问题 → 调用 embedding API 生成问题向量
        → 与 30 个分片向量计算余弦相似度
        → 取相似度最高的 Top 10 分片作为候选
```

### 2.2 关键词召回（回退，无需任何外部服务）

```
用户问题 → 分词（中文二字词 / 英文数字 token）
        → 与每个分片的 topic + keywords + text 匹配打分
           · 正文命中：长词 +3 分，短词 +1 分
           · 关键词命中：+2 分
           · 主题名精确命中：+4 分
        → 取得分最高的 Top 4 分片
```

**执行顺序**：先尝试语义召回 Top 10，失败（未配置 embedding 或调用出错）自动回退关键词召回 Top 4。当前线上环境未配置 embedding 密钥，实际运行的是关键词召回。

### 2.3 重排（Rerank）

```
候选 Top 10 → 调用 RERANK API（如 bge-reranker 类模型）
           → 模型对 query 与每个候选文档打分
           → 取重排后的 Top 4 作为最终上下文
```

未配置 `RERANK_API_URL` 时，直接截取候选前 4 个。

## 三、生成（DeepSeek）

`_shared.js` 的 `deepseek()` 调用 DeepSeek Chat Completions：

```
POST https://api.deepseek.com/chat/completions
model: deepseek-v4-flash（可用 DEEPSEEK_MODEL 环境变量覆盖）
temperature: 0.2
max_tokens: 800
```

### 3.1 提示词结构

`research-chat.js` 的 `SYSTEM` 指令要求小穗：

1. **只根据提供的项目知识回答**——不能编造数据；
2. 把论文语言转换成普通用户容易理解的中文；
3. 不提及章节、页码、分片、Embedding、RAG 等内部实现细节；
4. 材料不足时明确说"目前项目材料不足以支持这个结论"；
5. 涉及医疗、疾病、过敏或用药时只给一般信息并建议咨询专业人员；
6. 回答自然、专业、简洁，通常不超过 300 字。

发给模型的用户消息格式：

```
项目知识：
[资料1] <分片1正文>
[资料2] <分片2正文>
[资料3] <分片3正文>
[资料4] <分片4正文>

用户问题：<用户原始问题>
```

### 3.2 多轮对话

- 前端只传最近 6 条对话历史（`js/api.js` 中 `history.slice(-6)`）。
- 每条历史消息截断到 600 字，角色白名单过滤（只保留 user/assistant）。
- 历史消息与"项目知识 + 当前问题"拼接后一并发送。

## 四、完整流程图

```
准备部分（提问前）
  ├─ data/raw/ 两份报告原文
  ├─ 手工整理 → research_chunks.json（30 分片）
  └─ （可选）build-embeddings.js → 每片生成向量

用户提问
  ↓
召回（_shared.js）
  ├─ 语义召回 Top 10（需 embedding，未配置则跳过）
  └─ 关键词召回 Top 4（回退方案）
  ↓
重排（_shared.js）
  └─ Rerank API 打分 → 取 Top 4（未配置则直接截取）
  ↓
生成（research-chat.js）
  ├─ SYSTEM 指令约束（只依据材料、不编造、边界声明）
  ├─ 项目知识 + 多轮历史 + 用户问题 → DeepSeek
  └─ 返回 { reply, sources }
  ↓
前端（js/main.js）
  └─ mdToHtml 渲染 markdown 回复
```

## 五、环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | ✅ | DeepSeek 密钥，缺了问答接口返回 503 |
| `DEEPSEEK_MODEL` | 否 | 默认 `deepseek-v4-flash` |
| `EMBEDDING_API_URL` / `EMBEDDING_API_KEY` / `EMBEDDING_MODEL` | 否 | 配置后启用语义召回 |
| `RERANK_API_URL` / `RERANK_API_KEY` / `RERANK_MODEL` | 否 | 配置后启用重排 |

## 六、如何训练小穗（更新知识）

1. 把新报告/新材料的纯文本放入 `data/raw/`；
2. 在 `research_chunks.json` 中新增或修订分片（保持 id 唯一、带 source 字段）；
3. 若启用语义召回，重新运行 `node scripts/build-embeddings.js` 更新向量；
4. 提交并重新部署后端（阿里云 FC / Vercel），前端无需改动。
