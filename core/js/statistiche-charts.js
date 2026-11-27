/**
 * Statistiche Charts - Gestione grafici Chart.js
 * Palette: modules/report (chartColorsForItems / seriesColorAt).
 *
 * @module core/js/statistiche-charts
 */

import {
    chartColorsForItems,
    readReportChartColors,
    seriesColorAt
} from '../../modules/report/js/report-chart-colors.js';

function palette() {
    return readReportChartColors();
}

/**
 * Abbrevia etichette lunghe sui grafici a barre orizzontali (mobile).
 * @param {string} label
 * @param {number} [max=18]
 * @returns {string}
 */
export function truncateChartLabel(label, max = 18) {
    const s = String(label || '');
    const limit = Number(max) > 0 ? Number(max) : 18;
    if (s.length <= limit) return s;
    return `${s.slice(0, Math.max(1, limit - 1))}…`;
}

/**
 * @param {string} hex
 * @param {number} alpha 0..1
 * @returns {string}
 */
function hexWithAlpha(hex, alpha) {
    const raw = String(hex || '').replace('#', '');
    if (raw.length !== 6) return hex;
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function yTickTruncateOptions() {
    return {
        callback: function (value) {
            const label = this.getLabelForValue
                ? this.getLabelForValue(value)
                : String(value ?? '');
            return truncateChartLabel(label, 16);
        }
    };
}

// ============================================
// FUNZIONI AGGIORNAMENTO GRAFICI BASE
// ============================================

/**
 * Aggiorna grafico ore per tipo lavoro
 * @param {Array} data - Array con tipoLavoro e ore
 * @param {Object} state - State object (chartOreTipo)
 * @param {Function} updateState - Funzione per aggiornare state
 * @param {Function} formatOre - Funzione per formattare ore
 */
export function updateChartOreTipo(data, state, updateState, formatOre) {
    let chartContainer = document.querySelector('.chart-card:has(canvas#chart-ore-tipo)') ||
                         document.querySelector('.chart-card:has([id*="chart-ore-tipo"])') ||
                         document.querySelector('#chart-ore-tipo')?.closest('.chart-card');

    if (!chartContainer) {
        const containers = document.querySelectorAll('.chart-card');
        chartContainer = containers[0];
    }

    if (!chartContainer) {
        console.error('Container per chart-ore-tipo non trovato');
        return;
    }

    let canvas = chartContainer.querySelector('canvas#chart-ore-tipo');

    if (!canvas || canvas.tagName !== 'CANVAS') {
        chartContainer.innerHTML = '<canvas id="chart-ore-tipo"></canvas>';
        canvas = document.getElementById('chart-ore-tipo');
    }

    if (state.chartOreTipo) {
        state.chartOreTipo.destroy();
    }

    if (data.length === 0) {
        chartContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>Nessun dato disponibile</p></div>';
        updateState({ chartOreTipo: null });
        return;
    }

    const colors = palette();
    const labels = data.map(d => d.tipoLavoro);
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: data.map(d => d.ore),
                backgroundColor: chartColorsForItems(labels, colors)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${formatOre(context.parsed)}`;
                        }
                    }
                }
            }
        }
    });

    updateState({ chartOreTipo: chart });
}

/**
 * Aggiorna grafico attività per terreno
 * @param {Array} data - Array con terrenoNome, numeroAttivita e oreTotali
 * @param {Object} state - State object (chartAttivitaTerreno)
 * @param {Function} updateState - Funzione per aggiornare state
 */
export function updateChartAttivitaTerreno(data, state, updateState) {
    let chartContainer = document.querySelector('.chart-card:has(canvas#chart-attivita-terreno)') ||
                         document.querySelector('#chart-attivita-terreno')?.closest('.chart-card');

    if (!chartContainer) {
        const containers = document.querySelectorAll('.chart-card');
        chartContainer = containers[1];
    }

    if (!chartContainer) {
        console.error('Container per chart-attivita-terreno non trovato');
        return;
    }

    let canvas = chartContainer.querySelector('canvas#chart-attivita-terreno');

    if (!canvas || canvas.tagName !== 'CANVAS') {
        chartContainer.innerHTML = '<canvas id="chart-attivita-terreno"></canvas>';
        canvas = document.getElementById('chart-attivita-terreno');
    }

    if (state.chartAttivitaTerreno) {
        state.chartAttivitaTerreno.destroy();
    }

    if (data.length === 0) {
        chartContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>Nessun dato disponibile</p></div>';
        updateState({ chartAttivitaTerreno: null });
        return;
    }

    const colors = palette();
    const labels = data.map(d => d.terrenoNome);
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Numero Attività',
                data: data.map(d => d.numeroAttivita),
                backgroundColor: chartColorsForItems(labels, colors)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });

    updateState({ chartAttivitaTerreno: chart });
}

/**
 * Aggiorna grafico ore per mese
 * @param {Array} data - Array con mese e ore
 * @param {Object} state - State object (chartOreMese)
 * @param {Function} updateState - Funzione per aggiornare state
 * @param {Function} formatOre - Funzione per formattare ore
 * @param {Function} formatMese - Funzione per formattare mese
 */
export function updateChartOreMese(data, state, updateState, formatOre, formatMese) {
    let chartContainer = document.querySelector('.chart-card:has(canvas#chart-ore-mese)') ||
                         document.querySelector('#chart-ore-mese')?.closest('.chart-card');

    if (!chartContainer) {
        const containers = document.querySelectorAll('.chart-card');
        chartContainer = containers[2];
    }

    if (!chartContainer) {
        console.error('Container per chart-ore-mese non trovato');
        return;
    }

    let canvas = chartContainer.querySelector('canvas#chart-ore-mese');

    if (!canvas || canvas.tagName !== 'CANVAS') {
        chartContainer.innerHTML = '<canvas id="chart-ore-mese"></canvas>';
        canvas = document.getElementById('chart-ore-mese');
    }

    if (state.chartOreMese) {
        state.chartOreMese.destroy();
    }

    if (data.length === 0) {
        chartContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>Nessun dato disponibile</p></div>';
        updateState({ chartOreMese: null });
        return;
    }

    const colors = palette();
    const line = seriesColorAt(0, colors);
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatMese(d.mese)),
            datasets: [{
                label: 'Ore Lavorate',
                data: data.map(d => d.ore),
                borderColor: line,
                backgroundColor: hexWithAlpha(line, 0.12),
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatOre(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatOre(value);
                        }
                    }
                }
            }
        }
    });

    updateState({ chartOreMese: chart });
}

/**
 * Aggiorna grafico top lavori
 * @param {Array} data - Array con tipoLavoro e frequenza
 * @param {Object} state - State object (chartTopLavori)
 * @param {Function} updateState - Funzione per aggiornare state
 */
export function updateChartTopLavori(data, state, updateState) {
    let chartContainer = document.querySelector('.chart-card:has(canvas#chart-top-lavori)') ||
                         document.querySelector('#chart-top-lavori')?.closest('.chart-card');

    if (!chartContainer) {
        const containers = document.querySelectorAll('.chart-card');
        chartContainer = containers[3];
    }

    if (!chartContainer) {
        console.error('Container per chart-top-lavori non trovato');
        return;
    }

    let canvas = chartContainer.querySelector('canvas#chart-top-lavori');

    if (!canvas || canvas.tagName !== 'CANVAS') {
        chartContainer.innerHTML = '<canvas id="chart-top-lavori"></canvas>';
        canvas = document.getElementById('chart-top-lavori');
    }

    if (state.chartTopLavori) {
        state.chartTopLavori.destroy();
    }

    if (data.length === 0) {
        chartContainer.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>Nessun dato disponibile</p></div>';
        updateState({ chartTopLavori: null });
        return;
    }

    const colors = palette();
    const labels = data.map(d => d.tipoLavoro);
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Frequenza',
                data: data.map(d => d.frequenza),
                backgroundColor: chartColorsForItems(labels, colors)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            layout: {
                padding: { left: 4, right: 8 }
            },
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                },
                y: {
                    ticks: yTickTruncateOptions()
                }
            }
        }
    });

    updateState({ chartTopLavori: chart });
}

// ============================================
// FUNZIONI AGGIORNAMENTO GRAFICI MACCHINE
// ============================================

/**
 * Aggiorna grafico top macchine
 * @param {Array} data - Array con macchinaId, nome, tipo e ore
 * @param {Object} state - State object (chartTopMacchine)
 * @param {Function} updateState - Funzione per aggiornare state
 * @param {Function} formatOre - Funzione per formattare ore
 */
export function updateChartTopMacchine(data, state, updateState, formatOre) {
    const chartContainer = document.querySelector('#chart-top-macchine')?.closest('.chart-card');
    if (!chartContainer) return;

    let canvas = chartContainer.querySelector('canvas#chart-top-macchine');
    if (!canvas) {
        chartContainer.querySelector('.chart-container').innerHTML = '<canvas id="chart-top-macchine"></canvas>';
        canvas = document.getElementById('chart-top-macchine');
    }

    if (state.chartTopMacchine) state.chartTopMacchine.destroy();

    if (data.length === 0) {
        chartContainer.querySelector('.chart-container').innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚜</div><p>Nessun dato disponibile</p></div>';
        updateState({ chartTopMacchine: null });
        return;
    }

    const colors = palette();
    const labels = data.map(d => d.nome);
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Ore Utilizzate',
                data: data.map(d => d.ore),
                backgroundColor: chartColorsForItems(labels, colors)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            layout: {
                padding: { left: 4, right: 8 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${formatOre(context.parsed.x)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatOre(value);
                        }
                    }
                },
                y: {
                    ticks: yTickTruncateOptions()
                }
            }
        }
    });

    updateState({ chartTopMacchine: chart });
}

/**
 * Aggiorna grafico ore macchina per terreno
 * @param {Array} data - Array con terrenoNome e ore
 * @param {Object} state - State object (chartOreMacchinaTerreno)
 * @param {Function} updateState - Funzione per aggiornare state
 * @param {Function} formatOre - Funzione per formattare ore
 */
export function updateChartOreMacchinaTerreno(data, state, updateState, formatOre) {
    const chartContainer = document.querySelector('#chart-ore-macchina-terreno')?.closest('.chart-card');
    if (!chartContainer) return;

    let canvas = chartContainer.querySelector('canvas#chart-ore-macchina-terreno');
    if (!canvas) {
        chartContainer.querySelector('.chart-container').innerHTML = '<canvas id="chart-ore-macchina-terreno"></canvas>';
        canvas = document.getElementById('chart-ore-macchina-terreno');
    }

    if (state.chartOreMacchinaTerreno) state.chartOreMacchinaTerreno.destroy();

    if (data.length === 0) {
        chartContainer.querySelector('.chart-container').innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚜</div><p>Nessun dato disponibile</p></div>';
        updateState({ chartOreMacchinaTerreno: null });
        return;
    }

    const colors = palette();
    const labels = data.map(d => d.terrenoNome);
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Ore Macchina',
                data: data.map(d => d.ore),
                backgroundColor: chartColorsForItems(labels, colors)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${formatOre(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatOre(value);
                        }
                    }
                }
            }
        }
    });

    updateState({ chartOreMacchinaTerreno: chart });
}

/**
 * Aggiorna grafico ore macchina vs lavoratore
 * @param {Object} data - Oggetto con oreLavoratore e oreMacchina
 * @param {Object} state - State object (chartOreMacchinaVsLavoratore)
 * @param {Function} updateState - Funzione per aggiornare state
 * @param {Function} formatOre - Funzione per formattare ore
 */
export function updateChartOreMacchinaVsLavoratore(data, state, updateState, formatOre) {
    const chartContainer = document.querySelector('#chart-ore-macchina-vs-lavoratore')?.closest('.chart-card');
    if (!chartContainer) return;

    let canvas = chartContainer.querySelector('canvas#chart-ore-macchina-vs-lavoratore');
    if (!canvas) {
        chartContainer.querySelector('.chart-container').innerHTML = '<canvas id="chart-ore-macchina-vs-lavoratore"></canvas>';
        canvas = document.getElementById('chart-ore-macchina-vs-lavoratore');
    }

    if (state.chartOreMacchinaVsLavoratore) state.chartOreMacchinaVsLavoratore.destroy();

    if (data.oreLavoratore === 0 && data.oreMacchina === 0) {
        chartContainer.querySelector('.chart-container').innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚜</div><p>Nessun dato disponibile</p></div>';
        updateState({ chartOreMacchinaVsLavoratore: null });
        return;
    }

    const colors = palette();
    const labels = ['Ore Lavoratore', 'Ore Macchina'];
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: [data.oreLavoratore, data.oreMacchina],
                backgroundColor: chartColorsForItems(labels, colors)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: { size: 11 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${formatOre(context.parsed)}`;
                        }
                    }
                }
            }
        }
    });

    updateState({ chartOreMacchinaVsLavoratore: chart });
}

