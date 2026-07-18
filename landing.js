(function () {
  "use strict";

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  var header = document.querySelector("[data-header]");
  var menuButton = document.querySelector(".menu-toggle");
  var navigation = document.querySelector(".site-nav");
  var heroVisual = document.querySelector("[data-hero-visual]");
  var heroSection = document.querySelector(".hero");
  var finalSection = document.querySelector(".final-cta");
  var mobileCta = document.querySelector("[data-mobile-cta]");
  var journeySection = document.querySelector("[data-journey]");
  var journeySteps = document.querySelector(".journey-steps");
  var journeyItems = journeySteps
    ? Array.prototype.slice.call(
        journeySteps.querySelectorAll("[data-journey-step]"),
      )
    : [];
  var journeyCount = document.querySelector("[data-journey-count]");
  var mobileCtaState = { heroVisible: true, finalVisible: false };
  var scrollFrame = 0;

  function updateMobileCta() {
    if (!mobileCta) return;
    var menuIsOpen = document.body.classList.contains("menu-open");
    var shouldShow =
      !mobileCtaState.heroVisible && !mobileCtaState.finalVisible && !menuIsOpen;
    mobileCta.classList.toggle("is-visible", shouldShow);
    mobileCta.setAttribute("aria-hidden", String(!shouldShow));
    mobileCta.tabIndex = shouldShow ? 0 : -1;
  }

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
    if (mobileCta && heroSection && finalSection) {
      mobileCtaState.heroVisible =
        heroSection.getBoundingClientRect().bottom > 0;
      mobileCtaState.finalVisible =
        finalSection.getBoundingClientRect().top <= window.innerHeight;
      updateMobileCta();
    }
  }

  function updateScrollMotion() {
    if (!reducedMotion && heroVisual && heroSection) {
      var heroBounds = heroSection.getBoundingClientRect();
      var heroProgress = Math.max(
        0,
        Math.min(1, -heroBounds.top / Math.max(heroBounds.height, 1)),
      );
      heroVisual.style.setProperty(
        "--sy",
        (heroProgress * 22).toFixed(1) + "px",
      );
    }

    if (!journeySection || !journeySteps || !journeyItems.length) return;
    var journeyBounds = journeySteps.getBoundingClientRect();
    var viewportAnchor = window.innerHeight * 0.52;
    var journeyProgress = Math.max(
      0,
      Math.min(
        1,
        (viewportAnchor - journeyBounds.top) /
          Math.max(journeyBounds.height - 64, 1),
      ),
    );
    journeySection.style.setProperty(
      "--journey-progress",
      journeyProgress.toFixed(4),
    );
    journeySection.style.setProperty(
      "--journey-shift",
      (journeyProgress * 160 - 80).toFixed(1) + "px",
    );
    journeySteps.style.setProperty(
      "--journey-progress",
      journeyProgress.toFixed(4),
    );

    var activeIndex = 0;
    var closestDistance = Infinity;
    journeyItems.forEach(function (item, index) {
      var itemBounds = item.getBoundingClientRect();
      var distance = Math.abs(
        itemBounds.top + Math.min(itemBounds.height, 64) / 2 - viewportAnchor,
      );
      if (distance < closestDistance) {
        closestDistance = distance;
        activeIndex = index;
      }
    });
    journeyItems.forEach(function (item, index) {
      item.classList.toggle("is-active", index === activeIndex);
      item.classList.toggle("is-complete", index < activeIndex);
    });
    if (journeyCount) {
      journeyCount.textContent =
        String(activeIndex + 1).padStart(2, "0") +
        " / " +
        String(journeyItems.length).padStart(2, "0");
    }
  }

  function scheduleViewportUpdate() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(function () {
      scrollFrame = 0;
      setHeaderState();
      updateScrollMotion();
    });
  }

  function closeMenu() {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute("aria-label", "Открыть меню");
    menuButton.setAttribute("aria-expanded", "false");
    navigation.classList.remove("is-open");
    document.body.classList.remove("menu-open");
    updateMobileCta();
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
      updateMobileCta();
    });
    navigation.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeMenu();
    });
  }

  if (journeySteps && !reducedMotion) journeySteps.classList.add("has-motion");
  window.addEventListener("scroll", scheduleViewportUpdate, { passive: true });
  scheduleViewportUpdate();

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

    if (mobileCta && heroSection && finalSection) {
      var mobileCtaObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.target === heroSection) {
              mobileCtaState.heroVisible = entry.isIntersecting;
            }
            if (entry.target === finalSection) {
              mobileCtaState.finalVisible =
                entry.isIntersecting || entry.boundingClientRect.top < 0;
            }
          });
          updateMobileCta();
        },
        { threshold: 0.04 },
      );
      mobileCtaObserver.observe(heroSection);
      mobileCtaObserver.observe(finalSection);
    }
  }

  updateMobileCta();

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
      scheduleViewportUpdate();
    },
    { passive: true },
  );
  drawConstellation();
})();
