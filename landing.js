(function () {
  "use strict";

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  var header = document.querySelector("[data-header]");
  var menuButton = document.querySelector(".menu-toggle");
  var navigation = document.querySelector(".site-nav");
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
  var attribution = window.MindCoachAttribution;
  var campaignSource = attribution
    ? attribution.sourceFromSearch(window.location.search)
    : "landing";
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
    var placement = link.dataset.cta;
    if (attribution) {
      link.href = attribution.telegramUrl(link.href, campaignSource, placement);
    }
    link.addEventListener("click", function () {
      track("telegram_transition", {
        location: placement,
        source: campaignSource,
      });
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

  window.addEventListener(
    "resize",
    function () {
      if (window.innerWidth > 760) closeMenu();
      scheduleViewportUpdate();
    },
    { passive: true },
  );
})();
