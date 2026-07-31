/**
 * UI A2 — modifica roster giornaliero (add/remove partecipazione) da Impegni.
 * @module core/js/manodopera-roster-edit-ui
 */

import {
  aggiungiPartecipazioneRosterGiorno,
  rimuoviPartecipazioneRosterGiorno,
  ensureRosterGiornoPersisted,
  getEquipaggioSlice
} from '../services/manodopera-roster-giorno-service.js';
import {
  canRemovePartecipazioneManuale,
  ROSTER_STATO_PREVISTO,
  ROSTER_STATO_AGGIUNTO,
  ROSTER_STATO_ASSENTE,
  ROSTER_STATO_SOSTITUITO,
  ROSTER_STATO_PRESTATO_OUT,
  ROSTER_ORIGINE_MANUALE
} from '../services/manodopera-roster-giorno-logic.js';
import { getLavoro } from '../services/lavori-service.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nomeOperaio(op) {
  if (!op) return '';
  return [op.nome, op.cognome].filter(Boolean).join(' ') || op.email || op.id || '';
}

function labelStato(p) {
  if (!p) return '';
  if (p.origine === ROSTER_ORIGINE_MANUALE) return 'Aggiunto (manuale)';
  const map = {
    [ROSTER_STATO_PREVISTO]: 'Previsto',
    [ROSTER_STATO_AGGIUNTO]: 'Aggiunto',
    [ROSTER_STATO_ASSENTE]: 'Assente',
    [ROSTER_STATO_SOSTITUITO]: 'Sostituito',
    [ROSTER_STATO_PRESTATO_OUT]: 'Prestato'
  };
  return map[p.stato] || p.stato || '';
}

/**
 * @param {HTMLElement} root
 * @returns {HTMLElement}
 */
