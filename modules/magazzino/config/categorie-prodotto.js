/**
 * Categorie prodotto per il modulo Prodotti e Magazzino
 * @module modules/magazzino/config/categorie-prodotto
 */

export const CATEGORIE_PRODOTTO = [
  { id: 'fitofarmaci', nome: 'Fitofarmaci', icona: '🦠' },
  { id: 'fertilizzanti', nome: 'Fertilizzanti', icona: '🌱' },
  { id: 'materiale_impianto', nome: 'Materiale impianto', icona: '🔧' },
  { id: 'ricambi', nome: 'Ricambi', icona: '⚙️' },
  { id: 'sementi', nome: 'Sementi', icona: '🌾' },
  { id: 'altro', nome: 'Altro', icona: '📦' }
];

export const UNITA_MISURA = [
  { id: 'kg', nome: 'kg' },
  { id: 'L', nome: 'L' },
  { id: 'pezzi', nome: 'Pezzi' },
  { id: 'm', nome: 'm' },
  { id: 'm2', nome: 'm²' },
  { id: 'confezione', nome: 'Confezione' },
  { id: 'sacchi', nome: 'Sacchi' },
  { id: 'altro', nome: 'Altro' }
];

export const TIPI_MOVIMENTO = [
  { id: 'entrata', nome: 'Entrata', icona: '➕' },
  { id: 'uscita', nome: 'Uscita', icona: '➖' }
];
