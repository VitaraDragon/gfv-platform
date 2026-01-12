/**
 * Statistiche Charts - Gestione grafici Chart.js
 * 
 * @module core/js/statistiche-charts
 */

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
    // Trova sempre il container direttamente dal DOM usando querySelector
    let chartContainer = document.querySelector('.chart-card:has(canvas#chart-ore-tipo)') || 
                         document.querySelector('.chart-card:has([id*="chart-ore-tipo"])') ||
                         document.querySelector('#chart-ore-tipo')?.closest('.chart-card');
    
    // Se non trovato, cerca tra tutti i chart-card (fallback)
    if (!chartContainer) {
        const containers = document.querySelectorAll('.chart-card');
        // Il primo chart-card dovrebbe essere quello delle ore per tipo
        chartContainer = containers[0];
    }
    
    if (!chartContainer) {
        console.error('Container per chart-ore-tipo non trovato');
        return;
    }
    
    let canvas = chartContainer.querySelector('canvas#chart-ore-tipo');
    
    // Se il canvas non esiste o è stato sostituito, ricrearlo
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
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(d => d.tipoLavoro),
            datasets: [{
                data: data.map(d => d.ore),
                backgroundColor: [
                    '#2E8B57', '#007bff', '#ff9800', '#9c27b0', '#e91e63',
                    '#00bcd4', '#4caf50', '#ffc107', '#795548', '#607d8b'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
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
    // Trova sempre il container direttamente dal DOM
    let chartContainer = document.querySelector('.chart-card:has(canvas#chart-attivita-terreno)') || 
                         document.querySelector('#chart-attivita-terreno')?.closest('.chart-card');
    
    // Se non trovato, cerca tra tutti i chart-card (fallback)
    if (!chartContainer) {
        const containers = document.querySelectorAll('.chart-card');
        // Il secondo chart-card dovrebbe essere quello delle attività per terreno
        chartContainer = containers[1];
    }
    
    if (!chartContainer) {
        console.error('Container per chart-attivita-terreno non trovato');
        return;
    }
    
    let canvas = chartContainer.querySelector('canvas#chart-attivita-terreno');
    
    // Se il canvas non esiste o è stato sostituito, ricrearlo
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
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.terrenoNome),
            datasets: [{
                label: 'Numero Attività',
                data: data.map(d => d.numeroAttivita),
                backgroundColor: '#2E8B57'
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
    // Trova sempre il container direttamente dal DOM
    let chartContainer = document.querySelector('.chart-card:has(canvas#chart-ore-mese)') || 
                         document.querySelector('#chart-ore-mese')?.closest('.chart-card');
    
    // Se non trovato, cerca tra tutti i chart-card (fallback)
    if (!chartContainer) {
        const containers = document.querySelectorAll('.chart-card');
        // Il terzo chart-card dovrebbe essere quello delle ore per mese
        chartContainer = containers[2];
    }
    
    if (!chartContainer) {
        console.error('Container per chart-ore-mese non trovato');
        return;
    }
    
    let canvas = chartContainer.querySelector('canvas#chart-ore-mese');
    
    // Se il canvas non esiste o è stato sostituito, ricrearlo
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
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatMese(d.mese)),
            datasets: [{
                label: 'Ore Lavorate',
                data: data.map(d => d.ore),
                borderColor: '#2E8B57',
                backgroundColor: 'rgba(46, 139, 87, 0.1)',
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
    // Trova sempre il container direttamente dal DOM
    let chartContainer = document.querySelector('.chart-card:has(canvas#chart-top-lavori)') || 
                         document.querySelector('#chart-top-lavori')?.closest('.chart-card');
    
    // Se non trovato, cerca tra tutti i chart-card (fallback)
    if (!chartContainer) {
        const containers = document.querySelectorAll('.chart-card');
        // Il quarto chart-card dovrebbe essere quello dei top lavori
        chartContainer = containers[3];
    }
    
    if (!chartContainer) {
        console.error('Container per chart-top-lavori non trovato');
        return;
    }
    
    let canvas = chartContainer.querySelector('canvas#chart-top-lavori');
    
    // Se il canvas non esiste o è stato sostituito, ricrearlo
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
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.tipoLavoro),
            datasets: [{
                label: 'Frequenza',
                data: data.map(d => d.frequenza),
                backgroundColor: '#007bff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
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
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.nome),
            datasets: [{
                label: 'Ore Utilizzate',
                data: data.map(d => d.ore),
                backgroundColor: '#007bff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
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
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.terrenoNome),
            datasets: [{
                label: 'Ore Macchina',
                data: data.map(d => d.ore),
                backgroundColor: '#2E8B57'
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
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ore Lavoratore', 'Ore Macchina'],
            datasets: [{
                data: [data.oreLavoratore, data.oreMacchina],
                backgroundColor: ['#2E8B57', '#007bff']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' },
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
    
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => formatMese(d.mese)),
            datasets: [{
                label: 'Ore Macchine',
                data: data.map(d => d.ore),
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
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
    
    window.chartDistribuzioneTerreni = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Proprietà', 'Affitto'],
            datasets: [{
                data: [proprieta, affitto],
                backgroundColor: ['#28a745', '#17a2b8'],
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
    
    window.chartDistribuzioneSuperficie = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Proprietà', 'Affitto'],
            datasets: [{
                data: [proprieta, affitto],
                backgroundColor: ['#28a745', '#17a2b8'],
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

