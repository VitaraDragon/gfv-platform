import { describe, expect, it } from 'vitest';
import {
  altroGuastoAttivoSulMezzo,
  campiMezziPerCreazione,
  idMezziCoinvolti,
  mezziDaRipristinare,
  statoRipristinoMezzo
} from '../../core/services/guasto-ripristino.js';

function ripristino(guasto, statiAttuali, guasti = []) {
  return mezziDaRipristinare(guasto).map((mezzo) => {
    const decisione = statoRipristinoMezzo({
      statoAttuale: statiAttuali[mezzo.id],
      statoPrima: mezzo.statoPrima,
      altroGuastoAttivoSulMezzo: altroGuastoAttivoSulMezzo(guasti, mezzo.id, guasto.id)
    });
    return { id: mezzo.id, ...decisione };
  });
}

describe('mezzi coinvolti', () => {
  it('segue il componente e scarta gli id vuoti', () => {
    expect(idMezziCoinvolti({
      componenteGuasto: 'entrambi',
      macchinaId: 'T',
      attrezzoId: 'A'
    })).toEqual(['T', 'A']);
    expect(idMezziCoinvolti({ componenteGuasto: 'trattore', macchinaId: 'T', attrezzoId: '' })).toEqual(['T']);
    expect(idMezziCoinvolti({ componenteGuasto: 'attrezzo', macchinaId: 'T', attrezzoId: 'A' })).toEqual(['A']);
    expect(idMezziCoinvolti({ macchinaId: 'T', attrezzoId: 'A' })).toEqual(['T']);
    expect(idMezziCoinvolti({ tipoGuasto: 'generico', macchinaId: 'T', attrezzoId: 'A' })).toEqual([]);
  });

  it('un guasto vecchio Trattore con attrezzoId non coinvolge l’attrezzo', () => {
    const vecchio = { id: 'g-vecchio', componenteGuasto: 'trattore', macchinaId: 'T', attrezzoId: 'A', stato: 'in-attesa' };
    expect(idMezziCoinvolti(vecchio)).toEqual(['T']);
    expect(altroGuastoAttivoSulMezzo([vecchio], 'A', 'g-corrente')).toBe(false);
    expect(altroGuastoAttivoSulMezzo([vecchio], 'T', 'g-corrente')).toBe(true);
  });
});

describe('campiMezziPerCreazione', () => {
  const selezionati = { macchinaId: 'T', attrezzoId: 'A' };

  it('con Trattore non salva l’attrezzo e non lo mette in guasto', () => {
    expect(campiMezziPerCreazione({ ...selezionati, componenteGuasto: 'trattore' })).toEqual({
      macchinaId: 'T',
      attrezzoId: null,
      mezziInGuasto: ['T']
    });
  });

  it('con Attrezzo tiene il trattore come riferimento e mette in guasto solo l’attrezzo', () => {
    expect(campiMezziPerCreazione({ ...selezionati, componenteGuasto: 'attrezzo' })).toEqual({
      macchinaId: 'T',
      attrezzoId: 'A',
      mezziInGuasto: ['A']
    });
  });

  it('con Entrambi mette in guasto tutti e due', () => {
    expect(campiMezziPerCreazione({ ...selezionati, componenteGuasto: 'entrambi' })).toEqual({
      macchinaId: 'T',
      attrezzoId: 'A',
      mezziInGuasto: ['T', 'A']
    });
  });
});

describe('mezziDaRipristinare', () => {
  it('entrambi, trattore, attrezzo, assente e generico', () => {
    expect(mezziDaRipristinare({
      componenteGuasto: 'entrambi',
      macchinaId: 'T',
      attrezzoId: 'A',
      statoMacchinaPrima: 'in_uso',
      statoAttrezzoPrima: 'disponibile'
    })).toEqual([
      { id: 'T', statoPrima: 'in_uso' },
      { id: 'A', statoPrima: 'disponibile' }
    ]);
    expect(mezziDaRipristinare({
      componenteGuasto: 'trattore',
      macchinaId: 'T',
      attrezzoId: 'A',
      statoMacchinaPrima: 'disponibile'
    })).toEqual([{ id: 'T', statoPrima: 'disponibile' }]);
    expect(mezziDaRipristinare({
      componenteGuasto: 'attrezzo',
      macchinaId: 'T',
      attrezzoId: 'A',
      statoAttrezzoPrima: 'in_uso'
    })).toEqual([{ id: 'A', statoPrima: 'in_uso' }]);
    expect(mezziDaRipristinare({
      macchinaId: 'T',
      attrezzoId: 'A',
      statoMacchinaPrima: 'disponibile'
    })).toEqual([{ id: 'T', statoPrima: 'disponibile' }]);
    expect(mezziDaRipristinare({ tipoGuasto: 'generico', macchinaId: 'T' })).toEqual([]);
  });
});

