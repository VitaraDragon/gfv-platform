/**
 * Validazione e payload Firestore Conto Terzi per Admin SDK (no modelli browser).
 * @module simulator/lib/conto-terzi-write
 */

const TIPI_CAMPO = new Set(['pianura', 'collina', 'montagna']);
const STATI_CLIENTE = new Set(['attivo', 'sospeso', 'archiviato']);
const STATI_PREVENTIVO = new Set([
  'bozza',
  'inviato',
  'accettato_email',
  'accettato_manager',
  'rifiutato',
  'scaduto',
  'pianificato',
  'annullato'
]);

function result(errors) {
  return { valid: errors.length === 0, errors };
}

export function validateCliente(raw) {
  const errors = [];
  if (!raw.ragioneSociale?.trim()) errors.push('Ragione sociale obbligatoria');
  if (raw.stato && !STATI_CLIENTE.has(raw.stato)) errors.push('Stato cliente non valido');
  return result(errors);
}

export function validatePodereCliente(raw) {
  const errors = [];
  if (!raw.clienteId?.trim()) errors.push('Cliente obbligatorio');
  if (!raw.nome?.trim()) errors.push('Nome podere obbligatorio');
  if (raw.coordinate) {
    if (typeof raw.coordinate.lat !== 'number' || typeof raw.coordinate.lng !== 'number') {
      errors.push('Coordinate non valide');
    }
  }
  return result(errors);
}

export function validateTariffa(raw) {
  const errors = [];
  if (!raw.tipoLavoro?.trim()) errors.push('Tipo lavoro obbligatorio');
  if (!TIPI_CAMPO.has(raw.tipoCampo)) errors.push('Tipo campo non valido');
  if (!raw.tariffaBase || raw.tariffaBase <= 0) errors.push('Tariffa base obbligatoria');
  if (!raw.coefficiente || raw.coefficiente <= 0) errors.push('Coefficiente obbligatorio');
  return result(errors);
}

export function validatePreventivo(raw) {
  const errors = [];
  if (!raw.clienteId) errors.push('Cliente obbligatorio');
  if (!raw.tipoLavoro?.trim()) errors.push('Tipo lavoro obbligatorio');
  if (!raw.coltura?.trim()) errors.push('Coltura obbligatoria');
  if (!TIPI_CAMPO.has(raw.tipoCampo)) errors.push('Tipo campo non valido');
  if (!raw.superficie || raw.superficie <= 0) errors.push('Superficie non valida');
  if (raw.stato && !STATI_PREVENTIVO.has(raw.stato)) errors.push('Stato preventivo non valido');
  if (raw.iva < 0 || raw.iva > 100) errors.push('IVA non valida');
  if (raw.giorniScadenza < 1) errors.push('Giorni scadenza non validi');
  return result(errors);
}

/**
 * @param {object} raw — da generaPreventivi
 */
export function preparePreventivoForFirestore(raw) {
  const totaleConIva = parseFloat((raw.totale * (1 + raw.iva / 100)).toFixed(2));
  return {
    numero: raw.numero,
    clienteId: raw.clienteId,
    terrenoId: raw.terrenoId,
    tipoLavoro: raw.tipoLavoro,
    coltura: raw.coltura,
    tipoCampo: raw.tipoCampo,
    superficie: raw.superficie,
    macchinaId: raw.macchinaId,
    dataPrevista: raw.dataPrevista,
    stato: raw.stato,
    totale: raw.totale,
    iva: raw.iva,
    totaleConIva,
    note: raw.note,
    tokenAccettazione: raw.tokenAccettazione,
    dataInvio: raw.dataInvio,
    dataScadenza: raw.dataScadenza,
    dataAccettazione: raw.dataAccettazione,
    giorniScadenza: raw.giorniScadenza,
    lavoroId: raw.lavoroId
  };
}

export function prepareClienteForFirestore(raw) {
  const data = { ...raw };
  if (data.partitaIva) data.partitaIva = String(data.partitaIva).replace(/\s/g, '');
  if (data.codiceFiscale) data.codiceFiscale = String(data.codiceFiscale).replace(/\s/g, '').toUpperCase();
  return data;
}
