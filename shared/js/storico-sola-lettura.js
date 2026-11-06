/**
 * Storico in sola lettura. Nessuna regola dei 12 mesi.
 * Al cambio coltura i lavori aperti vengono chiusi e restano sempre in sola lettura
 * (`chiusoPerCambioColtura` / `motivoChiusura: 'cambio_coltura'`), qualunque sia la data.
 * I lavori chiusi iniziati prima di `colturaDal` restano in sola lettura.
 *
 * @module shared/js/storico-sola-lettura
 */

export const MESSAGGIO_SOLA_LETTURA =
  'Lavoro di un terreno archiviato (o precedente al cambio coltura): solo consultazione';

export const MESSAGGIO_SOLA_LETTURA_CAMBIO_COLTURA =
  'Lavoro chiuso al cambio coltura: solo consultazione';

export const MESSAGGIO_ORE_SOLA_LETTURA =
  'Il lavoro è in sola lettura: non si possono segnare ore.';

export const NOTA_COLTURA_PRECEDENTE =
  'Lavoro iniziato prima del cambio coltura: resta sulla coltura precedente';

export const NOTA_COLTURA_DAL_TERRENO =
  'La coltura viene dal terreno. Per cambiarla modifica il terreno';

const STATI_LAVORO_CHIUSI = new Set(['completato', 'annullato']);

export function isLavoroChiusoPerCambioColtura(lavoro) {
  if (!lavoro) return false;
  if (lavoro.chiusoPerCambioColtura === true) return true;
  return String(lavoro.motivoChiusura || '').toLowerCase() === 'cambio_coltura';
}

export function isLavoroChiuso(lavoro) {
  const stato = String(lavoro && lavoro.stato || '').toLowerCase();
  return STATI_LAVORO_CHIUSI.has(stato);
}

/**
 * Messaggio banner: variante dedicata se chiuso al cambio coltura.
 */
export function messaggioSolaLetturaLavoro(lavoro) {
  if (isLavoroChiusoPerCambioColtura(lavoro)) return MESSAGGIO_SOLA_LETTURA_CAMBIO_COLTURA;
  return MESSAGGIO_SOLA_LETTURA;
}

export function istanteRecord(record, campi = ['dataInizio', 'data', 'createdAt', 'creatoIl']) {
  if (!record) return null;
  for (const campo of campi) {
    const valore = record[campo];
    if (valore == null || valore === '') continue;
    if (valore instanceof Date && !Number.isNaN(valore.getTime())) return valore.getTime();
    if (typeof valore.toDate === 'function') {
      const data = valore.toDate();
      if (data instanceof Date && !Number.isNaN(data.getTime())) return data.getTime();
    }
    if (typeof valore === 'object' && typeof valore.seconds === 'number') {
      return valore.seconds * 1000;
    }
    const data = new Date(valore);
    if (!Number.isNaN(data.getTime())) return data.getTime();
  }
  return null;
}

function istanteColturaDal(terreno) {
  if (!terreno || terreno.colturaDal == null || terreno.colturaDal === '') return null;
  return istanteRecord({ data: terreno.colturaDal }, ['data']);
}

export function isTerrenoArchiviato(terreno) {
  return !!(terreno && terreno.stato === 'archiviato');
}

/**
 * @param {object|null|undefined} lavoro
 * @param {object|null|undefined} terreno
 */
export function isLavoroSolaLettura(lavoro, terreno) {
  if (!lavoro) return false;
  if (isLavoroChiusoPerCambioColtura(lavoro)) return true;
  if (!terreno) return false;
  if (isTerrenoArchiviato(terreno)) return true;
  const soglia = istanteColturaDal(terreno);
  if (soglia == null) return false;
  const quando = istanteRecord(lavoro, ['dataInizio', 'createdAt', 'creatoIl']);
  if (quando == null || quando >= soglia) return false;
  return isLavoroChiuso(lavoro);
}

/**
 * Potature, trattamenti, concimazioni, vendemmie, raccolte, ore.
 * Se c'è un lavoro, seguono il lavoro. Altrimenti l'impianto chiuso o la data.
 */
export function htmlAzioniRegistro(solaLettura, azioni) {
  if (solaLettura) return '<span title="Solo consultazione">Solo consultazione</span>';
  return azioni;
}

export function isRegistroSolaLettura({ registro, lavoro, terreno, impianto } = {}) {
  if (lavoro) return isLavoroSolaLettura(lavoro, terreno);
  if (isTerrenoArchiviato(terreno)) return true;
  if (impianto && impianto.statoImpianto === 'chiuso') return true;
  const soglia = istanteColturaDal(terreno);
  if (soglia == null) return false;
  const quando = istanteRecord(registro, ['data', 'dataInizio', 'createdAt', 'creatoIl']);
  if (quando == null) return false;
  return quando < soglia;
}

/**
 * Diario. Se è collegata a un lavoro, segue il lavoro (aperto = modificabile).
 */
export function isAttivitaSolaLettura(attivita, terreno, lavoroCollegato) {
  if (lavoroCollegato) return isLavoroSolaLettura(lavoroCollegato, terreno);
  if (isTerrenoArchiviato(terreno)) return true;
  const soglia = istanteColturaDal(terreno);
  if (soglia == null) return false;
  const quando = istanteRecord(attivita, ['data', 'dataInizio', 'createdAt', 'creatoIl']);
  if (quando == null) return false;
  return quando < soglia;
}

export function lavoroApertoPrimaDelCambio(record, terreno) {
  if (!record || !terreno || isTerrenoArchiviato(terreno)) return false;
  if (isLavoroChiuso(record)) return false;
  const soglia = istanteColturaDal(terreno);
  if (soglia == null) return false;
  const quando = istanteRecord(record, ['dataInizio', 'data', 'createdAt', 'creatoIl']);
  if (quando == null) return false;
  return quando < soglia;
}

/**
 * Coltura del salvataggio. Con un terreno che ha coltura, si usa quella.
 * Eccezione: record aperto iniziato prima del cambio coltura.
 * @param {{ terreno?: object, colturaForm?: string, recordEsistente?: object, isNuovo?: boolean }} input
 */
export function risolviColturaDaTerreno({ terreno, colturaForm, recordEsistente, isNuovo = true } = {}) {
  if (!terreno || !terreno.coltura) {
    return { libera: true, coltura: colturaForm || null, nota: '' };
  }
  const record = recordEsistente || null;
  if (!isNuovo && record && lavoroApertoPrimaDelCambio(record, terreno)) {
    return {
      libera: false,
      coltura: record.coltura || colturaForm || null,
      categoria: record.colturaCategoria || record.categoriaColtura || null,
      nota: NOTA_COLTURA_PRECEDENTE
    };
  }
  return {
    libera: false,
    coltura: terreno.coltura,
    categoria: terreno.colturaCategoria || null,
    nota: NOTA_COLTURA_DAL_TERRENO
  };
}
