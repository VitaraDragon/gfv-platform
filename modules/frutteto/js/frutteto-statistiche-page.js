/**
 * Pagina Statistiche frutteto.
 * L'HTML in views/ resta la struttura; qui c'è il comportamento.
 * Gli import dinamici via resolvePath restano relativi all'URL della pagina.
 * @module modules/frutteto/js/frutteto-statistiche-page
 */

import { showAlert } from '../../../core/js/gfv-page-utils.js';
import { resolveAuthUser, loginPageUrl } from '../../../core/js/simulator-standalone-page.js';

try {
    await window.GFVStandaloneReady;
} catch (err) {
    console.error('[frutteto-statistiche] Bootstrap failed:', err);
    throw err;
}

const { getAuthInstance, getDb, onAuthStateChanged, getDoc, doc } = await import('../../../core/services/firebase-service.js');
const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = await import('../../../core/services/tenant-service.js');
const auth = getAuthInstance();
const db = getDb();
initializeTenantService();

let currentUser = null;
let currentTenantId = null;
let currentFruttetoId = null;
let currentAnno = null;
let charts = {};
let debounceTimer = null;
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_PREFIX = 'frutteto_stats_';

const chartOrder = [
    'chart-produzione-tempo', 'chart-resa-specie', 'chart-produzione-mensile',
    'chart-calibro', 'chart-maturazione', 'chart-colore',
    'chart-scarto-tempo', 'chart-scarto-categoria',
    'chart-costi-tempo', 'chart-spese-categoria', 'chart-spese-mensili'
];

function ensureCanvas(chartId) {
    const index = chartOrder.indexOf(chartId);
    if (index < 0) return null;
    const cards = document.querySelectorAll('.chart-card');
    if (index >= cards.length) return null;
    const card = cards[index];
    const container = card.querySelector('.chart-container');
    if (!container) return null;
    const existingKey = Object.keys(charts).find(k => charts[k] && charts[k].canvas && charts[k].canvas.id === chartId);
    if (existingKey && charts[existingKey]) {
        try { charts[existingKey].destroy(); } catch (e) {}
        delete charts[existingKey];
    }
    let canvas = document.getElementById(chartId);
    if (canvas && !container.contains(canvas)) { canvas.remove(); canvas = null; }
    if (container.innerHTML.includes('empty-state') || container.innerHTML.includes('Caricamento')) {
        container.innerHTML = '';
    }
    if (!canvas || canvas.tagName !== 'CANVAS') {
        container.innerHTML = `<canvas id="${chartId}"></canvas>`;
        canvas = document.getElementById(chartId);
    }
    return canvas;
}

onAuthStateChanged(auth, async (user) => {
    if (!user) user = await resolveAuthUser(auth);
    if (!user) {
        window.location.href = await loginPageUrl('../../../core/auth/login-standalone.html');
        return;
    }
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) {
            window.location.href = await loginPageUrl('../../../core/auth/login-standalone.html');
            return;
        }
        const userData = userDoc.data();
        const ruoli = userData.ruoli || [];
        const isManager = ruoli.some(r => {
            const l = (r || '').toLowerCase();
            return l.includes('manager') || l.includes('amministratore');
        });
        if (!isManager) {
            showAlert('Permessi insufficienti', 'error');
            setTimeout(() => { window.location.href = '../../../core/dashboard-standalone.html'; }, 2000);
            return;
        }
        let tenantId = getCurrentTenantId() || userData.tenantId;
        if (!tenantId) {
            for (let i = 0; i < 10; i++) {
                await new Promise(r => setTimeout(r, 100));
                tenantId = getCurrentTenantId();
                if (tenantId) break;
            }
        }
        currentTenantId = tenantId;
        if (!tenantId) {
            showAlert('Nessun tenant disponibile', 'error');
            setTimeout(() => { window.location.href = '../../../core/dashboard-standalone.html'; }, 2000);
            return;
        }
        const tenant = await getCurrentTenant();
        if (!tenant) {
            showAlert('Tenant non trovato', 'error');
            setTimeout(() => { window.location.href = '../../../core/dashboard-standalone.html'; }, 2000);
            return;
        }
        const modules = (tenant.modules || []).map(m => (m || '').toLowerCase());
        if (!modules.includes('frutteto')) {
            showAlert('Modulo Frutteto non attivo', 'error');
            setTimeout(() => { window.location.href = '../../../core/admin/abbonamento-standalone.html'; }, 3000);
            return;
        }
        await initFilters();
        await loadCharts();
    } catch (err) {
        showAlert('Errore: ' + err.message, 'error');
    }
});

