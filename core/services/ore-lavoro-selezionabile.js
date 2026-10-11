/**
 * Un lavoro è selezionabile per segnare le PROPRIE ore?
 * Funzione pura: niente Firebase. Il menu (senza giorno) e il salvataggio (con giorno)
 * usano la stessa regola per operaio, caposquadra e manager.
 */

export const FINESTRA_ORE_IN_RITARDO_GIORNI = 7;

const RUOLI_OK = new Set(['operaio', 'caposquadra', 'manager']);

/** @type {((lavoro: object, oggi: Date) => boolean)|null} */
let delegaDropdownSegnaOre = null;

/**
 * Collegamento a isLavoroInDropdownSegnaOre, impostato da manodopera-lavori-scope
 * dopo la definizione, per non creare un import circolare.
 * @param {(lavoro: object, oggi: Date) => boolean} fn
 */
export function impostaDelegaDropdownSegnaOre(fn) {
    delegaDropdownSegnaOre = typeof fn === 'function' ? fn : null;
}

/**
 * @param {string} stato
 * @returns {string}
 */
export function suffissoEtichettaLavoroOre(stato) {
    if (stato === 'completato') return ' — completato';
    if (stato === 'completato_da_approvare') return ' — in attesa approvazione';
    return '';
}

/**
 * Stessa etichetta del menu «Lavori assegnati».
 * @param {{ nome?: string, tipoLavoro?: string, titolo?: string, terrenoNome?: string, terreno?: string, stato?: string }} [work]
 * @returns {string}
 */
export function componiEtichettaLavoroOre(work) {
    const nome = (work && (work.nome || work.tipoLavoro || work.titolo)) || 'Lavoro';
    const terreno = (work && (work.terrenoNome || work.terreno)) || '';
    return `${nome}${terreno ? ` - ${terreno}` : ''}${suffissoEtichettaLavoroOre(work && work.stato)}`;
}

/**
 * @param {*} value
 * @returns {Date|null}
 */
function dataDaValore(value) {
    if (value == null || value === '') return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'object' && typeof value.toDate === 'function') {
        try {
            const d = value.toDate();
            if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
        } catch (ignora) { /* data non valida */ }
        return null;
    }
    if (typeof value === 'string') {
        const soloGiorno = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
        if (soloGiorno) {
            const d = new Date(Number(soloGiorno[1]), Number(soloGiorno[2]) - 1, Number(soloGiorno[3]));
            return Number.isNaN(d.getTime()) ? null : d;
        }
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? null : d;
    }
    return null;
}

/**
 * Mezzanotte locale del giorno di value.
 * @param {*} value
 * @returns {Date|null}
 */
function mezzanotteLocale(value) {
    const d = dataDaValore(value);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */
function differenzaGiorni(a, b) {
    return Math.round((a.getTime() - b.getTime()) / 86400000);
}

/**
 * @param {*} value
 * @returns {string}
 */
function formattaGiornoBreve(value) {
    const d = mezzanotteLocale(value);
    if (!d) return '';
    const gg = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${gg}/${mm}`;
}

/**
 * @param {*} completatoIl
 * @returns {string}
 */
export function messaggioOreFuoriFinestra(completatoIl) {
    const quando = formattaGiornoBreve(completatoIl);
    return `Il lavoro è stato completato il ${quando}: le ore si possono segnare fino a ${FINESTRA_ORE_IN_RITARDO_GIORNI} giorni dopo il completamento e per i giorni lavorati. Chiedi al caposquadra o al manager.`;
}

/**
 * @param {boolean} ok
 * @param {string} [motivo]
 * @returns {{ ok: boolean, motivo: string }}
 */
function esito(ok, motivo) {
    return { ok: !!ok, motivo: ok ? '' : (motivo || 'Questo lavoro non è selezionabile per le ore.') };
}

/**
 * Può questo utente segnare le PROPRIE ore su questo lavoro?
 * @param {{ lavoro?: object, ruolo?: string, oggi?: Date, giorno?: string|Date }} [args]
 *   giorno (YYYY-MM-DD o Date): il giorno delle ore. Se omesso = «menu»: il lavoro compare in elenco.
 * @returns {{ ok: boolean, motivo: string }}
 */
export function lavoroSelezionabilePerOre({ lavoro, ruolo, oggi = new Date(), giorno } = {}) {
    if (!RUOLI_OK.has(ruolo)) {
        return esito(false, 'Non puoi segnare ore su questo lavoro.');
    }
    if (!lavoro || typeof lavoro !== 'object') {
        return esito(false, 'Seleziona prima un lavoro.');
    }

    const stato = lavoro.stato || 'assegnato';
    if (stato === 'annullato') {
        return esito(false, 'Il lavoro è annullato: non si possono segnare ore.');
    }
    if (stato === 'in_standby') {
        return esito(false, 'Il lavoro è in standby: non si possono segnare ore.');
    }
    if (stato === 'sospeso') {
        return esito(false, 'Il lavoro è sospeso: non si possono segnare ore.');
    }

    if (stato === 'completato' || stato === 'completato_da_approvare') {
        const completato = mezzanotteLocale(lavoro.completatoIl);
        if (!completato) {
            return esito(false, 'Manca la data di completamento: non si possono segnare ore. Chiedi al caposquadra o al manager.');
        }
        const oggiMezzo = mezzanotteLocale(oggi) || mezzanotteLocale(new Date());
        const giorniDaCompletamento = differenzaGiorni(oggiMezzo, completato);
        const fuoriFinestra = giorniDaCompletamento > FINESTRA_ORE_IN_RITARDO_GIORNI;
        const giornoRichiesto = giorno == null || (typeof giorno === 'string' && giorno.trim() === '');
        if (giornoRichiesto) {
            if (fuoriFinestra) return esito(false, messaggioOreFuoriFinestra(lavoro.completatoIl));
            return esito(true);
        }

        const giornoOre = mezzanotteLocale(giorno);
        if (!giornoOre) return esito(false, 'Inserisci una data valida.');
        if (fuoriFinestra) return esito(false, messaggioOreFuoriFinestra(lavoro.completatoIl));
        if (differenzaGiorni(giornoOre, oggiMezzo) > 0) {
            return esito(false, 'Non puoi segnare ore per un giorno futuro.');
        }
        if (differenzaGiorni(giornoOre, completato) > 0) {
            const quando = formattaGiornoBreve(lavoro.completatoIl);
            return esito(false, `Il lavoro è stato completato il ${quando}: puoi segnare solo i giorni fino a quella data.`);
        }
        if (lavoro.dataInizio != null && lavoro.dataInizio !== '') {
            const inizio = mezzanotteLocale(lavoro.dataInizio);
            if (!inizio) {
                return esito(false, 'La data di inizio del lavoro non è valida: non si possono segnare ore. Chiedi al caposquadra o al manager.');
            }
            if (differenzaGiorni(giornoOre, inizio) < 0) {
                return esito(false, `Puoi segnare le ore solo dal ${formattaGiornoBreve(lavoro.dataInizio)}, data di inizio del lavoro.`);
            }
        }
        return esito(true);
    }

    if (typeof delegaDropdownSegnaOre !== 'function') {
        return esito(false, 'Questo lavoro non è selezionabile per le ore.');
    }
    const ok = !!delegaDropdownSegnaOre(lavoro, oggi);
    return esito(ok);
}
