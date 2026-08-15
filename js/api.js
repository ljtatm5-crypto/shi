(function () {
  "use strict";

  var configured = document.querySelector('meta[name="suishipai-api-base"]');
  var API_BASE = (configured && configured.content ? configured.content : "").replace(/\/$/, "");

  function request(path, options, timeoutMs) {
    var controller = new AbortController();
    var timer = window.setTimeout(function () { controller.abort(); }, timeoutMs || 30000);
    return fetch(API_BASE + path, Object.assign({
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    }, options || {})).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) {
          var error = new Error(data.error || "小穗服务暂时不可用");
          error.status = response.status;
          throw error;
        }
        return data;
      });
    }).finally(function () { window.clearTimeout(timer); });
  }

  window.SuishipaiAPI = {
    chat: function (message, history, day) {
      return request("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: message,
          history: (history || []).slice(-6),
          day: day || undefined
        })
      }).catch(function (error) {
        if (error && error.status === 404) {
          return request("/api/research-chat", {
            method: "POST",
            body: JSON.stringify({ message: message, history: (history || []).slice(-6) })
          });
        }
        throw error;
      });
    },
    recalculate: function (meal) {
      return request("/api/recalculate-food", {
        method: "POST",
        body: JSON.stringify(meal)
      });
    },
    analyze: function (imageDataUrl) {
      return request("/api/analyze-food", {
        method: "POST",
        body: JSON.stringify({ image_data: imageDataUrl })
      }, 90000);
    },
    health: function () { return request("/api/health", { method: "GET" }); }
  };
}());
