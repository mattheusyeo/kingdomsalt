/* Product morph, arrival side: the photo you clicked is drawn at its old spot on this page, then grows
   and slides into the big product photo. menu.js saves where the photo was when a product is clicked.
   Loaded in <head> so the copy appears before the page first paints. */
(function () {
  var s = null;
  try { s = JSON.parse(sessionStorage.getItem('kl-morph') || 'null'); sessionStorage.removeItem('kl-morph'); } catch (e) {}
  if (!s || Date.now() - s.t > 6000) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var box = document.createElement('div');
  box.className = 'morph-photo';
  box.setAttribute('aria-hidden', 'true');
  box.style.cssText = 'position:fixed;z-index:1000;overflow:hidden;pointer-events:none;background:#f5eee0;' +
    'left:' + s.x + 'px;top:' + s.y + 'px;width:' + s.w + 'px;height:' + s.h + 'px;border-radius:' + s.r + ';';
  var img = document.createElement('img');
  img.src = s.src; img.alt = '';
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
  box.appendChild(img);
  document.documentElement.appendChild(box);

  var finished = false;
  function end() {
    if (finished) return; finished = true;
    box.style.transition = 'opacity .25s ease'; box.style.opacity = '0';
    setTimeout(function () { box.remove(); }, 300);
  }
  function land(target) {
    if (finished) return;
    window.scrollTo(0, 0);
    var r = target.getBoundingClientRect();
    if (!r.width) { end(); return; }
    var tr = getComputedStyle(target.parentNode).borderRadius;
    void box.offsetWidth;
    box.style.transition = 'left .6s cubic-bezier(.6,0,.2,1),top .6s cubic-bezier(.6,0,.2,1),width .6s cubic-bezier(.6,0,.2,1),height .6s cubic-bezier(.6,0,.2,1),border-radius .6s ease';
    box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
    box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
    if (tr) box.style.borderRadius = tr;
    setTimeout(end, 640);
  }
  // wait for the big photo to be built by product.js, then fly there
  var seen = false;
  function look() {
    var t = document.querySelector('.collage-item img');
    if (!t || seen) return;
    seen = true; mo.disconnect();
    requestAnimationFrame(function () { requestAnimationFrame(function () { land(t); }); });
  }
  var mo = new MutationObserver(look);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(end, 3500);   // never leave the copy on screen if the product can't load
  window.addEventListener('pageshow', function (e) { if (e.persisted) end(); });
})();
