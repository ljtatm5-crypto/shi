(function () {
  "use strict";

  // 在浏览器视口底部注入「向下滑动」引导箭头
  (function injectScrollHint() {
    if (document.querySelector(".scroll-hint")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "scroll-hint";
    btn.setAttribute("aria-label", "向下滚动查看更多");
    btn.addEventListener("click", function () {
      window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
    });
    document.body.appendChild(btn);
  })();

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "fx-particle-layer";
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var particles = [];
  var COUNT = 70;
  var LEFT = 0.6;

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  function spawn() {
    return {
      x: Math.random() * W * LEFT,
      y: Math.random() * H,
      r: 0.8 + Math.random() * 2.1,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      a: 0.1 + Math.random() * 0.3,
      hue: Math.random() < 0.5 ? "42,136,168" : "90,160,200",
      overImage: false
    };
  }
  for (var i = 0; i < COUNT; i++) particles.push(spawn());

  // 粒子落在图片或背景图区域时几乎隐藏，只保留空白处的粒子
  function isOverImage(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return false;
    var node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      if (node.tagName === "IMG" || node.tagName === "VIDEO" || node.tagName === "SVG") return true;
      var bg = getComputedStyle(node).backgroundImage;
      if (bg && bg !== "none") return true;
      node = node.parentElement;
    }
    return false;
  }

  var frame = 0;
  function tick() {
    frame++;
    ctx.clearRect(0, 0, W, H);
    var check = frame % 6 === 0;
    for (var j = 0; j < particles.length; j++) {
      var p = particles[j];
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < p.r) { p.x = p.r; p.vx = Math.abs(p.vx); }
      else if (p.x > W * LEFT - p.r) { p.x = W * LEFT - p.r; p.vx = -Math.abs(p.vx); }
      if (p.y < p.r) { p.y = p.r; p.vy = Math.abs(p.vy); }
      else if (p.y > H - p.r) { p.y = H - p.r; p.vy = -Math.abs(p.vy); }
      if (check) p.overImage = isOverImage(p.x, p.y);
      var alpha = p.overImage ? p.a * 0.06 : p.a;
      if (alpha < 0.01) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + p.hue + "," + alpha + ")";
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  tick();
})();
