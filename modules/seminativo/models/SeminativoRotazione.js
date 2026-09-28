/**
 * Proposta di rotazione per il piano colturale.
 * Parte dalla coltura in campo e suggerisce un genere diverso e un ruolo complementare.
 * Non certifica la PAC: l'agricoltore conferma la scelta.
 *
 * @module modules/seminativo/models/SeminativoRotazione
 */

import { defaultCampagnaLabel, normalizeCampagnaKey } from './SeminativoCampagna.js';

const PROFILI = [
  { nome: 'Grano', genere: 'triticum', ruolo: 'paglia' },
  { nome: 'Orzo', genere: 'hordeum', ruolo: 'paglia' },
  { nome: 'Avena', genere: 'avena', ruolo: 'paglia' },
  { nome: 'Segale', genere: 'secale', ruolo: 'paglia' },
  { nome: 'Mais', genere: 'zea', ruolo: 'rinnovo' },
  { nome: 'Sorgo', genere: 'sorghum', ruolo: 'rinnovo' },
  { nome: 'Girasole', genere: 'helianthus', ruolo: 'rinnovo' },
  { nome: 'Colza', genere: 'brassica', ruolo: 'rinnovo' },
  { nome: 'Canapa', genere: 'cannabis', ruolo: 'rinnovo' },
  { nome: 'Lino', genere: 'linum', ruolo: 'rinnovo' },
  { nome: 'Carthamo', genere: 'carthamus', ruolo: 'rinnovo' },
  { nome: 'Quinoa', genere: 'chenopodium', ruolo: 'rinnovo' },
  { nome: 'Soia', genere: 'glycine', ruolo: 'leguminosa' },
  { nome: 'Favino', genere: 'vicia', ruolo: 'leguminosa' },
  { nome: 'Fava', genere: 'vicia', ruolo: 'leguminosa' },
  { nome: 'Veccia', genere: 'vicia', ruolo: 'leguminosa' },
  { nome: 'Cece', genere: 'cicer', ruolo: 'leguminosa' },
  { nome: 'Lenticchia', genere: 'lens', ruolo: 'leguminosa' },
  { nome: 'Lupino', genere: 'lupinus', ruolo: 'leguminosa' },
  { nome: 'Cicerchia', genere: 'lathyrus', ruolo: 'leguminosa' },
  { nome: 'Erba Medica', genere: 'medicago', ruolo: 'leguminosa' },
  { nome: 'Trifoglio', genere: 'trifolium', ruolo: 'leguminosa' },
  { nome: 'Lupinella', genere: 'onobrychis', ruolo: 'leguminosa' },
  { nome: 'Sulla', genere: 'hedysarum', ruolo: 'leguminosa' },
  { nome: 'Riso', genere: 'oryza', ruolo: 'riso' },
  { nome: 'Grano Saraceno', genere: 'fagopyrum', ruolo: 'altro' },
  { nome: 'Amaranto', genere: 'amaranthus', ruolo: 'altro' },
  { nome: 'Miglio', genere: 'panicum', ruolo: 'altro' },
  { nome: 'Panico', genere: 'setaria', ruolo: 'altro' }
];

const POOL = {
  paglia: ['Mais', 'Soia', 'Girasole', 'Favino', 'Sorgo', 'Colza'],
  leguminosa: ['Grano', 'Mais', 'Orzo', 'Girasole', 'Avena', 'Sorgo'],
  rinnovo: ['Grano', 'Soia', 'Favino', 'Orzo', 'Avena', 'Cece'],
  riso: ['Grano', 'Soia', 'Mais', 'Favino'],
  altro: ['Grano', 'Mais', 'Soia', 'Favino', 'Girasole', 'Orzo']
};

const SCLEROTINIA = new Set(['soia', 'girasole', 'colza']);

function chiave(value) {
  return String(value || '').trim().toLowerCase();
}

export function profiloColtura(nome) {
  const key = chiave(nome);
  const found = PROFILI.find((row) => chiave(row.nome) === key);
  if (found) return found;
  return { nome: String(nome || '').trim(), genere: key || 'sconosciuto', ruolo: 'altro' };
}

function motivo(da, verso) {
  if (verso.ruolo === 'rinnovo' && da.ruolo === 'paglia') return 'Da rinnovo, spezza i cereali a paglia';
  if (verso.ruolo === 'leguminosa' && da.ruolo === 'paglia') return 'Leguminosa dopo un cereale a paglia';
  if (verso.ruolo === 'paglia' && da.ruolo === 'leguminosa') return 'Cereale dopo la leguminosa';
  if (verso.ruolo === 'paglia') return 'Cereale a paglia, genere diverso';
  if (verso.ruolo === 'leguminosa') return 'Leguminosa, genere diverso';
  if (verso.ruolo === 'rinnovo') return 'Da rinnovo, genere diverso';
  return 'Genere diverso';
}

