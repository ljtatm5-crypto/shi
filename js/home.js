document.addEventListener("DOMContentLoaded", () => {
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
