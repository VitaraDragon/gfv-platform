/**
 * UI assenze + standby lavoro (Gestione lavori — manager).
 * @module core/admin/js/gestione-lavori-assenze-ui
 */

import { showAlert, escapeHtml } from './gestione-lavori-utils.js';
import { ASSENZA_TIPI, toGiornoKey } from '../../config/manodopera-assenze-config.js';
import {
  listAssenzeSegnalate,
  getAssenza,
  findAssenzaSegnalataPerLavoro,
  findAssenzaSegnalataPerOperaio
} from '../../services/manodopera-assenze-service.js';
import {
  mettiLavoroInStandbyPerAssenza,
  riportaLavoroDaStandbyAssenza,
  confermaSegnalazioneEStandby
} from '../../services/lavoro-standby-assenza-service.js';
import { getLavoro } from '../../services/lavori-service.js';

let assenzeUiDeps = null;

/**
 * @param {Object} deps
 * @param {Function} deps.getCurrentUserData
 * @param {Function} deps.getOperaiList
 * @param {Function} deps.renderLavori
 */
export function initGestioneLavoriAssenzeUi(deps) {
  assenzeUiDeps = deps;
  populateAssenzaTipoSelect();
}

function populateAssenzaTipoSelect() {
  const sel = document.getElementById('assenza-tipo');
  if (!sel) return;
  sel.innerHTML = ASSENZA_TIPI.map(
    (t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.label)}</option>`
  ).join('');
}

function populateOperaiSelect(selectedId) {
  const sel = document.getElementById('assenza-operaio');
  if (!sel || !assenzeUiDeps?.getOperaiList) return;
  const operai = assenzeUiDeps.getOperaiList() || [];
  sel.innerHTML =
    '<option value="">-- Seleziona operaio --</option>' +
    operai
      .map((o) => {
        const id = o.id || o.uid;
        const nome = [o.nome, o.cognome].filter(Boolean).join(' ') || o.email || id;
        const selected = id === selectedId ? ' selected' : '';
        return `<option value="${escapeHtml(id)}"${selected}>${escapeHtml(nome)}</option>`;
      })
      .join('');
}

/**
 * @param {Object} assenza
 */
function applyAssenzaSegnalataToForm(assenza) {
  if (!assenza) return;
  populateOperaiSelect(assenza.operaioId || '');
  const tipoSel = document.getElementById('assenza-tipo');
  if (tipoSel && assenza.tipo) tipoSel.value = assenza.tipo;
  const giornoEl = document.getElementById('assenza-giorno');
  if (giornoEl) {
    giornoEl.value = assenza.dataInizioGiorno || toGiornoKey(new Date());
  }
  const notaEl = document.getElementById('assenza-nota');
  if (notaEl) notaEl.value = assenza.nota || '';
}

function nomeOperaioFromList(operaioId) {
  const operai = assenzeUiDeps?.getOperaiList?.() || [];
  const o = operai.find((x) => (x.id || x.uid) === operaioId);
  if (!o) return operaioId || 'Operaio';
  return [o.nome, o.cognome].filter(Boolean).join(' ') || o.email || operaioId;
}

export async function refreshAssenzeSegnalateBanner() {
  const el = document.getElementById('assenze-segnalate-banner');
  if (!el) return;
  try {
    const rows = await listAssenzeSegnalate();
    if (!rows.length) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    const items = rows
      .map((a) => {
        const nome = escapeHtml(nomeOperaioFromList(a.operaioId));
        const tipo = escapeHtml(a.tipoLabel || a.tipo || '');
        const giorno = escapeHtml(a.dataInizioGiorno || '');
        const azione = a.lavoroId
          ? `<button type="button" class="btn btn-warning btn-sm" style="margin-top:8px;" onclick="confermaSegnalazioneStandby('${escapeHtml(a.id)}','${escapeHtml(a.lavoroId)}')">Conferma e standby</button>`
          : '<span style="display:block;margin-top:6px;font-size:12px;">Apri il lavoro e usa «Standby assenza».</span>';
        return `<li style="margin-top:10px;"><strong>${nome}</strong> — ${tipo} (${giorno})${azione}</li>`;
      })
      .join('');
    el.innerHTML = `
      <strong>📩 ${rows.length} assenz${rows.length === 1 ? 'a' : 'e'} segnalat${rows.length === 1 ? 'a' : 'e'}</strong>
      <ul style="margin:8px 0 0;padding-left:18px;">${items}</ul>
    `;
  } catch (e) {
    console.warn('[Gestione Lavori] assenze segnalate:', e);
    el.hidden = true;
  }
}

/**
 * @param {string} lavoroId
 * @param {{ assenzaId?: string, assenza?: Object }} [options]
 */
export async function openStandbyAssenzaModal(lavoroId, options = {}) {
  const modal = document.getElementById('standby-assenza-modal');
  if (!modal) return;

  const lavoro = await getLavoro(lavoroId);
  if (!lavoro) {
    showAlert('Lavoro non trovato', 'error');
    return;
  }

  let assenzaId = options.assenzaId || '';
  let assenza = options.assenza || null;
  if (assenzaId && !assenza) {
    assenza = await getAssenza(assenzaId);
  }
  if (!assenzaId && !assenza) {
    assenza = await findAssenzaSegnalataPerLavoro(lavoroId);
    if (!assenza && lavoro.operaioId) {
      assenza = await findAssenzaSegnalataPerOperaio(lavoro.operaioId);
    }
    if (assenza) assenzaId = assenza.id || '';
  }

  document.getElementById('standby-assenza-lavoro-id').value = lavoroId;
  document.getElementById('standby-assenza-assenza-id').value = assenzaId;

  const titolo = document.getElementById('standby-assenza-modal-title');
  if (titolo) {
    titolo.textContent =
      lavoro.stato === 'in_standby'
        ? 'Standby per assenza — ripristino'
        : assenzaId
          ? 'Standby per assenza — conferma segnalazione'
          : 'Standby per assenza — conferma manager';
  }

  const formWrap = document.getElementById('standby-assenza-form-wrap');
  const ripristinaBtn = document.getElementById('standby-assenza-ripristina-btn');
  const submitBtn = document.getElementById('standby-assenza-submit-btn');
  const info = document.getElementById('standby-assenza-info');

  if (lavoro.stato === 'in_standby') {
    if (formWrap) formWrap.style.display = 'none';
    if (submitBtn) submitBtn.style.display = 'none';
    if (ripristinaBtn) ripristinaBtn.style.display = 'inline-flex';
    if (info) {
      info.hidden = false;
      info.textContent = `Lavoro in standby dal ${lavoro.standbyGiornoKey || '—'}. ${
        lavoro.standbyNota ? `Nota: ${lavoro.standbyNota}` : ''
      }`;
    }
  } else {
    if (formWrap) formWrap.style.display = 'block';
    if (submitBtn) submitBtn.style.display = 'inline-flex';
    if (ripristinaBtn) ripristinaBtn.style.display = 'none';

    if (assenza) {
      applyAssenzaSegnalataToForm(assenza);
      if (info) {
        info.hidden = false;
        const nome = nomeOperaioFromList(assenza.operaioId);
        info.textContent = `Segnalazione dal caposquadra: ${nome} — ${assenza.tipoLabel || assenza.tipo}${
          assenza.nota ? `. Nota: ${assenza.nota}` : ''
        }. Verifica i campi e conferma.`;
      }
    } else {
      document.getElementById('assenza-giorno').value = toGiornoKey(new Date());
      document.getElementById('assenza-nota').value = '';
      populateOperaiSelect(lavoro.operaioId || lavoro.standbyOperaioId || '');
      if (info) {
        info.hidden = false;
        info.textContent = `Lavoro: ${lavoro.nome || lavoroId}. Lo stato passerà a «Standby (assenza)»; potrai cercare un sostituto in un secondo momento.`;
      }
    }
  }

  modal.classList.add('active');
}

export function closeStandbyAssenzaModal() {
  document.getElementById('standby-assenza-modal')?.classList.remove('active');
}

export async function submitStandbyAssenzaModal() {
  const user = assenzeUiDeps?.getCurrentUserData?.();
  const managerId = user?.id || user?.uid;
  if (!managerId) {
    showAlert('Utente non autenticato', 'error');
    return;
  }

  const lavoroId = document.getElementById('standby-assenza-lavoro-id')?.value;
  const assenzaId = document.getElementById('standby-assenza-assenza-id')?.value;
  const operaioId = document.getElementById('assenza-operaio')?.value;
  const tipo = document.getElementById('assenza-tipo')?.value || 'malattia';
  const giorno = document.getElementById('assenza-giorno')?.value || toGiornoKey(new Date());
  const nota = document.getElementById('assenza-nota')?.value || '';

  if (!lavoroId) {
    showAlert('Lavoro non valido', 'warning');
    return;
  }
  if (!assenzaId && !operaioId) {
    showAlert('Seleziona l\'operaio assente', 'warning');
    return;
  }

  try {
    if (assenzaId) {
      await confermaSegnalazioneEStandby({
        assenzaId,
        lavoroId,
        managerId
      });
    } else {
      await mettiLavoroInStandbyPerAssenza({
        lavoroId,
        operaioId,
        tipoAssenza: tipo,
        nota,
        managerId,
        giornoKey: giorno
      });
    }
    showAlert('Lavoro in standby. Scegli il sostituto.', 'success');
    closeStandbyAssenzaModal();
    await refreshAssenzeSegnalateBanner();
    assenzeUiDeps?.renderLavori?.();
    if (typeof window.openSostitutoAssenzaModal === 'function') {
      setTimeout(() => window.openSostitutoAssenzaModal(lavoroId), 350);
    }
  } catch (e) {
    console.error('[Gestione Lavori] standby assenza:', e);
    showAlert(e.message || 'Errore standby', 'error');
  }
}

export async function ripristinaDaStandbyModal() {
  const user = assenzeUiDeps?.getCurrentUserData?.();
  const managerId = user?.id || user?.uid;
  const lavoroId = document.getElementById('standby-assenza-lavoro-id')?.value;
  if (!lavoroId || !managerId) return;
  try {
    await riportaLavoroDaStandbyAssenza(lavoroId, managerId);
    showAlert('Lavoro ripristinato dallo standby', 'success');
    closeStandbyAssenzaModal();
    assenzeUiDeps?.renderLavori?.();
  } catch (e) {
    showAlert(e.message || 'Errore ripristino', 'error');
  }
}

/**
 * Conferma segnalazione esistente + standby (da banner).
 */
export async function confermaSegnalazioneStandby(assenzaId, lavoroId) {
  if (!assenzaId || !lavoroId) return;
  await openStandbyAssenzaModal(lavoroId, { assenzaId });
}
