// Gentle fade-up for sections marked class="reveal" as they scroll into view.
// Everything is visible without JavaScript, and for visitors who prefer reduced motion.
(function () {
  var items = [].slice.call(document.querySelectorAll('.reveal'));
  if (!items.length) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js-reveal');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  items.forEach(function (el) { io.observe(el); });
  // safety net: never leave anything hidden
  setTimeout(function () { items.forEach(function (el) { el.classList.add('is-in'); }); }, 3500);
})();
