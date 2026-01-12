/**
 * Script Verifica Migrazione
 * 
 * Verifica che la migrazione sia stata eseguita correttamente
 * controllando alcuni utenti campione
 * 
 * Uso:
 * node scripts/verify-migration.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🔍 Script Verifica Migrazione');
console.log('==========================================');
console.log('');

// Carica service account
let app;
try {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || join(__dirname, '../firebase-service-account.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
  app = initializeApp({
    credential: cert(serviceAccount)
  });
  console.log('✅ Firebase Admin inizializzato');
} catch (error) {
  console.error('❌ Errore inizializzazione Firebase Admin:', error.message);
  process.exit(1);
}

const db = getFirestore(app);

/**
 * Verifica un utente
 */
async function verifyUser(userId) {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`  ⚠️  Utente ${userId}: non trovato`);
      return false;
    }
    
    const userData = userDoc.data();
    const hasTenantId = !!userData.tenantId;
    const hasTenantMemberships = !!userData.tenantMemberships && Object.keys(userData.tenantMemberships).length > 0;
    
    if (hasTenantMemberships) {
      const tenantId = Object.keys(userData.tenantMemberships)[0];
      const membership = userData.tenantMemberships[tenantId];
      
      console.log(`  ✅ Utente ${userId}:`);
      console.log(`     - Tenant: ${tenantId}`);
      console.log(`     - Ruoli: ${membership.ruoli?.join(', ') || 'nessuno'}`);
      console.log(`     - Stato: ${membership.stato || 'N/A'}`);
      console.log(`     - Predefinito: ${membership.tenantIdPredefinito ? 'Sì' : 'No'}`);
      console.log(`     - tenantId deprecato: ${hasTenantId ? 'Presente (OK)' : 'Assente'}`);
      
      return true;
    } else {
      console.log(`  ⚠️  Utente ${userId}: non ha tenantMemberships`);
      return false;
    }
  } catch (error) {
    console.error(`  ❌ Errore verifica utente ${userId}:`, error.message);
    return false;
  }
}

/**
 * Verifica migrazione
 */
async function verifyMigration() {
  console.log('📊 Verifica migrazione...');
  console.log('');
  
  try {
    // Prendi alcuni utenti campione
    const snapshot = await db.collection('users').limit(5).get();
    
    if (snapshot.empty) {
      console.log('ℹ️  Nessun utente trovato');
      return;
    }
    
    console.log(`📋 Verificando ${snapshot.size} utenti campione...`);
    console.log('');
    
    let verified = 0;
    for (const doc of snapshot.docs) {
      if (await verifyUser(doc.id)) {
        verified++;
      }
      console.log('');
    }
    
    console.log('==========================================');
    console.log('📊 Riepilogo Verifica');
    console.log('==========================================');
    console.log(`✅ Verificati: ${verified}/${snapshot.size}`);
    console.log('');
    
    if (verified === snapshot.size) {
      console.log('✅ Migrazione verificata con successo!');
    } else {
      console.log('⚠️  Alcuni utenti potrebbero non essere stati migrati correttamente');
    }
    
  } catch (error) {
    console.error('❌ Errore durante verifica:', error);
    throw error;
  }
}

// Esegui verifica
verifyMigration()
  .then(() => {
    console.log('');
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('');
    console.error('❌ Script fallito:', error);
    process.exit(1);
  });
