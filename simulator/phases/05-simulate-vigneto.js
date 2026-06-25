/**
 * Fase 5 — Potature e trattamenti vigneto collegati alle attività diario (+ prodotti da magazzino).
 * Costi allineati a potatura-vigneto-service / trattamenti-vigneto-service + aggregaSpeseVignetoAnno.
 * @module simulator/phases/05-simulate-vigneto
 */

import { Timestamp } from 'firebase-admin/firestore';
import { inferTipoTrattamentoColturaFromTipoLavoroNome } from '../../core/config/trattamenti-lavoro-defaults.js';
import { getEmulatorDb } from '../lib/emulator-context.js';
import { addTenantNestedDocument, normalizeForAdmin } from '../lib/firestore-write.js';
import { patchMovimentoOrigineTrattamentoVigneto } from '../lib/link-scarichi-trattamento-vigneto.js';
import {
  calcCostiManodoperaMacchinaAttivita,
  calcCostoProdottoDaMovimento,
  ensureTenantEconomia,
  getTariffaProprietario,
  syncSpeseVignetoTenant,
  tenantHasModule
} from '../lib/sim-economia-vigneto.js';
import { requireSimTenantId, requireSimUserId } from '../lib/sim-context.js';

const TIPI_POTATURA = new Set(['Potatura']);
const TIPI_TRATTAMENTO = new Set(['Trattamento', 'Concimazione', 'Controllo fitosanitario']);

function tipoPotaturaFromTipoLavoro(tipoLavoroNome) {
  if (!tipoLavoroNome || typeof tipoLavoroNome !== 'string') return '';
  const n = tipoLavoroNome.toLowerCase().trim();
  if (n.includes('spollonatura')) return 'spollonatura';
  if (n.includes('verde')) return 'verde';
  if (n.includes('rinnovamento') || n.includes('rinnovo')) return 'rinnovo';
  if (n.includes('invernal') || n.includes('inverno')) return 'invernale';
  if (n.includes('formazione') || n.includes('produzione') || n.includes('meccanica') || n === 'potatura') {
    return 'invernale';
  }
  return '';
}

function dateStringToTimestamp(dateStr) {
  if (!dateStr) return Timestamp.fromDate(new Date());
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d, 12, 0, 0));
}

function parseAttivitaData(att) {
  if (!att.data) return new Date();
  if (typeof att.data === 'string') return new Date(att.data);
  if (typeof att.data.toDate === 'function') return att.data.toDate();
  return new Date(att.data);
}

/**
 * @param {{ attivitaIds?: string[], vigneti?: Array, terreni?: Array }} [options]
 */
