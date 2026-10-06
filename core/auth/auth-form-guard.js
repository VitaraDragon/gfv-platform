/**
 * Guard sincrono (non module) per i form auth.
 * Il listener Firebase è in uno script module, dopo il bootstrap: se l'utente
 * invia prima, il browser farebbe un GET e metterebbe email/password nella query.
 * Questo script gira subito, toglie quei parametri dall'URL e blocca il submit nativo.
 * Non scrive la query in console.
 */
(function () {
  var SECRET = {
    email: 1,
    password: 1,
    'password-confirm': 1,
    'confirm-password': 1
  };
  var scrubbedPassword = false;
  if (window.__gfvScrubbedPassword) {
    scrubbedPassword = true;
    try { delete window.__gfvScrubbedPassword; } catch (err) { window.__gfvScrubbedPassword = 0; }
  }

  try {
    var params = new URLSearchParams(window.location.search);
    var keys = [];
    params.forEach(function (_value, key) {
      keys.push(key);
    });
    var dirty = false;
    for (var i = 0; i < keys.length; i++) {
      var raw = keys[i];
      var low = String(raw).toLowerCase();
      if (!SECRET[low]) continue;
      params.delete(raw);
      dirty = true;
      if (low !== 'email') scrubbedPassword = true;
    }
    if (dirty) {
      var qs = params.toString();
      history.replaceState(
        null,
        '',
        window.location.pathname + (qs ? '?' + qs : '') + window.location.hash
      );
    }
  } catch (err) {
    /* non loggare search: può contenere la password */
  }

  function clearPasswords(scope) {
    if (!scrubbedPassword || !scope) return;
    var inputs = scope.querySelectorAll('input[type="password"]');
    for (var j = 0; j < inputs.length; j++) inputs[j].value = '';
  }

  function arm(form) {
    if (!form || form.getAttribute('data-gfv-auth-guard') === '1') return;
    if (!form.querySelector('input[type="password"]')) return;
    form.setAttribute('data-gfv-auth-guard', '1');
    if ((form.getAttribute('method') || '').toLowerCase() !== 'post') {
      form.setAttribute('method', 'post');
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
    });
    clearPasswords(form);
  }

  function scan() {
    var forms = document.querySelectorAll('form');
    for (var i = 0; i < forms.length; i++) arm(forms[i]);
  }

  window.gfvMarkAuthFormReady = function (form, button) {
    if (form) form.setAttribute('data-gfv-auth-ready', '1');
    if (!button) return;
    button.disabled = false;
    var label = button.getAttribute('data-ready-label');
    if (label) button.textContent = label;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
