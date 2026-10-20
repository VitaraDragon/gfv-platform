import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import polygonClipping from 'polygon-clipping';
import {
  computeWorkedAreaHa,
  computeWorkedAreaHaAsync,
  percentualeLavorata,
} from '../../core/services/zone-lavorate-area.js';

const pc = polygonClipping.default || polygonClipping;
const here = path.dirname(fileURLToPath(import.meta.url));

function quadrato(lat, lng, dLat, dLng) {
  return [
    { lat, lng },
    { lat, lng: lng + dLng },
    { lat: lat + dLat, lng: lng + dLng },
    { lat: lat + dLat, lng },
    { lat, lng },
  ];
}

describe('zone-lavorate-area', () => {
  const a = quadrato(43.7, 11.2, 0.001, 0.001);
  const b = quadrato(43.7004, 11.2004, 0.001, 0.001);

  it('quadrati che si sovrappongono: unione, non somma', () => {
    const soloA = computeWorkedAreaHa([{ isChiuso: true, coordinate: a }], null, pc);
    const soloB = computeWorkedAreaHa([{ isChiuso: true, coordinate: b }], null, pc);
    const unione = computeWorkedAreaHa(
      [
        { isChiuso: true, coordinate: a, superficieHa: 50 },
        { isChiuso: true, coordinate: b, superficieHa: 50 },
      ],
      null,
      pc
    );
    expect(unione).toBeGreaterThan(Math.max(soloA, soloB));
    expect(unione).toBeLessThan(soloA + soloB - 1e-6);
  });

  it('una zona che esce dal terreno viene ritagliata', () => {
    const terreno = quadrato(43.7, 11.2, 0.001, 0.001);
    const zona = quadrato(43.7005, 11.2005, 0.001, 0.001);
    const intera = computeWorkedAreaHa([{ isChiuso: true, coordinate: zona }], null, pc);
    const ritagliata = computeWorkedAreaHa([{ isChiuso: true, coordinate: zona }], terreno, pc);
    expect(ritagliata).toBeGreaterThan(0);
    expect(ritagliata).toBeLessThan(intera);
  });

  it('un segmento aperto si somma alla superficie chiusa', () => {
    const chiusa = computeWorkedAreaHa([{ isChiuso: true, coordinate: a }], null, pc);
    const conAperto = computeWorkedAreaHa(
      [
        { isChiuso: true, coordinate: a },
        { isChiuso: false, coordinate: [a[0], a[1]], superficieHa: 0.25 },
      ],
      null,
      pc
    );
    expect(conAperto).toBeCloseTo(chiusa + 0.25, 5);
  });

  it('la percentuale non supera 100 e ha un decimale', () => {
    expect(percentualeLavorata(5, 4)).toBe(100);
    expect(percentualeLavorata(0.278, 1)).toBe(27.8);
    expect(percentualeLavorata(0, 1)).toBe(0);
  });

  it('lista vuota → 0', async () => {
    expect(computeWorkedAreaHa([], quadrato(43.7, 11.2, 0.001, 0.001), pc)).toBe(0);
    await expect(computeWorkedAreaHaAsync([], null)).resolves.toBe(0);
  });

  it('tre punti con primo e ultimo entro 10 m sono un poligono chiuso', () => {
    const quasi = [
      { lat: 43.7, lng: 11.2 },
      { lat: 43.701, lng: 11.2 },
      { lat: 43.701, lng: 11.201 },
      { lat: 43.70000004, lng: 11.20000004 },
    ];
    const chiuso = computeWorkedAreaHa([{ isChiuso: false, coordinate: quasi, superficieHa: 9 }], null, pc);
    expect(chiuso).toBeGreaterThan(0);
    expect(chiuso).toBeLessThan(1);
  });

  it('Oliveto grande: unione 27,8%, la somma delle superficieHa è 32,4%', () => {
    const terreno = JSON.parse(
      readFileSync(path.join(here, '../fixtures/zone-lavorate/HTSfx-terreno.json'), 'utf8')
    );
    const zone = JSON.parse(
      readFileSync(path.join(here, '../fixtures/zone-lavorate/HTSfx-zone.json'), 'utf8')
    );
    const coords = terreno.polygonCoords || terreno.poligonoCoords || terreno.coordinates;
    const superficie = Number(terreno.superficie);
    const somma = zone.reduce((acc, z) => acc + (Number(z.superficieHa) || 0), 0);
    const unione = computeWorkedAreaHa(zone, coords, pc);
    expect(percentualeLavorata(somma, superficie)).toBe(32.4);
    expect(percentualeLavorata(unione, superficie)).toBe(27.8);
  });
});
