/**
 * Banner assenze di Impegni giornalieri: un link «Scegli sostituto» per ogni lavoro in standby,
 * assenze passate con la data, avviso se i lavori in standby non sono verificabili.
 */
import { describe, it, expect } from 'vitest';
import { htmlBannerAssenzeImpegni } from '../core/js/impegni-assenze-banner.js';

const OGGI = '2026-10-21';
const opts = {
    giornoKey: OGGI,
    nomeOperaio: (id) => (id === 'ion' ? 'Ion Rossi' : id),
    escapeHtml: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
};

describe('htmlBannerAssenzeImpegni', () => {
    it('vuoto se non ci sono righe e i lavori sono verificati', () => {
        expect(htmlBannerAssenzeImpegni({ rows: [], standbyVerificato: true }, opts)).toBe('');
    });

    it('un link per ogni lavoro in standby, con sostitutoLavoroId nel deep link (non lavoroId: aprirebbe anche il dettaglio)', () => {
        const html = htmlBannerAssenzeImpegni({
            standbyVerificato: true,
            rows: [{
                id: 'A1',
                operaioId: 'ion',
                stato: 'confermata',
                tipoLabel: 'Malattia',
                dataInizioGiorno: OGGI,
                lavoriInStandby: [{ id: 'L1', nome: 'Vigna' }, { id: 'L2', nome: 'Oliveto' }]
            }]
        }, opts);
        expect(html).toContain('Assenze da gestire (1)');
        expect(html).toContain('gestione-lavori-standalone.html?assenzaId=A1&sostitutoLavoroId=L1&data=2026-10-21');
        expect(html).toContain('gestione-lavori-standalone.html?assenzaId=A1&sostitutoLavoroId=L2&data=2026-10-21');
        expect(html).not.toContain('&lavoroId=');
        expect(html).toContain('Scegli sostituto — Vigna');
        expect(html).toContain('Scegli sostituto — Oliveto');
    });

    it('assenza di un giorno passato: mostra la data; segnalata: un solo link senza sostitutoLavoroId', () => {
        const html = htmlBannerAssenzeImpegni({
            standbyVerificato: true,
            rows: [
                { id: 'A-ieri', operaioId: 'ion', stato: 'confermata', tipoLabel: 'Ferie', dataInizioGiorno: '2026-10-20', lavoriInStandby: [{ id: 'L1', nome: 'Vigna' }] },
                { id: 'S1', operaioId: 'ana', stato: 'segnalata', tipoLabel: 'Malattia', dataInizioGiorno: OGGI, lavoriInStandby: [] }
            ]
        }, opts);
        expect(html).toContain('Ferie (2026-10-20)');
        expect(html).toContain('assenzaId=A-ieri&sostitutoLavoroId=L1&data=2026-10-21">Scegli sostituto</a>');
        expect(html).toContain('assenzaId=S1&data=2026-10-21">Scegli sostituto</a>');
    });

    it('lettura dei lavori fallita: avviso visibile anche senza righe', () => {
        const html = htmlBannerAssenzeImpegni({ rows: [], standbyVerificato: false }, opts);
        expect(html).toContain('Non riesco a controllare i lavori in standby, riprova.');
        expect(html).toContain('Assenze da gestire (0)');
    });
});
