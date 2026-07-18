(function () {
  "use strict";

  function showLanding() {
    window.location.replace(
      "./landing.html" + window.location.search + window.location.hash,
    );
  }

  try {
    var webApp = window.Telegram && window.Telegram.WebApp;
    if (!webApp || !webApp.initData) showLanding();
  } catch (_error) {
    showLanding();
  }
})();
