/**
 * UI shortlist sostituti (Gestione lavori — manager).
 * @module core/admin/js/gestione-lavori-sostituti-ui
 */

import { showAlert, escapeHtml } from './gestione-lavori-utils.js';
import {
  buildShortlistSostitutiPerLavoroStandby,
  DISPONIBILITA_IMPEGNATO,
  DISPONIBILITA_SPOSTABILE,
  DISPONIBILITA_LIBERO
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

function badgeForDisponibilita(disponibilita) {
  if (disponibilita === DISPONIBILITA_SPOSTABILE) {
    return { className: 'sostituto-card-spostabile', label: '🔄 Spostabile con conferma' };
  }
  if (disponibilita === DISPONIBILITA_IMPEGNATO) {
    return { className: 'sostituto-card-impegnato', label: '⚠️ Impegnato (override)' };
  }
  return { className: 'sostituto-card-libero', label: '✅ Libero' };
}

/**
 * @param {Object} equipaggioCheck
 * @returns {string}
 */
function renderEquipaggioBanner(equipaggioCheck) {
  if (!equipaggioCheck?.applicabile) return '';
  if (equipaggioCheck.incompleto) {
    return `
      <div class="equipaggio-minimo-banner equipaggio-minimo-incompleto" role="alert">
        <strong>Equipaggio incompleto</strong> —
        ${equipaggioCheck.attivi}/${equipaggioCheck.minPersone} persone attive
        (mancano ${equipaggioCheck.mancanti}). Assegna un sostituto per coprire il minimo.
      </div>
    `;
  }
  return `
    <div class="equipaggio-minimo-banner equipaggio-minimo-ok">
      Equipaggio minimo soddisfatto: ${equipaggioCheck.attivi}/${equipaggioCheck.minPersone}.
    </div>
  `;
}

/**
 * @param {string} lavoroId
 */
export async function openSostitutoAssenzaModal(lavoroId) {
  const modal = document.getElementById('sostituto-assenza-modal');
  const listEl = document.getElementById('sostituto-shortlist');
  const infoEl = document.getElementById('sostituto-assenza-info');
  const bannerEl = document.getElementById('sostituto-equipaggio-banner');
  if (!modal || !listEl) return;

  document.getElementById('sostituto-assenza-lavoro-id').value = lavoroId;
  listEl.innerHTML = '<div class="loading">Caricamento candidati...</div>';
  if (infoEl) infoEl.textContent = '';
  if (bannerEl) bannerEl.innerHTML = '';
  modal.classList.add('active');

  try {
    const result = await buildShortlistSostitutiPerLavoroStandby({
      lavoroId,
      operaiList: sostitutiUiDeps?.getOperaiList?.() || [],
      squadreList: sostitutiUiDeps?.getSquadreList?.() || [],
      attrezziList: sostitutiUiDeps?.getAttrezziList?.() || []
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
      const tipoTxt = result.isLavoroSquadra ? ' · Lavoro di squadra' : ' · Lavoro autonomo';
      infoEl.innerHTML = `
        <strong>${escapeHtml(result.lavoroNome)}</strong> — assente: <strong>${escapeHtml(assenteNome)}</strong> (${escapeHtml(result.giornoKey)})${tipoTxt}.<br>
        <span style="font-size:13px;">${skillTxt}${eqTxt}</span>
      `;
    }

    if (bannerEl) {
      bannerEl.innerHTML = renderEquipaggioBanner(result.equipaggioCheck);
    }

    if (!result.shortlist.length) {
      listEl.innerHTML = `
        <div class="empty-state-inline" style="padding:16px;">
          Nessun candidato qualificato in shortlist.
          ${result.tuttiQualificati > 0 ? ` (${result.tuttiQualificati} operai esclusi per ranking/impegno/assenze)` : ''}
          Verifica le skill in scheda operaio o assegna manualmente modificando il lavoro.
        </div>
      `;
      return;
    }

    listEl.innerHTML = result.shortlist
      .map((c) => {
        const badge = badgeForDisponibilita(c.disponibilita);
        const sottoSoglia = c.origineSottoSogliaDopoPrestito
          ? '<div class="sostituto-card-warn">Attenzione: prestito lascia l\'origine sotto equipaggio minimo</div>'
          : '';
        return `
          <button type="button" class="sostituto-card ${badge.className}" data-operaio-id="${escapeHtml(c.operaioId)}">
            <div class="sostituto-card-head">
              <strong>${escapeHtml(c.nome)}</strong>
              <span class="sostituto-badge">${badge.label}</span>
            </div>
            <div class="sostituto-card-meta">${escapeHtml(c.stelleDisplay)} · ${escapeHtml(c.motivo)}</div>
            ${sottoSoglia}
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
        `<p style="font-size:12px;color:#666;margin-top:12px;">Mostrati i migliori ${result.shortlist.length} su ${result.tuttiQualificati} qualificati (assenti confermati esclusi).</p>`
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

  const needsSpostamento =
    candidato.disponibilita === DISPONIBILITA_SPOSTABILE ||
    candidato.disponibilita === DISPONIBILITA_IMPEGNATO ||
    Boolean(candidato.impegnoLavoroId);

  if (needsSpostamento && candidato.impegnoLavoroId) {
    const tipo =
      candidato.disponibilita === DISPONIBILITA_SPOSTABILE
        ? 'spostabile con conferma'
        : 'impegnato (override manager)';
    const sotto = candidato.origineSottoSogliaDopoPrestito
      ? '\n\nAttenzione: il lavoro di origine rischia di restare sotto equipaggio minimo.'
      : '';
    const ok = window.confirm(
      `${candidato.nome} risulta ${tipo}${candidato.impegnoLavoroNome ? ` su «${candidato.impegnoLavoroNome}»` : ''}.\n\nConfermi lo spostamento? Verrà registrato un doppio movimento (sostituzione qui + buco/standby sul lavoro di origine).${sotto}`
    );
    if (!ok) return;
  } else if (candidato.disponibilita === DISPONIBILITA_LIBERO) {
    const ok = window.confirm(`Assegnare ${candidato.nome} come sostituto e riattivare il lavoro?`);
    if (!ok) return;
  }

  try {
    const result = await assegnaSostitutoDaStandby({
      lavoroId,
      sostitutoOperaioId: candidato.operaioId,
      managerId,
      confermaSpostamento: Boolean(candidato.impegnoLavoroId),
      impegnoLavoroId: candidato.impegnoLavoroId || null
    });
    const extra = result.doppioMovimento
      ? ' Doppio movimento registrato sul lavoro di origine.'
      : '';
    const squadra = result.isLavoroSquadra
      ? ' Sostituzione registrata sull\'equipaggio del giorno (squadra anagrafica invariata).'
      : '';
    showAlert(`${candidato.nome} assegnato come sostituto. Lavoro riattivato.${extra}${squadra}`, 'success');
    closeSostitutoAssenzaModal();
    await refreshAssenzeSegnalateBanner();
    sostitutiUiDeps?.renderLavori?.();
  } catch (e) {
    console.error('[Gestione Lavori] assegna sostituto:', e);
    showAlert(e.message || 'Errore assegnazione sostituto', 'error');
  }
}
