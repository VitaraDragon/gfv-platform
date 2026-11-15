/**
 * Famiglie di varianti della landing. Ogni riga confronta turno() con l'esito
 * già calcolato in famiglie-landing.js. Nessun browser, nessuna rete, nessun LLM.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { erroriColturaTerreniForm } from '../../landing/src/lib/tony-aiuto-account.js';
import { casiFamiglie } from './famiglie-landing.js';
import { turno } from './turno-intervista.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const casi = casiFamiglie();

describe('generatore famiglie', () => {
  it('calcola le varianti senza random, senza LLM e senza salvare su Firestore', () => {
    const src = fs.readFileSync(path.join(root, 'tests/allenatore/famiglie-landing.js'), 'utf8');
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/tonyLandingSetup/);
    expect(casi.length).toBeGreaterThan(200);
  });
});

function gira(caso) {
  const stato = caso.stato();
  let esito = null;
  for (const passo of caso.passi) {
    esito = turno(stato, passo.domanda, passo.modello);
  }
  return esito;
}

function controlla(caso, esito) {
  const a = caso.atteso;
  if (typeof a.nTerreni === 'number') expect(esito.terreni, caso.id).toHaveLength(a.nTerreni);
  if (typeof a.nPoderi === 'number') expect(esito.poderi || [], caso.id).toHaveLength(a.nPoderi);
  if (Array.isArray(a.terreni)) {
    for (const t of a.terreni) {
      const trovato = (esito.terreni || []).find((x) => x && x.nome === t.nome);
      expect(trovato, caso.id + ' ' + t.nome).toBeTruthy();
      expect(trovato, caso.id).toMatchObject(t);
    }
  }
  if (Array.isArray(a.nomiAssenti)) {
    for (const nome of a.nomiAssenti) {
      expect(
        (esito.terreni || []).some((x) => x && x.nome === nome),
        caso.id
      ).toBe(false);
    }
  }
  if (a.sede) expect(esito.sede, caso.id).toMatchObject(a.sede);
  if (a.passo) expect(esito.passo, caso.id).toBe(a.passo);
  if (a.testo) expect(esito.testo, caso.id).toMatch(a.testo);
  if (a.testoAssente) expect(esito.testo, caso.id).not.toMatch(a.testoAssente);
  if (typeof a.apriRiepilogo === 'boolean') {
    expect(esito.apriRiepilogo, caso.id).toBe(a.apriRiepilogo);
  }
  if (a.voceUguale) expect(esito.voce, caso.id).toBe(esito.testo);
  if (a.colturaNonTrovata === true) {
    const errori = erroriColturaTerreniForm(esito.terreni, { terreni: esito.terreni });
    expect(
      errori.some((e) => /non trovat/i.test(String(e && e.errore))),
      caso.id
    ).toBe(true);
  }
  if (a.colturaNonTrovata === false) {
    const errori = erroriColturaTerreniForm(esito.terreni, { terreni: esito.terreni });
    const nuovo = (a.terreni || [])[0];
    if (nuovo) {
      expect(
        errori.some(
          (e) => /non trovat/i.test(String(e && e.errore)) && String(e.campo).includes('1')
        ),
        caso.id
      ).toBe(false);
    }
  }
}

describe('famiglie landing', () => {
  for (const caso of casi) {
    const titolo = caso.skip ? caso.id + ' — ' + caso.skip : caso.id;
    const prova = caso.skip ? it.skip : it;
    prova(titolo, () => {
      controlla(caso, gira(caso));
    });
  }
});
