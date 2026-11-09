/**
 * Logica pura dell'aiuto per l'account (passo 14).
 * Niente Vue, niente rete, niente persistenza browser.
 */

import { EMAIL_CONTATTO } from '../config/landing-config.js';
import { testiLanding } from '../content/testi-landing.js';
import {
  ERRORI,
  LIMITI,
  risolviControAzienda,
  trovaColtura,
  validaRichiestaSetup,
} from './generati/tony-landing-setup-core.js';

export const PASSI_AIUTO = Object.freeze(['sede', 'poderi', 'terreni']);

const PREFISSI_PODERE = Object.freeze([
  'podere',
  'cascina',
  'tenuta',
  'fattoria',
  'azienda',
]);

const MESSAGGI_PASSAGGIO = Object.freeze({
  sede: 'Andiamo avanti: hai dei poderi?',
  poderi:
    'Ok, passiamo ai terreni. Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?',
  terreni: 'Facciamo così: controlla il riepilogo e completa lì.',
});

/** Allineato a functions/lib/tony-landing-account.js (SINONIMI_COLTURA). */
const SINONIMI_COLTURA = Object.freeze([
  { chiavi: ['vigna', 'uva', 'vite'], nome: 'Vite da Vino' },
  { chiavi: ['mele', 'melo'], nome: 'Melo' },
  { chiavi: ['pere', 'pero'], nome: 'Pero' },
  { chiavi: ['pesche', 'peschi', 'pesco'], nome: 'Pesco' },
  { chiavi: ['noci', 'noce'], nome: 'Noce' },
  { chiavi: ['albicocco', 'albicocchi'], nome: 'Albicocche' },
  { chiavi: ['susini', 'susino'], nome: 'Susino' },
  { chiavi: ['ciliegie', 'ciliegi', 'ciliegio'], nome: 'Ciliegio' },
  { chiavi: ['fichi', 'fico'], nome: 'Fico' },
  { chiavi: ['pompelmi', 'pompelmo'], nome: 'Pompelmo' },
  { chiavi: ['olive', 'olivo'], nome: 'Olivo' },
  { chiavi: ['grano duro', 'grano tenero', 'grano'], nome: 'Grano' },
]);

export const DOMANDA_PRIMO_TERRENO =
  'Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?';

/**
 * @param {string} passo
 * @returns {string | null}
 */
export function prossimoPasso(passo) {
  const i = PASSI_AIUTO.indexOf(passo);
  if (i < 0 || i >= PASSI_AIUTO.length - 1) return null;
  return PASSI_AIUTO[i + 1];
}

export const ERRORE_ORTAGGIO_SCHEDA =
  "Scegli l'ortaggio dall'elenco (es. Pomodoro, Insalata)";

/** Allineato a functions/lib/tony-landing-account.js */
export function colturaOrtaggiGenerica(grezzo) {
  const s = String(grezzo == null ? '' : grezzo).toLowerCase();
  if (!s) return false;
  return /\b(ortagg\w*|orto|orti|ortiv\w*|verdur\w*)(?![a-zà-öø-ÿ])/i.test(s);
}

/**
 * @param {unknown} grezzo
 * @returns {string | null} nome canonico catalogo
 */
export function normalizzaColturaCatalogo(grezzo) {
  const testo = String(grezzo == null ? '' : grezzo).trim();
  if (!testo || colturaOrtaggiGenerica(testo)) return null;
  const trovata = trovaColtura(testo, []);
  if (trovata.ok) return trovata.nome;
  const chiave = chiaveNome(testo);
  for (let i = 0; i < SINONIMI_COLTURA.length; i++) {
    const voce = SINONIMI_COLTURA[i];
    for (let j = 0; j < voce.chiavi.length; j++) {
      if (chiaveNome(voce.chiavi[j]) === chiave) {
        const canon = trovaColtura(voce.nome, []);
        return canon.ok ? canon.nome : voce.nome;
      }
    }
  }
  return null;
}

/** Via/civico/comune: non è un terreno (il civico non è ettari). */
export function sembraIndirizzo(domanda) {
  const d = String(domanda || '');
  if (!d) return false;
  if (/\b(?:ha\b|ettari?\b)\b/i.test(d)) return false;
  if (/\b\d+(?:[.,]\d+)?\s+di\s+[a-zà-öø-ÿ]/i.test(d)) return false;
  return /\b(?:via|viale|corso|piazza|piazzale|vicolo|strada|contrada|localit[aà]|loc\.?)\b/i.test(
    d
  );
}

/** Nome inventato dal modello a partire da una via. */
export function nomeSembraIndirizzo(nome) {
  return /\b(?:via|viale|corso|piazza|piazzale|vicolo|strada|contrada)\b/i.test(
    String(nome || '')
  );
}

/**
 * Misura terreno chiara (ha / «N di coltura»), non un civico.
 * @param {string} domanda
 */
export function domandaTerrenoEsplicita(domanda) {
  const d = String(domanda || '');
  if (!d || sembraIndirizzo(d)) return false;
  if (/\b(\d+(?:[.,]\d+)?)\s*(?:ha\b|ettari?\b)/i.test(d)) return true;
  if (/\b(\d+(?:[.,]\d+)?)\s+di\s+[a-zà-öø-ÿ]/i.test(d)) return true;
  return false;
}