async function initFilters() {
    const { getAllFrutteti } = await import('../services/frutteti-service.js');
    const frutteti = await getAllFrutteti();
    const sel = document.getElementById('filtro-frutteto');
    sel.innerHTML = '<option value="">Tutti i frutteti</option>';
    frutteti.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = f.specie || f.varieta || 'Frutteto';
        sel.appendChild(opt);
    });
    const annoSelect = document.getElementById('filtro-anno');
    const annoCorrente = new Date().getFullYear();
    for (let i = 0; i < 10; i++) {
        const a = annoCorrente - i;
        const opt = document.createElement('option');
        opt.value = a;
        opt.textContent = a;
        if (i === 0) opt.selected = true;
        annoSelect.appendChild(opt);
    }
    currentAnno = annoCorrente;
    sel.addEventListener('change', (e) => {
        currentFruttetoId = e.target.value || null;
        debouncedLoadCharts();
    });
    annoSelect.addEventListener('change', (e) => {
        currentAnno = parseInt(e.target.value);
        debouncedLoadCharts();
    });
}

function debouncedLoadCharts() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => loadCharts(), 400);
}

function getCacheKey(fruttetoId, anno, type) {
    return `${CACHE_PREFIX}${fruttetoId || 'all'}_${anno}_${type}`;
}
function getCached(key) {
    try {
        const s = sessionStorage.getItem(key);
        if (!s) return null;
        const { data, timestamp } = JSON.parse(s);
        if (Date.now() - timestamp > CACHE_TTL) {
            sessionStorage.removeItem(key);
            return null;
        }
        return data;
    } catch (e) { return null; }
}
function setCached(key, data) {
    try {
        sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) {}
}

async function loadCharts() {
    try {
        document.querySelectorAll('.chart-container').forEach(c => {
            if (!c.querySelector('canvas')) c.innerHTML = '<div class="loading">Caricamento...</div>';
        });
        const {
            getStatisticheFrutteto,
            getProduzioneTemporale,
            getQualitaFrutta,
            getCostiTemporale,
            getScartoTemporale
        } = await import('../services/frutteto-statistiche-service.js');

        const kStats = getCacheKey(currentFruttetoId, currentAnno, 'stats');
        const kProd = getCacheKey(currentFruttetoId, currentAnno, 'produzione');
        const kQual = getCacheKey(currentFruttetoId, currentAnno, 'qualita');
        const kCosti = getCacheKey(currentFruttetoId, currentAnno, 'costi');
        const kScarto = getCacheKey(currentFruttetoId, currentAnno, 'scarto');

        let stats = getCached(kStats);
        let produzioneTemporale = getCached(kProd);
        let qualitaFrutta = getCached(kQual);
        let costiTemporale = getCached(kCosti);
        let scartoTemporale = getCached(kScarto);

        function hasQualitaData(qf) {
            if (!qf || typeof qf !== 'object') return false;
            return Object.values(qf).some(q => {
                if (!q || typeof q !== 'object') return false;
                return Object.keys(q.calibro || {}).length > 0 || Object.keys(q.gradoMaturazione || {}).length > 0 || Object.keys(q.colore || {}).length > 0;
            });
        }
        if (qualitaFrutta && !hasQualitaData(qualitaFrutta)) qualitaFrutta = null;

        const promises = [];
        if (!stats) promises.push(getStatisticheFrutteto(currentFruttetoId, currentAnno).then(d => { stats = d; setCached(kStats, d); }));
        if (!produzioneTemporale) promises.push(getProduzioneTemporale(currentFruttetoId, 3).then(d => { produzioneTemporale = d; setCached(kProd, d); }));
        if (!qualitaFrutta) promises.push(getQualitaFrutta(currentFruttetoId, currentAnno).then(d => { qualitaFrutta = d; setCached(kQual, d); }));
        if (!costiTemporale) promises.push(getCostiTemporale(currentFruttetoId, 3).then(d => { costiTemporale = d; setCached(kCosti, d); }));
        if (!scartoTemporale) promises.push(getScartoTemporale(currentFruttetoId, 3).then(d => { scartoTemporale = d; setCached(kScarto, d); }));
        if (promises.length) await Promise.all(promises);

        if (produzioneTemporale) updateChartProduzioneTempo(produzioneTemporale);
        if (stats) {
            updateChartResaSpecie(stats.resaPerSpecie);
            updateChartProduzioneMensile(stats.produzionePerMese, currentAnno);
            updateChartSpeseCategoria(stats);
            updateChartSpeseMensili(stats.spesePerMese, currentAnno);
            updateChartScartoCategoria(stats.scartoPerCategoria || {});
        }
        if (scartoTemporale) updateChartScartoTempo(scartoTemporale);
        if (qualitaFrutta) {
            updateChartCalibro(qualitaFrutta);
            updateChartMaturazione(qualitaFrutta);
            updateChartColore(qualitaFrutta);
        }
        if (costiTemporale) updateChartCostiTempo(costiTemporale);
    } catch (err) {
        showAlert('Errore caricamento grafici: ' + err.message, 'error');
    }
}

