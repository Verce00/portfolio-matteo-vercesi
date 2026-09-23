(() => {
  "use strict";

  const nav = document.getElementById("nav");
  const yearEl = document.getElementById("year");
  const copyEmailBtn = document.getElementById("copyEmailBtn");
  const toast = document.getElementById("toast");
  const scrollSentinel = document.getElementById("scrollSentinel");

  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Hero background: a canvas dot grid - the literal structure every
     layout on this site is built on - that lights up near the pointer,
     plus a small ring that trails it with a short lag. One shared
     pointer position drives both, so they read as one system instead
     of two unrelated effects. Redrawn only on pointermove/resize (no
     idle render loop), so it costs nothing while the mouse is still;
     the trailing ring is the one piece that needs a continuous loop,
     and that loop only runs while the pointer is actually inside the
     hero. */
  const heroEl = document.querySelector(".hero");
  const gridCanvas = document.getElementById("heroGrid");
  const cursorEl = document.getElementById("heroCursor");

  if (heroEl && gridCanvas) {
    const ctx = gridCanvas.getContext("2d");
    const SPACING = 34;
    const RADIUS_BASE = 1.1;
    const RADIUS_MAX = 3.8;
    const REACH = 210;
    const ACCENT = [37, 84, 209];
    const BASE = [20, 19, 15];

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let pointer = null;
    let resizeRAF = null;

    function resizeGrid() {
      const rect = heroEl.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      gridCanvas.width = Math.round(width * dpr);
      gridCanvas.height = Math.round(height * dpr);
      gridCanvas.style.width = `${width}px`;
      gridCanvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGrid();
    }

    /* Three layers, not one: faint structural lines (the "blueprint" a
       layout grid actually is), a proximity mesh that only appears
       between neighboring dots the pointer is close to (a constellation
       forming and dissolving as you move, not just isolated dots
       glowing in place), and the dots themselves on top as the mesh's
       own nodes. */
    function drawGrid() {
      ctx.clearRect(0, 0, width, height);
      const cols = Math.ceil(width / SPACING) + 1;
      const rows = Math.ceil(height / SPACING) + 1;

      ctx.strokeStyle = "rgba(20, 19, 15, 0.05)";
      ctx.lineWidth = 1;
      for (let i = 0; i < cols; i++) {
        const x = i * SPACING;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let j = 0; j < rows; j++) {
        const y = j * SPACING;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const t = [];
      for (let i = 0; i < cols; i++) {
        t[i] = [];
        for (let j = 0; j < rows; j++) {
          let val = 0;
          if (pointer) {
            const dx = i * SPACING - pointer.x;
            const dy = j * SPACING - pointer.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < REACH) val = 1 - dist / REACH;
          }
          t[i][j] = val;
        }
      }

      if (pointer) {
        ctx.lineWidth = 1;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const tv = t[i][j];
            if (tv <= 0) continue;
            const x = i * SPACING;
            const y = j * SPACING;
            if (i + 1 < cols && t[i + 1][j] > 0) {
              ctx.strokeStyle = `rgba(37, 84, 209, ${Math.min(tv, t[i + 1][j]) * 0.55})`;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x + SPACING, y);
              ctx.stroke();
            }
            if (j + 1 < rows && t[i][j + 1] > 0) {
              ctx.strokeStyle = `rgba(37, 84, 209, ${Math.min(tv, t[i][j + 1]) * 0.55})`;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x, y + SPACING);
              ctx.stroke();
            }
          }
        }
      }

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const tv = t[i][j];
          const radius = RADIUS_BASE + (RADIUS_MAX - RADIUS_BASE) * tv;
          const alpha = 0.14 + 0.7 * tv;
          const color = tv > 0 ? ACCENT : BASE;
          ctx.beginPath();
          ctx.arc(i * SPACING, j * SPACING, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
          ctx.fill();
        }
      }
    }

    let drawRAF = null;
    function scheduleDraw() {
      if (drawRAF) return;
      drawRAF = requestAnimationFrame(() => {
        drawRAF = null;
        drawGrid();
      });
    }

    resizeGrid();

    window.addEventListener(
      "resize",
      () => {
        if (resizeRAF) return;
        resizeRAF = requestAnimationFrame(() => {
          resizeRAF = null;
          dpr = Math.min(window.devicePixelRatio || 1, 2);
          resizeGrid();
        });
      },
      { passive: true }
    );

    /* Touch has no real cursor - a finger dragged across the hero (e.g.
       mid-scroll) still fires pointermove, and without this check the
       grid would glow and the ring would trail the finger like a stuck
       ghost cursor. Real hover + a fine pointer (mouse/trackpad) only. */
    const hasHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (hasHover && !prefersReducedMotion) {
      /* Trailing cursor ring: eased toward the real pointer every frame
         (a plain "snap to position" read as jittery/broken at 60fps for
         something meant to feel alive) - the loop only runs while the
         pointer is inside the hero, started on enter and cancelled on
         leave rather than running site-wide. */
      let targetX = 0;
      let targetY = 0;
      let curX = 0;
      let curY = 0;
      let cursorRAF = null;

      function tickCursor() {
        curX += (targetX - curX) * 0.18;
        curY += (targetY - curY) * 0.18;
        if (cursorEl) {
          cursorEl.style.setProperty("--cx", `${curX}px`);
          cursorEl.style.setProperty("--cy", `${curY}px`);
        }
        cursorRAF = requestAnimationFrame(tickCursor);
      }

      heroEl.addEventListener("pointermove", (e) => {
        const rect = heroEl.getBoundingClientRect();
        pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        scheduleDraw();
        targetX = pointer.x;
        targetY = pointer.y;
      });

      heroEl.addEventListener("pointerenter", () => {
        if (cursorEl) cursorEl.classList.add("is-active");
        if (!cursorRAF) tickCursor();
      });

      heroEl.addEventListener("pointerleave", () => {
        pointer = null;
        scheduleDraw();
        if (cursorEl) cursorEl.classList.remove("is-active");
        if (cursorRAF) {
          cancelAnimationFrame(cursorRAF);
          cursorRAF = null;
        }
      });
    } else if (hasHover) {
      heroEl.addEventListener("pointermove", (e) => {
        const rect = heroEl.getBoundingClientRect();
        pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        scheduleDraw();
      });
      heroEl.addEventListener("pointerleave", () => {
        pointer = null;
        scheduleDraw();
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
