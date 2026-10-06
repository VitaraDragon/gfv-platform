import { describe, it, expect } from 'vitest';
import {
  attivitaAperta,
  costruisciAttivitaDaLavoro,
  costruisciLavoroDaAttivita,
  contaLavoriAperti,
  formatToastMigrazione,
  messaggioLavoriAperti,
  serveSpinnerMigrazione,
  validateLavoroMigrazione,
  ETICHETTA_STORICO_PRE_MANODOPERA,
  ORIGINE_ATTIVITA_VERSO_LAVORO,
  ORIGINE_LAVORO_VERSO_ATTIVITA
} from '../../core/services/manodopera-migrazione-logic.js';
import {
  allineaDatiManodopera,
  migraAttivitaVersoLavori,
  migraLavoriVersoAttivita
} from '../../core/services/manodopera-migrazione-service.js';

const OGGI = '2026-10-06';

function attivitaBase(patch = {}) {
  return {
    id: 'att-1',
    data: '2024-03-12',
    terrenoId: 'ter-1',
    terrenoNome: 'Vigna Nord',
    tipoLavoro: 'Potatura',
    coltura: 'Sangiovese',
    orarioInizio: '08:00',
    orarioFine: '12:00',
    pauseMinuti: 30,
    oreNette: 3.5,
    note: 'Fila 2',
    ...patch
  };
}

function memoryIo(seed = {}) {
  const db = {
    tenant: { manodoperaModuloOsservato: false, ...(seed.tenant || {}) },
    attivita: (seed.attivita || []).map((row) => ({ ...row })),
    lavori: (seed.lavori || []).map((row) => ({ ...row })),
    terreni: (seed.terreni || [{ id: 'ter-1', nome: 'Vigna Nord', coltura: 'Sangiovese' }]).map((row) => ({ ...row })),
    operai: (seed.operai || [{ id: 'op-1' }]).map((row) => ({ ...row })),
    squadre: (seed.squadre || [{ id: 'sq-1' }]).map((row) => ({ ...row }))
  };
  let seq = 1;
  const deleted = [];
  return {
    db,
    deleted,
    currentTenantId: () => 'tenant-a',
    getTenant: async () => ({ ...db.tenant }),
    updateTenant: async (_id, patch) => {
      Object.assign(db.tenant, patch);
    },
    list: async (name) => (db[name] || []).map((row) => ({ ...row })),
    create: async (name, data) => {
      const id = `new-${name}-${seq}`;
      seq += 1;
      db[name].push({ id, ...data });
      return id;
    },
    update: async (name, id, patch) => {
      const row = (db[name] || []).find((item) => item.id === id);
      if (!row) throw new Error(`manca ${name}/${id}`);
      Object.assign(row, patch);
    },
    delete: async (name, id) => {
      deleted.push(`${name}/${id}`);
      throw new Error('la migrazione non deve cancellare');
    }
  };
}