function updateChartProduzioneTempo(data) {
    if (charts.produzioneTempo) { try { charts.produzioneTempo.destroy(); } catch (e) {} charts.produzioneTempo = null; }
    const canvas = ensureCanvas('chart-produzione-tempo');
    if (!canvas) return;
    if (!data || !data.anni || data.anni.length === 0 || (data.produzione && data.produzione.every(v => v === 0))) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>Nessun dato</p></div>';
        return;
    }
    charts.produzioneTempo = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: data.anni.map(a => a.toString()),
            datasets: [{
                label: 'Produzione (kg)',
                data: data.produzione,
                borderColor: '#FF6F00',
                backgroundColor: 'rgba(255, 111, 0, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: v => v.toFixed(0) + ' kg' } } }
        }
    });
}

function updateChartResaSpecie(data) {
    if (charts.resaSpecie) { try { charts.resaSpecie.destroy(); } catch (e) {} charts.resaSpecie = null; }
    const canvas = ensureCanvas('chart-resa-specie');
    if (!canvas) return;
    if (!data || typeof data !== 'object') {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🍎</div><p>Nessun dato</p></div>';
        return;
    }
    const specie = Object.keys(data);
    if (specie.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🍎</div><p>Nessun dato</p></div>';
        return;
    }
    charts.resaSpecie = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: specie,
            datasets: [{
                label: 'Resa (kg/Ha)',
                data: specie.map(s => data[s].resaKgHa || 0),
                backgroundColor: '#FF6F00',
                borderColor: '#E65100',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: v => v.toFixed(1) + ' kg/Ha' } } }
        }
    });
}

