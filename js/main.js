/* ==============================================
   穗食拍，AI来算 —— 交互脚本
   ============================================== */

// -------- 滚动数字动画 --------
function animateNumber(el, target, duration = 1600, suffix = "") {
  const isFloat = String(target).includes(".");
  const startTime = performance.now();
  const startVal = 0;
  function frame(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    const val = startVal + (target - startVal) * ease;
    el.textContent = (isFloat ? val.toFixed(2) : Math.round(val).toLocaleString()) + suffix;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// -------- Reveal on scroll --------
function initReveal() {
  const items = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        // 数字动画
        e.target.querySelectorAll("[data-num]").forEach(n => {
          if (!n.dataset.done) {
            n.dataset.done = "1";
            animateNumber(n, parseFloat(n.dataset.num), 1600, n.dataset.suffix || "");
          }
        });
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach(i => io.observe(i));
}

// -------- Persona tabs --------
function initPersonaTabs() {
  const tabs = document.querySelectorAll(".persona-tab");
  const cards = document.querySelectorAll(".persona-card");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      cards.forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      const key = tab.dataset.persona;
      document.querySelector(`.persona-card[data-persona="${key}"]`)?.classList.add("active");
    });
  });
}

// -------- Product step flow --------
function initStepFlow() {
  const steps = document.querySelectorAll(".step");
  const panels = document.querySelectorAll(".step-panel");
  steps.forEach(s => {
    s.addEventListener("click", () => {
      steps.forEach(x => x.classList.remove("active"));
      panels.forEach(x => x.classList.remove("active"));
      s.classList.add("active");
      const key = s.dataset.step;
      document.querySelector(`.step-panel[data-step="${key}"]`)?.classList.add("active");
      if (key === "5") { updateDailySummary(); renderMealDayTable(); }
    });
  });
}

function fillNutritionCard(nutrition) {
  if (!nutrition) return;
  Object.keys(nutrition).forEach((key) => {
    const target = document.querySelector(`[data-nutrition="${key}"]`);
    if (target) target.textContent = Math.round(Number(nutrition[key]) || 0);
  });
  updateDailySummary();
}

function updateDailySummary() {
  const panel = document.querySelector('.step-panel[data-step="5"]');
  if (!panel) return;
  const target = 1800;

  // 当前餐热量（第四步营养卡片）
  const currentEl = document.querySelector('[data-nutrition="calories_kcal"]');
  const current = Math.round(Number(currentEl?.textContent) || 0);
  const currentDish = document.querySelector('#meal-correction input[name="dish"]')?.value?.trim() || "";

  // 累计当日已保存的所有餐
  const day = getMealDay();
  let saved = 0;
  (day.meals || []).forEach((m) => { saved += Math.round(Number(m.nutrition?.calories_kcal) || 0); });

  // 若当前餐尚未保存进当日记录（识别后预览阶段），把当前餐也计入累计
  const lastMeal = day.meals && day.meals.length ? day.meals[day.meals.length - 1] : null;
  const alreadySaved = !!(lastMeal && currentDish && lastMeal.dish === currentDish);
  const intake = (current > 0 && !alreadySaved) ? saved + current : saved;
  const percent = Math.max(0, Math.min(999, Math.round((intake / target) * 100)));

  let box = panel.querySelector(".daily-summary");
  if (!box) {
    box = panel.querySelector(".step-visual > div > div") || panel.querySelector(".step-visual > div");
    if (box) box.classList.add("daily-summary");
  }
  if (!box) return;

  const setByAttr = (key, value) => {
    const el = box.querySelector(`[data-daily="${key}"]`);
    if (el) el.textContent = value;
  };
  setByAttr("intake", intake);
  setByAttr("target", target);
  setByAttr("percent", percent);
  setByAttr("current", current);

  if (!box.querySelector('[data-daily="intake"]')) {
    box.querySelectorAll("span").forEach((el) => {
      const txt = el.textContent.trim();
      if (/\d+\s*\/\s*\d+\s*kcal/.test(txt)) el.textContent = `${intake} / ${target} kcal`;
    });
    box.querySelectorAll("div").forEach((el) => {
      if (el.children.length === 0 && /^\s*\d+%\s*$/.test(el.textContent)) el.textContent = `${percent}%`;
    });
  }
}

