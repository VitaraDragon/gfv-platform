/**
 * G2 — Cerca indirizzo (Impostazioni): una sola ricerca valida, civico nel comune,
 * centro comune (locality → admin3, mai CAP), testo ricerca non sovrascritto, coda mappa.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  creaControlloRicercaSede,
  risolviRicercaSede,
  MSG_CARICO_MAPPA,
} from '../core/js/sede-ricerca-indirizzo.js';
import {
  scegliGeocodeNelComune,
  scegliCentroComune,
  isCivicoGeocodeResult,
  normalizzaComunePerMatch,
} from '../core/js/sede-geocode-match.js';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');

function comp(nome, ...types) {
  return { long_name: nome, short_name: nome, types };
}
function res(types, comps, extra = {}) {
  return {
    types,
    formatted_address: 'x',
    geometry: { location: { lat: () => 1, lng: () => 2 } },
    address_components: comps,
    ...extra,
  };
}

describe('scegliGeocodeNelComune: civico nel comune vince', () => {
  const routeLugo = res(['route'], [comp('Lugo', 'locality', 'political')]);
  const centroLugo = res(['locality', 'political'], [comp('Lugo', 'locality', 'political')]);

  it('premise in comune batte una route non-partial elencata prima', () => {
    const premise = res(['premise'], [comp('Lugo', 'locality', 'political')], { partial_match: true });
    expect(scegliGeocodeNelComune([routeLugo, premise], 'Lugo')).toBe(premise);
  });

  it('street_address partial_match in comune batte il centro comune', () => {
    const civico = res(['street_address'], [comp('Lugo', 'locality', 'political')], { partial_match: true });
    expect(scegliGeocodeNelComune([centroLugo, civico], 'Lugo')).toBe(civico);
  });

  it('civico in altro comune non vince su route nel comune giusto', () => {
    const altro = res(['street_address'], [comp('Fusignano', 'locality', 'political')]);
    expect(scegliGeocodeNelComune([altro, routeLugo], 'Lugo')).toBe(routeLugo);
  });

  it('tra più civici nel comune: non partial prima, poi ordine Google', () => {
    const a = res(['street_address'], [comp('Lugo', 'locality')], { partial_match: true });
    const b = res(['street_address'], [comp('Lugo', 'locality')]);
    expect(scegliGeocodeNelComune([a, b], 'Lugo')).toBe(b);
  });

  it('isCivicoGeocodeResult', () => {
    expect(isCivicoGeocodeResult({ types: ['subpremise'] })).toBe(true);
    expect(isCivicoGeocodeResult({ types: ['route'] })).toBe(false);
  });

  it('apostrofi tipografici e dritti equivalgono', () => {
    expect(normalizzaComunePerMatch('Sant\u2019Agata')).toBe(normalizzaComunePerMatch("Sant'Agata"));
  });
});

describe('scegliCentroComune: locality poi admin3, mai postal_code', () => {
  const cap = res(['postal_code'], [comp('48022', 'postal_code'), comp('Lugo', 'locality', 'political')]);
  const admin3 = res(
    ['administrative_area_level_3', 'political'],
    [comp('Lugo', 'administrative_area_level_3', 'political')]
  );
  const locality = res(['locality', 'political'], [comp('Lugo', 'locality', 'political')]);
  const frazione = res(
    ['locality', 'political'],
    [comp('Villanova', 'locality', 'political'), comp('Lugo', 'administrative_area_level_3', 'political')]
  );

  it('postal_code scartato anche se contiene la locality', () => {
    expect(scegliCentroComune([cap], 'Lugo')).toBeNull();
    expect(scegliCentroComune([cap, locality], 'Lugo')).toBe(locality);
  });

  it('locality ha precedenza su admin3 anche se admin3 viene prima', () => {
    expect(scegliCentroComune([admin3, locality], 'Lugo')).toBe(locality);
  });

  it('solo admin3 → admin3', () => {
    expect(scegliCentroComune([admin3], 'Lugo')).toBe(admin3);
  });

  it('locality = frazione NON è il centro del comune; admin3 sì', () => {
    expect(scegliCentroComune([frazione], 'Lugo')).toBeNull();
    expect(scegliCentroComune([frazione, admin3], 'Lugo')).toBe(admin3);
  });

  it('niente ripiego su civico / route', () => {
    const civico = res(['street_address'], [comp('Lugo', 'locality', 'political')]);
    expect(scegliCentroComune([civico], 'Lugo')).toBeNull();
  });
});

describe('creaControlloRicercaSede', () => {
  it('una sola richiesta valida: le vecchie diventano stale', () => {
    const c = creaControlloRicercaSede();
    const t1 = c.nuovaRichiesta('auto');
    const t2 = c.nuovaRichiesta('utente');
    expect(c.attuale(t1)).toBe(false);
    expect(c.attuale(t2)).toBe(true);
  });

  it('dopo Cerca dell’utente niente proposta automatica', () => {
    const c = creaControlloRicercaSede();
    expect(c.puoProporreAutomatica()).toBe(true);
    c.nuovaRichiesta('utente');
    expect(c.puoProporreAutomatica()).toBe(false);
  });

  it('la proposta automatica parte una sola volta', () => {
    const c = creaControlloRicercaSede();
    c.segnaAutoProposta();
    expect(c.puoProporreAutomatica()).toBe(false);
  });

  it('un solo toast per messaggio entro la finestra di dedup', () => {
    let t = 1000;
    const c = creaControlloRicercaSede({ adesso: () => t, dedupToastMs: 2000 });
    expect(c.daNotificare('ciao')).toBe(true);
    t += 500;
    expect(c.daNotificare('ciao')).toBe(false);
    expect(c.daNotificare('altro')).toBe(true);
    t += 3000;
    expect(c.daNotificare('altro')).toBe(true);
  });

  it('coda: tiene solo l’ultima ricerca e conta come click utente', () => {
    const c = creaControlloRicercaSede();
    c.accoda('via a', { origine: 'auto' });
    c.accoda('via b', { origine: 'utente' });
    expect(c.haCoda()).toBe(true);
    expect(c.utenteHaCercato()).toBe(true);
    expect(c.prendiCoda().query).toBe('via b');
    expect(c.haCoda()).toBe(false);
  });

  it('messaggio coda mappa', () => {
    expect(MSG_CARICO_MAPPA).toBe('Carico la mappa…');
  });
});

describe('risolviRicercaSede', () => {
  const locLugo = res(['locality', 'political'], [comp('Lugo', 'locality', 'political')]);
  const civicoLugo = res(['street_address'], [comp('Lugo', 'locality', 'political')]);
  const capLugo = res(['postal_code'], [comp('Lugo', 'locality', 'political')]);

  function geocodeDa(sequenza) {
    const chiamate = [];
    const fn = async (req) => {
      chiamate.push(req);
      return sequenza.shift() || [];
    };
    return { fn, chiamate };
  }

  it('civico trovato: un solo geocode, testo ricerca aggiornabile, region it', async () => {
    const g = geocodeDa([[civicoLugo]]);
    const r = await risolviRicercaSede({ geocode: g.fn, query: 'Via Roma 1, Lugo', comune: 'Lugo' });
    expect(r.esito).toBe('civico');
    expect(r.chosen).toBe(civicoLugo);
    expect(r.aggiornaTestoRicerca).toBe(true);
    expect(g.chiamate).toHaveLength(1);
    expect(g.chiamate[0].region).toBe('it');
  });

  it('civico non trovato → centro: toast «Non trovo il civico…», testo ricerca NON sovrascritto', async () => {
    const g = geocodeDa([[], [locLugo]]);
    const r = await risolviRicercaSede({ geocode: g.fn, query: 'Via Inesistente 9', comune: 'Lugo', provincia: 'RA' });
    expect(r.esito).toBe('centro');
    expect(r.messaggio).toMatch(/^Non trovo il civico/);
    expect(r.aggiornaTestoRicerca).toBe(false);
    expect(r.tipoToast).toBe('info');
  });

  it('centro: se c’è solo un CAP → nessun pin', async () => {
    const g = geocodeDa([[], [capLugo], [capLugo]]);
    const r = await risolviRicercaSede({ geocode: g.fn, query: 'Via X', comune: 'Lugo' });
    expect(r.esito).toBe('nessuno');
    expect(r.chosen).toBeNull();
    expect(r.messaggio).toMatch(/Non trovo questo indirizzo a Lugo/);
  });

  it('senza comune in anagrafica: vale il primo risultato', async () => {
    const g = geocodeDa([[civicoLugo, locLugo]]);
    const r = await risolviRicercaSede({ geocode: g.fn, query: 'Cantina Rossi', comune: '' });
    expect(r.esito).toBe('civico');
    expect(r.chosen).toBe(civicoLugo);
  });

  it('senza comune e senza risultati: errore generico', async () => {
    const g = geocodeDa([[]]);
    const r = await risolviRicercaSede({ geocode: g.fn, query: 'xx', comune: '' });
    expect(r.esito).toBe('nessuno');
    expect(r.tipoToast).toBe('error');
  });
});

describe('wiring impostazioni-standalone.html', () => {
  const html = read('core/admin/impostazioni-standalone.html');

  it('usa il controllo di ricerca (token stale, auto-proposta, coda mappa)', () => {
    expect(html).toContain('creaControlloRicercaSede');
    expect(html).toMatch(/sedeRicerca\.attuale\(token\)/);
    expect(html).toMatch(/sedeRicerca\.puoProporreAutomatica\(\)/);
    expect(html).toMatch(/sedeRicerca\.accoda\(/);
    expect(html).toMatch(/sedeRicerca\.haCoda\(\)/);
    expect(html).toContain('MSG_CARICO_MAPPA');
  });

  it('script Maps con language=it e region=IT (Impostazioni + config-loader)', () => {
    expect(html).toMatch(/maps\/api\/js\?[^`]*&language=it&region=IT/);
    expect(read('core/js/config-loader.js')).toMatch(/maps\/api\/js\?[^`]*&language=it&region=IT/);
  });

  it('non mostra più «Mappa non ancora caricata» come errore bloccante', () => {
    const blocco = html.slice(html.indexOf('function searchSedeAddressFromForm'), html.indexOf('function fillNotificheForm'));
    expect(blocco).not.toMatch(/Mappa non ancora caricata/);
  });

  it('un solo punto di avviso per la ricerca sede', () => {
    const blocco = html.slice(html.indexOf('function geocodeSedeQuery'), html.indexOf('function fillNotificheForm'));
    expect(blocco).not.toMatch(/showAlert\(/);
    expect(blocco).toMatch(/mostraAvvisoSede\(esito\.messaggio/);
  });
});
