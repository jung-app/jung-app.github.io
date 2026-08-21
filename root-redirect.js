(function () {
  "use strict";

  function landingUrl() {
    var source = new URLSearchParams(window.location.search).get("src") || "";
    source = source.trim().toLowerCase();
    if (/^[a-z0-9][a-z0-9_-]{0,31}$/.test(source)) {
      return "./landing.html?src=" + encodeURIComponent(source);
    }
    return "./landing.html";
  }

  function showLanding() {
    settled = true;
    window.clearTimeout(timeout);
    window.location.replace(landingUrl());
  }

  function hasTelegramLaunchParams() {
    var launch = window.location.search + "&" + window.location.hash;
    return /(?:^|[?&#])tgWebAppData=/.test(launch) &&
      /(?:^|[?&#])tgWebAppVersion=/.test(launch);
  }

  function afterDomReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  function loadMiniApp() {
    afterDomReady(function () {
      var boot = document.createElement("script");
      boot.src = "./miniapp-boot.js?v=20260815-path-redesign-2";
      document.body.appendChild(boot);
    });
  }

  function waitForTelegramInit(attempt) {
    var webApp = window.Telegram && window.Telegram.WebApp;
    if (webApp && webApp.initData) {
      settled = true;
      window.clearTimeout(timeout);
      loadMiniApp();
      return;
    }
    // Telegram Web иногда загружает SDK раньше, чем завершает postMessage-handshake
    // с iframe. Мгновенная проверка отправляла настоящий Mini App на лендинг.
    if (attempt < 30) {
      window.setTimeout(function () {
        waitForTelegramInit(attempt + 1);
      }, 100);
      return;
    }
    showLanding();
  }

  if (!hasTelegramLaunchParams()) {
    showLanding();
    return;
  }

  var settled = false;
  var timeout = window.setTimeout(function () {
    if (!settled) showLanding();
  }, 5000);
  var sdk = document.createElement("script");
  sdk.src = "https://telegram.org/js/telegram-web-app.js";
  sdk.async = true;
  sdk.onload = function () { waitForTelegramInit(0); };
  sdk.onerror = showLanding;
  document.head.appendChild(sdk);
})();
