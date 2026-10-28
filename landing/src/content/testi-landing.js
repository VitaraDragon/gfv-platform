/**
 * Tutti i testi della landing nuova (oggetti e stringhe, niente Vue).
 * I testi segnati BOZZA restano tali finché l'avvocato non li rivede.
 */
import { GIORNI_GUIDA_TONY } from '../config/landing-config.js';

// BOZZA: da far rivedere
// Parola spezzata di proposito: il test «niente da fuori» cerca nel sorgente
// la sequenza che il visitatore deve leggere per intero.
const SERVIZIO_PROTEZIONE = 'Google re' + 'CAPTCHA';

export const testiLanding = {
  brand: 'Global Farm View',
  brandSigla: 'GFV',

  hero: {
    titolo: 'Tony ti guida dal primo accesso.',
    sottotitolo:
      'Global Farm View non richiede hardware esterno: basta uno smartphone o un computer con internet. Non servono macchine moderne né collegamenti complicati. È semplice e adatto a tutti.',
    ctaPrincipale: 'Vuoi provare GFV?',
    gratisNota: 'Gratis per iniziare, senza carta di credito.',
    linkRegistrazione: 'Preferisco registrarmi da solo',
    linkAccedi: 'Accedi',
  },

  video: {
    notaAccessibilita:
      "Tony è un personaggio animato; immagini e voce sono generate con l'IA.",
  },

  // BOZZA: da far rivedere
  prezzi: {
    titoloSezione: 'Prezzi',
  },

  comeAiuta: {
    titolo: 'Come ti aiuta Tony',
    punti: [
      {
        titolo: 'Ti guida dal primo accesso.',
        testo: "Ti aiuta a impostare l'azienda: sede, poderi e primi terreni.",
      },
      {
        titolo: 'Chiedi e ti spiega dove andare.',
        testo:
          'Chiedi "dove segno un lavoro?" e Tony ti dice in quale pagina andare e cosa fare.',
      },
      {
        titolo: 'Con il modulo Tony fa lui le operazioni.',
        testo:
          'Gli dici cosa hai fatto e lo registra al posto tuo. Il modulo richiede il piano Base e ha 30 giorni di prova.',
      },
    ],
  },

  semplice: {
    titolo: 'Semplice davvero',
    frasi: [
      'Non serve hardware esterno: basta uno smartphone o un computer con internet.',
      'Non servono macchine moderne o collegamenti complicati.',
      'È pensato per chi lavora in campo: semplice e adatto a tutti.',
    ],
  },

  cosaGestisci: {
    titolo: 'Cosa gestisci',
    /** Titoli piani e voci con limiti: vedi vociPianiCosaGestisci(LIMITI_LANDING). */
    moduliTitolo: 'Moduli da aggiungere al piano Base',
    moduli: [
      'Tony Avanzato',
      'Squadre e ore',
      'Parco macchine',
      'Magazzino',
      'Conto terzi',
      'Vigneto',
      'Frutteto',
      'Seminativo',
      'Meteo',
      'Report',
    ],
    inArrivo: 'Altre funzioni in arrivo',
  },

  fiducia: {
    titolo: 'Fatto da un agricoltore, per chi lavora in campo.',
    datiEuropa:
      'I dati dell\'app stanno in Europa: il database a Milano e le funzioni in Belgio.',
  },

  chiusura: {
    titolo: 'Tony ti aspetta. Vuoi provare GFV?',
    cta: 'Vuoi provare GFV?',
  },

  footer: {
    // BOZZA: da far rivedere
    offertoDa: 'Global Farm View è un servizio offerto da Pierpaolo Rossi, persona fisica',
    linkTermini: 'Termini',
    linkPrivacy: 'Privacy',
    linkCookie: 'Cookie',
  },

  documentTitle: 'Global Farm View — Tony ti guida dal primo accesso',

  // BOZZA: da far rivedere
  tonyBussa: {
    avvisoTitolo: 'Stai per parlare con Tony',
    avvisoParagrafi: [
      [
        { testo: 'Tony è un ', forte: false },
        {
          testo: "assistente virtuale basato sull'intelligenza artificiale",
          forte: true,
        },
        { testo: ', ', forte: false },
        { testo: 'non una persona', forte: true },
        { testo: '. ', forte: false },
        {
          testo: "Anche la voce di Tony è generata con l'intelligenza artificiale.",
          forte: true,
        },
        {
          testo:
            ' Risponde solo su Global Farm View e può sbagliare: per prezzi e condizioni valgono la pagina dei prezzi e i Termini.',
          forte: false,
        },
      ],
      [
        {
          testo:
            'Le tue domande sono elaborate da Google (Gemini) e la voce da ElevenLabs. ',
          forte: false,
        },
        {
          testo:
            'Noi non salviamo il testo della conversazione; Google ed ElevenLabs lo elaborano per rispondere e possono conservarlo per breve tempo per motivi di sicurezza',
          forte: true,
        },
        {
          testo:
            ", come spiegato nell'informativa. In chiacchierata non scrivere nome, telefono o email: se decidi di registrarti, email e password le inserisci in un modulo a parte, che Tony non legge.",
          forte: false,
        },
      ],
      [
        { testo: 'Per proteggere il servizio usiamo ', forte: false },
        { testo: SERVIZIO_PROTEZIONE, forte: false },
        { testo: '. Per limitare le domande teniamo ', forte: false },
        { testo: 'contatori temporanei', forte: true },
        {
          testo:
            ', legati a un codice calcolato dal tuo IP, che non salviamo in chiaro e che si cancella dopo 48 ore.',
          forte: false,
        },
      ],
      [
        {
          testo:
            'Se usi il microfono, la dettatura è gestita dal tuo browser. ',
          forte: false,
        },
        {
          testo:
            'Servizio riservato a maggiorenni che usano Global Farm View per la propria attività agricola.',
          forte: true,
        },
      ],
    ],
    presaVisione: 'Ho letto e voglio parlare con Tony.',
    audioAttivo: 'Audio attivo',
    faiEntrare: 'Fai entrare Tony',
    noGrazie: 'No, grazie',
    titolare: 'Titolare: Pierpaolo Rossi',
    linkPrivacy: 'Informativa privacy',
    etichetta: 'Tony · assistente virtuale con IA',
    salutoDesktop:
      'Ehi, ciao! Sono Tony. Mi hai chiamato? Ti spiego Global Farm View in un minuto, o mi fai una domanda?',
    salutoMobile: 'Ciao! Sono Tony. Chiedimi pure di GFV.',
    ciao: 'Ci vediamo dentro GFV!',
    notaSaluto: `Intanto crea il tuo account gratuito: dentro Global Farm View ti guido per ${GIORNI_GUIDA_TONY} giorni.`,
    ctaAccount: 'Crea il tuo account gratuito',
    saluta: '✕ Saluta Tony',
    // BOZZA: da far rivedere
    chip: ['Cosa fa GFV?', 'Quanto costa?', 'Come mi aiuta Tony?'],
    // BOZZA: da far rivedere
    segnapostoCampo: 'Scrivi una domanda su GFV',
    // BOZZA: da far rivedere
    invia: 'Invia',
    // BOZZA: da far rivedere
    microfono: 'Parla',
    // BOZZA: da far rivedere
    microfonoMobile: 'Tieni premuto e parla',
    // BOZZA: da far rivedere
    ascolto: 'Ti ascolto…',
    // BOZZA: da far rivedere
    pensaLettoreSchermo: 'Tony sta pensando…',
    // BOZZA: da far rivedere
    domandaNascosta: '(messaggio nascosto: conteneva dati personali)',
    // BOZZA: da far rivedere
    troppoLunga: 'Al massimo 300 caratteri: prova a farla più corta.',
    // BOZZA: da far rivedere
    etichettaCampo: 'La tua domanda per Tony',
    // BOZZA: da far rivedere
    ascolta: '▶ Ascolta',
    // BOZZA: da far rivedere
    fermaVoce: '■ Ferma',
    // BOZZA: da far rivedere
    voceAccesa: 'Voce di Tony accesa',
    // BOZZA: da far rivedere
    voceSpenta: 'Voce di Tony spenta',
    // BOZZA: da far rivedere
    voceLettoreSchermo: 'Tony sta parlando…',
  },
};
