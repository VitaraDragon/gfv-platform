/**
 * Passaggi già registrati sullo stesso campo, per l'avviso prima del lavoro.
 * Se un modulo non è attivo, quel ramo resta vuoto.
 * @module shared/js/registro-trattamenti-passaggi
 */

import { colturaSchedaRegistro } from '../../core/config/registro-trattamenti-specie.js';
import { tipoLavoroETrattamento } from './registro-trattamenti-lavoro.js';

export function lavoroAnnullato(lavoro) {
  return String(lavoro && lavoro.stato || '').toLowerCase() === 'annullato';
}

/** Ancora da fare: non completato e non annullato. La data che conta è quella del lavoro. */
export function lavoroPianificatoNonEseguito(lavoro) {
  const stato = String(lavoro && lavoro.stato || '').toLowerCase();
  return stato !== 'annullato' && stato !== 'completato' && stato !== 'completato_da_approvare';
}

/**
 * Allinea i passaggi ai lavori attuali e, se richiesto, aggiunge i trattamenti
 * pianificati che non hanno ancora una scheda (seminativo e orticole).
 * Il registro non usa questa unione: il suo conteggio resta sui soli passaggi.
 * Non scrive nulla: una scheda già compilata resta com'è in archivio.
 */
export function unisciPassaggiLavoriPianificati(passaggi, lavori, opzioni = {}) {
  const terrenoId = String(opzioni.terrenoId || '');
  const escluso = opzioni.lavoroIdEscluso ? String(opzioni.lavoroIdEscluso) : '';
  const includiSenzaScheda = opzioni.includiLavoriSenzaScheda === true;
  const lista = (lavori || []).filter((lavoro) => {
    if (!lavoro) return false;
    if (terrenoId && String(lavoro.terrenoId || '') !== terrenoId) return false;
    return true;
  });
  const perId = new Map(lista.map((lavoro) => [String(lavoro.id), lavoro]));
  const out = [];
  const giaInRegistro = new Set();
  (passaggi || []).forEach((passaggio) => {
    if (!passaggio) return;
    const lavoroId = passaggio.lavoroId ? String(passaggio.lavoroId) : '';
    if (lavoroId && escluso && lavoroId === escluso) return;
    const lavoro = lavoroId ? perId.get(lavoroId) : null;
    if (lavoro && lavoroAnnullato(lavoro)) return;
    const copia = { ...passaggio };
    if (lavoro && lavoro.stato) copia.stato = lavoro.stato;
    if (lavoro && lavoroPianificatoNonEseguito(lavoro) && lavoro.dataInizio) {
      copia.data = lavoro.dataInizio;
    }
    out.push(copia);
    if (lavoroId) giaInRegistro.add(lavoroId);
  });
  if (!includiSenzaScheda) return out;
  lista.forEach((lavoro) => {
    const id = String(lavoro.id || '');
    if (!id || (escluso && id === escluso) || lavoroAnnullato(lavoro)) return;
    if (!tipoLavoroETrattamento(lavoro.tipoLavoro)) return;
    const prodotti = lavoro.miscelaPrevista && Array.isArray(lavoro.miscelaPrevista.prodotti)
      ? lavoro.miscelaPrevista.prodotti
      : [];
    if (!prodotti.length || giaInRegistro.has(id)) return;
    prodotti.forEach((prodotto) => {
      if (!prodotto || (!prodotto.prodottoId && !prodotto.nome && !prodotto.prodotto)) return;
      const rif = prodotto.riferimentoRiga && typeof prodotto.riferimentoRiga === 'object' ? prodotto.riferimentoRiga : null;
      const numero = String(prodotto.numeroRegistrazioneLetto || (rif && rif.numeroRegistrazione) || '').trim();
      const voce = {
        id: 'lavoro:' + id,
        lavoroId: id,
        data: lavoro.dataInizio,
        terrenoId: lavoro.terrenoId || terrenoId || null,
        prodottoId: prodotto.prodottoId || null,
        nome: prodotto.nome || prodotto.prodotto || '',
        stato: lavoro.stato || null,
        pianificato: true
      };
      if (numero) voce.numeroRegistrazioneLetto = numero;
      out.push(voce);
    });
  });
  return out;
}

/**
 * Stessa regola dei passaggi, sulle schede intere usate per la carenza.
 * Un lavoro annullato esce dal conto. Uno ancora da fare vale con la data attuale.
 */
