(function () {
  "use strict";

  function showLanding() {
    settled = true;
    window.clearTimeout(timeout);
    window.location.replace(
      "./landing.html" + window.location.search + window.location.hash,
    );
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
      boot.src = "./miniapp-boot.js?v=" + Date.now();
      document.body.appendChild(boot);
    });
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
  sdk.onload = function () {
    var webApp = window.Telegram && window.Telegram.WebApp;
    if (!webApp || !webApp.initData) {
      showLanding();
      return;
    }
    settled = true;
    window.clearTimeout(timeout);
    loadMiniApp();
  };
  sdk.onerror = showLanding;
  document.head.appendChild(sdk);
})();