function ensureModal(root) {
  let modal = document.getElementById('roster-edit-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'roster-edit-modal';
  modal.className = 'roster-edit-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="roster-edit-dialog">
      <div class="roster-edit-header">
        <h3 id="roster-edit-title">Modifica roster</h3>
        <button type="button" class="roster-edit-close" id="roster-edit-close" aria-label="Chiudi">×</button>
      </div>
      <p class="roster-edit-hint" id="roster-edit-hint"></p>
      <div id="roster-edit-list" class="roster-edit-list"></div>
      <div class="roster-edit-add">
        <label for="roster-edit-add-select">Aggiungi operaio al giorno (manuale)</label>
        <div class="roster-edit-add-row">
          <select id="roster-edit-add-select"></select>
          <button type="button" class="btn-roster-add" id="roster-edit-add-btn">Aggiungi</button>
        </div>
      </div>
      <p class="roster-edit-msg" id="roster-edit-msg" hidden></p>
    </div>
  `;
  (root || document.body).appendChild(modal);
  return modal;
}

/**
 * @param {Object} options
 * @param {string} options.lavoroId
 * @param {string} options.giornoKey
 * @param {string} [options.lavoroNome]
 * @param {string|null} [options.managerId]
 * @param {Array<Object>} [options.operaiList]
 * @param {() => void|Promise<void>} [options.onChanged]
 */
export async function openRosterEditModal(options = {}) {
  const {
    lavoroId,
    giornoKey,
    lavoroNome = '',
    managerId = null,
    operaiList: operaiIn = null,
    onChanged = null
  } = options;

  if (!lavoroId || !giornoKey) {
    throw new Error('lavoroId e giornoKey obbligatori');
  }

  const modal = ensureModal(document.body);
  const titleEl = document.getElementById('roster-edit-title');
  const hintEl = document.getElementById('roster-edit-hint');
  const listEl = document.getElementById('roster-edit-list');
  const selectEl = document.getElementById('roster-edit-add-select');
  const msgEl = document.getElementById('roster-edit-msg');
  const addBtn = document.getElementById('roster-edit-add-btn');
  const closeBtn = document.getElementById('roster-edit-close');

  titleEl.textContent = lavoroNome
    ? `Scegli manualmente — ${lavoroNome}`
    : 'Scegli manualmente (roster del giorno)';
  hintEl.textContent =
    `Percorso avanzato · giorno ${giornoKey}. Per le assenze preferisci la shortlist «Assegna sostituto». ` +
    'Qui puoi solo aggiungere/togliere persone dal turno di oggi (la squadra anagrafica non cambia).';
  msgEl.hidden = true;
  msgEl.textContent = '';
  listEl.innerHTML = '<div class="roster-edit-loading">Caricamento...</div>';
  modal.classList.add('active');

  const operaiList = Array.isArray(operaiIn) ? operaiIn : [];

  const operaiById = new Map(
    (operaiList || []).map((o) => [o.id || o.uid, o])
  );

  async function reloadList() {
    await ensureRosterGiornoPersisted({
      lavoroId,
      giornoKey,
      materializzatoDa: 'manager'
    });
    const lavoro = await getLavoro(lavoroId);
    const slice = getEquipaggioSlice(lavoro, giornoKey);
    const parts = slice.partecipazioni || [];

    if (!parts.length) {
      listEl.innerHTML =
        '<div class="roster-edit-empty">Nessuna partecipazione per questo giorno. Aggiungi un operaio sotto.</div>';
    } else {
      listEl.innerHTML = `
        <ul class="roster-edit-ul">
          ${parts
            .map((p) => {
              const op = operaiById.get(p.operaioId);
              const nome = escapeHtml(nomeOperaio(op) || p.operaioId);
              const stato = escapeHtml(labelStato(p));
              const canRm = canRemovePartecipazioneManuale(p);
              return `
                <li data-operaio-id="${escapeHtml(p.operaioId)}">
                  <div>
                    <strong>${nome}</strong>
                    <span class="roster-edit-stato">${stato}</span>
                  </div>
                  ${
                    canRm
                      ? `<button type="button" class="btn-roster-remove" data-remove="${escapeHtml(p.operaioId)}">Rimuovi</button>`
                      : `<span class="roster-edit-locked" title="Usa assenza/sostituzione">—</span>`
                  }
                </li>`;
            })
            .join('')}
        </ul>
      `;
    }

    const onRoster = new Set(parts.map((p) => p.operaioId));
    const candidates = (operaiList || [])
      .filter((o) => {
        const id = o.id || o.uid;
        return id && !onRoster.has(id);
      })
      .sort((a, b) => nomeOperaio(a).localeCompare(nomeOperaio(b), 'it'));

    selectEl.innerHTML =
      '<option value="">— Seleziona operaio —</option>' +
      candidates
        .map(
          (o) =>
            `<option value="${escapeHtml(o.id || o.uid)}">${escapeHtml(nomeOperaio(o))}</option>`
        )
        .join('');

    listEl.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const operaioId = btn.getAttribute('data-remove');
        if (!operaioId) return;
        if (!confirm('Rimuovere questo operaio dal roster di oggi?')) return;
        btn.disabled = true;
        try {
          await rimuoviPartecipazioneRosterGiorno({
            lavoroId,
            giornoKey,
            operaioId,
            daManagerId: managerId
          });
          await reloadList();
          if (onChanged) await onChanged();
        } catch (e) {
          msgEl.hidden = false;
          msgEl.textContent = e.message || 'Errore rimozione';
          msgEl.className = 'roster-edit-msg err';
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  function close() {
    modal.classList.remove('active');
  }

  closeBtn.onclick = close;
  modal.onclick = (ev) => {
    if (ev.target === modal) close();
  };

  addBtn.onclick = async () => {
    const operaioId = selectEl.value;
    if (!operaioId) {
      msgEl.hidden = false;
      msgEl.textContent = 'Seleziona un operaio.';
      msgEl.className = 'roster-edit-msg err';
      return;
    }
    addBtn.disabled = true;
    try {
      await aggiungiPartecipazioneRosterGiorno({
        lavoroId,
        giornoKey,
        operaioId,
        daManagerId: managerId
      });
      msgEl.hidden = true;
      await reloadList();
      if (onChanged) await onChanged();
    } catch (e) {
      msgEl.hidden = false;
      msgEl.textContent = e.message || 'Errore aggiunta';
      msgEl.className = 'roster-edit-msg err';
    } finally {
      addBtn.disabled = false;
    }
  };

  try {
    await reloadList();
  } catch (e) {
    listEl.innerHTML = `<div class="roster-edit-empty" style="color:#c62828;">${escapeHtml(e.message || 'Errore')}</div>`;
  }
}
