/**
 * UI shortlist sostituti (Gestione lavori — manager).
 * @module core/admin/js/gestione-lavori-sostituti-ui
 */

import { showAlert, escapeHtml } from './gestione-lavori-utils.js';
import {
  buildShortlistSostitutiPerLavoroStandby,
  DISPONIBILITA_IMPEGNATO
} from '../../services/manodopera-sostituti-shortlist-service.js';
import { getManodoperaSkillLabel } from '../../config/manodopera-skills-config.js';
import { assegnaSostitutoDaStandby } from '../../services/lavoro-sostituzione-assenza-service.js';
import { refreshAssenzeSegnalateBanner } from './gestione-lavori-assenze-ui.js';

let sostitutiUiDeps = null;
let sostitutiModalState = null;

/**
 * @param {Object} deps
 */
export function initGestioneLavoriSostitutiUi(deps) {
  sostitutiUiDeps = deps;
}

function nomeOperaioAssente(assenteId) {
  const operai = sostitutiUiDeps?.getOperaiList?.() || [];
  const o = operai.find((x) => (x.id || x.uid) === assenteId);
  if (!o) return assenteId || 'Operaio';
  return [o.nome, o.cognome].filter(Boolean).join(' ') || o.email || assenteId;
}

/**
 * @param {string} lavoroId
 */
export async function openSostitutoAssenzaModal(lavoroId) {
  const modal = document.getElementById('sostituto-assenza-modal');
  const listEl = document.getElementById('sostituto-shortlist');
  const infoEl = document.getElementById('sostituto-assenza-info');
  if (!modal || !listEl) return;

  document.getElementById('sostituto-assenza-lavoro-id').value = lavoroId;
  listEl.innerHTML = '<div class="loading">Caricamento candidati...</div>';
  if (infoEl) infoEl.textContent = '';
  modal.classList.add('active');

  try {
    const result = await buildShortlistSostitutiPerLavoroStandby({
      lavoroId,
      operaiList: sostitutiUiDeps?.getOperaiList?.() || [],
      squadreList: sostitutiUiDeps?.getSquadreList?.() || []
    });

    sostitutiModalState = result;

    const assenteNome = nomeOperaioAssente(result.assenteOperaioId);
    if (infoEl) {
      const skillTxt =
        result.requiredSkillIds?.length > 0
          ? `Skill richieste: ${result.requiredSkillIds.map((id) => escapeHtml(getManodoperaSkillLabel(id))).join(', ')}`
          : 'Nessuna skill specifica richiesta per questo lavoro';
      const eqTxt =
        result.equipaggioMinimo != null
          ? ` · Equipaggio minimo: ${result.equipaggioMinimo} persone`
          : '';
      infoEl.innerHTML = `
        <strong>${escapeHtml(result.lavoroNome)}</strong> — assente: <strong>${escapeHtml(assenteNome)}</strong> (${escapeHtml(result.giornoKey)}).<br>
        <span style="font-size:13px;">${skillTxt}${eqTxt}</span>
      `;
    }

    if (!result.shortlist.length) {
      listEl.innerHTML = `
        <div class="empty-state-inline" style="padding:16px;">
          Nessun candidato qualificato in shortlist.
          ${result.tuttiQualificati > 0 ? ` (${result.tuttiQualificati} operai esclusi per ranking/impegno)` : ''}
          Verifica le skill in scheda operaio o assegna manualmente modificando il lavoro.
        </div>
      `;
      return;
    }

    listEl.innerHTML = result.shortlist
      .map((c) => {
        const badgeClass =
          c.disponibilita === DISPONIBILITA_IMPEGNATO
            ? 'sostituto-card-impegnato'
            : 'sostituto-card-libero';
        const badge =
          c.disponibilita === DISPONIBILITA_IMPEGNATO
            ? '⚠️ Impegnato'
            : '✅ Libero';
        return `
          <button type="button" class="sostituto-card ${badgeClass}" data-operaio-id="${escapeHtml(c.operaioId)}">
            <div class="sostituto-card-head">
              <strong>${escapeHtml(c.nome)}</strong>
              <span class="sostituto-badge">${badge}</span>
            </div>
            <div class="sostituto-card-meta">${escapeHtml(c.stelleDisplay)} · ${escapeHtml(c.motivo)}</div>
          </button>
        `;
      })
      .join('');

    listEl.querySelectorAll('.sostituto-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-operaio-id');
        const cand = result.shortlist.find((x) => x.operaioId === id);
        if (cand) confermaSostituto(cand);
      });
    });

    if (result.tuttiQualificati > result.shortlist.length) {
      listEl.insertAdjacentHTML(
        'beforeend',
        `<p style="font-size:12px;color:#666;margin-top:12px;">Mostrati i migliori ${result.shortlist.length} su ${result.tuttiQualificati} qualificati.</p>`
      );
    }
  } catch (e) {
    console.error('[Gestione Lavori] shortlist sostituti:', e);
    listEl.innerHTML = `<div class="empty-state-inline" style="color:#c62828;">${escapeHtml(e.message || 'Errore caricamento')}</div>`;
  }
}

export function closeSostitutoAssenzaModal() {
  document.getElementById('sostituto-assenza-modal')?.classList.remove('active');
  sostitutiModalState = null;
}

/**
 * @param {Object} candidato
 */
async function confermaSostituto(candidato) {
  const user = sostitutiUiDeps?.getCurrentUserData?.();
  const managerId = user?.id || user?.uid;
  const lavoroId = document.getElementById('sostituto-assenza-lavoro-id')?.value;
  if (!managerId || !lavoroId || !candidato?.operaioId) return;

  if (candidato.disponibilita === DISPONIBILITA_IMPEGNATO) {
    const ok = window.confirm(
      `${candidato.nome} risulta impegnato${candidato.impegnoLavoroNome ? ` su «${candidato.impegnoLavoroNome}»` : ''}.\n\nConfermi comunque come sostituto per questo lavoro?`
    );
    if (!ok) return;
  } else {
    const ok = window.confirm(`Assegnare ${candidato.nome} come sostituto e riattivare il lavoro?`);
    if (!ok) return;
  }

  try {
    await assegnaSostitutoDaStandby({
      lavoroId,
      sostitutoOperaioId: candidato.operaioId,
      managerId
    });
    showAlert(`${candidato.nome} assegnato come sostituto. Lavoro riattivato.`, 'success');
    closeSostitutoAssenzaModal();
    await refreshAssenzeSegnalateBanner();
    sostitutiUiDeps?.renderLavori?.();
  } catch (e) {
    console.error('[Gestione Lavori] assegna sostituto:', e);
    showAlert(e.message || 'Errore assegnazione sostituto', 'error');
  }
}
