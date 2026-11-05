/**
 * Filtra tipi e categorie lavoro in base alla famiglia di coltura del terreno.
 * Campo esplicito `colture` sul tipo; se manca, ripiego dal nome (solo in lettura).
 *
 * @module shared/js/tipi-lavoro-per-coltura
 */

import { famigliaColtura } from './coltura-terreno.js';

/** Tipi «a filari»: solo vigneto / frutteto / arboreo. */
const SOTTOCAT_FILARI = [/tra\s*le\s*file/i, /sulla\s*fila/i];
const CODICI_FILARI = [/tra_file/, /sulla_fila/];

const TITLE_NON_DISPONIBILE = 'Non disponibile per questa coltura';

/**
 * Inferisce le famiglie di coltura ammesse per un tipo (senza scrivere sul catalogo).
 * @param {{ nome?: string, descrizione?: string, colture?: string[], sottocategoriaCodice?: string, sottocategoriaNome?: string }} tipo
 * @returns {string[]|null} null = nessuna restrizione
 */
export function inferColtureTipoLavoro(tipo) {
  if (!tipo) return null;
  if (Array.isArray(tipo.colture) && tipo.colture.length) {
    return tipo.colture.map((c) => String(c).toLowerCase());
  }

  const nome = String(tipo.nome || '');
  const desc = String(tipo.descrizione || '');
  const testo = `${nome} ${desc}`.toLowerCase();
  const sottocod = String(tipo.sottocategoriaCodice || tipo.codiceSottocategoria || '').toLowerCase();
  const sottoNome = String(tipo.sottocategoriaNome || '').toLowerCase();

  if (/vendemmia/i.test(nome) || /vendemmia/i.test(desc)) return ['vigneto'];
  if (/piantagione\s+viti/i.test(nome) || /impianto\s+nuovo\s+vigneto/i.test(nome)) return ['vigneto'];
  if (/impianto\s+nuovo\s+frutteto/i.test(nome)) return ['frutteto'];
  if (/raccolta\s+con\s+scuotitore/i.test(nome)) return ['frutteto', 'arboreo'];
  if (/impianto\s+nuovo\s+oliveto/i.test(nome)) return ['arboreo', 'frutteto'];

  if (
    CODICI_FILARI.some((re) => re.test(sottocod)) ||
    SOTTOCAT_FILARI.some((re) => re.test(sottoNome)) ||
    SOTTOCAT_FILARI.some((re) => re.test(testo))
  ) {
    return ['vigneto', 'frutteto', 'arboreo'];
  }

  return null;
}

/**
 * @param {object|string|null|undefined} terrenoOFamiglia
 * @returns {string}
 */
export function famigliaDaTerrenoOStringa(terrenoOFamiglia) {
  if (typeof terrenoOFamiglia === 'string') {
    const s = terrenoOFamiglia.toLowerCase();
    if (['vigneto', 'frutteto', 'seminativo', 'arboreo', 'altro', 'nessuna'].includes(s)) return s;
    return famigliaColtura(terrenoOFamiglia);
  }
  return famigliaColtura(terrenoOFamiglia);
}

function tipoAmmessoPerFamiglia(tipo, famiglia) {
  const ammesse = inferColtureTipoLavoro(tipo);
  if (!ammesse || !ammesse.length) return true;
  if (!famiglia || famiglia === 'nessuna' || famiglia === 'altro') return true;
  if (famiglia === 'arboreo') {
    return ammesse.includes('arboreo') || ammesse.includes('frutteto') || ammesse.includes('vigneto');
  }
  return ammesse.includes(famiglia);
}

/**
 * @param {Array} tipi
 * @param {string|object|null|undefined} famigliaOTerreno
 * @param {{ keepNome?: string|null, keepId?: string|null }} [opzioni]
 */
export function filtraTipiLavoroPerColtura(tipi, famigliaOTerreno, opzioni = {}) {
  const lista = Array.isArray(tipi) ? tipi : [];
  const famiglia = famigliaDaTerrenoOStringa(famigliaOTerreno);
  const keepNome = opzioni.keepNome ? String(opzioni.keepNome).trim().toLowerCase() : '';
  const keepId = opzioni.keepId ? String(opzioni.keepId) : '';

  const filtrati = lista.filter((tipo) => {
    if (keepId && String(tipo.id || '') === keepId) return true;
    if (keepNome && String(tipo.nome || '').trim().toLowerCase() === keepNome) return true;
    return tipoAmmessoPerFamiglia(tipo, famiglia);
  });

  return filtrati;
}

/**
 * Nasconde (o marca) le categorie senza tipi validi per la coltura.
 * @returns {Array<{ categoria: object, nascosta: boolean, title?: string }>}
 */
export function filtraCategoriePerColtura(categorie, tipi, famigliaOTerreno, opzioni = {}) {
  const cats = Array.isArray(categorie) ? categorie : [];
  const famiglia = famigliaDaTerrenoOStringa(famigliaOTerreno);
  const tipiOk = new Set(
    filtraTipiLavoroPerColtura(tipi, famiglia, opzioni).map((t) => t.id || t.nome)
  );
  const getTipiDiCategoria = opzioni.tipiDiCategoria || ((cat) => {
    const id = cat && cat.id;
    return (tipi || []).filter((t) =>
      t.categoriaId === id || t.sottocategoriaId === id || t.parentCategoriaId === id
    );
  });

  return cats.map((categoria) => {
    const figli = getTipiDiCategoria(categoria);
    if (!figli.length) {
      return { categoria, nascosta: false };
    }
    const qualcuno = figli.some((t) => tipiOk.has(t.id || t.nome) || tipoAmmessoPerFamiglia(t, famiglia));
    if (qualcuno) return { categoria, nascosta: false };
    return { categoria, nascosta: true, title: TITLE_NON_DISPONIBILE };
  });
}

/**
 * Solo per Lavorazione del Terreno ha senso Generale → Tra le File.
 */
export function isCategoriaLavorazioneTerreno(categoriaNomeOOggetto) {
  const nome = typeof categoriaNomeOOggetto === 'string'
    ? categoriaNomeOOggetto
    : (categoriaNomeOOggetto && categoriaNomeOOggetto.nome) || '';
  return String(nome).toLowerCase().includes('lavorazione') && String(nome).toLowerCase().includes('terreno');
}

export function shouldAutoSwitchTraLeFile({
  currentAttivitaId,
  precompilazione,
  categoriaPrincipaleNome,
  sottocategoriaNome
} = {}) {
  if (currentAttivitaId) return false;
  if (precompilazione) return false;
  if (!isCategoriaLavorazioneTerreno(categoriaPrincipaleNome)) return false;
  const sotto = String(sottocategoriaNome || '').toLowerCase();
  // Solo se la sottocategoria è Generale (o non impostata)
  return !sotto || sotto.includes('generale');
}

export { TITLE_NON_DISPONIBILE };