function updateChartProduzioneMensile(data, anno) {
    if (charts.produzioneMensile) { try { charts.produzioneMensile.destroy(); } catch (e) {} charts.produzioneMensile = null; }
    const canvas = ensureCanvas('chart-produzione-mensile');
    if (!canvas) return;
    const mesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    const valori = [];
    for (let i = 1; i <= 12; i++) {
        const k = `${anno}-${String(i).padStart(2,'0')}`;
        valori.push((data && data[k]) || 0);
    }
    if (valori.every(v => v === 0)) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📅</div><p>Nessun dato</p></div>';
        return;
    }
    charts.produzioneMensile = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: mesi,
            datasets: [{ label: 'Produzione (kg)', data: valori, backgroundColor: '#FF6F00', borderColor: '#E65100', borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function flattenQualita(qualitaFrutta, key) {
    const out = {};
    if (!qualitaFrutta || typeof qualitaFrutta !== 'object') return out;
    Object.values(qualitaFrutta).forEach(q => {
        const obj = q[key];
        if (obj && typeof obj === 'object') {
            Object.keys(obj).forEach(k => { out[k] = (out[k] || 0) + (obj[k] || 0); });
        }
    });
    return out;
}

function updateChartCalibro(qualitaFrutta) {
    if (charts.calibro) { try { charts.calibro.destroy(); } catch (e) {} charts.calibro = null; }
    const canvas = ensureCanvas('chart-calibro');
    if (!canvas) return;
    const flat = flattenQualita(qualitaFrutta, 'calibro');
    const labels = Object.keys(flat);
    if (labels.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📏</div><p>Nessun dato</p></div>';
        return;
    }
    charts.calibro = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'kg', data: labels.map(l => flat[l]), backgroundColor: '#FFB74D', borderColor: '#FF6F00', borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function updateChartMaturazione(qualitaFrutta) {
    if (charts.maturazione) { try { charts.maturazione.destroy(); } catch (e) {} charts.maturazione = null; }
    const canvas = ensureCanvas('chart-maturazione');
    if (!canvas) return;
    const flat = flattenQualita(qualitaFrutta, 'gradoMaturazione');
    const labels = Object.keys(flat);
    if (labels.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🍎</div><p>Nessun dato</p></div>';
        return;
    }
    charts.maturazione = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'kg', data: labels.map(l => flat[l]), backgroundColor: '#FFCC80', borderColor: '#FF6F00', borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

function updateChartColore(qualitaFrutta) {
    if (charts.colore) { try { charts.colore.destroy(); } catch (e) {} charts.colore = null; }
    const canvas = ensureCanvas('chart-colore');
    if (!canvas) return;
    const flat = flattenQualita(qualitaFrutta, 'colore');
    const labels = Object.keys(flat);
    if (labels.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎨</div><p>Nessun dato</p></div>';
        return;
    }
    charts.colore = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'kg', data: labels.map(l => flat[l]), backgroundColor: '#FFA726', borderColor: '#FF6F00', borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

const SCARTO_CATEGORIE_LABELS = {
    dannoFisico: 'Danno fisico',
    calibroFuoriNorma: 'Calibro fuori norma',
    marciume: 'Marciume',
    maturazioneNonIdonea: 'Maturazione non idonea',
    altro: 'Altro'
};

function updateChartScartoTempo(data) {
    if (charts.scartoTempo) { try { charts.scartoTempo.destroy(); } catch (e) {} charts.scartoTempo = null; }
    const canvas = ensureCanvas('chart-scarto-tempo');
    if (!canvas) return;
    if (!data || !data.anni || data.anni.length === 0 || (data.scarto && data.scarto.every(v => v === 0))) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>Nessun dato</p></div>';
        return;
    }
    charts.scartoTempo = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: data.anni.map(a => a.toString()),
            datasets: [{
                label: 'Scarto (kg)',
                data: data.scarto || [],
                borderColor: '#FF6F00',
                backgroundColor: 'rgba(255, 111, 0, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: v => v.toFixed(0) + ' kg' } } }
        }
    });
}

function updateChartScartoCategoria(scartoPerCategoria) {
    if (charts.scartoCategoria) { try { charts.scartoCategoria.destroy(); } catch (e) {} charts.scartoCategoria = null; }
    const canvas = ensureCanvas('chart-scarto-categoria');
    if (!canvas) return;
    if (!scartoPerCategoria || typeof scartoPerCategoria !== 'object') {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>Nessun dato</p></div>';
        return;
    }
    const labels = [];
    const values = [];
    Object.keys(scartoPerCategoria).forEach(key => {
        const v = parseFloat(scartoPerCategoria[key]) || 0;
        if (v > 0) {
            labels.push(SCARTO_CATEGORIE_LABELS[key] || key);
            values.push(v);
        }
    });
    if (labels.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>Nessun dato</p></div>';
        return;
    }
    const colors = ['#FF6F00', '#FFB74D', '#FFCC80', '#FFA726', '#E65100'];
    charts.scartoCategoria = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{ label: 'kg', data: values, backgroundColor: labels.map((_, i) => colors[i % colors.length]), borderColor: '#E65100', borderWidth: 1 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { callback: v => v.toFixed(0) + ' kg' } } } }
    });
}

