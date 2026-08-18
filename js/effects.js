(function () {
  "use strict";

  // 尊重减少动态偏好
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 少量动态粒子 ---------- */
  var canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.className = "fx-particle-layer";
  document.body.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  var particles = [];
  var COUNT = 34;

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

  function spawn(i) {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.8 + Math.random() * 1.9,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      a: 0.08 + Math.random() * 0.28,
      hue: Math.random() < 0.62 ? "70,191,165" : "42,136,168"
    };
  }
  for (var i = 0; i < COUNT; i++) particles.push(spawn(i));

  function tick() {
    ctx.clearRect(0, 0, W, H);
    for (var j = 0; j < particles.length; j++) {
      var p = particles[j];
      p.x += p.vx; p.y += p.vy;
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(" + p.hue + "," + p.a + ")";
      ctx.fill();
    }
    requestAnimationFrame(tick);
  }
  tick();

  /* ---------- 鼠标轻微光效 ---------- */
  var glow = document.createElement("div");
  glow.setAttribute("aria-hidden", "true");
  glow.className = "fx-cursor-glow";
  document.body.appendChild(glow);

  var raf = null;
  function move(e) {
    if (reduced) return;
    var x = e.clientX, y = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(function () {
      glow.style.transform = "translate(" + (x - 160) + "px," + (y - 160) + "px)";
      raf = null;
    });
  }
  window.addEventListener("pointermove", move, { passive: true });
})();
