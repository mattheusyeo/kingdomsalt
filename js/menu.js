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
      if (document.querySelector('.flame-sweep')) return;            // a sweep is already running
      flameSweep(a);
      setTimeout(function () { window.location.href = a.href; }, SWEEP_MS + 40);
    } else {
      setTimeout(function () { window.location.href = a.href; }, LEAVE_MS);
    }
  });

  // A flame that starts under the clicked tab and runs across the whole page, leaving a glowing trail.
  var SWEEP_MS = 700;
  function flameSweep(tab) {
    var r = tab.getBoundingClientRect();
    var startX = r.left + r.width / 2;
    var y = r.bottom - 12;
    var box = document.createElement('div');
    box.className = 'flame-sweep';
    box.setAttribute('aria-hidden', 'true');
    box.style.left = startX + 'px';
    box.style.width = Math.max(40, window.innerWidth - startX) + 'px';
    box.style.top = y + 'px';
    box.innerHTML = '<span class="flame-trail"></span><span class="flame-head"><svg viewBox="0 0 24 34" width="24" height="34"><path d="M12 1C17 9 22 14 22 21c0 6.5-4.5 11-10 11S2 27.500 2 21C2 14 7 9 12 1Z" fill="#f6b04a"/><path d="M12 14c3 4 5 6.500 5 10 0 3-2.200 5.500-5 5.500S7 27 7 24c0-3.500 2-6 5-10Z" fill="#fff3d6"/></svg></span>';
    document.body.appendChild(box);
    // start on the next frame so the animation runs
    requestAnimationFrame(function () { box.classList.add('go'); });
  }

  // Coming back with the browser's Back button: show the page again.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      document.documentElement.classList.remove('is-leaving');
      var old = document.querySelector('.flame-sweep'); if (old) old.remove();
    }
  });
})();