/** Refusi comuni di «si chiama». */
export const RE_SI_CHIAMA =
  /(?:si\s+(?:chiama|piama|kiama|chama)|il nome (?:del terreno\s+)?(?:è|e')|chiamat[oa]|chiamalo)\s+/i;

export function messaggioHaTerreno(domanda) {
  const d = String(domanda || '');
  if (sembraIndirizzo(d)) return false;
  if (/\b(\d+(?:[.,]\d+)?)\s*(?:ha|ettar)/i.test(d)) return true;
  if (/\b(\d+(?:[.,]\d+)?)\s+di\s+[a-zà-öø-ÿ]/i.test(d)) return true;
  if (/\b(\d+(?:[.,]\d+)?)\s+(?!ha\b|ettari?\b|di\b)[a-zà-öø-ÿ]/i.test(d)) {
    // Numero + parola senza ha: solo se non è un indirizzo (già escluso) e
    // la parola è una coltura/categoria nota, altrimenti è civico+comune.
    const m = d.match(
      /(\d+(?:[.,]\d+)?)\s+(?!ha\b|ettari?\b|ettaro\b|di\b)([A-Za-zÀ-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ'’-]*)/i
    );
    if (m && (normalizzaColturaCatalogo(m[2]) || soloCategoriaColtura(m[2]))) return true;
    return false;
  }
  return /\bterren|campo|cappezz|coltiv|semin/i.test(d);
}

export function messaggioSoloPodere(domanda) {
  const d = String(domanda || '').toLowerCase();
  return (
    /\bno[\s,]*(solo|soltanto|unico)\b/.test(d) ||
    /\bsolo quello\b/.test(d) ||
    /\bno,\s*solo\b/.test(d)
  );
}

/** Domanda fissa del passo poderi (facoltativo: un no non ne inventa). */
export const DOMANDA_PODERI = 'Hai uno o più poderi? Dimmi come li chiami.';

const STOP_NOME_TERRENO = Object.freeze([
  'ho',
  'hai',
  'ha',
  'di',
  'da',
  'un',
  'uno',
  'una',
  'il',
  'lo',
  'la',
  'ettaro',
  'ettari',
  'ettar',
]);

/**
 * «no» da solo vale solo nel passo poderi.
 * «non ho poderi» vale in qualsiasi passo.
 * «no, solo quello» non è un rifiuto: il podere c'è già.
 * @param {string} domanda
 * @param {string} [passo]
 */
export function messaggioNegaPoderi(domanda, passo) {
  if (messaggioSoloPodere(domanda)) return false;
  const d = String(domanda || '').trim().toLowerCase();
  if (!d) return false;
  if (/\b(non ho|senza|nessun|niente)\s+poder/.test(d)) return true;
  if (passo === 'poderi' && /^(no|nope|niente|nessuno|nessuna)\b/.test(d)) return true;
  return false;
}

function soloCategoriaColtura(grezzo) {
  const testo = String(grezzo || '').trim();
  if (!testo) return false;
  const trovata = trovaColtura(testo, []);
  return !trovata.ok && trovata.errore === ERRORI.CATEGORIA_NON_COLTURA;
}

function colturaDetta(grezzo, opts) {
  const testo = String(grezzo || '').trim();
  if (!testo || soloCategoriaColtura(testo)) return null;
  const catalogo = normalizzaColturaCatalogo(testo);
  if (catalogo) return catalogo;
  // Varietà libera solo se la frase ha ha/di («3 ha di sangiovese»);
  // altrimenti non creare una coltura fantasma (es. «Faenza» da un civico).
  if (opts && opts.consentiLibera === true) return inizialeMaiuscola(testo);
  return null;
}

/** Restano nel nome: «campo vecchio», «vigna alta». Trebbiano e sangiovese no. */
const PAROLE_NEL_NOME = Object.freeze([
  'vecchio',
  'vecchia',
  'nuovo',
  'nuova',
  'grande',
  'piccolo',
  'piccola',
  'alto',
  'alta',
  'basso',
  'bassa',
  'lungo',
  'lunga',
  'primo',
  'prima',
  'secondo',
  'seconda',
]);

function restaNelNome(parola) {
  return PAROLE_NEL_NOME.indexOf(String(parola || '').toLowerCase()) >= 0;
}

function staccaVarietaDalNome(nome) {
  const parole = String(nome || '')
    .split(/\s+/)
    .filter(Boolean);
  if (parole.length < 2) return { nome: parole.join(' '), varieta: '' };
  const ultima = parole[parole.length - 1];
  if (restaNelNome(ultima)) return { nome: parole.join(' '), varieta: '' };
  return { nome: parole.slice(0, -1).join(' '), varieta: ultima };
}

/**
 * «12 di seminativo» è una misura anche senza la parola ettari.
 * @param {string} pezzo
 * @returns {{ superficie: number|null, varieta: string|null, index: number }|null}
 */
function misuraNelPezzo(pezzo) {
  if (sembraIndirizzo(pezzo)) return null;
  const ha = String(pezzo || '').match(/(\d+(?:[.,]\d+)?)\s*(?:ha\b|ettari?\b)/i);
  if (ha) {
    let varieta = null;
    const varM = pezzo.match(
      /(?:ha\b|ettari?\b)\s*(?:,\s*)?(?:(?:di|a|ad|al|allo|alla)\s+)?([A-Za-zÀ-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ'’-]*)/i
    );
    if (
      varM &&
      STOP_NOME_TERRENO.indexOf(varM[1].toLowerCase()) < 0 &&
      !/^che$/i.test(varM[1])
    ) {
      varieta = varM[1];
    }
    return {
      superficie: Number(String(ha[1]).replace(',', '.')),
      varieta,
      index: ha.index,
    };
  }
  const di = String(pezzo || '').match(
    /(\d+(?:[.,]\d+)?)\s+di\s+([A-Za-zÀ-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ'’-]*)/i
  );
  if (di && STOP_NOME_TERRENO.indexOf(di[2].toLowerCase()) < 0) {
    return {
      superficie: Number(String(di[1]).replace(',', '.')),
      varieta: di[2],
      index: di.index,
    };
  }
  // «5 faenza» / civico+comune: senza ha/di non inventare ettari, salvo coltura nota
  // («12 mais» / «3 sorgo»).
  const nudo = String(pezzo || '').match(
    /(\d+(?:[.,]\d+)?)\s+(?!ha\b|ettari?\b|ettaro\b|di\b)([A-Za-zÀ-ÖØ-öø-ÿ][\wÀ-ÖØ-öø-ÿ'’-]*)/i
  );
  if (
    nudo &&
    STOP_NOME_TERRENO.indexOf(nudo[2].toLowerCase()) < 0 &&
    (normalizzaColturaCatalogo(nudo[2]) || soloCategoriaColtura(nudo[2]))
  ) {
    return {
      superficie: Number(String(nudo[1]).replace(',', '.')),
      varieta: nudo[2],
      index: nudo.index,
    };
  }
  return null;
}

/**
 * Toglie connettivi finali lasciati da «campo largo con 12 ha…».
 * «a»/«e» solo se minuscoli (così «Campo A» resta un nome valido).
 * @param {string} grezzo
 * @returns {string}
 */
export function togliConnettiviFinaliNome(grezzo) {
  let t = String(grezzo || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';
  while (true) {
    const m = t.match(/\s+(con|di|da|a|e)$/i);
    if (!m) break;
    const w = m[1];
    if (/^[ae]$/i.test(w) && w !== w.toLowerCase()) break;
    t = t.slice(0, m.index).trim();
  }
  return t;
}

function pulisciNomeCandidato(grezzo) {
  let t = String(grezzo || '').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(?:ho|ci sono|c'è|ce)\s+/i, '');
  t = t.replace(/^(?:un|uno|una|il|lo|la|i|gli|le)\s+/i, '');
  t = t.replace(/^(?:terreno|appezzamento)\s+/i, '');
  t = togliConnettiviFinaliNome(t);
  t = t.replace(/^[\s:,\-–—]+|[\s:,\-–—.?!]+$/g, '').trim();
  if (!t || [...t].length > 80) return null;
  if (!nomeTerrenoVisibile(t)) return null;
  if (STOP_NOME_TERRENO.indexOf(t.toLowerCase()) >= 0) return null;
  return t;
}

/**
 * Spezza la frase in terreni detti dall'utente.
 * Il nome è esplicito solo se non è la varietà/coltura attaccata agli ettari.
 * @param {string} domanda
 * @returns {Array<{ nome: string|null, varieta: string|null, superficie: number|null }>}
 */
export function interpretaFraseTerreni(domanda) {
  const raw = String(domanda || '').trim();
  if (!raw) return [];
  if (sembraIndirizzo(raw)) return [{ nome: null, varieta: null, superficie: null }];
  const chiama = raw.match(
    new RegExp(RE_SI_CHIAMA.source + '(.+?)(?:[,.]|$)', 'i')
  );
  const nomeDetto = chiama ? pulisciNomeCandidato(chiama[1]) : null;
  const parti = raw.split(/\s+e\s+/i);
  const conSuperficie = parti.filter((p) => misuraNelPezzo(p));
  const pezzi = conSuperficie.length >= 2 ? conSuperficie : [raw];
  return pezzi.map((pezzo) => {
    const misura = misuraNelPezzo(pezzo);
    const superficie = misura ? misura.superficie : null;
    let varieta = misura ? misura.varieta : null;
    let nome = null;
    if (nomeDetto && pezzi.length === 1) nome = nomeDetto;
    else if (misura) {
      const prima = pezzo.slice(0, misura.index);
      const cand = pulisciNomeCandidato(prima);
      if (cand && (!varieta || chiaveNome(cand) !== chiaveNome(varieta))) nome = cand;
    }
    if (nome && !varieta && nomeDetto && misura) {
      const prima = pulisciNomeCandidato(pezzo.slice(0, misura.index));
      if (prima && chiaveNome(prima) !== chiaveNome(nome)) {
        const ultima = prima.split(/\s+/).pop();
        if (ultima && chiaveNome(ultima) !== chiaveNome(nome)) varieta = ultima;
      }
    }
    if (nome && !varieta) {
      const staccata = staccaVarietaDalNome(nome);
      if (staccata.varieta) {
        varieta = staccata.varieta;
        nome = staccata.nome;
      }
    }
    if (nome && varieta && chiaveNome(nome) === chiaveNome(varieta)) nome = null;
    return { nome, varieta, superficie };
  });
}

function stessoNome(a, b) {
  const ka = chiaveNome(a);
  const kb = chiaveNome(b);
  return !!ka && ka === kb;
}

/**
 * Se c'è un solo terreno senza nome, una risposta breve è il nome.
 * @param {string} domanda
 * @param {Array<{ nome?: string }>|undefined} terreniAttuali
 * @returns {string|null}
 */
export function nomeLiberoSeInAttesa(domanda, terreniAttuali) {
  const pendenti = (Array.isArray(terreniAttuali) ? terreniAttuali : []).filter(
    (t) => t && !nomeTerrenoVisibile(t.nome)
  );
  if (pendenti.length !== 1) return null;
  const s = String(domanda || '').trim();
  if (!s || [...s].length > 80) return null;
  if (/\d/.test(s)) return null;
  if (/\b(ha\b|ettar|podere|poderi|riepilogo|coltura)\b/i.test(s)) return null;
  if (/^(no|nope|sì|si|basta|fatto|niente)\b/i.test(s)) return null;
  if (!String(pendenti[0].coltura || '').trim() && normalizzaColturaCatalogo(s)) return null;
  const detto = interpretaFraseTerreni(s).find((x) => x.nome);
  if (detto && detto.nome) return detto.nome;
  return pulisciNomeCandidato(s);
}

function assegnaColtura(out, detto, opts) {
  const libera = !!(opts && opts.consentiLibera);
  const grezzo =
    out.coltura != null && String(out.coltura).trim() ? String(out.coltura).trim() : '';
  if (grezzo && soloCategoriaColtura(grezzo)) {
    out.categoria = out.categoria || grezzo;
    out.coltura = null;
  } else if (grezzo) {
    const norm = normalizzaColturaCatalogo(grezzo);
    if (norm) out.coltura = norm;
    else if (libera && !detto) out.coltura = inizialeMaiuscola(grezzo);
    else out.coltura = null;
  }
  if (!out.coltura && detto) {
    if (soloCategoriaColtura(detto)) out.categoria = out.categoria || detto;
    else {
      const canon = normalizzaColturaCatalogo(detto);
      if (canon) out.coltura = canon;
      else if (libera) {
        // Varietà libera (es. Trebbiano) solo con ha/di; altrimenti chiedi in chat.
        out.coltura = colturaDetta(detto, { consentiLibera: true });
      } else {
        out.coltura = null;
      }
    }
  } else if (out.coltura && detto) {
    // Preferisci il nome canonico del catalogo (noci → Noce), non il grezzo.
    const daDetto = normalizzaColturaCatalogo(detto);
    if (daDetto) out.coltura = daDetto;
  }
}

function inizialeMaiuscola(s) {
  const t = String(s || '');
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase('it') + t.slice(1);
}

function voceDaMisura(l, domanda) {
  const varieta = l && l.varieta ? l.varieta : null;
  const out = {
    nome: l && l.nome ? inizialeMaiuscola(l.nome) : null,
    superficie: l && typeof l.superficie === 'number' ? l.superficie : null,
    coltura: null,
    podere: null,
  };
  const libera = domandaTerrenoEsplicita(domanda);
  assegnaColtura(out, varieta, { consentiLibera: libera });
  if (out.coltura && varieta && out.coltura === varieta) out.coltura = inizialeMaiuscola(out.coltura);
  return out;
}

/**
 * «mais» dopo «12 di seminativo» è la coltura del terreno ancora senza coltura,
 * non il suo nome.
 * @param {string} domanda
 * @param {Array<object>} attuali
 * @returns {string|null}
 */
function colturaFuoriCatalogo(t) {
  if (!t) return false;
  const haDati =
    nomeTerrenoVisibile(t.nome) ||
    typeof t.superficie === 'number' ||
    t.categoria ||
    String(t.coltura || '').trim();
  if (!haDati) return false;
  const col = String(t.coltura || '').trim();
  if (!col) return typeof t.superficie === 'number' || !!t.categoria;
  return !normalizzaColturaCatalogo(col);
}

/**
 * «pesco» da solo corregge l'unico terreno in attesa di coltura.
 * «mais» dopo un seminativo senza nome resta la coltura, non un terreno nuovo.
 * @returns {{ terreno: object, coltura: string }|null}
 */
function correzioneColturaBreve(domanda, attuali) {
  const s = String(domanda || '').trim();
  if (!s || /\d/.test(s) || s.split(/\s+/).length > 3) return null;
  const coltura = normalizzaColturaCatalogo(s);
  if (!coltura) return null;
  const attesa = (Array.isArray(attuali) ? attuali : []).filter(colturaFuoriCatalogo);
  if (attesa.length !== 1) return null;
  return { terreno: attesa[0], coltura };
}

/**
 * La varietà detta con gli ettari non è il nome del terreno.
 * Senza un nome esplicito, anche un nome inventato dal modello si toglie.
 * Un nome già in elenco, o detto in modo esplicito, resta.
 * @param {string} domanda
 * @param {Array<object>|undefined} terreniNuovi
 * @param {Array<object>|undefined} terreniAttuali
 */
/**
 * La frase è la fonte del turno: un nome già noto resta, la coltura detta
 * come secondo terreno si toglie, e un appezzamento omesso dal modello si tiene.
 * @param {Array<{ nome: string|null, varieta: string|null, superficie: number|null }>} letti
 * @param {Array<object>} lista
 * @param {Array<object>} attuali
 */
function allineaListaAllaFrase(letti, lista, attuali, domanda) {
  const misure = (Array.isArray(letti) ? letti : []).filter(
    (l) => l && (l.superficie != null || l.varieta)
  );
  if (!misure.length) return lista;
  const noti = Object.create(null);
  for (const t of Array.isArray(attuali) ? attuali : []) {
    const nome = nomeTerrenoVisibile(t && t.nome);
    if (nome) noti[chiaveTerreno(nome)] = true;
  }
  const usati = Object.create(null);
  const tenuti = [];
  for (const l of misure) {
    let scelto = -1;
    for (let i = 0; i < lista.length; i++) {
      if (usati[i] || !lista[i]) continue;
      if (l.superficie != null && lista[i].superficie !== l.superficie) continue;
      const nome = nomeTerrenoVisibile(lista[i].nome);
      if (l.nome && nome && stessoNome(nome, l.nome)) {
        scelto = i;
        break;
      }
      if (nome && noti[chiaveTerreno(nome)] && !(l.nome && stessoNome(nome, l.nome))) continue;
      if (l.varieta && nome && stessoNome(nome, l.varieta)) continue;
      if (scelto < 0) scelto = i;
    }
    if (scelto >= 0) {
      usati[scelto] = true;
      const voce = Object.assign({}, lista[scelto]);
      if (l.nome) voce.nome = inizialeMaiuscola(l.nome);
      tenuti.push(voce);
    } else {
      tenuti.push(voceDaMisura(l, domanda));
    }
  }
  for (let i = 0; i < lista.length; i++) {
    if (usati[i] || !lista[i]) continue;
    const nome = nomeTerrenoVisibile(lista[i].nome);
    if (nome && noti[chiaveTerreno(nome)]) tenuti.push(lista[i]);
  }
  return tenuti;
}

export function correggiTerreniEstratti(domanda, terreniNuovi, terreniAttuali) {
  const letti = interpretaFraseTerreni(domanda);
  const attuali = Array.isArray(terreniAttuali) ? terreniAttuali : [];
  const nomeLibero = nomeLiberoSeInAttesa(domanda, attuali);
  const lista = Array.isArray(terreniNuovi)
    ? terreniNuovi.map((t) => (t && typeof t === 'object' ? Object.assign({}, t) : t))
    : [];
  const correzione = correzioneColturaBreve(domanda, attuali);
  if (correzione) {
    const pend = correzione.terreno;
    return [
      {
        nome: nomeTerrenoVisibile(pend && pend.nome) || null,
        superficie: pend && typeof pend.superficie === 'number' ? pend.superficie : null,
        coltura: correzione.coltura,
        podere: pend && pend.podere ? pend.podere : null,
        categoria: pend && pend.categoria ? pend.categoria : undefined,
      },
    ];
  }

  if (nomeLibero) {
    const pend = attuali.filter((t) => t && !nomeTerrenoVisibile(t.nome));
    if (pend.length === 1) {
      const base = pend[0];
      const dalModello = lista.find(
        (t) => t && nomeTerrenoVisibile(t.nome) && stessoNome(t.nome, nomeLibero)
      );
      return [
        {
          nome: dalModello ? nomeTerrenoVisibile(dalModello.nome) : nomeLibero,
          superficie: typeof base.superficie === 'number' ? base.superficie : null,
          coltura: base.coltura || null,
          podere: base.podere || null,
          categoria: base.categoria,
        },
      ];
    }
  }

  const liberaColtura = domandaTerrenoEsplicita(domanda);
  if (!lista.length) {
    const misure = letti.filter((l) => l && (l.superficie != null || l.varieta));
    if (misure.length) return misure.map((l) => voceDaMisura(l, domanda));
  }

  const usati = Object.create(null);
  const mapped = lista.map((t) => {
    if (!t || typeof t !== 'object') return t;
    let letto = null;
    if (typeof t.superficie === 'number') {
      const idx = letti.findIndex(
        (l, n) => !usati[n] && l.superficie === t.superficie
      );
      if (idx >= 0) {
        usati[idx] = true;
        letto = letti[idx];
      }
    }
    if (!letto) {
      const idx = letti.findIndex((_, n) => !usati[n]);
      if (idx >= 0 && letti.length === lista.length) {
        usati[idx] = true;
        letto = letti[idx];
      }
    }
    const nomeModello = nomeTerrenoVisibile(t.nome);
    const giaDato = nomeModello
      ? attuali.some((a) => a && stessoNome(a.nome, nomeModello))
      : false;
    if (nomeModello && nomeSembraIndirizzo(nomeModello) && !giaDato) {
      return null;
    }
    let nome = nomeModello;
    if (letto && letto.nome) {
      if (nomeModello && giaDato && !stessoNome(nomeModello, letto.nome)) nome = nomeModello;
      else nome = nomeModello && stessoNome(nomeModello, letto.nome) ? nomeModello : letto.nome;
    }
    else if (!giaDato && letto && !letto.nome) nome = '';
    else if (
      !giaDato &&
      !letto &&
      lista.length === 1 &&
      letti.some((l) => l && !l.nome && (l.superficie != null || l.varieta))
    ) {
      nome = '';
    }
    if (nomeLibero && lista.length === 1) nome = nomeLibero;
    const lettoAltrui =
      nomeModello && giaDato && letto && letto.nome && !stessoNome(nomeModello, letto.nome);
    const lettoUtile = lettoAltrui ? null : letto;
    const out = Object.assign({}, t, { nome: nome || null });
    assegnaColtura(out, lettoUtile && lettoUtile.varieta, { consentiLibera: liberaColtura });
    if (
      (out.superficie == null || out.superficie === '') &&
      lettoUtile &&
      typeof lettoUtile.superficie === 'number'
    ) {
      out.superficie = lettoUtile.superficie;
    }
    // Coltura non in catalogo e senza misura esplicita: non creare in silenzio.
    if (
      !liberaColtura &&
      out.coltura &&
      !normalizzaColturaCatalogo(out.coltura) &&
      !giaDato
    ) {
      out.coltura = null;
      if (!out.categoria && !nomeTerrenoVisibile(out.nome) && out.superficie == null) {
        return null;
      }
    }
    return out;
  }).filter(Boolean);
  return allineaListaAllaFrase(letti, mapped, attuali, domanda);
}

function descriviTerrenoSenzaNome(t, letto) {
  const varieta =
    (letto && letto.varieta) || (t && t.coltura ? String(t.coltura) : '');
  const n = t && typeof t.superficie === 'number' ? t.superficie : null;
  const ett =
    n == null ? '' : String(n).replace('.', ',') + (n === 1 ? ' ettaro' : ' ettari');
  if (ett && varieta) return ett + ' di ' + varieta;
  if (ett) return ett;
  if (varieta) return varieta;
  return '';
}

export function terreniInAttesaNome(terreni) {
  return (Array.isArray(terreni) ? terreni : []).filter(
    (t) =>
      t &&
      !nomeTerrenoVisibile(t.nome) &&
      (typeof t.superficie === 'number' || t.coltura)
  );
}

/**
 * @param {string} domanda
 * @param {Array<object>} terreni
 * @returns {string}
 */
export function domandaNomeTerreni(domanda, terreni) {
  const mancanti = terreniInAttesaNome(terreni);
  if (!mancanti.length) return '';
  const letti = interpretaFraseTerreni(domanda);
  const frasi = mancanti.map((t) => {
    const letto =
      letti.find((l) => typeof t.superficie === 'number' && l.superficie === t.superficie) ||
      null;
    return descriviTerrenoSenzaNome(t, letto);
  });
  if (mancanti.length === 1) {
    return frasi[0]
      ? 'Come si chiama il terreno da ' + frasi[0] + '?'
      : 'Come si chiama questo terreno?';
  }
  const elenco = frasi.filter(Boolean).join('; ');
  return elenco
    ? 'Come si chiamano questi terreni? ' + elenco + '.'
    : 'Come si chiama ogni terreno?';
}

function togliErroreVuoto(testo) {
  return String(testo || '')
    .replace(/in questo momento non riesco a risponderti\.\s*intanto prova gfv!/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Toglie il riepilogo non chiesto. «Ne hai altri o vediamo il riepilogo?» resta. */
function togliFrasiRiepilogo(testo) {
  return String(testo || '')
    .split(/(?<=[.!?])\s+/)
    .filter((p) => !/riepilogo/i.test(p) || /ne hai altri/i.test(p))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function togliDomandaColturaGiaData(testo) {
  const s = String(testo || '').trim();
  if (!s) return s;
  const pezzi = s.split(/(?<=[.!?])\s+/);
  const filtrati = pezzi.filter(
    (p) => !/che cosa ci coltivi|cosa ci coltivi|quale coltura/i.test(p)
  );
  const out = filtrati.join(' ').trim();
  return out || 'Va bene.';
}

export function togliRichiestaNomeGiaDato(testo) {
  const s = String(testo || '').trim();
  if (!s) return s;
  const pezzi = s.split(/(?<=[.!?])\s+/);
  const filtrati = pezzi.filter(
    (p) => !/\b(come si chiama|come si chiamano|qual\s*è il nome|che nome)\b/i.test(p)
  );
  const out = filtrati.join(' ').trim();
  return out || 'Va bene.';
}

/**
 * Il passo chat segue i dati estratti (e messaggi chiari dell'utente).
 * @param {string|null|undefined} passoCorrente
 * @param {{ sede?: object|null, poderi?: object[], terreni?: object[] }} dati
 * @param {{ sede?: object|null, poderi?: object[], terreni?: object[], fatto?: boolean }|null} esitoDati
 * @param {string} domanda
 */
export function allineaPassoAiuto(passoCorrente, dati, esitoDati, domanda) {
  const p =
    typeof passoCorrente === 'string' && PASSI_AIUTO.indexOf(passoCorrente) >= 0
      ? passoCorrente
      : 'sede';
  const base = dati && typeof dati === 'object' ? dati : {};
  const ed = esitoDati && typeof esitoDati === 'object' ? esitoDati : {};
  const idx = PASSI_AIUTO.indexOf(p);
  const idxTerreni = PASSI_AIUTO.indexOf('terreni');

  const terreniNuovi = Array.isArray(ed.terreni) ? ed.terreni : [];
  const poderiNuovi = Array.isArray(ed.poderi) ? ed.poderi : [];
  const haSede =
    !!(base.sede && (base.sede.indirizzo || base.sede.citta)) ||
    !!(ed.sede && (ed.sede.indirizzo || ed.sede.citta));
  const nPoderi =
    (Array.isArray(base.poderi) ? base.poderi.length : 0) + poderiNuovi.length;
  const senzaPoderi = base.senzaPoderi === true || ed.senzaPoderi === true;

  if (messaggioNegaPoderi(domanda, p) && (p === 'poderi' || (p === 'sede' && haSede))) {
    return 'terreni';
  }

  const parlaTerreno =
    messaggioHaTerreno(domanda) ||
    (terreniNuovi.length > 0 && !(p === 'sede' && !haSede));

  if (parlaTerreno && idx < idxTerreni) {
    if (p === 'sede' && !haSede) return p;
    if (
      p !== 'terreni' &&
      !senzaPoderi &&
      nPoderi === 0 &&
      !messaggioNegaPoderi(domanda, p)
    ) {
      return 'poderi';
    }
    return 'terreni';
  }
  if (poderiNuovi.length && p === 'sede' && haSede) {
    return 'poderi';
  }
  if (p === 'poderi' && messaggioSoloPodere(domanda)) {
    const n = Array.isArray(base.poderi) ? base.poderi.length : 0;
    if (n >= 1) return 'terreni';
  }
  return p;
}

export function esitoRipiegoAccount(esito) {
  const e = esito && typeof esito === 'object' ? esito : {};
  if (e.ripiego === true) return true;
  const testo = String(e.testo || '');
  return testo.indexOf('Non ho capito bene') === 0;
}

/**
 * @param {Array<{ nome?: string, coltura?: string, categoria?: string }>} terreniForm
 * @param {{ terreni?: Array<{ nome?: string, categoria?: string }> }} [datiAiuto]
 */
export function erroriColturaTerreniForm(terreniForm, datiAiuto) {
  const righe = Array.isArray(terreniForm) ? terreniForm : [];
  const metaPerNome = Object.create(null);
  const grezzi =
    datiAiuto && Array.isArray(datiAiuto.terreni) ? datiAiuto.terreni : [];
  for (let i = 0; i < grezzi.length; i++) {
    const t = grezzi[i];
    if (!t || !t.nome) continue;
    metaPerNome[chiaveTerreno(t.nome)] = t;
  }
  const errori = [];
  for (let i = 0; i < righe.length; i++) {
    const row = righe[i];
    const nome = String(row && row.nome != null ? row.nome : '').trim();
    if (!nome) continue;
    const meta = metaPerNome[chiaveTerreno(nome)] || {};
    let col = String(row && row.coltura != null ? row.coltura : '').trim();
    const norm = col ? normalizzaColturaCatalogo(col) : null;
    if (norm) col = norm;
    const soloCategoria =
      !col &&
      (meta.categoria === 'Ortive' || row.categoria === 'Ortive');
    if (soloCategoria || colturaOrtaggiGenerica(col)) {
      errori.push({
        campo: 'terreni[' + i + '].coltura',
        errore: ERRORE_ORTAGGIO_SCHEDA,
      });
      continue;
    }
    if (!col) continue;
    const trovata = trovaColtura(col, []);
    if (!trovata.ok) {
      errori.push({
        campo: 'terreni[' + i + '].coltura',
        errore:
          trovata.errore === ERRORI.CATEGORIA_NON_COLTURA
            ? ERRORE_ORTAGGIO_SCHEDA
            : trovata.errore || 'Coltura non riconosciuta',
      });
    }
  }
  return errori;
}

/**
 * @param {string} grezzo
 * @returns {number | null}
 */
export function numeroDaTesto(grezzo) {
  if (grezzo == null) return null;
  const s = String(grezzo).trim().replace(/\s+/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * @param {string} nome
 * @returns {string}
 */
export function chiaveNome(nome) {
  return String(nome || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * «null» e «undefined» non sono nomi: né in chat, né in scheda, né da salvare.
 * @param {unknown} nome
 * @returns {string}
 */
export function nomeTerrenoVisibile(nome) {
  const s = togliConnettiviFinaliNome(String(nome == null ? '' : nome).trim());
  if (!s || /^(null|undefined|nullo)$/i.test(s)) return '';
  return inizialeMaiuscola(s);
}

/**
 * @param {string} nome
 * @returns {string}
 */
export function nomeSenzaPrefissoPodere(nome) {
  let s = chiaveNome(nome);
  for (let i = 0; i < PREFISSI_PODERE.length; i++) {
    const p = PREFISSI_PODERE[i];
    if (s.indexOf(p + ' ') === 0) {
      s = s.slice(p.length + 1).trim();
      break;
    }
  }
  return s;
}

/**
 * Chiave di dedupe dei terreni: stesso nome anche con prefisso podere/tenuta/…
 * @param {string} nome
 * @returns {string}
 */
export function chiaveTerreno(nome) {
  return nomeSenzaPrefissoPodere(nome);
}

function chiaveElencoTerreno(t) {
  const nome = nomeTerrenoVisibile(t && t.nome);
  const nomeChiave = nome ? chiaveTerreno(nome) : '';
  if (nomeChiave) return nomeChiave;
  const sup = t && typeof t.superficie === 'number' ? String(t.superficie) : '';
  const col = chiaveNome(t && t.coltura ? t.coltura : '');
  if (!sup && !col) return '';
  return '§' + sup + '|' + col;
}

function colturaAccettata(nuova, precedente) {
  if (nuova == null || nuova === '') return precedente == null ? null : precedente;
  const norm = normalizzaColturaCatalogo(nuova);
  if (norm) return norm;
  if (colturaOrtaggiGenerica(nuova)) return precedente == null ? null : precedente;
  return String(nuova);
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function corrispondeNomePodere(a, b) {
  const ka = chiaveNome(a);
  const kb = chiaveNome(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  return nomeSenzaPrefissoPodere(ka) === nomeSenzaPrefissoPodere(kb);
}

/**
 * @param {string} grezzo
 * @param {Array<{ nome?: string }>} poderi
 * @returns {string | null}
 */
export function risolviNomePodere(grezzo, poderi) {
  const lista = Array.isArray(poderi) ? poderi : [];
  const cercato = String(grezzo || '').trim();
  if (!cercato) return null;
  for (let i = 0; i < lista.length; i++) {
    const nome = lista[i] && lista[i].nome != null ? String(lista[i].nome).trim() : '';
    if (nome && corrispondeNomePodere(cercato, nome)) return nome;
  }
  return null;
}

/**
 * Collega i terreni ai poderi in elenco (prefissi, unico podere, ultimoPodere).
 * @param {{
 *   sede?: object|null,
 *   poderi?: Array<{ nome?: string }>,
 *   terreni?: Array<object>,
 *   ultimoPodere?: string|null
 * }} dati
 */
export function collegaTerreniAiPoderi(dati) {
  const base = dati && typeof dati === 'object' ? dati : {};
  const poderi = Array.isArray(base.poderi) ? base.poderi.slice() : [];
  const terreni = Array.isArray(base.terreni) ? base.terreni.slice() : [];
  let ultimoPodere =
    base.ultimoPodere == null || base.ultimoPodere === ''
      ? null
      : String(base.ultimoPodere);

  const nomeUnico =
    poderi.length === 1 && poderi[0] && poderi[0].nome
      ? String(poderi[0].nome).trim()
      : null;

  if (ultimoPodere) {
    const risoltoUltimo = risolviNomePodere(ultimoPodere, poderi);
    if (risoltoUltimo) ultimoPodere = risoltoUltimo;
  }

  const outTerreni = terreni.map((t) => {
    if (!t || typeof t !== 'object') return t;
    const voce = Object.assign({}, t);
    const grezzo =
      voce.podere == null || voce.podere === '' ? '' : String(voce.podere).trim();
    if (grezzo) {
      const risolto = risolviNomePodere(grezzo, poderi);
      if (risolto) {
        voce.podere = risolto;
        ultimoPodere = risolto;
        return voce;
      }
      return voce;
    }
    if (nomeUnico) {
      voce.podere = nomeUnico;
      return voce;
    }
    if (ultimoPodere && risolviNomePodere(ultimoPodere, poderi)) {
      voce.podere = risolviNomePodere(ultimoPodere, poderi);
      return voce;
    }
    voce.podere = null;
    return voce;
  });

  return {
    sede: base.sede || null,
    poderi: poderi,
    terreni: outTerreni,
    ultimoPodere: ultimoPodere,
  };
}

/**
 * @param {object} attuali
 * @param {object|null} nuovi
 * @param {string} argomento
 */
export function unisciDati(attuali, nuovi, argomento) {
  const base = attuali && typeof attuali === 'object' ? attuali : {};
  const n = nuovi && typeof nuovi === 'object' ? nuovi : {};
  const out = {
    sede: base.sede || null,
    poderi: Array.isArray(base.poderi) ? base.poderi.slice() : [],
    terreni: (Array.isArray(base.terreni) ? base.terreni : []).map((t) => {
      if (!t || typeof t !== 'object') return t;
      const nome = nomeTerrenoVisibile(t.nome);
      return Object.assign({}, t, { nome: nome || null });
    }),
    ultimoPodere:
      base.ultimoPodere == null || base.ultimoPodere === ''
        ? null
        : String(base.ultimoPodere),
    senzaPoderi: base.senzaPoderi === true,
  };
  let troppiTerreni = false;

  if (n.sede && typeof n.sede === 'object') {
    const prev = out.sede && typeof out.sede === 'object' ? out.sede : {};
    out.sede = {
      indirizzo:
        n.sede.indirizzo != null && n.sede.indirizzo !== ''
          ? n.sede.indirizzo
          : prev.indirizzo || null,
      citta:
        n.sede.citta != null && n.sede.citta !== ''
          ? n.sede.citta
          : prev.citta || null,
      cap:
        n.sede.cap != null && n.sede.cap !== '' ? n.sede.cap : prev.cap || null,
      provincia:
        n.sede.provincia != null && n.sede.provincia !== ''
          ? n.sede.provincia
          : prev.provincia || null,
    };
  }

  if (argomento === 'poderi' || (Array.isArray(n.poderi) && n.poderi.length)) {
    const visti = Object.create(null);
    for (const p of out.poderi) {
      visti[chiaveNome(p.nome)] = true;
    }
    const aggiunti = Array.isArray(n.poderi) ? n.poderi : [];
    for (const p of aggiunti) {
      if (!p || !p.nome) continue;
      const nome = String(p.nome).trim();
      const k = chiaveNome(nome);
      if (!k || visti[k]) continue;
      if (out.poderi.some((gia) => gia && corrispondeNomePodere(gia.nome, nome))) {
        continue;
      }
      if (out.poderi.length >= LIMITI.MAX_PODERI) break;
      visti[k] = true;
      out.poderi.push({ nome: nome });
      out.ultimoPodere = nome;
      out.senzaPoderi = false;
    }
  }
  if (n.senzaPoderi === true && out.poderi.length === 0) out.senzaPoderi = true;

  if (argomento === 'terreni' || (Array.isArray(n.terreni) && n.terreni.length)) {
    const indicePerChiave = Object.create(null);
    function reindicizza() {
      for (const k of Object.keys(indicePerChiave)) delete indicePerChiave[k];
      for (let i = 0; i < out.terreni.length; i++) {
        const k = chiaveElencoTerreno(out.terreni[i]);
        if (k) indicePerChiave[k] = i;
      }
    }
    reindicizza();
    const aggiunti = Array.isArray(n.terreni) ? n.terreni : [];
    // Non sommare grezzo length+aggiunti: Gemini spesso rimanda tutta la lista
    // (aggiornamenti + nuovi). Il limite si applica solo ai nomi nuovi.
    for (const t of aggiunti) {
      if (!t || typeof t !== 'object') continue;
      const nome = nomeTerrenoVisibile(t.nome);
      const haDati =
        !!nome ||
        typeof t.superficie === 'number' ||
        (t.coltura != null && String(t.coltura).trim() !== '');
      if (!haDati) continue;
      const k = nome ? chiaveTerreno(nome) : chiaveElencoTerreno(t);
      if (!k) continue;
      let i = Object.prototype.hasOwnProperty.call(indicePerChiave, k)
        ? indicePerChiave[k]
        : -1;
      if (i < 0) {
        const pendenti = [];
        for (let j = 0; j < out.terreni.length; j++) {
          if (!nomeTerrenoVisibile(out.terreni[j].nome)) pendenti.push(j);
        }
        const perSup = pendenti.filter(
          (j) =>
            typeof t.superficie === 'number' &&
            out.terreni[j].superficie === t.superficie
        );
        if (nome && perSup.length === 1) i = perSup[0];
        else if (
          !nome &&
          perSup.length === 1 &&
          !String(out.terreni[perSup[0]].coltura || '').trim() &&
          t.coltura
        ) {
          i = perSup[0];
        } else if (pendenti.length === 1 && (t.superficie == null || t.superficie === '')) {
          i = pendenti[0];
        } else if (!nome && typeof t.superficie === 'number') {
          const stessi = [];
          for (let j = 0; j < out.terreni.length; j++) {
            if (stessoBloccoTerreno(out.terreni[j], Object.assign({}, t, { nome: null }))) {
              stessi.push(j);
            }
          }
          if (stessi.length === 1) i = stessi[0];
        }
      }
      if (i >= 0) {
        const prev = out.terreni[i];
        out.terreni[i] = {
          nome: nomeTerrenoVisibile(prev.nome) || nome || null,
          superficie:
            typeof t.superficie === 'number' ? t.superficie : prev.superficie,
          coltura: colturaAccettata(t.coltura, prev.coltura),
          podere:
            t.podere == null || t.podere === ''
              ? prev.podere
              : String(t.podere),
        };
        const cat = t.categoria || prev.categoria;
        if (cat) out.terreni[i].categoria = String(cat);
        if (out.terreni[i].podere) {
          out.ultimoPodere = String(out.terreni[i].podere);
        }
        reindicizza();
        continue;
      }
      if (out.terreni.length >= LIMITI.MAX_TERRENI_PER_RICHIESTA) {
        // Solo i nomi davvero nuovi superano il limite; gli aggiornamenti
        // successivi della stessa lista vanno comunque applicati.
        troppiTerreni = true;
        continue;
      }
      const voce = {
        nome: nome || null,
        superficie: typeof t.superficie === 'number' ? t.superficie : null,
        coltura: colturaAccettata(t.coltura, null),
        podere: t.podere == null || t.podere === '' ? null : String(t.podere),
      };
      if (t.categoria) voce.categoria = String(t.categoria);
      if (voce.podere) out.ultimoPodere = voce.podere;
      out.terreni.push(voce);
      reindicizza();
    }
  }

  out.terreni = compattaTerreni(out.terreni);
  const collegati = collegaTerreniAiPoderi(out);
  collegati.senzaPoderi = out.senzaPoderi === true;
  return { dati: collegati, troppiTerreni };
}

function stessoBloccoTerreno(a, b) {
  if (!a || !b) return false;
  if (typeof a.superficie !== 'number' || a.superficie !== b.superficie) return false;
  const ca = chiaveNome(a.coltura || '');
  const cb = chiaveNome(b.coltura || '');
  if (ca && cb && ca !== cb) return false;
  const pa = nomeSenzaPrefissoPodere(chiaveNome(a.podere || ''));
  const pb = nomeSenzaPrefissoPodere(chiaveNome(b.podere || ''));
  if (pa && pb && pa !== pb) return false;
  const na = nomeTerrenoVisibile(a.nome);
  const nb = nomeTerrenoVisibile(b.nome);
  if (na && nb && chiaveTerreno(na) !== chiaveTerreno(nb)) return false;
  return true;
}

/** Due righe dello stesso appezzamento (nome «null» + nome vero) diventano una. */
export function compattaTerreni(lista) {
  const out = [];
  for (const t of Array.isArray(lista) ? lista : []) {
    if (!t || typeof t !== 'object') continue;
    const nome = nomeTerrenoVisibile(t.nome);
    const voce = Object.assign({}, t, { nome: nome });
    const idx = out.findIndex((prev) => stessoBloccoTerreno(prev, voce));
    if (idx < 0) {
      out.push(voce);
      continue;
    }
    const prev = out[idx];
    const unito = {
      nome: nomeTerrenoVisibile(prev.nome) || nome,
      superficie: typeof voce.superficie === 'number' ? voce.superficie : prev.superficie,
      coltura: colturaAccettata(voce.coltura, prev.coltura),
      podere:
        voce.podere == null || voce.podere === '' ? prev.podere || null : voce.podere,
    };
    if (voce.categoria || prev.categoria) unito.categoria = voce.categoria || prev.categoria;
    out[idx] = unito;
  }
  return out;
}

const CONTEGGIO_IN_PAROLE = Object.freeze({
  un: 1,
  uno: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
});

function allineaConteggioTerreni(testo, n) {
  return String(testo || '').replace(
    /\bne hai\s+(\d+|un|uno|due|tre|quattro|cinque)\s+su\s+5\b/gi,
    (tutto, detto) => {
      const valore = /^\d+$/.test(detto)
        ? Number(detto)
        : CONTEGGIO_IN_PAROLE[String(detto).toLowerCase()];
      if (valore === n) return tutto;
      return 'ne hai ' + n + ' su 5';
    }
  );
}

function chiedeRiepilogoEsplicito(domanda) {
  return /riepilogo|basta|ho finito|^fatto\b/i.test(String(domanda || '').trim());
}

const NUMERI_TERRANI_PAROLA = Object.freeze({
  un: 1,
  uno: 1,
  una: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
});

/**
 * «7 terreni», «ne ho 4», «cinque» — solo conteggio, senza nome/ettari/coltura.
 * @param {string} domanda
 * @returns {number|null}
 */
export function numeroTerreniDetto(domanda) {
  const d = String(domanda || '')
    .trim()
    .toLowerCase()
    .replace(/[?!.,;:]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!d) return null;
  if (/\b(?:ha\b|ettari?\b)\b/.test(d)) return null;
  if (/\bdi\s+[a-zà-öø-ÿ]/.test(d)) return null;
  const cifra = d.match(
    /^(?:ne\s+ho\s+|ho\s+|sono\s+|ce\s+ne\s+sono\s+|ce\s+n'è\s+)?(\d{1,2})\s*(?:terren[io]|campi|appezzamenti?)?$/i
  );
  if (cifra) return Number(cifra[1]);
  const parola = d.match(
    /^(?:ne\s+ho\s+|ho\s+|sono\s+|ce\s+ne\s+sono\s+)?(un|uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)\s*(?:terren[io]|campi|appezzamenti?)?$/i
  );
  if (parola) {
    const k = String(parola[1] || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(NUMERI_TERRANI_PAROLA, k)
      ? NUMERI_TERRANI_PAROLA[k]
      : null;
  }
  return null;
}

export function messaggioSoloConteggioTerreni(domanda) {
  return numeroTerreniDetto(domanda) != null;
}

/** La frase aggiunge un terreno e non chiede il riepilogo. */
export function fraseTerrenoSenzaRiepilogo(domanda) {
  if (chiedeRiepilogoEsplicito(domanda)) return false;
  if (messaggioSoloConteggioTerreni(domanda)) return true;
  return interpretaFraseTerreni(domanda).some(
    (l) => l && (l.superficie != null || l.varieta)
  );
}

/** Il riepilogo si apre se l'utente lo chiede, non perché il modello mette fatto. */
export function utenteChiedeRiepilogo(domanda) {
  const d = String(domanda || '').trim();
  if (!d || fraseTerrenoSenzaRiepilogo(d)) return false;
  return /riepilogo|basta|ho finito|^fatto\b|^(no|nope)\b/i.test(d);
}

/** Compatibilità: fatto del modello non basta, serve la richiesta dell'utente. */
export function aprireSchedaPerFatto(domanda, fatto) {
  return fatto === true && utenteChiedeRiepilogo(domanda);
}

function confermaTerrenoRaccolto(t) {
  const nome = nomeTerrenoVisibile(t && t.nome);
  const n = t && typeof t.superficie === 'number' ? t.superficie : null;
  const ett =
    n == null ? '' : String(n).replace('.', ',') + (n === 1 ? ' ettaro' : ' ettari');
  const col = t && t.coltura ? String(t.coltura) : '';
  const pezzi = ['Ok, un terreno' + (nome ? ' ' + nome : '')];
  if (ett) pezzi.push('di ' + ett);
  if (col) pezzi.push('a ' + col);
  return pezzi.join(' ') + '. Ne hai altri o vediamo il riepilogo?';
}

/**
 * Corregge il turno account prima che la chat avanzi.
 * Senza un nome esplicito chiede come si chiama il terreno, prima di confermarlo.
 * Se manca ancora la coltura e Tony la sta chiedendo, quella domanda resta.
 * @param {{
 *   domanda: string,
 *   passo: string,
 *   datiAttuali: object,
 *   datiNuovi: object|null,
 *   testo: string
 * }} opts
 */
export function preparaTurnoOnboarding(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const passo0 = typeof o.passo === 'string' ? o.passo : '';
  const attuali = o.datiAttuali && typeof o.datiAttuali === 'object' ? o.datiAttuali : {};
  const nuoviIn =
    o.datiNuovi && typeof o.datiNuovi === 'object' ? Object.assign({}, o.datiNuovi) : {};
  // Sede/podere (o testo già consumato come indirizzo): mai terreni in questo turno.
  const bloccaTerreniDaPasso =
    sembraIndirizzo(o.domanda) ||
    ((passo0 === 'sede' || passo0 === 'poderi') && !domandaTerrenoEsplicita(o.domanda));
  if (bloccaTerreniDaPasso) {
    nuoviIn.terreni = [];
  }
  if (!Array.isArray(nuoviIn.terreni)) {
    const haMisura = interpretaFraseTerreni(o.domanda).some(
      (l) => l && (l.superficie != null || l.varieta)
    );
    const correzione = correzioneColturaBreve(o.domanda, attuali.terreni);
    if (haMisura || correzione) nuoviIn.terreni = [];
  }
  if (Array.isArray(nuoviIn.terreni)) {
    nuoviIn.terreni = correggiTerreniEstratti(
      o.domanda,
      nuoviIn.terreni,
      attuali.terreni
    ).filter((t) => t && !nomeSembraIndirizzo(t.nome));
  }
  if (messaggioNegaPoderi(o.domanda, passo0)) nuoviIn.senzaPoderi = true;
  const uniti = unisciDati(
    attuali,
    nuoviIn,
    passo0 && PASSI_AIUTO.indexOf(passo0) >= 0 ? passo0 : 'terreni'
  );
  const testoIngresso = String(o.testo || '').trim();
  if (!chiedeRiepilogoEsplicito(o.domanda)) {
    o.testo = togliFrasiRiepilogo(togliErroreVuoto(o.testo));
  }
  let passo = allineaPassoAiuto(passo0, uniti.dati, nuoviIn, o.domanda);
  const sedeNota =
    uniti.dati.sede && (uniti.dati.sede.indirizzo || uniti.dati.sede.citta);
  if (
    passo === 'sede' &&
    sedeNota &&
    !(uniti.dati.poderi && uniti.dati.poderi.length) &&
    uniti.dati.senzaPoderi !== true &&
    !messaggioNegaPoderi(o.domanda, passo)
  ) {
    passo = 'poderi';
  }
  const mancanti = terreniInAttesaNome(uniti.dati.terreni);
  const devePoderi =
    passo === 'poderi' &&
    passo0 !== 'terreni' &&
    uniti.dati.senzaPoderi !== true &&
    !(uniti.dati.poderi && uniti.dati.poderi.length);
  let testo = null;
  let bloccaAvanti = false;
  let vaiATerreni = false;
  const nSoloConteggio = numeroTerreniDetto(o.domanda);
  const soloConteggio = nSoloConteggio != null;

  if (devePoderi) {
    bloccaAvanti = true;
    passo = 'poderi';
    const desc =
      mancanti.length === 1
        ? descriviTerrenoSenzaNome(
            mancanti[0],
            interpretaFraseTerreni(o.domanda)[0] || null
          )
        : '';
    const tengo =
      mancanti.length === 1 && desc
        ? 'Tengo il terreno da ' + desc + '.'
        : mancanti.length > 1
          ? 'Tengo i terreni, mi manca ancora il nome.'
          : '';
    const giaPoderi = /\bpoder/i.test(String(o.testo || ''));
    if (mancanti.length) {
      testo = [tengo, DOMANDA_PODERI].filter(Boolean).join(' ');
    } else if (!giaPoderi) {
      const base = String(o.testo || '').trim();
      testo = base ? base + ' ' + DOMANDA_PODERI : DOMANDA_PODERI;
    }
  } else if (soloConteggio && (passo === 'terreni' || passo0 === 'terreni' || passo0 === 'poderi')) {
    // «7 terreni»: non aprire il riepilogo; avvisa se >5 e chiedi il primo.
    passo = 'terreni';
    bloccaAvanti = true;
    const pezzi = [];
    if (nSoloConteggio > LIMITI.MAX_TERRENI_PER_RICHIESTA) {
      pezzi.push(
        "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi."
      );
    }
    pezzi.push(DOMANDA_PRIMO_TERRENO);
    testo = pezzi.join(' ');
  } else if (
    messaggioNegaPoderi(o.domanda, passo0) &&
    (passo0 === 'poderi' || passo0 === 'sede')
  ) {
    passo = 'terreni';
    if (mancanti.length) {
      bloccaAvanti = true;
      testo =
        'Va bene, senza poderi. ' + domandaNomeTerreni(o.domanda, uniti.dati.terreni);
    } else {
      vaiATerreni = passo0 !== 'terreni';
    }
  } else if (passo === 'terreni' && mancanti.length && !chiedeRiepilogoEsplicito(o.domanda)) {
    bloccaAvanti = true;
    const chiedeColtura = /che cosa ci coltivi|cosa ci coltivi|quale coltura/i.test(
      String(o.testo || '')
    );
    const aspettaColtura = mancanti.some((t) => !String(t.coltura || '').trim());
    if (!(aspettaColtura && chiedeColtura)) {
      testo = domandaNomeTerreni(o.domanda, uniti.dati.terreni);
    }
  } else if (
    passo === 'terreni' &&
    !mancanti.length &&
    !chiedeRiepilogoEsplicito(o.domanda)
  ) {
    // Coltura non riconosciuta: non lasciare il terreno in silenzio, chiedila.
    const senzaColtura = (Array.isArray(uniti.dati.terreni) ? uniti.dati.terreni : []).filter(
      (t) =>
        t &&
        nomeTerrenoVisibile(t.nome) &&
        typeof t.superficie === 'number' &&
        !String(t.coltura || '').trim() &&
        !t.categoria
    );
    const giaChiede = /che cosa ci coltivi|cosa ci coltivi|quale coltura/i.test(
      String(o.testo || '')
    );
    if (senzaColtura.length === 1 && !giaChiede) {
      bloccaAvanti = true;
      const n = senzaColtura[0].superficie;
      const ett =
        String(n).replace('.', ',') + (n === 1 ? ' ettaro' : ' ettari');
      testo =
        'Che cosa ci coltivi nel terreno «' +
        nomeTerrenoVisibile(senzaColtura[0].nome) +
        '» da ' +
        ett +
        '? Grano, mais, orzo…';
    }
  } else if (!mancanti.length && o.testo) {
    const varietaDetta = interpretaFraseTerreni(o.domanda).some((l) => l && l.varieta);
    let pulito = togliRichiestaNomeGiaDato(o.testo);
    if (varietaDetta) pulito = togliDomandaColturaGiaData(pulito);
    if (pulito !== String(o.testo).trim()) testo = pulito;
  }

  const soloColtura = normalizzaColturaCatalogo(String(o.domanda || '').trim());
  if (
    soloColtura &&
    !/\d/.test(String(o.domanda || '')) &&
    String(o.domanda || '').trim().split(/\s+/).length <= 3 &&
    !mancanti.length
  ) {
    const lista = Array.isArray(uniti.dati.terreni) ? uniti.dati.terreni : [];
    const colpiti = lista.filter(
      (t) => chiaveNome(t && t.coltura) === chiaveNome(soloColtura) && nomeTerrenoVisibile(t && t.nome)
    );
    if (colpiti.length === 1) {
      const mostratoOra = testo != null ? testo : String(o.testo || '');
      if (
        !mostratoOra.trim() ||
        /come si chiama/i.test(mostratoOra) ||
        /account gratuito arrivi a/i.test(mostratoOra) ||
        mostratoOra.trim() === 'Va bene.'
      ) {
        testo = confermaTerrenoRaccolto(colpiti[0]);
      }
    }
  }

  const nTerreni = (Array.isArray(uniti.dati.terreni) ? uniti.dati.terreni : []).filter(
    (t) => t && (nomeTerrenoVisibile(t.nome) || typeof t.superficie === 'number' || t.coltura)
  ).length;
  const mostrato = testo != null ? testo : String(o.testo || '');
  const allineato = allineaConteggioTerreni(mostrato, nTerreni);
  if (allineato !== mostrato) testo = allineato;
  const testoBase = testo != null ? testo : String(o.testo || '');
  const modelloIncerto =
    !String(o.testo || '').trim() ||
    esitoRipiegoAccount({ testo: testoBase }) ||
    /account gratuito arrivi a/i.test(testoBase);
  if (
    (modelloIncerto || testo === 'Va bene.') &&
    !devePoderi &&
    fraseTerrenoSenzaRiepilogo(o.domanda) &&
    nTerreni <= LIMITI.MAX_TERRENI_PER_RICHIESTA &&
    !mancanti.length
  ) {
    const detti = interpretaFraseTerreni(o.domanda);
    const ultimo = detti.length ? detti[detti.length - 1] : null;
    const lista = Array.isArray(uniti.dati.terreni) ? uniti.dati.terreni : [];
    const tenuto = ultimo
      ? lista.find((t) => {
          const nome = nomeTerrenoVisibile(t && t.nome);
          if (ultimo.nome && nome && stessoNome(nome, ultimo.nome)) return true;
          return !nome && ultimo.superficie != null && t && t.superficie === ultimo.superficie;
        })
      : null;
    if (tenuto && nomeTerrenoVisibile(tenuto.nome)) testo = confermaTerrenoRaccolto(tenuto);
  }
  if (testo == null && o.testo !== testoIngresso) testo = o.testo;

  return {
    dati: uniti,
    passo,
    testo,
    bloccaAvanti,
    vaiATerreni,
  };
}

/**
 * Testo per il prompt account: cosa è già stato raccolto.
 * @param {{ sede?: object|null, poderi?: object[], terreni?: object[] }} dati
 */
export function serializzaRaccolti(dati) {
  const d = dati && typeof dati === 'object' ? dati : {};
  const righe = [];
  if (d.sede && typeof d.sede === 'object' && (d.sede.citta || d.sede.indirizzo)) {
    const pezzi = [];
    if (d.sede.indirizzo) pezzi.push(String(d.sede.indirizzo));
    if (d.sede.citta) pezzi.push(String(d.sede.citta));
    if (d.sede.cap) pezzi.push('CAP ' + d.sede.cap);
    if (d.sede.provincia) pezzi.push(String(d.sede.provincia));
    righe.push('Sede: ' + pezzi.join(', '));
  }
  if (Array.isArray(d.poderi) && d.poderi.length) {
    righe.push(
      'Poderi: ' +
        d.poderi
          .map((p) => (p && p.nome ? String(p.nome) : ''))
          .filter(Boolean)
          .join(', ')
    );
  }
  if (Array.isArray(d.terreni) && d.terreni.length) {
    // Fonte di verità del conteggio: il modello non deve ricontarli a memoria.
    const nTerreni = d.terreni.filter(
      (t) => t && (t.nome || typeof t.superficie === 'number' || t.coltura)
    ).length;
    if (nTerreni > 0) {
      righe.push(
        'Terreni già raccolti: ' + nTerreni + ' di ' + LIMITI.MAX_TERRENI_PER_RICHIESTA
      );
    }
    for (const t of d.terreni) {
      if (!t || (!t.nome && t.superficie == null && !t.coltura)) continue;
      const nomeVis = nomeTerrenoVisibile(t.nome);
      let r = nomeVis
        ? 'Terreno «' + nomeVis + '»'
        : 'Terreno senza nome (chiedi il nome, non usare la coltura)';
      if (typeof t.superficie === 'number') r += ', ' + t.superficie + ' ha';
      if (t.coltura) r += ', coltura ' + t.coltura;
      else if (t.categoria) r += ', categoria ' + t.categoria;
      if (t.podere) r += ', podere ' + t.podere;
      righe.push(r);
    }
  }
  return righe.join('\n');
}

const MARCA_SUPERATO = '[Elenco superato dal riepilogo] ';
const MAX_BATTUTE_STORIA_CLIENT = 10;
const MAX_CARATTERI_BATTUTA_CLIENT = 600;

/** Battute di Tony che elencano/contano i terreni (e quindi vanno in conflitto col riepilogo). */
function battutaConElencoTerreni(testo) {
  const s = String(testo || '');
  return (
    /\bne hai\s+\d+\s+su\s+\d+/i.test(s) ||
    /\bTerren[io]\b.*\b(?:\d+|un|due|tre|quattro|cinque)\s+(?:su|di)\s+(?:5|cinque)\b/i.test(s) ||
    /\bTerreno\s+«/.test(s) ||
    /\bStato aggiornato dopo il riepilogo\b/i.test(s)
  );
}

/**
 * Dopo «Torna alla chat»: marca come superate le vecchie battute di Tony che
 * elencano i terreni e aggiunge una battuta-riassunto con lo stato aggiornato
 * (così il modello non riparte da conteggi vecchi).
 * @param {Array<{ ruolo?: string, testo?: string }>} storia
 * @param {{ sede?: object|null, poderi?: object[], terreni?: object[] }} dati
 * @returns {Array<{ ruolo: 'utente'|'tony', testo: string }>}
 */
export function storiaDopoRiepilogo(storia, dati) {
  const lista = (Array.isArray(storia) ? storia : [])
    .filter((b) => b && (b.ruolo === 'utente' || b.ruolo === 'tony'))
    .map((b) => {
      const testo = String(b.testo ?? '');
      if (
        b.ruolo === 'tony' &&
        testo.indexOf(MARCA_SUPERATO) !== 0 &&
        battutaConElencoTerreni(testo)
      ) {
        return { ruolo: 'tony', testo: MARCA_SUPERATO + testo };
      }
      return { ruolo: b.ruolo, testo };
    });
  const d = dati && typeof dati === 'object' ? dati : {};
  const terreni = (Array.isArray(d.terreni) ? d.terreni : []).filter((t) => t && t.nome);
  const nomi = terreni.map((t) => String(t.nome)).join(', ');
  let riassunto =
    'Stato aggiornato dopo il riepilogo: ne hai ' +
    terreni.length +
    ' su ' +
    LIMITI.MAX_TERRENI_PER_RICHIESTA +
    ' terreni' +
    (nomi ? ' (' + nomi + ')' : '') +
    '. Vale questo elenco, non le battute precedenti.';
  if (riassunto.length > MAX_CARATTERI_BATTUTA_CLIENT) {
    riassunto = riassunto.slice(0, MAX_CARATTERI_BATTUTA_CLIENT);
  }
  lista.push({ ruolo: 'tony', testo: riassunto });
  return lista.length > MAX_BATTUTE_STORIA_CLIENT
    ? lista.slice(lista.length - MAX_BATTUTE_STORIA_CLIENT)
    : lista;
}

const MESSAGGIO_RIEPILOGO =
  'Facciamo così: controlla il riepilogo e completa lì.';

/**
 * @param {{
 *   nuoviDati?: boolean,
 *   fuoriTema?: number,
 *   turniSenzaNovitaNelPasso?: number,
 *   domandeRimaste?: number,
 *   passo?: string
 * }} opts
 * @returns {{
 *   azione: 'prossimoPasso' | 'riepilogo' | 'resta',
 *   apriRiepilogo: boolean,
 *   messaggio?: string
 * }}
 */
export function decidiDopoRisposta(opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const senzaNovita =
    typeof o.turniSenzaNovitaNelPasso === 'number' ? o.turniSenzaNovitaNelPasso : 0;
  const fuori = typeof o.fuoriTema === 'number' ? o.fuoriTema : 0;
  const rimaste =
    typeof o.domandeRimaste === 'number' ? o.domandeRimaste : Number.POSITIVE_INFINITY;
  const passo = typeof o.passo === 'string' ? o.passo : '';
  const giaLimiteDomande = o.giaRiaperturaLimiteDomande === true;

  // Riapri per domande rimaste ≤ 3 una sola volta (non a ogni turno).
  if (rimaste <= 3 && !giaLimiteDomande) {
    return {
      azione: 'riepilogo',
      apriRiepilogo: true,
      messaggio: MESSAGGIO_RIEPILOGO,
      perLimiteDomande: true,
    };
  }

  if (senzaNovita >= 2 || fuori >= 2) {
    const prox = prossimoPasso(passo);
    if (!prox || passo === 'terreni') {
      return {
        azione: 'riepilogo',
        apriRiepilogo: true,
        messaggio: MESSAGGIO_RIEPILOGO,
      };
    }
    return {
      azione: 'prossimoPasso',
      apriRiepilogo: false,
      messaggio: MESSAGGI_PASSAGGIO[passo] || MESSAGGIO_RIEPILOGO,
    };
  }

  return { azione: 'resta', apriRiepilogo: false };
}

/**
 * @param {{
 *   sede?: { indirizzo?: string, citta?: string, cap?: string, provincia?: string } | null,
 *   poderi?: Array<{ nome?: string }>,
 *   terreni?: Array<{ nome?: string, superficie?: string|number, coltura?: string|null, podere?: string|null }>
 * }} righe
 * @param {string} requestId
 */
/**
 * Stesse righe che la scheda di conferma mostra, dopo il ripristino della sessione.
 * @param {object|null|undefined} dati
 */
export function righeRiepilogo(dati) {
  const grezzi = dati && typeof dati === 'object' ? dati : {};
  const d = collegaTerreniAiPoderi({
    sede: grezzi.sede || null,
    poderi: Array.isArray(grezzi.poderi) ? grezzi.poderi : [],
    terreni: compattaTerreni(Array.isArray(grezzi.terreni) ? grezzi.terreni : []),
    ultimoPodere: grezzi.ultimoPodere || null,
  });
  const sede = {
    indirizzo: d.sede && d.sede.indirizzo ? d.sede.indirizzo : '',
    citta: d.sede && d.sede.citta ? d.sede.citta : '',
    cap: d.sede && d.sede.cap ? d.sede.cap : '',
    provincia: d.sede && d.sede.provincia ? d.sede.provincia : '',
  };
  const poderi = (d.poderi || []).map((p) => ({ nome: p && p.nome ? p.nome : '' }));
  const nomeUnico = poderi.length === 1 && poderi[0].nome ? poderi[0].nome : '';
  const terreni = (d.terreni || []).map((tr) => {
    const risolto =
      risolviNomePodere((tr && tr.podere) || '', poderi) ||
      (tr && tr.podere ? '' : nomeUnico);
    return {
      nome: nomeTerrenoVisibile(tr && tr.nome),
      superficie:
        tr && tr.superficie != null && tr.superficie !== ''
          ? String(tr.superficie).replace('.', ',')
          : '',
      coltura: tr && tr.coltura ? tr.coltura : '',
      podere: risolto || '',
    };
  });
  return {
    sede,
    poderi: poderi.length ? poderi : [{ nome: '' }],
    terreni: terreni.length
      ? terreni
      : [{ nome: '', superficie: '', coltura: '', podere: nomeUnico }],
  };
}

/**
 * Una riga con ettari o coltura e nome vuoto o sentinella non si può salvare.
 * @param {Array<{ nome?: string, superficie?: string, coltura?: string }>|undefined} terreni
 * @returns {Array<{ campo: string, errore: string }>}
 */
export function erroriNomeTerreniForm(terreni) {
  const out = [];
  (Array.isArray(terreni) ? terreni : []).forEach((t, i) => {
    const sup = String(t && t.superficie != null ? t.superficie : '').trim();
    const col = String(t && t.coltura != null ? t.coltura : '').trim();
    if (!sup && !col) return;
    if (nomeTerrenoVisibile(t && t.nome)) return;
    out.push({ campo: 'terreni[' + i + '].nome', errore: 'Scrivi il nome del terreno' });
  });
  return out;
}

export function payloadDaScheda(righe, requestId) {
  const r = righe && typeof righe === 'object' ? righe : {};
  let sede = null;
  if (r.sede && typeof r.sede === 'object') {
    const indirizzo = String(r.sede.indirizzo || '').trim();
    const citta = String(r.sede.citta || '').trim();
    const cap = String(r.sede.cap || '').trim();
    const provincia = String(r.sede.provincia || '').trim();
    if (indirizzo || citta) {
      sede = {
        indirizzo: indirizzo || null,
        citta: citta || null,
        cap: cap || null,
        provincia: provincia || null,
      };
    }
  }

  const poderi = [];
  if (Array.isArray(r.poderi)) {
    for (const p of r.poderi) {
      const nome = String(p && p.nome != null ? p.nome : '').trim();
      if (!nome) continue;
      poderi.push({ nome });
    }
  }

  const terreni = [];
  if (Array.isArray(r.terreni)) {
    for (const t of r.terreni) {
      const nome = nomeTerrenoVisibile(t && t.nome);
      if (!nome) continue;
      const superficie = numeroDaTesto(t && t.superficie != null ? t.superficie : '');
      let coltura = null;
      if (t && t.coltura != null && String(t.coltura).trim()) {
        const grezzo = String(t.coltura).trim();
        const norm = normalizzaColturaCatalogo(grezzo);
        if (norm) coltura = norm;
        else if (!colturaOrtaggiGenerica(grezzo)) coltura = grezzo;
      }
      terreni.push({
        nome,
        superficie,
        coltura,
        podere:
          t && t.podere != null && String(t.podere).trim()
            ? String(t.podere).trim()
            : null,
      });
    }
  }

  return {
    requestId: String(requestId || ''),
    sede,
    poderi,
    terreni,
  };
}

/**
 * @param {object} payload
 */
export function controllaScheda(payload) {
  const validata = validaRichiestaSetup(payload);
  if (!validata.ok) {
    if (validata.motivo === 'niente-da-salvare') {
      return { ok: false, codice: 'niente-da-salvare', errori: [] };
    }
    const errori = Array.isArray(validata.errori) ? validata.errori : [];
    return {
      ok: false,
      codice: 'dati-non-validi',
      errori: errori.map((e) => ({
        campo: e.campo,
        errore: e.errore,
      })),
    };
  }

  const risolta = risolviControAzienda(validata.richiesta, {
    poderi: [],
    terreni: [],
    coltureAzienda: [],
  });
  if (!risolta.ok) {
    return {
      ok: false,
      codice: 'dati-non-validi',
      errori: (risolta.errori || []).map((e) => ({
        campo: e.campo,
        errore: e.errore,
      })),
    };
  }

  const da = risolta.daScrivere || {};
  const nienteDaSalvare =
    !da.sede &&
    !(da.poderiDaCreare && da.poderiDaCreare.length) &&
    !(da.terreni && da.terreni.length);
  if (nienteDaSalvare) {
    return { ok: false, codice: 'niente-da-salvare', errori: [] };
  }

  return { ok: true, daScrivere: da };
}

export function nuovoRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req-' + Date.now() + '-' + Math.floor(Math.random() * 1e9);
}

/**
 * @param {{ codice?: string, motivo?: string, dettagli?: object }} errore
 * @param {{ collegato?: boolean, email?: string }} [ctx]
 */
export function messaggioErroreSetup(errore, ctx) {
  const t = testiLanding.tonyBussa.aiuto.errori;
  const e = errore && typeof errore === 'object' ? errore : {};
  const motivo = String(e.motivo || e.codice || '');
  const dettagli = e.dettagli && typeof e.dettagli === 'object' ? e.dettagli : {};
  void ctx;
  const email = EMAIL_CONTATTO || '';

  if (motivo === 'unauthenticated' || motivo === 'non-collegato') {
    return t.nonCollegato;
  }
  if (motivo === 'app-check' || motivo === 'failed-precondition') {
    return t.appCheck;
  }
  if (motivo === 'troppe-chiamate' || motivo === 'resource-exhausted') {
    return t.troppeChiamate;
  }
  if (motivo === 'dati-non-validi' || motivo === 'invalid-argument') {
    return t.datiNonValidi;
  }
  if (motivo === 'niente-da-salvare') {
    return t.nienteDaSalvare;
  }
  if (motivo === 'senza-azienda' || motivo === 'non-autorizzato') {
    let msg = t.senzaAzienda;
    if (email) {
      msg += ' ' + t.contatto.replace('{email}', email);
    }
    return msg;
  }
  if (motivo === 'limite-terreni') {
    const esistenti =
      typeof dettagli.esistenti === 'number' ? dettagli.esistenti : 0;
    const limite = typeof dettagli.limite === 'number' ? dettagli.limite : 5;
    const rimasti = Math.max(0, limite - esistenti);
    return t.limiteTerreni
      .replace('{esistenti}', String(esistenti))
      .replace('{rimasti}', String(rimasti));
  }
  if (motivo === 'gia-preparato' || motivo === 'already-exists') {
    return t.giaPreparato;
  }
  if (motivo === 'unavailable' || motivo === 'rete') {
    return t.rete;
  }
  return t.rete;
}

/**
 * @param {object} risposta
 */
export function esitoSalvataggio(risposta) {
  if (!risposta || typeof risposta !== 'object') return { ok: false };
  if (risposta.ok === true) return { ok: true };
  if (risposta.giaSalvato === true) return { ok: true };
  if (risposta.data && risposta.data.ok === true) return { ok: true };
  if (risposta.data && risposta.data.giaSalvato === true) return { ok: true };
  return { ok: false };
}
