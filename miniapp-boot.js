(function () {
  "use strict";

  var version = Date.now();
  var timer;
  var failed = false;

  function showFailure() {
    if (failed) return;
    failed = true;
    clearTimeout(timer);
    var root = document.getElementById("app");
    if (!root) return;
    var section = document.createElement("section");
    section.className = "state";
    section.setAttribute("role", "alert");
    var title = document.createElement("h1");
    title.className = "state-title serif";
    title.textContent = "Не получилось запустить профиль";
    var sub = document.createElement("p");
    sub.className = "state-sub";
    sub.textContent = "Проверь соединение и попробуй ещё раз.";
    var retry = document.createElement("button");
    retry.className = "state-action";
    retry.type = "button";
    retry.textContent = "Повторить";
    retry.addEventListener("click", function () { window.location.reload(); });
    section.appendChild(title);
    section.appendChild(sub);
    section.appendChild(retry);
    root.replaceChildren(section);
  }

  var config = document.createElement("script");
  config.src = "./config.js?v=" + version;
  config.onload = function () {
    var app = document.createElement("script");
    app.src = "./app.js?v=" + version;
    app.onload = function () { clearTimeout(timer); };
    app.onerror = showFailure;
    document.body.appendChild(app);
  };
  config.onerror = showFailure;
  timer = setTimeout(showFailure, 15000);
  document.body.appendChild(config);
})();
