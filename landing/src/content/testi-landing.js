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
    // BOZZA: da far rivedere — desktop: rimpicciolisce Tony senza perdere la chat
    riduci: 'Riduci',
    // BOZZA: da far rivedere
    ripristina: 'Parla con Tony',
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
    pensaLungo: 'Ci sto pensando, un attimo…',
    consensoInvioBreve:
      'Prima di chiedere: le domande passano da Google (Gemini) e, se usi la voce, da ElevenLabs. Continuando accetti l\'informativa privacy.',
    consensoInvioCta: 'Ho capito, chiedi',
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
    // BOZZA: da far rivedere — registrazione in chat (passo 13)
    registrazione: {
      apertura:
        'Per prima cosa creiamo il tuo account gratuito. Compila il modulo qui sotto: email e password le vedi solo tu.',
      etichettaNome: 'Nome (facoltativo)',
      etichettaCognome: 'Cognome (facoltativo)',
      etichettaEmail: 'Email',
      etichettaPassword: 'Password',
      etichettaConferma: 'Ripeti la password',
      etichettaAzienda: 'Nome della tua azienda',
      crea: 'Crea il mio account',
      annulla: 'Annulla',
      vaiDashboard: 'Vai alla tua dashboard',
      invio: 'Sto creando il tuo account…',
      fatto: 'Fatto! Il tuo account gratuito è pronto.',
      legaleRimandata: 'Le condizioni le confermi al primo accesso.',
      // Evita «ti porto» (vietato dai test passo 5/6): stesso senso, senza promessa di navigazione.
      accesso:
        'Al login la tua email è già scritta: metti solo la password.',
      ctaAccountClassica: 'registrazione classica',
      errori: {
        'email-usata':
          'Questa email ha già un account. Prova ad accedere dal login.',
        'email-non-valida': "Controlla l'email: sembra scritta male.",
        'password-debole':
          'La password è troppo corta: usane una di almeno 6 caratteri.',
        rete: 'Non riesco a collegarmi. Controlla la connessione e riprova.',
        'troppi-tentativi':
          'Troppi tentativi. Aspetta qualche minuto e riprova.',
        'profilo-esistente':
          'Qualcosa non è andato. Riprova tra poco oppure usa la registrazione classica.',
        permessi:
          'Qualcosa non è andato. Riprova tra poco oppure usa la registrazione classica.',
        azienda:
          'Qualcosa non è andato. Riprova tra poco oppure usa la registrazione classica.',
        sconosciuto:
          'Qualcosa non è andato. Riprova tra poco oppure usa la registrazione classica.',
        'protezione-non-pronta':
          'Qualcosa non è andato. Riprova tra poco oppure usa la registrazione classica.',
      },
    },
    // BOZZA: da far rivedere — aiuto per l'account (passo 14)
    aiuto: {
      invito:
        'Vuoi che ti aiuti a preparare l\'azienda? Ti faccio tre domande: sede legale, poderi e terreni. Puoi saltarne una con "Dopo".',
      chipSi: 'Sì, iniziamo',
      chipSaltaTutto: 'Salta tutto',
      chipDopo: 'Dopo',
      chipAvanti: 'Avanti',
      chipRiepilogo: 'Vedi il riepilogo',
      domandaSede:
        "Dov'è la sede legale della tua azienda? Mi bastano via e comune.",
      domandaPoderi: 'Hai uno o più poderi? Dimmi come li chiami.',
      domandaTerreni:
        'Ora i terreni: per ognuno dimmi nome, superficie e coltura, per esempio "Campo grande: 2,34 ettari, grano" o "Meleto: 1,2 ettari, mele". Con l\'account gratuito ne puoi inserire fino a 5.',
      cinqueTerreni:
        "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.",
      categoria: 'Che cosa ci coltivi? Grano, mais, orzo…',
      schedaIntro:
        'Ecco la tua azienda. Controlla e conferma: se qualcosa non va, correggilo qui.',
      salva: 'Sì, salva',
      salvando: 'Salvo…',
      tornaChat: 'Torna alla chat',
      etichettaSede: 'Sede legale',
      etichettaVia: 'Via e numero',
      etichettaComune: 'Comune',
      etichettaCap: 'CAP',
      etichettaProvincia: 'Provincia',
      etichettaPoderi: 'Poderi',
      etichettaTerreni: 'Terreni',
      etichettaNome: 'Nome',
      etichettaSuperficie: 'Superficie (ha)',
      etichettaColtura: 'Coltura',
      etichettaPodere: 'Podere',
      nessuno: 'Nessuno',
      fatto: "Fatto! Per 7 giorni ti guido anche dentro l'app.",
      vaiDashboard: 'Vai alla tua dashboard',
      // BOZZA: da rivedere con l'avvocato
      informativa:
        "Le risposte che dai a Tony passano da Google (Gemini) e, se usi la voce, da ElevenLabs: le elaborano per capirle e possono conservarle per breve tempo per motivi di sicurezza. Noi le salviamo nel tuo account solo quando confermi il riepilogo; se non confermi, non salviamo nulla. Puoi modificarle quando vuoi da Impostazioni. Non indicare dati di altre persone. Dettagli nell'Informativa privacy.",
      informativaLink: 'Informativa privacy',
      informativaHoCapito: 'Ho capito',
      errori: {
        nonCollegato: 'Prima crea il tuo account, poi salviamo i dati.',
        appCheck:
          'Non riesco a verificare il tuo browser. Ricarica la pagina e riprova.',
        troppeChiamate:
          'Hai provato troppe volte di seguito. Aspetta qualche minuto e riprova.',
        datiNonValidi:
          'Alcuni dati non vanno bene. Ho segnato le righe da correggere: sistemale e conferma di nuovo.',
        nienteDaSalvare:
          'Non c\'è niente da salvare. Puoi aggiungere i dati anche dopo, dalla dashboard.',
        senzaAzienda:
          'Non trovo l\'azienda collegata al tuo account. Esci, rientra e riprova.',
        contatto: 'Se non funziona, scrivici a {email}.',
        limiteTerreni:
          "Con l'account gratuito arrivi a 5 terreni. Ne hai già {esistenti}: puoi aggiungerne ancora {rimasti}. Togli qualche riga dalla scheda, oppure aggiungi gli altri dopo passando al Base.",
        giaPreparato:
          'La tua azienda è già pronta. Trovi tutto nella dashboard, dove puoi anche modificare i dati.',
        rete: 'Non sono riuscito a salvare e non è stato salvato niente. Riprova tra poco.',
      },
    },
  },
};