function updateChartCostiTempo(data) {
    if (charts.costiTempo) { try { charts.costiTempo.destroy(); } catch (e) {} charts.costiTempo = null; }
    const canvas = ensureCanvas('chart-costi-tempo');
    if (!canvas) return;
    if (!data || !data.anni || data.anni.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💰</div><p>Nessun dato</p></div>';
        return;
    }
    const hasData = (data.totale && data.totale.some(v => v > 0)) || (data.manodopera && data.manodopera.some(v => v > 0)) || (data.macchine && data.macchine.some(v => v > 0)) || (data.prodotti && data.prodotti.some(v => v > 0));
    if (!hasData) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💰</div><p>Nessun dato</p></div>';
        return;
    }
    charts.costiTempo = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: data.anni.map(a => a.toString()),
            datasets: [
                { label: 'Manodopera', data: data.manodopera || [], borderColor: '#2E8B57', tension: 0.4, fill: false },
                { label: 'Macchine', data: data.macchine || [], borderColor: '#007bff', tension: 0.4, fill: false },
                { label: 'Prodotti', data: data.prodotti || [], borderColor: '#ffc107', tension: 0.4, fill: false },
                { label: 'Totale', data: data.totale || [], borderColor: '#FF6F00', tension: 0.4, fill: false }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => '€' + v.toFixed(0) } } }
        }
    });
}

function updateChartSpeseCategoria(stats) {
    if (charts.speseCategoria) { try { charts.speseCategoria.destroy(); } catch (e) {} charts.speseCategoria = null; }
    const canvas = ensureCanvas('chart-spese-categoria');
    if (!canvas) return;
    const raccolta = stats.speseRaccoltaAnno || 0;
    const totale = stats.costoTotaleAnno ?? stats.speseTotaleAnno ?? 0;
    const altri = Math.max(0, totale - raccolta);
    if (totale === 0 && raccolta === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><p>Nessun dato</p></div>';
        return;
    }
    const labels = [];
    const values = [];
    if (raccolta > 0) { labels.push('Raccolta'); values.push(raccolta); }
    if (altri > 0) { labels.push('Altri costi'); values.push(altri); }
    if (labels.length === 0) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">💳</div><p>Nessun dato</p></div>';
        return;
    }
    charts.speseCategoria = new Chart(canvas.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: ['#FF6F00', '#FFCC80'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'bottom' },
                tooltip: { callbacks: { label: ctx => ctx.label + ': €' + ctx.parsed.toFixed(2) } }
            }
        }
    });
}

function updateChartSpeseMensili(data, anno) {
    if (charts.speseMensili) { try { charts.speseMensili.destroy(); } catch (e) {} charts.speseMensili = null; }
    const canvas = ensureCanvas('chart-spese-mensili');
    if (!canvas) return;
    if (!data || typeof data !== 'object') {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>Nessun dato</p></div>';
        return;
    }
    const mesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    const valori = [];
    for (let i = 1; i <= 12; i++) {
        const k = `${anno}-${String(i).padStart(2,'0')}`;
        valori.push((data[k]) || 0);
    }
    if (valori.every(v => v === 0)) {
        canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><p>Nessun dato</p></div>';
        return;
    }
    charts.speseMensili = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: mesi,
            datasets: [{
                label: 'Spese (€)',
                data: valori,
                borderColor: '#FF6F00',
                backgroundColor: 'rgba(255, 111, 0, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { callback: v => '€' + v.toFixed(0) } } }
        }
    });
}