// -------- 今日餐食记录（localStorage，比赛演示版） --------
const MEAL_DAY_KEY = "suishipai:meal-day";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMealDay() {
  let day = null;
  try { day = JSON.parse(localStorage.getItem(MEAL_DAY_KEY) || "null"); } catch (e) { day = null; }
  if (!day || day.date !== todayKey()) return { date: todayKey(), meals: [], goal: "", target_kcal: 1800 };
  return day;
}

function saveMealDay(day) {
  try { localStorage.setItem(MEAL_DAY_KEY, JSON.stringify(day)); } catch (e) {}
}

function collectCurrentMeal() {
  const dish = document.querySelector('#meal-correction input[name="dish"]')?.value?.trim();
  const weight = document.querySelector('#meal-correction input[name="weight"]')?.value?.trim();
  const ingredients = document.querySelector('#meal-correction textarea[name="ingredients"]')?.value?.trim();
  const nutrition = {};
  document.querySelectorAll("[data-nutrition]").forEach((el) => {
    const key = el.getAttribute("data-nutrition");
    if (key && !(key in nutrition)) nutrition[key] = Number(el.textContent.replace(/[^\d.]/g, "")) || 0;
  });
  return { dish, weight_g: Number(weight) || 0, ingredients, nutrition };
}

function saveCurrentMealToDay() {
  const meal = collectCurrentMeal();
  if (!meal.dish) return false;
  const day = getMealDay();
  day.meals.push(meal);
  saveMealDay(day);
  return true;
}

function upsertCurrentMealToDay() {
  const meal = collectCurrentMeal();
  if (!meal.dish) return false;
  const day = getMealDay();
  if (day.meals.length && day.meals[day.meals.length - 1].dish === meal.dish) {
    day.meals[day.meals.length - 1] = meal;
  } else {
    day.meals.push(meal);
  }
  saveMealDay(day);
  return true;
}

function renderRecognizedList(result) {
  const container = document.querySelector(".recognized-list");
  if (!container) return;
  const confidence = Math.round((result.confidence || 0) * 100);
  const confColor = confidence >= 70 ? "var(--green)" : "var(--warning)";
  const items = Array.isArray(result.ingredients) ? result.ingredients : [];
  const rowStyle = "background:#f0f9f4;border:1px solid rgba(24,122,102,.20);padding:14px 16px;border-radius:12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap";
  const itemStyle = "background:#f0f9f4;border:1px solid rgba(24,122,102,.14);padding:10px 14px;border-radius:10px;margin-bottom:8px;font-size:14px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap";
  const rows = [
    `<div style="${rowStyle}"><b style="color:${confColor};min-width:0;flex:1;overflow-wrap:anywhere">${confidence >= 70 ? "✓" : "?"} ${escapeHtml(result.dish || "待确认菜品")}</b><span style="color:#3a5a4e;font-size:13px;white-space:nowrap">置信度 ${confidence}%</span></div>`,
  ];
  items.forEach((item) => {
    rows.push(`<div style="${itemStyle}"><span style="color:#33544a;min-width:0;flex:1;overflow-wrap:anywhere">${escapeHtml(item.name)}</span><span style="color:#3a5a4e;white-space:nowrap">约 ${item.weight_g} g</span></div>`);
  });
  container.innerHTML = rows.join("");
}

function escapeHtml(text) {
  const span = document.createElement("span");
  span.textContent = String(text == null ? "" : text);
  return span.innerHTML;
}

function fillMealForm(result) {
  const dishInput = document.querySelector('#meal-correction input[name="dish"]');
  const weightInput = document.querySelector('#meal-correction input[name="weight"]');
  const ingredientsInput = document.querySelector('#meal-correction textarea[name="ingredients"]');
  if (dishInput && result.dish) dishInput.value = result.dish;
  if (weightInput && Number.isFinite(result.estimated_weight_g)) weightInput.value = result.estimated_weight_g;
  if (ingredientsInput && Array.isArray(result.ingredients)) {
    ingredientsInput.value = result.ingredients.map((item) => `${item.name}${item.weight_g}g`).join("、");
  }
}

