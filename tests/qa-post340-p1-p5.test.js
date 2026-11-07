import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import {
  assertOraLavoroModificabile
} from '../core/services/ore-sola-lettura.js';
import {
  MESSAGGIO_ORE_SOLA_LETTURA
} from '../shared/js/storico-sola-lettura.js';
import {
  permessiOra,
  filtraOreValidabiliOperative,
  isOraSuLavoroSolaLettura
} from '../core/services/ore-operai-logic.js';
import {
  decidiEliminazioneColtura,
  MESSAGGIO_VERIFICA_USO_COLTURA
} from '../core/services/colture-elimina-logic.js';
import {
  calcolaMetricheTerreniAttivi,
  superficieTerreniAttivi
} from '../core/js/statistiche-controller.js';
import {
  componiEtichettaLavoroOre,
  nomeTerrenoPerEtichettaLavoro
} from '../core/services/ore-lavoro-selezionabile.js';
import { testoCodaValidazioneVuota } from '../core/services/manodopera-ore-validazione-scope.js';

const lavoroAttivo = { id: 'lav-a', terrenoId: 't1', stato: 'assegnato', caposquadraId: 'capo1' };
const terrenoAttivo = { id: 't1', nome: 'S340-C', stato: 'attivo', superficie: 2 };
const terrenoArchiviato = { id: 't1', nome: 'S340-C', stato: 'archiviato', superficie: 2 };

