# 穗食拍，AI来算 · Diet Management Website

面向广州市场的 AI 膳食管理解决方案介绍与产品体验网站，广州商学院挑战杯参赛作品。

## 网站架构

```
📱 AI膳食管理应用网站
├── 🏠 index.html      网站首页（主视觉 + 核心数据 + 三大问题预览）
├── 📖 about.html      膳食简介（概念 + 四大核心功能 + 生活场景）
├── 📊 industry.html   行业焦点（政策 + 市场 + 隐患）
├── 🏙️ guangzhou.html  广州发现（城市特点 + 调研 + 三大问题）
├── 💡 solution.html   解决方案（问题→建议 + 三类用户画像 + 决策树）
├── 📷 product.html    产品体验（上传→识别→修正→计算→记录）
└── 🤖 assistant.html  智能助手（营养解读 / 今日评价 / 粤式推荐 / 健康提醒）
```

## 设计规范

- **配色**：薄荷绿 `#7DD3C0` + 奶白 `#FAFAF5` + 浅灰蓝 `#E8F4F8`
- **点缀色**：活力橙 `#FF8C42` 用于行动入口，草莓红用于风险提示
- **字体**：PingFang SC / Microsoft YaHei / Helvetica Neue
- **交互动效**：
  - 首页核心数据滚动数字动画（35亿+ / 1248份 / 43.55%）
  - 全站 IntersectionObserver reveal-on-scroll
  - 解决方案页三类用户画像可切换 tab
  - 产品体验页五步流程可切换 tab
  - 智能助手页 DeepSeek 项目问答 + 本地历史记录
  - "问题→箭头→建议"箭头脉动动画

## 数据来源

- 广州市 6 个代表性行政区 **1248 份** 有效问卷
- 10 款样本应用 **1352 条** 有效公开竞品评论
- 广州市卫健委健康素养监测报告、广州数字经济发展报告、国家卫健委相关指引

## 本地预览

静态页面可直接打开；AI 接口需要 Serverless 运行环境。本地可用静态服务器预览：

```powershell
python -m http.server 5500
```

## 小穗 AI 架构

- `POST /api/research-chat`：项目知识召回 + DeepSeek 生成回答。
- `POST /api/recalculate-food`：用户确认菜品和重量后，由 DeepSeek 输出结构化营养估算。
- `POST /api/analyze-food`：视觉模型预留接口。DeepSeek V4 官方 API 当前为文本输入，不能直接分析餐食照片。
- `GET /api/health`：服务健康检查。
- `data/research_chunks.json`：知识库分片（30 片，来源为两份实证报告，见 `data/raw/`）。
- `docs/rag-pipeline.md`：RAG 全流程说明（分片 → 召回 → 重排 → 生成）。

默认使用本地关键词召回。配置 Embedding 和 Reranker 环境变量后，会自动升级为向量 Top10 召回与 Top4 重排。知识库更新与 embedding 批量生成见 `scripts/` 目录。

### Vercel 部署

1. 在 Vercel 导入本 GitHub 仓库。
2. 添加环境变量 `DEEPSEEK_API_KEY`（Secret）与 `DEEPSEEK_MODEL=deepseek-v4-flash`。
3. 部署后，将七个 HTML 的 `<head>` 中加入：

```html
<meta name="suishipai-api-base" content="https://你的项目.vercel.app">
```

4. 访问 `/api/health`，确认 `deepseekConfigured` 为 `true`。

不要把真实密钥写入 `.env.example`、HTML、前端 JavaScript 或 Git 提交。已经在聊天或其他公开位置出现的密钥应立即轮换。

## 技术栈

- 原生 HTML5 + CSS3 + Vanilla JavaScript
- 前端零依赖；后端为 Vercel Node.js Serverless Functions
- 响应式设计，兼容桌面 & 移动端

## 项目背景

基于两份实证研究报告：

1. **正大杯**：《"穗"食拍，AI来算 —— 关于广州市膳食管理应用市场前景与用户付费意愿调查报告》
2. **统建赛**：作品全文（本科生组 · TJJM20260521008382）

核心结论：AI 膳食管理行业存在 **食物识别不准、广告泛滥、功能同质化** 三大痛点，
本网站从"本土化识别 + 分层运营 + 分级付费 + 生态协同"四位一体框架出发，
展示对应的解决方案与产品体验。

---

© 2026 广州商学院挑战杯参赛团队
