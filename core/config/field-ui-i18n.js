/**
 * Catalogo cornice del workspace campo (solo it, ro, en, sq).
 * BOZZA RO/EN/SQ: da rivedere da un madrelingua.
 * Nessuna dipendenza. Step 1: testi fissi. Step 2: status, elenchi e form dinamici.
 * @module core/config/field-ui-i18n
 */

export const FIELD_UI_LANG_OPTIONS = [
    { code: 'it', flag: '🇮🇹', name: 'Italiano' },
    { code: 'ro', flag: '🇷🇴', name: 'Română' },
    { code: 'en', flag: '🇬🇧', name: 'English' },
    { code: 'sq', flag: '🇦🇱', name: 'Shqip' }
];

export const FIELD_UI_LANGS = FIELD_UI_LANG_OPTIONS.map((voce) => voce.code);

/** @type {Record<string, { it: string, ro: string, en: string, sq: string }>} */
export const FIELD_UI_STRINGS = {
    'page.title': {
        it: 'Versione mobile — GFV',
        ro: 'Versiune mobilă — GFV',
        en: 'Mobile version — GFV'
    , sq: 'Versioni celular — GFV'},
    'menu.options': {
        it: 'Opzioni',
        ro: 'Opțiuni',
        en: 'Options'
    , sq: 'Opsionet'},
    'menu.preparing': {
        it: 'Sto preparando il workspace…',
        ro: 'Pregătesc spațiul de lucru…',
        en: 'Preparing the workspace…'
    , sq: 'Po përgatis hapësirën e punës…'},
    'menu.guide': {
        it: 'Guida Manodopera',
        ro: 'Ghid Manoperă',
        en: 'Workforce guide'
    , sq: 'Udhëzuesi Manodopera'},
    'menu.validation': {
        it: 'Validazione ore (schermo intero)',
        ro: 'Validare ore (ecran complet)',
        en: 'Validate hours (full screen)'
    , sq: 'Vlerësimi i orëve (ekran i plotë)'},
    'menu.fault': {
        it: 'Segnala guasto',
        ro: 'Semnalează defecțiunea',
        en: 'Report a fault'
    , sq: 'Njoftoni defektin'},
    'menu.account': {
        it: 'Impostazioni account',
        ro: 'Setări cont',
        en: 'Account settings'
    , sq: 'Cilësimet e llogarisë'},
    'menu.switchTenant': {
        it: 'Cambia azienda',
        ro: 'Schimbă firma',
        en: 'Switch company'
    , sq: 'Ndryshoni kompaninë'},
    'menu.logout': {
        it: 'Esci',
        ro: 'Ieșire',
        en: 'Log out'
    , sq: 'Dilni'},
    'menu.lingua': {
        it: 'Lingua',
        ro: 'Limbă',
        en: 'Language',
        sq: 'Gjuha'
    },
    'lang.choose': {
        it: 'Scegli la lingua',
        ro: 'Alege limba',
        en: 'Choose the language',
        sq: 'Zgjidhni gjuhën'
    },
    'lang.close': {
        it: 'Chiudi',
        ro: 'Închide',
        en: 'Close',
        sq: 'Mbyllni'
    },
    'nav.back': {
        it: 'Indietro',
        ro: 'Înapoi',
        en: 'Back'
    , sq: 'Mbrapa'},
    'nav.next': {
        it: 'Avanti',
        ro: 'Înainte',
        en: 'Next'
    , sq: 'Para'},
    'nav.done': {
        it: 'Fine',
        ro: 'Gata',
        en: 'Done'
    , sq: 'Fund'},
    'slide.lavoro.title': {
        it: 'Seleziona lavoro',
        ro: 'Alege lucrarea',
        en: 'Select job'
    , sq: 'Zgjidhni punën'},
    'slide.lavoro.sub': {
        it: 'Scegli il lavoro corrente, poi scorri a sinistra per il flusso operativo.',
        ro: 'Alege lucrarea curentă, apoi glisează la stânga pentru fluxul de lucru.',
        en: 'Choose the current job, then swipe left for the work flow.'
    , sq: 'Zgjidhni punën e tanishme, pastaj rrëshqitni majtas për rrjedhën e punës.'},
    'slide.commIn.title': {
        it: '📣 Comunicazioni',
        ro: '📣 Comunicări',
        en: '📣 Communications'
    , sq: '📣 Njoftimet'},
    'slide.commIn.sub': {
        it: 'Messaggi dal caposquadra per il tuo turno.',
        ro: 'Mesaje de la șeful de echipă pentru tura ta.',
        en: 'Messages from the team leader for your shift.'
    , sq: 'Mesazhe nga kryepunëtori për turnin tuaj.'},
    'slide.commOut.title': {
        it: '📣 Comunicazioni squadra',
        ro: '📣 Comunicări echipă',
        en: '📣 Team communications'
    , sq: '📣 Njoftimet e ekipit'},
    'slide.commOut.sub': {
        it: 'Messaggio operativo rapido alla squadra.',
        ro: 'Mesaj rapid de lucru către echipă.',
        en: 'Quick work message to the team.'
    , sq: 'Mesazh i shpejtë pune për ekipin.'},
    'slide.valida.title': {
        it: '✅ Valida ore',
        ro: '✅ Validează orele',
        en: '✅ Validate hours'
    , sq: '✅ Vlerësoni orët'},
    'slide.valida.sub': {
        it: 'Approva o rifiuta le ore segnate dagli operai della squadra.',
        ro: 'Aprobă sau respinge orele notate de muncitorii din echipă.',
        en: 'Approve or reject the hours logged by the team workers.'
    , sq: 'Miratoni ose refuzoni orët e shënuara nga punëtorët e ekipit.'},
    'slide.ore.title': {
        it: '⏱️ Segna ore',
        ro: '⏱️ Notează orele',
        en: '⏱️ Log hours'
    , sq: '⏱️ Shënoni orët'},
    'slide.ore.sub': {
        it: 'Le ore vengono calcolate automaticamente dagli orari impostati.',
        ro: 'Orele se calculează automat din orarele setate.',
        en: 'Hours are calculated automatically from the times you set.'
    , sq: 'Orët llogariten vetë nga oraret që vendosni.'},
    'slide.stats.title': {
        it: '📊 Statistiche',
        ro: '📊 Statistici',
        en: '📊 Statistics'
    , sq: '📊 Statistikat'},
    'slide.stats.sub': {
        it: 'Le tue ore e la ripartizione sui tipi di lavoro (solo account manodopera).',
        ro: 'Orele tale și împărțirea pe tipuri de lucrare (doar cont manoperă).',
        en: 'Your hours and the split by job type (workforce account only).'
    , sq: 'Orët tuaja dhe ndarja sipas llojit të punës (vetëm llogaria manodopera).'},
    'lavoro.assigned': {
        it: 'Lavori assegnati',
        ro: 'Lucrări atribuite',
        en: 'Assigned jobs'
    , sq: 'Punët e caktuara'},
    'pieno.title': {
        it: '⛽ Pieno',
        ro: '⛽ Alimentare',
        en: '⛽ Refuel'
    , sq: '⛽ Mbushja'},
    'pieno.sub': {
        it: 'Segna i litri prima di partire. Vale per il mezzo di questo lavoro, non per una lavorazione a mano.',
        ro: 'Notează litrii înainte de plecare. Este pentru utilajul acestei lucrări, nu pentru o lucrare de mână.',
        en: 'Log the litres before you leave. It applies to this job\'s vehicle, not to hand work.'
    , sq: 'Shënoni litrat para se të nisni. Vlen për mjetin e kësaj pune, jo për një punë me dorë.'},
    'pieno.fuel': {
        it: 'Carburante',
        ro: 'Carburant',
        en: 'Fuel'
    , sq: 'Karburanti'},
    'pieno.liters': {
        it: 'Litri',
        ro: 'Litri',
        en: 'Litres'
    , sq: 'Litra'},
    'pieno.submit': {
        it: 'Registra pieno',
        ro: 'Înregistrează alimentarea',
        en: 'Save refuel'
    , sq: 'Regjistroni mbushjen'},
    'assenza.title': {
        it: '🚫 Segnala assenza',
        ro: '🚫 Semnalează absența',
        en: '🚫 Report absence'
    , sq: '🚫 Njoftoni mungesën'},
    'assenza.sub': {
        it: 'Avvisa il manager: il lavoro passa in standby dopo la conferma.',
        ro: 'Anunță managerul: lucrarea trece în standby după confirmare.',
        en: 'Tell the manager: the job goes on standby after confirmation.'
    , sq: 'Lajmëroni menaxherin: puna kalon në standby pas konfirmimit.'},
    'assenza.worker': {
        it: 'Operaio',
        ro: 'Muncitor',
        en: 'Worker'
    , sq: 'Punëtor'},
    'assenza.type': {
        it: 'Tipo',
        ro: 'Tip',
        en: 'Type'
    , sq: 'Lloji'},
    'assenza.day': {
        it: 'Giorno',
        ro: 'Zi',
        en: 'Day'
    , sq: 'Dita'},
    'assenza.note': {
        it: 'Nota',
        ro: 'Notă',
        en: 'Note'
    , sq: 'Shënim'},
    'assenza.placeholder': {
        it: 'Es. febbre',
        ro: 'Ex. febră',
        en: 'E.g. fever'
    , sq: 'P.sh. ethe'},
    'assenza.submit': {
        it: 'Invia segnalazione',
        ro: 'Trimite sesizarea',
        en: 'Send report'
    , sq: 'Dërgoni njoftimin'},
    'comm.work': {
        it: 'Lavoro',
        ro: 'Lucrare',
        en: 'Job'
    , sq: 'Puna'},
    'comm.date': {
        it: 'Data',
        ro: 'Data',
        en: 'Date'
    , sq: 'Data'},
    'comm.time': {
        it: 'Orario',
        ro: 'Ora',
        en: 'Time'
    , sq: 'Orari'},
    'comm.message': {
        it: 'Messaggio',
        ro: 'Mesaj',
        en: 'Message'
    , sq: 'Mesazhi'},
    'comm.placeholder': {
        it: 'Es. iniziamo dal lato nord, priorità al filare 4',
        ro: 'Ex. începem din partea de nord, prioritate rândul 4',
        en: 'E.g. we start on the north side, row 4 first'
    , sq: 'P.sh. nisim nga ana e veriut, përparësi rreshti 4'},
    'comm.submit': {
        it: 'Invia comunicazione',
        ro: 'Trimite comunicarea',
        en: 'Send message'
    , sq: 'Dërgoni njoftimin'},
    'ore.date': {
        it: 'Data lavoro',
        ro: 'Data lucrării',
        en: 'Work date'
    , sq: 'Data e punës'},
    'ore.start': {
        it: 'Orario inizio',
        ro: 'Ora de început',
        en: 'Start time'
    , sq: 'Ora e fillimit'},
    'ore.end': {
        it: 'Orario fine',
        ro: 'Ora de sfârșit',
        en: 'End time'
    , sq: 'Ora e mbarimit'},
    'ore.break': {
        it: 'Pausa (minuti)',
        ro: 'Pauză (minute)',
        en: 'Break (minutes)'
    , sq: 'Pushim (minuta)'},
    'ore.net': {
        it: 'Ore nette calcolate',
        ro: 'Ore nete calculate',
        en: 'Net hours calculated'
    , sq: 'Orët neto të llogaritura'},
    'ore.note': {
        it: 'Note (opzionale)',
        ro: 'Note (opțional)',
        en: 'Notes (optional)'
    , sq: 'Shënime (opsionale)'},
    'ore.notePlaceholder': {
        it: 'Note turno',
        ro: 'Note tură',
        en: 'Shift notes'
    , sq: 'Shënime turni'},
    'ore.cancel': {
        it: 'Annulla modifica',
        ro: 'Anulează modificarea',
        en: 'Cancel edit'
    , sq: 'Anuloni ndryshimin'},
    'ore.submit': {
        it: 'Salva ore lavorate',
        ro: 'Salvează orele lucrate',
        en: 'Save hours worked'
    , sq: 'Ruani orët e punuara'},
    'ruolo.operaio': {
        it: 'Operaio',
        ro: 'Muncitor',
        en: 'Worker'
    , sq: 'Punëtor'},
    'ruolo.caposquadra': {
        it: 'Caposquadra',
        ro: 'Șef de echipă',
        en: 'Team leader'
    , sq: 'Kryepunëtor'},
    'ruolo.manager': {
        it: 'Manager',
        ro: 'Manager',
        en: 'Manager'
    , sq: 'Manager'},
    'ruolo.amministratore': {
        it: 'Amministratore',
        ro: 'Administrator',
        en: 'Administrator'
    , sq: 'Administrator'},
    'ruolo.account': {
        it: 'Account',
        ro: 'Cont',
        en: 'Account'
    , sq: 'Llogaria'},
    'ruolo.fieldUser': {
        it: 'Utente campo',
        ro: 'Utilizator de teren',
        en: 'Field user'
    , sq: 'Përdoruesi i fushës'},
    'lavoro.loading': { it: 'Caricamento lavori...', ro: 'Se încarcă lucrările...', en: 'Loading jobs...' , sq: 'Po ngarkohen punët...'},
    'lavoro.pick': { it: 'Seleziona lavoro', ro: 'Alege lucrarea', en: 'Select job' , sq: 'Zgjidhni punën'},
    'lavoro.loadError': { it: 'Non riesco a caricare i lavori. Riprova.', ro: 'Nu pot încărca lucrările. Încearcă din nou.', en: 'Cannot load the jobs. Try again.' , sq: 'Nuk i ngarkoj dot punët. Provoni përsëri.'},
    'lavoro.retry': { it: 'Riprova', ro: 'Încearcă din nou', en: 'Try again' , sq: 'Provoni përsëri'},
    'lavoro.gpsNone': { it: 'Nessun suggerimento GPS disponibile.', ro: 'Nicio sugestie GPS disponibilă.', en: 'No GPS suggestion available.' , sq: 'Nuk ka sugjerim GPS.'},
    'lavoro.gpsHint': { it: 'Suggerimento: {label} (proposta rapida, conferma manualmente).', ro: 'Sugestie: {label} (propunere rapidă, confirmă manual).', en: 'Suggestion: {label} (quick proposal, confirm by hand).' , sq: 'Sugjerim: {label} (propozim i shpejtë, konfirmoni me dorë).'},
    'lavoro.expand': { it: 'Ingrandisci', ro: 'Mărește', en: 'Enlarge' , sq: 'Zmadhoni'},
    'lavoro.shrink': { it: 'Riduci', ro: 'Micșorează', en: 'Reduce' , sq: 'Zvogëloni'},
    'lavoro.subActive': { it: 'Sostituzione attiva', ro: 'Înlocuire activă', en: 'Active substitution' , sq: 'Zëvendësim aktiv'},
    'lavoro.absentLine': { it: 'Assente: {name}', ro: 'Absent: {name}', en: 'Absent: {name}' , sq: 'Mungon: {name}'},
    'lavoro.substituteLine': { it: 'Sostituto: {name}', ro: 'Înlocuitor: {name}', en: 'Substitute: {name}' , sq: 'Zëvendësuesi: {name}'},
    'lavoro.subHint': { it: 'Valida le sue ore in «Valida ore» sotto; il sostituto le segna da Segna ore.', ro: 'Validează orele lui la «Validează orele» mai jos; înlocuitorul le notează la Notează orele.', en: 'Validate their hours under «Validate hours»; the substitute logs them in Log hours.' , sq: 'Vlerësoni orët e tij te «Vlerësoni orët» poshtë; zëvendësuesi i shënon te Shënoni orët.'},
    'lavoro.worksUpdated': { it: 'Elenco lavori aggiornato.', ro: 'Lista lucrărilor a fost actualizată.', en: 'Job list updated.' , sq: 'Lista e punëve u përditësua.'},
    'squad.title': { it: '👥 La mia squadra', ro: '👥 Echipa mea', en: '👥 My team' , sq: '👥 Ekipi im'},
    'squad.sub': { it: 'Tocca un nome per chiamare o inviare email.', ro: 'Atinge un nume ca să suni sau să trimiți email.', en: 'Tap a name to call or send email.' , sq: 'Prekni një emër për të telefonuar ose për të dërguar email.'},
    'squad.loading': { it: 'Caricamento squadra...', ro: 'Se încarcă echipa...', en: 'Loading team...' , sq: 'Po ngarkohet ekipi...'},
    'squad.none': { it: 'Nessuna squadra assegnata.', ro: 'Nicio echipă atribuită.', en: 'No team assigned.' , sq: 'Nuk ka ekip të caktuar.'},
    'squad.noWorkers': { it: 'Nessun operaio in squadra.', ro: 'Niciun muncitor în echipă.', en: 'No workers on the team.' , sq: 'Nuk ka punëtor në ekip.'},
    'squad.error': { it: 'Errore caricamento squadra.', ro: 'Eroare la încărcarea echipei.', en: 'Error loading the team.' , sq: 'Gabim në ngarkimin e ekipit.'},
    'squad.pick': { it: '-- Seleziona --', ro: '-- Alege --', en: '-- Select --' , sq: '-- Zgjidhni --'},
    'squad.pickWorker': { it: 'Seleziona un operaio.', ro: 'Alege un muncitor.', en: 'Select a worker.' , sq: 'Zgjidhni një punëtor.'},
    'squad.sending': { it: 'Invio...', ro: 'Se trimite...', en: 'Sending...' , sq: 'Po dërgohet...'},
    'squad.sent': { it: 'Segnalazione inviata al manager.', ro: 'Sesizarea a fost trimisă managerului.', en: 'Report sent to the manager.' , sq: 'Njoftimi iu dërgua menaxherit.'},
    'squad.sendError': { it: 'Errore invio segnalazione.', ro: 'Eroare la trimiterea sesizării.', en: 'Error sending the report.' , sq: 'Gabim në dërgimin e njoftimit.'},
    'squad.substituteTag': { it: '{name} (sostituto)', ro: '{name} (înlocuitor)', en: '{name} (substitute)' , sq: '{name} (zëvendësues)'},
    'squad.fallbackName': { it: 'Squadra', ro: 'Echipă', en: 'Team' , sq: 'Ekip'},
    'squad.many': { it: '{n} squadre · membri unici', ro: '{n} echipe · membri unici', en: '{n} teams · unique members' , sq: '{n} ekipe · anëtarë unikë'},
    'squad.withSubstitute': { it: '{label} · sostituto in campo', ro: '{label} · înlocuitor pe teren', en: '{label} · substitute in the field' , sq: '{label} · zëvendësues në fushë'},
    'squad.noContacts': { it: 'Contatti non disponibili in anagrafica.', ro: 'Contacte indisponibile în evidență.', en: 'Contacts not available in the records.' , sq: 'Kontaktet nuk janë në evidencë.'},
    'squad.ready': { it: 'Squadra pronta: il messaggio arriverà a {n} operai.', ro: 'Echipă gata: mesajul ajunge la {n} muncitori.', en: 'Team ready: the message will reach {n} workers.' , sq: 'Ekipi gati: mesazhi u arrin {n} punëtorëve.'},
    'squad.configure': { it: 'Nessun operaio in squadra: configura Gestione squadre prima di inviare.', ro: 'Niciun muncitor în echipă: configurează Gestiune echipe înainte să trimiți.', en: 'No workers on the team: set up Team management before sending.' , sq: 'Nuk ka punëtor në ekip: konfiguroni Menaxhimin e ekipeve para se të dërgoni.'},
    'squad.noneToNotify': { it: 'Nessun operaio in squadra da avvisare. In Gestione squadre assegna operai al tuo profilo caposquadra.', ro: 'Niciun muncitor de anunțat. În Gestiune echipe atribuie muncitori profilului tău de șef de echipă.', en: 'No workers to notify. In Team management assign workers to your team-leader profile.' , sq: 'Nuk ka punëtor në ekip për të lajmëruar. Te Menaxhimi i ekipeve caktoni punëtorë te profili juaj i kryepunëtorit.'},
    'assenza.sick': { it: 'Malattia', ro: 'Boală', en: 'Sick leave' , sq: 'Sëmundje'},
    'assenza.holiday': { it: 'Ferie', ro: 'Concediu', en: 'Holiday' , sq: 'Pushime'},
    'assenza.leave': { it: 'Permesso', ro: 'Învoire', en: 'Leave' , sq: 'Leje'},
    'assenza.other': { it: 'Altro', ro: 'Altele', en: 'Other' , sq: 'Tjetër'},
    'valida.inlineTitle': { it: '🕒 Valida ore', ro: '🕒 Validează orele', en: '🕒 Validate hours' , sq: '🕒 Vlerësoni orët'},
    'valida.inlineSub': { it: 'Conferma o rifiuta le ore in attesa per il lavoro selezionato.', ro: 'Confirmă sau respinge orele în așteptare pentru lucrarea aleasă.', en: 'Confirm or reject the pending hours for the selected job.' , sq: 'Konfirmoni ose refuzoni orët në pritje për punën e zgjedhur.'},
    'valida.pickWork': { it: 'Seleziona un lavoro per vedere le ore da validare.', ro: 'Alege o lucrare ca să vezi orele de validat.', en: 'Select a job to see the hours to validate.' , sq: 'Zgjidhni një punë që të shihni orët për vlerësim.'},
    'valida.none': { it: 'Nessuna ora in attesa di validazione.', ro: 'Nicio oră în așteptarea validării.', en: 'No hours waiting for validation.' , sq: 'Nuk ka orë në pritje të vlerësimit.'},
    'valida.loading': { it: 'Caricamento ore da validare...', ro: 'Se încarcă orele de validat...', en: 'Loading hours to validate...' , sq: 'Po ngarkohen orët për vlerësim...'},
    'valida.error': { it: 'Errore caricamento ore da validare.', ro: 'Eroare la încărcarea orelor de validat.', en: 'Error loading hours to validate.' , sq: 'Gabim në ngarkimin e orëve për vlerësim.'},
    'valida.waitingTitle': { it: '🕒 In attesa di validazione', ro: '🕒 În așteptarea validării', en: '🕒 Waiting for validation' , sq: '🕒 Në pritje të vlerësimit'},
    'valida.waitingSub': { it: 'Tutti i tuoi lavori di squadra. Per filtri avanzati apri la validazione completa.', ro: 'Toate lucrările tale de echipă. Pentru filtre avansate deschide validarea completă.', en: 'All your team jobs. For advanced filters open the full validation.' , sq: 'Të gjitha punët tuaja të ekipit. Për filtra të hollë hapni vlerësimin e plotë.'},
    'valida.refresh': { it: 'Aggiorna elenco', ro: 'Actualizează lista', en: 'Refresh list' , sq: 'Rifreskoni listën'},
    'valida.openFull': { it: 'Apri validazione completa', ro: 'Deschide validarea completă', en: 'Open full validation' , sq: 'Hapni vlerësimin e plotë'},
    'valida.approve': { it: '✅ Approva', ro: '✅ Aprobă', en: '✅ Approve' , sq: '✅ Miratoni'},
    'valida.reject': { it: '❌ Rifiuta', ro: '❌ Respinge', en: '❌ Reject' , sq: '❌ Refuzoni'},
    'valida.dateMissing': { it: 'Data non indicata', ro: 'Dată neindicată', en: 'Date not set' , sq: 'Data nuk është vënë'},
    'valida.pauseMin': { it: 'pausa {n} min', ro: 'pauză {n} min', en: 'break {n} min' , sq: 'pushim {n} min'},
    'valida.machineLine': { it: 'Macchina: {name}', ro: 'Utilaj: {name}', en: 'Machine: {name}' , sq: 'Makina: {name}'},
    'valida.withMachine': { it: 'Con macchina', ro: 'Cu utilaj', en: 'With a machine' , sq: 'Me makinë'},
    'valida.overlap': { it: '⚠️ Si sovrappone a {start}–{end}', ro: '⚠️ Se suprapune cu {start}–{end}', en: '⚠️ Overlaps {start}–{end}' , sq: '⚠️ Mbivendoset me {start}–{end}'},
    'valida.overlapWork': { it: '⚠️ Si sovrappone a {start}–{end} ({work})', ro: '⚠️ Se suprapune cu {start}–{end} ({work})', en: '⚠️ Overlaps {start}–{end} ({work})' , sq: '⚠️ Mbivendoset me {start}–{end} ({work})'},
    'valida.reasonRequired': { it: 'Motivo rifiuto obbligatorio', ro: 'Motivul respingerii este obligatoriu', en: 'Rejection reason is required' , sq: 'Arsyeja e refuzimit është e detyrueshme'},
    'valida.reasonPrompt': { it: 'Motivo del rifiuto (obbligatorio):', ro: 'Motivul respingerii (obligatoriu):', en: 'Rejection reason (required):' , sq: 'Arsyeja e refuzimit (e detyrueshme):'},
    'valida.reasonAlert': { it: 'Scrivi il motivo: è obbligatorio.', ro: 'Scrie motivul: este obligatoriu.', en: 'Write the reason: it is required.' , sq: 'Shkruani arsyen: është e detyrueshme.'},
    'valida.rejected': { it: 'Ora rifiutata', ro: 'Oră respinsă', en: 'Hours rejected' , sq: 'Ora u refuzua'},
    'valida.updateError': { it: 'Errore aggiornamento ore', ro: 'Eroare la actualizarea orelor', en: 'Error updating hours' , sq: 'Gabim në përditësimin e orëve'},
    'comm.inboxTitle': { it: '📬 Messaggi dal caposquadra', ro: '📬 Mesaje de la șeful de echipă', en: '📬 Messages from the team leader' , sq: '📬 Mesazhe nga kryepunëtori'},
    'comm.inboxSub': { it: 'Da confermare e già letti, dal più recente.', ro: 'De confirmat și deja citite, de la cel mai recent.', en: 'To confirm and already read, newest first.' , sq: 'Për konfirmim dhe të lexuara, nga më i riu.'},
    'comm.loading': { it: 'Caricamento comunicazioni...', ro: 'Se încarcă comunicările...', en: 'Loading messages...' , sq: 'Po ngarkohen njoftimet...'},
    'comm.onlyConfirmed': { it: 'Solo messaggi già confermati', ro: 'Doar mesaje deja confirmate', en: 'Only messages already confirmed' , sq: 'Vetëm mesazhet e konfirmuara'},
    'comm.highlightTitle': { it: '📨 In evidenza', ro: '📨 În evidență', en: '📨 In focus' , sq: '📨 Në pah'},
    'comm.highlightSub': { it: 'Invii con conferme in attesa o recenti.', ro: 'Trimiteri cu confirmări în așteptare sau recente.', en: 'Sends with pending or recent confirmations.' , sq: 'Dërgesa me konfirmime në pritje ose të fundit.'},
    'comm.noneSent': { it: 'Nessuna comunicazione inviata.', ro: 'Nicio comunicare trimisă.', en: 'No message sent.' , sq: 'Nuk është dërguar asnjë njoftim.'},
    'comm.previous': { it: 'Vedi comunicazioni precedenti', ro: 'Vezi comunicările anterioare', en: 'See earlier messages' , sq: 'Shihni njoftimet e mëparshme'},
    'comm.previousCount': { it: 'Vedi comunicazioni precedenti ({count})', ro: 'Vezi comunicările anterioare ({count})', en: 'See earlier messages ({count})' , sq: 'Shihni njoftimet e mëparshme ({count})'},
    'comm.hidePrevious': { it: 'Nascondi comunicazioni precedenti', ro: 'Ascunde comunicările anterioare', en: 'Hide earlier messages' , sq: 'Fshihni njoftimet e mëparshme'},
    'comm.loadingSent': { it: 'Caricamento comunicazioni inviate...', ro: 'Se încarcă comunicările trimise...', en: 'Loading sent messages...' , sq: 'Po ngarkohen njoftimet e dërguara...'},
    'comm.noneHighlight': { it: 'Nessun invio in evidenza.', ro: 'Nicio trimitere în evidență.', en: 'Nothing in focus.' , sq: 'Asnjë dërgesë në pah.'},
    'comm.loadError': { it: 'Errore caricamento comunicazioni.', ro: 'Eroare la încărcarea comunicărilor.', en: 'Error loading messages.' , sq: 'Gabim në ngarkimin e njoftimeve.'},
    'comm.noneRecent': { it: 'Nessuna comunicazione dal caposquadra negli ultimi 60 giorni.', ro: 'Nicio comunicare de la șeful de echipă în ultimele 60 de zile.', en: 'No message from the team leader in the last 60 days.' , sq: 'Asnjë njoftim nga kryepunëtori në 60 ditët e fundit.'},
    'comm.confirmedBadge': { it: '✅ Confermato', ro: '✅ Confirmat', en: '✅ Confirmed' , sq: '✅ Konfirmuar'},
    'comm.confirmBtn': { it: 'Conferma ricezione', ro: 'Confirmă primirea', en: 'Confirm receipt' , sq: 'Konfirmoni marrjen'},
    'comm.fromLine': { it: 'Da: {name}', ro: 'De la: {name}', en: 'From: {name}' , sq: 'Nga: {name}'},
    'comm.noRecipients': { it: 'Nessun destinatario registrato su questo invio.', ro: 'Niciun destinatar înregistrat la această trimitere.', en: 'No recipient recorded on this send.' , sq: 'Asnjë marrës i regjistruar në këtë dërgesë.'},
    'comm.confirmed': { it: 'Confermato', ro: 'Confirmat', en: 'Confirmed' , sq: 'Konfirmuar'},
    'comm.waiting': { it: 'In attesa', ro: 'În așteptare', en: 'Waiting' , sq: 'Në pritje'},
    'comm.whoConfirmed': { it: 'Chi ha confermato', ro: 'Cine a confirmat', en: 'Who confirmed' , sq: 'Kush ka konfirmuar'},
    'comm.pendingBadge': { it: '⏳ {n} in attesa', ro: '⏳ {n} în așteptare', en: '⏳ {n} waiting' , sq: '⏳ {n} në pritje'},
    'comm.receiptsTitle': { it: 'Conferme ricezione', ro: 'Confirmări de primire', en: 'Receipt confirmations' , sq: 'Konfirmimet e marrjes'},
    'comm.already': { it: 'Hai già confermato questa comunicazione.', ro: 'Ai confirmat deja această comunicare.', en: 'You already confirmed this message.' , sq: 'E keni konfirmuar tashmë këtë njoftim.'},
    'comm.confirmSent': { it: 'Conferma inviata al caposquadra.', ro: 'Confirmarea a fost trimisă șefului de echipă.', en: 'Confirmation sent to the team leader.' , sq: 'Konfirmimi iu dërgua kryepunëtorit.'},
    'comm.confirmError': { it: 'Errore conferma: {message}', ro: 'Eroare la confirmare: {message}', en: 'Confirmation error: {message}' , sq: 'Gabim konfirmimi: {message}'},
    'comm.session': { it: 'Sessione non pronta.', ro: 'Sesiunea nu este gata.', en: 'Session not ready.' , sq: 'Seanca nuk është gati.'},
    'comm.needWorkMessage': { it: 'Seleziona lavoro e inserisci un messaggio.', ro: 'Alege lucrarea și scrie un mesaj.', en: 'Select a job and enter a message.' , sq: 'Zgjidhni punën dhe shkruani një mesazh.'},
    'comm.sentCount': { it: 'Comunicazione inviata a {n} operai.', ro: 'Comunicare trimisă la {n} muncitori.', en: 'Message sent to {n} workers.' , sq: 'Njoftimi iu dërgua {n} punëtorëve.'},
    'comm.sendError': { it: 'Errore invio: {message}', ro: 'Eroare la trimitere: {message}', en: 'Send error: {message}' , sq: 'Gabim dërgimi: {message}'},
    'ore.workFallback': { it: 'Lavoro', ro: 'Lucrare', en: 'Job' , sq: 'Puna'},
    'ore.dayTitle': { it: 'Le tue ore del {giorno}', ro: 'Orele tale din {giorno}', en: 'Your hours on {giorno}' , sq: 'Orët tuaja të {giorno}'},
    'ore.dayEmpty': { it: 'Nessuna ora segnata in questo giorno.', ro: 'Nicio oră notată în această zi.', en: 'No hours logged on this day.' , sq: 'Asnjë orë e shënuar në këtë ditë.'},
    'ore.dayTotal': { it: 'Totale del giorno: {ore}', ro: 'Total zi: {ore}', en: 'Day total: {ore}' , sq: 'Totali i ditës: {ore}'},
    'ore.loadingDay': { it: 'Caricamento ore del giorno...', ro: 'Se încarcă orele zilei...', en: 'Loading the day hours...' , sq: 'Po ngarkohen orët e ditës...'},
    'ore.boxUnavailable': { it: 'Le tue ore del {giorno}: non disponibili ora.', ro: 'Orele tale din {giorno}: indisponibile acum.', en: 'Your hours on {giorno}: not available now.' , sq: 'Orët tuaja të {giorno}: nuk janë gati tani.'},
    'ore.boxReread': { it: 'Non riesco a rileggere le ore. Mostro di nuovo il riepilogo di prima.', ro: 'Nu pot reciti orele. Arăt din nou rezumatul de dinainte.', en: 'Cannot read the hours again. Showing the previous summary.' , sq: 'Nuk i rilexoj dot orët. Po e tregoj përsëri përmbledhjen e mëparshme.'},
    'ore.deleteConfirm': { it: 'Eliminare questa ora?', ro: 'Ștergi această oră?', en: 'Delete this hours entry?' , sq: 'Ta fshini këtë orë?'},
    'ore.deleted': { it: 'Ora eliminata', ro: 'Oră ștearsă', en: 'Hours entry deleted' , sq: 'Ora u fshi'},
    'ore.deleteError': { it: 'Errore eliminazione', ro: 'Eroare la ștergere', en: 'Delete error' , sq: 'Gabim në fshirje'},
    'ore.needWork': { it: 'Seleziona prima un lavoro.', ro: 'Alege mai întâi o lucrare.', en: 'Select a job first.' , sq: 'Zgjidhni së pari një punë.'},
    'ore.needDate': { it: 'Inserisci la data del lavoro.', ro: 'Introdu data lucrării.', en: 'Enter the work date.' , sq: 'Vendosni datën e punës.'},
    'ore.needTimes': { it: 'Inserisci orario inizio e fine.', ro: 'Introdu ora de început și de sfârșit.', en: 'Enter start and end time.' , sq: 'Vendosni orën e fillimit dhe të mbarimit.'},
    'ore.needPositive': { it: 'Le ore nette devono essere maggiori di 0.', ro: 'Orele nete trebuie să fie mai mari de 0.', en: 'Net hours must be greater than 0.' , sq: 'Orët neto duhet të jenë më shumë se 0.'},
    'ore.notSelectable': { it: 'Questo lavoro non è selezionabile per le ore.', ro: 'Această lucrare nu poate fi aleasă pentru ore.', en: 'This job cannot be selected for hours.' , sq: 'Kjo punë nuk zgjidhet për orët.'},
    'ore.saving': { it: 'Salvataggio…', ro: 'Se salvează…', en: 'Saving…' , sq: 'Po ruhet…'},
    'ore.saved': { it: 'Ore salvate: {ore}. Puoi registrare un altro turno.', ro: 'Ore salvate: {ore}. Poți înregistra o altă tură.', en: 'Hours saved: {ore}. You can log another shift.' , sq: 'Orët u ruajtën: {ore}. Mund të regjistroni një turn tjetër.'},
    'ore.updated': { it: 'Ora aggiornata', ro: 'Oră actualizată', en: 'Hours entry updated' , sq: 'Ora u përditësua'},
    'ore.saveError': { it: 'Errore salvataggio: {message}', ro: 'Eroare la salvare: {message}', en: 'Save error: {message}' , sq: 'Gabim ruajtjeje: {message}'},
    'ore.saveEdit': { it: 'Salva modifiche', ro: 'Salvează modificările', en: 'Save changes' , sq: 'Ruani ndryshimet'},
    'ore.overlapFallback': { it: 'Queste ore si sovrappongono a un altro turno.', ro: 'Aceste ore se suprapun cu o altă tură.', en: 'These hours overlap another shift.' , sq: 'Këto orë mbivendosen me një turn tjetër.'},
    'ore.editRow': { it: 'Modifica quella riga', ro: 'Modifică acel rând', en: 'Edit that row' , sq: 'Ndryshoni atë rresht'},
    'ore.detailTitle': { it: '📌 Dettaglio lavoro operativo', ro: '📌 Detaliu lucrare', en: '📌 Job detail' , sq: '📌 Hollësi e punës'},
    'ore.detailSub': { it: 'Ordini manager, stato tabella di marcia, traccia zone e sospensione lavoro.', ro: 'Ordine de la manager, starea tabelului de marș, urmărirea zonelor și suspendarea lucrării.', en: 'Manager orders, schedule-table status, zone tracking and job suspension.' , sq: 'Urdhra të menaxherit, gjendja tabella di marcia, gjurmimi i zonave dhe pezullimi i punës.'},
    'stats.fail': { it: 'Non riesco a caricare le statistiche. Riprova.', ro: 'Nu pot încărca statisticile. Încearcă din nou.', en: 'Cannot load the statistics. Try again.' , sq: 'Nuk i ngarkoj dot statistikat. Provoni përsëri.'},
    'stats.loading': { it: 'Carico le tue ore…', ro: 'Încarc orele tale…', en: 'Loading your hours…' , sq: 'Po ngarkoj orët tuaja…'},
    'status.loading': { it: 'Caricamento workspace mobile...', ro: 'Se încarcă spațiul de lucru...', en: 'Loading the mobile workspace...' , sq: 'Po ngarkohet hapësira celulare...'},
    'status.ready': { it: 'Workspace mobile attivo.', ro: 'Spațiul de lucru este activ.', en: 'Mobile workspace is active.' , sq: 'Hapësira celulare është aktive.'},
    'status.openError': { it: 'Non riesco ad aprire la tua area. Riprova', ro: 'Nu pot deschide zona ta. Încearcă din nou', en: 'Cannot open your area. Try again' , sq: 'Nuk e hap dot zonën tuaj. Provoni përsëri'},
    'status.refreshing': { it: 'Aggiornamento dati...', ro: 'Se actualizează datele...', en: 'Refreshing data...' , sq: 'Po përditësohen të dhënat...'},
    'status.refreshed': { it: 'Dati aggiornati.', ro: 'Date actualizate.', en: 'Data updated.' , sq: 'Të dhënat u përditësuan.'},
    'status.refreshError': { it: 'Errore aggiornamento dati.', ro: 'Eroare la actualizarea datelor.', en: 'Error refreshing data.' , sq: 'Gabim në përditësimin e të dhënave.'},
    'status.logoutError': { it: 'Errore durante il logout', ro: 'Eroare la ieșire', en: 'Error while logging out' , sq: 'Gabim gjatë daljes'},
    'status.tenantError': { it: 'Errore durante il cambio azienda. Riprova.', ro: 'Eroare la schimbarea firmei. Încearcă din nou.', en: 'Error while switching company. Try again.' , sq: 'Gabim gjatë ndërrimit të kompanisë. Provoni përsëri.'},
    'contact.close': { it: 'Chiudi', ro: 'Închide', en: 'Close' , sq: 'Mbyllni'},
    'contact.call': { it: 'Chiama', ro: 'Sună', en: 'Call' , sq: 'Telefononi'},
    'contact.callLabel': { it: '📞 Chiama', ro: '📞 Sună', en: '📞 Call' , sq: '📞 Telefononi'},
    'contact.mailTitle': { it: 'Email', ro: 'Email', en: 'Email' , sq: 'Email'},
    'contact.mailAria': { it: 'Invia email', ro: 'Trimite email', en: 'Send email' , sq: 'Dërgoni email'},
    'contact.mailLabel': { it: '✉️ Email', ro: '✉️ Email', en: '✉️ Email' , sq: '✉️ Email'},
    'pieno.loading': { it: 'Caricamento...', ro: 'Se încarcă...', en: 'Loading...' , sq: 'Po ngarkohet...'},
    'pieno.none': { it: 'Nessun carburante in anagrafica', ro: 'Niciun carburant în evidență', en: 'No fuel in the records' , sq: 'Nuk ka karburant në evidencë'},
    'pieno.choose': { it: 'Scegli il carburante', ro: 'Alege carburantul', en: 'Choose the fuel' , sq: 'Zgjidhni karburantin'},
    'pieno.vehicle': { it: 'Mezzo: {name}', ro: 'Utilaj: {name}', en: 'Vehicle: {name}' , sq: 'Mjeti: {name}'},
    'pieno.vehicleFallback': { it: 'Mezzo del lavoro', ro: 'Utilajul lucrării', en: 'Job vehicle' , sq: 'Mjeti i punës'},
    'pieno.noVehicle': { it: 'Questo lavoro non ha un mezzo da rifornire.', ro: 'Această lucrare nu are un utilaj de alimentat.', en: 'This job has no vehicle to refuel.' , sq: 'Kjo punë nuk ka mjet për të mbushur.'},
    'pieno.needFields': { it: 'Scegli il carburante e indica i litri.', ro: 'Alege carburantul și indică litrii.', en: 'Choose the fuel and enter the litres.' , sq: 'Zgjidhni karburantin dhe shënoni litrat.'},
    'pieno.saving': { it: 'Registro il pieno...', ro: 'Înregistrez alimentarea...', en: 'Saving the refuel...' , sq: 'Po regjistroj mbushjen...'},
    'pieno.saved': { it: 'Pieno registrato. La cisterna è aggiornata.', ro: 'Alimentare înregistrată. Rezervorul este actualizat.', en: 'Refuel saved. The tank is updated.' , sq: 'Mbushja u regjistrua. Cisterna u përditësua.'},
    'pieno.saveError': { it: 'Errore registrazione pieno.', ro: 'Eroare la înregistrarea alimentării.', en: 'Error saving the refuel.' , sq: 'Gabim në regjistrimin e mbushjes.'}
};
