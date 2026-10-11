/**
 * Scheda pieno nella versione mobile.
 * Compare solo se il lavoro selezionato ha un mezzo e l'azienda ha il magazzino.
 */
import { lavoroRichiedeRifornimento } from '../../../modules/magazzino/lib/carburante-movimento.js';
import { hasModuleAccessFromTenant } from '../../utils/module-access-resolver.js';
import { getDoc, doc, getDocs, collection, getAppInstance } from '../../services/firebase-service.js';
import { shouldUseFirebaseEmulator } from '../../js/firebase-emulator-dev.js';
import { t, leggiLinguaCampo } from '../../services/field-ui-i18n.js';

function linguaPieno() {
    try {
        return leggiLinguaCampo(typeof localStorage !== 'undefined' ? localStorage : null);
    } catch (error) {
        return 'it';
    }
}

export function testoSegnapostoPieno(chiave) {
    const lang = linguaPieno();
    if (chiave === 'pieno.none') return t('pieno.none', lang);
    if (chiave === 'pieno.loading') return t('pieno.loading', lang);
    return t('pieno.choose', lang);
}

let bound = false;
let tenantCacheId = '';
let tenantData = null;
let productsTenantId = '';

function escapeText(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

async function loadCarburanti(db, tenantId) {
    const sel = document.getElementById('pieno-prodotto');
    if (!sel) return;
    if (productsTenantId === tenantId && sel.options.length > 1) return;
    sel.dataset.pienoPlaceholder = 'pieno.loading';
    sel.innerHTML = '<option value="">' + escapeText(testoSegnapostoPieno('pieno.loading')) + '</option>';
    const snap = await getDocs(collection(db, 'tenants', tenantId, 'prodotti'));
    const rows = [];
    snap.forEach((d) => {
        const data = d.data() || {};
        if (String(data.categoria || '') !== 'carburante' || data.attivo === false) return;
        rows.push({ id: d.id, nome: data.nome || data.codice || d.id });
    });
    rows.sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
    if (!rows.length) {
        sel.dataset.pienoPlaceholder = 'pieno.none';
        sel.innerHTML = '<option value="">' + escapeText(testoSegnapostoPieno('pieno.none')) + '</option>';
        productsTenantId = tenantId;
        return;
    }
    sel.dataset.pienoPlaceholder = 'pieno.choose';
    sel.innerHTML = '<option value="">' + escapeText(testoSegnapostoPieno('pieno.choose')) + '</option>' + rows.map((r) => {
        return '<option value="' + escapeText(r.id) + '">' + escapeText(r.nome) + '</option>';
    }).join('');
    productsTenantId = tenantId;
}

async function mezzoLabel(db, tenantId, lavoro) {
    const nome = lavoro.macchinaNome || lavoro.trattoreNome;
    if (nome) return t('pieno.vehicle', linguaPieno(), { name: nome });
    const id = String(lavoro.macchinaId || '').trim();
    if (!id) return t('pieno.vehicleFallback', linguaPieno());
    try {
        const snap = await getDoc(doc(db, 'tenants', tenantId, 'macchine', id));
        if (snap.exists()) {
            const data = snap.data() || {};
            return t('pieno.vehicle', linguaPieno(), { name: data.nome || data.targa || id });
        }
    } catch (e) { /* il nome resta l'id */ }
    return t('pieno.vehicle', linguaPieno(), { name: id });
}

async function callRegistraPienoCampo(payload) {
    const { getFunctions, httpsCallable, connectFunctionsEmulator } = await import(
        'https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js'
    );
    const functions = getFunctions(getAppInstance(), 'europe-west1');
    if (shouldUseFirebaseEmulator()) {
        try { connectFunctionsEmulator(functions, '127.0.0.1', 5001); } catch (e) { /* già collegato */ }
    }
    const call = httpsCallable(functions, 'registraPienoCampo');
    return call(payload);
}

function bindForm(ctx) {
    if (bound) return;
    const form = document.getElementById('pieno-campo-form');
    if (!form) return;
    bound = true;
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const status = document.getElementById('pieno-status');
        const work = ctx.getSelectedWork ? ctx.getSelectedWork() : ctx.selectedWork;
        const lavoro = work && work.raw;
        if (!lavoroRichiedeRifornimento(lavoro)) {
            if (status) status.textContent = t('pieno.noVehicle', linguaPieno());
            return;
        }
        const prodottoId = (document.getElementById('pieno-prodotto') || {}).value || '';
        const quantita = Number((document.getElementById('pieno-litri') || {}).value);
        if (!prodottoId || !Number.isFinite(quantita) || quantita <= 0) {
            if (status) status.textContent = t('pieno.needFields', linguaPieno());
            return;
        }
        if (status) status.textContent = t('pieno.saving', linguaPieno());
        try {
            await callRegistraPienoCampo({
                tenantId: ctx.tenantId,
                lavoroId: work.id,
                prodottoId,
                quantita
            });
            if (status) status.textContent = t('pieno.saved', linguaPieno());
            const litri = document.getElementById('pieno-litri');
            if (litri) litri.value = '';
        } catch (error) {
            const raw = error && (error.message || error.details);
            if (status) {
                status.textContent = raw
                    ? String(raw).replace(/^Firebase:\s*/i, '')
                    : t('pieno.saveError', linguaPieno());
            }
        }
    });
}

/**
 * @param {{ db: object, tenantId: string, selectedWork: object|null, getSelectedWork?: Function }} ctx
 */
export async function syncPienoCampoSection(ctx) {
    const section = document.getElementById('inline-pieno-section');
    if (!section) return;
    const lavoro = ctx.selectedWork && ctx.selectedWork.raw;
    if (!ctx.tenantId || !ctx.db || !lavoroRichiedeRifornimento(lavoro)) {
        section.hidden = true;
        return;
    }
    if (tenantCacheId !== ctx.tenantId) {
        const snap = await getDoc(doc(ctx.db, 'tenants', ctx.tenantId));
        tenantCacheId = ctx.tenantId;
        tenantData = snap.exists() ? snap.data() : {};
    }
    if (!hasModuleAccessFromTenant(tenantData, 'magazzino')) {
        section.hidden = true;
        return;
    }
    section.hidden = false;
    bindForm(ctx);
    const label = document.getElementById('pieno-mezzo-label');
    if (label) label.textContent = await mezzoLabel(ctx.db, ctx.tenantId, lavoro);
    await loadCarburanti(ctx.db, ctx.tenantId);
}
