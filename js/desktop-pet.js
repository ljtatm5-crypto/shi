(function () {
  "use strict";

  var STATE_KEY = "suishipai_desktop_pet_state_v1";
  var CHAT_KEY = "suishipai_desktop_pet_chat_v1";
  var PET_MARGIN = 10;
  var DRAG_THRESHOLD = 7;
  var MAX_MESSAGES = 30;
  var WELCOME = "你好，我是小穗。可以问我粤式餐食搭配、日常营养和下一餐怎么安排。";

  function readJson(key, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(key) || "null");
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }

  function makeElement(tag, className, attributes) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    Object.keys(attributes || {}).forEach(function (key) {
      if (key === "text") element.textContent = attributes[key];
      else element.setAttribute(key, attributes[key]);
    });
    return element;
  }

  function buildInterface() {
    var root = makeElement("div", "desktop-pet-root", { "aria-live": "off" });
    var instructions = makeElement("span", "desktop-pet-sr-only", {
      id: "desktop-pet-instructions",
      text: "点击打开问答窗。拖动可改变位置，也可用方向键移动。"
    });
    instructions.style.cssText = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";

    var launcher = makeElement("button", "desktop-pet-launcher", {
      type: "button",
      "aria-label": "打开小穗助手",
      "aria-haspopup": "dialog",
      "aria-expanded": "false",
      "aria-describedby": "desktop-pet-instructions"
    });
    var petImage = makeElement("img", "", {
      src: "images/xiaosui-assistant.webp",
      alt: "",
      width: "84",
      height: "104",
      loading: "lazy",
      decoding: "async"
    });
    var hint = makeElement("span", "desktop-pet-hint", { text: "小穗助手" });
    launcher.appendChild(petImage);
    launcher.appendChild(hint);
    root.appendChild(instructions);
    root.appendChild(launcher);

    var panel = makeElement("section", "desktop-pet-panel", {
      role: "dialog",
      "aria-label": "小穗助手问答窗",
      hidden: ""
    });
    var resizeHandle = makeElement("button", "desktop-pet-resize-handle", {
      type: "button",
      "aria-label": "从左上角拖动调整问答窗大小",
      title: "拖动调整窗口大小"
    });
    var head = makeElement("header", "desktop-pet-panel-head");
    var halo = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    halo.setAttribute("class", "pet-halo");
    halo.setAttribute("viewBox", "0 0 100 100");
    halo.setAttribute("aria-hidden", "true");
    halo.innerHTML =
      '<defs>' +
        '<linearGradient id="petHaloGrad" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#dff8e9"/>' +
          '<stop offset="55%" stop-color="#79d8af"/>' +
          '<stop offset="100%" stop-color="#37a8ba"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<circle cx="50" cy="50" r="46" fill="none" stroke="#a9e8ce" stroke-width="1" stroke-dasharray="3 6"/>' +
      '<circle cx="50" cy="50" r="38" fill="none" stroke="url(#petHaloGrad)" stroke-width="2" stroke-dasharray="1 4" opacity=".7"/>' +
      '<circle cx="50" cy="50" r="30" fill="none" stroke="#53d7a2" stroke-width="1" stroke-dasharray="2 8" opacity=".55"/>';
    head.appendChild(halo);
    ["p1", "p2", "p3"].forEach(function (cls) {
      var dot = makeElement("span", "pet-particle " + cls, { "aria-hidden": "true" });
      head.appendChild(dot);
    });
    var avatar = makeElement("img", "", {
      src: "images/xiaosui-assistant.old.png",
      alt: "",
      width: "40",
      height: "40",
      loading: "lazy",
      decoding: "async"
    });
    var title = makeElement("div", "desktop-pet-panel-title");
    title.appendChild(makeElement("strong", "", { text: "小穗助手" }));
    title.appendChild(makeElement("small", "", { text: "膳食建议原型" }));
    var clear = makeElement("button", "desktop-pet-icon-button", {
      type: "button",
      text: "清空",
      "aria-label": "清空悬浮问答记录"
    });
    var close = makeElement("button", "desktop-pet-icon-button", {
      type: "button",
      text: "收起",
      "aria-label": "收起问答窗"
    });
    head.appendChild(avatar);
    head.appendChild(title);
    head.appendChild(clear);
    head.appendChild(close);

    var messages = makeElement("div", "desktop-pet-messages", {
      role: "log",
      "aria-live": "polite",
      "aria-relevant": "additions text",
      "aria-label": "问答消息"
    });
    var typing = makeElement("div", "desktop-pet-typing", {
      text: "",
      "aria-live": "polite"
    });
    var quick = makeElement("div", "desktop-pet-quick", { "aria-label": "快捷问题" });
    ["晚餐怎么搭配？", "肠粉怎么吃更均衡？", "今天蛋白质怎么补？"].forEach(function (label) {
      var button = makeElement("button", "", { type: "button", text: label });
      button.dataset.question = label;
      quick.appendChild(button);
    });

    var form = makeElement("form", "desktop-pet-form");
    var input = makeElement("textarea", "", {
      rows: "1",
      maxlength: "300",
      "aria-label": "向小穗提问",
      placeholder: "输入膳食问题"
    });
    var send = makeElement("button", "desktop-pet-send", {
      type: "submit",
      text: "发送"
    });
    form.appendChild(input);
    form.appendChild(send);

    var foot = makeElement("footer", "desktop-pet-panel-foot");
    foot.appendChild(makeElement("span", "", { text: "仅提供一般性建议，不替代医生或营养师服务。" }));
    var hide = makeElement("button", "", { type: "button", text: "隐藏助手" });
    foot.appendChild(hide);

    panel.appendChild(resizeHandle);
    panel.appendChild(head);
    panel.appendChild(messages);
    panel.appendChild(typing);
    panel.appendChild(quick);
    panel.appendChild(form);
    panel.appendChild(foot);

    var recall = makeElement("button", "desktop-pet-recall", {
      type: "button",
      text: "打开小穗",
      "aria-label": "重新显示小穗助手",
      hidden: ""
    });

    document.body.appendChild(root);
    document.body.appendChild(panel);
    document.body.appendChild(recall);
    return {
      root: root,
      launcher: launcher,
      panel: panel,
      resizeHandle: resizeHandle,
      messages: messages,
      typing: typing,
      quick: quick,
      form: form,
      input: input,
      send: send,
      close: close,
      clear: clear,
      hide: hide,
      recall: recall
    };
  }

  function createAnswer(question) {
    var normalized = question.replace(/\s+/g, "");
    if (/过敏|不舒服|腹泻|头晕|高血压|糖尿病|疾病|药/.test(normalized)) {
      return "如果涉及过敏、疾病症状或用药，请先咨询医生。日常饮食可以记录食材、份量和身体反应，避免自行根据原型建议调整治疗方案。";
    }
    if (/肠粉|早茶|点心|烧卖|叉烧包/.test(normalized)) {
      return "粤式点心可以搭配无糖茶、白灼青菜或一份水果。肠粉酱汁和点心蘸料可少放，下一餐再补充蔬菜与优质蛋白。";
    }
    if (/减脂|热量|体重|变瘦/.test(normalized)) {
      return "减脂期先保持规律三餐。餐盘可大致安排一半蔬菜、四分之一蛋白质食物和四分之一主食，并优先减少含糖饮料与额外油脂。";
    }
    if (/蛋白|鸡蛋|鸡肉|鱼|豆/.test(normalized)) {
      return "补充蛋白质可以从鱼虾、鸡蛋、禽肉、豆制品和奶类中轮换选择。每餐安排一种，通常比集中到一餐更容易执行。";
    }
    if (/晚餐|下一餐|吃什么|搭配/.test(normalized)) {
      return "晚餐可以选清蒸鱼或豆腐、两种蔬菜，再配适量杂粮饭。若午餐较油，晚餐少用煎炸和浓味酱汁即可。";
    }
    if (/蔬菜|水果|纤维|便秘/.test(normalized)) {
      return "可以在正餐增加深色蔬菜，并把水果放在两餐之间。饮水、规律活动和逐步增加膳食纤维也很重要。";
    }
    return "可以把今天吃过的食物、主要份量和你的目标告诉我。我会从主食、蛋白质、蔬菜和烹调方式四方面给出一般性搭配建议。";
  }

  function init() {
    if (document.querySelector(".desktop-pet-root")) return;

    var ui = buildInterface();
    var storedState = readJson(STATE_KEY, {});
    var state = {
      x: Number.isFinite(storedState.x) ? storedState.x : null,
      y: Number.isFinite(storedState.y) ? storedState.y : null,
      visible: storedState.visible !== false,
      panelOpen: storedState.panelOpen === true,
      panelWidth: Number.isFinite(storedState.panelWidth) ? storedState.panelWidth : null,
      panelHeight: Number.isFinite(storedState.panelHeight) ? storedState.panelHeight : null
    };
    var storedMessages = readJson(CHAT_KEY, []);
    var chat = Array.isArray(storedMessages) ? storedMessages.filter(function (item) {
      return item && (item.role === "user" || item.role === "bot") && typeof item.text === "string";
    }).slice(-MAX_MESSAGES) : [];
    var drag = null;
    var panelResize = null;
    var suppressClick = false;
    var replying = false;

    document.querySelectorAll(".floating-mascot").forEach(function (oldMascot) {
      oldMascot.remove();
    });

    function petSize() {
      return { width: ui.root.offsetWidth || 94, height: ui.root.offsetHeight || 112 };
    }

    function constrainPosition(x, y) {
      var size = petSize();
      return {
        x: clamp(x, PET_MARGIN, window.innerWidth - size.width - PET_MARGIN),
        y: clamp(y, PET_MARGIN, window.innerHeight - size.height - PET_MARGIN)
      };
    }

    function saveState() {
      writeJson(STATE_KEY, state);
    }

    function applyPanelSize() {
      if (window.innerWidth <= 600) {
        ui.panel.style.removeProperty("--pet-panel-width");
        ui.panel.style.removeProperty("--pet-panel-height");
        return;
      }
      var maxWidth = Math.max(320, window.innerWidth - PET_MARGIN * 2);
      var maxHeight = Math.max(320, window.innerHeight - PET_MARGIN * 2);
      if (state.panelWidth !== null) {
        state.panelWidth = Math.round(clamp(state.panelWidth, 320, maxWidth));
        ui.panel.style.setProperty("--pet-panel-width", state.panelWidth + "px");
      }
      if (state.panelHeight !== null) {
        state.panelHeight = Math.round(clamp(state.panelHeight, 320, maxHeight));
        ui.panel.style.setProperty("--pet-panel-height", state.panelHeight + "px");
      }
    }

    function placePet(x, y, persist) {
      var next = constrainPosition(x, y);
      state.x = Math.round(next.x);
      state.y = Math.round(next.y);
      ui.root.style.setProperty("--pet-x", state.x + "px");
      ui.root.style.setProperty("--pet-y", state.y + "px");
      if (state.panelOpen) placePanel();
      if (persist) saveState();
    }

    function avoidAssistantInput(persist) {
      if (!document.body.classList.contains("assistant-page")) return;
      var mainInput = document.querySelector(".chat-shell-large .chat-input, .assistant-console .chat-input");
      if (!mainInput) return;
      var target = mainInput.getBoundingClientRect();
      var size = petSize();
      var petRect = {
        left: state.x,
        right: state.x + size.width,
        top: state.y,
        bottom: state.y + size.height
      };
      var overlaps = petRect.right > target.left - 8 && petRect.left < target.right + 8 && petRect.bottom > target.top - 8 && petRect.top < target.bottom + 8;
      if (overlaps) placePet(window.innerWidth - size.width - PET_MARGIN, Math.max(PET_MARGIN, target.top - size.height - 18), persist);
    }

    function placePanel() {
      if (!state.panelOpen || ui.panel.hidden || panelResize) return;
      var panelWidth = ui.panel.offsetWidth || Math.min(360, window.innerWidth - 24);
      var panelHeight = ui.panel.offsetHeight || Math.min(540, window.innerHeight - 24);
      var size = petSize();
      var petCenterX = state.x + size.width / 2;
      var gap = 10;
      var left = petCenterX > window.innerWidth / 2 ? state.x - panelWidth - gap : state.x + size.width + gap;
      var top = state.y + size.height - panelHeight;

      if (window.innerWidth <= 600) {
        left = (window.innerWidth - panelWidth) / 2;
        top = state.y > window.innerHeight / 2 ? state.y - panelHeight - gap : state.y + size.height + gap;
      }
      left = clamp(left, PET_MARGIN, window.innerWidth - panelWidth - PET_MARGIN);
      top = clamp(top, PET_MARGIN, window.innerHeight - panelHeight - PET_MARGIN);

      if (document.body.classList.contains("assistant-page")) {
        var mainInput = document.querySelector(".chat-shell-large .chat-input, .assistant-console .chat-input");
        if (mainInput) {
          var target = mainInput.getBoundingClientRect();
          var overlapsInput = left + panelWidth > target.left - 8 && left < target.right + 8 && top + panelHeight > target.top - 8 && top < target.bottom + 8;
          if (overlapsInput && target.bottom > 0 && target.top < window.innerHeight) {
            var aboveInput = target.top - panelHeight - gap;
            var belowInput = target.bottom + gap;
            if (aboveInput >= PET_MARGIN) top = aboveInput;
            else if (belowInput + panelHeight <= window.innerHeight - PET_MARGIN) top = belowInput;
          }
        }
      }
      ui.panel.style.left = Math.round(left) + "px";
      ui.panel.style.top = Math.round(top) + "px";
      ui.panel.style.setProperty("--pet-panel-origin", petCenterX > window.innerWidth / 2 ? "bottom right" : "bottom left");
    }

    function appendRenderedMessage(item) {
      var row = makeElement("div", "desktop-pet-message " + item.role);
      if (item.role !== "user") {
        row.appendChild(makeElement("img", "desktop-pet-message-avatar", {
          src: "images/xiaosui-assistant.old.png",
          alt: "小穗"
        }));
      }
      var bubble = makeElement("div", "desktop-pet-bubble", { text: item.text });
      row.appendChild(bubble);
      ui.messages.appendChild(row);
    }

    function renderMessages() {
      ui.messages.textContent = "";
      if (!chat.length) appendRenderedMessage({ role: "bot", text: WELCOME });
      else chat.forEach(appendRenderedMessage);
      ui.messages.scrollTop = ui.messages.scrollHeight;
      if (state.panelOpen) requestAnimationFrame(placePanel);
    }

    function saveChat() {
      if (!writeJson(CHAT_KEY, chat.slice(-MAX_MESSAGES))) {
        ui.typing.textContent = "本次可继续问答，但浏览器未能保存记录。";
      }
    }

    function setOpen(open, focusInput) {
      state.panelOpen = Boolean(open && state.visible);
      ui.panel.hidden = !state.panelOpen;
      ui.root.classList.toggle("pet-panel-open", state.panelOpen);
      ui.launcher.setAttribute("aria-expanded", String(state.panelOpen));
      ui.launcher.setAttribute("aria-label", state.panelOpen ? "收起小穗悬浮问答" : "打开小穗悬浮问答");
      saveState();
      if (state.panelOpen) {
        placePanel();
        requestAnimationFrame(function () {
          ui.panel.classList.add("pet-panel-visible");
          placePanel();
          if (focusInput) ui.input.focus();
        });
      } else {
        ui.panel.classList.remove("pet-panel-visible");
        if (focusInput) ui.launcher.focus();
      }
    }

    function setVisible(visible) {
      state.visible = visible;
      if (!visible) state.panelOpen = false;
      ui.root.hidden = !visible;
      ui.recall.hidden = visible;
      ui.panel.hidden = !state.panelOpen;
      ui.panel.classList.toggle("pet-panel-visible", state.panelOpen);
      ui.root.classList.toggle("pet-panel-open", state.panelOpen);
      ui.launcher.setAttribute("aria-expanded", String(state.panelOpen));
      saveState();
      if (visible) {
        placePet(state.x, state.y, false);
        ui.launcher.focus();
      } else {
        ui.recall.focus();
      }
    }

    function apiHistory() {
      return chat.slice(0, -1).slice(-6).map(function (item) {
        return { role: item.role === "bot" ? "assistant" : "user", content: item.text.slice(0, 600) };
      });
    }

    function submitQuestion(question) {
      var value = String(question || "").trim();
      if (!value || replying) return;
      chat.push({ role: "user", text: value, time: Date.now() });
      chat = chat.slice(-MAX_MESSAGES);
      appendRenderedMessage(chat[chat.length - 1]);
      ui.messages.scrollTop = ui.messages.scrollHeight;
      requestAnimationFrame(placePanel);
      ui.input.value = "";
      replying = true;
      ui.send.disabled = true;
      ui.typing.textContent = "小穗正在整理建议...";
      saveChat();
      var request = window.SuishipaiAPI
        ? window.SuishipaiAPI.chat(value, apiHistory())
        : Promise.reject(new Error("AI接口尚未加载"));
      request.then(function (result) {
        var answer = { role: "bot", text: result.reply, time: Date.now() };
        chat.push(answer);
        chat = chat.slice(-MAX_MESSAGES);
        appendRenderedMessage(answer);
        saveChat();
        ui.typing.textContent = "";
        ui.messages.scrollTop = ui.messages.scrollHeight;
        requestAnimationFrame(placePanel);
        replying = false;
        ui.send.disabled = false;
      }).catch(function () {
        var answer = { role: "bot", text: "小穗暂时无法连接AI服务，请稍后再试。", time: Date.now() };
        chat.push(answer);
        chat = chat.slice(-MAX_MESSAGES);
        appendRenderedMessage(answer);
        saveChat();
        ui.typing.textContent = "";
        ui.messages.scrollTop = ui.messages.scrollHeight;
        requestAnimationFrame(placePanel);
        replying = false;
        ui.send.disabled = false;
      });
    }

    var size = petSize();
    var defaultX = window.innerWidth - size.width - 22;
    var defaultY = document.body.classList.contains("assistant-page") ? 92 : window.innerHeight - size.height - 24;
    placePet(state.x === null ? defaultX : state.x, state.y === null ? defaultY : state.y, false);
    applyPanelSize();
    avoidAssistantInput(false);
    renderMessages();
    setVisible(state.visible);
    if (state.visible && state.panelOpen) setOpen(true, false);
    window.setTimeout(function () { ui.root.classList.add("pet-ready"); }, 450);
    window.setTimeout(function () { ui.root.classList.remove("pet-ready"); }, 4200);

    ui.launcher.addEventListener("pointerdown", function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: state.x,
        originY: state.y,
        moved: false
      };
      ui.launcher.setPointerCapture(event.pointerId);
    });

    ui.launcher.addEventListener("pointermove", function (event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      var deltaX = event.clientX - drag.startX;
      var deltaY = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD) {
        drag.moved = true;
        ui.root.classList.add("pet-dragging");
      }
      if (drag.moved) {
        event.preventDefault();
        placePet(drag.originX + deltaX, drag.originY + deltaY, false);
      }
    });

    function finishDrag(event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      var moved = drag.moved;
      drag = null;
      ui.root.classList.remove("pet-dragging");
      if (moved) {
        avoidAssistantInput(false);
        saveState();
        suppressClick = true;
        window.setTimeout(function () { suppressClick = false; }, 0);
      }
    }

    ui.launcher.addEventListener("pointerup", finishDrag);
    ui.launcher.addEventListener("pointercancel", finishDrag);
    ui.launcher.addEventListener("click", function () {
      if (suppressClick) return;
      setOpen(!state.panelOpen, true);
    });

    ui.launcher.addEventListener("keydown", function (event) {
      var movement = event.shiftKey ? 30 : 10;
      var deltaX = 0;
      var deltaY = 0;
      if (event.key === "ArrowLeft") deltaX = -movement;
      else if (event.key === "ArrowRight") deltaX = movement;
      else if (event.key === "ArrowUp") deltaY = -movement;
      else if (event.key === "ArrowDown") deltaY = movement;
      else return;
      event.preventDefault();
      placePet(state.x + deltaX, state.y + deltaY, true);
    });

    ui.resizeHandle.addEventListener("pointerdown", function (event) {
      if (window.innerWidth <= 600 || (event.button !== undefined && event.button !== 0)) return;
      var rect = ui.panel.getBoundingClientRect();
      panelResize = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        startWidth: rect.width,
        startHeight: rect.height,
        right: rect.right,
        bottom: rect.bottom
      };
      ui.panel.classList.add("pet-panel-resizing");
      ui.resizeHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    ui.resizeHandle.addEventListener("pointermove", function (event) {
      if (!panelResize || panelResize.pointerId !== event.pointerId) return;
      var minWidth = 320;
      var minHeight = 320;
      var maxWidth = panelResize.right - PET_MARGIN;
      var maxHeight = panelResize.bottom - PET_MARGIN;
      var width = clamp(panelResize.startWidth - (event.clientX - panelResize.startX), minWidth, maxWidth);
      var height = clamp(panelResize.startHeight - (event.clientY - panelResize.startY), minHeight, maxHeight);
      var left = panelResize.right - width;
      var top = panelResize.bottom - height;
      ui.panel.style.setProperty("--pet-panel-width", Math.round(width) + "px");
      ui.panel.style.setProperty("--pet-panel-height", Math.round(height) + "px");
      ui.panel.style.left = Math.round(left) + "px";
      ui.panel.style.top = Math.round(top) + "px";
      event.preventDefault();
    });

    function finishPanelResize(event) {
      if (!panelResize || panelResize.pointerId !== event.pointerId) return;
      state.panelWidth = Math.round(ui.panel.offsetWidth);
      state.panelHeight = Math.round(ui.panel.offsetHeight);
      panelResize = null;
      ui.panel.classList.remove("pet-panel-resizing");
      saveState();
    }

    ui.resizeHandle.addEventListener("pointerup", finishPanelResize);
    ui.resizeHandle.addEventListener("pointercancel", finishPanelResize);

    ui.close.addEventListener("click", function () { setOpen(false, true); });
    ui.hide.addEventListener("click", function () { setVisible(false); });
    ui.recall.addEventListener("click", function () { setVisible(true); });
    ui.clear.addEventListener("click", function () {
      chat = [];
      saveChat();
      renderMessages();
      ui.typing.textContent = "记录已清空。";
      ui.input.focus();
    });
    ui.quick.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-question]");
      if (button) submitQuestion(button.dataset.question);
    });
    ui.form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitQuestion(ui.input.value);
    });
    ui.input.addEventListener("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        submitQuestion(ui.input.value);
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && state.panelOpen) setOpen(false, false);
    });
    window.addEventListener("resize", function () {
      applyPanelSize();
      placePet(state.x, state.y, false);
      avoidAssistantInput(false);
      placePanel();
    }, { passive: true });

    if ("ResizeObserver" in window) {
      var resizeSaveTimer = 0;
      new ResizeObserver(function () {
        if (window.innerWidth <= 600 || ui.panel.hidden) return;
        state.panelWidth = Math.round(ui.panel.offsetWidth);
        state.panelHeight = Math.round(ui.panel.offsetHeight);
        window.requestAnimationFrame(placePanel);
        window.clearTimeout(resizeSaveTimer);
        resizeSaveTimer = window.setTimeout(function () {
          saveState();
        }, 180);
      }).observe(ui.panel);
    }

    if (document.body.classList.contains("assistant-page") && "IntersectionObserver" in window) {
      var assistantInput = document.querySelector(".chat-shell-large .chat-input, .assistant-console .chat-input");
      if (assistantInput) {
        new IntersectionObserver(function (entries) {
          if (entries.some(function (entry) { return entry.isIntersecting; })) {
            avoidAssistantInput(false);
            placePanel();
          }
        }, { threshold: [0.05, 0.5, 0.9] }).observe(assistantInput);
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
}());
