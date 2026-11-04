/**
 * Cambio coltura e propagazione superficie al salvataggio del terreno.
 * @module shared/js/effetti-salvataggio-terreno
 */

import { isColturaFrutteto, famigliaColtura } from './coltura-terreno.js';
import { isLavoroChiuso } from './storico-sola-lettura.js';

/**
 * Testo della tendina categoria. Il segnaposto («-- Seleziona categoria --») non è una categoria.
 * @param {{ value?: string, selectedOptions?: Array<{ textContent?: string }> }|null|undefined} select
 * @returns {string|null}
 */
export function testoCategoriaColtura(select) {
  if (!select || !select.value) return null;
  const opt = select.selectedOptions && select.selectedOptions[0];
  const testo = opt ? String(opt.textContent || '').trim() : '';
  return testo || null;
}

export function cambioCategoriaColtura(prima, dopo) {
  const a = famigliaColtura(prima);
  const b = famigliaColtura(dopo);
  if (a === b) return false;
  const speciali = new Set(['vigneto', 'frutteto']);
  return speciali.has(a) || speciali.has(b);
}

function formattaDataBreve(value) {
  if (!value) return '';
  const data = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(data.getTime())) return '';
  const g = String(data.getDate()).padStart(2, '0');
  const m = String(data.getMonth() + 1).padStart(2, '0');
  return `${g}/${m}`;
}

export function aggiornaStoricoColture(esistente, nuovo, now) {
  const storico = Array.isArray(esistente && esistente.storicoColture)
    ? esistente.storicoColture.slice()
    : [];
  if (esistente && (esistente.coltura || esistente.colturaCategoria)) {
    storico.push({
      coltura: esistente.coltura || null,
      colturaCategoria: esistente.colturaCategoria || null,
      dal: esistente.colturaDal || esistente.createdAt || null,
      al: now
    });
  }
  return {
    storicoColture: storico,
    colturaDal: now,
    coltura: nuovo.coltura || null,
    colturaCategoria: nuovo.colturaCategoria || null
  };
}

function nomeImpianto(impianto, tipo) {
  return impianto.varieta || impianto.nome || impianto.specie || (tipo === 'frutteto' ? 'Frutteto' : 'Vigneto');
}

export function annoInizioCampagna(etichetta) {
  const match = String(etichetta || '').match(/(\d{4})/);
  return match ? Number(match[1]) : null;
}

export function campagnaCorrenteOFutura(campagna, now = new Date()) {
  const inizio = annoInizioCampagna(campagna && (campagna.campagna || campagna.anno));
  if (inizio == null) return false;
  const mese = now.getMonth();
  const annoCorrente = mese >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return inizio >= annoCorrente;
}

export function superficieCambiata(prima, dopo) {
  const a = prima == null || prima === '' ? null : Number(prima);
  const b = dopo == null || dopo === '' ? null : Number(dopo);
  if (b == null || Number.isNaN(b)) return false;
  if (a == null || Number.isNaN(a)) return true;
  return Math.abs(a - b) > 0.0001;
}

/**
 * @param {Function} conferma - riceve il messaggio e restituisce true/false
 */
export function preparaEffettiSalvataggioTerreno({
  esistente,
  nuovo,
  vigneti = [],
  frutteti = [],
  lavori = [],
  campagne = [],
  now = new Date().toISOString(),
  oggi = new Date(),
  conferma
} = {}) {
  const effetti = {
    procedi: true,
    storico: null,
    chiudi: [],
    superfici: [],
    messaggioSuperficie: ''
  };
  if (!esistente) return effetti;

  const cambia = cambioCategoriaColtura(esistente, {
    coltura: nuovo.coltura,
    colturaCategoria: nuovo.colturaCategoria || esistente.colturaCategoria
  });
  const impianti = []
    .concat((vigneti || []).filter((v) => v.statoImpianto !== 'chiuso').map((v) => ({ ...v, _tipo: 'vigneto' })))
    .concat((frutteti || []).filter((f) => f.statoImpianto !== 'chiuso').map((f) => ({ ...f, _tipo: 'frutteto' })));
  const aperti = (lavori || []).filter((l) => !isLavoroChiuso(l));

  if (cambia && (impianti.length || aperti.length)) {
    const parti = [];
    if (impianti.length) {
      const nomi = impianti.map((i) => `${i._tipo === 'frutteto' ? 'il frutteto' : 'il vigneto'} «${nomeImpianto(i, i._tipo)}»`);
      parti.push(`Su questo terreno c'è ${nomi.join(', ')}. Cambiando coltura lo chiudo: resta nello storico con potature, trattamenti e vendemmie, ma non è più modificabile.`);
    }
    if (aperti.length) {
      const voci = aperti.map((l) => {
        const quando = formattaDataBreve(l.dataInizio);
        return quando ? `«${l.nome || 'Lavoro'}» (dal ${quando})` : `«${l.nome || 'Lavoro'}»`;
      });
      parti.push(`Su questo terreno ci sono ${aperti.length} lavori ancora aperti: ${voci.join(', ')}. Restano modificabili finché non li completi o li annulli; poi diventano storico, in sola lettura.`);
    }
    const ok = typeof conferma === 'function' ? conferma(parti.join('\n\n')) : false;
    if (!ok) {
      effetti.procedi = false;
      return effetti;
    }
    effetti.chiudi = impianti.map((i) => ({ id: i.id, tipo: i._tipo, nome: nomeImpianto(i, i._tipo) }));
  }

  if (cambia) {
    effetti.storico = aggiornaStoricoColture(esistente, nuovo, now);
  }

  if (superficieCambiata(esistente.superficie, nuovo.superficie)) {
    const attiviVigneti = (vigneti || []).filter((v) => v.statoImpianto !== 'chiuso');
    const attiviFrutteti = (frutteti || []).filter((f) => f.statoImpianto !== 'chiuso');
    const campagneAgg = (campagne || []).filter((c) => campagnaCorrenteOFutura(c, oggi));
    effetti.superfici = [
      ...attiviVigneti.map((v) => ({ id: v.id, collezione: 'vigneti', nome: nomeImpianto(v, 'vigneto'), tipo: 'vigneto' })),
      ...attiviFrutteti.map((f) => ({ id: f.id, collezione: 'frutteti', nome: nomeImpianto(f, 'frutteto'), tipo: 'frutteto' })),
      ...campagneAgg.map((c) => ({ id: c.id, collezione: 'seminativi', nome: c.campagna || 'campagna', tipo: 'campagna' }))
    ];
    if (effetti.superfici.length) {
      const primo = effetti.superfici[0];
      const etichetta = primo.tipo === 'campagna' ? `della campagna «${primo.nome}»` : `del ${primo.tipo} «${primo.nome}»`;
      effetti.messaggioSuperficie = `Aggiornata anche la superficie ${etichetta}`;
      if (effetti.superfici.length > 1) {
        effetti.messaggioSuperficie += ` e di altri ${effetti.superfici.length - 1} collegamenti`;
      }
      effetti.messaggioSuperficie += '.';
    }
  }

  return effetti;
}

export { isColturaFrutteto };