describe('P1 — cancellazione ore su lavoro sola lettura', () => {
  it('assertOraLavoroModificabile blocca terreno archiviato (stesso messaggio della modifica)', () => {
    expect(() => assertOraLavoroModificabile(lavoroAttivo, terrenoArchiviato))
      .toThrow(MESSAGGIO_ORE_SOLA_LETTURA);
  });

  it('permessiOra nasconde modifica/elimina su sola lettura senza indebolire ownership normale', () => {
    const sola = permessiOra({
      ora: { operaioId: 'op1', stato: 'da_validare' },
      lavoro: lavoroAttivo,
      userId: 'op1',
      isCaposquadra: false,
      isManager: false,
      terreno: terrenoArchiviato
    });
    expect(sola.puoModificare).toBe(false);
    expect(sola.puoEliminare).toBe(false);
    expect(sola.motivoBlocco).toBe(MESSAGGIO_ORE_SOLA_LETTURA);

    const ok = permessiOra({
      ora: { operaioId: 'op1', stato: 'da_validare' },
      lavoro: lavoroAttivo,
      userId: 'op1',
      isCaposquadra: false,
      isManager: false,
      terreno: terrenoAttivo
    });
    expect(ok.puoEliminare).toBe(true);

    const nonOwner = permessiOra({
      ora: { operaioId: 'op1', stato: 'da_validare' },
      lavoro: lavoroAttivo,
      userId: 'altro',
      isCaposquadra: false,
      isManager: false,
      terreno: terrenoAttivo
    });
    expect(nonOwner.puoEliminare).toBe(false);
  });

  it('eliminaOraPropria richiama il guard di sola lettura prima di deleteDoc', () => {
    const src = readFileSync('core/services/ore-service.js', 'utf8');
    const start = src.indexOf('export async function eliminaOraPropria');
    const next = src.indexOf('\nexport async function', start + 1);
    const body = src.slice(start, next > start ? next : undefined);
    expect(body).toMatch(/assertOraLavoroModificabile\s*\(\s*lavoro\s*,\s*terreno\s*\)/);
    const guardAt = body.indexOf('assertOraLavoroModificabile(lavoro, terreno)');
    const deleteAt = body.indexOf('await deleteDoc');
    expect(guardAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    expect(guardAt).toBeLessThan(deleteAt);
  });
});

describe('P2 — coltura ancora referenziata', () => {
  it('blocca con terreni (anche solo archiviati) e senza conferma force', () => {
    const esito = decidiEliminazioneColtura({
      predefinito: false,
      numAttivita: 0,
      numTerreni: 1,
      verificaOk: true
    });
    expect(esito.ok).toBe(false);
    expect(esito.messaggio).toMatch(/1 terreni/);
    expect(esito.messaggio).not.toMatch(/force/i);
  });

  it('fail-closed se la verifica non è completa; inutilizzata resta eliminabile', () => {
    expect(decidiEliminazioneColtura({ verificaOk: false }).ok).toBe(false);
    expect(decidiEliminazioneColtura({ verificaOk: false }).messaggio).toBe(MESSAGGIO_VERIFICA_USO_COLTURA);
    expect(decidiEliminazioneColtura({
      predefinito: false,
      numAttivita: 0,
      numTerreni: 0,
      verificaOk: true
    }).ok).toBe(true);
  });

  it('UI impostazioni non propone più «Eliminare comunque» per le colture', () => {
    const html = readFileSync('core/admin/impostazioni-standalone.html', 'utf8');
    const blocco = html.slice(
      html.indexOf('async function removeColtura'),
      html.indexOf('// ========== Gestione Tariffe Operai ==========')
    );
    expect(blocco).toMatch(/deleteColtura/);
    expect(blocco).not.toMatch(/Eliminare comunque/);
  });

  it('semantica: il conteggio «attività» è sul Diario, non su Gestione lavori', () => {
    const src = readFileSync('core/services/colture-service.js', 'utf8');
    expect(src).toMatch(/Diario/);
    expect(src).toMatch(/getCollectionData\('attivita'/);
    expect(src.includes("getCollectionData('lavori'")).toBe(false);
  });
});

describe('P3 — totali Statistiche solo terreni attivi', () => {
  it('esclude archiviati e cliente; dataset misto e vuoto', () => {
    const misto = calcolaMetricheTerreniAttivi([
      { id: '1', nome: 'A', superficie: 1 },
      { id: '2', nome: 'B', superficie: 2, stato: 'attivo' },
      { id: '3', nome: 'C', superficie: 3, stato: 'archiviato' },
      { id: '4', nome: 'Cli', superficie: 10, clienteId: 'x' }
    ]);
    expect(misto.totaleTerreni).toBe(2);
    expect(misto.superficieTotale).toBe(3);
    expect(superficieTerreniAttivi([
      { superficie: 1 },
      { superficie: 2, stato: 'attivo' },
      { superficie: 3, stato: 'archiviato' }
    ])).toBe(3);

    const vuoto = calcolaMetricheTerreniAttivi([]);
    expect(vuoto.totaleTerreni).toBe(0);
    expect(vuoto.superficieTotale).toBe(0);
  });
});

describe('P4 — ore da validare operative vs storico', () => {
  it('filtraOreValidabiliOperative esclude sola lettura e tiene le validabili', () => {
    const righe = [
      {
        id: 'o1',
        stato: 'da_validare',
        oreNette: 2,
        lavoro: lavoroAttivo,
        terreno: terrenoArchiviato
      },
      {
        id: 'o2',
        stato: 'da_validare',
        oreNette: 2,
        lavoro: { ...lavoroAttivo, id: 'lav-b' },
        terreno: terrenoAttivo
      }
    ];
    expect(isOraSuLavoroSolaLettura(righe[0])).toBe(true);
    const operative = filtraOreValidabiliOperative(righe);
    expect(operative.map((r) => r.id)).toEqual(['o2']);
  });

  it('testo «in attesa dei capisquadra» non conta ore di lavori archiviati', () => {
    const testo = testoCodaValidazioneVuota({
      isManager: true,
      isCaposquadra: false,
      righe: [
        {
          id: 'arch',
          stato: 'da_validare',
          lavoro: lavoroAttivo,
          terreno: terrenoArchiviato
        },
        {
          id: 'ok',
          stato: 'da_validare',
          lavoro: { id: 'lav-b', caposquadraId: 'capo1' },
          terreno: terrenoAttivo
        }
      ],
      visibili: []
    });
    expect(testo.inAttesaCapisquadra).toBe('1 ora in attesa dei capisquadra');
  });
});

describe('P5 — nome terreno in etichetta lavoro', () => {
  it('usa nome da oggetto terreno senza [object Object]', () => {
    expect(nomeTerrenoPerEtichettaLavoro({ nome: 'S340-C', stato: 'attivo' })).toBe('S340-C');
    expect(nomeTerrenoPerEtichettaLavoro({ nome: 'S340-C', stato: 'archiviato' })).toBe('S340-C (archiviato)');
    expect(componiEtichettaLavoroOre({
      nome: 'S340-C Potatura',
      terreno: { id: 't1', nome: 'S340-C', stato: 'attivo' }
    })).toBe('S340-C Potatura - S340-C');
    expect(componiEtichettaLavoroOre({
      nome: 'QACC-B Potatura',
      terreno: { id: 't2', nome: 'QACC-B', stato: 'archiviato' }
    })).toBe('QACC-B Potatura - QACC-B (archiviato)');
    expect(componiEtichettaLavoroOre({
      nome: 'Potatura',
      terrenoNome: 'Pinot',
      terreno: { nome: 'altro' }
    })).toBe('Potatura - Pinot');
  });

  it('riferimento assente o non accessibile non serializza oggetti', () => {
    expect(componiEtichettaLavoroOre({ nome: 'Potatura' })).toBe('Potatura');
    expect(componiEtichettaLavoroOre({ nome: 'Potatura', terreno: null })).toBe('Potatura');
    expect(componiEtichettaLavoroOre({ nome: 'Potatura', terreno: {} })).toBe('Potatura');
    expect(componiEtichettaLavoroOre({
      nome: 'Potatura',
      terreno: { id: 'x' }
    })).toBe('Potatura');
  });
});
