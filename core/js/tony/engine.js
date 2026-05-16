/**
 * Tony Widget – Engine: mappe pagine, resolve, getUrl, pulizia testo e estrazione risposta.
 * @module core/js/tony/engine
 */

export var TONY_PAGE_MAP = {
    'dashboard': 'core/dashboard-standalone.html',
    'home': 'core/dashboard-standalone.html',
    'pagina principale': 'core/dashboard-standalone.html',
    'terreni': 'core/terreni-standalone.html',
    'mappa': 'core/terreni-standalone.html',
    'mappa aziendale': 'core/mappa-aziendale-standalone.html',
    'mappa azienda': 'core/mappa-aziendale-standalone.html',
    'appezzamenti': 'core/terreni-standalone.html',
    'attivita': 'core/attivita-standalone.html', 'attività': 'core/attivita-standalone.html',
    'lavori': 'core/admin/gestione-lavori-standalone.html', 'gestione lavori': 'core/admin/gestione-lavori-standalone.html',
    'segnatura ore': 'core/segnatura-ore-standalone.html', 'segnare ore': 'core/segnatura-ore-standalone.html',
    'workspace campo': 'core/mobile/field-workspace-standalone.html',
    'field workspace': 'core/mobile/field-workspace-standalone.html',
    'statistiche lavoratore': 'core/mobile/statistiche-lavoratore-standalone.html',
    'statistiche campo': 'core/mobile/statistiche-lavoratore-standalone.html',
    'validazione ore': 'core/admin/validazione-ore-standalone.html', 'validare ore': 'core/admin/validazione-ore-standalone.html',
    'lavori caposquadra': 'core/admin/lavori-caposquadra-standalone.html', 'i miei lavori': 'core/admin/lavori-caposquadra-standalone.html',
    'statistiche': 'core/statistiche-standalone.html',
    'statistiche manodopera': 'core/admin/statistiche-manodopera-standalone.html', 'statistiche ore': 'core/admin/statistiche-manodopera-standalone.html',
    'gestisci utenti': 'core/admin/gestisci-utenti-standalone.html', 'utenti': 'core/admin/gestisci-utenti-standalone.html',
    'gestione squadre': 'core/admin/gestione-squadre-standalone.html', 'squadre': 'core/admin/gestione-squadre-standalone.html',
    'gestione operai': 'core/admin/gestione-operai-standalone.html', 'operai': 'core/admin/gestione-operai-standalone.html',
    'compensi operai': 'core/admin/compensi-operai-standalone.html', 'compensi': 'core/admin/compensi-operai-standalone.html',
    'gestione macchine': 'core/admin/gestione-macchine-standalone.html',
    'macchine': 'modules/macchine/views/macchine-dashboard-standalone.html',
    'parcoMacchine': 'modules/macchine/views/macchine-dashboard-standalone.html',
    'parco macchine': 'modules/macchine/views/macchine-dashboard-standalone.html',
    'trattori': 'modules/macchine/views/macchine-dashboard-standalone.html',
    'mezzi': 'modules/macchine/views/macchine-dashboard-standalone.html',
    'elenco trattori': 'modules/macchine/views/trattori-list-standalone.html',
    'trattori list': 'modules/macchine/views/trattori-list-standalone.html',
    'lista trattori': 'modules/macchine/views/trattori-list-standalone.html',
    'elenco attrezzi': 'modules/macchine/views/attrezzi-list-standalone.html',
    'attrezzi list': 'modules/macchine/views/attrezzi-list-standalone.html',
    'lista attrezzi': 'modules/macchine/views/attrezzi-list-standalone.html',
    'elenco attrezzature': 'modules/macchine/views/attrezzi-list-standalone.html',
    'elenco flotta': 'modules/macchine/views/flotta-list-standalone.html',
    'flotta list': 'modules/macchine/views/flotta-list-standalone.html',
    'lista flotta': 'modules/macchine/views/flotta-list-standalone.html',
    'scadenze': 'modules/macchine/views/scadenze-list-standalone.html',
    'elenco scadenze': 'modules/macchine/views/scadenze-list-standalone.html',
    'scadenze macchine': 'modules/macchine/views/scadenze-list-standalone.html',
    'manodopera': 'core/admin/gestione-operai-standalone.html',
    'magazzino': 'modules/magazzino/views/magazzino-home-standalone.html',
    'scorte': 'modules/magazzino/views/magazzino-home-standalone.html',
    'prodotti': 'modules/magazzino/views/prodotti-standalone.html', 'anagrafica prodotti': 'modules/magazzino/views/prodotti-standalone.html',
    'movimenti': 'modules/magazzino/views/movimenti-standalone.html', 'movimenti magazzino': 'modules/magazzino/views/movimenti-standalone.html',
    'tracciabilità consumi': 'modules/magazzino/views/tracciabilita-consumi-standalone.html',
    'tracciabilita consumi': 'modules/magazzino/views/tracciabilita-consumi-standalone.html',
    'consumi magazzino': 'modules/magazzino/views/tracciabilita-consumi-standalone.html',
    'vigneto': 'modules/vigneto/views/vigneto-dashboard-standalone.html',
    'uva': 'modules/vigneto/views/vigneto-dashboard-standalone.html',
    'vigneti': 'modules/vigneto/views/vigneti-standalone.html',
    'statistiche vigneto': 'modules/vigneto/views/vigneto-statistiche-standalone.html',
    'vigneto statistiche': 'modules/vigneto/views/vigneto-statistiche-standalone.html',
    'vendemmia': 'modules/vigneto/views/vendemmia-standalone.html',
    'potatura vigneto': 'modules/vigneto/views/potatura-standalone.html',
    'trattamenti vigneto': 'modules/vigneto/views/trattamenti-standalone.html',
    'concimazioni vigneto': 'modules/vigneto/views/concimazioni-standalone.html',
    'concimazione vigneto': 'modules/vigneto/views/concimazioni-standalone.html',
    'calcolo materiali': 'modules/vigneto/views/calcolo-materiali-standalone.html?coltura=vigneto',
    'calcolo materiali frutteto': 'modules/vigneto/views/calcolo-materiali-standalone.html?coltura=frutteto',
    'pianificazione impianto frutteto': 'modules/vigneto/views/pianifica-impianto-standalone.html?coltura=frutteto',
    'pianifica impianto frutteto': 'modules/vigneto/views/pianifica-impianto-standalone.html?coltura=frutteto',
    'pianificazione impianto': 'modules/vigneto/views/pianifica-impianto-standalone.html?coltura=vigneto',
    'pianifica impianto': 'modules/vigneto/views/pianifica-impianto-standalone.html?coltura=vigneto',
    'impianto': 'modules/vigneto/views/pianifica-impianto-standalone.html?coltura=vigneto',
    'frutteto': 'modules/frutteto/views/frutteto-dashboard-standalone.html',
    'frutteti': 'modules/frutteto/views/frutteti-standalone.html',
    'oliveto': 'core/dashboard-standalone.html',
    'ulivi': 'core/dashboard-standalone.html',
    'olio': 'core/dashboard-standalone.html',
    'statistiche frutteto': 'modules/frutteto/views/frutteto-statistiche-standalone.html',
    'frutteto statistiche': 'modules/frutteto/views/frutteto-statistiche-standalone.html',
    'raccolta frutta': 'modules/frutteto/views/raccolta-frutta-standalone.html',
    'potatura frutteto': 'modules/frutteto/views/potatura-standalone.html',
    'trattamenti frutteto': 'modules/frutteto/views/trattamenti-standalone.html',
    'concimazioni frutteto': 'modules/frutteto/views/concimazioni-standalone.html',
    'concimazione frutteto': 'modules/frutteto/views/concimazioni-standalone.html',
    'conto terzi': 'modules/conto-terzi/views/conto-terzi-home-standalone.html',
    'contoterzi': 'modules/conto-terzi/views/conto-terzi-home-standalone.html',
    'clienti': 'modules/conto-terzi/views/clienti-standalone.html',
    'preventivi': 'modules/conto-terzi/views/preventivi-standalone.html',
    'tariffe': 'modules/conto-terzi/views/tariffe-standalone.html',
    'terreni clienti': 'modules/conto-terzi/views/terreni-clienti-standalone.html',
    'mappa clienti': 'modules/conto-terzi/views/mappa-clienti-standalone.html',
    'report': 'modules/report/views/report-dashboard-standalone.html',
    'report terreni': 'modules/report/views/report-terreni-standalone.html',
    'report vigneto': 'modules/report/views/report-standalone.html',
    'amministrazione': 'core/admin/amministrazione-standalone.html',
    'guasti': 'modules/macchine/views/guasti-list-standalone.html',
    'gestione guasti': 'modules/macchine/views/guasti-list-standalone.html',
    'elenco guasti': 'modules/macchine/views/guasti-list-standalone.html',
    'segnalazione guasti': 'core/admin/segnalazione-guasti-standalone.html',
    'abbonamento': 'core/admin/abbonamento-standalone.html',
    'impostazioni': 'core/admin/impostazioni-standalone.html',
    'diario': 'core/attivita-standalone.html',
    'statistiche del vigneto': 'modules/vigneto/views/vigneto-statistiche-standalone.html',
    'statistiche del frutteto': 'modules/frutteto/views/frutteto-statistiche-standalone.html',
    'segnala guasto': 'core/admin/segnalazione-guasti-standalone.html',
    'segnalazione guasto': 'core/admin/segnalazione-guasti-standalone.html',
    'nuovo preventivo': 'modules/conto-terzi/views/nuovo-preventivo-standalone.html',
    'accetta preventivo': 'modules/conto-terzi/views/accetta-preventivo-standalone.html'
};

