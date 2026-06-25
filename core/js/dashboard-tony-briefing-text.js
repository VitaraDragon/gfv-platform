/**
 * Testi briefing Tony dashboard (ops): prodotti sotto scorta, guasti, scadenze mezzi.
 * Pure helpers — allineati a functions/index.js (buildSummarySottoScorta) e tony-quick-replies (formatGuastiAperti).
 * @module core/js/dashboard-tony-briefing-text
 */

const GUASTI_CHIUSI = ['risolto', 'riparato', 'chiuso'];
const TIPI_FLOTTA = ['automezzo', 'veicolo', 'furgone'];

function isTipoFlottaBriefing(tipo) {
    return TIPI_FLOTTA.includes((tipo || '').toLowerCase());
}

/**
 * @param {Array<{ id?: string, data?: () => object }|object>} prodottiDocsOrRows
 * @returns {{ count: number, summarySottoScorta: string }}
 */
export function buildSottoScortaBriefingFromProdotti(prodottiDocsOrRows) {
    const list = [];
    (prodottiDocsOrRows || []).forEach(function (row) {
        const data = row && typeof row.data === 'function' ? row.data() : row;
        if (!data || data.attivo === false) return;
        const smRaw = data.scortaMinima != null ? data.scortaMinima : data.sogliaMinima;
        const sm = smRaw != null ? Number(smRaw) : NaN;
        if (!Number.isFinite(sm) || sm <= 0) return;
        const gRaw = data.giacenza;
        const g = gRaw != null ? Number(gRaw) : null;
        const under = g == null || !Number.isFinite(g) || g < sm;
        if (!under) return;
        const nome = String(data.nome || data.codice || row.id || '').trim() || String(row.id || 'Prodotto');
        list.push(nome);
    });

    if (list.length === 0) {
        return {
            count: 0,
            summarySottoScorta:
                'Nessun prodotto sotto scorta tra quelli con soglia minima impostata.',
        };
    }

    const names = list.slice(0, 12);
    const more = list.length > 12 ? ' (+ altri ' + (list.length - 12) + ')' : '';
    return {
        count: list.length,
        summarySottoScorta:
            list.length +
            ' prodott' +
            (list.length === 1 ? 'o' : 'i') +
            ' sotto scorta: ' +
            names.join(', ') +
            more +
            '.',
    };
}

/**
 * @param {Array<{ id?: string, nome?: string, codice?: string }>} macchineList
 * @param {string} macchinaId
 * @returns {string}
 */
function resolveMacchinaNome(macchineList, macchinaId) {
    if (!macchinaId) return 'Macchina';
    const hit = (macchineList || []).find(function (m) {
        return m && m.id === macchinaId;
    });
    if (!hit) return String(macchinaId);
    return String(hit.nome || hit.codice || hit.id || macchinaId).trim() || String(macchinaId);
}

/**
 * @param {Array<{ id?: string, data?: () => object }|object>} guastiDocsOrRows
 * @param {Array<{ id?: string, nome?: string, codice?: string }>} macchineList
 * @returns {{ count: number, summaryGuasti: string }}
 */
export function buildGuastiApertiBriefingFromGuasti(guastiDocsOrRows, macchineList) {
    const aperti = [];
    (guastiDocsOrRows || []).forEach(function (row) {
        const g = row && typeof row.data === 'function' ? row.data() : row;
        if (!g) return;
        const stato = String(g.stato || '').toLowerCase();
        if (GUASTI_CHIUSI.indexOf(stato) >= 0) return;
        aperti.push(g);
    });

    if (aperti.length === 0) {
        return { count: 0, summaryGuasti: 'Non risultano guasti aperti nel parco macchine.' };
    }

    const lines = aperti.slice(0, 6).map(function (g) {
        if (String(g.tipoGuasto || '').toLowerCase() === 'generico') {
            const titolo = String(g.tipoProblema || 'Segnalazione').trim();
            const where = String(g.ubicazione || '').trim();
            return where ? titolo + ' (' + where + ')' : titolo;
        }
        const mac = g.macchina || resolveMacchinaNome(macchineList, g.macchinaId);
        const gr = g.gravita ? ' (' + String(g.gravita) + ')' : '';
        return String(mac || 'Macchina') + gr;
    });

    var text =
        aperti.length === 1 ? 'C\'è 1 guasto aperto' : 'Ci sono ' + aperti.length + ' guasti aperti';
    text += ': ' + lines.join('; ');
    if (aperti.length > 6) text += '; e altri ' + (aperti.length - 6) + '.';
    else text += '.';

    return { count: aperti.length, summaryGuasti: text };
}

