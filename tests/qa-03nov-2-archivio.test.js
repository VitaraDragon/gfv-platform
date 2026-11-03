import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

vi.mock('../core/services/firebase-service.js', () => ({
  getCollectionData: vi.fn(),
  getDocumentData: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn()
}));

vi.mock('../core/services/tenant-service.js', () => ({
  getCurrentTenantId: vi.fn(() => 'tenant-1'),
  getCurrentUser: vi.fn(() => ({ uid: 'utente-1' })),
  getCurrentTenant: vi.fn()
}));

vi.mock('../core/services/plan-limits-service.js', () => ({
  assertCanCreateTerreno: vi.fn(),
  countAziendaTerreni: vi.fn()
}));

import { getCollectionData, getDocumentData } from '../core/services/firebase-service.js';
import { getAllTerreni, getCollegamentiTerreno } from '../core/services/terreni-service.js';
import { Terreno } from '../core/models/Terreno.js';
import {
  nomeTerrenoPerStorico,
  decidiAzioneTerreno,
  MESSAGGIO_VERIFICA_COLLEGAMENTI
} from '../shared/js/terreno-archivio.js';
import { eseguiEliminazioneOArchiviazione } from '../core/js/azione-eliminazione-terreno.js';

const root = path.resolve(import.meta.dirname, '..');

describe('Terreno.stato', () => {
  it('senza stato resta attivo', () => {
    const terreno = new Terreno({ nome: 'Campo' });
    expect(terreno.stato).toBe('attivo');
  });

  it('stato esplicito non valido è un errore', () => {
    expect(() => new Terreno({ nome: 'Campo', stato: 'cancellato' })).toThrow(/non valido/i);
  });
});

describe('getAllTerreni e gli archiviati', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCollectionData.mockResolvedValue([
      { id: 'a', nome: 'Attivo' },
      { id: 'b', nome: 'Vecchio', stato: 'archiviato' },
      { id: 'c', nome: 'Senza stato' }
    ]);
  });

  it('di default esclude gli archiviati e tiene i documenti senza stato', async () => {
    const lista = await getAllTerreni();
    expect(lista.map((t) => t.id).sort()).toEqual(['a', 'c']);
    expect(lista.find((t) => t.id === 'c').stato).toBe('attivo');
  });

  it('includiArchiviati li riporta tutti', async () => {
    const lista = await getAllTerreni({ includiArchiviati: true });
    expect(lista.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('getCollegamentiTerreno', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restituisce i conteggi', async () => {
    getCollectionData.mockImplementation(async (nome) => {
      if (nome === 'lavori') {
        return [
          { id: 'l1', nome: 'Potatura', stato: 'in_corso', dataInizio: '2026-03-01' },
          { id: 'l2', nome: 'Finito', stato: 'completato' }
        ];
      }
      if (nome === 'vigneti') return [{ id: 'v1' }];
      return [];
    });
    getDocumentData.mockResolvedValue({ id: 't1', nome: 'Campo' });
    const collegamenti = await getCollegamentiTerreno('t1');
    expect(collegamenti.lavori).toBe(2);
    expect(collegamenti.vigneti).toBe(1);
    expect(collegamenti.lavoriAperti).toHaveLength(1);
    expect(collegamenti.lavoriAperti[0].nome).toBe('Potatura');
  });

  it('se una query fallisce rilancia, non restituisce zero', async () => {
    getCollectionData.mockRejectedValue(new Error('rete'));
    await expect(getCollegamentiTerreno('t1')).rejects.toThrow(/rete/);
  });
});

