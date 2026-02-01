/**
 * Configurazione per coltura - Pianificazione nuovo impianto (modulo condiviso)
 * Etichette, sesti tipici, forme di allevamento e default per vigneto, frutteto, oliveto.
 * La pagina condivisa legge da qui; nessun "if" sul nome coltura nella UI.
 *
 * @module shared/config/pianificazione-impianto-colture
 */

/**
 * @typedef {Object} ConfigColtura
 * @property {string} titolo
 * @property {string} descrizione
 * @property {string} etichettaUnita
 * @property {string} etichettaUnitaPlurale
 * @property {string} etichettaUnitaNellaFila
 * @property {string} etichettaFile
 * @property {string} etichettaFilari
 * @property {number} defaultDistanzaFile
 * @property {number} defaultDistanzaUnita
 * @property {number} defaultLarghezzaCarraie
 * @property {Array<{label: string, distanzaFile: number, distanzaUnita: number}>} sestiTipici
 * @property {boolean} showFormaAllevamento
 * @property {string|null} formeAllevamentoSource
 * @property {Array<{value: string, label: string}>|null} formeAllevamento
 * @property {string} backPath
 * @property {string} moduloRequired
 * @property {{ bodyGradient: string, headerGradient: string, themeColor: string, themeColorDark: string }} theme
 * @property {Object} [calcoloMateriali] - Etichette e descrizioni per il modal Calcolo Materiali (opzionale)
 * @property {string} [calcoloMateriali.labelTipoImpianto]
 * @property {string} [calcoloMateriali.labelFiliPortata]
 * @property {string} [calcoloMateriali.labelFiliVegetazione]
 * @property {string} [calcoloMateriali.smallFiliPortata]
 * @property {string} [calcoloMateriali.smallFiliVegetazione]
 * @property {string} [calcoloMateriali.labelDiametroPortata]
 * @property {string} [calcoloMateriali.labelDiametroVegetazione]
 * @property {string} [calcoloMateriali.smallDiametroPortata]
 * @property {string} [calcoloMateriali.smallDiametroVegetazione]
 * @property {string} [calcoloMateriali.labelBraccetti]
 * @property {string} [calcoloMateriali.smallBraccetti]
 * @property {string} [calcoloMateriali.labelAncore]
 * @property {string} [calcoloMateriali.smallAncore]
 * @property {string} [calcoloMateriali.labelFissaggioTutori]
 * @property {string} [calcoloMateriali.smallFissaggioTutori]
 */