/**
 * @param {string} colturaNome
 * @param {string[]} [storicoNomi] colture recenti sullo stesso terreno, compresa quella in campo
 * @returns {{ nome: string, motivo: string }[]}
 */
export function proponiRotazione(colturaNome, storicoNomi) {
  const attuale = profiloColtura(colturaNome);
  if (!chiave(colturaNome)) return [];
  const recenti = new Set((storicoNomi || []).map(chiave));
  recenti.add(chiave(attuale.nome));
  const pool = POOL[attuale.ruolo] || POOL.altro;
  const proposte = [];
  pool.forEach((nome) => {
    if (proposte.length >= 4) return;
    const verso = profiloColtura(nome);
    if (verso.genere === attuale.genere) return;
    if (recenti.has(chiave(nome))) return;
    if (SCLEROTINIA.has(chiave(attuale.nome)) && SCLEROTINIA.has(chiave(nome))) return;
    proposte.push({ nome, motivo: motivo(attuale, verso) });
  });
  return proposte;
}

/** Testo di avviso se la scelta è debole. Stringa vuota se la scelta va bene. */
export function avvisoSceltaRotazione(precedente, scelta) {
  const da = profiloColtura(precedente);
  const verso = profiloColtura(scelta);
  if (!chiave(precedente) || !chiave(scelta)) return '';
  if (chiave(da.nome) === chiave(verso.nome) || (da.genere && da.genere === verso.genere)) {
    return 'Stesso genere della coltura in campo. La rotazione chiede un genere diverso.';
  }
  if (SCLEROTINIA.has(chiave(da.nome)) && SCLEROTINIA.has(chiave(verso.nome))) {
    return 'Condividono gli stessi rischi di malattia. Conviene un cereale a paglia.';
  }
  if (da.ruolo === 'paglia' && verso.ruolo === 'paglia') {
    return 'Due cereali a paglia di fila. Conviene un rinnovo o una leguminosa.';
  }
  return '';
}

export function campagnaSuccessiva(label) {
  const match = String(label || '').match(/(\d{4})\s*\/\s*(\d{4})/);
  if (!match) return '';
  const start = Number(match[1]) + 1;
  const end = Number(match[2]) + 1;
  if (end !== start + 1) return '';
  return `${start}/${end}`;
}

function annoInizio(label) {
  const match = String(label || '').match(/(\d{4})/);
  return match ? Number(match[1]) : 0;
}

function etichettaTerreno(terreno) {
  if (!terreno) return '';
  const nome = String(terreno.nome || '').trim();
  const podere = String(terreno.podere || '').trim();
  if (nome && podere) return `${nome} – ${podere}`;
  return nome || podere || 'Terreno senza nome';
}

/**
 * Una riga per terreno seminativo: coltura in campo e proposte per la campagna successiva.
 * La campagna futura già salvata non diventa la coltura in campo.
 */
export function righePianoColturale(input = {}) {
  const oggi = input.campagna || defaultCampagnaLabel(input.now || new Date());
  const annoOggi = annoInizio(oggi);
  const campagne = input.campagne || [];

  return (input.terreni || []).map((terreno) => {
    const mie = campagne.filter((row) => row && String(row.terrenoId || '') === String(terreno.id || ''));
    const inCampo = mie
      .filter((row) => annoInizio(row.campagna) <= annoOggi)
      .sort((a, b) => annoInizio(b.campagna) - annoInizio(a.campagna));
    const ultima = inCampo[0] || null;
    const campagnaDopo = ultima ? campagnaSuccessiva(ultima.campagna) : '';
    const successiva = campagnaDopo
      ? mie.find((row) => normalizeCampagnaKey(row.campagna) === normalizeCampagnaKey(campagnaDopo)) || null
      : null;
    const storico = inCampo.slice(0, 3).map((row) => row.colturaNome).filter(Boolean);
    return {
      terrenoId: terreno.id || null,
      terrenoNome: etichettaTerreno(terreno),
      campagnaAttuale: ultima ? ultima.campagna : '',
      colturaAttuale: ultima ? (ultima.colturaNome || '') : '',
      superficieEttari: ultima ? ultima.superficieEttari : null,
      campagnaSuccessiva: campagnaDopo,
      successivaId: successiva ? successiva.id : null,
      successivaStato: successiva ? (successiva.stato || '') : '',
      colturaScelta: successiva ? (successiva.colturaNome || '') : '',
      proposte: ultima ? proponiRotazione(ultima.colturaNome, storico) : []
    };
  });
}
