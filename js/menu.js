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
    // Clicking a product: remember where its photo is so the next page can morph it into the big photo
    var reduceM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceM && /(^|\/)product(\.html)?$/.test(a.pathname)) {
      var holder = a.closest('li, .card, .hero-slide, article') || a;
      var pic = a.querySelector('img') || holder.querySelector('img');
      if (pic && pic.currentSrc) {
        var pr = pic.getBoundingClientRect(), frame = pic.parentNode;
        if (pr.width && pr.bottom > 0 && pr.top < window.innerHeight) {
          try {
            sessionStorage.setItem('kl-morph', JSON.stringify({ src: pic.currentSrc, x: pr.left, y: pr.top, w: pr.width, h: pr.height,
              r: getComputedStyle(frame).borderRadius || '0px', t: Date.now() }));
          } catch (err) {}
          window.location.href = a.href;
          return;
        }
      }
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

  // Clicking a tab turns its words fiery orange before the next page opens.
  var BURN_MS = 800;
  function setOnFire(tab) { tab.classList.add('burning'); }

  // Coming back with the browser's Back button: show the page again.
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      document.documentElement.classList.remove('is-leaving');
    }
  });
})();