/**
 * @param {Array<{ id?: string, data?: () => object }|object>} macchineDocsOrRows
 * @returns {{ count: number, summaryScadenze: string }}
 */
export function buildScadenzeUrgentiBriefingFromMacchine(macchineDocsOrRows) {
    const oggi = new Date();
    oggi.setHours(0, 0, 0, 0);
    const items = [];
    const seen = new Set();

    (macchineDocsOrRows || []).forEach(function (row) {
        const m = row && typeof row.data === 'function' ? row.data() : row;
        if (!m) return;
        const nome = String(m.nome || m.codice || row.id || 'Mezzo').trim() || 'Mezzo';
        const keyBase = String(row.id || nome);

        if (m.prossimaManutenzione != null) {
            const scadenza =
                m.prossimaManutenzione.toDate && typeof m.prossimaManutenzione.toDate === 'function'
                    ? m.prossimaManutenzione.toDate()
                    : new Date(m.prossimaManutenzione);
            if (!Number.isNaN(scadenza.getTime())) {
                scadenza.setHours(0, 0, 0, 0);
                const giorni = Math.ceil((scadenza - oggi) / (1000 * 60 * 60 * 24));
                if (giorni < 0 || (giorni >= 0 && giorni <= 15)) {
                    const label =
                        giorni < 0
                            ? nome + ' (manutenzione scaduta)'
                            : nome + ' (manutenzione tra ' + giorni + ' giorni)';
                    const key = keyBase + ':man';
                    if (!seen.has(key)) {
                        seen.add(key);
                        items.push(label);
                    }
                }
            }
        }

        const flotta = isTipoFlottaBriefing(m.tipoMacchina || m.tipo);

        if (flotta && m.kmProssimaManutenzione != null) {
            const km = m.kmAttuali != null ? parseFloat(m.kmAttuali) : (m.kmIniziali != null ? parseFloat(m.kmIniziali) : 0);
            const soglia = parseFloat(m.kmProssimaManutenzione);
            if (Number.isFinite(soglia)) {
                const rim = soglia - km;
                if (rim <= 0 || rim < 500) {
                    const label =
                        rim <= 0
                            ? nome + ' (tagliando km superato)'
                            : nome + ' (tagliando tra ' + Math.round(rim).toLocaleString('it-IT') + ' km)';
                    const key = keyBase + ':km';
                    if (!seen.has(key)) {
                        seen.add(key);
                        items.push(label);
                    }
                }
            }
        } else if (!flotta && m.oreProssimaManutenzione != null) {
            const ore = m.oreAttuali != null ? parseFloat(m.oreAttuali) : 0;
            const soglia = parseFloat(m.oreProssimaManutenzione);
            if (Number.isFinite(soglia)) {
                const rim = soglia - ore;
                if (rim <= 0 || rim < 15) {
                    const label =
                        rim <= 0
                            ? nome + ' (ore manutenzione esaurite)'
                            : nome + ' (ore manutenzione tra ' + Math.round(rim) + ' ore)';
                    const key = keyBase + ':ore';
                    if (!seen.has(key)) {
                        seen.add(key);
                        items.push(label);
                    }
                }
            }
        }
    });

    if (items.length === 0) {
        return { count: 0, summaryScadenze: 'Nessuna scadenza manutenzione urgente sui mezzi.' };
    }

    const shown = items.slice(0, 8);
    const more = items.length > 8 ? ' (+ altri ' + (items.length - 8) + ')' : '';
    return {
        count: items.length,
        summaryScadenze:
            items.length +
            ' scadenze urgenti sui mezzi: ' +
            shown.join('; ') +
            more +
            '.',
    };
}
