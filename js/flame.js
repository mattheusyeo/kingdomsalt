/* Flame transition: clicking a menu tab grows a flame from that tab until the whole page is orange,
   the next page opens already orange, then the flame shrinks back down into the tab to reveal it.
   Loaded in <head> (before the page paints) so the next page never flashes before it is covered. */
(function () {
  var KEY = 'kl-flame', GROW_MS = 600, SHRINK_MS = 700;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var EASE = 'cubic-bezier(.55,0,.3,1)';

  function radius(x, y) {
    var w = window.innerWidth, h = window.innerHeight;
    return Math.ceil(Math.hypot(Math.max(x, w - x), Math.max(y, h - y))) + 30;
  }
  function make(x, y, r) {
    var d = document.createElement('div');
    d.className = 'flame-fill';
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;z-index:1000;pointer-events:none;' +
      'background:radial-gradient(circle at ' + x + 'px ' + y + 'px,#fff3d6 0,#ffd27a 3%,#f6b04a 12%,#e8872f 45%,#d9792b 100%);' +
      'clip-path:circle(' + r + 'px at ' + x + 'px ' + y + 'px);will-change:clip-path;';
    return d;
  }
  function run(d, x, y, from, to, ms, done) {
    d.style.clipPath = 'circle(' + from + 'px at ' + x + 'px ' + y + 'px)';
    void d.offsetWidth;
    d.style.transition = 'clip-path ' + ms + 'ms ' + EASE;
    d.style.clipPath = 'circle(' + to + 'px at ' + x + 'px ' + y + 'px)';
    setTimeout(done, ms + 30);
  }

  // Called by menu.js when a tab is clicked: grow, then call go() to open the next page.
  window.flameCover = function (x, y, go) {
    if (reduce || document.querySelector('.flame-fill')) { go(); return; }
    var d = make(x, y, 0);
    document.documentElement.appendChild(d);
    try { sessionStorage.setItem(KEY, JSON.stringify({ x: x, y: y, t: Date.now() })); } catch (e) {}
    run(d, x, y, 0, radius(x, y), GROW_MS, go);
  };

  // On arrival: start fully orange, then shrink back into the tab.
  var s = null;
  try { s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); sessionStorage.removeItem(KEY); } catch (e) {}
  if (!reduce && s && Date.now() - s.t < 6000) {
    var d = make(s.x, s.y, radius(s.x, s.y));
    document.documentElement.appendChild(d);
    var start = function () {
      requestAnimationFrame(function () {
        run(d, s.x, s.y, radius(s.x, s.y), 0, SHRINK_MS, function () { d.remove(); });
      });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
  // Back button restoring a page from memory: never leave the orange cover behind.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) { var o = document.querySelectorAll('.flame-fill'); for (var i = 0; i < o.length; i++) o[i].remove(); }
  });
})();
