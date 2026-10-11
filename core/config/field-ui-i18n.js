/**
 * Catalogo cornice del workspace campo (solo it, ro, en).
 * BOZZA RO/EN: da rivedere da un madrelingua.
 * Nessuna dipendenza. Lo step 1 copre i testi fissi del markup, la nav e i ruoli.
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
    }
};
