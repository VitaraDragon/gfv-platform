/**
 * Pulsante di testata sulle liste Magazzino.
 * Con ?categoria=carburante torna all'hub Carburante (stesse stringhe di dashboardLinkForCategoria).
 */
(function () {
  var HUB_HREF = 'carburante-home-standalone.html';
  var HUB_LABEL = '← Dashboard carburante';
  var MAG_HREF = 'magazzino-home-standalone.html';
  var MAG_LABEL = '← Dashboard';

  function sync(categoria) {
    var a = document.getElementById('link-dashboard-sezione');
    if (!a) return;
    if (categoria === 'carburante') {
      a.href = HUB_HREF;
      a.textContent = HUB_LABEL;
    } else {
      a.href = MAG_HREF;
      a.textContent = MAG_LABEL;
    }
  }

  window.GFVSyncDashboardSezione = sync;
  try {
    sync(new URLSearchParams(window.location.search).get('categoria'));
  } catch (e) { /* ignore */ }
})();