export async function runSimulateVigneto(options = {}) {
  const tenantId = requireSimTenantId();
  const userId = requireSimUserId();
  const db = getEmulatorDb();

  await ensureTenantEconomia(db, tenantId);

  const tenantSnap = await db.doc(`tenants/${tenantId}`).get();
  const tenant = tenantSnap.data() || {};
  const parcoMacchine = tenantHasModule(tenant, 'parcoMacchine');
  const tariffaProprietario = await getTariffaProprietario(db, tenantId);

  const macSnap = await db.collection(`tenants/${tenantId}/macchine`).get();
  const macchine = new Map(macSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
  const costiCtx = { tariffaProprietario, parcoMacchine, macchine };

  const vigneti = options.vigneti?.length
    ? options.vigneti
    : (await db.collection(`tenants/${tenantId}/vigneti`).get()).docs.map((d) => ({
      id: d.id,
      ...d.data()
    }));

  const vignetoByTerreno = new Map(vigneti.map((v) => [v.terrenoId, v]));

  let attivitaDocs;
  if (options.attivitaIds?.length) {
    attivitaDocs = [];
    for (const id of options.attivitaIds) {
      const doc = await db.collection(`tenants/${tenantId}/attivita`).doc(id).get();
      if (doc.exists) attivitaDocs.push({ id: doc.id, ...doc.data() });
    }
  } else {
    const snap = await db.collection(`tenants/${tenantId}/attivita`).get();
    attivitaDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const movSnap = await db.collection(`tenants/${tenantId}/movimentiMagazzino`).get();
  const movByAttivita = new Map();
  for (const doc of movSnap.docs) {
    const d = doc.data();
    if (d.attivitaId) movByAttivita.set(d.attivitaId, { id: doc.id, ...d });
  }

  const prodSnap = await db.collection(`tenants/${tenantId}/prodotti`).get();
  const prodById = new Map(prodSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));

  const potaturaIds = [];
  const trattamentoIds = [];

  for (const att of attivitaDocs) {
    const tipo = att.tipoLavoro || '';
    const vigneto = vignetoByTerreno.get(att.terrenoId);
    if (!vigneto) continue;

    const dataTs = dateStringToTimestamp(
      typeof att.data === 'string' ? att.data : parseAttivitaData(att).toISOString().slice(0, 10)
    );

    if (TIPI_POTATURA.has(tipo)) {
      const tipoPot = tipoPotaturaFromTipoLavoro(tipo) || 'invernale';
      const costi = calcCostiManodoperaMacchinaAttivita(att, costiCtx, { sommaTrattoreEAttrezzo: false });
      const payload = normalizeForAdmin({
        vignetoId: vigneto.id,
        attivitaId: att.id,
        data: dataTs,
        tipo: tipoPot,
        parcella: null,
        ceppiPotati: null,
        operai: [],
        oreImpiegate: att.oreNette || null,
        costoManodopera: costi.costoManodopera,
        costoMacchina: costi.costoMacchina,
        costoTotale: costi.costoTotale,
        macchinaId: att.macchinaId || att.attrezzoId || null,
        note: `Potatura simulata — ${att.note || tipo}`,
        creatoDa: userId
      });
      const id = await addTenantNestedDocument(db, tenantId, ['vigneti', vigneto.id, 'potature'], payload);
      potaturaIds.push({ vignetoId: vigneto.id, id, attivitaId: att.id });
      continue;
    }

    if (TIPI_TRATTAMENTO.has(tipo)) {
      const mov = movByAttivita.get(att.id);
      const prodotto = mov?.prodottoId ? prodById.get(mov.prodottoId) : null;
      const quantita = mov?.quantita ?? 3.5;
      const costoProdotto = calcCostoProdottoDaMovimento(mov, prodotto, quantita);
      const costi = calcCostiManodoperaMacchinaAttivita(att, costiCtx, { sommaTrattoreEAttrezzo: true });
      const prodotti = prodotto
        ? [{
          prodottoId: prodotto.id,
          prodotto: prodotto.nome || prodotto.descrizione || 'Prodotto',
          dosaggio: 2,
          unitaDosaggio: 'l/ha',
          quantita,
          costo: costoProdotto
        }]
        : [];

      const costoTotale = parseFloat(
        (costoProdotto + costi.costoManodopera + costi.costoMacchina).toFixed(2)
      );

      const payload = normalizeForAdmin({
        vignetoId: vigneto.id,
        attivitaId: att.id,
        data: dataTs,
        tipoTrattamento: inferTipoTrattamentoColturaFromTipoLavoroNome(tipo),
        prodotto: prodotti[0]?.prodotto || '',
        dosaggio: prodotti[0]?.dosaggio != null ? String(prodotti[0].dosaggio) : '',
        prodotti,
        operatore: userId,
        macchinaId: att.macchinaId || null,
        superficieTrattata: null,
        superficieDaAnagrafeTerreno: true,
        costoProdotto,
        costoManodopera: costi.costoManodopera,
        costoMacchina: costi.costoMacchina,
        costoTotale,
        magazzinoMovimentoIds: mov ? [mov.id] : [],
        coperturaTerreno: 'completa',
        note: `Trattamento simulato — ${att.note || tipo}`,
        creatoDa: userId
      });

      const id = await addTenantNestedDocument(
        db,
        tenantId,
        ['vigneti', vigneto.id, 'trattamenti'],
        payload
      );
      trattamentoIds.push({ vignetoId: vigneto.id, id, attivitaId: att.id });

      if (mov?.id) {
        const riga = prodotti[0] || null;
        await patchMovimentoOrigineTrattamentoVigneto(db, tenantId, mov.id, {
          modulo: 'vigneto',
          colturaId: vigneto.id,
          trattamentoId: id,
          attivitaId: att.id,
          lavoroId: att.lavoroId || null,
          dataTrattamento: dataTs,
          rigaProdotto: riga,
          prodottoAnagrafica: prodotto
        });
      }
    }
  }

  const anno = new Date().getFullYear();
  for (const v of vigneti) {
    const potSnap = await db.collection(`tenants/${tenantId}/vigneti/${v.id}/potature`).get();
    const trtSnap = await db.collection(`tenants/${tenantId}/vigneti/${v.id}/trattamenti`).get();
    let dataUltimaPotatura = null;
    let dataUltimoTrattamento = null;

    for (const doc of potSnap.docs) {
      const d = doc.data();
      const dt = d.data?.toDate ? d.data.toDate() : null;
      if (dt && (!dataUltimaPotatura || dt > dataUltimaPotatura)) dataUltimaPotatura = dt;
    }
    for (const doc of trtSnap.docs) {
      const d = doc.data();
      const dt = d.data?.toDate ? d.data.toDate() : null;
      if (dt && (!dataUltimoTrattamento || dt > dataUltimoTrattamento)) dataUltimoTrattamento = dt;
    }

    const patch = { updatedAt: new Date() };
    if (dataUltimaPotatura) patch.dataUltimaPotatura = Timestamp.fromDate(dataUltimaPotatura);
    if (dataUltimoTrattamento) patch.dataUltimoTrattamento = Timestamp.fromDate(dataUltimoTrattamento);
    if (Object.keys(patch).length > 1) {
      await db.doc(`tenants/${tenantId}/vigneti/${v.id}`).set(patch, { merge: true });
    }
  }

  const speseSync = await syncSpeseVignetoTenant(db, tenantId, { anno });

  const expectedPotature = attivitaDocs.filter((a) => TIPI_POTATURA.has(a.tipoLavoro)).length;
  const expectedTrattamenti = attivitaDocs.filter((a) => TIPI_TRATTAMENTO.has(a.tipoLavoro)).length;

  return {
    potaturaIds,
    trattamentoIds,
    speseSync,
    counts: {
      potature: potaturaIds.length,
      trattamenti: trattamentoIds.length,
      attesePotature: expectedPotature,
      attesiTrattamenti: expectedTrattamenti
    }
  };
}

/** Conteggi attesi da template (rotazione tipiLavoro). */
export function expectedVignetoCountsFromTemplate(template) {
  const tipi = template?.attivita?.tipiLavoro || [];
  const n = template?.quantities?.attivitaGiorniLavorativi || 20;
  let potature = 0;
  let trattamenti = 0;
  for (let i = 0; i < n; i++) {
    const t = tipi[i % Math.max(tipi.length, 1)];
    if (TIPI_POTATURA.has(t)) potature += 1;
    if (TIPI_TRATTAMENTO.has(t)) trattamenti += 1;
  }
  return { potature, trattamenti };
}

export { TIPI_POTATURA, TIPI_TRATTAMENTO };
