(() => {
  "use strict";

  const nav = document.getElementById("nav");
  const yearEl = document.getElementById("year");
  const copyEmailBtn = document.getElementById("copyEmailBtn");
  const toast = document.getElementById("toast");
  const scrollSentinel = document.getElementById("scrollSentinel");

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Page background (home page only): the logo is a stylized black
     hole, so the whole page sits over one - a field of stars drifting
     on their own, pulled into orbit and swallowed when they stray too
     close to the pointer (the event horizon), then reborn elsewhere.
     Fixed to the viewport, not scoped to the hero, so it stays behind
     every section as the page scrolls. The pointer position (anywhere
     in the document, not just the hero) drives both the physics here
     and the .hero__cursor element in CSS. The animation loop pauses
     only when the tab itself is hidden - it's meant to be visible
     everywhere on this page, not just near the top. */
  const spaceCanvas = document.getElementById("heroSpace");
  const cursorEl = document.getElementById("heroCursor");

  if (spaceCanvas) {
    const ctx = spaceCanvas.getContext("2d");
    const hasHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const STAR_DENSITY = 0.00013;
    const MIN_STARS = 55;
    const PULL_REACH = 220;
    const CAPTURE_RADIUS = 16;
    const DRIFT_SPEED = 0.15;
    const ACCENT = [125, 160, 255];
    const BASE = [237, 238, 242];

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let particles = [];
    let pointer = null;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    let resizeRAF = null;
    let rafId = null;
    let onScreen = false;

    function makeParticle() {
      const angle = Math.random() * Math.PI * 2;
      const speed = DRIFT_SPEED * (0.4 + Math.random() * 0.8);
      /* ~1 in 6 stars is a "bright" one - bigger, more opaque, and the
         only ones that glow at rest (see renderFrame) - a galaxy has a
         handful of prominent stars among a lot of faint ones, not a
         uniform field of identical dots. */
      const bright = Math.random() < 0.16;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: bright ? 1.5 + Math.random() * 1.3 : 0.6 + Math.random() * 1,
        baseAlpha: bright ? 0.55 + Math.random() * 0.35 : 0.14 + Math.random() * 0.28,
        bright,
      };
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      spaceCanvas.width = Math.round(width * dpr);
      spaceCanvas.height = Math.round(height * dpr);
      spaceCanvas.style.width = `${width}px`;
      spaceCanvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(MIN_STARS, Math.round(width * height * STAR_DENSITY));
      particles = Array.from({ length: count }, makeParticle);
      renderFrame();
    }

    function renderFrame() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (pointer) {
          const dx = curX - p.x;
          const dy = curY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
          if (dist < CAPTURE_RADIUS) {
            particles[i] = makeParticle();
            continue;
          }
          if (dist < PULL_REACH) {
            const pull = 1 - dist / PULL_REACH;
            const nx = dx / dist;
            const ny = dy / dist;
            /* Radial pull plus a perpendicular component - matter
               spiraling into a black hole, not just falling straight
               at it. */
            p.vx += nx * pull * 0.55 - ny * pull * 0.3;
            p.vy += ny * pull * 0.55 + nx * pull * 0.3;
          }
        }

        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        else if (p.y > height + 10) p.y = -10;

        const speed = Math.min(1, Math.hypot(p.vx, p.vy) / 2.2);
        const alpha = Math.min(1, p.baseAlpha + speed * 0.55);
        const isPulled = speed > 0.22;
        const color = isPulled ? ACCENT : BASE;
        const coreR = p.r + speed * 1.3;

        /* Bright stars glow even at rest; any star caught in the pull
           glows too (heating up as it falls in) - a radial-gradient
           halo instead of ctx.filter blur, which is far cheaper to
           redraw every frame across a whole field of particles. */
        if (p.bright || isPulled) {
          const glowR = coreR * (p.bright && isPulled ? 6 : 4.5);
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
          glow.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha * 0.45})`);
          glow.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
          ctx.beginPath();
          ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
          ctx.fillStyle = glow;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
        ctx.fill();
      }
    }

    function tick() {
      if (pointer) {
        curX += (targetX - curX) * 0.16;
        curY += (targetY - curY) * 0.16;
        if (cursorEl) {
          cursorEl.style.setProperty("--cx", `${curX}px`);
          cursorEl.style.setProperty("--cy", `${curY}px`);
        }
      }
      renderFrame();
      if (onScreen && !prefersReducedMotion) rafId = requestAnimationFrame(tick);
    }

    function start() {
      onScreen = true;
      if (!rafId && !prefersReducedMotion) rafId = requestAnimationFrame(tick);
    }

    function stop() {
      onScreen = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    resize();

    window.addEventListener(
      "resize",
      () => {
        if (resizeRAF) return;
        resizeRAF = requestAnimationFrame(() => {
          resizeRAF = null;
          dpr = Math.min(window.devicePixelRatio || 1, 2);
          resize();
        });
      },
      { passive: true }
    );

    if (!prefersReducedMotion) {
      start();
      /* Only real reason to stop redrawing something that's always on
         screen: the tab itself isn't visible. */
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) stop();
        else start();
      });
    }

    /* Touch has no real cursor - a finger dragged anywhere on the page
       (e.g. mid-scroll) still fires pointermove, and without this check
       every swipe would yank stars around like a stuck ghost cursor.
       Real hover + a fine pointer (mouse/trackpad) only. Listens on the
       document, not the hero, so the pull follows you the whole way
       down the page. */
    if (hasHover && !prefersReducedMotion) {
      document.addEventListener("pointermove", (e) => {
        pointer = { x: e.clientX, y: e.clientY };
        targetX = pointer.x;
        targetY = pointer.y;
        if (cursorEl) cursorEl.classList.add("is-active");
      });

      document.addEventListener("pointerleave", () => {
        pointer = null;
        if (cursorEl) cursorEl.classList.remove("is-active");
      });
    }
  }

  /* Equal-height project bands: each project's own image aspect ratio
     (Tacta's square shot, Revo Bike's wide 2:1, Macinà's own proportions)
     naturally produces a different content height at any given viewport
     width, and no single CSS clamp() can track "whatever the tallest one
     needs" across every width - measuring the tallest block's actual
     rendered height and applying it to the rest is the only way to
     guarantee they match exactly. */
  const productBlocks = document.querySelectorAll(".product-block");
  if (productBlocks.length > 1) {
    const equalizeProductBlocks = () => {
      productBlocks.forEach((el) => {
        el.style.minHeight = "";
      });
      const tallest = Math.max(...Array.from(productBlocks, (el) => el.getBoundingClientRect().height));
      productBlocks.forEach((el) => {
        el.style.minHeight = `${tallest}px`;
      });
    };

    equalizeProductBlocks();

    // Images are lazy-loaded - re-measure once each has actually loaded,
    // since a not-yet-loaded image reports the wrong (smaller) height.
    productBlocks.forEach((block) => {
      block.querySelectorAll("img").forEach((img) => {
        if (!img.complete) img.addEventListener("load", equalizeProductBlocks, { once: true });
      });
    });

    let blockResizeRAF = null;
    window.addEventListener(
      "resize",
      () => {
        if (blockResizeRAF !== null) return;
        blockResizeRAF = requestAnimationFrame(() => {
          blockResizeRAF = null;
          equalizeProductBlocks();
        });
      },
      { passive: true }
    );
  }

  /* Navbar theme: which dark section (if any) is currently behind the bar,
     via IntersectionObserver instead of polling elementFromPoint on every
     scroll event. That earlier approach - even rAF-throttled - still ran
     from a scroll listener, and iOS Safari deprioritizes main-thread JS
     during momentum/fling scrolling to keep the scroll itself smooth, so
     the color flip visibly lagged behind the real position on a phone,
     worst right at the tall hero's own boundary. IntersectionObserver
     callbacks are scheduled by the browser's own rendering pipeline, not
     the scroll-event queue, so they keep up during a fling instead of
     queuing up behind it.

     rootMargin collapses the observed viewport down to a 1px line right
     at the bar's own bottom edge, so a target only (re)fires exactly when
     its own edge crosses that line - not merely whenever it's somewhere
     in view, which for a tall section (the full-height hero, easily) can
     span a huge scroll range with no new crossing at all. Pixel margins
     don't auto-rescale on resize the way percentages would, so the
     observer is rebuilt on resize with freshly computed values instead. */
  const darkSections = document.querySelectorAll(".theme-dark");
  if (darkSections.length) {
    const onScreenDark = new Set();
    const navHeight = 44;
    let darkIO = null;

    const buildObserver = () => {
      if (darkIO) darkIO.disconnect();
      onScreenDark.clear();
      const bottomMargin = Math.max(0, window.innerHeight - navHeight - 1);
      darkIO = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) onScreenDark.add(entry.target);
            else onScreenDark.delete(entry.target);
          });
          nav.classList.toggle("nav--on-dark", onScreenDark.size > 0);
        },
        { rootMargin: `-${navHeight}px 0px -${bottomMargin}px 0px`, threshold: 0 }
      );
      darkSections.forEach((el) => darkIO.observe(el));
    };

    buildObserver();

    let resizeRAF = null;
    window.addEventListener(
      "resize",
      () => {
        if (resizeRAF !== null) return;
        resizeRAF = requestAnimationFrame(() => {
          resizeRAF = null;
          buildObserver();
        });
      },
      { passive: true }
    );
  }

  /* Project pages only (scrollSentinel only exists there): the navbar
     slides away once the page is scrolled past its very top - an
     IntersectionObserver on a 1px sentinel at the top of the page instead
     of a scroll listener, for the same iOS momentum-scroll responsiveness
     reason as the dark-section observer above. */
  if (scrollSentinel && nav) {
    const scrollIO = new IntersectionObserver(
      (entries) => {
        nav.classList.toggle("is-hidden", !entries[0].isIntersecting);
      },
      { threshold: 0 }
    );
    scrollIO.observe(scrollSentinel);
  }

  /* Scroll reveal */
  const revealEls = document.querySelectorAll(".reveal");

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  }

  /* Copy email to clipboard, with graceful fallback to the mailto default */
  if (copyEmailBtn) {
    copyEmailBtn.addEventListener("click", async (e) => {
      const email = "matteo.vercesi05@gmail.com";
      if (!navigator.clipboard) return; // let the mailto: link proceed
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(email);
        showToast();
      } catch (err) {
        window.location.href = `mailto:${email}`;
      }
    });
  }

  function showToast() {
    if (!toast) return;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 2200);
  }

})();
