/**
 * Generazione PDF calcolo vendemmia meccanica (browser + jsPDF CDN)
 * @module modules/vendemmia-meccanica/services/calcolo-vm-pdf-service
 */

import { DESTINAZIONI_TRASPORTO_PRESET } from '../config/vm-constants.js';

const MORF_LABELS = {
  pianura: 'Pianura',
  collina: 'Collina',
  montagna: 'Montagna'
};

/**
 * @param {number} n
 * @returns {string}
 */
export function formatEuroPdf(n) {
  const v = Number(n) || 0;
  return 'EUR ' + v.toFixed(2).replace('.', ',');
}

/**
 * @param {string} id
 * @returns {string}
 */
export function getDestinazioneLabel(id) {
  const found = DESTINAZIONI_TRASPORTO_PRESET.find((d) => d.id === id);
  return found ? found.label : String(id || '—');
}

/**
 * @param {string} morf
 * @returns {string}
 */
export function getMorfologiaLabel(morf) {
  if (!morf) return '—';
  return MORF_LABELS[String(morf).toLowerCase()] || morf;
}

/**
 * @param {object} breakdown — output calcolaCompensoVendemmia().breakdown
 * @param {object} [options]
 * @param {string} [options.dataVendemmia]
 * @param {string} [options.note]
 * @param {string} [options.aziendaNome]
 * @param {boolean} [options.download=true]
 * @returns {import('jspdf').jsPDF}
 */
export function generaPdfCalcoloVm(breakdown, options = {}) {
  if (typeof window === 'undefined' || !window.jspdf) {
    throw new Error('Libreria PDF non caricata. Ricarica la pagina.');
  }
  if (!breakdown || !breakdown.clienteId) {
    throw new Error('Nessun calcolo valido da esportare.');
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const lineHeight = 6;
  let y = margin;

  function ensureSpace(need = lineHeight) {
    if (y + need > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function writeLine(text, opts = {}) {
    const size = opts.size || 10;
    const bold = opts.bold || false;
    const indent = opts.indent || 0;
    doc.setFontSize(size);
    doc.setFont(undefined, bold ? 'bold' : 'normal');
    ensureSpace(lineHeight);
    doc.text(String(text), margin + indent, y);
    y += lineHeight * (opts.spacing || 1);
  }

  const dataVendemmia = options.dataVendemmia || new Date().toISOString().slice(0, 10);
  const destLabel = getDestinazioneLabel(breakdown.destinazioneTrasporto);

  // Titolo
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Calcolo Vendemmia Meccanica', pageWidth / 2, y, { align: 'center' });
  y += lineHeight * 2;

  if (options.aziendaNome) {
    writeLine(options.aziendaNome, { size: 11, bold: true });
  }

  writeLine('Cliente: ' + (breakdown.clienteNome || breakdown.clienteId), { bold: true });
  writeLine('Data vendemmia: ' + dataVendemmia);
  writeLine('Anno stagione: ' + (breakdown.anno || '—'));
  writeLine('Destinazione trasporto: ' + destLabel);
  y += 4;

  // Tabella terreni
  writeLine('Dettaglio terreni', { size: 12, bold: true, spacing: 1.2 });

  const colX = {
    nome: margin,
    morf: margin + 42,
    palo: margin + 68,
    haEff: margin + 88,
    haTot: margin + 108,
    tariffa: margin + 128,
    importo: margin + 152
  };

  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  ensureSpace(lineHeight * 2);
  doc.text('Terreno', colX.nome, y);
  doc.text('Morf.', colX.morf, y);
  doc.text('Palo', colX.palo, y);
  doc.text('Ha eff.', colX.haEff, y);
  doc.text('Ha tot.', colX.haTot, y);
  doc.text('EUR/ha', colX.tariffa, y);
  doc.text('Importo', colX.importo, y);
  y += 4;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += lineHeight * 0.6;

  doc.setFont(undefined, 'normal');
  (breakdown.terreni || []).forEach((r) => {
    ensureSpace(lineHeight * 1.5);
    const nome = String(r.nome || '').slice(0, 22);
    doc.text(nome, colX.nome, y);
    doc.text(getMorfologiaLabel(r.morfologia).slice(0, 8), colX.morf, y);
    doc.text(String(r.tipoPalo || '—').slice(0, 10), colX.palo, y);
    doc.text((Number(r.ettariEffettivi) || 0).toFixed(2), colX.haEff, y);
    doc.text((Number(r.ettariTotali) || 0).toFixed(2), colX.haTot, y);
    doc.text(formatEuroPdf(r.tariffaPerEttaro).replace('EUR ', ''), colX.tariffa, y);
    doc.text(formatEuroPdf(r.importoVendemmia).replace('EUR ', ''), colX.importo, y);
    if (r.zoneEsclusePresenti) {
      y += lineHeight * 0.85;
      doc.setFontSize(7);
      doc.text('* Superficie netta (zone escluse)', colX.nome, y);
      doc.setFontSize(8);
    }
    y += lineHeight;
  });

  y += 4;
  writeLine('—'.repeat(40), { size: 8 });

  writeLine('Totale vendemmia: ' + formatEuroPdf(breakdown.totaleVendemmia), { bold: true });
  writeLine(
    'Trasporto: ' + formatEuroPdf(breakdown.totaleTrasporto) +
    ' (' + (Number(breakdown.quintali) || 0).toFixed(2) + ' qli x ' +
    formatEuroPdf(breakdown.tariffaTrasportoQli) + '/qli)'
  );

  const sconto = Number(breakdown.scontoMaggiorazione) || 0;
  if (sconto !== 0) {
    const label = sconto < 0 ? 'Sconto' : 'Maggiorazione';
    writeLine(label + ': ' + formatEuroPdf(sconto));
  }

  y += 2;
  writeLine('TOTALE FINALE: ' + formatEuroPdf(breakdown.totaleFinale), { size: 13, bold: true, spacing: 1.3 });

  if (options.note) {
    y += 2;
    writeLine('Note: ' + options.note, { size: 9 });
  }

  y += 4;
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  ensureSpace(lineHeight);
  doc.text(
    'Documento generato il ' + new Date().toLocaleString('it-IT') + ' — GFV Platform',
    margin,
    pageHeight - 10
  );

  if (options.download !== false) {
    const safeName = (breakdown.clienteNome || 'cliente')
      .replace(/[^\w\s-]/gi, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 40) || 'cliente';
    const fileName = 'calcolo_vendemmia_' + safeName + '_' + dataVendemmia + '.pdf';
    doc.save(fileName);
  }

  return doc;
}

export default {
  formatEuroPdf,
  getDestinazioneLabel,
  getMorfologiaLabel,
  generaPdfCalcoloVm
};
