/**
 * Script Migrazione: Converti tenantId in tenantMemberships
 * 
 * Esegue:
 * 1. Per ogni utente con tenantId ma senza tenantMemberships
 * 2. Crea tenantMemberships[tenantId] con dati esistenti
 * 3. Imposta tenantIdPredefinito: true
 * 4. Mantiene tenantId e ruoli per retrocompatibilità
 * 
 * Uso:
 * node scripts/migrate-user-tenant-memberships.js [--dry-run]
 * 
 * IMPORTANTE: Prima di eseguire:
 * 1. Backup completo Firestore
 * 2. Test su database di sviluppo
 * 3. Esegui prima con --dry-run per vedere cosa verrà modificato
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Verifica se è dry-run
const isDryRun = process.argv.includes('--dry-run');

console.log('🚀 Script Migrazione Multi-Tenant Membership');
console.log('==========================================');
console.log(`Modalità: ${isDryRun ? 'DRY-RUN (nessuna modifica)' : 'ESECUZIONE REALE'}`);
console.log('');

// Carica configurazione Firebase
let firebaseConfig;
try {
  // Prova a caricare da firebase-config.js (se esiste)
  const configPath = join(__dirname, '../core/config/firebase-config.js');
  const configContent = readFileSync(configPath, 'utf-8');
  
  // Estrai configurazione (assumendo formato window.firebaseConfig = {...})
  const match = configContent.match(/window\.firebaseConfig\s*=\s*({[\s\S]*?});/);
  if (match) {
    firebaseConfig = eval('(' + match[1] + ')');
  } else {
    throw new Error('Configurazione non trovata nel formato atteso');
  }
} catch (error) {
  console.error('❌ Errore caricamento configurazione Firebase:', error.message);
  console.error('');
  console.error('IMPORTANTE: Questo script richiede Firebase Admin SDK.');
  console.error('Per eseguire la migrazione:');
  console.error('1. Installa Firebase Admin SDK: npm install firebase-admin');
  console.error('2. Crea un file di credenziali service account da Firebase Console');
  console.error('3. Modifica questo script per usare le credenziali service account');
  console.error('');
  console.error('Alternativa: Usa Firebase CLI per eseguire la migrazione manualmente');
  process.exit(1);
}

// Inizializza Firebase Admin (richiede credenziali service account)
// NOTA: Per usare questo script, devi:
// 1. Andare su Firebase Console > Project Settings > Service Accounts
// 2. Generare una nuova chiave privata
// 3. Salvare il file JSON e passarlo qui
let app;
try {
  // Prova a caricare credenziali da variabili d'ambiente o file
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || join(__dirname, '../firebase-service-account.json');
  
  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
    app = initializeApp({
      credential: cert(serviceAccount)
    });
    console.log('✅ Firebase Admin inizializzato con service account');
  } catch (error) {
    console.warn('⚠️ Service account non trovato, uso configurazione alternativa');
    // Fallback: usa configurazione normale (non funzionerà per Admin SDK)
    // In produzione, usa sempre service account
    throw new Error('Firebase Admin SDK richiede credenziali service account');
  }
} catch (error) {
  console.error('❌ Errore inizializzazione Firebase Admin:', error.message);
  console.error('');
  console.error('SOLUZIONE:');
  console.error('1. Vai su Firebase Console > Project Settings > Service Accounts');
  console.error('2. Clicca "Generate new private key"');
  console.error('3. Salva il file JSON come firebase-service-account.json nella root del progetto');
  console.error('4. Oppure imposta variabile d\'ambiente FIREBASE_SERVICE_ACCOUNT con il path al file');
  process.exit(1);
}

const db = getFirestore(app);

/**
 * Migra un utente da tenantId a tenantMemberships
 */
async function migrateUser(userId, userData) {
  const updates = {};
  
  // Crea tenantMemberships se non esiste
  if (!userData.tenantMemberships || Object.keys(userData.tenantMemberships || {}).length === 0) {
    if (userData.tenantId) {
      const ruoli = userData.ruoli && Array.isArray(userData.ruoli) ? userData.ruoli : [];
      const stato = userData.stato || 'attivo';
      
      updates.tenantMemberships = {
        [userData.tenantId]: {
          ruoli: ruoli,
          stato: stato,
          dataInizio: userData.creatoIl || new Date(),
          creatoDa: userData.creatoDa || userId,
          tenantIdPredefinito: true
        }
      };
      
      console.log(`  ✅ Utente ${userId}:`);
      console.log(`     - Tenant: ${userData.tenantId}`);
      console.log(`     - Ruoli: ${ruoli.join(', ') || 'nessuno'}`);
      console.log(`     - Stato: ${stato}`);
    } else {
      console.log(`  ⚠️  Utente ${userId}: nessun tenantId, saltato`);
      return null;
    }
  } else {
    console.log(`  ℹ️  Utente ${userId}: già ha tenantMemberships, saltato`);
    return null;
  }
  
  return updates;
}

/**
 * Esegue la migrazione
 */
async function runMigration() {
  console.log('📊 Inizio migrazione...');
  console.log('');
  
  try {
    // Query: utenti con tenantId ma senza tenantMemberships
    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();
    
    if (snapshot.empty) {
      console.log('ℹ️  Nessun utente trovato');
      return;
    }
    
    console.log(`📋 Trovati ${snapshot.size} utenti totali`);
    console.log('');
    
    let migrated = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const doc of snapshot.docs) {
      const userId = doc.id;
      const userData = doc.data();
      
      // Verifica se ha tenantId ma non tenantMemberships
      const hasTenantId = userData.tenantId && userData.tenantId !== null;
      const hasTenantMemberships = userData.tenantMemberships && 
                                   Object.keys(userData.tenantMemberships).length > 0;
      
      if (hasTenantId && !hasTenantMemberships) {
        try {
          const updates = await migrateUser(userId, userData);
          
          if (updates) {
            if (!isDryRun) {
              // Applica aggiornamento
              await doc.ref.update(updates);
              console.log(`  ✅ Migrato con successo`);
            } else {
              console.log(`  [DRY-RUN] Verrebbe aggiornato con:`, JSON.stringify(updates, null, 2));
            }
            migrated++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.error(`  ❌ Errore migrazione utente ${userId}:`, error.message);
          errors++;
        }
      } else {
        skipped++;
        if (hasTenantMemberships) {
          console.log(`  ℹ️  Utente ${userId}: già migrato (ha tenantMemberships)`);
        } else if (!hasTenantId) {
          console.log(`  ℹ️  Utente ${userId}: nessun tenantId, saltato`);
        }
      }
      
      console.log('');
    }
    
    console.log('==========================================');
    console.log('📊 Riepilogo Migrazione');
    console.log('==========================================');
    console.log(`✅ Migrati: ${migrated}`);
    console.log(`⏭️  Saltati: ${skipped}`);
    console.log(`❌ Errori: ${errors}`);
    console.log('');
    
    if (isDryRun) {
      console.log('⚠️  DRY-RUN: Nessuna modifica effettuata');
      console.log('Per eseguire la migrazione reale, rimuovi --dry-run');
    } else {
      console.log('✅ Migrazione completata!');
    }
    
  } catch (error) {
    console.error('❌ Errore durante migrazione:', error);
    throw error;
  }
}

// Esegui migrazione
runMigration()
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
