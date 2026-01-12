/**
 * Script Backup Firestore
 * 
 * Esegue un backup completo di Firestore esportando tutti i dati
 * 
 * Uso:
 * node scripts/backup-firestore.js [output-dir]
 * 
 * Output: cartella con backup JSON di tutte le collections
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Output directory
const outputDir = process.argv[2] || join(__dirname, '../backups/backup-' + new Date().toISOString().split('T')[0]);

console.log('💾 Script Backup Firestore');
console.log('==========================================');
console.log(`Output: ${outputDir}`);
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
 * Backup di una collection
 */
async function backupCollection(collectionName) {
  console.log(`📦 Backup collection: ${collectionName}...`);
  
  try {
    const snapshot = await db.collection(collectionName).get();
    const data = [];
    
    snapshot.forEach(doc => {
      data.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Salva in file JSON
    const outputPath = join(outputDir, `${collectionName}.json`);
    writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    
    console.log(`  ✅ ${data.length} documenti salvati in ${collectionName}.json`);
    return data.length;
  } catch (error) {
    console.error(`  ❌ Errore backup ${collectionName}:`, error.message);
    return 0;
  }
}

/**
 * Backup di tutte le collections
 */
async function backupAll() {
  console.log('📊 Inizio backup...');
  console.log('');
  
  // Crea directory output
  try {
    mkdirSync(outputDir, { recursive: true });
    console.log(`✅ Directory creata: ${outputDir}`);
    console.log('');
  } catch (error) {
    if (error.code !== 'EEXIST') {
      console.error('❌ Errore creazione directory:', error.message);
      process.exit(1);
    }
  }
  
  // Collections principali da backup
  const collections = [
    'users',
    'tenants',
    'inviti'
  ];
  
  let totalDocs = 0;
  const results = {};
  
  for (const collectionName of collections) {
    const count = await backupCollection(collectionName);
    results[collectionName] = count;
    totalDocs += count;
    console.log('');
  }
  
  // Salva riepilogo
  const summary = {
    data: new Date().toISOString(),
    totaleDocumenti: totalDocs,
    collections: results
  };
  
  const summaryPath = join(outputDir, 'backup-summary.json');
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
  
  console.log('==========================================');
  console.log('📊 Riepilogo Backup');
  console.log('==========================================');
  console.log(`📁 Directory: ${outputDir}`);
  console.log(`📄 Totale documenti: ${totalDocs}`);
  console.log('');
  console.log('Collections:');
  for (const [name, count] of Object.entries(results)) {
    console.log(`  - ${name}: ${count} documenti`);
  }
  console.log('');
  console.log(`✅ Backup completato!`);
  console.log(`📄 Riepilogo salvato in: backup-summary.json`);
}

// Esegui backup
backupAll()
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
