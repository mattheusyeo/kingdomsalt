// Home page: one scrolling row of products for each category ("Best of Lifestyle", ...).
// Built from data/products.json. Arrows and a progress bar appear only when a row has more
// products than fit on screen; on touch screens you simply swipe.
(function () {
  var root = document.getElementById('shelves');
  if (!root) return;

  var CATEGORIES = [
    { id: 'lifestyle', name: 'Lifestyle' },
    { id: 'stationery', name: 'Stationery' },
    { id: 'accessories', name: 'Accessories' }
  ];
  var MAX_SWATCHES = 5;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var chevronRight = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  var chevronLeft = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function money(cents) { return '$' + (cents / 100).toFixed(2); }

  function buildCard(p) {
    var card = el('a', 'card');
    card.href = 'product.html?id=' + encodeURIComponent(p.id);

    var frame = el('span', 'card-img');
    var img = el('img');
    img.alt = p.alt || p.name; img.decoding = 'async'; img.loading = 'lazy';
    img.src = p.image;
    window.khFadeIn(img);
    frame.appendChild(img);
    card.appendChild(frame);

    var values = (p.options && p.options.values) || [];
    if (values.length) {
      var sw = el('span', 'card-swatches');
      sw.setAttribute('aria-hidden', 'true');
      values.slice(0, MAX_SWATCHES).forEach(function (v) {
        var s = el('span', 'swatch');
        var t = el('img'); t.src = v.thumb || v.image; t.alt = ''; t.width = 44; t.height = 44; t.loading = 'lazy';
        s.appendChild(t);
        // hovering a swatch shows that option's photo on the card
        s.addEventListener('mouseenter', function () { if (v.image) img.src = v.image; });
        sw.appendChild(s);
      });
      if (values.length > MAX_SWATCHES) sw.appendChild(el('span', 'swatch-more', '+' + (values.length - MAX_SWATCHES)));
      card.addEventListener('mouseleave', function () { img.src = p.image; });
      card.appendChild(sw);
    }

    card.appendChild(el('span', 'card-name', p.name));
    card.appendChild(el('span', 'card-price', money(p.price)));
    return card;
  }

  function buildShelf(cat, products) {
    var sec = el('section', 'shelf');
    var headId = 'shelf-' + cat.id;
    sec.setAttribute('aria-labelledby', headId);

    var head = el('div', 'shelf-head');
    var h2 = el('h2', null, 'Best of ' + cat.name); h2.id = headId;
    var all = el('a', 'shelf-all');
    all.href = 'gallery.html?category=' + cat.id;
    all.appendChild(document.createTextNode('Shop All '));
    var btn = el('span', 'shelf-all-btn'); btn.innerHTML = chevronRight;
    all.appendChild(btn);
    head.appendChild(h2); head.appendChild(all);
    sec.appendChild(head);

    var view = el('div', 'shelf-view');
    var track = el('div', 'shelf-track');
    track.tabIndex = 0;
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', cat.name + ' products');
    products.forEach(function (p) { track.appendChild(buildCard(p)); });
    view.appendChild(track);

    var prev = el('button', 'shelf-arrow shelf-prev'); prev.type = 'button'; prev.hidden = true;
    prev.setAttribute('aria-label', 'Previous ' + cat.name + ' products'); prev.innerHTML = chevronLeft;
    var next = el('button', 'shelf-arrow shelf-next'); next.type = 'button'; next.hidden = true;
    next.setAttribute('aria-label', 'Next ' + cat.name + ' products'); next.innerHTML = chevronRight;
    view.appendChild(prev); view.appendChild(next);
    sec.appendChild(view);

    var bar = el('div', 'shelf-bar'); bar.hidden = true; bar.setAttribute('aria-hidden', 'true');
    var thumb = el('span', 'shelf-thumb'); bar.appendChild(thumb);
    sec.appendChild(bar);

    function update() {
      var overflow = track.scrollWidth > track.clientWidth + 2;
      var first = track.firstElementChild, w = first ? first.getBoundingClientRect().width : 280;
      view.style.setProperty('--card-w', w + 'px');
      bar.hidden = !overflow;
      prev.hidden = !overflow || track.scrollLeft < 4;
      next.hidden = !overflow || track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (overflow) {
        thumb.style.width = (track.clientWidth / track.scrollWidth * 100) + '%';
        thumb.style.left = (track.scrollLeft / track.scrollWidth * 100) + '%';
      }
    }
    function go(dir) { track.scrollBy({ left: dir * track.clientWidth * 0.9, behavior: reduced ? 'auto' : 'smooth' }); }
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    });
    window.addEventListener('resize', update);
    // images and fonts settle after the first paint, so measure again shortly after
    setTimeout(update, 60); setTimeout(update, 600);
    sec.__update = update;
    return sec;
  }

  window.khLoadCatalog().then(function (catalog) {
    root.textContent = '';
    CATEGORIES.forEach(function (cat) {
      var items = catalog.products.filter(function (p) { return (p.categories || []).indexOf(cat.id) !== -1; });
      if (!items.length) return;
      var sec = buildShelf(cat, items);
      root.appendChild(sec);
      sec.__update();
    });
  }).catch(function () {
    root.textContent = '';
  });
})();
