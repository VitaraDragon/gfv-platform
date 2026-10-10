/**
 * Attesa «Apro il tuo lavoro…» prima del primo disegno della dashboard.
 * Script classico (non modulo): la pagina lo chiama subito, prima della pittura.
 * La classificazione dei ruoli è la stessa di indizioRuoliCampo in tony-ingresso-login.js.
 * L'indizio non è un permesso.
 */
(function (root) {
  function normalizzaLista(v) {
    return (Array.isArray(v) ? v : []).map(function (x) {
      return String(x || '').toLowerCase();
    });
  }

  /**
   * Copia di indizioRuoliCampo. Il test di parità la confronta con l'originale.
   * @param {{ ultimo?: string, ruoli?: string[] }} [input]
   */
  function indizioRuoliCampo(input) {
    var src = input || {};
    var ultimo = String(src.ultimo || '');
    if (ultimo === 'dashboard') {
      return { ruoli: ['manager'], moduli: ['manodopera'], fonte: 'indizio-dashboard' };
    }
    if (ultimo === 'workspace') {
      return { ruoli: ['operaio'], moduli: ['manodopera'], fonte: 'indizio-workspace' };
    }
    var ruoli = Array.isArray(src.ruoli) ? src.ruoli : [];
    var low = normalizzaLista(ruoli);
    var manager = low.indexOf('manager') >= 0 || low.indexOf('amministratore') >= 0;
    var campo = low.indexOf('operaio') >= 0 || low.indexOf('caposquadra') >= 0;
    if (!manager && campo) {
      return { ruoli: ruoli, moduli: ['manodopera'], fonte: 'indizio-ruoli' };
    }
    return { ruoli: ruoli, moduli: [], fonte: 'nessuno' };
  }

  /**
   * true = coprire la dashboard con «Apro il tuo lavoro…».
   * Con indizio dashboard e sessione solo operaio/caposquadra l'attesa resta:
   * indizioRuoliCampo da solo direbbe manager, e il menu lampeggerebbe.
   * @param {{ ultimo?: string, ruoliSessione?: string[], classifica?: function }} [input]
   * @returns {boolean}
   */
  function devoMostrareAttesa(input) {
    var src = input || {};
    var ultimo = String(src.ultimo || '');
    var ruoli = Array.isArray(src.ruoliSessione) ? src.ruoliSessione : [];
    var classifica = typeof src.classifica === 'function' ? src.classifica : indizioRuoliCampo;
    var low = normalizzaLista(ruoli);
    var manager = low.indexOf('manager') >= 0 || low.indexOf('amministratore') >= 0;
    var campo = !manager && (low.indexOf('operaio') >= 0 || low.indexOf('caposquadra') >= 0);
    var indizio = classifica({ ultimo: ultimo, ruoli: ruoli });
    if (ultimo === 'dashboard') return campo;
    if (indizio && indizio.fonte === 'indizio-workspace') return true;
    if (indizio && indizio.fonte === 'indizio-ruoli') return true;
    if (manager) return false;
    return true;
  }

  /** Manager o amministratore: la casa è la dashboard, anche senza i moduli. */
  function ruoloRestaInDashboard(ruoli) {
    var low = normalizzaLista(ruoli);
    return low.indexOf('manager') >= 0 || low.indexOf('amministratore') >= 0;
  }

  /**
   * Ruoli già presenti sul documento utente, senza altre letture.
   * Prima la membership del tenant noto, poi l'elenco ruoli del documento.
   */
  function ruoliDalDocumentoUtente(userData, tenantId) {
    var data = userData || {};
    var tid = String(tenantId || '');
    var memberships = data.tenantMemberships;
    if (tid && memberships && typeof memberships === 'object' && memberships[tid]) {
      var ruoliM = memberships[tid].ruoli;
      if (Array.isArray(ruoliM) && ruoliM.length) return ruoliM.slice();
    }
    if (Array.isArray(data.ruoli)) return data.ruoli.slice();
    return [];
  }

  root.gfvDevoMostrareAttesa = devoMostrareAttesa;
  root.gfvRuoloRestaInDashboard = ruoloRestaInDashboard;
  root.gfvRuoliDalDocumentoUtente = ruoliDalDocumentoUtente;
  root.gfvIndizioRuoliCampoSpecchio = indizioRuoliCampo;
})(typeof window !== 'undefined' ? window : globalThis);
