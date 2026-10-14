/**
 * Passaggi già registrati sullo stesso campo, per l'avviso prima del lavoro.
 * Se un modulo non è attivo, quel ramo resta vuoto.
 * @module shared/js/registro-trattamenti-passaggi
 */

import { colturaSchedaRegistro } from '../../core/config/registro-trattamenti-specie.js';

function daTrattamenti(lista, terrenoId) {
  const out = [];
  (lista || []).forEach((t) => {
    const prodotti = t && Array.isArray(t.prodotti) ? t.prodotti : [];
    prodotti.forEach((p) => {
      if (!p || (!p.prodottoId && !p.prodotto)) return;
      out.push({
        id: t.id,
        data: t.data,
        terrenoId,
        prodottoId: p.prodottoId || null,
        nome: p.prodotto || ''
      });
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

  return { specie, passaggi };
}