describe('manodopera migrazione — mapping', () => {
  it('attività chiusa diventa lavoro completato', () => {
    const piano = costruisciLavoroDaAttivita(attivitaBase({ stato: 'chiusa' }), { oggi: OGGI, adesso: '2026-10-06T08:00:00.000Z' });
    expect(piano.solaLettura).toBe(false);
    expect(piano.lavoro.stato).toBe('completato');
    expect(piano.lavoro.durataPrevista).toBe(1);
    expect(piano.lavoro.caposquadraId).toBeNull();
    expect(piano.lavoro.operaioId).toBeNull();
    expect(piano.lavoro.assegnazioneEtichetta).toBe(ETICHETTA_STORICO_PRE_MANODOPERA);
    expect(piano.lavoro.note).toContain(ETICHETTA_STORICO_PRE_MANODOPERA);
    expect(piano.lavoro.note).toContain('Coltura: Sangiovese');
    expect(piano.lavoro.note).toContain('Ore nette: 3.5');
    expect(piano.lavoro.origineMigrazione).toBe(ORIGINE_ATTIVITA_VERSO_LAVORO);
    expect(piano.lavoro.nome).toBe('Potatura');
  });

  it('attività aperta diventa lavoro in_corso', () => {
    const piano = costruisciLavoroDaAttivita(attivitaBase({
      stato: 'aperta',
      data: OGGI
    }), { oggi: OGGI });
    expect(piano.lavoro.stato).toBe('in_corso');
    expect(attivitaAperta(attivitaBase({ inCorso: true, data: '2020-01-01' }), OGGI)).toBe(true);
  });

  it('oggi senza chiusura è in corso, un giorno passato è completato', () => {
    expect(attivitaAperta(attivitaBase({
      data: OGGI,
      orarioFine: '',
      stato: ''
    }), OGGI)).toBe(true);
    expect(attivitaAperta(attivitaBase({
      data: '2026-10-05',
      orarioFine: '',
      stato: ''
    }), OGGI)).toBe(false);
    const piano = costruisciLavoroDaAttivita(attivitaBase({
      data: OGGI,
      orarioFine: '',
      stato: ''
    }), { oggi: OGGI });
    expect(piano.lavoro.stato).toBe('in_corso');
  });

  it('accetta date più vecchie di un anno (bypass di Lavoro.validate)', () => {
    const piano = costruisciLavoroDaAttivita(attivitaBase({ data: '2018-02-01' }), { oggi: OGGI });
    expect(piano.solaLettura).toBe(false);
    expect(piano.lavoro.stato).toBe('completato');
    expect(validateLavoroMigrazione(piano.lavoro).valid).toBe(true);
    expect(validateLavoroMigrazione(piano.lavoro).errors.join(' ')).not.toMatch(/anno/i);
  });

  it('Altro, conto terzi incompleto e campi vuoti restano in sola lettura', () => {
    expect(costruisciLavoroDaAttivita(attivitaBase({ tipoLavoro: 'Altro' })).motivo).toBe('tipo-altro');
    expect(costruisciLavoroDaAttivita(attivitaBase({
      tipoLavoro: 'Conto terzi',
      clienteId: ''
    })).motivo).toBe('ct-incompleto');
    expect(costruisciLavoroDaAttivita(attivitaBase({ terrenoId: '' })).motivo).toBe('campi-vuoti');
  });

  it('conta i lavori non chiusi', () => {
    expect(contaLavoriAperti([
      { stato: 'in_corso' },
      { stato: 'assegnato' },
      { stato: 'completato' },
      { stato: 'annullato' },
      { stato: 'sospeso' }
    ])).toBe(3);
    expect(messaggioLavoriAperti(3)).toBe('Hai 3 lavori ancora aperti: chiudili o li vedrai solo in storico.');
  });

  it('un lavoro annullato diventa attività di storico con nota esplicita e orari di default', () => {
    const piano = costruisciAttivitaDaLavoro({
      id: 'lav-1',
      nome: 'Potatura vecchia',
      terrenoId: 'ter-1',
      tipoLavoro: 'Potatura',
      dataInizio: '2024-04-02',
      stato: 'annullato',
      note: 'Pioggia'
    }, { terreno: { id: 'ter-1', nome: 'Vigna Nord', coltura: 'Sangiovese' } });
    expect(piano.solaLettura).toBe(false);
    expect(piano.attivita.origineMigrazione).toBe(ORIGINE_LAVORO_VERSO_ATTIVITA);
    expect(piano.attivita.lavoroId).toBe('lav-1');
    expect(piano.attivita.coltura).toBe('Sangiovese');
    expect(piano.attivita.orarioInizio).toBe('08:00');
    expect(piano.attivita.note).toContain('Lavoro annullato');
    expect(piano.attivita.note).toContain('impostati di default');
  });

  it('lo spinner scatta solo sopra la soglia', () => {
    expect(serveSpinnerMigrazione(19)).toBe(false);
    expect(serveSpinnerMigrazione(20)).toBe(true);
    expect(formatToastMigrazione({ creati: 2, skipped: 3, solaLettura: 1 })).toBe(
      'Migrazione dati: 2 creati, 3 già collegati, 1 in sola lettura.'
    );
  });
});

