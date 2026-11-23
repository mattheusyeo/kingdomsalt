// Contact page: clicking the email address copies it to the clipboard.
(function () {
  var buttons = document.querySelectorAll('[data-copy]');
  var hint = document.getElementById('copy-hint');
  if (!buttons.length) return;
  var DEFAULT_HINT = hint ? hint.textContent : '';
  var timer = null;

  // Older browsers (or a page opened from a file) have no clipboard API: use a hidden text box instead.
  function legacyCopy(text) {
    var box = document.createElement('textarea');
    box.value = text;
    box.setAttribute('readonly', '');
    box.style.position = 'fixed';
    box.style.opacity = '0';
    document.body.appendChild(box);
    box.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(box);
    return ok;
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  buttons.forEach(function (btn) {
    var label = btn.querySelector('.copy-text');
    var original = label.textContent;
    btn.addEventListener('click', function () {
      copy(btn.getAttribute('data-copy')).then(function (ok) {
        clearTimeout(timer);
        buttons.forEach(function (b) { b.classList.remove('is-copied'); b.querySelector('.copy-text').textContent = b.__original; });
        if (ok) {
          btn.classList.add('is-copied');
          label.textContent = 'Copied \u2713';
          if (hint) hint.textContent = 'Email address copied to your clipboard.';
        } else if (hint) {
          hint.textContent = 'Could not copy automatically. Please select the text and copy it.';
        }
        timer = setTimeout(function () {
          buttons.forEach(function (b) { b.classList.remove('is-copied'); b.querySelector('.copy-text').textContent = b.__original; });
          if (hint) hint.textContent = DEFAULT_HINT;
        }, 2200);
      });
    });
    btn.__original = original;
  });
})();
