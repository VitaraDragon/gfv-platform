/**
 * G4 (F5: terreni conservati) e G5 (rumore console landing: warm-up una volta, blob audio).
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  salvaSessioneIntervista,
  leggiSessioneIntervista,
  costruisciSessioneIntervista,
  CHIAVE_SESSIONE_INTERVISTA,
} from '../../landing/src/lib/tony-sessione-intervista.js';
import { unisciDati, collegaTerreniAiPoderi } from '../../landing/src/lib/tony-aiuto-account.js';
import { creaPlayerVoce } from '../../landing/src/lib/tony-voce-player.js';

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), 'utf8');

function storageFinto() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m,
  };
}

describe('G4 — F5 con terreni raccolti', () => {
  const stato = (dati) => ({
    faseAiuto: true,
    aiutoFatto: false,
    messaggi: [{ ruolo: 'tony', testo: 'Quanti terreni?' }],
    storia: [],
    datiAiuto: dati,
    passoAiuto: 'terreni',
    sessione: 'abcdefabcdefabcdefabcd',
  });

  it('dopo ogni risposta (unisciDati) il conteggio terreni sopravvive a save → restore', () => {
    let dati = { sede: null, poderi: [], terreni: [] };
    const st = storageFinto();
    for (const nome of ['Campo A', 'Campo B', 'Campo C']) {
      dati = unisciDati(dati, { terreni: [{ nome, superficie: 2, coltura: 'Grano' }] }, 'terreni').dati;
      expect(salvaSessioneIntervista(st, stato(dati))).toBe(true);
      const letto = leggiSessioneIntervista(st);
      expect(letto.datiAiuto.terreni.length).toBe(dati.terreni.length);
    }
    const dopoF5 = collegaTerreniAiPoderi(leggiSessioneIntervista(st).datiAiuto);
    expect(dopoF5.terreni.map((t) => t.nome)).toEqual(['Campo A', 'Campo B', 'Campo C']);
  });

  it('mai email né password nel record', () => {
    const st = storageFinto();
    salvaSessioneIntervista(st, {
      ...stato({ sede: null, poderi: [], terreni: [{ nome: 'T1', superficie: 1 }] }),
      email: 'a@b.it',
      password: 'segreta123',
      messaggi: [
        { ruolo: 'utente', testo: 'scrivimi a mario@rossi.it, password: segreta123 ok' },
      ],
    });
    const raw = st.getItem(CHIAVE_SESSIONE_INTERVISTA);
    expect(raw).not.toMatch(/mario@rossi\.it|segreta123|a@b\.it/);
    expect(costruisciSessioneIntervista({ password: 'x', email: 'y@z.it' }, 1)).not.toHaveProperty('password');
  });

  it('TonyChat: salva dopo ogni risposta (forzato), su pagehide e a pagina nascosta', () => {
    const src = read('landing/src/components/TonyChat.vue');
    expect(src).toMatch(/function salvaSessioneCorrente\(forza\?: boolean\)/);
    expect(src).toMatch(/window\.addEventListener\('pagehide', onPageHide\)/);
    expect(src).toMatch(/window\.removeEventListener\('pagehide', onPageHide\)/);
    expect(src).toMatch(/function onPageHide\(\) \{\s*salvaSessioneCorrente\(true\);/);
    // dopo la risposta, prima della voce
    const iSalva = src.indexOf('salvaSessioneCorrente(true);\n  if (azione.tipo === \'limite\')');
    expect(iSalva > 0 || /salvaSessioneCorrente\(true\);\r?\n\s*if \(azione\.tipo === 'limite'\)/.test(src)).toBe(true);
    expect(src).toMatch(/if \(document\.hidden\) \{\s*salvaSessioneCorrente\(true\);/);
  });
});

describe('G5 — warm-up Tony una volta per load', () => {
  it('warmUpEndpointTony ha un guard module-level', () => {
    const src = read('landing/src/views/LandingHome.vue');
    expect(src).toMatch(/let warmUpEndpointTonyFatto = false;/);
    const fn = src.slice(src.indexOf('function warmUpEndpointTony()'), src.indexOf('function leggiRinunciaAvviso'));
    expect(fn).toMatch(/if \(warmUpEndpointTonyFatto\) return;\s*warmUpEndpointTonyFatto = true;/);
  });
});

describe('G5 — moduli_attivi warning → tonyDebugLog', () => {
  it('main.js non usa più console.warn per «moduli_attivi non ancora»', () => {
    const src = read('core/js/tony/main.js');
    expect(src).not.toMatch(/console\.warn\('\[Tony\] ATTENZIONE: moduli_attivi/);
    expect(src).toMatch(/tonyDebugLog\('\[Tony\] moduli_attivi non ancora nel contesto dashboard/);
  });
});

describe('G5 — tony-voce-player: revoca blob solo dopo ended/error (o sorgente staccata)', () => {
  function costruisci() {
    const eventi = [];
    const listeners = {};
    const audio = {
      preload: '',
      src: '',
      readyState: 4,
      volume: 1,
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
      removeAttribute: vi.fn(() => eventi.push('detach')),
      load: vi.fn(),
      set onplaying(fn) { listeners.playing = fn; },
      set onended(fn) { listeners.ended = fn; },
      set onerror(fn) { listeners.error = fn; },
      set oncanplay(fn) { listeners.canplay = fn; },
    };
    const player = creaPlayerVoce({
      AudioCtor: function Fake() { return audio; },
      createObjectURL: () => 'blob:x' + eventi.length,
      revokeObjectURL: (u) => eventi.push('revoke:' + u),
    });
    return { audio, player, listeners, eventi };
  }

  it('durante la riproduzione NON revoca; revoca solo a ended', async () => {
    const { player, listeners, eventi } = costruisci();
    const p = player.suona(new Blob([1]), { attesaMaxMs: 4000 });
    listeners.playing();
    expect(eventi.filter((e) => e.startsWith('revoke:'))).toHaveLength(0);
    listeners.ended();
    expect(await p).toBe('finita');
    expect(eventi.filter((e) => e.startsWith('revoke:'))).toHaveLength(1);
  });

  it('ferma() (interrotta) non revoca finché non cambia traccia / libera', async () => {
    const { player, eventi } = costruisci();
    const p = player.suona(new Blob([1]), { attesaMaxMs: 4000 });
    player.ferma();
    expect(await p).toBe('interrotta');
    expect(eventi.filter((e) => e.startsWith('revoke:'))).toHaveLength(0);
  });

  it('play() rifiutato: prima stacca src, poi revoca (mai revoca con src attivo)', async () => {
    const { player, audio, eventi } = costruisci();
    audio.play = vi.fn(() => Promise.reject(new Error('autoplay')));
    expect(await player.suona(new Blob([1]), { attesaMaxMs: 100 })).toBe('fallita');
    const iDetach = eventi.lastIndexOf('detach');
    const iRevoke = eventi.findIndex((e) => e.startsWith('revoke:'));
    expect(iDetach).toBeGreaterThanOrEqual(0);
    expect(iRevoke).toBeGreaterThan(-1);
    // l'ultimo detach precede la revoca del blob della traccia fallita
    expect(eventi.slice(0, iRevoke)).toContain('detach');
  });

  it('error sull’elemento: revoca', async () => {
    const { player, listeners, eventi } = costruisci();
    const p = player.suona(new Blob([1]), { attesaMaxMs: 4000 });
    listeners.error();
    expect(await p).toBe('fallita');
    expect(eventi.filter((e) => e.startsWith('revoke:'))).toHaveLength(1);
  });
});
