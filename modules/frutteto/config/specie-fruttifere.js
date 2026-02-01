/**
 * Configurazione Specie Fruttifere
 * Liste predefinite per dropdown specie e varietà
 * 
 * @module modules/frutteto/config/specie-fruttifere
 */

export const SPECIE_FRUTTIFERE = [
  'Melo',
  'Pesco',
  'Pero',
  'Albicocco',
  'Ciliegio',
  'Susino',
  'Kiwi',
  'Fico',
  'Nocciolo',
  'Castagno',
  'Mandorlo',
  'Arancio',
  'Limone',
  'Mandarino',
  'Clementine',
  'Altro'
];

export const VARIETA_PER_SPECIE = {
  'Melo': [
    'Gala',
    'Fuji',
    'Golden Delicious',
    'Red Delicious',
    'Granny Smith',
    'Braeburn',
    'Pink Lady',
    'Stark Delicious',
    'Renetta',
    'Morgenduft',
    'Annurca',
    'Altro'
  ],
  'Pesco': [
    'Springcrest',
    'Maycrest',
    'Redhaven',
    'Suncrest',
    'Fayette',
    'Big Top',
    'Romea',
    'Altro'
  ],
  'Pero': [
    'Abate Fetel',
    'Kaiser',
    'Conference',
    'Williams',
    'Decana del Comizio',
    'Passacrassana',
    'Altro'
  ],
  'Albicocco': [
    'Boccuccia',
    'Pellecchiella',
    'San Castrese',
    'Altro'
  ],
  'Ciliegio': [
    'Ferrovia',
    'Bigarreau',
    'Duroni',
    'Altro'
  ],
  'Susino': [
    'Stanley',
    'Angeleno',
    'Altro'
  ],
  'Kiwi': [
    'Hayward',
    'Altro'
  ],
  'Fico': [
    'Dottato',
    'Altro'
  ],
  'Nocciolo': [
    'Tonda Gentile',
    'Tonda di Giffoni',
    'Altro'
  ],
  'Castagno': [
    'Marrone',
    'Altro'
  ],
  'Mandorlo': [
    'Filippo Ceo',
    'Tuono',
    'Altro'
  ],
  'Arancio': [
    'Tarocco',
    'Moro',
    'Sanguinello',
    'Valencia',
    'Navel',
    'Altro'
  ],
  'Limone': [
    'Femminello',
    'Eureka',
    'Altro'
  ],
  'Mandarino': [
    'Tardivo di Ciaculli',
    'Altro'
  ],
  'Clementine': [
    'Comune',
    'Altro'
  ]
};

export const FORME_ALLEVAMENTO_FRUTTETO = [
  // Forme tradizionali
  'Vaso',
  'Vaso globoso',
  'Vaso policonico',
  'Vaso ritardato',
  'Vasetta ritardata',
  
  // Forme in parete
  'Palmetta',
  'Palmetta libera',
  'Palmetta sprint',
  'Doppia palmetta',
  'Spalliera',
  'Parete',
  'Forme alte in parete',
  
  // Forme moderne intensive
  'Fusetto',
  'Leader centrale',
  'Cordone',
  'Cordoncino',
  'Solaxe',
  
  // Forme per kiwi e specie rampicanti
  'Pergola',
  'Tatura',
  'Tatura trellis',
  'KAC V',
  'Perpendicular V',
  
  // Forme specifiche
  'Fogliare',
  'Vase',
  'Vase à axe central',
  'Vase à axe central retardé',
  
  // Opzione generica
  'Altro'
];

export const CALIBRI_FRUTTA = [
  '50-60mm',
  '60-70mm',
  '70-80mm',
  '80-90mm',
  '90-100mm',
  '100mm+',
  'Altro'
];

export const GRADI_MATURAZIONE = [
  'Acerbo',
  'In maturazione',
  'Ottimale',
  'Avanzato',
  'Altro'
];
