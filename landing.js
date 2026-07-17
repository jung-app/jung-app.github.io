(function () {
  "use strict";

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  var header = document.querySelector("[data-header]");
  var menuButton = document.querySelector(".menu-toggle");
  var navigation = document.querySelector(".site-nav");
  var heroVisual = document.querySelector("[data-hero-visual]");

  function track(eventName, details) {
    var payload = Object.assign({ event: eventName }, details || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    window.dispatchEvent(
      new CustomEvent("mindcoach:analytics", { detail: payload }),
    );
  }

  function setHeaderState() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  function closeMenu() {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute("aria-label", "Открыть меню");
    menuButton.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  }

  if (menuButton && navigation) {
    menuButton.addEventListener("click", function () {
      var willOpen = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute(
        "aria-label",
        willOpen ? "Закрыть меню" : "Открыть меню",
      );
      menuButton.setAttribute("aria-expanded", String(willOpen));
      navigation.classList.toggle("is-open", willOpen);
      document.body.classList.toggle("menu-open", willOpen);
    });
    navigation.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  window.addEventListener("scroll", setHeaderState, { passive: true });
  setHeaderState();

  document.querySelectorAll("[data-cta]").forEach(function (link) {
    link.addEventListener("click", function () {
      track("telegram_transition", { location: link.dataset.cta });
    });
  });

  document.querySelectorAll(".faq details").forEach(function (item, index) {
    item.addEventListener("toggle", function () {
      if (item.open) track("faq_open", { item: index + 1 });
    });
  });

  if ("IntersectionObserver" in window) {
    var viewed = new WeakSet();
    var viewObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !viewed.has(entry.target)) {
            viewed.add(entry.target);
            track(entry.target.dataset.trackView);
            viewObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 },
    );
    document.querySelectorAll("[data-track-view]").forEach(function (section) {
      viewObserver.observe(section);
    });

    if (heroVisual) {
      var motionObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            heroVisual.style.setProperty(
              "--motion-state",
              entry.isIntersecting ? "running" : "paused",
            );
          });
        },
        { threshold: 0.05 },
      );
      motionObserver.observe(heroVisual);
    }
  }

  track("hero_view");

  if (
    heroVisual &&
    !reducedMotion &&
    window.matchMedia("(pointer: fine)").matches
  ) {
    var frame = 0;
    heroVisual.addEventListener("pointermove", function (event) {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function () {
        var bounds = heroVisual.getBoundingClientRect();
        var x = (event.clientX - bounds.left) / bounds.width - 0.5;
        var y = (event.clientY - bounds.top) / bounds.height - 0.5;
        heroVisual.style.setProperty("--ry", (x * 9).toFixed(2) + "deg");
        heroVisual.style.setProperty("--rx", (-y * 7).toFixed(2) + "deg");
      });
    });
    heroVisual.addEventListener("pointerleave", function () {
      heroVisual.style.setProperty("--ry", "5deg");
      heroVisual.style.setProperty("--rx", "-4deg");
    });
  }

  function drawConstellation() {
    var canvas = document.getElementById("constellation");
    if (!canvas || reducedMotion) return;
    var context = canvas.getContext("2d", { alpha: true });
    if (!context) return;
    var ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    var width = window.innerWidth;
    var height = window.innerHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    var count = Math.min(44, Math.max(20, Math.round(width / 34)));
    var points = [];
    var seed = 7307;
    function random() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }
    for (var i = 0; i < count; i += 1) {
      points.push({
        x: random() * width,
        y: random() * height,
        r: random() * 1.1 + 0.35,
      });
    }
    context.lineWidth = 0.45;
    points.forEach(function (point, index) {
      context.fillStyle =
        index % 7 === 0 ? "rgba(239,199,123,.42)" : "rgba(191,207,226,.25)";
      context.beginPath();
      context.arc(point.x, point.y, point.r, 0, Math.PI * 2);
      context.fill();
      for (var j = index + 1; j < points.length; j += 1) {
        var other = points[j];
        var distance = Math.hypot(point.x - other.x, point.y - other.y);
        if (distance < 128) {
          context.strokeStyle =
            "rgba(155,177,202," +
            ((1 - distance / 128) * 0.075).toFixed(3) +
            ")";
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
      }
    });
  }

  var resizeTimer;
  window.addEventListener(
    "resize",
    function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(drawConstellation, 120);
      if (window.innerWidth > 760) closeMenu();
    },
    { passive: true },
  );
  drawConstellation();
})();