export var TONY_LABEL_MAP = {
    'dashboard': 'Dashboard', 'home': 'Dashboard', 'pagina principale': 'Dashboard',
    'terreni': 'Terreni', 'mappa': 'Terreni', 'mappa aziendale': 'Mappa aziendale', 'mappa azienda': 'Mappa aziendale', 'appezzamenti': 'Terreni',
    'attivita': 'Diario Attività', 'attività': 'Diario Attività',
    'lavori': 'Gestione Lavori', 'gestione lavori': 'Gestione Lavori',
    'segnatura ore': 'Segnatura Ore', 'segnare ore': 'Segnatura Ore',
    'workspace campo': 'Workspace campo', 'field workspace': 'Workspace campo',
    'statistiche lavoratore': 'Le tue statistiche', 'statistiche campo': 'Le tue statistiche',
    'validazione ore': 'Validazione Ore', 'validare ore': 'Validazione Ore',
    'lavori caposquadra': 'I miei Lavori', 'i miei lavori': 'I miei Lavori',
    'statistiche': 'Statistiche', 'statistiche manodopera': 'Statistiche Manodopera', 'statistiche ore': 'Statistiche Manodopera',
    'gestisci utenti': 'Gestisci Utenti', 'utenti': 'Gestisci Utenti',
    'gestione squadre': 'Gestione Squadre', 'squadre': 'Gestione Squadre',
    'gestione operai': 'Gestione Operai', 'operai': 'Gestione Operai',
    'compensi operai': 'Compensi Operai', 'compensi': 'Compensi Operai',
    'gestione macchine': 'Gestione Macchine',
    'macchine': 'Parco Macchine', 'parcoMacchine': 'Parco Macchine', 'parco macchine': 'Parco Macchine',
    'trattori': 'Parco Macchine', 'mezzi': 'Parco Macchine',
    'elenco trattori': 'Elenco Trattori', 'trattori list': 'Elenco Trattori', 'lista trattori': 'Elenco Trattori',
    'elenco attrezzi': 'Elenco Attrezzature', 'attrezzi list': 'Elenco Attrezzature', 'lista attrezzi': 'Elenco Attrezzature', 'elenco attrezzature': 'Elenco Attrezzature',
    'elenco flotta': 'Flotta Aziendale', 'flotta list': 'Flotta Aziendale', 'lista flotta': 'Flotta Aziendale',
    'scadenze': 'Scadenze', 'elenco scadenze': 'Scadenze', 'scadenze macchine': 'Scadenze',
    'manodopera': 'Manodopera',
    'magazzino': 'Magazzino', 'scorte': 'Magazzino', 'prodotti': 'Prodotti', 'anagrafica prodotti': 'Prodotti',
    'movimenti': 'Movimenti', 'movimenti magazzino': 'Movimenti',
    'vigneto': 'Vigneto', 'uva': 'Vigneto', 'vigneti': 'Vigneti',
    'statistiche vigneto': 'Statistiche Vigneto', 'vigneto statistiche': 'Statistiche Vigneto',
    'vendemmia': 'Vendemmia', 'potatura vigneto': 'Potatura Vigneto', 'trattamenti vigneto': 'Trattamenti Vigneto',
    'concimazioni vigneto': 'Concimazioni Vigneto', 'concimazione vigneto': 'Concimazioni Vigneto',
    'calcolo materiali': 'Calcolo Materiali', 'calcolo materiali frutteto': 'Calcolo Materiali Frutteto',
    'pianificazione impianto': 'Pianificazione Impianto', 'pianifica impianto': 'Pianificazione Impianto', 'impianto': 'Pianificazione Impianto',
    'pianificazione impianto frutteto': 'Pianificazione impianto (Frutteto)', 'pianifica impianto frutteto': 'Pianificazione impianto (Frutteto)',
    'frutteto': 'Frutteto', 'frutteti': 'Frutteti',
    'oliveto': 'Oliveto', 'ulivi': 'Oliveto', 'olio': 'Oliveto',
    'statistiche frutteto': 'Statistiche Frutteto', 'frutteto statistiche': 'Statistiche Frutteto',
    'raccolta frutta': 'Raccolta Frutta', 'potatura frutteto': 'Potatura Frutteto', 'trattamenti frutteto': 'Trattamenti Frutteto',
    'concimazioni frutteto': 'Concimazioni Frutteto', 'concimazione frutteto': 'Concimazioni Frutteto',
    'conto terzi': 'Conto Terzi', 'contoterzi': 'Conto Terzi',
    'clienti': 'Clienti', 'preventivi': 'Preventivi', 'tariffe': 'Tariffe',
    'terreni clienti': 'Terreni Clienti', 'mappa clienti': 'Mappa Clienti',
    'report': 'Report', 'amministrazione': 'Amministrazione', 'guasti': 'Elenco Guasti', 'gestione guasti': 'Elenco Guasti', 'elenco guasti': 'Elenco Guasti',
    'segnalazione guasti': 'Segnalazione Guasti', 'abbonamento': 'Abbonamento',
    'impostazioni': 'Impostazioni', 'diario': 'Diario Attività',
    'statistiche del vigneto': 'Statistiche Vigneto', 'statistiche del frutteto': 'Statistiche Frutteto',
    'segnala guasto': 'Segnalazione Guasti', 'segnalazione guasto': 'Segnalazione Guasti',
    'nuovo preventivo': 'Nuovo Preventivo', 'accetta preventivo': 'Accetta Preventivo'
};

