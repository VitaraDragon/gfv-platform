import { describe, expect, it, vi } from 'vitest';
import { hrefElencoLavoriCampo, urlDettaglioLavoroIncorporato } from '../core/mobile/js/field-lavori-embed.js';
import {
  creaSegnalatoreRiquadroOre,
  esitoLetturaRiquadroOre,
  esitoRiquadroOreSuErrore,
} from '../core/mobile/js/field-ore-riquadro.js';

describe('url dettaglio lavoro incorporato', () => {
  it('ha embed=mobile e il lavoro, senza ws=classic', () => {
    const url = urlDettaglioLavoroIncorporato({ lavoroId: 'lav-1' });
    expect(url).toContain('embed=mobile');
    expect(url).toContain('focusLavoroId=lav-1');
    expect(url).toContain('v=20260904c');
    expect(url).not.toContain('ws=classic');
    expect(url.startsWith('../admin/lavori-caposquadra-standalone.html?')).toBe(true);
  });

  it('nell’iframe l’elenco resta incorporato', () => {
    expect(hrefElencoLavoriCampo({ inIframe: true })).toBe('lavori-caposquadra-standalone.html?embed=mobile');
    expect(hrefElencoLavoriCampo({ inIframe: false })).toBe('lavori-caposquadra-standalone.html');
    expect(hrefElencoLavoriCampo({ inIframe: true })).not.toContain('ws=classic');
  });
});

describe('riquadro ore illeggibile', () => {
  it('tre letture negate: una scatola vuota, un solo warn, niente console.error', async () => {
    const warn = vi.fn();
    const errore = vi.spyOn(console, 'error').mockImplementation(() => {});
    const segnala = creaSegnalatoreRiquadroOre(warn);
    const leggi = async () => {
      const e = new Error('Missing or insufficient permissions');
      e.code = 'permission-denied';
      e.passoLetturaOre = 'oreOperai:lav-1';
      throw e;
    };
    for (let i = 0; i < 3; i += 1) {
      const esito = await esitoLetturaRiquadroOre(leggi, {
        etichettaGiorno: '10 ott',
        segnala,
      });
      expect(esito.ok).toBe(false);
      expect(esito.testo).toBe('Le tue ore del 10 ott: non disponibili ora.');
      expect(esito.dataState).toBe('ready');
      expect(esito.avviso).toBe('');
    }
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toBe('[FIELD-WORKSPACE] Riquadro ore giorno non leggibile:');
    expect(warn.mock.calls[0][1]).toBe('oreOperai:lav-1');
    expect(warn.mock.calls[0][2]).toBe('permission-denied');
    expect(errore).not.toHaveBeenCalled();
    errore.mockRestore();
  });

  it('dopo il salvataggio un permesso negato non mostra l’avviso e tiene il riepilogo', () => {
    const vista = esitoRiquadroOreSuErrore({
      codice: 'permission-denied',
      etichettaGiorno: '10 ott',
      dopoSalvataggio: true,
    });
    expect(vista.avviso).toBe('');
    expect(vista.mantieniPrecedente).toBe(true);
    expect(vista.dataState).toBe('ready');
  });
});
