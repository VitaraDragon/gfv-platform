/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  updateChartOreTipo,
  updateChartTopMacchine
} from '../core/js/statistiche-charts.js';

function mountDiaryAndMachines() {
  document.body.innerHTML = `
    <div class="charts-grid">
      <div class="chart-card">
        <h3>Ore per Tipo Lavoro</h3>
        <div class="chart-container" data-chart-id="chart-ore-tipo">
          <canvas id="chart-ore-tipo"></canvas>
        </div>
      </div>
    </div>
    <div class="charts-grid">
      <div class="chart-card">
        <h3>Top 5 Macchine</h3>
        <div class="chart-container" data-chart-id="chart-top-macchine">
          <canvas id="chart-top-macchine"></canvas>
        </div>
      </div>
    </div>
  `;
}

beforeEach(() => {
  mountDiaryAndMachines();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({}));
  global.Chart = vi.fn(function ChartMock() {
    this.destroy = vi.fn();
  });
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  delete global.Chart;
});

describe('statistiche-charts — recovery dopo empty-state', () => {
  it('Diario: dopo «nessun dato» ridisegna senza F5', () => {
    const state = { chartOreTipo: null };
    const updateState = (patch) => Object.assign(state, patch);
    const formatOre = (n) => String(n);

    updateChartOreTipo([{ tipoLavoro: 'Potatura', ore: 3 }], state, updateState, formatOre);
    expect(global.Chart).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#chart-ore-tipo')).toBeTruthy();

    updateChartOreTipo([], state, updateState, formatOre);
    expect(state.chartOreTipo).toBeNull();
    expect(document.querySelector('[data-chart-id="chart-ore-tipo"] .empty-state')).toBeTruthy();
    expect(document.querySelector('#chart-ore-tipo')).toBeNull();
    expect(document.querySelector('[data-chart-id="chart-ore-tipo"]')).toBeTruthy();

    updateChartOreTipo([{ tipoLavoro: 'Potatura', ore: 5 }], state, updateState, formatOre);
    expect(global.Chart).toHaveBeenCalledTimes(2);
    expect(document.querySelector('#chart-ore-tipo')).toBeTruthy();
    expect(document.querySelector('[data-chart-id="chart-ore-tipo"] .empty-state')).toBeNull();
    expect(state.chartOreTipo).toBeTruthy();
  });

  it('Macchine: dopo «nessun dato» ridisegna senza F5', () => {
    const state = { chartTopMacchine: null };
    const updateState = (patch) => Object.assign(state, patch);
    const formatOre = (n) => String(n);

    updateChartTopMacchine(
      [{ macchinaId: 'm1', nome: 'Trattore', tipo: 'trattore', ore: 10 }],
      state,
      updateState,
      formatOre
    );
    expect(global.Chart).toHaveBeenCalledTimes(1);

    updateChartTopMacchine([], state, updateState, formatOre);
    expect(document.querySelector('[data-chart-id="chart-top-macchine"] .empty-state')).toBeTruthy();
    expect(document.querySelector('#chart-top-macchine')).toBeNull();

    updateChartTopMacchine(
      [{ macchinaId: 'm1', nome: 'Trattore', tipo: 'trattore', ore: 12 }],
      state,
      updateState,
      formatOre
    );
    expect(global.Chart).toHaveBeenCalledTimes(2);
    expect(document.querySelector('#chart-top-macchine')).toBeTruthy();
    expect(state.chartTopMacchine).toBeTruthy();
  });
});
