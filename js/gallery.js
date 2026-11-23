// Fills the Gallery page from data/products.json, so each tab shows only its own products
// and every price lives in one place. gallery.html?category=lifestyle | stationery | accessories
(function () {
  var grid = document.getElementById('product-grid');
  if (!grid) return;

  var category = new URLSearchParams(window.location.search).get('category');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function price(cents, unit) {
    var dollars = cents / 100;
    var text = '$' + (Number.isInteger(dollars) ? dollars : dollars.toFixed(2));
    return unit ? text + '/' + unit : text;
  }

  // A tab can show several sections, each with its own small heading: { tabCategory: [category, category] }.
  // None right now: each tab shows just its own products.
  var GROUPS = {};

  function card(p) {
    var li = el('li', 'g-item');
    var href = 'product.html?id=' + encodeURIComponent(p.id);

    var info = el('div', 'g-info');
    var name = el('p', 'g-name');
    var nameLink = el('a', null, p.name);
    nameLink.href = href;
    name.appendChild(nameLink);
    info.appendChild(name);
    info.appendChild(el('p', 'g-price', price(p.price, p.unit)));
    li.appendChild(info);

    var frame = el('a', p.tint ? 'g-img g-tint' : 'g-img');
    frame.href = href;
    frame.setAttribute('aria-label', 'View ' + p.name);
    var img = el('img');
    img.alt = p.alt || p.name; img.decoding = 'async';
    img.src = p.image;
    window.khFadeIn(img);
    frame.appendChild(img);
    li.appendChild(frame);

    var add;
    if (p.options && p.options.values && p.options.values.length) {
      // needs a choice (scent, size...) first, so send the customer to the product page
      add = el('a', 'button g-add');
      add.href = href;
      add.appendChild(window.khAddIcon());
      add.appendChild(document.createTextNode('Select options'));
    } else {
      add = el('button', 'button g-add');
      add.type = 'button';
      add.setAttribute('data-add-to-cart', p.id);
      add.appendChild(window.khAddIcon());
      add.appendChild(document.createTextNode('Add to cart'));
    }
    li.appendChild(add);
    return li;
  }

  window.khLoadCatalog()
    .then(function (catalog) {
      grid.textContent = '';                       // remove the placeholder card
      var labels = catalog.labels || {};
      var label = document.getElementById('collection-label');
      var forCat = function (cat) {
        return catalog.products.filter(function (p) { return (p.categories || []).indexOf(cat) !== -1; });
      };

      var group = GROUPS[category];
      if (group) {
        var firstSection = grid.closest('section');
        var anchor = firstSection;
        group.forEach(function (cat, i) {
          var gridEl = grid, labelEl = label;
          if (i > 0) {                              // a further section below the first
            var sec = el('section', 'g-section g-collection g-extra');
            labelEl = el('h2', 'g-label is-ready');
            gridEl = el('ul', 'g-grid is-short');
            sec.appendChild(labelEl); sec.appendChild(gridEl);
            anchor.parentNode.insertBefore(sec, anchor.nextSibling);
            anchor = sec;
          }
          if (labelEl) { labelEl.textContent = labels[cat] || ''; labelEl.hidden = false; labelEl.classList.add('is-ready'); }
          var list = forCat(cat);
          if (!list.length) gridEl.appendChild(el('li', 'g-empty', 'New products are coming soon.'));
          list.forEach(function (p) { gridEl.appendChild(card(p)); });
        });
        return;
      }

      var items = category ? forCat(category) : catalog.products;
      var known = category && labels[category];
      if (items.length === 0 && known) {
        // a real tab with nothing in it yet
        if (label) label.hidden = true;
        grid.appendChild(el('li', 'g-empty', 'New products are coming soon.'));
        return;
      }
      // an unknown ?category= falls back to showing everything
      if (items.length === 0) items = catalog.products;

      if (label && labels[category]) { label.textContent = labels[category]; label.classList.add('is-ready'); }
      items.forEach(function (p) { grid.appendChild(card(p)); });
    })
    .catch(function () {
      grid.appendChild(el('li', 'g-empty', 'We could not load the products. Please refresh the page.'));
    });
})();
