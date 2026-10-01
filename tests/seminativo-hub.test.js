/**
 * @vitest-environment node
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import {
  panoramicaHubSeminativo,
  raccolteRecentiHub,
  lavoriRecentiHub,
  testoPanoramicaHub
} from '../modules/seminativo/models/SeminativoHub.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'modules/seminativo/views/seminativo-dashboard-standalone.html'), 'utf8');
const pageJs = readFileSync(join(root, 'modules/seminativo/js/seminativo-hub-page.js'), 'utf8');

describe('Hub Seminativo — panoramica di campagna', () => {
  const now = new Date('2026-09-27T12:00:00');

  it('conta campagne aperte, ettari, semine e raccolte della campagna corrente', () => {
    const p = panoramicaHubSeminativo({
      now,
      campagne: [
        { id: 'c1', campagna: '2026/2027', stato: 'seminato', superficieEttari: 3.04 },
        { id: 'c2', campagna: '2026/2027', stato: 'chiuso', superficieEttari: 10 },
        { id: 'c3', campagna: '2025/2026', stato: 'raccolto', superficieEttari: 2 }
      ],
      semine: [
        { campagnaId: 'c1' },
        { campagnaId: 'c2' },
        { campagna: '2025/2026' }
      ],
      raccolte: [
        { campagnaId: 'c2' },
        { campagna: '2025/2026' }
      ]
    });

    expect(p.campagna).toBe('2026/2027');
    expect(p.campagneAperte).toBe(1);
    expect(p.ettari).toBe(3.04);
    expect(p.semine).toBe(2);
    expect(p.raccolte).toBe(1);
    expect(testoPanoramicaHub(p)).toContain('1 campagna aperta, 3.04 ha, 2 semine, 1 raccolta');
    expect(testoPanoramicaHub(p)).toContain('piano colturale');
  });

  it('senza dati mostra zeri sulla campagna corrente', () => {
    const p = panoramicaHubSeminativo({ now, campagne: [], semine: [], raccolte: [] });
    expect(p).toMatchObject({
      campagna: '2026/2027',
      campagneAperte: 0,
      ettari: 0,
      semine: 0,
      raccolte: 0
    });
  });

  it('la pagina non parla più di scheletro e segna solo il piano come in arrivo', () => {
    expect(html).not.toContain('Scheletro');
    expect(html).not.toContain('arriveranno nelle fasi');
    expect(html).toContain('refreshSeminativoHub');
    expect(html).toContain('stat-campagne');
    expect(html).toContain('table-raccolte');
    expect(html).toContain('table-lavori');
    expect(pageJs).toContain('In arrivo');
  });

  it('elenchi hub: mietiture della campagna e lavori a pieno campo', () => {
    const terreni = [{ id: 't1', nome: 'Campo Grano', podere: 'Barbavara' }];
    const campagne = [{ id: 'c1', campagna: '2026/2027', terrenoId: 't1', colturaNome: 'Grano' }];
    const raccolte = raccolteRecentiHub({
      now,
      campagne,
      terreni,
      raccolte: [
        { id: 'r1', campagnaId: 'c1', terrenoId: 't1', data: '2027-06-20', quantitaQli: 128, quantitaEttari: 3.2, costoManodopera: 60, costoMacchina: 48 },
        { id: 'r0', campagnaId: 'c9', campagna: '2025/2026', terrenoId: 't1', data: '2026-07-01', quantitaQli: 10, quantitaEttari: 2 }
      ]
    });
    expect(raccolte).toHaveLength(1);
    expect(raccolte[0]).toMatchObject({
      id: 'r1',
      terrenoNome: 'Campo Grano – Barbavara',
      quantitaQli: 128,
      resaQliHa: 40,
      costoTotale: 108
    });

    const lavori = lavoriRecentiHub({
      now,
      terreni,
      lavori: [
        { id: 'l1', terrenoId: 't1', stato: 'completato', tipoLavoro: 'Erpicatura', dataInizio: '2026-09-15' },
        { id: 'l2', terrenoId: 't1', stato: 'in_corso', tipoLavoro: 'Aratura', dataInizio: '2026-10-01' },
        { id: 'l3', terrenoId: 't1', stato: 'completato', tipoLavoro: 'Trattamento sulla fila', dataInizio: '2026-10-02' },
        { id: 'l4', terrenoId: 't1', stato: 'completato', tipoLavoro: 'Vendemmia Meccanica', dataInizio: '2026-10-03' },
        { id: 'l5', terrenoId: 'vite', stato: 'completato', tipoLavoro: 'Erpicatura', dataInizio: '2026-10-04' }
      ],
      attivita: [
        { id: 'a1', terrenoId: 't1', tipoLavoro: 'Erpicatura', data: '2026-09-15' },
        { id: 'a2', terrenoId: 't1', tipoLavoro: 'Concimazione meccanica a pieno campo', data: '2026-09-20' },
        { id: 'a3', terrenoId: 't1', tipoLavoro: 'Raccolta Meccanica', data: '2025-07-01', clienteId: 'cli' }
      ]
    });
    expect(lavori.map((row) => row.id)).toEqual(['a2', 'l1']);
    expect(lavori[1].source).toBe('lavoro');
    expect(lavori[0].source).toBe('diario');
  });
});
