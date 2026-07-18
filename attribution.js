(function (root, factory) {
  "use strict";

  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.MindCoachAttribution = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DEFAULT_SOURCE = "landing";
  var SOURCE_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
  var PLACEMENT_RE = /^[a-z0-9][a-z0-9_]{0,13}$/;

  function sourceFromSearch(search) {
    var candidate = new URLSearchParams(search || "").get("src");
    candidate = (candidate || "").trim().toLowerCase();
    return SOURCE_RE.test(candidate) ? candidate : DEFAULT_SOURCE;
  }

  function sourceForPlacement(source, placement) {
    var safeSource = SOURCE_RE.test(source || "") ? source : DEFAULT_SOURCE;
    var safePlacement = PLACEMENT_RE.test(placement || "")
      ? placement
      : "unknown";
    return safeSource + "__" + safePlacement;
  }

  function telegramUrl(currentHref, source, placement) {
    var url = new URL(currentHref);
    url.searchParams.set(
      "start",
      "src_" + sourceForPlacement(source, placement),
    );
    return url.toString();
  }

  return {
    sourceFromSearch: sourceFromSearch,
    sourceForPlacement: sourceForPlacement,
    telegramUrl: telegramUrl,
  };
});
