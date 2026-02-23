/**
 * Script per verificare dove si trova Trinciatura in Firestore
 * 
 * Uso: node scripts/check-triniciatura-firestore.js [tenantId]
 * 
 * Se tenantId non fornito, scorre tutti i tenant.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Service account
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || join(__dirname, '../firebase-service-account.json');
let app;
try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
  app = initializeApp({ credential: cert(serviceAccount) });
} catch (error) {
  console.error('❌ Errore: firebase-service-account.json non trovato o invalido.');
  console.error('   Copia le credenziali da Firebase Console > Project Settings > Service Accounts');
  process.exit(1);
}

const db = getFirestore(app);

async function getCategorieStructure(tenantId) {
  const catMap = {};
  const loadFrom = async (colName) => {
    const snap = await db.collection(`tenants/${tenantId}/${colName}`).get();
    snap.forEach(doc => {
      const d = doc.data();
      const id = doc.id;
      const nome = d.nome || id;
      const parentId = d.parentId || d.parent;
      catMap[id] = { nome, parentId };
    });
  };
  await loadFrom('categorie');
  await loadFrom('categorieLavori');
  return { catMap };
}

async function checkTrinciatura(tenantId) {
  const tipiRef = db.collection(`tenants/${tenantId}/tipiLavoro`);
  const snap = await tipiRef.get();
  
  const trinciature = [];
  snap.forEach(doc => {
    const d = doc.data();
    const nome = (d.nome || '').toLowerCase();
    if (nome.includes('trinciatura') || nome.includes('trinciato')) {
      trinciature.push({ id: doc.id, ...d });
    }
  });

  if (trinciature.length === 0) return null;

  const { catMap, sottocatByParent } = await getCategorieStructure(tenantId);

  const resolveCat = (id) => {
    if (!id) return '?';
    const entry = catMap[id];
    if (!entry) return id + ' (non trovato in categorieLavori)';
    if (entry.parentId) {
      const parentNome = catMap[entry.parentId]?.nome || entry.parentId;
      return parentNome + ' > ' + entry.nome;
    }
    return entry.nome;
  };

  return trinciature.map(t => ({
    id: t.id,
    nome: t.nome,
    categoriaId: t.categoriaId,
    sottocategoriaId: t.sottocategoriaId,
    categoria: resolveCat(t.categoriaId || t.sottocategoriaId),
  }));
}

async function listTenantIds() {
  const snap = await db.collection('tenants').get();
  return snap.docs.map(d => d.id);
}

async function main() {
  console.log('🔍 Verifica Trinciatura in Firestore');
  console.log('=====================================\n');

  const tenantId = process.argv[2];
  const tenantIds = tenantId ? [tenantId] : await listTenantIds();

  if (tenantIds.length === 0) {
    console.log('Nessun tenant trovato.');
    return;
  }

  for (const tid of tenantIds) {
    console.log(`📂 Tenant: ${tid}`);
    const results = await checkTrinciatura(tid);
    if (!results) {
      console.log('   Nessun tipo "Trinciatura" trovato.\n');
      continue;
    }
    results.forEach(r => {
      console.log(`   • ${r.nome}`);
      console.log(`     categoriaId: ${r.categoriaId || '(vuoto)'}`);
      console.log(`     sottocategoriaId: ${r.sottocategoriaId || '(vuoto)'}`);
      console.log(`     → Risolto a: ${r.categoria}`);
      console.log('');
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Errore:', err.message);
    process.exit(1);
  });
