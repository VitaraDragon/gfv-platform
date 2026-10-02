/**
 * Regole del pieno registrato in campo (operaio / caposquadra).
 * Stesso movimento di magazzino: uscita, origine pieno, un solo scarico giacenza.
 * @module functions/lib/registra-pieno-campo-core
 */

function normId(value) {
  if (value == null) return '';
  return String(value).trim();
}

function lavoroRichiedeRifornimento(lavoro) {
  if (!lavoro) return false;
  var stato = String(lavoro.stato || '').toLowerCase();
  if (stato === 'completato' || stato === 'annullato') return false;
  return normId(lavoro.macchinaId).length > 0;
}

function ruoloConsentePienoCampo(ruoli) {
  var list = (ruoli || []).map(function (r) { return String(r || '').toLowerCase(); });
  return list.some(function (r) {
    return r.indexOf('manager') >= 0
      || r.indexOf('amministratore') >= 0
      || r.indexOf('caposquadra') >= 0
      || r.indexOf('operaio') >= 0;
  });
}

/**
 * Il lavoro è tra quelli che l'utente vede in campo.
 * @param {string[]} userIds
 * @param {object|null} lavoro
 * @param {string[]} capoIdsSquadra capi delle squadre di cui l'utente è operaio
 */
function utenteAssegnatoAlLavoro(userIds, lavoro, capoIdsSquadra) {
  var mine = {};
  (userIds || []).forEach(function (id) {
    var n = normId(id);
    if (n) mine[n] = true;
  });
  if (!lavoro || !Object.keys(mine).length) return false;
  var direct = ['operaioId', 'operatoreMacchinaId', 'assenzaSostitutoOperaioId'];
  for (var i = 0; i < direct.length; i++) {
    var v = normId(lavoro[direct[i]]);
    if (v && mine[v]) return true;
  }
  var capo = normId(lavoro.caposquadraId);
  if (!capo || normId(lavoro.operaioId)) return false;
  if (mine[capo]) return true;
  return (capoIdsSquadra || []).some(function (id) { return normId(id) === capo; });
}

function macchinaRifornibile(macchina) {
  if (!macchina) return false;
  var tipo = String(macchina.tipo || macchina.tipoMacchina || '').toLowerCase();
  if (tipo === 'attrezzo') return false;
  var stato = String(macchina.stato || '').toLowerCase();
  if (stato === 'dismesso') return false;
  return true;
}

/**
 * @param {{
 *   userIds: string[],
 *   ruoli: string[],
 *   lavoro: object|null,
 *   prodotto: object|null,
 *   macchina: object|null,
 *   quantita: number,
 *   capoIdsSquadra?: string[],
 *   haModuloMagazzino: boolean
 * }} input
 * @returns {{ ok: boolean, error: string|null, code: string|null }}
 */
function validaPienoCampo(input) {
  var quantita = Number(input && input.quantita);
  if (!Number.isFinite(quantita) || quantita <= 0 || quantita > 9999) {
    return { ok: false, error: 'Indica i litri del pieno.', code: 'invalid-argument' };
  }
  if (!input.haModuloMagazzino) {
    return { ok: false, error: 'Il magazzino non è attivo per questa azienda.', code: 'failed-precondition' };
  }
  if (!ruoloConsentePienoCampo(input.ruoli)) {
    return { ok: false, error: 'Solo chi è in campo può registrare il pieno.', code: 'permission-denied' };
  }
  if (!lavoroRichiedeRifornimento(input.lavoro)) {
    return { ok: false, error: 'Questo lavoro non ha un mezzo da rifornire.', code: 'failed-precondition' };
  }
  if (!utenteAssegnatoAlLavoro(input.userIds, input.lavoro, input.capoIdsSquadra || [])) {
    return { ok: false, error: 'Questo lavoro non è assegnato a te.', code: 'permission-denied' };
  }
  if (!input.prodotto || String(input.prodotto.categoria || '') !== 'carburante' || input.prodotto.attivo === false) {
    return { ok: false, error: 'Scegli un carburante in anagrafica.', code: 'invalid-argument' };
  }
  if (!macchinaRifornibile(input.macchina) || normId(input.macchina.id) !== normId(input.lavoro.macchinaId)) {
    return { ok: false, error: 'Il mezzo del lavoro non è rifornibile.', code: 'failed-precondition' };
  }
  var giacenza = input.prodotto.giacenza != null ? Number(input.prodotto.giacenza) : 0;
  if (!Number.isFinite(giacenza) || giacenza < quantita) {
    return { ok: false, error: 'In cisterna non ci sono abbastanza litri di questo carburante.', code: 'failed-precondition' };
  }
  return { ok: true, error: null, code: null };
}

module.exports = {
  lavoroRichiedeRifornimento,
  utenteAssegnatoAlLavoro,
  validaPienoCampo
};
