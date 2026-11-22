/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../core/services/firebase-service.js', () => ({
  timestampToDate: (value) => value,
  dateToTimestamp: (value) => value
}));
import { Vendemmia } from '../modules/vigneto/models/Vendemmia.js';
import {
  famigliaTariffaPalo,
  normalizzaTipoPalo,
  riempiSelectTipoPalo
} from '../modules/vigneto/config/tipi-palo.js';
import { resolveTariffaEttaro } from '../modules/vendemmia-meccanica/services/calcolo-compenso-vm-service.js';

const vecchi = [
  ['Ferro', 'acciaio_zincato_caldo'],
  ['Acciaio', 'acciaio_zincato_caldo'],
  ['Acciaio zincato', 'acciaio_zincato_caldo'],
  ['Ferro zincato a caldo', 'acciaio_zincato_caldo'],
  ['Misto cemento-ferro', 'acciaio_zincato_caldo'],
  ['ferro', 'acciaio_zincato_caldo'],
  ['Ferro zincato a freddo', 'acciaio_zincato_freddo'],
  ['Legno', 'legno_pino_trattato'],
  ['Legno trattato', 'legno_pino_trattato'],
  ['legno', 'legno_pino_trattato'],
  ['Cemento', 'cemento_precompresso'],
  ['Cemento armato', 'cemento_precompresso'],
  ['cemento', 'cemento_precompresso'],
  ['Plastica', 'altro'],
  ['Fibra di vetro', 'altro'],
  ['fibra_vetro', 'altro'],
  ['personalizzata', 'altro'],
  ['Bambù', 'altro'],
  ['acciaio_corten', 'acciaio_corten'],
  ['  Ferro  ', 'acciaio_zincato_caldo']
];

describe('tipo palo condiviso', () => {
  it('normalizza ogni valore vecchio e tiene la chiave nuova', () => {
    vecchi.forEach(([da, a]) => {
      expect(normalizzaTipoPalo(da)).toBe(a);
    });
    expect(normalizzaTipoPalo('')).toBe('');
    expect(normalizzaTipoPalo(null)).toBe('');
  });

  it('la vendemmia con vigneto Cemento si salva sulla chiave nuova', () => {
    const vendemmia = new Vendemmia({
      vignetoId: 'v1',
      data: '2026-09-10',
      varieta: 'Sangiovese',
      quantitaQli: 12,
      quantitaEttari: 1.2,
      destinazione: 'vino',
      lavoroId: 'lav1',
      tipoPalo: 'Cemento'
    });
    const esito = vendemmia.validate();
    expect(esito.valid).toBe(true);
    expect(vendemmia.tipoPalo).toBe('cemento_precompresso');
  });

  it('la tariffa VM resta sulla famiglia ferro, legno, cemento', () => {
    const sesto = { distanzaFile: 2.5, distanzaCeppo: 1 };
    const tariffe = {
      tariffeVendemmia: {
        'collina-ferro': 100,
        'collina-legno': 80,
        'collina-cemento': 90,
        'collina-personalizzata': 70
      },
      coefficientiSesto: { standard: 1 }
    };
    expect(famigliaTariffaPalo('ferro')).toBe('ferro');
    expect(famigliaTariffaPalo('acciaio_zincato_caldo')).toBe('ferro');
    expect(famigliaTariffaPalo('legno')).toBe('legno');
    expect(famigliaTariffaPalo('cemento')).toBe('cemento');
    expect(famigliaTariffaPalo('altro')).toBe('personalizzata');
    expect(resolveTariffaEttaro({ tipoCampo: 'collina', tipoPalo: 'ferro', sestoImpianto: sesto }, tariffe).chiave).toBe('collina-ferro');
    expect(resolveTariffaEttaro({ tipoCampo: 'collina', tipoPalo: 'acciaio_zincato_freddo', sestoImpianto: sesto }, tariffe).tariffaEttaro).toBe(100);
    expect(resolveTariffaEttaro({ tipoCampo: 'collina', tipoPalo: 'legno_castagno', sestoImpianto: sesto }, tariffe).chiave).toBe('collina-legno');
    expect(resolveTariffaEttaro({ tipoCampo: 'collina', tipoPalo: 'Cemento', sestoImpianto: sesto }, tariffe).chiave).toBe('collina-cemento');
  });

  it('il menu mostra l\'etichetta nuova anche se il valore salvato è vecchio', () => {
    document.body.innerHTML = '<select id="tipoPalo"><option value="">Seleziona</option></select>';
    const select = document.getElementById('tipoPalo');
    riempiSelectTipoPalo(select, 'Ferro zincato a freddo');
    expect(select.value).toBe('acciaio_zincato_freddo');
    expect(select.selectedOptions[0].textContent).toContain('Acciaio zincato a freddo');
    expect(select.textContent).not.toContain('Aggiungi');
  });
});
