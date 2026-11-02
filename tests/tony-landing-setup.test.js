/**
 * @vitest-environment node
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { COLTURE_PREDEFINITE, CATEGORIE_COLTURE_PREDEFINITE } from '../core/config/app-catalog-seed-data.js';
import { SUBSCRIPTION_PLANS } from '../core/config/subscription-plans.js';
import { normalizzaTesto } from '../core/js/catalogo-dedupe.js';

const require = createRequire(import.meta.url);
const {
  LIMITI,
  chiaveNome,
  pulisciTesto,
  risolviControAzienda,
  validaRichiestaSetup
} = require('../functions/lib/tony-landing-setup-core.js');
const { generaContenuto } = require('../functions/scripts/generate-colture-predefinite.js');
const coltureGenerate = require('../functions/config/colture-predefinite.js');

const ID = 'req-ok-1234';
const MESSAGGIO_RIGENERAZIONE = 'rigenera con `node functions/scripts/generate-colture-predefinite.js`';

const ESEMPIO = {
  requestId: 'setup-faenza-casetti-01',
  sede: {
    indirizzo: 'Via Emilia Ponente 10',
    citta: 'Faenza',
    cap: '48018',
    provincia: 'RA'
  },
  poderi: [{ nome: 'Casetti' }],
  terreni: [
    { nome: 'Campo grande', superficie: 2.34, coltura: 'Grano', podere: 'Casetti' },
    { nome: 'Meleto', superficie: 1.2, coltura: 'Melo', podere: null }
  ]
};

const spie = [];

beforeAll(() => {
  for (const metodo of ['log', 'info', 'warn', 'error']) {
    spie.push(vi.spyOn(console, metodo).mockImplementation(() => {}));
  }
});

afterAll(() => {
  spie.forEach((spia) => spia.mockRestore());
});

function congela(valore) {
  if (valore === null || typeof valore !== 'object') return valore;
  Object.keys(valore).forEach((chiave) => congela(valore[chiave]));
  return Object.freeze(valore);
}

function con(extra) {
  return Object.assign({ requestId: ID }, extra || {});
}

function expectErrori(data, campi) {
  const risultato = validaRichiestaSetup(data);
  expect(risultato).toEqual({
    ok: false,
    codice: 'invalid-argument',
    motivo: 'dati-non-validi',
    campi
  });
  return risultato;
}

function risolvi(data, esistenti) {
  const validata = validaRichiestaSetup(data);
  expect(validata.ok).toBe(true);
  return risolviControAzienda(validata.richiesta, esistenti || {});
}

function assertSenzaValori(risultato, valori) {
  const json = JSON.stringify(risultato);
  for (const valore of valori) {
    expect(json.includes(String(valore))).toBe(false);
  }
}

describe('A — Caso giusto completo (8.7, prepara l\'1)', () => {
  it('pulisce la richiesta di Faenza e non tocca l\'input congelato', () => {
    const congelato = congela(structuredClone(ESEMPIO));
    const prima = structuredClone(congelato);
    let esito;
    expect(() => {
      esito = validaRichiestaSetup(congelato);
    }).not.toThrow();
    expect(congelato).toEqual(prima);
    expect(esito).toEqual({ ok: true, richiesta: ESEMPIO });

    const richiesta = congela(structuredClone(esito.richiesta));
    const primaRichiesta = structuredClone(richiesta);
    const esistenti = congela({ poderi: [], terreni: [], coltureAzienda: [] });
    let scritto;
    expect(() => {
      scritto = risolviControAzienda(richiesta, esistenti);
    }).not.toThrow();
    expect(richiesta).toEqual(primaRichiesta);
    expect(scritto).toEqual({
      ok: true,
      daScrivere: {
        sede: ESEMPIO.sede,
        poderiDaCreare: [{ nome: 'Casetti' }],
        poderiGiaPresenti: 0,
        terreni: [
          {
            nome: 'Campo grande',
            superficie: 2.34,
            coltura: 'Grano',
            colturaCategoria: 'seminativo',
            podere: 'Casetti'
          },
          {
            nome: 'Meleto',
            superficie: 1.2,
            coltura: 'Melo',
            colturaCategoria: 'frutteto'
          }
        ]
      }
    });
    expect(scritto.daScrivere.terreni[1]).not.toHaveProperty('podere');
  });
});

describe('(2) Sesto terreno e poderi di troppo (8.7)', () => {
  it('accetta 5 terreni e rifiuta il sesto senza leggere le righe', () => {
    const cinque = [1, 2, 3, 4, 5].map((n) => ({ nome: 'Campo ' + n, superficie: 1 }));
    expect(validaRichiestaSetup(con({ terreni: cinque })).ok).toBe(true);
    const sei = [1, 2, 3, 4, 5, 6].map(() => ({ nome: '', superficie: 0 }));
    expectErrori(con({ terreni: sei }), [{ campo: 'terreni', errore: 'troppi elementi' }]);
  });

  it('accetta 10 poderi e rifiuta l\'undicesimo senza leggere le righe', () => {
    const dieci = Array.from({ length: 10 }, (_, i) => ({ nome: 'Podere ' + (i + 1) }));
    expect(validaRichiestaSetup(con({ poderi: dieci })).ok).toBe(true);
    const undici = Array.from({ length: 11 }, () => ({ nome: '' }));
    expectErrori(con({ poderi: undici }), [{ campo: 'poderi', errore: 'troppi elementi' }]);
  });
});

describe('(12) tenantId dal browser (8.7)', () => {
  it('rifiuta tenantId', () => {
    expectErrori(con({ tenantId: 'altra_azienda_x' }), [
      { campo: 'tenantId', errore: 'chiave non ammessa' }
    ]);
  });
});

describe('(13) Campi in più (8.7)', () => {
  it('rifiuta sede.piva', () => {
    expectErrori(con({
      sede: { indirizzo: 'Via Prova Lunga 9', citta: 'CittaUnicaQX', piva: '12345678901' }
    }), [{ campo: 'sede.piva', errore: 'chiave non ammessa' }]);
  });

  it('rifiuta terreni[0].polygonCoords', () => {
    expectErrori(con({
      terreni: [{ nome: 'Campo prova', superficie: 1.5, polygonCoords: [[44.2851, 11.8832]] }]
    }), [{ campo: 'terreni[0].polygonCoords', errore: 'chiave non ammessa' }]);
  });

  it('rifiuta terreni[0].confini', () => {
    expectErrori(con({
      terreni: [{ nome: 'Campo prova', superficie: 1.5, confini: 'segnalatore-confini-XYZ' }]
    }), [{ campo: 'terreni[0].confini', errore: 'chiave non ammessa' }]);
  });

  it('rifiuta operai', () => {
    expectErrori(con({ operai: 3 }), [{ campo: 'operai', errore: 'chiave non ammessa' }]);
  });

  it('rifiuta mezzi', () => {
    expectErrori(con({ mezzi: [] }), [{ campo: 'mezzi', errore: 'chiave non ammessa' }]);
  });

  it('rifiuta nome e cognome al primo livello', () => {
    expectErrori(con({ nome: 'Mario', cognome: 'Rossi' }), [
      { campo: 'nome', errore: 'chiave non ammessa' },
      { campo: 'cognome', errore: 'chiave non ammessa' }
    ]);
  });

  it('rifiuta uid', () => {
    expectErrori(con({ uid: 'utente-segreto' }), [
      { campo: 'uid', errore: 'chiave non ammessa' }
    ]);
  });

  it('rifiuta __proto__ arrivato da JSON.parse', () => {
    const data = JSON.parse('{"requestId":"req-ok-1234","__proto__":{"admin":true}}');
    expectErrori(data, [{ campo: '__proto__', errore: 'chiave non ammessa' }]);
  });
});

describe('(14) Superficie (8.7)', () => {
  function superficie(valore, nome) {
    const terreno = { nome: nome || 'Campo prova' };
    if (valore !== undefined) terreno.superficie = valore;
    return con({ terreni: [terreno] });
  }

  it('rifiuta zero, negativi, oltre 1000, testo, NaN, Infinity e il valore che si arrotonda a zero', () => {
    expectErrori(superficie(0), [{ campo: 'terreni[0].superficie', errore: 'deve essere maggiore di 0' }]);
    expectErrori(superficie(-1), [{ campo: 'terreni[0].superficie', errore: 'deve essere maggiore di 0' }]);
    expectErrori(superficie(1000.01), [{ campo: 'terreni[0].superficie', errore: 'deve essere al massimo 1000' }]);
    expectErrori(superficie('2,34'), [{ campo: 'terreni[0].superficie', errore: 'deve essere un numero' }]);
    expectErrori(superficie(NaN), [{ campo: 'terreni[0].superficie', errore: 'deve essere un numero' }]);
    expectErrori(superficie(Infinity), [{ campo: 'terreni[0].superficie', errore: 'deve essere un numero' }]);
    expectErrori(superficie(undefined), [{ campo: 'terreni[0].superficie', errore: 'obbligatorio' }]);
    expectErrori(superficie(0.004), [{ campo: 'terreni[0].superficie', errore: 'troppo piccola' }]);
  });

  it('rifiuta ettari al posto di superficie', () => {
    expectErrori(con({ terreni: [{ nome: 'Campo prova', ettari: 2 }] }), [
      { campo: 'terreni[0].ettari', errore: 'chiave non ammessa' },
      { campo: 'terreni[0].superficie', errore: 'obbligatorio' }
    ]);
  });

  it('arrotonda a due decimali e accetta 1000', () => {
    expect(validaRichiestaSetup(superficie(2.345)).richiesta.terreni[0].superficie).toBe(2.35);
    expect(validaRichiestaSetup(superficie(1.005)).richiesta.terreni[0].superficie).toBe(1.01);
    expect(validaRichiestaSetup(superficie(1000)).richiesta.terreni[0].superficie).toBe(1000);
  });
});

describe('(15) Coltura (8.7)', () => {
  function soloColtura(coltura, esistenti) {
    return risolvi(con({
      terreni: [{ nome: 'Campo prova', superficie: 1, coltura }]
    }), esistenti);
  }

  it('salva il nome ufficiale dell\'elenco', () => {
    expect(soloColtura('melo').daScrivere.terreni[0].coltura).toBe('Melo');
    expect(soloColtura('  vite  da vino ').daScrivere.terreni[0].coltura).toBe('Vite da Vino');
    expect(soloColtura('fico d\u2019india').daScrivere.terreni[0].coltura).toBe("Fico d'India");
    expect(soloColtura('Olivo').daScrivere.terreni[0].coltura).toBe('Olivo');
  });

  it('rifiuta una categoria e un nome sconosciuto', () => {
    expect(soloColtura('seminativo').campi).toEqual([
      { campo: 'terreni[0].coltura', errore: 'è una categoria, non una coltura' }
    ]);
    expect(soloColtura('Banane di Marte').campi).toEqual([
      { campo: 'terreni[0].coltura', errore: 'coltura non trovata' }
    ]);
  });

  it('lascia assente la coltura vuota', () => {
    for (const coltura of [null, '']) {
      const validata = validaRichiestaSetup(con({
        terreni: [{ nome: 'Campo prova', superficie: 1, coltura }]
      }));
      expect(validata.ok).toBe(true);
      expect(validata.richiesta.terreni[0].coltura).toBeNull();
      const scritto = risolviControAzienda(validata.richiesta, {});
      expect(scritto.daScrivere.terreni[0]).not.toHaveProperty('coltura');
    }
  });

  it('accetta Sangiovese solo se è una coltura dell\'azienda, col nome già salvato', () => {
    expect(soloColtura('Sangiovese').campi).toEqual([
      { campo: 'terreni[0].coltura', errore: 'coltura non trovata' }
    ]);
    const scritto = soloColtura('  sangiovese ', { coltureAzienda: ['Sangiovese'] });
    expect(scritto.daScrivere.terreni[0].coltura).toBe('Sangiovese');
  });
});

describe('(16) Podere (8.7)', () => {
  it('rifiuta un podere che non c\'è né nella richiesta né in azienda', () => {
    const scritto = risolvi(con({
      terreni: [{ nome: 'Campo prova', superficie: 1, podere: 'Casetti' }]
    }));
    expect(scritto.campi).toEqual([
      { campo: 'terreni[0].podere', errore: 'podere non trovato' }
    ]);
  });

  it('riusa il nome del podere esattamente come è salvato in azienda', () => {
    const scritto = risolvi(con({
      poderi: [{ nome: 'Casetti' }],
      terreni: [{ nome: 'Campo grande', superficie: 1, podere: 'Casetti' }]
    }), { poderi: ['casetti '] });
    expect(scritto.daScrivere.poderiDaCreare).toEqual([]);
    expect(scritto.daScrivere.poderiGiaPresenti).toBe(1);
    expect(scritto.daScrivere.terreni[0].podere).toBe('casetti ');
  });
});

describe('(17) Lunghezze e formati (8.7)', () => {
  it('rifiuta testi e codici della lunghezza o della forma sbagliata', () => {
    const nomeLungo = 'N'.repeat(61);
    expectErrori(con({ terreni: [{ nome: nomeLungo, superficie: 1 }] }), [
      { campo: 'terreni[0].nome', errore: 'troppo lungo' }
    ]);
    expectErrori(con({ sede: { indirizzo: 'Ab', citta: 'Faenza' } }), [
      { campo: 'sede.indirizzo', errore: 'troppo corto' }
    ]);
    expectErrori(con({ sede: { indirizzo: 'Via Roma 10', citta: 'Q' } }), [
      { campo: 'sede.citta', errore: 'troppo corto' }
    ]);
    expectErrori(con({ sede: { indirizzo: 'Via Roma 10', citta: 'Faenza', cap: '4801' } }), [
      { campo: 'sede.cap', errore: 'formato non valido' }
    ]);
    expectErrori(con({ sede: { indirizzo: 'Via Roma 10', citta: 'Faenza', cap: 48018 } }), [
      { campo: 'sede.cap', errore: 'deve essere un testo' }
    ]);
    expectErrori(con({ sede: { indirizzo: 'Via Roma 10', citta: 'Faenza', provincia: 'RAV' } }), [
      { campo: 'sede.provincia', errore: 'troppo lungo' }
    ]);
    expectErrori(con({ sede: { indirizzo: 'Via Roma 10', citta: 'Faenza', provincia: 'R4' } }), [
      { campo: 'sede.provincia', errore: 'formato non valido' }
    ]);
    expectErrori({ requestId: 'abcdefg' }, [
      { campo: 'requestId', errore: 'troppo corto' }
    ]);
    expectErrori({ requestId: 'a'.repeat(65) }, [
      { campo: 'requestId', errore: 'troppo lungo' }
    ]);
    expectErrori({ requestId: 'abcd 1234' }, [
      { campo: 'requestId', errore: 'formato non valido' }
    ]);
    expectErrori({ requestId: 'abcd_1234' }, [
      { campo: 'requestId', errore: 'formato non valido' }
    ]);
  });

  it('accetta un nome di 60 caratteri, la provincia in minuscolo e un requestId uuid', () => {
    const nome = 'N'.repeat(60);
    const esito = validaRichiestaSetup(con({
      sede: { indirizzo: 'Via Roma 10', citta: 'Faenza', provincia: 'ra' },
      terreni: [{ nome, superficie: 1 }]
    }));
    expect(esito.ok).toBe(true);
    expect(esito.richiesta.sede.provincia).toBe('RA');
    expect(esito.richiesta.terreni[0].nome).toBe(nome);
    const id = crypto.randomUUID();
    expect(validaRichiestaSetup({
      requestId: id,
      sede: { indirizzo: 'Via Roma 10', citta: 'Faenza' }
    }).ok).toBe(true);
  });
});

describe('(18) Nomi doppi (8.7)', () => {
  it('segna il secondo terreno e il secondo podere ripetuti nella richiesta', () => {
    expectErrori(con({
      terreni: [
        { nome: 'Campo grande', superficie: 1 },
        { nome: 'campo  GRANDE ', superficie: 1 }
      ]
    }), [{ campo: 'terreni[1].nome', errore: 'nome ripetuto' }]);
    expectErrori(con({
      poderi: [{ nome: 'Casetti' }, { nome: 'casetti' }]
    }), [{ campo: 'poderi[1].nome', errore: 'nome ripetuto' }]);
  });

  it('rifiuta un terreno che ha già quel nome in azienda', () => {
    const scritto = risolvi(con({
      terreni: [{ nome: 'Campo grande', superficie: 1 }]
    }), { terreni: ['campo grande'] });
    expect(scritto.campi).toEqual([
      { campo: 'terreni[0].nome', errore: 'nome già usato da un terreno dell\'azienda' }
    ]);
  });
});

describe('(19) Niente da salvare (8.7)', () => {
  it('rifiuta una richiesta vuota e, se la forma è sbagliata, vince dati-non-validi', () => {
    const vuoto = {
      ok: false,
      codice: 'invalid-argument',
      motivo: 'niente-da-salvare'
    };
    expect(validaRichiestaSetup({ requestId: ID, sede: null, poderi: [], terreni: [] })).toEqual(vuoto);
    expect(validaRichiestaSetup({ requestId: ID })).toEqual(vuoto);
    expect(validaRichiestaSetup({ requestId: 'abc', sede: null, poderi: [], terreni: [] }).motivo).toBe('dati-non-validi');
  });
});

describe('(24) Elenco colture allineato (8.7)', () => {
  it('coincide con la fonte unica, nello stesso ordine, senza doppioni', () => {
    const coltureAttese = COLTURE_PREDEFINITE.map((coltura) => ({
      nome: coltura.nome,
      categoriaCodice: coltura.categoriaCodice
    }));
    const coltureAvute = coltureGenerate.COLTURE_PREDEFINITE.map((coltura) => ({
      nome: coltura.nome,
      categoriaCodice: coltura.categoriaCodice
    }));
    if (JSON.stringify(coltureAvute) !== JSON.stringify(coltureAttese)) {
      throw new Error(MESSAGGIO_RIGENERAZIONE);
    }

    const categorieAttese = CATEGORIE_COLTURE_PREDEFINITE.map((categoria) => ({
      nome: categoria.nome,
      codice: categoria.codice
    }));
    const categorieAvute = coltureGenerate.CATEGORIE_COLTURE_PREDEFINITE.map((categoria) => ({
      nome: categoria.nome,
      codice: categoria.codice
    }));
    if (JSON.stringify(categorieAvute) !== JSON.stringify(categorieAttese)) {
      throw new Error(MESSAGGIO_RIGENERAZIONE);
    }

    const percorso = fileURLToPath(new URL('../functions/config/colture-predefinite.js', import.meta.url));
    const disco = fs.readFileSync(percorso, 'utf8').replace(/\r/g, '');
    if (disco !== generaContenuto(COLTURE_PREDEFINITE, CATEGORIE_COLTURE_PREDEFINITE)) {
      throw new Error(MESSAGGIO_RIGENERAZIONE);
    }

    const viste = new Set();
    for (const coltura of coltureGenerate.COLTURE_PREDEFINITE) {
      const chiave = chiaveNome(coltura.nome);
      if (viste.has(chiave)) throw new Error(MESSAGGIO_RIGENERAZIONE);
      viste.add(chiave);
    }
    expect(coltureAvute).toHaveLength(99);
    expect(categorieAvute).toHaveLength(9);
  });
});

describe('B — Testi (8.7)', () => {
  it('rifiuta caratteri di controllo e invisibili, pulisce gli spazi e rifiuta i numeri', () => {
    expect(pulisciTesto('Via\nRoma')).toEqual({ ok: false, errore: 'caratteri non ammessi' });
    expect(pulisciTesto('\u0000')).toEqual({ ok: false, errore: 'caratteri non ammessi' });
    expect(pulisciTesto('Casetti\u200B')).toEqual({ ok: false, errore: 'caratteri non ammessi' });
    expect(pulisciTesto('Via   Roma\u00A012')).toEqual({ ok: true, valore: 'Via Roma 12' });
    expect(pulisciTesto(12)).toEqual({ ok: false, errore: 'deve essere un testo' });

    expectErrori(con({ sede: { indirizzo: 'Via\nRoma', citta: 'Faenza' } }), [
      { campo: 'sede.indirizzo', errore: 'caratteri non ammessi' }
    ]);
    expectErrori(con({ poderi: [{ nome: 'Casetti\u200B' }] }), [
      { campo: 'poderi[0].nome', errore: 'caratteri non ammessi' }
    ]);
    const pulita = validaRichiestaSetup(con({
      sede: { indirizzo: 'Via   Roma\u00A012', citta: 'Faenza' }
    }));
    expect(pulita.richiesta.sede.indirizzo).toBe('Via Roma 12');
    expectErrori(con({ sede: { indirizzo: 'Via Roma 10', citta: 12 } }), [
      { campo: 'sede.citta', errore: 'deve essere un testo' }
    ]);
  });
});

describe('C — Dimensione (8.7)', () => {
  it('si ferma se la richiesta supera i 10 KB', () => {
    const chiave = 'z'.repeat(20000);
    const data = { requestId: ID };
    data[chiave] = 'x';
    const risultato = expectErrori(data, [{ campo: '(richiesta)', errore: 'troppo grande' }]);
    expect(JSON.stringify(risultato).includes(chiave)).toBe(false);
  });

  it('rifiuta null, un elenco o un testo al posto dell\'oggetto', () => {
    for (const data of [null, ['no'], 'ciao']) {
      expectErrori(data, [{ campo: '(richiesta)', errore: 'deve essere un oggetto' }]);
    }
  });
});

describe('D — Niente valori negli errori (8.7, prepara il 23)', () => {
  it('non rimanda indietro i valori dei casi 13, 14, 17 e 18', () => {
    const casi = [
      {
        data: con({ tenantId: 'altra_azienda_x' }),
        valori: [ID, 'altra_azienda_x']
      },
      {
        data: con({
          sede: { indirizzo: 'Via Prova Lunga 9', citta: 'CittaUnicaQX', piva: '12345678901' }
        }),
        valori: [ID, 'Via Prova Lunga 9', 'CittaUnicaQX', '12345678901']
      },
      {
        data: con({
          terreni: [{ nome: 'Campo prova', superficie: 1.5, polygonCoords: [[44.2851, 11.8832]] }]
        }),
        valori: [ID, 'Campo prova', '44.2851', '11.8832', '1.5']
      },
      {
        data: con({
          terreni: [{ nome: 'Campo prova', superficie: 1.5, confini: 'segnalatore-confini-XYZ' }]
        }),
        valori: [ID, 'Campo prova', 'segnalatore-confini-XYZ', '1.5']
      },
      {
        data: con({ nome: 'Mario', cognome: 'Rossi' }),
        valori: [ID, 'Mario', 'Rossi']
      },
      {
        data: con({ uid: 'utente-segreto' }),
        valori: [ID, 'utente-segreto']
      },
      {
        data: con({ terreni: [{ nome: 'Campo prova', superficie: 1000.01 }] }),
        valori: [ID, 'Campo prova', '1000.01']
      },
      {
        data: con({ terreni: [{ nome: 'Campo prova', superficie: '2,34' }] }),
        valori: [ID, 'Campo prova', '2,34']
      },
      {
        data: con({ terreni: [{ nome: 'Campo prova', superficie: 0.004 }] }),
        valori: [ID, 'Campo prova', '0.004']
      },
      {
        data: con({ terreni: [{ nome: 'Campo prova', superficie: -1 }] }),
        valori: [ID, 'Campo prova', '-1']
      },
      {
        data: con({ terreni: [{ nome: 'N'.repeat(61), superficie: 1 }] }),
        valori: [ID, 'N'.repeat(61)]
      },
      {
        data: con({ sede: { indirizzo: 'Ab', citta: 'Faenza' } }),
        valori: [ID, 'Ab', 'Faenza']
      },
      {
        data: con({ sede: { indirizzo: 'Via Roma 10', citta: 'Q' } }),
        valori: [ID, 'Via Roma 10', 'Q']
      },
      {
        data: con({ sede: { indirizzo: 'Via Roma 10', citta: 'Faenza', cap: '4801' } }),
        valori: [ID, 'Via Roma 10', 'Faenza', '4801']
      },
      {
        data: con({ sede: { indirizzo: 'Via Roma 10', citta: 'Faenza', cap: 48018 } }),
        valori: [ID, 'Via Roma 10', 'Faenza', '48018']
      },
      {
        data: con({ sede: { indirizzo: 'Via Roma 10', citta: 'Faenza', provincia: 'RAV' } }),
        valori: [ID, 'Via Roma 10', 'Faenza', 'RAV']
      },
      {
        data: con({ sede: { indirizzo: 'Via Roma 10', citta: 'Faenza', provincia: 'R4' } }),
        valori: [ID, 'Via Roma 10', 'Faenza', 'R4']
      },
      {
        data: { requestId: 'abcdefg' },
        valori: ['abcdefg']
      },
      {
        data: { requestId: 'a'.repeat(65) },
        valori: ['a'.repeat(65)]
      },
      {
        data: { requestId: 'abcd 1234' },
        valori: ['abcd 1234']
      },
      {
        data: { requestId: 'abcd_1234' },
        valori: ['abcd_1234']
      },
      {
        data: con({
          terreni: [
            { nome: 'Campo grande', superficie: 1 },
            { nome: 'campo  GRANDE ', superficie: 2.5 }
          ]
        }),
        valori: [ID, 'Campo grande', 'campo  GRANDE ', '2.5']
      },
      {
        data: con({ poderi: [{ nome: 'Casetti' }, { nome: 'casetti' }] }),
        valori: [ID, 'Casetti', 'casetti']
      }
    ];

    for (const caso of casi) {
      assertSenzaValori(validaRichiestaSetup(caso.data), caso.valori);
    }

    const giaUsato = risolvi(con({
      terreni: [{ nome: 'Campo grande', superficie: 1 }]
    }), { terreni: ['campo grande'] });
    assertSenzaValori(giaUsato, [ID, 'Campo grande', 'campo grande']);
  });
});

describe('F — Limite per richiesta allineato al Free (8.7)', () => {
  it('usa lo stesso massimo terreni del piano Free', () => {
    expect(LIMITI.MAX_TERRENI_PER_RICHIESTA).toBe(SUBSCRIPTION_PLANS.free.maxTerreni);
  });
});

describe('G — Stessa regola del catalogo (8.7)', () => {
  it('chiaveNome coincide con normalizzaTesto sugli esempi', () => {
    const esempi = ['  Melo ', 'VITE  DA vino', "Fico d'India", '', null];
    for (const esempio of esempi) {
      expect(chiaveNome(esempio)).toBe(normalizzaTesto(esempio));
    }
  });
});

describe('sede — comune obbligatorio, via facoltativa', () => {
  it('accetta solo comune', () => {
    const pulita = validaRichiestaSetup({
      requestId: 'abc12345',
      sede: { citta: 'Faenza' },
      terreni: [{ nome: 'Campo', superficie: 1, coltura: 'Grano' }]
    });
    expect(pulita.ok).toBe(true);
    expect(pulita.richiesta.sede.citta).toBe('Faenza');
    expect(pulita.richiesta.sede.indirizzo).toBeUndefined();
  });
});

describe('H — Determinismo (8.7)', () => {
  it('due chiamate uguali danno lo stesso risultato, con i campi nello stesso ordine', () => {
    const input = {
      requestId: 'abc',
      sede: { indirizzo: 'ab', citta: 'c', cap: '12' }
    };
    const prima = validaRichiestaSetup(input);
    const seconda = validaRichiestaSetup(input);
    expect(seconda).toEqual(prima);
    expect(prima.campi.map((campo) => campo.campo)).toEqual([
      'requestId',
      'sede.indirizzo',
      'sede.citta',
      'sede.cap'
    ]);
    const scrittoPrima = risolviControAzienda(validaRichiestaSetup(ESEMPIO).richiesta, {});
    const scrittoDopo = risolviControAzienda(validaRichiestaSetup(ESEMPIO).richiesta, {});
    expect(scrittoDopo).toEqual(scrittoPrima);
  });
});

describe('E — Puro (8.7)', () => {
  it('non scrive log e non importa altro che l\'elenco colture', () => {
    for (const spia of spie) expect(spia).not.toHaveBeenCalled();

    const percorso = fileURLToPath(new URL('../functions/lib/tony-landing-setup-core.js', import.meta.url));
    const codice = fs.readFileSync(percorso, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    for (const voce of ['firebase-admin', 'firebase-functions', '@sentry', 'Buffer.', 'process.env']) {
      expect(codice.includes(voce)).toBe(false);
    }
    const requires = [...codice.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((trovato) => trovato[1]);
    expect(requires).toEqual(['../config/colture-predefinite']);
  });
});
