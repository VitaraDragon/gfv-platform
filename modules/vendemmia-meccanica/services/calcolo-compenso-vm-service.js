/**
 * Calcolo compenso vendemmia meccanica CT (formula piano §6.1)
 * @module modules/vendemmia-meccanica/services/calcolo-compenso-vm-service
 */

import {
  getCoefficienteSesto,
  tariffaVmKey,
  getAnnoStagioneCorrente
} from '../config/vm-constants.js';

/**
 * Ettari fatturabili per terreno/anno.
 * @param {Object} terreno
 * @param {number|string} [anno]
 * @returns {{ ettari: number, source: string, warning?: string }}
 */
export function getEttariEffettivi(terreno, anno = getAnnoStagioneCorrente()) {
  const annoKey = String(anno);
  const vm = terreno && terreno.vendemmiaMeccanica ? terreno.vendemmiaMeccanica[annoKey] : null;
  const superficie = Number(terreno?.superficie) || 0;

  if (vm && vm.ettariVendemmiati != null && Number.isFinite(Number(vm.ettariVendemmiati))) {
    return { ettari: Math.max(0, Number(vm.ettariVendemmiati)), source: 'vendemmiaMeccanica' };
  }

  const hasZone = vm && Array.isArray(vm.zoneEscluse) && vm.zoneEscluse.length > 0;
  if (hasZone) {
    return {
      ettari: superficie,
      source: 'superficie_fallback',
      warning: 'Zone escluse presenti ma ettari netti non aggiornati — verificare piano stagione'
    };
  }

  return { ettari: superficie, source: superficie > 0 ? 'superficie' : 'none' };
}

/**
 * Validazione campi obbligatori per un terreno in calcolo.
 * @param {Object} terreno
 * @returns {string[]} errori
 */
export function validateTerrenoForCalcolo(terreno) {
  const errors = [];
  if (!terreno) {
    errors.push('Terreno mancante');
    return errors;
  }
  if (!terreno.nome) errors.push('Nome terreno mancante');
  if (!terreno.tipoCampo) errors.push(`Morfologia mancante per "${terreno.nome || terreno.id}"`);
  if (!terreno.tipoPalo) errors.push(`Tipo palo mancante per "${terreno.nome || terreno.id}"`);
  const sesto = terreno.sestoImpianto;
  if (!sesto || !Number(sesto.distanzaFile) || !Number(sesto.distanzaCeppo)) {
    errors.push(`Sesto impianto incompleto per "${terreno.nome || terreno.id}"`);
  }
  return errors;
}

/**
 * Tariffa €/ha per terreno (morf × palo × coeff sesto).
 * @param {Object} terreno
 * @param {Object} tariffeConfig
 * @returns {{ tariffaBase: number, coefficienteSesto: number, tariffaEttaro: number, chiave: string }}
 */
export function resolveTariffaEttaro(terreno, tariffeConfig = {}) {
  const morf = String(terreno?.tipoCampo || '').toLowerCase();
  const palo = String(terreno?.tipoPalo || '').toLowerCase();
  const chiave = tariffaVmKey(morf, palo);
  const griglia = tariffeConfig.tariffeVendemmia || {};
  const tariffaBase = Number(griglia[chiave]) || 0;
  const coefficienteSesto = getCoefficienteSesto(
    terreno?.sestoImpianto,
    tariffeConfig.coefficientiSesto
  );
  return {
    chiave,
    tariffaBase,
    coefficienteSesto,
    tariffaEttaro: Math.round(tariffaBase * coefficienteSesto * 100) / 100
  };
}

/**
 * Breakdown singolo terreno.
 * @param {Object} terreno
 * @param {Object} tariffeConfig
 * @param {number|string} anno
 * @returns {Object}
 */
