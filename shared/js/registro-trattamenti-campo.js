/**
 * Testo della miscela nel workspace di campo. Le frasi arrivano dal catalogo lingua.
 * @module shared/js/registro-trattamenti-campo
 */

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : esc(value);
}

/**
 * @param {object|null} miscela
 * @param {(key: string, params?: object) => string} traduci
 */
export function htmlMiscelaCampo(miscela, traduci) {
  const t = typeof traduci === 'function' ? traduci : (key) => key;
  if (!miscela || !Array.isArray(miscela.prodotti) || !miscela.prodotti.length) return '';
  const righe = miscela.prodotti.map((p) => {
    const pezzi = [
      '<strong>' + esc(p.nome || t('miscela.product')) + '</strong>',
      t('miscela.doseHa') + ': ' + num(p.dosePerEttaro),
      t('miscela.qty') + ': ' + num(p.quantita) + (p.unita ? ' ' + esc(p.unita) : ''),
      t('miscela.doseHl') + ': ' + (p.dosePerEttolitro != null ? num(p.dosePerEttolitro) : t('miscela.noDoseHl'))
    ];
    if (miscela.capacitaBotteQuintali && p.doseBottePiena != null) {
      pezzi.push(t('miscela.tankDose') + ': ' + num(p.doseBottePiena) + (p.unita ? ' ' + esc(p.unita) : ''));
    }
    return '<li>' + pezzi.join(' · ') + '</li>';
  }).join('');
  const acqua = t('miscela.waterHa') + ': ' + num(miscela.ettolitriPerEttaro)
    + ' · ' + t('miscela.waterTot') + ': ' + num(miscela.ettolitriTotali);
  let botte = '';
  if (miscela.capacitaBotteQuintali) {
    botte = '<p>' + esc(t('miscela.tank', {
      nome: miscela.nomeAttrezzo || '',
      quintali: miscela.capacitaBotteQuintali,
      botti: miscela.bottiPiene != null ? miscela.bottiPiene : '—'
    })) + '</p>';
    if (miscela.ultimaBotte && Array.isArray(miscela.ultimaBotte.prodotti)) {
      const ultima = miscela.ultimaBotte.prodotti.map((p) =>
        esc(p.nome || '') + ' ' + num(p.quantita) + (p.unita ? ' ' + esc(p.unita) : '')
      ).join(', ');
      botte += '<p>' + esc(t('miscela.lastTank', { hl: miscela.ultimaBotte.ettolitri })) + ' ' + ultima + '</p>';
    }
  }
  return '<section class="work-select-card gfv-card-inner" id="miscela-lavoro-corpo">'
    + '<h3 class="inline-team-title">' + esc(t('miscela.title')) + '</h3>'
    + '<p>' + acqua + '</p>'
    + '<ul>' + righe + '</ul>'
    + botte
    + '</section>';
}