export function allineaTrattamentiAiLavori(trattamenti, lavori) {
  const perId = new Map((lavori || []).filter((lavoro) => lavoro && lavoro.id).map((lavoro) => [String(lavoro.id), lavoro]));
  const out = [];
  (trattamenti || []).forEach((trattamento) => {
    if (!trattamento) return;
    const lavoroId = trattamento.lavoroId ? String(trattamento.lavoroId) : '';
    const lavoro = lavoroId ? perId.get(lavoroId) : null;
    if (lavoro && lavoroAnnullato(lavoro)) return;
    if (lavoro && lavoroPianificatoNonEseguito(lavoro) && lavoro.dataInizio) {
      out.push({ ...trattamento, data: lavoro.dataInizio });
      return;
    }
    out.push(trattamento);
  });
  return out;
}

function daTrattamenti(lista, terrenoId) {
  const out = [];
  (lista || []).forEach((t) => {
    const prodotti = t && Array.isArray(t.prodotti) ? t.prodotti : [];
    prodotti.forEach((p) => {
      if (!p) return;
      const nome = String(p.prodotto || p.nome || '').trim();
      const rif = p.riferimentoRiga && typeof p.riferimentoRiga === 'object' ? p.riferimentoRiga : null;
      const numero = String(p.numeroRegistrazioneLetto || (rif && rif.numeroRegistrazione) || '').trim();
      if (!p.prodottoId && !nome && !numero) return;
      const voce = {
        id: t.id,
        lavoroId: t.lavoroId || null,
        data: t.data,
        terrenoId,
        prodottoId: p.prodottoId || null,
        nome
      };
      if (numero) voce.numeroRegistrazioneLetto = numero;
      if (t.stato) voce.stato = t.stato;
      out.push(voce);
    });
  });
  return out;
}

export async function contestoRegistroTerreno(terrenoId) {
  const id = String(terrenoId || '');
  if (!id) return { specie: null, passaggi: [] };
  const passaggi = [];
  let specie = null;

  try {
    const { getAllVigneti } = await import('../../modules/vigneto/services/vigneti-service.js');
    const { getTrattamenti } = await import('../../modules/vigneto/services/trattamenti-vigneto-service.js');
    const vigneti = (await getAllVigneti()).filter((v) => String(v.terrenoId || '') === id);
    if (!specie && vigneti[0]) {
      specie = colturaSchedaRegistro({ modulo: 'vigneto', destinazioneUva: vigneti[0].destinazioneUva });
    }
    for (const v of vigneti) {
      const lista = await getTrattamenti(v.id);
      passaggi.push(...daTrattamenti(lista, id));
    }
  } catch (e) { /* modulo assente o lettura non riuscita */ }

  try {
    const { getAllFrutteti } = await import('../../modules/frutteto/services/frutteti-service.js');
    const { getTrattamenti } = await import('../../modules/frutteto/services/trattamenti-frutteto-service.js');
    const frutteti = (await getAllFrutteti()).filter((v) => String(v.terrenoId || '') === id);
    if (!specie && frutteti[0]) {
      specie = colturaSchedaRegistro({ modulo: 'frutteto', specie: frutteti[0].specie });
    }
    for (const f of frutteti) {
      const lista = await getTrattamenti(f.id);
      passaggi.push(...daTrattamenti(lista, id));
    }
  } catch (e) { /* modulo assente */ }

  try {
    const { getAllSeminativi } = await import('../../modules/seminativo/services/seminativi-service.js');
    const { getAllTrattamentiSeminativo } = await import('../../modules/seminativo/services/trattamenti-service.js');
    const campagne = (await getAllSeminativi()).filter((c) => String(c.terrenoId || '') === id);
    if (!specie && campagne[0]) {
      specie = colturaSchedaRegistro({ modulo: 'seminativo', colturaNome: campagne[0].colturaNome });
    }
    const tutti = await getAllTrattamentiSeminativo();
    passaggi.push(...daTrattamenti((tutti || []).filter((t) => String(t.terrenoId || '') === id), id));
  } catch (e) { /* modulo assente */ }

  try {
    const { getAllOrticole } = await import('../../modules/orticole/services/orticole-service.js');
    const { getAllTrattamentiOrticole } = await import('../../modules/orticole/services/trattamenti-service.js');
    const campagne = (await getAllOrticole()).filter((c) => String(c.terrenoId || '') === id);
    if (!specie && campagne[0]) {
      specie = colturaSchedaRegistro({ modulo: 'orticole', colturaNome: campagne[0].colturaNome });
    }
    const tutti = await getAllTrattamentiOrticole();
    passaggi.push(...daTrattamenti((tutti || []).filter((t) => String(t.terrenoId || '') === id), id));
  } catch (e) { /* modulo assente */ }

  return { specie, passaggi };
}
