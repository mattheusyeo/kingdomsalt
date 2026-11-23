// Product page: product.html?id=acrylic-pen-holder
// Shows the photo (click it to enlarge), the description, an option picker (for example a scent)
// when the product has options, and "Add to cart".
(function () {
  var root = document.getElementById('product-root');
  if (!root) return;

  var CATEGORY = { lifestyle: 'Holders & Accessories', stationery: 'Stationery', accessories: 'Candles' };
  var id = new URLSearchParams(window.location.search).get('id');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function money(cents, unit) {
    var dollars = cents / 100;
    var text = '$' + (Number.isInteger(dollars) ? dollars : dollars.toFixed(2));
    return unit ? text + '/' + unit : text;
  }

  // Enlarged view of a collage photo (closes on click or Esc)
  function makeLightbox() {
    var box = el('dialog', 'lightbox');
    var img = el('img');
    var caption = el('p', 'lightbox-caption');
    box.appendChild(img);
    box.appendChild(caption);
    box.addEventListener('click', function () { box.close(); });
    document.getElementById('product-wrap').appendChild(box);
    return function open(src, alt) {
      img.src = src; img.alt = alt; caption.textContent = alt;
      if (box.showModal) box.showModal();
    };
  }

  function render(catalog) {
    var product = catalog.products.filter(function (p) { return p.id === id; })[0];
    root.textContent = '';

    if (!product) {
      document.title = 'Product not found – Kingdomsalt';
      var missing = el('div', 'cart-empty');
      missing.appendChild(el('p', null, 'We could not find that product.'));
      var back = el('a', 'button', 'Keep shopping');
      back.href = 'gallery.html?category=lifestyle';
      missing.appendChild(back);
      root.appendChild(missing);
      document.getElementById('product-back').hidden = true;
      return;
    }

    document.title = product.name + ' – Kingdomsalt';
    var cat = (product.categories || [])[0];
    var backLink = document.getElementById('product-back');
    if (cat && CATEGORY[cat]) {
      backLink.href = 'gallery.html?category=' + cat;
      backLink.textContent = '← ' + CATEGORY[cat];
    }

    /* ----- photos: one big photo, or a scrolling carousel. Every option (scent, colour...) is a slide too ----- */
    var photos = (product.images && product.images.length)
      ? product.images
      : [{ src: product.image, alt: product.alt || product.name }];
    var slides = photos.slice(0, 8).map(function (ph) { return { src: ph.src, alt: ph.alt || product.name, optionId: null }; });
    var optValues = (product.options && product.options.values) || [];
    var slideOf = {};                                              // option id -> slide number
    optValues.forEach(function (v) {
      if (!v.image) return;
      slideOf[v.id] = slides.length;
      slides.push({ src: v.image, alt: v.alt || (product.name + ' \u2013 ' + v.name), optionId: v.id });
    });
    var openPhoto = makeLightbox();
    var multi = slides.length > 1;
    var onLand = function () {};                                   // set later: selects the option whose photo the visitor scrolled to
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var collage = el('div', 'collage' + (multi ? ' is-carousel' : ''));
    var track = el('div', 'collage-track');
    if (multi) { track.tabIndex = 0; track.setAttribute('role', 'group'); track.setAttribute('aria-roledescription', 'carousel'); track.setAttribute('aria-label', product.name + ' photos'); }
    slides.forEach(function (sl, i) {
      var tile = el('button', 'collage-item');
      tile.type = 'button';
      tile.setAttribute('aria-label', 'Enlarge photo ' + (i + 1) + ' of ' + slides.length);
      if (sl.optionId) tile.setAttribute('data-slide-option', sl.optionId);
      var img = el('img');
      img.src = sl.src; img.alt = sl.alt;
      img.decoding = 'async';
      if (i === 0) window.khFadeIn(img);
      tile.appendChild(img);
      tile.addEventListener('click', function () { openPhoto(sl.src, sl.alt); });
      track.appendChild(tile);
    });
    collage.appendChild(track);

    var goTo = function () {};
    if (multi) {
      var arrowSvg = function (d) { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
      var prevB = el('button', 'collage-arrow collage-prev'); prevB.type = 'button'; prevB.setAttribute('aria-label', 'Previous photo'); prevB.innerHTML = arrowSvg('M15 5l-7 7 7 7');
      var nextB = el('button', 'collage-arrow collage-next'); nextB.type = 'button'; nextB.setAttribute('aria-label', 'Next photo'); nextB.innerHTML = arrowSvg('M9 5l7 7-7 7');
      var count = el('span', 'collage-count'); count.setAttribute('aria-hidden', 'true');
      // at most three dots are visible; the strip slides along as the photos change
      var DOT_SLOT = 18, DOTS_SHOWN = Math.min(3, slides.length);
      var dots = el('div', 'collage-dots');
      dots.style.width = (DOTS_SHOWN * DOT_SLOT) + 'px';
      var dotsTrack = el('div', 'collage-dots-track');
      dots.appendChild(dotsTrack);
      var dotEls = slides.map(function (sl, i) {
        var d = el('button', 'collage-dot'); d.type = 'button'; d.setAttribute('aria-label', 'Show photo ' + (i + 1));
        d.addEventListener('click', function () { goTo(i); });
        dotsTrack.appendChild(d); return d;
      });
      goTo = function (i) {
        i = Math.max(0, Math.min(slides.length - 1, i));
        track.scrollTo({ left: i * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
      };
      var sync = function () {
        var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        var start = Math.max(0, Math.min(slides.length - DOTS_SHOWN, i - 1));     // the three dots on show
        dotsTrack.style.transform = 'translateX(' + (-start * DOT_SLOT) + 'px)';
        dotEls.forEach(function (d, k) {
          var shown = k >= start && k < start + DOTS_SHOWN;
          var edgeWithMore = (k === start && start > 0) || (k === start + DOTS_SHOWN - 1 && start + DOTS_SHOWN < slides.length);
          d.setAttribute('aria-current', k === i ? 'true' : 'false');
          d.classList.toggle('is-small', shown && edgeWithMore && k !== i);      // a smaller dot hints there are more photos that way
          d.tabIndex = shown ? 0 : -1; d.setAttribute('aria-hidden', shown ? 'false' : 'true');
        });
        count.textContent = (i + 1) + ' / ' + slides.length;
        prevB.disabled = i <= 0; nextB.disabled = i >= slides.length - 1;
      };
      prevB.addEventListener('click', function () { goTo(Math.round(track.scrollLeft / track.clientWidth) - 1); });
      nextB.addEventListener('click', function () { goTo(Math.round(track.scrollLeft / track.clientWidth) + 1); });
      var settleTimer = null;
      var settle = function () {                                     // after the carousel stops moving
        var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        if (slides[i] && slides[i].optionId) onLand(slides[i].optionId);
      };
      track.addEventListener('scroll', function () {
        window.requestAnimationFrame(sync);
        clearTimeout(settleTimer); settleTimer = setTimeout(settle, 160);
      }, { passive: true });
      track.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); nextB.click(); } else if (e.key === 'ArrowLeft') { e.preventDefault(); prevB.click(); }
      });
      window.addEventListener('resize', function () { goTo(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))); });
      collage.appendChild(prevB); collage.appendChild(nextB); collage.appendChild(count); collage.appendChild(dots);
      sync();
    }

    /* ----- product information ----- */
    var info = el('div', 'product-info');
    info.appendChild(el('h1', 'product-title', product.name));
    var priceEl = el('p', 'product-price', money(product.price, product.unit));
    info.appendChild(priceEl);
    info.appendChild(el('p', 'cart-fineprint product-aud', 'Prices in Australian dollars (AUD).'));

    (product.description || []).forEach(function (para) {
      info.appendChild(el('p', 'product-desc', para));
    });

    var values = (product.options && product.options.values) || [];

    var add = el('button', 'button button-lg product-add');
    add.type = 'button';
    add.setAttribute('data-add-to-cart', product.id);
    add.appendChild(window.khAddIcon());
    add.appendChild(document.createTextNode('Add to cart'));

    if (values.length) {
      var noun = product.options.label.toLowerCase();
      var group = el('div', 'options');
      var label = el('p', 'options-label', product.options.label);
      label.id = 'options-label';
      var chosenName = el('span', 'options-chosen', '');
      label.appendChild(chosenName);
      group.appendChild(label);

      var grid = el('div', 'option-grid');
      grid.setAttribute('role', 'radiogroup');
      grid.setAttribute('aria-labelledby', 'options-label');
      var hint = el('p', 'options-hint', 'Choose a ' + noun + ' to add this to your cart.');
      var buttons = [], choosers = {};

      values.forEach(function (v) {
        var b = el('button', 'option');
        b.type = 'button';
        b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', 'false');
        b.setAttribute('data-option-id', v.id);
        if (v.thumb || v.image) {
          var t = el('img', 'option-thumb');
          t.src = v.thumb || v.image; t.alt = ''; t.width = 52; t.height = 52;
          b.appendChild(t);
        }
        b.appendChild(el('span', 'option-name', v.name));
        var choose = function (fromScroll) {
          buttons.forEach(function (x) {
            var on = x === b;
            x.setAttribute('aria-checked', on ? 'true' : 'false');
            x.classList.toggle('is-selected', on);
          });
          chosenName.textContent = ': ' + v.name;
          priceEl.textContent = money(v.price != null ? v.price : product.price, product.unit);   // an option can have its own price (e.g. Set of 3)
          add.setAttribute('data-option', v.id);
          add.disabled = false;
          hint.hidden = true;
          if (!fromScroll && slideOf[v.id] !== undefined) {
            goTo(slideOf[v.id]);                                                     // bring its photo up in the carousel
            // on a phone or tablet the photo is above the options: scroll back up if it has left the screen
            var box = collage.getBoundingClientRect();
            if (window.innerWidth <= 1100 && box.top < 90) {
              collage.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
            }
          }
        };
        b.addEventListener('click', function () { choose(false); });
        choosers[v.id] = choose;
        buttons.push(b);
        grid.appendChild(b);
      });
      // scrolling to an option's photo selects that option too
      onLand = function (optionId) {
        var cur = add.getAttribute('data-option');
        if (cur !== optionId && choosers[optionId]) choosers[optionId](true);
      };
      group.appendChild(grid);
      group.appendChild(hint);
      info.appendChild(group);
      add.disabled = true;   // until a choice is made
    }

    info.appendChild(add);

    var ship = catalog.shipping || {};
    var shipText = (ship.amount === 0 ? 'Free shipping to Australia' : 'Shipping ' + money(ship.amount)) +
      (ship.minBusinessDays ? '. Estimated delivery ' + ship.minBusinessDays + '–' + ship.maxBusinessDays + ' business days.' : '.');
    var shipLine = el('p', 'product-ship', shipText + ' ');
    var shipLink = el('a', null, 'Shipping and returns');
    shipLink.href = 'shipping.html';
    shipLine.appendChild(shipLink);
    shipLine.appendChild(document.createTextNode(' \u00b7 '));
    var refundLink = el('a', null, 'Refund policy');
    refundLink.href = 'refunds.html';
    shipLine.appendChild(refundLink);
    info.appendChild(shipLine);

    if (product.details && product.details.length) {
      info.appendChild(el('h2', 'product-details-title', 'Details'));
      var list = el('ul', 'product-details');
      product.details.forEach(function (d) { list.appendChild(el('li', null, d)); });
      info.appendChild(list);
    }

    root.appendChild(collage);
    root.appendChild(info);
  }

  window.khLoadCatalog()
    .then(render)
    .catch(function () {
      root.textContent = '';
      root.appendChild(el('p', 'cart-error', 'We could not load this product. Please refresh the page.'));
    });
})();
