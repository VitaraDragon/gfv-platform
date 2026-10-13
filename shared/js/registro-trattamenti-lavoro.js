/**
 * Miscela prevista sul form lavoro. Visibile solo se il tipo è un trattamento.
 * @module shared/js/registro-trattamenti-lavoro
 */

import {
  calcolaMiscela,
  avvisoImpieghiEIntervallo,
  NOTA_REGISTRO_PRIVATO,
  confermaSpecieSalvata
} from './registro-trattamenti.js';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function tipoLavoroETrattamento(nome) {
  return String(nome || '').toLowerCase().includes('trattament');
}

export function aggiornaSezioneMiscelaLavoro() {
  const section = document.getElementById('lavoro-miscela-section');
  if (!section) return;
  const sel = document.getElementById('lavoro-tipo-lavoro');
  const nome = sel && sel.options && sel.selectedIndex >= 0
    ? (sel.options[sel.selectedIndex].text || sel.value)
    : '';
  section.style.display = tipoLavoroETrattamento(nome) ? 'block' : 'none';
}

function leggiProdottiMiscelaDalForm() {
  const rows = [];
  const id = document.getElementById('lavoro-miscela-prodotto')?.value || '';
  const nomeSel = document.getElementById('lavoro-miscela-prodotto');
  const nomeOpt = nomeSel && nomeSel.selectedIndex >= 0 ? nomeSel.options[nomeSel.selectedIndex].text : '';
  const nomeLibero = document.getElementById('lavoro-miscela-nome')?.value?.trim() || '';
  const dose = document.getElementById('lavoro-miscela-dose-ha')?.value;
  const nome = id ? nomeOpt : nomeLibero;
  if (nome && nome !== '— Nessun prodotto —') {
    rows.push({
      prodottoId: id || null,
      nome,
      dosePerEttaro: dose,
      unita: nomeSel?.selectedOptions?.[0]?.getAttribute('data-unita') || null,
      dosePerEttolitro: nomeSel?.selectedOptions?.[0]?.getAttribute('data-dose-hl') || null
    });
  }
  document.querySelectorAll('#tbody-miscela-lavoro tr[data-extra]').forEach((tr) => {
    const extraId = tr.getAttribute('data-prodotto-id') || null;
    const extraNome = tr.getAttribute('data-nome') || '';
    const extraDose = tr.querySelector('.miscela-dose-extra')?.value;
    if (!extraNome) return;
    rows.push({
      prodottoId: extraId,
      nome: extraNome,
      dosePerEttaro: extraDose,
      unita: tr.getAttribute('data-unita') || null,
      dosePerEttolitro: tr.getAttribute('data-dose-hl') || null
    });
  });
  return rows;
}

export function componiMiscelaDalForm(ettari, attrezzo) {
  const quintali = attrezzo && attrezzo.capacitaBotteQuintali != null ? attrezzo.capacitaBotteQuintali : null;
  return calcolaMiscela({
    ettari,
    ettolitriPerEttaro: document.getElementById('lavoro-acqua-hl-ha')?.value,
    ettolitriTotali: document.getElementById('lavoro-acqua-hl-tot')?.value,
    capacitaBotteQuintali: quintali,
    nomeAttrezzo: attrezzo && attrezzo.nome ? attrezzo.nome : null,
    prodotti: leggiProdottiMiscelaDalForm()
  });
}

export function scriviMiscelaNelForm(miscela) {
  const m = miscela || {};
  const perHa = document.getElementById('lavoro-acqua-hl-ha');
  const tot = document.getElementById('lavoro-acqua-hl-tot');
  if (perHa) perHa.value = m.ettolitriPerEttaro != null ? m.ettolitriPerEttaro : '';
  if (tot) tot.value = m.ettolitriTotali != null ? m.ettolitriTotali : '';
  const prodotti = Array.isArray(m.prodotti) ? m.prodotti : [];
  const primo = prodotti[0];
  const sel = document.getElementById('lavoro-miscela-prodotto');
  const nome = document.getElementById('lavoro-miscela-nome');
  const dose = document.getElementById('lavoro-miscela-dose-ha');
  if (sel && primo && primo.prodottoId) sel.value = primo.prodottoId;
  if (nome) nome.value = primo && !primo.prodottoId ? (primo.nome || '') : '';
  if (dose) dose.value = primo && primo.dosePerEttaro != null ? primo.dosePerEttaro : '';
  const tbody = document.getElementById('tbody-miscela-lavoro');
  if (!tbody) return;
  tbody.innerHTML = prodotti.slice(1).map((p) =>
    '<tr data-extra="1" data-prodotto-id="' + esc(p.prodottoId || '') + '" data-nome="' + esc(p.nome || '') + '" data-unita="' + esc(p.unita || '') + '" data-dose-hl="' + esc(p.dosePerEttolitro != null ? p.dosePerEttolitro : '') + '">'
    + '<td>' + esc(p.nome || '') + '</td>'
    + '<td><input type="number" class="miscela-dose-extra" min="0" step="0.01" value="' + esc(p.dosePerEttaro != null ? p.dosePerEttaro : '') + '"></td>'
    + '<td><button type="button" class="btn btn-sm btn-danger miscela-togli">Togli</button></td></tr>'
  ).join('');
}