describe('statoRipristinoMezzo', () => {
  it('torna a in_uso o disponibile, e legge in-uso col trattino come in_uso', () => {
    expect(statoRipristinoMezzo({
      statoAttuale: 'guasto',
      statoPrima: 'in_uso',
      altroGuastoAttivoSulMezzo: false
    })).toMatchObject({ scrivi: true, stato: 'in_uso' });
    expect(statoRipristinoMezzo({
      statoAttuale: 'guasto',
      statoPrima: 'in-uso',
      altroGuastoAttivoSulMezzo: false
    })).toMatchObject({ scrivi: true, stato: 'in_uso' });
    expect(statoRipristinoMezzo({
      statoAttuale: 'guasto-lavoro-in-corso',
      statoPrima: 'disponibile',
      altroGuastoAttivoSulMezzo: false
    })).toMatchObject({ scrivi: true, stato: 'disponibile' });
  });

  it('senza statoPrima: il non grave torna in uso, il grave disponibile', () => {
    expect(statoRipristinoMezzo({
      statoAttuale: 'guasto-lavoro-in-corso',
      statoPrima: null,
      altroGuastoAttivoSulMezzo: false
    })).toMatchObject({ scrivi: true, stato: 'in_uso', motivo: 'senza-stato-prima' });
    expect(statoRipristinoMezzo({
      statoAttuale: 'guasto',
      statoPrima: '',
      altroGuastoAttivoSulMezzo: false
    })).toMatchObject({ scrivi: true, stato: 'disponibile' });
  });

  it('non scrive se qualcuno ha già cambiato il mezzo', () => {
    expect(statoRipristinoMezzo({
      statoAttuale: 'disponibile',
      statoPrima: 'in_uso',
      altroGuastoAttivoSulMezzo: false
    })).toMatchObject({ scrivi: false, motivo: 'gia-cambiato' });
    expect(statoRipristinoMezzo({
      statoAttuale: 'in_uso',
      statoPrima: 'disponibile',
      altroGuastoAttivoSulMezzo: false
    }).scrivi).toBe(false);
  });

  it('non scrive se c’è un altro guasto attivo, scrive se quell’altro è annullato', () => {
    const mezzo = { statoAttuale: 'guasto', statoPrima: 'disponibile' };
    expect(statoRipristinoMezzo({ ...mezzo, altroGuastoAttivoSulMezzo: true }))
      .toMatchObject({ scrivi: false, motivo: 'altro-guasto' });

    const annullato = [{
      id: 'altro',
      stato: 'annullato',
      componenteGuasto: 'trattore',
      macchinaId: 'T'
    }];
    expect(altroGuastoAttivoSulMezzo(annullato, 'T', 'corrente')).toBe(false);
    const esito = ripristino(
      { id: 'corrente', componenteGuasto: 'trattore', macchinaId: 'T', statoMacchinaPrima: 'disponibile' },
      { T: 'guasto' },
      annullato
    );
    expect(esito).toEqual([
      expect.objectContaining({ id: 'T', scrivi: true, stato: 'disponibile' })
    ]);
  });
});

describe('chiusura del manager', () => {
  it('entrambi: il trattore torna in_uso e l’attrezzo senza stato prima torna in_uso', () => {
    const esito = ripristino({
      id: 'g',
      componenteGuasto: 'entrambi',
      macchinaId: 'T',
      attrezzoId: 'A',
      statoMacchinaPrima: 'in_uso'
    }, { T: 'guasto', A: 'guasto-lavoro-in-corso' });
    expect(esito).toEqual([
      expect.objectContaining({ id: 'T', scrivi: true, stato: 'in_uso' }),
      expect.objectContaining({ id: 'A', scrivi: true, stato: 'in_uso' })
    ]);
    expect(JSON.stringify(esito)).not.toContain('in-uso');
  });

  it('guasto attrezzo: il trattore non compare', () => {
    const esito = ripristino({
      id: 'g',
      componenteGuasto: 'attrezzo',
      macchinaId: 'T',
      attrezzoId: 'A',
      statoAttrezzoPrima: 'disponibile'
    }, { T: 'in_uso', A: 'guasto-lavoro-in-corso' });
    expect(esito.map((m) => m.id)).toEqual(['A']);
    expect(esito[0].stato).toBe('disponibile');
    expect(JSON.stringify(esito)).not.toContain('in-uso');
  });
});
