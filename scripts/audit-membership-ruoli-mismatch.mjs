/**
 * Solo lettura: elenca utenti in cui tenantMemberships[t].ruoli ≠ ruoli deprecati
 * dello stesso tenant (es. «Modifica ruoli» usata su sé stessi in passato).
 *
 * Uso (Pier, prima del deploy delle rules):
 *   set FIREBASE_SERVICE_ACCOUNT=path\to\serviceAccount.json
 *   node scripts/audit-membership-ruoli-mismatch.mjs
 *
 * Nessuna scrittura.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

function initAdmin() {
  if (getApps().length) return getFirestore();
  const saPath =
    process.env.FIREBASE_SERVICE_ACCOUNT ||
    join(__dirname, '../firebase-service-account.json');
  const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
  initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

function sameRoles(a, b) {
  const left = Array.isArray(a) ? a.map(String).slice().sort() : [];
  const right = Array.isArray(b) ? b.map(String).slice().sort() : [];
  if (left.length !== right.length) return false;
  return left.every((v, i) => v === right[i]);
}

async function main() {
  const db = initAdmin();
  const snap = await db.collection('users').get();
  const rows = [];

  snap.forEach((docSnap) => {
    const data = docSnap.data() || {};
    const deprecatedTenant = typeof data.tenantId === 'string' ? data.tenantId : '';
    const deprecatedRuoli = Array.isArray(data.ruoli) ? data.ruoli : [];
    const memberships = data.tenantMemberships && typeof data.tenantMemberships === 'object'
      ? data.tenantMemberships
      : {};

    for (const [tenantId, mem] of Object.entries(memberships)) {
      if (!mem || typeof mem !== 'object') continue;
      const memRuoli = Array.isArray(mem.ruoli) ? mem.ruoli : [];
      if (deprecatedTenant !== tenantId) continue;
      if (sameRoles(memRuoli, deprecatedRuoli)) continue;
      rows.push({
        uid: docSnap.id,
        email: data.email || '',
        tenantId,
        ruoliMembership: memRuoli,
        ruoliDeprecati: deprecatedRuoli,
        statoMembership: mem.stato || '',
      });
    }
  });

  console.log('Audit membership vs ruoli deprecati (sola lettura)');
  console.log('Utenti con mismatch sullo stesso tenant:', rows.length);
  for (const r of rows) {
    console.log(
      `- ${r.uid} <${r.email}> tenant=${r.tenantId} membership=[${r.ruoliMembership.join(',')}] deprecati=[${r.ruoliDeprecati.join(',')}] stato=${r.statoMembership}`
    );
  }
  if (rows.length === 0) {
    console.log('(nessun mismatch)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
