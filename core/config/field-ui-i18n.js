/**
 * Catalogo cornice del workspace campo (solo it, ro, en).
 * BOZZA RO/EN: da rivedere da un madrelingua.
 * Nessuna dipendenza. Step 1: testi fissi. Step 2: status, elenchi e form dinamici.
 * @module core/config/field-ui-i18n
 */

export const FIELD_UI_LANGS = ['it', 'ro', 'en'];

/** @type {Record<string, { it: string, ro: string, en: string }>} */
export const FIELD_UI_STRINGS = {
    'page.title': {
        it: 'Versione mobile — GFV',
        ro: 'Versiune mobilă — GFV',
        en: 'Mobile version — GFV'
    },
    'menu.options': {
        it: 'Opzioni',
        ro: 'Opțiuni',
        en: 'Options'
    },
    'menu.preparing': {
        it: 'Sto preparando il workspace…',
        ro: 'Pregătesc spațiul de lucru…',
        en: 'Preparing the workspace…'
    },
    'menu.guide': {
        it: 'Guida Manodopera',
        ro: 'Ghid Manoperă',
        en: 'Workforce guide'
    },
    'menu.validation': {
        it: 'Validazione ore (schermo intero)',
        ro: 'Validare ore (ecran complet)',
        en: 'Validate hours (full screen)'
    },
    'menu.fault': {
        it: 'Segnala guasto',
        ro: 'Semnalează defecțiunea',
        en: 'Report a fault'
    },
    'menu.account': {
        it: 'Impostazioni account',
        ro: 'Setări cont',
        en: 'Account settings'
    },
    'menu.switchTenant': {
        it: 'Cambia azienda',
        ro: 'Schimbă firma',
        en: 'Switch company'
    },
    'menu.logout': {
        it: 'Esci',
        ro: 'Ieșire',
        en: 'Log out'
    },
    'nav.back': {
        it: 'Indietro',
        ro: 'Înapoi',
        en: 'Back'
    },
    'nav.next': {
        it: 'Avanti',
        ro: 'Înainte',
        en: 'Next'
    },
    'nav.done': {
        it: 'Fine',
        ro: 'Gata',
        en: 'Done'
    },
    'slide.lavoro.title': {
        it: 'Seleziona lavoro',
        ro: 'Alege lucrarea',
        en: 'Select job'
    },
    'slide.lavoro.sub': {
        it: 'Scegli il lavoro corrente, poi scorri a sinistra per il flusso operativo.',
        ro: 'Alege lucrarea curentă, apoi glisează la stânga pentru fluxul de lucru.',
        en: 'Choose the current job, then swipe left for the work flow.'
    },
    'slide.commIn.title': {
        it: '📣 Comunicazioni',
        ro: '📣 Comunicări',
        en: '📣 Communications'
    },
    'slide.commIn.sub': {
        it: 'Messaggi dal caposquadra per il tuo turno.',
        ro: 'Mesaje de la șeful de echipă pentru tura ta.',
        en: 'Messages from the team leader for your shift.'
    },
    'slide.commOut.title': {
        it: '📣 Comunicazioni squadra',
        ro: '📣 Comunicări echipă',
        en: '📣 Team communications'
    },
    'slide.commOut.sub': {
        it: 'Messaggio operativo rapido alla squadra.',
        ro: 'Mesaj rapid de lucru către echipă.',
        en: 'Quick work message to the team.'
    },
    'slide.valida.title': {
        it: '✅ Valida ore',
        ro: '✅ Validează orele',
        en: '✅ Validate hours'
    },
    'slide.valida.sub': {
        it: 'Approva o rifiuta le ore segnate dagli operai della squadra.',
        ro: 'Aprobă sau respinge orele notate de muncitorii din echipă.',
        en: 'Approve or reject the hours logged by the team workers.'
    },
    'slide.ore.title': {
        it: '⏱️ Segna ore',
        ro: '⏱️ Notează orele',
        en: '⏱️ Log hours'
    },
    'slide.ore.sub': {
        it: 'Le ore vengono calcolate automaticamente dagli orari impostati.',
        ro: 'Orele se calculează automat din orarele setate.',
        en: 'Hours are calculated automatically from the times you set.'
    },
    'slide.stats.title': {
        it: '📊 Statistiche',
        ro: '📊 Statistici',
        en: '📊 Statistics'
    },
    'slide.stats.sub': {
        it: 'Le tue ore e la ripartizione sui tipi di lavoro (solo account manodopera).',
        ro: 'Orele tale și împărțirea pe tipuri de lucrare (doar cont manoperă).',
        en: 'Your hours and the split by job type (workforce account only).'
    },
    'lavoro.assigned': {
        it: 'Lavori assegnati',
        ro: 'Lucrări atribuite',
        en: 'Assigned jobs'
    },
    'pieno.title': {
        it: '⛽ Pieno',
        ro: '⛽ Alimentare',
        en: '⛽ Refuel'
    },
    'pieno.sub': {
        it: 'Segna i litri prima di partire. Vale per il mezzo di questo lavoro, non per una lavorazione a mano.',
        ro: 'Notează litrii înainte de plecare. Este pentru utilajul acestei lucrări, nu pentru o lucrare de mână.',
        en: 'Log the litres before you leave. It applies to this job\'s vehicle, not to hand work.'
    },
    'pieno.fuel': {
        it: 'Carburante',
        ro: 'Carburant',
        en: 'Fuel'
    },
    'pieno.liters': {
        it: 'Litri',
        ro: 'Litri',
        en: 'Litres'
    },
    'pieno.submit': {
        it: 'Registra pieno',
        ro: 'Înregistrează alimentarea',
        en: 'Save refuel'
    },
    'assenza.title': {
        it: '🚫 Segnala assenza',
        ro: '🚫 Semnalează absența',
        en: '🚫 Report absence'
    },
    'assenza.sub': {
        it: 'Avvisa il manager: il lavoro passa in standby dopo la conferma.',
        ro: 'Anunță managerul: lucrarea trece în standby după confirmare.',
        en: 'Tell the manager: the job goes on standby after confirmation.'
    },
    'assenza.worker': {
        it: 'Operaio',
        ro: 'Muncitor',
        en: 'Worker'
    },
    'assenza.type': {
        it: 'Tipo',
        ro: 'Tip',
        en: 'Type'
    },
    'assenza.day': {
        it: 'Giorno',
        ro: 'Zi',
        en: 'Day'
    },
    'assenza.note': {
        it: 'Nota',
        ro: 'Notă',
        en: 'Note'
    },
    'assenza.placeholder': {
        it: 'Es. febbre',
        ro: 'Ex. febră',
        en: 'E.g. fever'
    },
    'assenza.submit': {
        it: 'Invia segnalazione',
        ro: 'Trimite sesizarea',
        en: 'Send report'
    },
    'comm.work': {
        it: 'Lavoro',
        ro: 'Lucrare',
        en: 'Job'
    },
    'comm.date': {
        it: 'Data',
        ro: 'Data',
        en: 'Date'
    },
    'comm.time': {
        it: 'Orario',
        ro: 'Ora',
        en: 'Time'
    },
    'comm.message': {
        it: 'Messaggio',
        ro: 'Mesaj',
        en: 'Message'
    },
    'comm.placeholder': {
        it: 'Es. iniziamo dal lato nord, priorità al filare 4',
        ro: 'Ex. începem din partea de nord, prioritate rândul 4',
        en: 'E.g. we start on the north side, row 4 first'
    },
    'comm.submit': {
        it: 'Invia comunicazione',
        ro: 'Trimite comunicarea',
        en: 'Send message'
    },
    'ore.date': {
        it: 'Data lavoro',
        ro: 'Data lucrării',
        en: 'Work date'
    },
    'ore.start': {
        it: 'Orario inizio',
        ro: 'Ora de început',
        en: 'Start time'
    },
    'ore.end': {
        it: 'Orario fine',
        ro: 'Ora de sfârșit',
        en: 'End time'
    },
    'ore.break': {
        it: 'Pausa (minuti)',
        ro: 'Pauză (minute)',
        en: 'Break (minutes)'
    },
    'ore.net': {
        it: 'Ore nette calcolate',
        ro: 'Ore nete calculate',
        en: 'Net hours calculated'
    },
    'ore.note': {
        it: 'Note (opzionale)',
        ro: 'Note (opțional)',
        en: 'Notes (optional)'
    },
    'ore.notePlaceholder': {
        it: 'Note turno',
        ro: 'Note tură',
        en: 'Shift notes'
    },
    'ore.cancel': {
        it: 'Annulla modifica',
        ro: 'Anulează modificarea',
        en: 'Cancel edit'
    },
    'ore.submit': {
        it: 'Salva ore lavorate',
        ro: 'Salvează orele lucrate',
        en: 'Save hours worked'
    },
    'ruolo.operaio': {
        it: 'Operaio',
        ro: 'Muncitor',
        en: 'Worker'
    },
    'ruolo.caposquadra': {
        it: 'Caposquadra',
        ro: 'Șef de echipă',
        en: 'Team leader'
    },
    'ruolo.manager': {
        it: 'Manager',
        ro: 'Manager',
        en: 'Manager'
    },
    'ruolo.amministratore': {
        it: 'Amministratore',
        ro: 'Administrator',
        en: 'Administrator'
    },
    'ruolo.account': {
        it: 'Account',
        ro: 'Cont',
        en: 'Account'
    },
    'ruolo.fieldUser': {
        it: 'Utente campo',
        ro: 'Utilizator de teren',
        en: 'Field user'
    },
    'lavoro.loading': { it: 'Caricamento lavori...', ro: 'Se încarcă lucrările...', en: 'Loading jobs...' },
    'lavoro.pick': { it: 'Seleziona lavoro', ro: 'Alege lucrarea', en: 'Select job' },
    'lavoro.loadError': { it: 'Non riesco a caricare i lavori. Riprova.', ro: 'Nu pot încărca lucrările. Încearcă din nou.', en: 'Cannot load the jobs. Try again.' },
    'lavoro.retry': { it: 'Riprova', ro: 'Încearcă din nou', en: 'Try again' },
    'lavoro.gpsNone': { it: 'Nessun suggerimento GPS disponibile.', ro: 'Nicio sugestie GPS disponibilă.', en: 'No GPS suggestion available.' },
    'lavoro.gpsHint': { it: 'Suggerimento: {label} (proposta rapida, conferma manualmente).', ro: 'Sugestie: {label} (propunere rapidă, confirmă manual).', en: 'Suggestion: {label} (quick proposal, confirm by hand).' },
    'lavoro.expand': { it: 'Ingrandisci', ro: 'Mărește', en: 'Enlarge' },
    'lavoro.shrink': { it: 'Riduci', ro: 'Micșorează', en: 'Reduce' },
    'lavoro.subActive': { it: 'Sostituzione attiva', ro: 'Înlocuire activă', en: 'Active substitution' },
    'lavoro.absentLine': { it: 'Assente: {name}', ro: 'Absent: {name}', en: 'Absent: {name}' },
    'lavoro.substituteLine': { it: 'Sostituto: {name}', ro: 'Înlocuitor: {name}', en: 'Substitute: {name}' },
    'lavoro.subHint': { it: 'Valida le sue ore in «Valida ore» sotto; il sostituto le segna da Segna ore.', ro: 'Validează orele lui la «Validează orele» mai jos; înlocuitorul le notează la Notează orele.', en: 'Validate their hours under «Validate hours»; the substitute logs them in Log hours.' },
    'lavoro.worksUpdated': { it: 'Elenco lavori aggiornato.', ro: 'Lista lucrărilor a fost actualizată.', en: 'Job list updated.' },
    'squad.title': { it: '👥 La mia squadra', ro: '👥 Echipa mea', en: '👥 My team' },
    'squad.sub': { it: 'Tocca un nome per chiamare o inviare email.', ro: 'Atinge un nume ca să suni sau să trimiți email.', en: 'Tap a name to call or send email.' },
    'squad.loading': { it: 'Caricamento squadra...', ro: 'Se încarcă echipa...', en: 'Loading team...' },
    'squad.none': { it: 'Nessuna squadra assegnata.', ro: 'Nicio echipă atribuită.', en: 'No team assigned.' },
    'squad.noWorkers': { it: 'Nessun operaio in squadra.', ro: 'Niciun muncitor în echipă.', en: 'No workers on the team.' },
    'squad.error': { it: 'Errore caricamento squadra.', ro: 'Eroare la încărcarea echipei.', en: 'Error loading the team.' },
    'squad.pick': { it: '-- Seleziona --', ro: '-- Alege --', en: '-- Select --' },
    'squad.pickWorker': { it: 'Seleziona un operaio.', ro: 'Alege un muncitor.', en: 'Select a worker.' },
    'squad.sending': { it: 'Invio...', ro: 'Se trimite...', en: 'Sending...' },
    'squad.sent': { it: 'Segnalazione inviata al manager.', ro: 'Sesizarea a fost trimisă managerului.', en: 'Report sent to the manager.' },
    'squad.sendError': { it: 'Errore invio segnalazione.', ro: 'Eroare la trimiterea sesizării.', en: 'Error sending the report.' },
    'squad.substituteTag': { it: '{name} (sostituto)', ro: '{name} (înlocuitor)', en: '{name} (substitute)' },
    'squad.fallbackName': { it: 'Squadra', ro: 'Echipă', en: 'Team' },
    'squad.many': { it: '{n} squadre · membri unici', ro: '{n} echipe · membri unici', en: '{n} teams · unique members' },
    'squad.withSubstitute': { it: '{label} · sostituto in campo', ro: '{label} · înlocuitor pe teren', en: '{label} · substitute in the field' },
    'squad.noContacts': { it: 'Contatti non disponibili in anagrafica.', ro: 'Contacte indisponibile în evidență.', en: 'Contacts not available in the records.' },
    'squad.ready': { it: 'Squadra pronta: il messaggio arriverà a {n} operai.', ro: 'Echipă gata: mesajul ajunge la {n} muncitori.', en: 'Team ready: the message will reach {n} workers.' },
    'squad.configure': { it: 'Nessun operaio in squadra: configura Gestione squadre prima di inviare.', ro: 'Niciun muncitor în echipă: configurează Gestiune echipe înainte să trimiți.', en: 'No workers on the team: set up Team management before sending.' },
    'squad.noneToNotify': { it: 'Nessun operaio in squadra da avvisare. In Gestione squadre assegna operai al tuo profilo caposquadra.', ro: 'Niciun muncitor de anunțat. În Gestiune echipe atribuie muncitori profilului tău de șef de echipă.', en: 'No workers to notify. In Team management assign workers to your team-leader profile.' },
    'assenza.sick': { it: 'Malattia', ro: 'Boală', en: 'Sick leave' },
    'assenza.holiday': { it: 'Ferie', ro: 'Concediu', en: 'Holiday' },
    'assenza.leave': { it: 'Permesso', ro: 'Învoire', en: 'Leave' },
    'assenza.other': { it: 'Altro', ro: 'Altele', en: 'Other' },
    'valida.inlineTitle': { it: '🕒 Valida ore', ro: '🕒 Validează orele', en: '🕒 Validate hours' },
    'valida.inlineSub': { it: 'Conferma o rifiuta le ore in attesa per il lavoro selezionato.', ro: 'Confirmă sau respinge orele în așteptare pentru lucrarea aleasă.', en: 'Confirm or reject the pending hours for the selected job.' },
    'valida.pickWork': { it: 'Seleziona un lavoro per vedere le ore da validare.', ro: 'Alege o lucrare ca să vezi orele de validat.', en: 'Select a job to see the hours to validate.' },
    'valida.none': { it: 'Nessuna ora in attesa di validazione.', ro: 'Nicio oră în așteptarea validării.', en: 'No hours waiting for validation.' },
    'valida.loading': { it: 'Caricamento ore da validare...', ro: 'Se încarcă orele de validat...', en: 'Loading hours to validate...' },
    'valida.error': { it: 'Errore caricamento ore da validare.', ro: 'Eroare la încărcarea orelor de validat.', en: 'Error loading hours to validate.' },
    'valida.waitingTitle': { it: '🕒 In attesa di validazione', ro: '🕒 În așteptarea validării', en: '🕒 Waiting for validation' },
    'valida.waitingSub': { it: 'Tutti i tuoi lavori di squadra. Per filtri avanzati apri la validazione completa.', ro: 'Toate lucrările tale de echipă. Pentru filtre avansate deschide validarea completă.', en: 'All your team jobs. For advanced filters open the full validation.' },
    'valida.refresh': { it: 'Aggiorna elenco', ro: 'Actualizează lista', en: 'Refresh list' },
    'valida.openFull': { it: 'Apri validazione completa', ro: 'Deschide validarea completă', en: 'Open full validation' },
    'valida.approve': { it: '✅ Approva', ro: '✅ Aprobă', en: '✅ Approve' },
    'valida.reject': { it: '❌ Rifiuta', ro: '❌ Respinge', en: '❌ Reject' },
    'valida.dateMissing': { it: 'Data non indicata', ro: 'Dată neindicată', en: 'Date not set' },
    'valida.pauseMin': { it: 'pausa {n} min', ro: 'pauză {n} min', en: 'break {n} min' },
    'valida.machineLine': { it: 'Macchina: {name}', ro: 'Utilaj: {name}', en: 'Machine: {name}' },
    'valida.withMachine': { it: 'Con macchina', ro: 'Cu utilaj', en: 'With a machine' },
    'valida.overlap': { it: '⚠️ Si sovrappone a {start}–{end}', ro: '⚠️ Se suprapune cu {start}–{end}', en: '⚠️ Overlaps {start}–{end}' },
    'valida.overlapWork': { it: '⚠️ Si sovrappone a {start}–{end} ({work})', ro: '⚠️ Se suprapune cu {start}–{end} ({work})', en: '⚠️ Overlaps {start}–{end} ({work})' },
    'valida.reasonRequired': { it: 'Motivo rifiuto obbligatorio', ro: 'Motivul respingerii este obligatoriu', en: 'Rejection reason is required' },
    'valida.reasonPrompt': { it: 'Motivo del rifiuto (obbligatorio):', ro: 'Motivul respingerii (obligatoriu):', en: 'Rejection reason (required):' },
    'valida.reasonAlert': { it: 'Scrivi il motivo: è obbligatorio.', ro: 'Scrie motivul: este obligatoriu.', en: 'Write the reason: it is required.' },
    'valida.rejected': { it: 'Ora rifiutata', ro: 'Oră respinsă', en: 'Hours rejected' },
    'valida.updateError': { it: 'Errore aggiornamento ore', ro: 'Eroare la actualizarea orelor', en: 'Error updating hours' },
    'comm.inboxTitle': { it: '📬 Messaggi dal caposquadra', ro: '📬 Mesaje de la șeful de echipă', en: '📬 Messages from the team leader' },
    'comm.inboxSub': { it: 'Da confermare e già letti, dal più recente.', ro: 'De confirmat și deja citite, de la cel mai recent.', en: 'To confirm and already read, newest first.' },
    'comm.loading': { it: 'Caricamento comunicazioni...', ro: 'Se încarcă comunicările...', en: 'Loading messages...' },
    'comm.onlyConfirmed': { it: 'Solo messaggi già confermati', ro: 'Doar mesaje deja confirmate', en: 'Only messages already confirmed' },
    'comm.highlightTitle': { it: '📨 In evidenza', ro: '📨 În evidență', en: '📨 In focus' },
    'comm.highlightSub': { it: 'Invii con conferme in attesa o recenti.', ro: 'Trimiteri cu confirmări în așteptare sau recente.', en: 'Sends with pending or recent confirmations.' },
    'comm.noneSent': { it: 'Nessuna comunicazione inviata.', ro: 'Nicio comunicare trimisă.', en: 'No message sent.' },
    'comm.previous': { it: 'Vedi comunicazioni precedenti', ro: 'Vezi comunicările anterioare', en: 'See earlier messages' },
    'comm.previousCount': { it: 'Vedi comunicazioni precedenti ({count})', ro: 'Vezi comunicările anterioare ({count})', en: 'See earlier messages ({count})' },
    'comm.hidePrevious': { it: 'Nascondi comunicazioni precedenti', ro: 'Ascunde comunicările anterioare', en: 'Hide earlier messages' },
    'comm.loadingSent': { it: 'Caricamento comunicazioni inviate...', ro: 'Se încarcă comunicările trimise...', en: 'Loading sent messages...' },
    'comm.noneHighlight': { it: 'Nessun invio in evidenza.', ro: 'Nicio trimitere în evidență.', en: 'Nothing in focus.' },
    'comm.loadError': { it: 'Errore caricamento comunicazioni.', ro: 'Eroare la încărcarea comunicărilor.', en: 'Error loading messages.' },
    'comm.noneRecent': { it: 'Nessuna comunicazione dal caposquadra negli ultimi 60 giorni.', ro: 'Nicio comunicare de la șeful de echipă în ultimele 60 de zile.', en: 'No message from the team leader in the last 60 days.' },
    'comm.confirmedBadge': { it: '✅ Confermato', ro: '✅ Confirmat', en: '✅ Confirmed' },
    'comm.confirmBtn': { it: 'Conferma ricezione', ro: 'Confirmă primirea', en: 'Confirm receipt' },
    'comm.fromLine': { it: 'Da: {name}', ro: 'De la: {name}', en: 'From: {name}' },
    'comm.noRecipients': { it: 'Nessun destinatario registrato su questo invio.', ro: 'Niciun destinatar înregistrat la această trimitere.', en: 'No recipient recorded on this send.' },
    'comm.confirmed': { it: 'Confermato', ro: 'Confirmat', en: 'Confirmed' },
    'comm.waiting': { it: 'In attesa', ro: 'În așteptare', en: 'Waiting' },
    'comm.whoConfirmed': { it: 'Chi ha confermato', ro: 'Cine a confirmat', en: 'Who confirmed' },
    'comm.pendingBadge': { it: '⏳ {n} in attesa', ro: '⏳ {n} în așteptare', en: '⏳ {n} waiting' },
    'comm.receiptsTitle': { it: 'Conferme ricezione', ro: 'Confirmări de primire', en: 'Receipt confirmations' },
    'comm.already': { it: 'Hai già confermato questa comunicazione.', ro: 'Ai confirmat deja această comunicare.', en: 'You already confirmed this message.' },
    'comm.confirmSent': { it: 'Conferma inviata al caposquadra.', ro: 'Confirmarea a fost trimisă șefului de echipă.', en: 'Confirmation sent to the team leader.' },
    'comm.confirmError': { it: 'Errore conferma: {message}', ro: 'Eroare la confirmare: {message}', en: 'Confirmation error: {message}' },
    'comm.session': { it: 'Sessione non pronta.', ro: 'Sesiunea nu este gata.', en: 'Session not ready.' },
    'comm.needWorkMessage': { it: 'Seleziona lavoro e inserisci un messaggio.', ro: 'Alege lucrarea și scrie un mesaj.', en: 'Select a job and enter a message.' },
    'comm.sentCount': { it: 'Comunicazione inviata a {n} operai.', ro: 'Comunicare trimisă la {n} muncitori.', en: 'Message sent to {n} workers.' },
    'comm.sendError': { it: 'Errore invio: {message}', ro: 'Eroare la trimitere: {message}', en: 'Send error: {message}' },
    'ore.workFallback': { it: 'Lavoro', ro: 'Lucrare', en: 'Job' },
    'ore.dayTitle': { it: 'Le tue ore del {giorno}', ro: 'Orele tale din {giorno}', en: 'Your hours on {giorno}' },
    'ore.dayEmpty': { it: 'Nessuna ora segnata in questo giorno.', ro: 'Nicio oră notată în această zi.', en: 'No hours logged on this day.' },
    'ore.dayTotal': { it: 'Totale del giorno: {ore}', ro: 'Total zi: {ore}', en: 'Day total: {ore}' },
    'ore.loadingDay': { it: 'Caricamento ore del giorno...', ro: 'Se încarcă orele zilei...', en: 'Loading the day hours...' },
    'ore.boxUnavailable': { it: 'Le tue ore del {giorno}: non disponibili ora.', ro: 'Orele tale din {giorno}: indisponibile acum.', en: 'Your hours on {giorno}: not available now.' },
    'ore.boxReread': { it: 'Non riesco a rileggere le ore. Mostro di nuovo il riepilogo di prima.', ro: 'Nu pot reciti orele. Arăt din nou rezumatul de dinainte.', en: 'Cannot read the hours again. Showing the previous summary.' },
    'ore.deleteConfirm': { it: 'Eliminare questa ora?', ro: 'Ștergi această oră?', en: 'Delete this hours entry?' },
    'ore.deleted': { it: 'Ora eliminata', ro: 'Oră ștearsă', en: 'Hours entry deleted' },
    'ore.deleteError': { it: 'Errore eliminazione', ro: 'Eroare la ștergere', en: 'Delete error' },
    'ore.needWork': { it: 'Seleziona prima un lavoro.', ro: 'Alege mai întâi o lucrare.', en: 'Select a job first.' },
    'ore.needDate': { it: 'Inserisci la data del lavoro.', ro: 'Introdu data lucrării.', en: 'Enter the work date.' },
    'ore.needTimes': { it: 'Inserisci orario inizio e fine.', ro: 'Introdu ora de început și de sfârșit.', en: 'Enter start and end time.' },
    'ore.needPositive': { it: 'Le ore nette devono essere maggiori di 0.', ro: 'Orele nete trebuie să fie mai mari de 0.', en: 'Net hours must be greater than 0.' },
    'ore.notSelectable': { it: 'Questo lavoro non è selezionabile per le ore.', ro: 'Această lucrare nu poate fi aleasă pentru ore.', en: 'This job cannot be selected for hours.' },
    'ore.saving': { it: 'Salvataggio…', ro: 'Se salvează…', en: 'Saving…' },
    'ore.saved': { it: 'Ore salvate: {ore}. Puoi registrare un altro turno.', ro: 'Ore salvate: {ore}. Poți înregistra o altă tură.', en: 'Hours saved: {ore}. You can log another shift.' },
    'ore.updated': { it: 'Ora aggiornata', ro: 'Oră actualizată', en: 'Hours entry updated' },
    'ore.saveError': { it: 'Errore salvataggio: {message}', ro: 'Eroare la salvare: {message}', en: 'Save error: {message}' },
    'ore.saveEdit': { it: 'Salva modifiche', ro: 'Salvează modificările', en: 'Save changes' },
    'ore.overlapFallback': { it: 'Queste ore si sovrappongono a un altro turno.', ro: 'Aceste ore se suprapun cu o altă tură.', en: 'These hours overlap another shift.' },
    'ore.editRow': { it: 'Modifica quella riga', ro: 'Modifică acel rând', en: 'Edit that row' },
    'ore.detailTitle': { it: '📌 Dettaglio lavoro operativo', ro: '📌 Detaliu lucrare', en: '📌 Job detail' },
    'ore.detailSub': { it: 'Ordini manager, stato tabella di marcia, traccia zone e sospensione lavoro.', ro: 'Ordine de la manager, starea tabelului de marș, urmărirea zonelor și suspendarea lucrării.', en: 'Manager orders, schedule-table status, zone tracking and job suspension.' },
    'stats.fail': { it: 'Non riesco a caricare le statistiche. Riprova.', ro: 'Nu pot încărca statisticile. Încearcă din nou.', en: 'Cannot load the statistics. Try again.' },
    'stats.loading': { it: 'Carico le tue ore…', ro: 'Încarc orele tale…', en: 'Loading your hours…' },
    'status.loading': { it: 'Caricamento workspace mobile...', ro: 'Se încarcă spațiul de lucru...', en: 'Loading the mobile workspace...' },
    'status.ready': { it: 'Workspace mobile attivo.', ro: 'Spațiul de lucru este activ.', en: 'Mobile workspace is active.' },
    'status.openError': { it: 'Non riesco ad aprire la tua area. Riprova', ro: 'Nu pot deschide zona ta. Încearcă din nou', en: 'Cannot open your area. Try again' },
    'status.refreshing': { it: 'Aggiornamento dati...', ro: 'Se actualizează datele...', en: 'Refreshing data...' },
    'status.refreshed': { it: 'Dati aggiornati.', ro: 'Date actualizate.', en: 'Data updated.' },
    'status.refreshError': { it: 'Errore aggiornamento dati.', ro: 'Eroare la actualizarea datelor.', en: 'Error refreshing data.' },
    'status.logoutError': { it: 'Errore durante il logout', ro: 'Eroare la ieșire', en: 'Error while logging out' },
    'status.tenantError': { it: 'Errore durante il cambio azienda. Riprova.', ro: 'Eroare la schimbarea firmei. Încearcă din nou.', en: 'Error while switching company. Try again.' },
    'contact.close': { it: 'Chiudi', ro: 'Închide', en: 'Close' },
    'contact.call': { it: 'Chiama', ro: 'Sună', en: 'Call' },
    'contact.callLabel': { it: '📞 Chiama', ro: '📞 Sună', en: '📞 Call' },
    'contact.mailTitle': { it: 'Email', ro: 'Email', en: 'Email' },
    'contact.mailAria': { it: 'Invia email', ro: 'Trimite email', en: 'Send email' },
    'contact.mailLabel': { it: '✉️ Email', ro: '✉️ Email', en: '✉️ Email' },
    'pieno.loading': { it: 'Caricamento...', ro: 'Se încarcă...', en: 'Loading...' },
    'pieno.none': { it: 'Nessun carburante in anagrafica', ro: 'Niciun carburant în evidență', en: 'No fuel in the records' },
    'pieno.choose': { it: 'Scegli il carburante', ro: 'Alege carburantul', en: 'Choose the fuel' },
    'pieno.vehicle': { it: 'Mezzo: {name}', ro: 'Utilaj: {name}', en: 'Vehicle: {name}' },
    'pieno.vehicleFallback': { it: 'Mezzo del lavoro', ro: 'Utilajul lucrării', en: 'Job vehicle' },
    'pieno.noVehicle': { it: 'Questo lavoro non ha un mezzo da rifornire.', ro: 'Această lucrare nu are un utilaj de alimentat.', en: 'This job has no vehicle to refuel.' },
    'pieno.needFields': { it: 'Scegli il carburante e indica i litri.', ro: 'Alege carburantul și indică litrii.', en: 'Choose the fuel and enter the litres.' },
    'pieno.saving': { it: 'Registro il pieno...', ro: 'Înregistrez alimentarea...', en: 'Saving the refuel...' },
    'pieno.saved': { it: 'Pieno registrato. La cisterna è aggiornata.', ro: 'Alimentare înregistrată. Rezervorul este actualizat.', en: 'Refuel saved. The tank is updated.' },
    'pieno.saveError': { it: 'Errore registrazione pieno.', ro: 'Eroare la înregistrarea alimentării.', en: 'Error saving the refuel.' }
};
