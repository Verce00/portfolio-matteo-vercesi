/* Scroll-scrubbed detail video (Tacta only). */
(() => {
  "use strict";

  const stage = document.getElementById("tactaScrollVid");
  const display = document.getElementById("tactaScrollVidImg");
  if (!stage || !display) return;

  const frameCount = parseInt(stage.dataset.frameCount, 10);
  const frameBase = stage.dataset.frameBase;

  const frames = new Array(frameCount);
  let framesRequested = false;

  /* Deferred until the section is actually approaching (see the
     IntersectionObserver below) instead of firing all 33 requests the
     instant the page loads, competing with the hero image and everything
     else above it for bandwidth. */
  function requestFrames() {
    if (framesRequested) return;
    framesRequested = true;
    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.decoding = "async";
      img.src = `${frameBase}${String(i + 1).padStart(4, "0")}.webp`;
      /* Pre-decode off the main thread as each frame finishes downloading,
         so the visible <img> swap below is never the moment a frame gets
         decoded for the first time. */
      if (img.decode) img.decode().catch(() => {});
      frames[i] = img;
    }
    frames[0].addEventListener("load", () => drawFrame(0));
  }

  /* Swaps the visible <img>'s src to a pre-decoded frame - a GPU
     compositor paint the browser already does natively for a plain
     <img>, not a canvas redraw. Earlier this was a <canvas> repainted via
     drawImage() every frame, which meant every scroll tick paid for a
     manual cover-fit scale/copy of a ~2-3 megapixel bitmap in JS; a
     browser-native src swap has no equivalent per-frame cost, since
     object-fit:cover (in CSS) does the cropping once as a paint property,
     not as a JS-driven pixel copy repeated on every tick. */
  function drawFrame(index) {
    let img = frames[index];
    if (!img) return; // frames not requested yet (section never reached)
    if (!img.complete || !img.naturalWidth) {
      // Sequence still loading: fall back to the nearest already-loaded
      // frame instead of leaving the display blank mid-scrub.
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
    if (display.src !== img.src) display.src = img.src;
  }

  /* Scroll position -> frame index needs the actual scroll offset (not
     just "is this in view"), so unlike the rest of this codebase's
     scroll-driven UI this can't be an IntersectionObserver by itself -
     it's a rAF-throttled scroll listener, the same pattern apple.com's
     own scroll-scrubbed sections use. */
  let lastIndex = -1;
  let ticking = false;

  /* The stage's own position, measured once (not on every scroll tick).
     getBoundingClientRect() forces a synchronous layout recalculation if
     anything on the page is layout-dirty, and calling it from inside a
     scroll handler that can fire dozens of times a second was the actual
     remaining ceiling on frame rate - window.scrollY, used below instead,
     is just a number the browser already has on hand, no layout pass
     required. */
  let stageTop = 0;
  let stageHeight = 0;

  function measureStage() {
    const rect = stage.getBoundingClientRect();
    stageTop = window.scrollY + rect.top;
    stageHeight = rect.height;
  }

  function update() {
    ticking = false;
    const scrollable = stageHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, (window.scrollY - stageTop) / scrollable)) : 0;
    const index = Math.round(progress * (frameCount - 1));
    if (index !== lastIndex) {
      lastIndex = index;
      drawFrame(index);
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  measureStage();

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
        measureStage(); // re-sync the cached position now that everything above has settled
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
        measureStage();
        drawFrame(Math.max(0, lastIndex));
      });
    },
    { passive: true }
  );
})();
