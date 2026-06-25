/**
 * Resoconto testuale run simulatore.
 * @module simulator/lib/report
 */

export function formatSuccessReport(result) {
  const lines = [
    '=== GFV Farm Simulator — Run completato ===',
    `Template: ${result.templateId}`,
    `Run ID: ${result.runId}`,
    'Esito: SUCCESS',
    '',
    `Azienda: ${result.aziendaNome}`,
    `Tenant ID: ${result.tenantId}`,
    `Utente: ${result.email} (uid: ${result.userId})`,
    `Password (emulator): ${result.password}`,
    '',
    'Creati:',
    `  terreni: ${result.counts.terreni}`,
    `  trattori: ${result.counts.trattori}`,
    `  attrezzi: ${result.counts.attrezzi}`,
    `  vigneti: ${result.counts.vigneti}`,
    `  prodotti: ${result.counts.prodotti}`,
    `  attività: ${result.counts.attivita}${result.dateRange ? ` (${result.dateRange.from} → ${result.dateRange.to})` : ''}`
  ];
  if (result.counts.movimentiMagazzino != null) {
    lines.push(`  movimenti magazzino: ${result.counts.movimentiMagazzino}`);
  }
  if (result.counts.potatureVigneto != null) {
    lines.push(`  potature vigneto: ${result.counts.potatureVigneto}`);
  }
  if (result.counts.trattamentiVigneto != null) {
    lines.push(`  trattamenti vigneto: ${result.counts.trattamentiVigneto}`);
  }
  if (result.counts.prodottiSottoScorta != null) {
    lines.push(`  prodotti sotto scorta: ${result.counts.prodottiSottoScorta}`);
  }
  lines.push(
    '',
    `Durata: ${(result.durationMs / 1000).toFixed(1)}s`,
    'Manifest: simulator/manifest.json'
  );
  return lines.join('\n');
}

export function formatErrorReport(error, phase) {
  return [
    '=== GFV Farm Simulator — Run fallito ===',
    `Fase: ${phase || 'sconosciuta'}`,
    `Errore: ${error.message}`,
    error.stack ? `\n${error.stack}` : ''
  ].join('\n');
}

export function printReport(text) {
  console.log(text);
}