export function testoAnteprimaMiscela(miscela) {
  if (!miscela || !miscela.prodotti || !miscela.prodotti.length) return '';
  const righe = miscela.prodotti.map((p) => {
    const pezzi = [
      p.nome,
      'dose/ha ' + (p.dosePerEttaro != null ? p.dosePerEttaro : '—'),
      'totale campo ' + (p.quantita != null ? p.quantita : '—') + (p.unita ? ' ' + p.unita : ''),
      'dose/hl ' + (p.dosePerEttolitro != null ? p.dosePerEttolitro : '—')
    ];
    if (p.doseBottePiena != null) pezzi.push('botte piena ' + p.doseBottePiena);
    return pezzi.join(' · ');
  });
  let extra = 'Acqua ' + (miscela.ettolitriPerEttaro != null ? miscela.ettolitriPerEttaro : '—')
    + ' hl/ha, totale ' + (miscela.ettolitriTotali != null ? miscela.ettolitriTotali : '—') + ' hl.';
  if (miscela.nomeAttrezzo && miscela.capacitaBotteQuintali) {
    extra += ' ' + miscela.nomeAttrezzo + ', ' + miscela.capacitaBotteQuintali + ' quintali, botti: ' + (miscela.bottiPiene != null ? miscela.bottiPiene : '—') + '.';
    if (miscela.ultimaBotte) {
      extra += ' Ultima botte parziale ' + miscela.ultimaBotte.ettolitri + ' hl.';
    }
  }
  return righe.join('\n') + '\n' + extra;
}

export function avvisiMiscelaLavoro({ miscela, terrenoId, data, precedenti, prodottiAnagrafica, specie }) {
  const messaggi = [];
  (miscela.prodotti || []).forEach((p) => {
    const anag = (prodottiAnagrafica || []).find((a) => a.id === p.prodottoId);
    const conferma = confermaSpecieSalvata(anag, specie);
    const esito = avvisoImpieghiEIntervallo({
      data,
      terrenoId,
      prodottoId: p.prodottoId,
      nome: p.nome,
      conferma,
      precedenti,
      includiNotaNonRegistrato: false
    });
    messaggi.push(...esito.avvisi);
  });
  if (messaggi.length) messaggi.push('Se un trattamento di ieri non è ancora stato registrato, questo avviso non lo vede.');
  return messaggi;
}

export function installaMiscelaLavoro(opts = {}) {
  const form = document.getElementById('lavoro-form');
  if (!form || form.dataset.miscelaRegistro === '1') return;
  form.dataset.miscelaRegistro = '1';
  const nota = document.getElementById('lavoro-miscela-nota');
  if (nota) nota.textContent = NOTA_REGISTRO_PRIVATO;
  form.addEventListener('change', (e) => {
    const id = e.target && e.target.id;
    if (id === 'lavoro-tipo-lavoro' || id === 'lavoro-categoria-principale' || id === 'lavoro-sottocategoria') {
      aggiornaSezioneMiscelaLavoro();
    }
  });
  const btn = document.getElementById('btn-miscela-aggiungi');
  if (btn) {
    btn.addEventListener('click', () => {
      const sel = document.getElementById('lavoro-miscela-prodotto');
      const nomeLibero = document.getElementById('lavoro-miscela-nome')?.value?.trim() || '';
      const dose = document.getElementById('lavoro-miscela-dose-ha')?.value || '';
      const id = sel?.value || '';
      const nome = id && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : nomeLibero;
      if (!nome) return;
      const tbody = document.getElementById('tbody-miscela-lavoro');
      if (!tbody) return;
      const tr = document.createElement('tr');
      tr.setAttribute('data-extra', '1');
      tr.setAttribute('data-prodotto-id', id);
      tr.setAttribute('data-nome', nome);
      tr.setAttribute('data-unita', (sel?.selectedOptions?.[0]?.getAttribute('data-unita')) || '');
      tr.setAttribute('data-dose-hl', (sel?.selectedOptions?.[0]?.getAttribute('data-dose-hl')) || '');
      tr.innerHTML = '<td>' + esc(nome) + '</td><td><input type="number" class="miscela-dose-extra" min="0" step="0.01" value="' + esc(dose) + '"></td><td><button type="button" class="btn btn-sm btn-danger miscela-togli">Togli</button></td>';
      tbody.appendChild(tr);
    });
  }
  form.addEventListener('click', (e) => {
    const btnTogli = e.target && e.target.closest ? e.target.closest('.miscela-togli') : null;
    if (!btnTogli) return;
    const tr = btnTogli.closest('tr');
    if (tr) tr.remove();
  });
  if (typeof opts.onReady === 'function') opts.onReady();
}

export async function riempiSelectProdottiMiscela(prodotti, specie) {
  const sel = document.getElementById('lavoro-miscela-prodotto');
  if (!sel) return;
  const corrente = sel.value;
  const righe = (prodotti || []).filter((p) => p && p.attivo !== false);
  sel.innerHTML = '<option value="">— Nessun prodotto —</option>' + righe.map((p) => {
    const conferma = confermaSpecieSalvata(p, specie);
    const doseHl = conferma && conferma.dosePerEttolitroScheda != null ? conferma.dosePerEttolitroScheda : '';
    return '<option value="' + esc(p.id) + '" data-unita="' + esc(p.unitaMisura || '') + '" data-dose-hl="' + esc(doseHl) + '">'
      + esc(p.nome || p.codice || p.id) + '</option>';
  }).join('');
  if (corrente) sel.value = corrente;
}