export function resolveTarget(raw) {
    var t = (raw || '').toString().toLowerCase().trim().replace(/\s+/g, ' ').replace(/[àáâãä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o').replace(/[ùúûü]/g, 'u');
    if (TONY_PAGE_MAP[t]) return t;
    var aliases = {
        'statistiche del vigneto': 'statistiche vigneto', 'statistiche vigneto': 'statistiche vigneto',
        'statistiche del frutteto': 'statistiche frutteto', 'statistiche frutteto': 'statistiche frutteto',
        'anagrafica vigneti': 'vigneti', 'anagrafica terreni': 'terreni', 'anagrafica clienti': 'clienti',
        'anagrafica prodotti': 'prodotti', 'anagrafica operai': 'operai', 'anagrafica squadre': 'squadre',
        'diario attività': 'attivita', 'diario attivita': 'attivita', 'modulo attività': 'attivita',
        'pagina terreni': 'terreni', 'pagina vigneti': 'vigneti', 'pagina frutteti': 'frutteti',
        'pianificazione impianto vigneto': 'pianificazione impianto', 'impianto vigneto': 'pianificazione impianto',
        'pianificazione impianto frutteto': 'pianificazione impianto frutteto', 'impianto frutteto': 'pianificazione impianto frutteto',
        'home vigneto': 'vigneto', 'home frutteto': 'frutteto', 'home magazzino': 'magazzino',
        'home conto terzi': 'conto terzi', 'contoterzi': 'conto terzi',
        'dashboard frutteto': 'frutteto', 'dashboard vigneto': 'vigneto', 'cosa devo fare': 'lavori',
        'gestione lavori': 'lavori', 'parco macchine': 'parcoMacchine',         'operai': 'manodopera',
        'field-workspace': 'workspace campo', 'workspace mobile': 'workspace campo',
        'home campo': 'workspace campo', 'flusso campo': 'workspace campo'
    };
    if (aliases[t]) return aliases[t];
    var normalized = t.replace(/\b(del|della|dei|delle|pagina|modulo|sezione|anagrafica)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (TONY_PAGE_MAP[normalized]) return normalized;
    for (var k in TONY_PAGE_MAP) {
        if (t.indexOf(k) !== -1 && k.length >= 4) return k;
    }
    return null;
}

export function getUrlForTarget(target, pathname) {
    var resolved = resolveTarget(target);
    if (!resolved) return null;
    var pathFromRoot = TONY_PAGE_MAP[resolved];
    if (!pathFromRoot) return null;
    pathFromRoot = pathFromRoot.replace(/^\//, '');
    var p = (pathname || (typeof window !== 'undefined' && window.location && window.location.pathname) || '').replace(/\\/g, '/');
    var base = (p.indexOf('/gfv-platform/') >= 0) ? '/gfv-platform' : '';
    return (base ? base + '/' : '/') + pathFromRoot;
}

/**
 * Rimuove dal testo discorsivo oggetti JSON che il modello a volte concatena (es. {"command":"APRI_PAGINA",...}).
 */
function stripLeakedTonyCommandJsonFromText(t) {
    if (!t || typeof t !== 'string') return t;
    var out = t;
    var safety = 0;
    while (safety++ < 24) {
        var start = -1;
        for (var k = 0; k < out.length; k++) {
            if (out[k] !== '{') continue;
            var head = out.slice(k, Math.min(out.length, k + 700));
            if (!/"\s*command\s*"\s*:|'\s*command\s*'\s*:|"\s*action\s*"\s*:\s*"/i.test(head)) continue;
            start = k;
            break;
        }
        if (start < 0) break;
        var depth = 0;
        var j = start;
        for (; j < out.length; j++) {
            var c = out[j];
            if (c === '{') depth++;
            else if (c === '}') {
                depth--;
                if (depth === 0) {
                    j++;
                    break;
                }
            }
        }
        if (depth !== 0) break;
        var before = out.slice(0, start).replace(/\s+$/g, '');
        var after = out.slice(j).replace(/^\s*[.,:;]\s*/g, '');
        out = (before + (before.length && after.length ? ' ' : '') + after).replace(/\s{2,}/g, ' ').trim();
    }
    return out;
}

/**
 * Rimuove coda tipo "commands": [ { "type": "QUICK_SAVE", ... quando il modello concatena JSON malformato (senza graffa iniziale).
 */
function stripLeakedTonyCommandsArrayTail(t) {
    if (!t || typeof t !== 'string') return t;
    var idx = t.search(/"commands"\s*:\s*\[/i);
    if (idx < 0) return t;
    var bracket = t.indexOf('[', idx);
    if (bracket < 0) return t;
    var depth = 0;
    var i = bracket;
    for (; i < t.length; i++) {
        var c = t[i];
        if (c === '[') depth++;
        else if (c === ']') {
            depth--;
            if (depth === 0) {
                i++;
                break;
            }
        }
    }
    if (depth !== 0) return t;
    var head = t.slice(0, idx).replace(/[,\s]+$/g, '').trim();
    head = head.replace(/^[\s\n\uFEFF\{,]*["']?text["']?\s*:\s*["']/i, '');
    head = head.replace(/\\n/g, ' ');
    head = head.replace(/["']\s*,?\s*$/g, '').trim();
    var after = t.slice(i).replace(/^[\s,}\]]+/, '').trim();
    var out = (head + (head && after ? ' ' : '') + after).replace(/\s{2,}/g, ' ').trim();
    return out;
}

/**
 * Rimuove residui JSON dal testo (graffe, virgolette, virgole finali) per display e TTS.
 */
export function cleanTextFromJsonResidue(s) {
    if (s == null || typeof s !== 'string') return '';
    var t = s.trim();
    t = stripLeakedTonyCommandJsonFromText(t);
    t = stripLeakedTonyCommandsArrayTail(t);
    t = t.replace(/\s*[}\]]+\s*$/g, '').trim();
    t = t.replace(/^\s*[{\[]+\s*/g, '').trim();
    t = t.replace(/\s*["']\s*}\s*$/g, '');
    t = t.replace(/\s*}\s*["']?\s*$/g, '').trim();
    t = t.replace(/^\s*["']?\s*{\s*/g, '').trim();
    t = t.replace(/\s*,\s*}\s*$/g, '');
    t = t.replace(/\s*[""]+\s*$/g, '').trim();
    t = t.replace(/^\s*[""]+\s*/g, '').trim();
    // Regex aggressiva: rimuove graffe, virgolette, virgole e spazi finali (residui JSON)
    t = t.replace(/[}\]"\s,]+$/, '').trim();
    // Etichetta mittente duplicata (modello a volte scrive "Tony: ..." nel testo)
    while (/^\s*Tony\s*:\s*/i.test(t)) {
        t = t.replace(/^\s*Tony\s*:\s*/i, '').trim();
    }
    return t.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Estrae text e command da una stringa che contiene JSON (fallback se Cloud Function non parsa).
 */
export function extractTonyResponseFromString(str) {
    if (!str || typeof str !== 'string') return null;
    var s = str.trim();
    var jsonStart = s.search(/\{\s*["']?text["']?\s*:/);
    if (jsonStart < 0) jsonStart = s.indexOf('{');
    if (jsonStart < 0) return null;
    var jsonStr = s.slice(jsonStart).replace(/\b(text|command)\s*:/g, '"$1":');
    for (var tries = 0; tries < 25 && jsonStr.length > 15; tries++) {
        try {
            var parsed = JSON.parse(jsonStr);
            if (parsed && typeof parsed === 'object' && (parsed.text != null || parsed.command != null)) {
                var text = (parsed.text != null ? String(parsed.text).replace(/\s+[}\]]\s*$/g, '').trim() : '') || '';
                var cmd = parsed.command && typeof parsed.command === 'object' ? parsed.command : null;
                return { text: text || 'Ok.', command: cmd };
            }
        } catch (_) {}
        jsonStr = jsonStr.slice(0, -1).trim();
    }
    return null;
}
