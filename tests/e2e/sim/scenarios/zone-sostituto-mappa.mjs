/**
 * Il sostituto di un lavoro autonomo vede le zone già segnate e il pulsante per tracciarne.
 * I dati di prova si scrivono sull'emulatore locale e si rimettono a posto.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAsOperaioFromDevPage } from '../helpers/sim-login.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const fakeMaps = path.join(path.dirname(fileURLToPath(import.meta.url)), '../helpers/fake-google-maps.js');
const MSG = 'Su questo lavoro le zone le segna il caposquadra (o il manager).';

function emulatorConfig() {
  const cfg = JSON.parse(readFileSync(path.join(root, 'simulator/config/emulator.json'), 'utf8'));
  const host = String(cfg.firestoreHost || '');
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
    throw new Error('Emulatore Firestore non locale: ' + host);
  }
  return cfg;
}

function valore(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(valore) } };
  const fields = {};
  for (const [key, item] of Object.entries(value)) fields[key] = valore(item);
  return { mapValue: { fields } };
}

function leggiValore(field) {
  if (!field) return undefined;
  if ('nullValue' in field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return Number(field.integerValue);
  if ('doubleValue' in field) return field.doubleValue;
  if ('booleanValue' in field) return field.booleanValue;
  if ('arrayValue' in field) return (field.arrayValue.values || []).map(leggiValore);
  if ('mapValue' in field) {
    const out = {};
    const fields = field.mapValue.fields || {};
    for (const [key, item] of Object.entries(fields)) out[key] = leggiValore(item);
    return out;
  }
  return undefined;
}

function docToPlain(doc) {
  const id = String(doc.name || '').split('/').pop();
  return { id, ...(leggiValore({ mapValue: { fields: doc.fields || {} } }) || {}) };
}

async function firestore(cfg, method, docPath, data, mask) {
  const url = new URL(
    `http://${cfg.firestoreHost}/v1/projects/${cfg.projectId}/databases/(default)/documents/${docPath}`
  );
  if (mask) mask.forEach((key) => url.searchParams.append('updateMask.fieldPaths', key));
  const headers = { Authorization: 'Bearer owner' };
  const init = { method, headers };
  if (data) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify({ fields: valore(data).mapValue.fields });
  }
  const res = await fetch(url, init);
  const body = await res.text();
  if (res.status >= 400) throw new Error(`${method} ${docPath} ${res.status} ${body}`);
  return body ? JSON.parse(body) : null;
}

async function elenco(cfg, docPath) {
  const out = [];
  let pageToken = '';
  do {
    const url = new URL(
      `http://${cfg.firestoreHost}/v1/projects/${cfg.projectId}/databases/(default)/documents/${docPath}`
    );
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const res = await fetch(url, { headers: { Authorization: 'Bearer owner' } });
    const body = await res.text();
    if (res.status >= 400) throw new Error(`LIST ${docPath} ${res.status} ${body}`);
    const json = body ? JSON.parse(body) : {};
    (json.documents || []).forEach((doc) => out.push(docToPlain(doc)));
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return out;
}

function triangoloNelTerreno(terreno) {
  const raw = terreno && (terreno.polygonCoords || terreno.poligonoCoords || terreno.coordinates);
  const punti = Array.isArray(raw)
    ? raw.map((c) => ({
      lat: Number(c.lat != null ? c.lat : c[0]),
      lng: Number(c.lng != null ? c.lng : c[1]),
    })).filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    : [];
  if (punti.length >= 3) {
    const a = punti[0];
    const b = punti[Math.floor(punti.length / 3)];
    const c = punti[Math.floor((punti.length * 2) / 3)];
    const centro = {
      lat: (a.lat + b.lat + c.lat) / 3,
      lng: (a.lng + b.lng + c.lng) / 3,
    };
    return [
      { lat: (a.lat + centro.lat) / 2, lng: (a.lng + centro.lng) / 2 },
      { lat: (b.lat + centro.lat) / 2, lng: (b.lng + centro.lng) / 2 },
      { lat: (c.lat + centro.lat) / 2, lng: (c.lng + centro.lng) / 2 },
    ];
  }
  const base = terreno && terreno.coordinate ? terreno.coordinate : { lat: 43.7, lng: 11.2 };
  return [
    { lat: base.lat, lng: base.lng },
    { lat: base.lat + 0.0002, lng: base.lng },
    { lat: base.lat, lng: base.lng + 0.0002 },
  ];
}

export async function runZoneSostitutoMappa(page, expect) {
  const cfg = emulatorConfig();
  await page.addInitScript({ path: fakeMaps });
  await loginAsOperaioFromDevPage(page);
  const sessione = await page.evaluate(() => ({
    uid: sessionStorage.getItem('gfv_expected_user_id'),
    tenantId: sessionStorage.getItem('gfv_current_tenant_id'),
  }));
  expect(sessione.uid).toBeTruthy();
  expect(sessione.tenantId).toBeTruthy();

  const lavori = await elenco(cfg, `tenants/${sessione.tenantId}/lavori`);
  const statiSenzaPulsante = new Set(['completato', 'completato_da_approvare', 'sospeso', 'in_standby', 'annullato']);
  let lavoro = lavori.find((item) => {
    const capo = item.caposquadraId == null || String(item.caposquadraId).trim() === '';
    const operaio = item.operaioId && String(item.operaioId) !== String(sessione.uid);
    const stato = item.stato || 'assegnato';
    return capo && operaio && !statiSenzaPulsante.has(stato);
  });
  let lavoroCreato = false;
  if (!lavoro) {
    const utenti = await elenco(cfg, 'users');
    const altro = utenti.find((user) => {
      if (!user.id || String(user.id) === String(sessione.uid)) return false;
      const ruoli = Array.isArray(user.ruoli) ? user.ruoli : [];
      return ruoli.some((ruolo) => String(ruolo).toLowerCase().replace(/\s+/g, '') === 'operaio');
    });
    expect(altro, 'altro operaio nel tenant').toBeTruthy();
    const terreni = await elenco(cfg, `tenants/${sessione.tenantId}/terreni`);
    const terrenoSeed = terreni.find((item) => item.polygonCoords || item.poligonoCoords || item.coordinates) || terreni[0];
    expect(terrenoSeed, 'terreno per il lavoro di prova').toBeTruthy();
    const lavoroId = `z-e2e-lavoro-${Date.now().toString(36)}`;
    await firestore(cfg, 'PATCH', `tenants/${sessione.tenantId}/lavori/${lavoroId}`, {
      nome: 'E2E autonomo sostituto',
      terrenoId: terrenoSeed.id,
      operaioId: altro.id,
      stato: 'assegnato',
      tipoLavoro: 'prova',
    });
    lavoro = {
      id: lavoroId,
      terrenoId: terrenoSeed.id,
      operaioId: altro.id,
      stato: 'assegnato',
    };
    lavoroCreato = true;
  }

  const prima = lavoro.assenzaSostitutoOperaioId;
  const terreno = lavoro.terrenoId
    ? docToPlain(await firestore(cfg, 'GET', `tenants/${sessione.tenantId}/terreni/${lavoro.terrenoId}`))
    : null;
  const triangolo = triangoloNelTerreno(terreno);
  const zonaId = `z-e2e-sost-${Date.now().toString(36)}`;
  const zonaPath = `tenants/${sessione.tenantId}/lavori/${lavoro.id}/zoneLavorate/${zonaId}`;

  try {
    await firestore(
      cfg,
      'PATCH',
      `tenants/${sessione.tenantId}/lavori/${lavoro.id}`,
      { assenzaSostitutoOperaioId: sessione.uid },
      ['assenzaSostitutoOperaioId']
    );
    await firestore(cfg, 'PATCH', zonaPath, {
      operaioId: lavoro.operaioId,
      tipo: 'poligono',
      isChiuso: true,
      coordinate: triangolo,
      superficieHa: 0.01,
      note: 'e2e-zona-titolare',
    });

    await page.goto(
      `/core/admin/lavori-caposquadra-standalone.html?emulator=1&focusLavoroId=${encodeURIComponent(lavoro.id)}`
    );
    await expect(page.getByRole('button', { name: /Segna zona lavorata/ })).toBeVisible({ timeout: 90_000 });

    await page.evaluate((id) => window.openTracciaZonaModal(id), lavoro.id);
    const modal = page.locator('#zona-modal');
    await expect(modal).toHaveAttribute('data-zone-lavoro-id', lavoro.id, { timeout: 30_000 });
    await expect.poll(async () => {
      const raw = await modal.getAttribute('data-zone-disegnate');
      return Number(raw || 0);
    }).toBeGreaterThanOrEqual(1);
    const ids = await modal.getAttribute('data-zone-ids');
    expect(ids || '').toContain(zonaId);

    const disegnato = await page.evaluate((attesi) => {
      const maps = window.__gfvFakeMaps;
      if (!maps || !Array.isArray(maps.polygons)) return null;
      return maps.polygons.some((poly) => {
        const punti = poly.points || [];
        return attesi.every((p) => punti.some((q) => Math.abs(q.lat - p.lat) < 1e-8 && Math.abs(q.lng - p.lng) < 1e-8));
      });
    }, triangolo);
    expect(disegnato).toBe(true);
  } finally {
    await firestore(cfg, 'DELETE', zonaPath).catch(() => {});
    if (lavoroCreato) {
      await firestore(cfg, 'DELETE', `tenants/${sessione.tenantId}/lavori/${lavoro.id}`).catch(() => {});
    } else if (prima == null || prima === '') {
      await firestore(
        cfg,
        'PATCH',
        `tenants/${sessione.tenantId}/lavori/${lavoro.id}`,
        {},
        ['assenzaSostitutoOperaioId']
      ).catch(() => {});
    } else {
      await firestore(
        cfg,
        'PATCH',
        `tenants/${sessione.tenantId}/lavori/${lavoro.id}`,
        { assenzaSostitutoOperaioId: prima },
        ['assenzaSostitutoOperaioId']
      ).catch(() => {});
    }
  }
  expect(MSG).toContain('caposquadra');
}
