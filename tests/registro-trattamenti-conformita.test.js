/**
 * @vitest-environment node
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  htmlPallinoCampo,
  htmlRiepilogoConformita,
  htmlSemaforoConformita,
  valutaConformitaEtichetta,
  valutaConformitaTrattamento
} from '../shared/js/registro-trattamenti-conformita.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const folpan = JSON.parse(readFileSync(path.join(root, 'shared/data/fitofarmaci-etichette/per-registrazione/008601.json'), 'utf8'));
const vocabolario = JSON.parse(readFileSync(path.join(root, 'shared/data/fitofarmaci-etichette/colture-vocabolario.json'), 'utf8'));
const vino = folpan.righe.find((riga) => riga.id === '008601-00137');
const tavola = folpan.righe.find((riga) => riga.id === '008601-00144');

function giorno(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fraGiorni(iso, n) {
  const d = giorno(iso);
  d.setDate(d.getDate() + n);
  return d;
}

function riga(over = {}) {
  return {
    prodottoId: 'folpan',
    prodotto: 'FOLPAN 80 WDG',
    dosaggio: 1.4,
    unitaDosaggio: 'kg',
    avversita: 'Peronospora (Plasmopara viticola)',
    riferimentoRiga: {
      nomeProdotto: 'FOLPAN 80 WDG',
      numeroRegistrazione: '008601',
      colturaScheda: 'vite da vino'
    },
    ...over
  };
}

function trattamento(over = {}) {
  return {
    id: 'corrente',
    data: giorno('2026-08-01'),
    terrenoId: 't1',
    specieUsata: 'vite da vino',
    acquaEttolitriPerEttaro: null,
    ...over
  };
}

function precedenti(n, ultimoIso) {
  const ultimo = giorno(ultimoIso || '2026-01-10');
  return Array.from({ length: n }, (_, i) => {
    const data = new Date(ultimo.getFullYear(), ultimo.getMonth(), ultimo.getDate() - (n - 1 - i));
    return {
      id: 'p' + i,
      data,
      terrenoId: 't1',
      prodottoId: 'folpan',
      nome: 'FOLPAN 80 WDG'
    };
  });
}

function valuta(over = {}) {
  return valutaConformitaEtichetta({
    trattamento: over.trattamento || trattamento(),
    riga: over.riga || riga(),
    rigaEtichetta: Object.prototype.hasOwnProperty.call(over, 'rigaEtichetta') ? over.rigaEtichetta : vino,
    scheda: Object.prototype.hasOwnProperty.call(over, 'scheda') ? over.scheda : folpan,
    vocabolario,
    statoProdotto: over.statoProdotto || null,
    precedenti: over.precedenti || [],
    dataRaccolta: over.dataRaccolta || null,
    oggi: over.oggi || giorno('2026-11-21')
  });
}

function senzaConsiglio(esito) {
  (esito.motivi || []).forEach((m) => {
    expect(m.testo).not.toMatch(/\b(usa|riduci|aumenta|consigliat)/i);
  });
}

describe('conformità etichetta FOLPAN', () => {
  it('1,4 kg/ha è verde con i controlli disponibili', () => {
    const esito = valuta();
    expect(esito.colore).toBe('verde');
    expect(esito.motivi.some((m) => m.colore === 'rosso' || m.colore === 'giallo' || m.colore === 'grigio')).toBe(false);
    senzaConsiglio(esito);
  });

  it('2 kg/ha è rosso e riporta l\'intervallo, senza consigliare una dose', () => {
    const esito = valuta({ riga: riga({ dosaggio: 2 }) });
    expect(esito.colore).toBe('rosso');
    const testo = esito.motivi.find((m) => m.codice === 'dose_fuori').testo;
    expect(testo).toBe("Dose 2 kg/ha fuori dall'intervallo d'etichetta (1,25–1,5 kg/ha)");
    senzaConsiglio(esito);
  });

  it('1400 g/ha è verde dopo la conversione', () => {
    const esito = valuta({ riga: riga({ dosaggio: 1400, unitaDosaggio: 'g' }) });
    expect(esito.colore).toBe('verde');
  });

  it('kg contro l/ha resta grigio', () => {
    const esito = valuta({ riga: riga({ dosaggio: 1.4, unitaDosaggio: 'l' }) });
    expect(esito.colore).toBe('grigio');
    expect(esito.motivi.some((m) => /unità diverse/i.test(m.testo))).toBe(true);
  });

  it('1,4 kg/ha con 10 hl/ha è 140 g/hl, verde; con 5 hl/ha è rosso', () => {
    const verde = valuta({ trattamento: trattamento({ acquaEttolitriPerEttaro: 10 }) });
    expect(verde.colore).toBe('verde');
    expect(verde.motivi.some((m) => m.codice === 'dose_hl_fuori')).toBe(false);
    const rosso = valuta({ trattamento: trattamento({ acquaEttolitriPerEttaro: 5 }) });
    expect(rosso.colore).toBe('rosso');
    expect(rosso.motivi.find((m) => m.codice === 'dose_hl_fuori').testo).toContain('280 g/hl');
    expect(rosso.motivi.find((m) => m.codice === 'dose_hl_fuori').testo).toContain('125–150 g/hl');
  });

  it('carenza: 20 giorni rosso, 30 verde, senza vendemmia solo il motivo informativo', () => {
    const rosso = valuta({ dataRaccolta: giorno('2026-08-21') });
    expect(rosso.colore).toBe('rosso');
    expect(rosso.motivi.find((m) => m.codice === 'carenza_non_rispettata').testo)
      .toBe('Carenza non rispettata: raccolta il 21/08/2026, 20 giorni dopo il trattamento; in etichetta 28 giorni');
    const verde = valuta({ dataRaccolta: giorno('2026-08-31') });
    expect(verde.colore).toBe('verde');
    const senza = valuta();
    expect(senza.colore).toBe('verde');
    expect(senza.motivi.some((m) => m.colore === 'rosso')).toBe(false);
    const info = senza.motivi.find((m) => m.codice === 'carenza_non_verificabile');
    expect(info).toBeTruthy();
    expect(info.testo).toContain('non verificabile');
    expect(info.testo).toContain('29/08/2026');
  });

  it('11° trattamento nell\'anno è rosso', () => {
    const esito = valuta({
      trattamento: trattamento({ data: giorno('2026-06-15') }),
      precedenti: precedenti(10, '2026-06-01')
    });
    expect(esito.colore).toBe('rosso');
    expect(esito.motivi.find((m) => m.codice === 'troppi_trattamenti').testo)
      .toContain("11° trattamento nell'anno: in etichetta al massimo 10 all'anno");
  });

  it('vite da tavola al 5° trattamento è rosso e segnala il periodo non indicato', () => {
    const esito = valuta({
      riga: riga({
        riferimentoRiga: { nomeProdotto: 'FOLPAN 80 WDG', numeroRegistrazione: '008601', colturaScheda: 'vite da tavola' }
      }),
      rigaEtichetta: tavola,
      trattamento: trattamento({ data: giorno('2026-06-15'), specieUsata: 'vite da tavola' }),
      precedenti: precedenti(4, '2026-06-01')
    });
    expect(esito.colore).toBe('rosso');
    const testo = esito.motivi.find((m) => m.codice === 'troppi_trattamenti').testo;
    expect(testo).toContain('5° trattamento');
    expect(testo).toContain('4');
    expect(testo).toContain('periodo non indicato');
  });

  it('intervallo di 5 giorni è rosso', () => {
    const esito = valuta({
      trattamento: trattamento({ data: giorno('2026-06-15') }),
      precedenti: precedenti(1, '2026-06-10')
    });
    expect(esito.colore).toBe('rosso');
    expect(esito.motivi.find((m) => m.codice === 'intervallo_corto').testo)
      .toBe('Passaggio a 5 giorni dal precedente: in etichetta almeno 7');
  });

  it('revocato prima del trattamento è rosso; revocato dopo non lo è', () => {
    const prima = valuta({
      trattamento: trattamento({ data: giorno('2026-05-10') }),
      statoProdotto: { stato: 'Revocato', dataDecorrenzaRevoca: '2026-03-01' }
    });
    expect(prima.colore).toBe('rosso');
    expect(prima.motivi.find((m) => m.codice === 'prodotto_revocato').testo)
      .toBe('Prodotto revocato dal 01/03/2026: il trattamento è del 10/05/2026');
    const dopo = valuta({
      trattamento: trattamento({ data: giorno('2026-05-10') }),
      statoProdotto: { stato: 'Revocato', dataDecorrenzaRevoca: '2026-06-01' }
    });
    expect(dopo.colore).not.toBe('rosso');
    expect(dopo.motivi.some((m) => m.codice === 'revoca_successiva')).toBe(true);
  });

  it('autorizzato ma già scaduto alla data del trattamento è rosso', () => {
    const esito = valuta({
      trattamento: trattamento({ data: giorno('2026-05-10') }),
      statoProdotto: { stato: 'Autorizzato', dataScadenzaAutorizzazione: '2026-01-31' }
    });
    expect(esito.colore).toBe('rosso');
    expect(esito.motivi.some((m) => m.codice === 'autorizzazione_scaduta')).toBe(true);
  });

  it('scadenza tra 60 giorni è gialla; tra 120 resta verde', () => {
    const oggi = giorno('2026-11-21');
    const vicina = valuta({
      oggi,
      statoProdotto: { stato: 'Autorizzato', dataScadenzaAutorizzazione: fraGiorni('2026-11-21', 60) }
    });
    expect(vicina.colore).toBe('giallo');
    expect(vicina.motivi.find((m) => m.codice === 'scadenza_vicina').testo).toMatch(/Autorizzazione in scadenza il \d{2}\/\d{2}\/\d{4}/);
    const lontana = valuta({
      oggi,
      statoProdotto: { stato: 'Autorizzato', dataScadenzaAutorizzazione: fraGiorni('2026-11-21', 120) }
    });
    expect(lontana.colore).toBe('verde');
  });

  it('deroga e smaltimento con dati finti sono gialli; senza quei campi non scatta il giallo', () => {
    const deroga = valuta({
      statoProdotto: { stato: 'Autorizzato', deroga: { fino: '2027-06-01', testo: 'art. 53' } }
    });
    expect(deroga.colore).toBe('giallo');
    expect(deroga.motivi.find((m) => m.codice === 'deroga').testo).toContain('art. 53');
    const senzaDeroga = valuta({ statoProdotto: { stato: 'Autorizzato' } });
    expect(senzaDeroga.motivi.some((m) => m.codice === 'deroga' || m.codice === 'smaltimento')).toBe(false);
    const scorte = valuta({
      trattamento: trattamento({ data: giorno('2026-05-10') }),
      statoProdotto: {
        stato: 'Revocato',
        dataDecorrenzaRevoca: '2026-03-01',
        smaltimentoScorteFino: '2026-12-31'
      }
    });
    expect(scorte.colore).toBe('giallo');
    expect(scorte.motivi.some((m) => m.codice === 'prodotto_revocato')).toBe(false);
    expect(scorte.motivi.some((m) => m.codice === 'smaltimento')).toBe(true);
    const senzaScorte = valuta({
      trattamento: trattamento({ data: giorno('2026-05-10') }),
      statoProdotto: { stato: 'Revocato', dataDecorrenzaRevoca: '2026-03-01' }
    });
    expect(senzaScorte.colore).toBe('rosso');
    senzaConsiglio(deroga);
    senzaConsiglio(scorte);
  });

  it('senza file, coltura non estratta e righe ambigue sono grigi; coltura assente e avversità Altra sono rossi', () => {
    const senzaFile = valutaConformitaEtichetta({
      trattamento: trattamento(),
      riga: riga(),
      scheda: null
    });
    expect(senzaFile.colore).toBe('grigio');

    const nonEstratta = valutaConformitaEtichetta({
      trattamento: trattamento(),
      riga: riga(),
      scheda: { righe: [], colture_non_estratte: ['vite da vino'] },
      vocabolario
    });
    expect(nonEstratta.colore).toBe('grigio');
    expect(nonEstratta.motivi.some((m) => m.codice === 'coltura_non_estratta')).toBe(true);

    const assente = valutaConformitaEtichetta({
      trattamento: trattamento(),
      riga: riga(),
      scheda: { righe: [], colture_non_estratte: [] },
      vocabolario
    });
    expect(assente.colore).toBe('rosso');
    expect(assente.motivi.find((m) => m.codice === 'coltura_assente').testo).toBe('In etichetta non trovo questa coltura');

    const altra = valutaConformitaEtichetta({
      trattamento: trattamento(),
      riga: riga({ avversita: 'Altra' }),
      scheda: folpan,
      vocabolario
    });
    expect(altra.colore).toBe('rosso');
    expect(altra.motivi.some((m) => m.codice === 'avversita_altra')).toBe(true);

    const ambigua = valutaConformitaEtichetta({
      trattamento: trattamento(),
      riga: riga({ avversita: '' }),
      scheda: {
        righe: [
          { id: 'a', colture: ['vite da vino'], avversita: 'Peronospora', dose_ha: [{ min: 1, max: 2, unita: 'kg/ha' }] },
          { id: 'b', colture: ['vite da vino'], avversita: 'Oidio', dose_ha: [{ min: 3, max: 4, unita: 'kg/ha' }] }
        ],
        colture_non_estratte: []
      },
      vocabolario
    });
    expect(ambigua.colore).toBe('grigio');
    expect(ambigua.motivi.find((m) => m.codice === 'riga_ambigua').testo).toContain("Più righe d'etichetta possibili: scegli l'avversità");
  });

  it('la miscela prende il colore peggiore', () => {
    const esito = valutaConformitaTrattamento({
      trattamento: trattamento(),
      righe: [riga(), riga({ dosaggio: 2, prodotto: 'FOLPAN 80 WDG' })],
      rigaEtichetta: vino,
      scheda: folpan,
      oggi: giorno('2026-11-21')
    });
    expect(esito.colore).toBe('rosso');
    expect(esito.motivi.some((m) => m.codice === 'dose_fuori')).toBe(true);
  });

  it('il pallino ha role e aria-label, il riepilogo la parola del colore', () => {
    const esito = valuta({ riga: riga({ dosaggio: 2 }) });
    const html = htmlSemaforoConformita(esito);
    expect(html).toContain('role="img"');
    expect(html).toMatch(/aria-label="[^"]+"/);
    expect(html).toContain('gfv-semaforo--red');
    const riepilogo = htmlRiepilogoConformita(esito);
    expect(riepilogo).toContain('Errore');
    expect(htmlRiepilogoConformita(valuta())).toContain('Conforme');
    expect(htmlPallinoCampo(esito, 'doseHa')).toContain('role="img"');
    senzaConsiglio(esito);
  });
});
