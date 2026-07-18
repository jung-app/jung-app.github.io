(function () {
  "use strict";

  var version = Date.now();
  var config = document.createElement("script");
  config.src = "./config.js?v=" + version;
  config.onload = function () {
    var app = document.createElement("script");
    app.src = "./app.js?v=" + version;
    document.body.appendChild(app);
  };
  document.body.appendChild(config);
})();