export function calcolaRigaTerreno(terreno, tariffeConfig, anno = getAnnoStagioneCorrente()) {
  const { ettari, source, warning } = getEttariEffettivi(terreno, anno);
  const tariffa = resolveTariffaEttaro(terreno, tariffeConfig);
  const importoVendemmia = Math.round(ettari * tariffa.tariffaEttaro * 100) / 100;
  const vm = terreno.vendemmiaMeccanica?.[String(anno)];

  return {
    terrenoId: terreno.id,
    nome: terreno.nome,
    ettariEffettivi: ettari,
    ettariTotali: Number(terreno.superficie) || 0,
    ettariSource: source,
    morfologia: terreno.tipoCampo,
    tipoPalo: terreno.tipoPalo,
    sestoImpianto: terreno.sestoImpianto || null,
    tariffaPerEttaro: tariffa.tariffaEttaro,
    tariffaBase: tariffa.tariffaBase,
    coefficienteSesto: tariffa.coefficienteSesto,
    tariffaChiave: tariffa.chiave,
    importoVendemmia,
    zoneEsclusePresenti: !!(vm && Array.isArray(vm.zoneEscluse) && vm.zoneEscluse.length),
    warning: warning || null
  };
}

/**
 * Calcolo compenso completo.
 * @param {Object} params
 * @param {string} params.clienteId
 * @param {string} [params.clienteNome]
 * @param {Array<Object>} params.terreni — terreni selezionati
 * @param {number} params.quintali
 * @param {string} params.destinazioneTrasporto
 * @param {number} [params.scontoMaggiorazione=0] — positivo=maggiorazione, negativo=sconto
 * @param {number|string} [params.anno]
 * @param {Object} params.tariffeConfig
 * @returns {{ valid: boolean, errors: string[], warnings: string[], breakdown: Object }}
 */
export function calcolaCompensoVendemmia(params) {
  const {
    clienteId,
    clienteNome = '',
    terreni = [],
    quintali = 0,
    destinazioneTrasporto = '',
    scontoMaggiorazione = 0,
    anno = getAnnoStagioneCorrente(),
    tariffeConfig = {}
  } = params || {};

  const errors = [];
  const warnings = [];

  if (!clienteId) errors.push('Cliente obbligatorio');
  if (!Array.isArray(terreni) || terreni.length === 0) errors.push('Seleziona almeno un terreno');
  if (!destinazioneTrasporto) errors.push('Destinazione trasporto obbligatoria');
  if (quintali == null || Number(quintali) < 0 || !Number.isFinite(Number(quintali))) {
    errors.push('Quintali non validi');
  }

  terreni.forEach((t) => {
    errors.push(...validateTerrenoForCalcolo(t));
  });

  if (errors.length) {
    return { valid: false, errors, warnings, breakdown: null };
  }

  const righe = terreni.map((t) => calcolaRigaTerreno(t, tariffeConfig, anno));
  righe.forEach((r) => {
    if (r.warning) warnings.push(`${r.nome}: ${r.warning}`);
    if (r.tariffaPerEttaro <= 0) {
      warnings.push(`${r.nome}: tariffa €/ha non configurata (${r.tariffaChiave})`);
    }
    if (r.ettariEffettivi <= 0) {
      warnings.push(`${r.nome}: superficie effettiva zero`);
    }
  });

  const totaleVendemmia = Math.round(righe.reduce((s, r) => s + r.importoVendemmia, 0) * 100) / 100;
  const tariffeTrasporto = tariffeConfig.tariffeTrasporto || {};
  const tariffaQli = Number(tariffeTrasporto[destinazioneTrasporto]) || 0;
  if (tariffaQli <= 0 && Number(quintali) > 0) {
    warnings.push(`Tariffa trasporto non configurata per "${destinazioneTrasporto}"`);
  }
  const totaleTrasporto = Math.round(Number(quintali) * tariffaQli * 100) / 100;
  const sconto = Number(scontoMaggiorazione) || 0;
  const totaleFinale = Math.round((totaleVendemmia + totaleTrasporto + sconto) * 100) / 100;

  return {
    valid: true,
    errors: [],
    warnings,
    breakdown: {
      clienteId,
      clienteNome,
      anno: Number(anno),
      destinazioneTrasporto,
      quintali: Number(quintali),
      tariffaTrasportoQli: tariffaQli,
      scontoMaggiorazione: sconto,
      terreni: righe,
      totaleVendemmia,
      totaleTrasporto,
      totaleFinale
    }
  };
}

export default {
  getEttariEffettivi,
  validateTerrenoForCalcolo,
  resolveTariffaEttaro,
  calcolaRigaTerreno,
  calcolaCompensoVendemmia
};
