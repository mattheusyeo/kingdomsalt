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

  // Until the flying photo arrives, the big photo's frame is a blank ivory box; the real photo is revealed as the copy lands.
  var css = document.createElement('style');
  css.textContent = 'html.morphing .collage-track{background:#faf7f1!important}' +
    'html.morphing .collage-item img{opacity:0!important;transition:none!important}' +
    'html.morph-reveal .collage-item img{transition:opacity .6s ease!important}';
  document.head.appendChild(css);
  document.documentElement.classList.add('morphing');

  var finished = false;
  function end() {
    if (finished) return; finished = true;
    document.documentElement.classList.add('morph-reveal');
    document.documentElement.classList.remove('morphing');
    box.style.transition = 'opacity .6s ease'; box.style.opacity = '0';
    setTimeout(function () { box.remove(); document.documentElement.classList.remove('morph-reveal'); css.remove(); }, 700);
  }
  function land(target) {
    if (finished) return;
    window.scrollTo(0, 0);
    var r = target.getBoundingClientRect();
    if (!r.width) { end(); return; }
    var tr = parseFloat(getComputedStyle(target.closest('.collage-track') || target.parentNode).borderRadius) || 0;
    var sr = parseFloat(s.r) || 0;
    // Smooth version: the copy is laid out once at its final size, then only transform and clip-path
    // change (both run on the graphics card), so it doesn't stutter while the page is still loading.
    var k = Math.max(s.w / r.width, s.h / r.height);                 // scale so the copy covers the old spot
    var cx = (r.width * k - s.w) / 2 / k, cy = (r.height * k - s.h) / 2 / k;   // extra to crop away, in final-size pixels
    var dx = s.x + s.w / 2 - (r.left + r.width / 2), dy = s.y + s.h / 2 - (r.top + r.height / 2);
    box.style.transition = 'none';
    box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
    box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
    box.style.borderRadius = '0';
    box.style.transformOrigin = '50% 50%';
    box.style.willChange = 'transform, clip-path';
    var from = { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')', clipPath: 'inset(' + cy + 'px ' + cx + 'px round ' + (sr / k) + 'px)' };
    var to = { transform: 'translate(0,0) scale(1)', clipPath: 'inset(0px 0px round ' + tr + 'px)' };
    box.style.transform = from.transform; box.style.clipPath = from.clipPath;
    box.style.overflow = 'visible';
    var anim = box.animate([from, to], { duration: 1200, easing: 'cubic-bezier(.65,0,.2,1)', fill: 'forwards' });
    anim.onfinish = end;
    setTimeout(end, 1450);
  }
  // wait for the big photo to be built by product.js, then fly there
  var seen = false;
  function look() {
    var t = document.querySelector('.collage-item img');
    if (!t || seen) return;
    seen = true; mo.disconnect();
    var go = function () { requestAnimationFrame(function () { requestAnimationFrame(function () { land(t); }); }); };
    (t.decode ? t.decode().then(go, go) : go());
  }
  var mo = new MutationObserver(look);
  mo.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(end, 3500);   // never leave the copy on screen if the product can't load
  window.addEventListener('pageshow', function (e) { if (e.persisted) end(); });
})();
