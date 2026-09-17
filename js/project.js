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
