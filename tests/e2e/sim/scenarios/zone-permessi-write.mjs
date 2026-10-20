/**
 * L'operaio non segna zone sui lavori di squadra.
 * Il capo resta coperto da lavori-caposquadra-write.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loginAsOperaioFromDevPage } from '../helpers/sim-login.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const MSG = /Su questo lavoro le zone le segna il caposquadra/;

function emulatorConfig() {
  const cfg = JSON.parse(readFileSync(path.join(root, 'simulator/config/emulator.json'), 'utf8'));
  const host = String(cfg.firestoreHost || '');
  if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) {
    throw new Error('Emulatore Firestore non locale: ' + host);
  }
  return cfg;
}

export async function runZonePermessiWrite(page, expect) {
  const cfg = emulatorConfig();
  await loginAsOperaioFromDevPage(page);
  const sessione = await page.evaluate(() => ({
    uid: sessionStorage.getItem('gfv_expected_user_id'),
    tenantId: sessionStorage.getItem('gfv_current_tenant_id'),
  }));
  expect(sessione.uid).toBeTruthy();

  await page.goto('/core/admin/lavori-caposquadra-standalone.html?emulator=1');
  await page.locator('#lavori-container .lavoro-card').first().waitFor({ timeout: 90_000 });

  const cards = page.locator('#lavori-container .lavoro-card');
  const n = await cards.count();
  let squadre = 0;
  let autonomi = 0;
  for (let i = 0; i < n; i += 1) {
    const card = cards.nth(i);
    const titolo = await card.locator('.lavoro-title').innerText();
    const pulsante = card.getByRole('button', { name: /Segna zona lavorata/ });
    if (/squadra/i.test(titolo)) {
      squadre += 1;
      await expect(pulsante).toHaveCount(0);
    }
    if (/autonomo/i.test(titolo)) {
      autonomi += 1;
      await expect(pulsante).toBeVisible();
    }
  }
  expect(squadre).toBeGreaterThan(0);
  expect(autonomi).toBeGreaterThan(0);

  const lavoriRes = await fetch(
    `http://${cfg.firestoreHost}/v1/projects/${cfg.projectId}/databases/(default)/documents/tenants/${sessione.tenantId}/lavori?pageSize=200`,
    { headers: { Authorization: 'Bearer owner' } }
  );
  expect(lavoriRes.status).toBeLessThan(400);
  const lavoriJson = await lavoriRes.json();
  const squadra = (lavoriJson.documents || []).map((doc) => {
    const fields = doc.fields || {};
    return {
      id: String(doc.name).split('/').pop(),
      nome: fields.nome && fields.nome.stringValue,
      caposquadraId: fields.caposquadraId && fields.caposquadraId.stringValue,
    };
  }).find((item) => item.caposquadraId && /squadra/i.test(item.nome || ''));
  expect(squadra).toBeTruthy();

  await page.goto(
    `/core/admin/lavori-caposquadra-standalone.html?emulator=1&embed=mobile&mapOnly=1&traceLavoroId=${encodeURIComponent(squadra.id)}`
  );
  await expect(page.getByText(MSG)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator('body')).not.toHaveClass(/map-only/);
  await expect(page.locator('#zona-modal')).not.toHaveClass(/active/);

  const scrittura = await page.evaluate(async ({ tenantId, lavoroId, uid }) => {
    const mod = await import('/core/services/firebase-service.js');
    try {
      await mod.addDoc(
        mod.collection(mod.getDb(), 'tenants', tenantId, 'lavori', lavoroId, 'zoneLavorate'),
        { note: 'e2e-permesso-negato', operaioId: uid }
      );
      return { ok: true, code: '', message: '' };
    } catch (error) {
      return {
        ok: false,
        code: error && error.code ? String(error.code) : '',
        message: String(error && error.message ? error.message : error),
      };
    }
  }, { tenantId: sessione.tenantId, lavoroId: squadra.id, uid: sessione.uid });
  expect(scrittura.ok).toBe(false);
  expect(`${scrittura.code} ${scrittura.message}`).toMatch(/permission-denied|insufficient permissions/i);
}