/** @type {Record<string, ConfigColtura>} */
export const CONFIG_COLTURA = {
  vigneto: {
    titolo: 'Pianificazione Nuovo Impianto',
    descrizione: 'Calcola automaticamente file, ceppi, pali e materiali necessari',
    etichettaUnita: 'ceppo',
    etichettaUnitaPlurale: 'ceppi',
    etichettaUnitaNellaFila: 'ceppi/piante nella fila',
    etichettaFile: 'File',
    etichettaFilari: 'filari',
    defaultDistanzaFile: 2.5,
    defaultDistanzaUnita: 0.8,
    defaultLarghezzaCarraie: 3,
    sestiTipici: [
      { label: '2,5 x 0,8 m (intensivo)', distanzaFile: 2.5, distanzaUnita: 0.8 },
      { label: '2,2 x 0,9 m', distanzaFile: 2.2, distanzaUnita: 0.9 },
      { label: '3 x 1 m (medio)', distanzaFile: 3, distanzaUnita: 1 },
      { label: '3,5 x 1,2 m (esteso)', distanzaFile: 3.5, distanzaUnita: 1.2 }
    ],
    showFormaAllevamento: true,
    /** Se impostato, la pagina caricherà le forme da questo modulo (getFormeAllevamentoList) */
    formeAllevamentoSource: 'vigneto',
    formeAllevamento: null,
    /** Path rispetto a modules/vigneto/views/ (pagina condivisa) */
    backPath: 'vigneto-dashboard-standalone.html',
    moduloRequired: 'vigneto',
    theme: {
      bodyGradient: 'linear-gradient(135deg, #E1BEE7 0%, #6A1B9A 100%)',
      headerGradient: 'linear-gradient(135deg, #6A1B9A 0%, #4A148C 100%)',
      themeColor: '#6A1B9A',
      themeColorDark: '#4A148C'
    },
    calcoloMateriali: {
      labelTipoImpianto: 'Tipo Impianto *',
      labelFiliPortata: 'Numero Fili di Portata (override tipo impianto)',
      labelFiliVegetazione: 'Numero Fili di Vegetazione (override tipo impianto)',
      smallFiliPortata: 'Fili di sostegno principale. Lascia vuoto per usare il valore predefinito',
      smallFiliVegetazione: 'Fili per contenimento chioma. Lascia vuoto per usare il valore predefinito',
      labelDiametroPortata: 'Diametro Fili di Portata (mm)',
      labelDiametroVegetazione: 'Diametro Fili di Vegetazione (mm)',
      smallDiametroPortata: 'Tipicamente 4-5mm. Lascia vuoto per usare il valore predefinito',
      smallDiametroVegetazione: 'Tipicamente 2-2.5mm. Lascia vuoto per usare il valore predefinito',
      labelBraccetti: 'Usa Braccetti',
      smallBraccetti: 'Braccetti strutturali per pali (2 per palo) - necessari per pergole, tendoni, GDC, Lyre',
      labelAncore: 'Usa Ancore',
      smallAncore: 'Ancore per pali di testata. Necessarie per strutture sopraelevate',
      labelFissaggioTutori: 'Fissaggio Tutori al Filo Portata',
      smallFissaggioTutori: 'Scegli come fissare i tutori al filo di portata. I legacci sono gli stessi usati per legare le piante ai fili.'
    }
  },
  frutteto: {
    titolo: 'Pianificazione Nuovo Impianto',
    descrizione: 'Calcola automaticamente file, piante e materiali necessari',
    etichettaUnita: 'pianta',
    etichettaUnitaPlurale: 'piante',
    etichettaUnitaNellaFila: 'piante nella fila',
    etichettaFile: 'File',
    etichettaFilari: 'filari',
    defaultDistanzaFile: 4,
    defaultDistanzaUnita: 1.5,
    defaultLarghezzaCarraie: 3,
    sestiTipici: [
      { label: '4 x 1,5 m (intensivo)', distanzaFile: 4, distanzaUnita: 1.5 },
      { label: '4 x 2 m', distanzaFile: 4, distanzaUnita: 2 },
      { label: '5 x 2 m (medio)', distanzaFile: 5, distanzaUnita: 2 },
      { label: '6 x 3 m (esteso)', distanzaFile: 6, distanzaUnita: 3 }
    ],
    showFormaAllevamento: true,
    /** Stessa lista centralizzata dell'anagrafica frutteto: modules/frutteto/config/specie-fruttifere.js + localStorage */
    formeAllevamentoSource: 'frutteto',
    formeAllevamento: null,
    backPath: '../../frutteto/views/frutteto-dashboard-standalone.html',
    moduloRequired: 'frutteto',
    theme: {
      bodyGradient: 'linear-gradient(135deg, #FFE0B2 0%, #FF6F00 100%)',
      headerGradient: 'linear-gradient(135deg, #FF6F00 0%, #E65100 100%)',
      themeColor: '#FF6F00',
      themeColorDark: '#E65100'
    },
    calcoloMateriali: {
      labelTipoImpianto: 'Forma di allevamento *',
      labelFiliPortata: 'Numero Fili di Sostegno (override forma)',
      labelFiliVegetazione: 'Numero Fili di Contenimento (override forma)',
      smallFiliPortata: 'Fili di sostegno principale (sostegno branche/capi). Lascia vuoto per usare il valore predefinito',
      smallFiliVegetazione: 'Fili per contenimento della vegetazione. Lascia vuoto per usare il valore predefinito',
      labelDiametroPortata: 'Diametro Fili di Sostegno (mm)',
      labelDiametroVegetazione: 'Diametro Fili di Contenimento (mm)',
      smallDiametroPortata: 'Tipicamente 2,5-4mm (spalliera/fusetto), 4-4,5mm (pergola kiwi). Lascia vuoto per predefinito',
      smallDiametroVegetazione: 'Tipicamente 1,6-2,5mm. Lascia vuoto per usare il valore predefinito',
      labelBraccetti: 'Usa Braccetti',
      smallBraccetti: 'Braccetti strutturali per pali (2 per palo) - necessari per pergola/tendone (es. kiwi)',
      labelAncore: 'Usa Ancore',
      smallAncore: 'Ancore per pali di testata per tenere in tensione i fili. Indispensabili in pergola/tendone.',
      labelFissaggioTutori: 'Fissaggio Tutori al Filo di Sostegno',
      smallFissaggioTutori: 'Scegli come fissare i tutori al filo di sostegno. I legacci servono per legare le piante ai fili.'
    }
  },
  oliveto: {
    titolo: 'Pianificazione Nuovo Impianto',
    descrizione: 'Calcola automaticamente file, piante e materiali necessari',
    etichettaUnita: 'pianta',
    etichettaUnitaPlurale: 'piante',
    etichettaUnitaNellaFila: 'piante nella fila',
    etichettaFile: 'File',
    etichettaFilari: 'filari',
    defaultDistanzaFile: 5,
    defaultDistanzaUnita: 5,
    defaultLarghezzaCarraie: 4,
    sestiTipici: [
      { label: '5 x 5 m (tradizionale)', distanzaFile: 5, distanzaUnita: 5 },
      { label: '5 x 4 m', distanzaFile: 5, distanzaUnita: 4 },
      { label: '6 x 5 m', distanzaFile: 6, distanzaUnita: 5 },
      { label: '6 x 6 m (esteso)', distanzaFile: 6, distanzaUnita: 6 }
    ],
    showFormaAllevamento: true,
    formeAllevamentoSource: null,
    formeAllevamento: [
      { value: 'vaso', label: 'Vaso' },
      { value: 'monocono', label: 'Monocono' },
      { value: 'vaso_polyconico', label: 'Vaso policónico' },
      { value: 'globulo', label: 'Globulo' },
      { value: 'altro', label: 'Altro' }
    ],
    backPath: '../../oliveto/views/oliveto-dashboard-standalone.html',
    moduloRequired: 'oliveto',
    theme: {
      bodyGradient: 'linear-gradient(135deg, #C8E6C9 0%, #2E7D32 100%)',
      headerGradient: 'linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%)',
      themeColor: '#2E7D32',
      themeColorDark: '#1B5E20'
    },
    calcoloMateriali: {
      labelTipoImpianto: 'Forma di allevamento *',
      labelFiliPortata: 'Numero Fili di Sostegno (override forma)',
      labelFiliVegetazione: 'Numero Fili di Contenimento (override forma)',
      smallFiliPortata: 'Fili di sostegno principale. Lascia vuoto per usare il valore predefinito',
      smallFiliVegetazione: 'Fili per contenimento della vegetazione. Lascia vuoto per usare il valore predefinito',
      labelDiametroPortata: 'Diametro Fili di Sostegno (mm)',
      labelDiametroVegetazione: 'Diametro Fili di Contenimento (mm)',
      smallDiametroPortata: 'Tipicamente 2,5-4mm. Lascia vuoto per predefinito',
      smallDiametroVegetazione: 'Tipicamente 1,6-2,5mm. Lascia vuoto per predefinito',
      labelBraccetti: 'Usa Braccetti',
      smallBraccetti: 'Braccetti strutturali per pali (2 per palo) - necessari per strutture sopraelevate',
      labelAncore: 'Usa Ancore',
      smallAncore: 'Ancore per pali di testata per tenere in tensione i fili.',
      labelFissaggioTutori: 'Fissaggio Tutori al Filo di Sostegno',
      smallFissaggioTutori: 'Scegli come fissare i tutori al filo di sostegno.'
    }
  }
};

const COLTURE_VALIDE = ['vigneto', 'frutteto', 'oliveto'];

/**
 * Restituisce la config per la coltura indicata.
 * @param {string} coltura - 'vigneto' | 'frutteto' | 'oliveto'
 * @returns {ConfigColtura}
 */
export function getConfigColtura(coltura) {
  const c = coltura && coltura.toLowerCase();
  if (!CONFIG_COLTURA[c]) {
    return CONFIG_COLTURA.vigneto;
  }
  return CONFIG_COLTURA[c];
}

/**
 * Verifica se la coltura è valida.
 * @param {string} coltura
 * @returns {boolean}
 */
export function isColturaValida(coltura) {
  return COLTURE_VALIDE.includes(coltura && coltura.toLowerCase());
}

/**
 * Restituisce l'elenco delle colture per il selettore (solo quelle con modulo attivo opzionale).
 * @returns {Array<{ value: string, label: string }>}
 */
export function getColturePerSelect() {
  return [
    { value: 'vigneto', label: '🍇 Vigneto' },
    { value: 'frutteto', label: '🍎 Frutteto' },
    { value: 'oliveto', label: '🫒 Oliveto' }
  ];
}
