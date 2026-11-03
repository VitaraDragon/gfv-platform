/**
 * Decisione pura: cosa fare sui registri vigneto/frutteto collegati
 * dopo la modifica di un lavoro. Non restituisce mai «cancella».
 *
 * @module core/services/lavoro-registri-allineamento
 */

/**
 * @param {object|null|undefined} terreno
 * @returns {boolean}
 */
export function terrenoEVite(terreno) {
  if (!terreno || terreno.coltura == null) return false;
  return String(terreno.coltura).toLowerCase().includes('vite');
}

/**
 * @param {object|null|undefined} terreno
 * @returns {boolean}
 */
export function terrenoEFrutteto(terreno) {
  if (!terreno) return false;
  const tipo = String(terreno.tipoColtura || '').toLowerCase();
  if (tipo === 'frutteto') return true;
  const coltura = String(terreno.coltura || '').toLowerCase();
  return (
    coltura.includes('melo') ||
    coltura.includes('pero') ||
    coltura.includes('pesco') ||
    coltura.includes('ciliegio') ||
    coltura.includes('albicocco') ||
    coltura.includes('susino') ||
    coltura.includes('frutteto')
  );
}

/**
 * Decide l'azione su un registro collegato al lavoro dopo modifica.
 *
 * @param {object} params
 * @param {object|null|undefined} params.lavoroOriginale
 * @param {object|null|undefined} params.lavoroData
 * @param {object|null|undefined} params.terrenoOriginale
 * @param {object|null|undefined} params.terrenoNuovo
 * @param {'potatura'|'trattamento'|'vendemmia'|'raccolta'} [params.registro='potatura']
 * @param {'vigneto'|'frutteto'} [params.ambito='vigneto']
 * @returns {'sync'|'scollega'|'nessuna'}
 */
export function decidiAllineamentoRegistriDopoModifica({
  lavoroOriginale,
  lavoroData,
  terrenoOriginale,
  terrenoNuovo,
  registro = 'potatura',
  ambito = 'vigneto'
} = {}) {
  const terrenoCambiato = !!(
    lavoroOriginale?.terrenoId &&
    lavoroData?.terrenoId != null &&
    lavoroOriginale.terrenoId !== lavoroData.terrenoId
  );

  if (registro === 'vendemmia') {
    const tipoOrig = String(lavoroOriginale?.tipoLavoro || '').toLowerCase();
    const tipoNuovo = String(lavoroData?.tipoLavoro || '').toLowerCase();
    if (tipoOrig.includes('vendemmia') && !tipoNuovo.includes('vendemmia')) {
      return 'scollega';
    }
    if (terrenoCambiato) {
      return 'scollega';
    }
    if (tipoNuovo.includes('vendemmia') && terrenoEVite(terrenoNuovo)) {
      return 'sync';
    }
    return 'nessuna';
  }

  if (terrenoCambiato) {
    return 'scollega';
  }

  const ancoraCompatibile =
    ambito === 'frutteto'
      ? terrenoEFrutteto(terrenoNuovo)
      : terrenoEVite(terrenoNuovo);

  if (ancoraCompatibile) {
    return 'sync';
  }

  // stesso terrenoId ma coltura cambiata, o terreno eliminato
  void terrenoOriginale;
  return 'nessuna';
}

/**
 * Motivo leggibile per console quando l'azione è «nessuna».
 * @param {object} params
 * @returns {string}
 */
export function motivoNessunAllineamentoRegistri({
  lavoroOriginale,
  lavoroData,
  terrenoNuovo,
  ambito = 'vigneto'
} = {}) {
  if (!lavoroData?.terrenoId || !terrenoNuovo) {
    return 'terreno assente o eliminato: registro collegato lasciato invariato';
  }
  const compatibile =
    ambito === 'frutteto' ? terrenoEFrutteto(terrenoNuovo) : terrenoEVite(terrenoNuovo);
  if (
    lavoroOriginale?.terrenoId &&
    lavoroOriginale.terrenoId === lavoroData.terrenoId &&
    !compatibile
  ) {
    return 'stesso terreno ma coltura non più compatibile: registro collegato lasciato invariato';
  }
  return 'nessuna azione sui registri collegati';
}
