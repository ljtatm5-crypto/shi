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
    });
  });
}

function initMealUpload() {
  const input = document.querySelector("#meal-upload");
  const preview = document.querySelector(".upload-preview");
  if (!input || !preview) return;
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      window.alert("图片不能超过 10MB，请重新选择。");
      input.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      preview.src = reader.result;
      preview.hidden = false;
      document.querySelector('.step[data-step="2"]')?.click();
    });
    reader.readAsDataURL(file);
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
const REPLIES = {
  "本餐营养": {
    title: "🥗 本餐营养解读",
    lines: [
      "本餐总热量 <b>612 kcal</b>，蛋白质 <b>28g</b>、脂肪 <b>22g</b>、碳水 <b>76g</b>。",
      "蛋白/脂肪/碳水供能比 = 18% / 32% / 50%，脂肪偏高，建议下一餐控制油量。",
      "钠含量约 <b>980mg</b>，接近单餐推荐上限（1000mg），下一餐清淡为宜。"
    ]
  },
  "今日膳食": {
    title: "📊 今日膳食评价",
    lines: [
      "今日累计摄入 <b>1650 kcal</b>，达成目标的 82%。",
      "蔬菜摄入 <b>240g</b>（推荐 300-500g），<b>偏少</b>；水果摄入 <b>0g</b>，缺失。",
      "整体评分：<b>B（良好）</b>，主要问题是膳食纤维不足和水果缺失。"
    ]
  },
  "推荐晚餐": {
    title: "🍲 晚餐推荐",
    lines: [
      "结合今日缺口，推荐 <b>粤式清蒸鲈鱼 + 蒜蓉西兰花 + 糙米饭 + 木瓜</b>。",
      "预估热量 <b>520 kcal</b>，可补充蛋白质 32g、膳食纤维 8g、维生素 C 78mg。",
      "粤式替代方案：白灼菜心 + 蒸滑鸡 + 冬瓜薏米汤，热量更低（约 460 kcal）。"
    ]
  },
  "健康提醒": {
    title: "⚠️ 健康提醒",
    lines: [
      "本餐钠含量偏高，<b>高血压/心血管疾病人群</b>请注意控盐。",
      "检测到本餐含 <b>虾</b>，若有海鲜过敏史请谨慎食用。",
      "已连续 3 天蔬菜摄入不足 300g，建议明日午餐增加深色蔬菜。"
    ]
  }
};

function appendMsg(role, avatar, html) {
  const body = document.querySelector(".chat-body");
  if (!body) return;
  const msg = document.createElement("div");
  msg.className = "msg " + role;
  msg.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-bubble">${html}</div>
  `;
  body.appendChild(msg);
  body.scrollTop = body.scrollHeight;
}

function botReply(key) {
  const data = REPLIES[key];
  if (!data) {
    appendMsg("bot", "🌱", "我可以帮你解读本餐营养、评价今日膳食、推荐下一餐，也能提醒过敏与营养失衡。试试上面的快捷问题吧。");
    return;
  }
  appendMsg("bot", "🌱", `<b>${data.title}</b><br>${data.lines.join("<br>")}`);
}

function initChat() {
  const quickBtns = document.querySelectorAll(".quick-btn");
  quickBtns.forEach(b => {
    b.addEventListener("click", () => {
      const q = b.textContent.trim();
      appendMsg("user", "👤", q);
      setTimeout(() => botReply(b.dataset.reply), 350);
    });
  });

  const input = document.querySelector(".chat-input input");
  const send = document.querySelector(".chat-send");
  function handleSend() {
    const v = input.value.trim();
    if (!v) return;
    appendMsg("user", "👤", v);
    input.value = "";
    let key = null;
    if (/营养|热量|卡路里|蛋白|脂肪|碳水/.test(v)) key = "本餐营养";
    else if (/今日|评价|全天|整体/.test(v)) key = "今日膳食";
    else if (/推荐|晚餐|下一餐|吃什么|粤/.test(v)) key = "推荐晚餐";
    else if (/过敏|提醒|注意|钠|盐|风险/.test(v)) key = "健康提醒";
    setTimeout(() => botReply(key), 400);
  }
  send?.addEventListener("click", handleSend);
  input?.addEventListener("keydown", e => { if (e.key === "Enter") handleSend(); });
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

// -------- Init --------
document.addEventListener("DOMContentLoaded", () => {
  initMobileNav();
  initReveal();
  initPersonaTabs();
  initStepFlow();
  initMealUpload();
  initChat();
  initChatHistory();
  initFloatingMascot();
});