describe('conferma elimina o archivia', () => {
  const terreno = { id: 't1', nome: 'Sangiovese' };

  it('con collegamenti archivia e non elimina', async () => {
    const eliminaTerreno = vi.fn();
    const archiviaTerreno = vi.fn();
    const esito = await eseguiEliminazioneOArchiviazione(terreno, {
      getCollegamentiTerreno: async () => ({ lavori: 1, lavoriAperti: [] }),
      archiviaTerreno,
      eliminaTerreno,
      confirm: () => true,
      chiediMotivo: () => '1',
      avvisa: vi.fn()
    });
    expect(esito.azione).toBe('archiviato');
    expect(archiviaTerreno).toHaveBeenCalledOnce();
    expect(eliminaTerreno).not.toHaveBeenCalled();
  });

  it('senza collegamenti elimina', async () => {
    const eliminaTerreno = vi.fn();
    const esito = await eseguiEliminazioneOArchiviazione(terreno, {
      getCollegamentiTerreno: async () => ({ lavori: 0, vigneti: 0, frutteti: 0, attivita: 0, campagne: 0, preventivi: 0, pianoStagione: 0 }),
      archiviaTerreno: vi.fn(),
      eliminaTerreno,
      confirm: () => true,
      chiediMotivo: () => '1',
      avvisa: vi.fn()
    });
    expect(esito.azione).toBe('eliminato');
    expect(eliminaTerreno).toHaveBeenCalledWith('t1');
  });

  it('se la verifica fallisce non cancella nulla', async () => {
    const eliminaTerreno = vi.fn();
    const avvisa = vi.fn();
    const esito = await eseguiEliminazioneOArchiviazione(terreno, {
      getCollegamentiTerreno: async () => { throw new Error('rete'); },
      archiviaTerreno: vi.fn(),
      eliminaTerreno,
      confirm: () => true,
      avvisa
    });
    expect(esito.azione).toBe('errore');
    expect(esito.messaggio).toBe(MESSAGGIO_VERIFICA_COLLEGAMENTI);
    expect(eliminaTerreno).not.toHaveBeenCalled();
    expect(avvisa).toHaveBeenCalled();
  });

  it('decidiAzioneTerreno con lavori propone archivia', () => {
    const decisione = decidiAzioneTerreno({
      ok: true,
      nome: 'Sangiovese',
      collegamenti: { lavori: 2 }
    });
    expect(decisione.azione).toBe('archivia');
    expect(decisione.messaggio).toMatch(/consultabili/i);
    expect(decisione.messaggio).not.toMatch(/eliminare il terreno/i);
  });
});

describe('nome nello storico', () => {
  it('un terreno archiviato si legge Nome (archiviato)', () => {
    expect(nomeTerrenoPerStorico({ nome: 'Sangiovese', stato: 'archiviato' })).toBe('Sangiovese (archiviato)');
    expect(nomeTerrenoPerStorico({ nome: 'Sangiovese', stato: 'attivo' })).toBe('Sangiovese');
  });

  it('le pagine di storico usano il suffisso', () => {
    const pagine = [
      'core/admin/js/gestione-lavori-controller.js',
      'core/js/dashboard-data.js',
      'core/admin/lavori-caposquadra-standalone.html',
      'modules/vigneto/js/vigneti-page.js'
    ];
    for (const relativo of pagine) {
      const testo = fs.readFileSync(path.join(root, relativo), 'utf8');
      expect(testo).toMatch(/nomeTerrenoPerStorico|nomeTerrenoCaposquadra|\(archiviato\)/);
    }
  });
});

describe('niente where sullo stato dei terreni', () => {
  it('il servizio terreni non filtra stato in query', () => {
    const testo = fs.readFileSync(path.join(root, 'core/services/terreni-service.js'), 'utf8');
    expect(testo).not.toMatch(/where\(\s*['"]stato['"]\s*,/);
  });
});

describe('filtro meteo functions', () => {
  it('un terreno archiviato non entra negli avvisi', () => {
    const require = createRequire(import.meta.url);
    const { terreniPerAvvisiMeteo } = require('../functions/meteo-terreni-filter.js');
    const lista = terreniPerAvvisiMeteo([
      { data: { nome: 'Attivo' } },
      { data: { nome: 'Vecchio', stato: 'archiviato' } },
      { data: { nome: 'Cliente', clienteId: 'c1' } }
    ]);
    expect(lista.map((r) => r.data.nome)).toEqual(['Attivo']);
  });
});
