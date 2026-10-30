(() => {
  const KEY = "hangdoi_media_career_benefit_popup_v1";
  const TTL = 7 * 24 * 60 * 60 * 1000;
  const FORCE = new URLSearchParams(location.search).get("career_popup") === "1";
  const overlay = document.getElementById("careerBenefitPopup");
  if (!overlay) return;

  const modal = overlay.querySelector(".career-benefit-modal");
  const close = overlay.querySelector("[data-career-popup-close]");
  const actions = overlay.querySelectorAll("[data-career-popup-action]");
  let lastFocus = null;

  function recentlySeen() {
    if (FORCE) return false;
    try {
      const seenAt = Number(localStorage.getItem(KEY) || 0);
      return seenAt > 0 && Date.now() - seenAt < TTL;
    } catch {
      return false;
    }
  }

  function markSeen() {
    try { localStorage.setItem(KEY, String(Date.now())); } catch {}
  }

  function openPopup() {
    if (recentlySeen()) return;
    lastFocus = document.activeElement;
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("career-benefit-lock");
    requestAnimationFrame(() => close?.focus({ preventScroll: true }));
  }

  function closePopup(mark = true) {
    if (!overlay.classList.contains("is-open")) return;
    if (mark) markSeen();
    overlay.classList.remove("is-open");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("career-benefit-lock");
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus({ preventScroll: true });
    }
  }

  close?.addEventListener("click", () => closePopup(true));
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) closePopup(true);
  });
  modal?.addEventListener("click", (event) => event.stopPropagation());
  actions.forEach((action) => action.addEventListener("click", markSeen));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && overlay.classList.contains("is-open")) {
      closePopup(true);
    }
  });

  window.setTimeout(openPopup, FORCE ? 80 : 850);
})();
