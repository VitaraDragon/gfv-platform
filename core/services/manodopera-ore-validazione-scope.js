/**
 * Regole validazione ore: operai (caposquadra) vs ore del caposquadra (manager).
 */

export function isLavoroSquadra(lavoroData) {
    return Boolean(lavoroData?.caposquadraId && !lavoroData?.operaioId);
}

export function isLavoroAutonomo(lavoroData) {
    return Boolean(lavoroData?.operaioId && !lavoroData?.caposquadraId);
}

/** Ore segnate dal caposquadra assegnato su un lavoro di squadra. */
export function isOraDelCaposquadraSuLavoroSquadra(oraData, lavoroData) {
    if (!isLavoroSquadra(lavoroData)) return false;
    const capoId = String(lavoroData.caposquadraId || '');
    const operaioId = String(oraData?.operaioId || '');
    return Boolean(capoId && operaioId && capoId === operaioId);
}

/**
 * L'ora compare nella coda di validazione dell'utente corrente?
 */
export function oreVisibileInCodaValidazione({ oraData, lavoroData, userId, isCaposquadra, isManager }) {
    const uid = String(userId || '');
    if (isManager) {
        if (isLavoroAutonomo(lavoroData)) return true;
        return isOraDelCaposquadraSuLavoroSquadra(oraData, lavoroData);
    }
    if (isCaposquadra) {
        if (!isLavoroSquadra(lavoroData)) return false;
        if (String(lavoroData.caposquadraId) !== uid) return false;
        return !isOraDelCaposquadraSuLavoroSquadra(oraData, lavoroData);
    }
    return false;
}

export function assertUtentePuoValidareOra({ oraData, lavoroData, userId, isCaposquadra, isManager }) {
    if (oreVisibileInCodaValidazione({ oraData, lavoroData, userId, isCaposquadra, isManager })) {
        return;
    }
    if (isOraDelCaposquadraSuLavoroSquadra(oraData, lavoroData)) {
        throw new Error('Le ore del caposquadra sono validate dal manager');
    }
    if (isLavoroAutonomo(lavoroData)) {
        throw new Error('Solo Manager può validare ore di lavori autonomi');
    }
    if (isLavoroSquadra(lavoroData)) {
        throw new Error('Non sei il caposquadra assegnato a questo lavoro');
    }
    throw new Error('Lavoro non valido (deve essere assegnato a caposquadra o operaio)');
}

/** Conteggio ore da_validare visibili al manager (autonomi + ore capo su squadra). */
export function contaOreManagerDaValidareSuLavoro(lavoroData, oreRecords) {
    let n = 0;
    const list = Array.isArray(oreRecords) ? oreRecords : [];
    for (const rec of list) {
        const data = rec && typeof rec.data === 'function' ? rec.data() : rec;
        if (!data || data.stato !== 'da_validare') continue;
        if (isLavoroAutonomo(lavoroData)) {
            n += 1;
        } else if (isOraDelCaposquadraSuLavoroSquadra(data, lavoroData)) {
            n += 1;
        }
    }
    return n;
}

/**
 * Quante ore da_validare sono in elenco ma non nella coda di chi guarda.
 * Le già validate o rifiutate non contano. Una riga già visibile non si conta due volte.
 * @param {object[]|undefined|null} righe
 * @param {object[]|undefined|null} visibili
 * @returns {number}
 */
function contaOreDaValidareNonVisibili(righe, visibili) {
    const tutte = Array.isArray(righe) ? righe : [];
    const viste = Array.isArray(visibili) ? visibili : [];
    const visteId = new Set();
    const visteRef = new Set();
    for (const riga of viste) {
        if (!riga || typeof riga !== 'object') continue;
        visteRef.add(riga);
        if (riga.id != null && riga.id !== '') visteId.add(String(riga.id));
    }
    let n = 0;
    for (const riga of tutte) {
        if (!riga || riga.stato !== 'da_validare') continue;
        if (visteRef.has(riga)) continue;
        if (riga.id != null && riga.id !== '' && visteId.has(String(riga.id))) continue;
        n += 1;
    }
    return n;
}

/**
 * Testo della coda vuota. Non cambia chi vede le ore.
 * Il manager senza coda propria vede le ore degli operai ancora dal caposquadra.
 * Caposquadra e gli altri ruoli tengono il testo di prima.
 * @param {{ isManager?: boolean, isCaposquadra?: boolean, righe?: object[], visibili?: object[] }} [args]
 * @returns {{ titolo: string, dettaglio: string, inAttesaCapisquadra: string }}
 */
export function testoCodaValidazioneVuota(args) {
    const { isManager = false, isCaposquadra = false, righe, visibili } = args || {};
    const titolo = 'Nessuna ora da validare';
    if (!(isManager && !isCaposquadra)) {
        return {
            titolo,
            dettaglio: 'Tutte le ore sono state validate o rifiutate',
            inAttesaCapisquadra: ''
        };
    }
    const n = contaOreDaValidareNonVisibili(righe, visibili);
    let inAttesaCapisquadra = '';
    if (n === 1) inAttesaCapisquadra = '1 ora in attesa dei capisquadra';
    else if (n > 1) inAttesaCapisquadra = `${n} ore in attesa dei capisquadra`;
    return {
        titolo,
        dettaglio: 'Nessuna ora da validare da te',
        inAttesaCapisquadra
    };
}
