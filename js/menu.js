// Shared by every page: the three-stripe button opens and closes the dropdown menu
// (tablet and phone), and the Gallery page picks its title from the clicked tab.
(function () {
  var nav = document.getElementById('nav');
  var btn = nav.querySelector('.menu-toggle');   // no longer on the pages (the tabs always show), kept for safety

  function setOpen(open) {
    if (!btn) return;
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  if (btn) btn.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
  nav.querySelectorAll('.nav-items a').forEach(function (a) {
    a.addEventListener('click', function () { setOpen(false); });
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

  // Gallery page: gallery.html?category=lifestyle | stationery | accessories
  var title = document.getElementById('page-title');
  if (title) {
    var names = { lifestyle: 'Holders', stationery: 'Accessories', accessories: 'Candles' };
    var category = new URLSearchParams(window.location.search).get('category');
    if (names[category]) {
      title.textContent = names[category];
      document.title = names[category] + ' – Kingdomlight';
      nav.querySelectorAll('.nav-items a').forEach(function (a) {
        if (a.getAttribute('href').indexOf('category=' + category) !== -1) a.classList.add('active');
      });
    }
  }

  // Page transition: fade the page out, then go to the next page.
  var LEAVE_MS = 250;
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    if (!/^(https?|file):$/.test(a.protocol)) return;               // mailto:, tel: ...
    if (a.origin !== window.location.origin) return;                 // other websites
    // Cloudflare serves /contact for contact.html (and / for index.html), so compare the page names without ".html"
    function pageName(path) { return path.replace(/\/index\.html$/, '/').replace(/\.html$/, '') || '/'; }
    var samePage = pageName(a.pathname) === pageName(window.location.pathname) && a.search === window.location.search;
    if (samePage && a.hash) return;                                  // jump within this page
    e.preventDefault();
    if (samePage) {                                                  // already here: close the menu and go to the top
      setOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    document.documentElement.classList.add('is-leaving');
    var isTab = !!a.closest('.nav-items');
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTab && !reduce) {
      if (document.querySelector('.nav-items a.burning')) return;    // already burning
      document.documentElement.classList.remove('is-leaving');       // keep the page still while the words burn
      setOnFire(a);
      setTimeout(function () { window.location.href = a.href; }, BURN_MS);
    } else {
      setTimeout(function () { window.location.href = a.href; }, LEAVE_MS);
    }
  });

  // Clicking a tab sets its words on fire: little flames and embers rise off the letters.
  var BURN_MS = 900;
  var FLAME_BG = 'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 30"><defs>' +
    '<linearGradient id="o" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#d9531e"/><stop offset=".6" stop-color="#f6a13a"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>' +
    '<linearGradient id="m" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#f6a13a"/><stop offset="1" stop-color="#fff0b8"/></linearGradient></defs>' +
    '<path d="M10 0C11 8 19 12 19 20c0 6-4 10-9 10S1 26 1 20c0-4 2-6 4-9 0 3 1 4 2.500 4C6 9 8 4 10 0Z" fill="url(#o)"/>' +
    '<path d="M10 11c1 5 6 7 6 12 0 4-2.500 6-6 6s-6-2-6-6c0-3 2-4 3-6 0 2 .8 3 1.800 3C8 17 9 14 10 11Z" fill="url(#m)"/>' +
    '<path d="M10 20c.8 3 3 4 3 6.500 0 2-1.300 3-3 3s-3-1-3-3c0-2.500 2.200-3.500 3-6.500Z" fill="#fffaf0"/></svg>') + '")';
  function setOnFire(tab) {
    tab.classList.add('burning');
    var w = tab.offsetWidth, h = tab.offsetHeight;
    var fire = document.createElement('span');
    fire.className = 'fire';
    fire.setAttribute('aria-hidden', 'true');
    var n = Math.max(5, Math.round(w / 11));
    for (var i = 0; i < n; i++) {                                    // flames along the word
      var t = document.createElement('i');
      var fw = 9 + Math.random() * 9, fh = fw * (1.5 + Math.random() * 0.9);
      t.className = 'tongue';
      t.style.cssText = 'left:' + (4 + Math.random() * (w - 8)) + 'px;bottom:' + (h * 0.2 + Math.random() * 2) + 'px;width:' + fw + 'px;height:' + fh + 'px;' +
        'background-image:' + FLAME_BG + ';animation-delay:' + (Math.random() * 0.35).toFixed(2) + 's,' + (Math.random() * 0.2).toFixed(2) + 's;' +
        'animation-duration:' + (0.55 + Math.random() * 0.25).toFixed(2) + 's,' + (0.12 + Math.random() * 0.08).toFixed(2) + 's';
      fire.appendChild(t);
    }
    for (var j = 0; j < 9; j++) {                                    // embers
      var e = document.createElement('b');
      e.className = 'ember';
      e.style.cssText = 'left:' + (Math.random() * w) + 'px;bottom:' + (h * 0.5) + 'px;--dx:' + ((Math.random() - 0.5) * 30).toFixed(0) + 'px;--rise:' + (26 + Math.random() * 30).toFixed(0) + 'px;' +
        'animation-delay:' + (0.1 + Math.random() * 0.5).toFixed(2) + 's';
      fire.appendChild(e);
    }
    tab.appendChild(fire);
  }

  // Coming back with the browser's Back button: show the page again.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      document.documentElement.classList.remove('is-leaving');
    }
  });
})();