function initSendMealToAssistant() {
  const btn = document.querySelector(".meal-send-to-assistant");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const meal = collectCurrentMeal();
    if (!meal.dish) { window.alert("请先在第三步确认菜品，或上传餐食完成识别。"); return; }
    upsertCurrentMealToDay();
    try { sessionStorage.setItem("suishipai:pending-meal", JSON.stringify({ handoff: true, dish: meal.dish })); } catch (e) {}
    window.location.href = "assistant.html";
  });
}

function initExportMealReport() {
  const btn = document.querySelector(".meal-export-report");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const day = getMealDay();
    if (!day.meals || !day.meals.length) { window.alert("今日还没有保存的餐食记录，请先在第三步确认并保存本餐。"); return; }
    const total = { calories_kcal: 0, protein_g: 0, fat_g: 0, carbohydrate_g: 0, sodium_mg: 0 };
    const keys = ["calories_kcal", "protein_g", "fat_g", "carbohydrate_g", "sodium_mg"];
    day.meals.forEach((m) => {
      keys.forEach((k) => { total[k] += Number(m.nutrition?.[k]) || 0; });
    });
    const lines = [];
    lines.push("穗食拍 AI 膳食档案");
    lines.push("日期：" + day.date);
    lines.push("目标热量：1800 kcal");
    lines.push("");
    lines.push("—— 今日餐食明细 ——");
    day.meals.forEach((m, i) => {
      lines.push(`${i + 1}. ${m.dish}（${m.weight_g || 0} g）`);
      if (m.ingredients) lines.push(`   食材：${m.ingredients}`);
      if (m.nutrition) lines.push(`   营养：热量 ${m.nutrition.calories_kcal || 0} kcal · 蛋白 ${m.nutrition.protein_g || 0} g · 脂肪 ${m.nutrition.fat_g || 0} g · 碳水 ${m.nutrition.carbohydrate_g || 0} g · 钠 ${m.nutrition.sodium_mg || 0} mg`);
    });
    lines.push("");
    lines.push("—— 今日累计 ——");
    lines.push(`热量 ${Math.round(total.calories_kcal)} / 1800 kcal（${Math.round((total.calories_kcal / 1800) * 100)}%）`);
    lines.push(`蛋白质 ${Math.round(total.protein_g)} g · 脂肪 ${Math.round(total.fat_g)} g · 碳水 ${Math.round(total.carbohydrate_g)} g · 钠 ${Math.round(total.sodium_mg)} mg`);
    lines.push("");
    lines.push("（本档案由浏览器本地记录生成，营养数值为估算值，不构成医疗建议。）");

    const text = lines.join("\n");
    const blob = new Blob(["﻿" + text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `穗食拍膳食档案_${day.date}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}

// -------- 今日餐食存档表格（可编辑、可删除） --------
const MEAL_ROW_FIELDS = [
  { key: "dish", label: "餐食名称", type: "text" },
  { key: "weight_g", label: "重量(g)", type: "number" },
  { key: "calories_kcal", label: "热量(kcal)", type: "number" },
  { key: "protein_g", label: "蛋白(g)", type: "number" },
  { key: "fat_g", label: "脂肪(g)", type: "number" },
  { key: "carbohydrate_g", label: "碳水(g)", type: "number" },
  { key: "sodium_mg", label: "钠(mg)", type: "number" }
];

function renderMealDayTable() {
  const container = document.querySelector(".meal-day-list");
  if (!container) return;
  const day = getMealDay();
  const meals = Array.isArray(day.meals) ? day.meals : [];

  if (!meals.length) {
    container.innerHTML = `<div style="font-size:13px;color:var(--gray-500);text-align:center;padding:14px;border:1px dashed var(--gray-300);border-radius:10px">今日还没有保存的餐食，去第三步确认菜品后会自动计入。</div>`;
    return;
  }

  const rows = meals.map((m, i) => {
    const n = m.nutrition || {};
    const cells = MEAL_ROW_FIELDS.map((f) => {
      let val = "";
      if (f.key === "dish") val = m.dish || "";
      else if (f.key === "weight_g") val = m.weight_g || "";
      else val = n[f.key] != null && n[f.key] !== "" ? n[f.key] : "";
      return `<td><input type="${f.type}" data-row="${i}" data-field="${f.key}" value="${escapeHtml(String(val))}" ${f.key === "dish" ? `placeholder="餐食名称"` : `style="width:76px"`}></td>`;
    }).join("");
    return `<tr>${cells}<td><button type="button" class="meal-del" data-row="${i}" style="background:#fff0f0;color:#c0392b;border:1px solid #f5c6c6;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px">删除</button></td></tr>`;
  }).join("");

  container.innerHTML = `
    <div style="font-size:14px;font-weight:700;color:var(--green);margin:0 0 8px">今日餐食存档（可直接修改）</div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:13px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:var(--shadow-sm)">
        <thead>
          <tr style="background:#eef7f2;color:#33544a;text-align:left">
            ${MEAL_ROW_FIELDS.map((f) => `<th style="padding:8px 6px;white-space:nowrap">${f.label}</th>`).join("")}
            <th style="padding:8px 6px"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p style="font-size:12px;color:var(--gray-500);margin-top:8px">修改后会自动保存到浏览器本地并刷新今日累计。</p>`;

  container.querySelectorAll(".meal-del").forEach((btn) => {
    btn.addEventListener("click", () => deleteMealByIndex(Number(btn.dataset.row)));
  });
  container.querySelectorAll("input[data-field]").forEach((input) => {
    input.addEventListener("change", () => commitMealEdit(input));
  });
}

function commitMealEdit(input) {
  const idx = Number(input.dataset.row);
  const field = input.dataset.field;
  const day = getMealDay();
  if (!day.meals[idx]) return;
  const raw = input.value.trim();
  if (field === "dish") {
    if (!raw) { input.value = day.meals[idx].dish || ""; return; }
    day.meals[idx].dish = raw;
  } else if (field === "weight_g") {
    const num = Number(raw);
    day.meals[idx].weight_g = Number.isFinite(num) ? num : 0;
  } else {
    const num = Number(raw);
    if (Number.isFinite(num)) { day.meals[idx].nutrition = day.meals[idx].nutrition || {}; day.meals[idx].nutrition[field] = num; }
    else { input.value = ""; return; }
  }
  saveMealDay(day);
  updateDailySummary();
  renderMealDayTable();
}

function deleteMealByIndex(idx) {
  const day = getMealDay();
  if (!day.meals[idx]) return;
  day.meals.splice(idx, 1);
  saveMealDay(day);
  updateDailySummary();
  renderMealDayTable();
}

function initAssistantMealHandoff() {
  const chatBody = document.querySelector(".chat-body");
  if (!chatBody) return;
  let payload;
  try { payload = JSON.parse(sessionStorage.getItem("suishipai:pending-meal") || "null"); } catch (e) { payload = null; }
  if (!payload || !payload.handoff) return;
  sessionStorage.removeItem("suishipai:pending-meal");
  const chat = window.suishipaiChat;
  if (!chat) return;
  const day = getMealDay();
  const n = day.meals.length ? day.meals[day.meals.length - 1].nutrition || {} : {};
  const question = `我刚在「产品体验」页记录了「${payload.dish || "本餐"}」。经确认的营养约为：热量 ${n.calories_kcal ?? "?"} kcal、蛋白质 ${n.protein_g ?? "?"} g、脂肪 ${n.fat_g ?? "?"} g、碳水 ${n.carbohydrate_g ?? "?"} g、钠 ${n.sodium_mg ?? "?"} mg。请帮我解读这一餐，并给出下一餐的搭配建议。`;
  setTimeout(() => { chat.ask(question); }, 400);
}

function initMealUpload() {
  const input = document.querySelector("#meal-upload");
  const preview = document.querySelector(".upload-preview");
  const uploadBox = document.querySelector(".upload-box");
  if (!input || !preview) return;

  async function processFile(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      window.alert("请上传图片文件（JPG / PNG / HEIC / WEBP）。");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      window.alert("图片不能超过 8MB，请重新选择。");
      input.value = "";
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", () => reject(new Error("图片读取失败")));
      reader.readAsDataURL(file);
    });
    preview.src = dataUrl;
    preview.hidden = false;
    document.querySelector('.step[data-step="2"]')?.click();

    const status = document.querySelector(".meal-api-status");
    if (status) status.textContent = "AI 正在识别菜品与食材……";
    if (!window.SuishipaiAPI || typeof window.SuishipaiAPI.analyze !== "function") return;
    try {
      const response = await window.SuishipaiAPI.analyze(dataUrl);
      const result = response.result || {};
      renderRecognizedList(result);
      fillMealForm(result);
      fillNutritionCard(result.nutrition);
      const summary = document.querySelector(".nutrition-ai-summary");
      if (summary) summary.textContent = `${result.summary || "识别完成。"} 结果为 AI 估算值。`;
      if (status) status.textContent = `识别置信度 ${Math.round((result.confidence || 0) * 100)}%，请到第三步确认菜品与份量。`;
      setTimeout(() => { document.querySelector('.step[data-step="3"]')?.click(); }, 1200);
    } catch (error) {
      if (status) status.textContent = (error && error.message) || "识餐服务暂时不可用，请到第三步手动填写菜品与份量。";
    }
  }

  input.addEventListener("change", () => processFile(input.files?.[0]));

  if (uploadBox) {
    ["dragenter", "dragover"].forEach((ev) => {
      uploadBox.addEventListener(ev, (e) => {
        e.preventDefault(); e.stopPropagation();
        uploadBox.classList.add("dragover");
      });
    });
    ["dragleave", "dragend", "drop"].forEach((ev) => {
      uploadBox.addEventListener(ev, (e) => {
        e.preventDefault(); e.stopPropagation();
        uploadBox.classList.remove("dragover");
      });
    });
    uploadBox.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file) processFile(file);
    });

    document.addEventListener("dragover", (e) => e.preventDefault());
    document.addEventListener("drop", (e) => e.preventDefault());
  }
}

function initMealRecalculation() {
  const form = document.querySelector("#meal-correction");
  if (!form || !window.SuishipaiAPI) return;
  const button = form.querySelector(".meal-recalculate");
  const status = form.querySelector(".meal-api-status");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const dish = String(data.get("dish") || "").trim();
    const estimatedWeight = Number(data.get("weight"));
    const ingredients = String(data.get("ingredients") || "").split(/[、,，]/).map((name) => name.trim()).filter(Boolean);
    if (!dish || !Number.isFinite(estimatedWeight)) return;
    button.disabled = true;
    button.textContent = "正在估算";
    status.textContent = "小穗正在根据确认后的份量重新估算……";
    try {
      const response = await window.SuishipaiAPI.recalculate({ dish, estimated_weight_g: estimatedWeight, ingredients });
      const result = response.result || {};
      const nutrition = result.nutrition || {};
      Object.keys(nutrition).forEach((key) => {
        const target = document.querySelector(`[data-nutrition="${key}"]`);
        if (target) target.textContent = Math.round(Number(nutrition[key]) || 0);
      });
      updateDailySummary();
      upsertCurrentMealToDay();
      const summary = document.querySelector(".nutrition-ai-summary");
      if (summary) summary.textContent = `${result.summary || "已完成营养估算。"}${result.suggestion ? " " + result.suggestion : ""}${result.disclaimer ? " " + result.disclaimer : ""}`;
      status.textContent = "估算完成，已更新第四步营养卡片，并计入今日餐食记录。";
      document.querySelector('.step[data-step="4"]')?.click();
      setTimeout(() => { document.querySelector('.step[data-step="5"]')?.click(); }, 2500);
    } catch (error) {
      status.textContent = error.message || "营养估算服务暂时不可用，请稍后再试。";
    } finally {
      button.disabled = false;
      button.textContent = "确认并重新估算";
    }
  });
}

function initFloatingMascot() {
  if (document.body.classList.contains("home-page") || document.body.classList.contains("assistant-page")) return;
  const link = document.createElement("a");
  link.className = "floating-mascot";
  link.href = "assistant.html";
  link.setAttribute("aria-label", "咨询小穗");
  link.innerHTML = '<span>问问小穗</span><img src="images/xiaosui-assistant.png" alt="">';
  document.body.appendChild(link);
}

// -------- Assistant chat --------
function appendMsg(role, avatar, html) {
  const body = document.querySelector(".chat-body");
  if (!body) return;
  const msg = document.createElement("div");
  msg.className = "msg " + role;
  const avatarMarkup = role === "bot"
    ? '<div class="msg-avatar mascot-avatar"><img src="images/xiaosui-assistant.old.png" alt="小穗"></div>'
    : `<div class="msg-avatar">${avatar}</div>`;
  msg.innerHTML = `
    ${avatarMarkup}
    <div class="msg-bubble">${html}</div>
  `;
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
}

function chatHistoryForAPI() {
  return Array.from(document.querySelectorAll(".chat-body .msg")).slice(-6).map((item) => ({
    role: item.classList.contains("user") ? "user" : "assistant",
    content: (item.querySelector(".msg-bubble")?.textContent || "").trim().slice(0, 600)
  })).filter((item) => item.content);
}

function escapeChatText(text) {
  const span = document.createElement("span");
  span.textContent = String(text || "");
  return span.innerHTML;
}

function inlineMd(text) {
  const escaped = escapeChatText(text);
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function mdToHtml(md) {
  const lines = String(md || "").split(/\r?\n/);
  let html = "";
  let listType = null;
  const closeList = () => {
    if (listType) { html += `</${listType}>`; listType = null; }
  };
  lines.forEach((raw) => {
    const line = raw.trim();
    if (!line) { closeList(); return; }
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    if (heading) {
      closeList();
      const level = Math.min(raw.match(/^#+/)[0].length, 3);
      html += `<h${level + 1}>${inlineMd(heading[1])}</h${level + 1}>`;
      return;
    }
    const list = line.match(/^[-*]\s+(.*)$/);
    if (list) {
      if (listType !== "ul") { closeList(); html += "<ul>"; listType = "ul"; }
      html += `<li>${inlineMd(list[1])}</li>`;
      return;
    }
    const ordered = line.match(/^\d+[.、]\s*(.*)$/);
    if (ordered) {
      if (listType !== "ol") { closeList(); html += "<ol>"; listType = "ol"; }
      html += `<li>${inlineMd(ordered[1])}</li>`;
      return;
    }
    closeList();
    html += `<p>${inlineMd(line)}</p>`;
  });
  closeList();
  return html;
}

window.SuishipaiChatUtil = { mdToHtml, escapeChatText };

async function askXiaosui(question) {
  if (!window.SuishipaiAPI) throw new Error("AI接口尚未加载");
  const history = chatHistoryForAPI();
  if (history.length && history[history.length - 1].role === "user" && history[history.length - 1].content === question) history.pop();
  const day = getMealDay();
  return window.SuishipaiAPI.chat(question, history, day.meals.length ? day : undefined);
}

function renderSources(sources) {
  if (!Array.isArray(sources) || !sources.length) return "";
  const items = sources.map((item) => item.topic || item.source || "").filter(Boolean);
  if (!items.length) return "";
  return `<div class="msg-sources">📚 研究依据：${items.map((t) => escapeChatText(t)).join(" · ")}</div>`;
}

function initChat() {
  const input = document.querySelector(".chat-input input");
  const send = document.querySelector(".chat-send");

  async function handleQuestion(q) {
    appendMsg("user", "👤", escapeChatText(q));
    try {
      const result = await askXiaosui(q);
      appendMsg("bot", "🌱", mdToHtml(result.reply) + renderSources(result.sources));
    } catch (error) {
      appendMsg("bot", "🌱", "小穗暂时无法连接AI服务，请稍后再试。项目介绍与调研数据仍可在网站其他页面查看。");
    }
  }

  const quickBtns = document.querySelectorAll(".quick-btn");
  quickBtns.forEach(b => {
    b.addEventListener("click", async () => {
      const q = b.textContent.trim();
      if (b.disabled) return;
      b.disabled = true;
      try { await handleQuestion(q); } finally { b.disabled = false; }
    });
  });

  async function handleSend() {
    const v = input.value.trim();
    if (!v || send.disabled) return;
    input.value = "";
    send.disabled = true;
    send.textContent = "思考中";
    try { await handleQuestion(v); } finally {
      send.disabled = false;
      send.textContent = "发送";
      input.focus();
    }
  }
  send?.addEventListener("click", handleSend);
  input?.addEventListener("keydown", e => { if (e.key === "Enter") handleSend(); });

  window.suishipaiChat = { ask: handleQuestion };
}

function initChatHistory() {
  const storageKey = "suishipai_chat_history_v1";
  const list = document.querySelector(".history-list");
  const empty = document.querySelector(".history-empty");
  const newButton = document.querySelector(".history-new");
  const clearButton = document.querySelector(".history-clear");
  const mobileToggle = document.querySelector(".history-mobile-toggle");
  const historyPanel = document.querySelector(".assistant-history");
  const chatBody = document.querySelector(".chat-body");
  if (!list || !empty || !chatBody) return;

  const welcome = chatBody.innerHTML;
  let sessions = [];
  let activeId = null;
  try { sessions = JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { sessions = []; }

  const save = () => localStorage.setItem(storageKey, JSON.stringify(sessions.slice(0, 12)));
  const render = () => {
    list.innerHTML = "";
    empty.hidden = sessions.length > 0;
    sessions.forEach((session) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `history-item${session.id === activeId ? " active" : ""}`;
      button.innerHTML = `<strong></strong><small></small>`;
      button.querySelector("strong").textContent = session.title;
      button.querySelector("small").textContent = session.time;
      button.addEventListener("click", () => {
        activeId = session.id;
        chatBody.innerHTML = session.html || welcome;
        render();
      });
      list.appendChild(button);
    });
  };

  const persistCurrent = () => {
    const userMessages = Array.from(chatBody.querySelectorAll(".msg.user .msg-bubble"));
    if (!userMessages.length) return;
    const title = userMessages[0].textContent.trim().slice(0, 22) || "新对话";
    if (!activeId) activeId = String(Date.now());
    const now = new Date();
    const record = { id: activeId, title, time: `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`, html: chatBody.innerHTML };
    sessions = [record, ...sessions.filter((item) => item.id !== activeId)];
    save();
    render();
  };

  new MutationObserver(() => persistCurrent()).observe(chatBody, { childList: true });
  newButton?.addEventListener("click", () => { activeId = null; chatBody.innerHTML = welcome; render(); });
  clearButton?.addEventListener("click", () => { sessions = []; activeId = null; save(); chatBody.innerHTML = welcome; render(); });
  mobileToggle?.addEventListener("click", () => {
    const open = !historyPanel.classList.contains("history-open");
    historyPanel.classList.toggle("history-open", open);
    mobileToggle.setAttribute("aria-expanded", String(open));
    mobileToggle.textContent = open ? "收起历史记录" : "查看历史记录";
  });
  render();
}

// -------- Mobile navigation --------
function initMobileNav() {
  const nav = document.querySelector(".nav");
  const inner = nav?.querySelector(".nav-inner");
  const links = nav?.querySelector(".nav-links");
  if (!nav || !inner || !links || inner.querySelector(".nav-menu-toggle")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "nav-menu-toggle";
  button.textContent = "菜单";
  button.setAttribute("aria-label", "打开网站导航");
  button.setAttribute("aria-expanded", "false");

  const navAction = inner.querySelector(".nav-action");
  inner.insertBefore(button, navAction || null);

  const close = () => {
    nav.classList.remove("menu-open");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "打开网站导航");
    button.textContent = "菜单";
  };

  button.addEventListener("click", () => {
    const expanded = !nav.classList.contains("menu-open");
    nav.classList.toggle("menu-open", expanded);
    button.setAttribute("aria-expanded", String(expanded));
    button.setAttribute("aria-label", expanded ? "关闭网站导航" : "打开网站导航");
    button.textContent = expanded ? "关闭" : "菜单";
  });

  links.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  document.addEventListener("click", (event) => {
    if (!nav.contains(event.target)) close();
  });
}

// -------- 从导航"开始识餐"进入时，滚动到五步流程栏 --------
function initMealFlowAnchor() {
  const flow = document.getElementById("meal-flow");
  if (!flow) return;
  let start = false;
  try { start = new URLSearchParams(window.location.search).get("start") === "1"; } catch (e) {}
  if (!start) return;
  const navHeight = document.querySelector(".nav")?.offsetHeight || 0;
  const top = flow.getBoundingClientRect().top + window.scrollY - navHeight - 16;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

// -------- Init --------
document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initReveal();
  initPersonaTabs();
  initStepFlow();
  initMealFlowAnchor();
  initMealUpload();
  initMealRecalculation();
  initSendMealToAssistant();
  initExportMealReport();
  initChat();
  initChatHistory();
  initAssistantMealHandoff();
  initFloatingMascot();
  updateDailySummary();
  renderMealDayTable();
});
