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
    'appezzamenti': 'core/terreni-standalone.html',
    'attivita': 'core/attivita-standalone.html', 'attività': 'core/attivita-standalone.html',
    'lavori': 'core/admin/gestione-lavori-standalone.html', 'gestione lavori': 'core/admin/gestione-lavori-standalone.html',
    'segnatura ore': 'core/segnatura-ore-standalone.html', 'segnare ore': 'core/segnatura-ore-standalone.html',
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
    'vigneto': 'modules/vigneto/views/vigneto-dashboard-standalone.html',
    'uva': 'modules/vigneto/views/vigneto-dashboard-standalone.html',
    'vigneti': 'modules/vigneto/views/vigneti-standalone.html',
    'statistiche vigneto': 'modules/vigneto/views/vigneto-statistiche-standalone.html',
    'vigneto statistiche': 'modules/vigneto/views/vigneto-statistiche-standalone.html',
    'vendemmia': 'modules/vigneto/views/vendemmia-standalone.html',
    'potatura vigneto': 'modules/vigneto/views/potatura-standalone.html',
    'trattamenti vigneto': 'modules/vigneto/views/trattamenti-standalone.html',
    'calcolo materiali': 'modules/vigneto/views/calcolo-materiali-standalone.html?coltura=vigneto',
    'calcolo materiali frutteto': 'modules/vigneto/views/calcolo-materiali-standalone.html?coltura=frutteto',
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
    'conto terzi': 'modules/conto-terzi/views/conto-terzi-home-standalone.html',
    'contoterzi': 'modules/conto-terzi/views/conto-terzi-home-standalone.html',
    'clienti': 'modules/conto-terzi/views/clienti-standalone.html',
    'preventivi': 'modules/conto-terzi/views/preventivi-standalone.html',
    'tariffe': 'modules/conto-terzi/views/tariffe-standalone.html',
    'terreni clienti': 'modules/conto-terzi/views/terreni-clienti-standalone.html',
    'mappa clienti': 'modules/conto-terzi/views/mappa-clienti-standalone.html',
    'report': 'modules/report/views/report-standalone.html',
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
    'terreni': 'Terreni', 'mappa': 'Terreni', 'appezzamenti': 'Terreni',
    'attivita': 'Diario Attività', 'attività': 'Diario Attività',
    'lavori': 'Gestione Lavori', 'gestione lavori': 'Gestione Lavori',
    'segnatura ore': 'Segnatura Ore', 'segnare ore': 'Segnatura Ore',
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
    'calcolo materiali': 'Calcolo Materiali', 'calcolo materiali frutteto': 'Calcolo Materiali Frutteto',
    'pianificazione impianto': 'Pianificazione Impianto', 'pianifica impianto': 'Pianificazione Impianto', 'impianto': 'Pianificazione Impianto',
    'frutteto': 'Frutteto', 'frutteti': 'Frutteti',
    'oliveto': 'Oliveto', 'ulivi': 'Oliveto', 'olio': 'Oliveto',
    'statistiche frutteto': 'Statistiche Frutteto', 'frutteto statistiche': 'Statistiche Frutteto',
    'raccolta frutta': 'Raccolta Frutta', 'potatura frutteto': 'Potatura Frutteto', 'trattamenti frutteto': 'Trattamenti Frutteto',
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
        'pianificazione impianto frutteto': 'calcolo materiali frutteto', 'impianto frutteto': 'calcolo materiali frutteto',
        'home vigneto': 'vigneto', 'home frutteto': 'frutteto', 'home magazzino': 'magazzino',
        'home conto terzi': 'conto terzi', 'contoterzi': 'conto terzi',
        'dashboard frutteto': 'frutteto', 'dashboard vigneto': 'vigneto', 'cosa devo fare': 'lavori',
        'gestione lavori': 'lavori', 'parco macchine': 'parcoMacchine', 'operai': 'manodopera'
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
 * Rimuove residui JSON dal testo (graffe, virgolette, virgole finali) per display e TTS.
 */
export function cleanTextFromJsonResidue(s) {
    if (s == null || typeof s !== 'string') return '';
    var t = s.trim();
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