/**
 * Aggiorna grafico ore macchine per mese
 * @param {Array} data - Array con mese e ore
 * @param {Object} state - State object (chartOreMacchineMese)
 * @param {Function} updateState - Funzione per aggiornare state
 * @param {Function} formatOre - Funzione per formattare ore
 * @param {Function} formatMese - Funzione per formattare mese
 */
export function updateChartOreMacchineMese(data, state, updateState, formatOre, formatMese) {
    const chartContainer = document.querySelector('#chart-ore-macchine-mese')?.closest('.chart-card');
    if (!chartContainer) return;

    let canvas = chartContainer.querySelector('canvas#chart-ore-macchine-mese');
    if (!canvas) {
        chartContainer.querySelector('.chart-container').innerHTML = '<canvas id="chart-ore-macchine-mese"></canvas>';
        canvas = document.getElementById('chart-ore-macchine-mese');
    }

    if (state.chartOreMacchineMese) state.chartOreMacchineMese.destroy();

    if (data.length === 0) {
        chartContainer.querySelector('.chart-container').innerHTML = '<div class="empty-state"><div class="empty-state-icon">🚜</div><p>Nessun dato disponibile</p></div>';
        updateState({ chartOreMacchineMese: null });
        return;
    }

    const colors = palette();
    const line = seriesColorAt(2, colors);
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatMese(d.mese)),
            datasets: [{
                label: 'Ore Macchine',
                data: data.map(d => d.ore),
                borderColor: line,
                backgroundColor: hexWithAlpha(line, 0.12),
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatOre(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatOre(value);
                        }
                    }
                }
            }
        }
    });

    updateState({ chartOreMacchineMese: chart });
}

