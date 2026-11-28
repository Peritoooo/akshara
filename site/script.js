(() => {
  const header = document.querySelector(".site-header");
  const toggle = document.querySelector(".nav-toggle");
  const navLinks = document.getElementById("nav-links");

  const onScroll = () => header?.classList.toggle("scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  toggle?.addEventListener("click", () => {
    const open = header.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });

  navLinks?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      header?.classList.remove("nav-open");
      toggle?.setAttribute("aria-expanded", "false");
      toggle?.setAttribute("aria-label", "Open menu");
    });
  });

  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* -------------------------------------------------------------
     Download links
     The release page is the fallback; if the GitHub API answers,
     the buttons point straight at the current installers.
  ------------------------------------------------------------- */
  const api = "https://api.github.com/repos/Peritoooo/akshara/releases/latest";
  const hero = document.getElementById("hero-download");
  const heroLabel = hero?.querySelector("span");

  const platform = (() => {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return "win";
    if (/Macintosh|Mac OS X/i.test(ua)) return "mac";
    if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return "linux";
    return null;
  })();

  const heroLabels = {
    win: "Download for Windows",
    mac: "Download for macOS",
    linux: "Download for Linux",
  };
  if (heroLabel && platform && heroLabels[platform]) {
    heroLabel.textContent = heroLabels[platform];
  }

  fetch(api, { headers: { Accept: "application/vnd.github+json" } })
    .then((response) => (response.ok ? response.json() : null))
    .then((release) => {
      if (!release) return;

      const urls = {};
      for (const asset of release.assets || []) {
        const name = asset.name || "";
        if (name.endsWith("-setup.exe")) urls.win = asset.browser_download_url;
        else if (name.endsWith("-arm64.dmg")) urls.macArm = asset.browser_download_url;
        else if (name.endsWith("-x64.dmg")) urls.macIntel = asset.browser_download_url;
        else if (name.endsWith(".AppImage")) urls.appimage = asset.browser_download_url;
        else if (name.endsWith("_amd64.deb")) urls.deb = asset.browser_download_url;
      }

      document.querySelectorAll("[data-download]").forEach((link) => {
        const url = urls[link.dataset.download];
        if (url) link.href = url;
      });

      if (release.tag_name) {
        const version = release.tag_name.replace(/^v/, "");
        document.querySelectorAll("[data-version]").forEach((el) => {
          el.textContent = version;
        });
      }

      // A direct download is only offered where the architecture is certain.
      if (hero) {
        if (platform === "win" && urls.win) hero.href = urls.win;
        else if (platform === "linux" && urls.appimage) hero.href = urls.appimage;
        else hero.href = "#download";
      }
    })
    .catch(() => {
      /* Offline or rate-limited: every link still points at Releases. */
    });

  /* -------------------------------------------------------------
     Screenshot lightbox
  ------------------------------------------------------------- */
  const dialog = document.getElementById("lightbox");
  if (dialog && typeof dialog.showModal === "function") {
    const preview = dialog.querySelector("img");
    const close = dialog.querySelector(".dialog-close");

    document.querySelectorAll(".shot-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const source = button.querySelector("img");
        preview.src = button.dataset.full;
        preview.alt = source?.alt || "Akshara screenshot";
        dialog.showModal();
      });
    });

    close?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  /* -------------------------------------------------------------
     Gentle reveal on scroll
  ------------------------------------------------------------- */
  const items = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if ("IntersectionObserver" in window && !reduceMotion) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    items.forEach((item) => observer.observe(item));
  } else {
    items.forEach((item) => item.classList.add("is-visible"));
  }
})();
