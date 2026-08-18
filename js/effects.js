(function () {
  "use strict";

  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "fx-particle-layer";
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var particles = [];
  var COUNT = 90;
  var LEFT = 0.56;

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
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      a: 0.1 + Math.random() * 0.3,
      hue: Math.random() < 0.62 ? "70,191,165" : "42,136,168",
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
      if (p.x < -10) p.x = W * LEFT + 10; else if (p.x > W * LEFT + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
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
