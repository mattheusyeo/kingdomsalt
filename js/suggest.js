// "You may be interested in": a random handful of products at the bottom of the Gallery page.
// Products from other tabs come first (the visitor is already looking at this tab's products);
// if there are not enough of those, the rest are filled in from this tab. The choice is new on every visit.
(function () {
  var root = document.getElementById('suggest');
  if (!root) return;
  var COUNT = 4;
  var category = new URLSearchParams(window.location.search).get('category');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function money(cents) { return '$' + (cents / 100).toFixed(2); }
  function shuffle(list) {                                   // Fisher-Yates
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  window.khLoadCatalog().then(function (catalog) {
    var all = catalog.products;
    var other = all.filter(function (p) { return !category || (p.categories || []).indexOf(category) === -1; });
    var same = all.filter(function (p) { return other.indexOf(p) === -1; });
    var picks = shuffle(other).concat(shuffle(same)).slice(0, COUNT);
    if (!picks.length) { root.hidden = true; return; }       // nothing to suggest (empty shop)

    root.textContent = '';
    var head = el('div', 'shelf-head');
    var h2 = el('h2', null, 'You may be interested in'); h2.id = 'suggest-title';
    head.appendChild(h2);
    root.appendChild(head);

    var track = el('div', 'shelf-track');
    track.tabIndex = 0;
    track.setAttribute('role', 'group');
    track.setAttribute('aria-label', 'Suggested products');
    picks.forEach(function (p) {
      var card = el('a', 'card');
      card.href = 'product.html?id=' + encodeURIComponent(p.id);
      var frame = el('span', 'card-img');
      var img = el('img');
      img.alt = p.alt || p.name; img.decoding = 'async'; img.loading = 'lazy';
      img.src = p.image;
      window.khFadeIn(img);
      frame.appendChild(img);
      card.appendChild(frame);
      card.appendChild(el('span', 'card-name', p.name));
      card.appendChild(el('span', 'card-price', money(p.price)));
      track.appendChild(card);
    });
    root.appendChild(track);
  }).catch(function () { root.textContent = ''; });
})();
