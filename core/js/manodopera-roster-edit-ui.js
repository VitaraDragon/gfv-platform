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

const ROSTER_EDIT_STYLE_ID = 'roster-edit-modal-style';

// Gli stili stanno qui e non nella pagina: il modale si apre da Impegni giornalieri e da Gestione lavori.
const ROSTER_EDIT_CSS = `
  .roster-edit-modal {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 10000;
      align-items: center;
      justify-content: center;
      padding: 16px;
  }
  .roster-edit-modal.active { display: flex; }
  .roster-edit-dialog {
      background: #fff;
      border-radius: 12px;
      max-width: 480px;
      width: 100%;
      max-height: 90vh;
      overflow: auto;
      padding: 20px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  }
  .roster-edit-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
  }
  .roster-edit-header h3 { color: #1B5E3A; font-size: 18px; }
  .roster-edit-close {
      border: none;
      background: transparent;
      font-size: 28px;
      line-height: 1;
      cursor: pointer;
      color: #666;
  }
  .roster-edit-hint { font-size: 13px; color: #666; margin-bottom: 14px; }
  .roster-edit-ul { list-style: none; margin: 0 0 16px; padding: 0; }
  .roster-edit-ul li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
      font-size: 14px;
  }
  .roster-edit-stato {
      display: block;
      font-size: 12px;
      color: #666;
      margin-top: 2px;
  }
  .btn-roster-remove {
      border: 1px solid #c62828;
      background: #ffebee;
      color: #c62828;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 600;
  }
  .roster-edit-locked { color: #999; font-size: 12px; }
  .roster-edit-add label { display: block; font-size: 13px; color: #555; margin-bottom: 6px; }
  .roster-edit-add-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .roster-edit-add-row select {
      flex: 1;
      min-width: 160px;
      padding: 8px 10px;
      border: 1px solid #ccc;
      border-radius: 8px;
      font-size: 14px;
  }
  .btn-roster-add {
      padding: 8px 14px;
      border: none;
      border-radius: 8px;
      background: #2E8B57;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
  }
  .roster-edit-msg { margin-top: 10px; font-size: 13px; }
  .roster-edit-msg.err { color: #c62828; }
  .roster-edit-empty, .roster-edit-loading { color: #666; padding: 8px 0; font-size: 14px; }
`;

function ensureStyle() {
  if (document.getElementById(ROSTER_EDIT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = ROSTER_EDIT_STYLE_ID;
  style.textContent = ROSTER_EDIT_CSS;
  document.head.appendChild(style);
}

/**
 * @param {HTMLElement} root
 * @returns {HTMLElement}
 */
function ensureModal(root) {
  ensureStyle();
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
    // Via dal DOM: alla prossima apertura ensureModal lo ricrea pulito.
    modal.remove();
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