describe('manodopera migrazione — esecuzione', () => {
  const ioOpts = (io) => ({ io, oggi: OGGI, adesso: '2026-10-06T08:00:00.000Z' });

  it('collega una attività già puntata a un lavoro esistente senza duplicare', async () => {
    const io = memoryIo({
      attivita: [attivitaBase({ lavoroId: 'lav-esiste' })],
      lavori: [{ id: 'lav-esiste', stato: 'completato', terrenoId: 'ter-1', nome: 'Già lì' }]
    });
    const prima = await migraAttivitaVersoLavori('tenant-a', ioOpts(io));
    const seconda = await migraAttivitaVersoLavori('tenant-a', ioOpts(io));
    expect(prima).toMatchObject({ creati: 0, skipped: 1, solaLettura: 0 });
    expect(seconda.skipped).toBe(1);
    expect(io.db.lavori).toHaveLength(1);
    expect(io.db.attivita).toHaveLength(1);
    expect(io.deleted).toEqual([]);
  });

  it('crea il lavoro, non cancella l’attività e alla seconda passata non duplica', async () => {
    const io = memoryIo({ attivita: [attivitaBase()] });
    const prima = await migraAttivitaVersoLavori('tenant-a', ioOpts(io));
    expect(prima.creati).toBe(1);
    expect(io.db.attivita[0].lavoroId).toBe(io.db.lavori[0].id);
    expect(io.db.lavori[0].migratoDaAttivitaId).toBe('att-1');
    expect(io.db.lavori[0].caposquadraId).toBeNull();
    expect(io.db.operai).toHaveLength(1);
    expect(io.db.squadre).toHaveLength(1);
    const seconda = await migraAttivitaVersoLavori('tenant-a', ioOpts(io));
    expect(seconda).toMatchObject({ creati: 0, skipped: 1 });
    expect(io.db.lavori).toHaveLength(1);
    expect(io.db.attivita).toHaveLength(1);
  });

  it('segna Altro in sola lettura e lascia il documento', async () => {
    const io = memoryIo({ attivita: [attivitaBase({ id: 'att-altro', tipoLavoro: 'Altro' })] });
    const report = await migraAttivitaVersoLavori('tenant-a', ioOpts(io));
    expect(report.solaLettura).toBe(1);
    expect(report.creati).toBe(0);
    expect(io.db.attivita).toHaveLength(1);
    expect(io.db.attivita[0].migrazioneSolaLettura).toBe(true);
    expect(io.db.attivita[0].migrazioneSolaLetturaMotivo).toBe('tipo-altro');
    expect(io.db.lavori).toHaveLength(0);
  });

  it('se il collegamento fallisce, la riprova non crea un secondo lavoro', async () => {
    const io = memoryIo({ attivita: [attivitaBase()] });
    let fail = true;
    const update = io.update;
    io.update = async (name, id, patch, tenantId) => {
      if (fail && name === 'attivita' && patch.lavoroId) {
        fail = false;
        throw new Error('rete');
      }
      return update(name, id, patch, tenantId);
    };
    const prima = await migraAttivitaVersoLavori('tenant-a', ioOpts(io));
    expect(prima.errori).toBe(1);
    expect(io.db.lavori).toHaveLength(1);
    expect(io.db.attivita[0].lavoroId).toBeUndefined();
    const seconda = await migraAttivitaVersoLavori('tenant-a', ioOpts(io));
    expect(seconda.skipped).toBe(1);
    expect(seconda.creati).toBe(0);
    expect(io.db.lavori).toHaveLength(1);
    expect(io.db.attivita[0].lavoroId).toBe(io.db.lavori[0].id);
  });

  it('rifiuta un tenant diverso da quello corrente', async () => {
    const io = memoryIo();
    await expect(migraAttivitaVersoLavori('tenant-b', ioOpts(io))).rejects.toThrow(/tenant corrente/);
  });

  it('in disattivazione non parte senza conferma se ci sono lavori aperti, e non cancella nulla', async () => {
    const io = memoryIo({
      tenant: { manodoperaModuloOsservato: true },
      lavori: [{
        id: 'lav-aperto',
        nome: 'Potatura',
        terrenoId: 'ter-1',
        tipoLavoro: 'Potatura',
        dataInizio: '2026-10-06',
        stato: 'in_corso'
      }]
    });
    const fermo = await allineaDatiManodopera('tenant-a', false, ioOpts(io));
    expect(fermo.needsConfirm).toBe(true);
    expect(fermo.lavoriAperti).toBe(1);
    expect(fermo.messaggio).toBe(messaggioLavoriAperti(1));
    expect(io.db.attivita).toHaveLength(0);
    expect(io.db.tenant.manodoperaModuloOsservato).toBe(true);

    const fatto = await allineaDatiManodopera('tenant-a', false, {
      ...ioOpts(io),
      confermaLavoriAperti: true,
      previousEffective: true
    });
    expect(fatto.creati).toBe(1);
    expect(io.db.lavori).toHaveLength(1);
    expect(io.db.attivita[0].lavoroId).toBe('lav-aperto');
    expect(io.db.operai).toHaveLength(1);
    expect(io.db.squadre).toHaveLength(1);
    expect(io.deleted).toEqual([]);

    const ripetuta = await migraLavoriVersoAttivita('tenant-a', ioOpts(io));
    expect(ripetuta).toMatchObject({ creati: 0, skipped: 1 });
    expect(io.db.attivita).toHaveLength(1);
  });

  it('copia anche un lavoro annullato e lascia operai e squadre', async () => {
    const io = memoryIo({
      lavori: [{
        id: 'lav-ann',
        nome: 'Vecchio',
        terrenoId: 'ter-1',
        tipoLavoro: 'Potatura',
        dataInizio: '2023-01-09',
        stato: 'annullato'
      }]
    });
    const report = await migraLavoriVersoAttivita('tenant-a', ioOpts(io));
    expect(report.creati).toBe(1);
    expect(io.db.attivita[0].note).toContain('Lavoro annullato');
    expect(io.db.lavori).toHaveLength(1);
    expect(io.db.operai).toHaveLength(1);
    expect(io.db.squadre).toHaveLength(1);
  });
});
