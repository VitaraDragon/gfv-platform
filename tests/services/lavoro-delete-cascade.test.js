import { describe, it, expect } from 'vitest';
import {
    normalizeRelatedLavoroId,
    matchesLavoroId,
    isRipresaFigliaDi,
    comunicazioneRiferisceLavoroInesistente,
    filterComunicazioniSenzaLavoroMorto,
    emptyRelatedCounts,
    relatedDeletableTotal,
    formatLavoroDeleteConfirmMessage,
    formatLavoroDeleteBlockedByRipreseMessage,
    assenzaCascadeAction,
    unlinkPreventivoPatch,
    buildLavoroCascadePlan
} from '../../core/services/lavoro-delete-cascade-utils.js';
import { comunicazioneVisibilePerOperaio } from '../../core/services/comunicazioni-squadra-utils.js';

describe('lavoro-delete-cascade-utils', () => {
    it('normalizeRelatedLavoroId estrae id da path Firestore', () => {
        expect(normalizeRelatedLavoroId('tenants/t1/lavori/abc')).toBe('abc');
        expect(normalizeRelatedLavoroId({ id: 'x1' })).toBe('x1');
        expect(normalizeRelatedLavoroId('')).toBe('');
    });

    it('matchesLavoroId allinea path e id semplice', () => {
        expect(matchesLavoroId('tenants/t/lavori/L1', 'L1')).toBe(true);
        expect(matchesLavoroId('L2', 'L1')).toBe(false);
    });

    it('isRipresaFigliaDi ignora il lavoro origine stesso', () => {
        expect(isRipresaFigliaDi({ id: 'orig', ripresaDaLavoroId: null }, 'orig')).toBe(false);
        expect(isRipresaFigliaDi({ id: 'rip1', ripresaDaLavoroId: 'orig' }, 'orig')).toBe(true);
        expect(isRipresaFigliaDi(
            { id: 'rip1', ripresaDaLavoroId: 'tenants/t/lavori/orig' },
            'orig'
        )).toBe(true);
    });

    it('comunicazioneRiferisceLavoroInesistente: senza lavoroId non è orfana', () => {
        expect(comunicazioneRiferisceLavoroInesistente({ messaggio: 'x' }, new Set(['L1']))).toBe(false);
        expect(comunicazioneRiferisceLavoroInesistente({ lavoroId: 'L1' }, new Set(['L1']))).toBe(false);
        expect(comunicazioneRiferisceLavoroInesistente({ lavoroId: 'dead' }, new Set(['L1']))).toBe(true);
        expect(comunicazioneRiferisceLavoroInesistente({ lavoroId: 'dead' }, null)).toBe(false);
    });

    it('filterComunicazioniSenzaLavoroMorto tiene broadcast e lavori vivi', () => {
        const rows = [
            { id: 'a', lavoroId: null },
            { id: 'b', lavoroId: 'L1' },
            { id: 'c', lavoroId: 'dead' }
        ];
        expect(filterComunicazioniSenzaLavoroMorto(rows, ['L1']).map((r) => r.id)).toEqual(['a', 'b']);
    });

    it('assenzaCascadeAction: lavoroId vince su standby', () => {
        expect(assenzaCascadeAction({ lavoroId: 'L1', standbyLavoroId: 'L1' }, 'L1')).toBe('delete');
    });

    it('unlinkPreventivoPatch ripristina pianificato → accettato_manager', () => {
        expect(unlinkPreventivoPatch({ stato: 'pianificato', lavoroId: 'L1' })).toEqual({
            lavoroId: null,
            stato: 'accettato_manager'
        });
        expect(unlinkPreventivoPatch({ stato: 'accettato_email', lavoroId: 'L1' })).toEqual({
            lavoroId: null
        });
        expect(unlinkPreventivoPatch(
            { stato: 'pianificato', calcoloVmId: 'c1' },
            new Set(['c1'])
        )).toEqual({
            lavoroId: null,
            stato: 'accettato_manager',
            calcoloVmId: null
        });
    });

    it('buildLavoroCascadePlan blocca riprese figlie', () => {
        const plan = buildLavoroCascadePlan({
            lavoroId: 'orig',
            lavoroNome: 'Erpicatura',
            lavori: [
                { id: 'orig', stato: 'sospeso' },
                { id: 'rip', ripresaDaLavoroId: 'orig' }
            ],
            ore: [{ id: 'o1' }]
        });
        expect(plan.blocked).toBe(true);
        expect(plan.reason).toBe('riprese_figlie');
        expect(plan.counts.ripreseFiglie).toBe(1);
        expect(plan.counts.ore).toBe(1);
        expect(plan.blockedMessage).toMatch(/ripresa/i);
        expect(plan.confirmMessage).toBe('');
    });

    it('buildLavoroCascadePlan conferma con conteggi e unlink', () => {
        const plan = buildLavoroCascadePlan({
            lavoroId: 'L1',
            lavoroNome: 'Potatura nord',
            lavori: [{ id: 'L1' }],
            ore: [{ id: 'o1' }, { id: 'o2' }],
            zone: [{ id: 'z1' }],
            comunicazioni: [{ id: 'c1', lavoroId: 'L1' }],
            attivita: [{ id: 'a1' }],
            assenze: [
                { id: 'as1', lavoroId: 'L1' },
                { id: 'as2', standbyLavoroId: 'L1' }
            ],
            trattamenti: [{ id: 't1' }, { id: 't2' }],
            raccolte: [{ id: 'r1' }],
            preventivi: [{ id: 'p1', stato: 'pianificato' }],
            guasti: [{ id: 'g1' }]
        });
        expect(plan.blocked).toBe(false);
        expect(plan.counts.ore).toBe(2);
        expect(plan.counts.trattamenti).toBe(2);
        expect(plan.counts.raccolte).toBe(1);
        expect(plan.counts.assenze).toBe(1);
        expect(plan.counts.assenzeStandbyUnlink).toBe(1);
        expect(plan.counts.preventivi).toBe(1);
        expect(plan.confirmMessage).toContain('Potatura nord');
        expect(plan.confirmMessage).toContain('2 ore operai');
        expect(plan.confirmMessage).toContain('preventivo collegato');
        expect(plan.confirmMessage).toContain('assenza in standby');
        expect(relatedDeletableTotal(plan.counts)).toBe(2 + 1 + 1 + 1 + 1 + 2 + 1);
    });

    it('formatLavoroDeleteConfirmMessage senza extra resta breve', () => {
        const msg = formatLavoroDeleteConfirmMessage('X', emptyRelatedCounts());
        expect(msg).toContain('"X"');
        expect(msg).not.toContain('Verranno eliminati anche');
        expect(msg).toContain('non può essere annullata');
    });

    it('formatLavoroDeleteBlockedByRipreseMessage plurale', () => {
        expect(formatLavoroDeleteBlockedByRipreseMessage({ ripreseFiglie: 3 })).toMatch(/3 lavori di ripresa/);
    });
});

describe('comunicazioneVisibilePerOperaio + lavoro morto', () => {
    const authUser = { uid: 'op1' };
    const userData = { id: 'op1' };

    it('nasconde anche con destinatari se il lavoro è morto', () => {
        const comm = { destinatari: ['op1'], lavoroId: 'dead', caposquadraId: 'capo' };
        expect(comunicazioneVisibilePerOperaio(comm, authUser, userData, 'capo', ['L1'], new Set(['L1']))).toBe(false);
    });

    it('resta visibile se il lavoro esiste', () => {
        const comm = { destinatari: ['op1'], lavoroId: 'L1' };
        expect(comunicazioneVisibilePerOperaio(comm, authUser, userData, [], ['L1'], new Set(['L1']))).toBe(true);
    });
});
