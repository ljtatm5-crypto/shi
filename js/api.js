(function () {
  "use strict";

  var configured = document.querySelector('meta[name="suishipai-api-base"]');
  var API_BASE = (configured && configured.content ? configured.content : "").replace(/\/$/, "");

  function request(path, options) {
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, 30000);
    return fetch(API_BASE + path, Object.assign({
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    }, options || {})).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || "小穗服务暂时不可用");
        return data;
      });
    }).finally(function () { window.clearTimeout(timer); });
  }

  window.SuishipaiAPI = {
    chat: function (message, history) {
      return request("/api/research-chat", {
        method: "POST",
        body: JSON.stringify({ message: message, history: (history || []).slice(-6) })
      });
    },
    recalculate: function (meal) {
      return request("/api/recalculate-food", {
        method: "POST",
        body: JSON.stringify(meal)
      });
    },
    health: function () { return request("/api/health", { method: "GET" }); }
  };
}());
