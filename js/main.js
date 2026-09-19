(() => {
  "use strict";

  const nav = document.getElementById("nav");
  const yearEl = document.getElementById("year");
  const copyEmailBtn = document.getElementById("copyEmailBtn");
  const toast = document.getElementById("toast");
  const scrollSentinel = document.getElementById("scrollSentinel");

  if (yearEl) yearEl.textContent = new Date().getFullYear();

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
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
