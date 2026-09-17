(() => {
  "use strict";

  const track = document.getElementById("carouselTrack");
  const dotsContainer = document.getElementById("carouselDots");
  if (!track || !dotsContainer) return;

  const cards = Array.from(track.querySelectorAll(".carousel__card"));
  const dots = Array.from(dotsContainer.querySelectorAll(".carousel__dot"));

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      cards[i].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
  });

  /* Which card counts as "active" is a scroll-position question, not a
     click-tracking one - an IntersectionObserver on the scroll container
     answers that without any manual scroll-math. Adjacent cards can both
     cross a single threshold at once (e.g. at rest, before any scroll, with
     neither card fully clear of the other) - tracking each card's own
     ratio and picking the single highest one avoids flip-flopping between
     "last entry in this batch" instead of "most visible card". */
  const ratios = new Map(cards.map((card) => [card, 0]));
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => ratios.set(entry.target, entry.intersectionRatio));
      let best = cards[0];
      cards.forEach((card) => {
        if (ratios.get(card) > ratios.get(best)) best = card;
      });
      const index = cards.indexOf(best);
      dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
    },
    { root: track, threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] }
  );
  cards.forEach((card) => io.observe(card));
})();

/* Scroll-scrubbed detail video (Tacta only): a separate IIFE, not tacked
   onto the one above, since that one returns early when the carousel
   isn't present - this must still run on pages that do have it. */
(() => {
  "use strict";

  const stage = document.getElementById("tactaScrollVid");
  const canvas = document.getElementById("tactaScrollVidCanvas");
  const caption = document.getElementById("tactaScrollVidCaption");
  if (!stage || !canvas) return;

  const frameCount = parseInt(stage.dataset.frameCount, 10);
  const frameBase = stage.dataset.frameBase;
  const ctx = canvas.getContext("2d");

  const frames = new Array(frameCount);
  let framesRequested = false;

  /* Deferred until the section is actually approaching (see the
     IntersectionObserver below) instead of firing all 45 requests
     (15MB) the instant the page loads, competing with the hero image
     and everything else above it for bandwidth. */
  function requestFrames() {
    if (framesRequested) return;
    framesRequested = true;
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.src = `${frameBase}${String(i + 1).padStart(4, "0")}.webp`;
      frames[i] = img;
    }
    frames[0].addEventListener("load", () => drawFrame(0));
  }

  /* Capped at 2x: a 1600px-wide source frame upscaled past 2x would just
     blur, not sharpen, so there's nothing to gain chasing a higher device
     ratio - only more canvas pixels to paint every frame. */
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
  }

  /* Cover-fit draw (scale to fill, crop overflow) so the sequence reads
     as a full-bleed shot regardless of viewport aspect ratio, the same
     as the source frames' own compositions intend. */
  function drawFrame(index) {
    let img = frames[index];
    if (!img) return; // frames not requested yet (section never reached)
    if (!img.complete || !img.naturalWidth) {
      // Sequence still loading: fall back to the nearest already-loaded
      // frame instead of leaving the canvas blank mid-scrub.
      let fallback = null;
      for (let d = 1; d < frameCount && !fallback; d++) {
        const lo = frames[index - d];
        const hi = frames[index + d];
        if (lo && lo.complete && lo.naturalWidth) fallback = lo;
        else if (hi && hi.complete && hi.naturalWidth) fallback = hi;
      }
      if (!fallback) return;
      img = fallback;
    }
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  /* Scroll position -> frame index needs the actual scroll offset (not
     just "is this in view"), so unlike the rest of this codebase's
     scroll-driven UI this can't be an IntersectionObserver by itself -
     it's a rAF-throttled scroll listener, the same pattern apple.com's
     own scroll-scrubbed sections use. */
  let lastIndex = -1;
  let revealed = 0;
  let ticking = false;

  /* Caption fully revealed 18% into the scrub, then holds - it's a single
     piece of supporting copy, not a multi-beat callout, so there's no
     later point where it needs to fade back out again. */
  const REVEAL_BY = 0.18;

  function update() {
    ticking = false;
    const rect = stage.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;

    /* Forward-only: the frame only advances while scrolling down.
       Scrolling back up doesn't rewind it - it holds the furthest frame
       already reached, like a recording rather than a live scroll-position
       readout (apple.com's own scroll videos behave the same way). Since
       progress only grows on the way down, just never letting the index
       (or the caption reveal below) decrease is enough - no separate
       scroll-direction tracking needed. */
    const index = Math.round(progress * (frameCount - 1));
    if (index > lastIndex) {
      lastIndex = index;
      drawFrame(index);
    }

    const nextRevealed = Math.min(1, progress / REVEAL_BY);
    if (caption && nextRevealed > revealed) {
      revealed = nextRevealed;
      caption.style.opacity = String(revealed);
      caption.style.transform = `translateY(${(1 - revealed) * 16}px)`;
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  resizeCanvas();

  /* The scroll listener above only needs to run while this section is
     anywhere near the viewport - left attached for the page's whole
     scroll lifetime, it forces a layout read (getBoundingClientRect) on
     every scroll frame site-wide, long after the user has scrolled past
     it, which is exactly the kind of scroll-listener cost the rest of
     this codebase avoids via IntersectionObserver elsewhere. A generous
     rootMargin both attaches the listener and starts the frame downloads
     a little before the section is actually reached, instead of doing
     either abruptly right at its edge. */
  let active = false;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !active) {
        active = true;
        requestFrames();
        window.addEventListener("scroll", onScroll, { passive: true });
        update();
      } else if (!entries[0].isIntersecting && active) {
        active = false;
        window.removeEventListener("scroll", onScroll);
      }
    },
    { rootMargin: "50% 0px 50% 0px" }
  );
  io.observe(stage);

  let resizeRAF = null;
  window.addEventListener(
    "resize",
    () => {
      if (resizeRAF !== null) return;
      resizeRAF = requestAnimationFrame(() => {
        resizeRAF = null;
        resizeCanvas();
        drawFrame(Math.max(0, lastIndex));
      });
    },
    { passive: true }
  );
})();