// ============================================
// FUNZIONI AGGIORNAMENTO GRAFICI TERRENI
// ============================================

/**
 * Aggiorna grafico distribuzione terreni
 * @param {number} proprieta - Numero terreni di proprietà
 * @param {number} affitto - Numero terreni in affitto
 */
export function updateChartDistribuzioneTerreni(proprieta, affitto) {
    const ctx = document.getElementById('chart-distribuzione-terreni');
    if (!ctx) return;

    if (window.chartDistribuzioneTerreni) {
        window.chartDistribuzioneTerreni.destroy();
    }

    const colors = palette();
    const labels = ['Proprietà', 'Affitto'];
    window.chartDistribuzioneTerreni = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: [proprieta, affitto],
                backgroundColor: chartColorsForItems(labels, colors),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Aggiorna grafico distribuzione superficie
 * @param {number} proprieta - Superficie terreni di proprietà
 * @param {number} affitto - Superficie terreni in affitto
 */
export function updateChartDistribuzioneSuperficie(proprieta, affitto) {
    const ctx = document.getElementById('chart-distribuzione-superficie');
    if (!ctx) return;

    if (window.chartDistribuzioneSuperficie) {
        window.chartDistribuzioneSuperficie.destroy();
    }

    const colors = palette();
    const labels = ['Proprietà', 'Affitto'];
    window.chartDistribuzioneSuperficie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: [proprieta, affitto],
                backgroundColor: chartColorsForItems(labels, colors),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((context.parsed / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${context.parsed.toFixed(2)} ha (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}
