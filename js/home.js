document.addEventListener("DOMContentLoaded", () => {
  const counters = Array.from(document.querySelectorAll("[data-num]"));
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const runCount = (el) => {
    const target = parseFloat(el.dataset.num);
    const suffix = el.dataset.suffix || "";
    const decimals = (el.dataset.num.split(".")[1] || "").length;
    const format = (val) =>
      val.toLocaleString("zh-CN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }) + suffix;

    if (prefersReduced || !Number.isFinite(target)) {
      el.textContent = format(target);
      return;
    }

    const duration = 1600;
    const start = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      el.textContent = format(target * ease(progress));
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = format(target);
    };
    requestAnimationFrame(tick);
  };

  if (counters.length) {
    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              runCount(entry.target);
              obs.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.4 }
      );
      counters.forEach((el) => observer.observe(el));
    } else {
      counters.forEach(runCount);
    }
  }

  const tabs = Array.from(document.querySelectorAll("[data-home-step]"));
  const panels = Array.from(document.querySelectorAll("[data-home-panel]"));

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.homeStep;
      tabs.forEach((item) => {
        const selected = item === tab;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.homePanel !== target;
      });
    });
  });
});
