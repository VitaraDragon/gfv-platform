# 🧪 Setup Test Automatici - Guida Rapida

## ✅ Cosa Ho Creato

Ho configurato un sistema di test automatici per la tua app usando **Vitest** (moderno, veloce, compatibile con ES modules).

### File Creati:

1. **`package.json`** - Configurazione progetto e script test
2. **`vitest.config.js`** - Configurazione Vitest
3. **`tests/models/Terreno.test.js`** - Test per modello Terreno (15+ test)
4. **`tests/models/Attivita.test.js`** - Test per modello Attività (20+ test)
5. **`tests/utils/validations.test.js`** - Test per funzioni validazione (15+ test)
6. **`tests/README.md`** - Documentazione completa test
7. **`.gitignore`** - Aggiornato per ignorare node_modules e coverage

## 🚀 Come Iniziare (3 Passi)

### Passo 1: Installa Node.js (se non ce l'hai)

1. Vai su: https://nodejs.org/
2. Scarica la versione LTS (consigliata)
3. Installa

**Verifica installazione**:
```bash
node --version
npm --version
```

### Passo 2: Installa Dipendenze

Apri PowerShell/Terminal nella cartella `gfv-platform`:

```bash
cd C:\Users\Pier\Desktop\GFV\gfv-platform
npm install
```

Questo installerà:
- `vitest` - Framework di test
- `@vitest/ui` - Interfaccia grafica per test

### Passo 3: Esegui i Test

```bash
npm test
```

Dovresti vedere qualcosa come:

```
✓ tests/models/Terreno.test.js (15)
✓ tests/models/Attivita.test.js (20)
✓ tests/utils/validations.test.js (15)

Test Files  3 passed (3)
     Tests  50 passed (50)
      Time  1.5s
```

## 📊 Cosa Testano i Test

### ✅ Test Modello Terreno (15 test)
- Creazione terreno con dati minimi/completi
- Validazione (nome obbligatorio, superficie negativa, coordinate)
- Metodi helper (setSuperficieDaMappa, setPolygonCoords, hasMappa)
- Conversione Firestore

### ✅ Test Modello Attività (20 test)
- Creazione attività
- **Calcolo ore nette** (vari scenari: con pause, senza pause, pause eccessive)
- **Validazione completa** (data futura, orari, pause, campi obbligatori)
- Conversione Firestore

### ✅ Test Validazioni (15 test)
- Validazione email
- Validazione data (formato, validità)
- Validazione orario (HH:MM)
- Verifica data non futura

## 🎯 Comandi Disponibili

```bash
# Esegui test in modalità watch (ri-esegue quando modifichi file)
npm test

# Esegui test una volta
npm run test:run

# Esegui test con interfaccia grafica (apre browser)
npm run test:ui

# Esegui test con coverage (mostra % codice testato)
npm run test:coverage
```

## 💡 Esempio Pratico

### Prima (Test Manuale):
1. Apri browser
2. Crea attività con orario 08:00-17:00, pause 60min
3. Verifica che mostri 8 ore
4. Ripeti per ogni scenario...

### Ora (Test Automatico):
```bash
npm test
```

Vedi subito:
- ✅ Calcolo ore nette: 8 ore (08:00-17:00, pause 60min)
- ✅ Calcolo ore nette: 3.5 ore (08:00-12:00, pause 30min)
- ✅ Calcolo ore nette: 0 ore (se pause >= tempo lavoro)
- ✅ Validazione: data futura rifiutata
- ✅ Validazione: orario fine <= inizio rifiutato
- ... e altri 45+ test in 1 secondo!

## 🔧 Aggiungere Nuovi Test

Vuoi testare un nuovo servizio? Crea:

```javascript
// tests/services/terreni-service.test.js
import { describe, test, expect } from 'vitest';

describe('TerreniService', () => {
  test('Crea terreno con dati validi', async () => {
    // Test qui
  });
});
```

Poi esegui `npm test` e vedi i risultati!

## ⚠️ Note Importanti

1. **I test NON si connettono a Firebase reale**: Testano solo la logica JavaScript
2. **I test sono veloci**: Eseguono in < 2 secondi
3. **I test si aggiornano automaticamente**: In modalità watch, ri-eseguono quando modifichi file
4. **Coverage**: Mostra quanta parte del codice è testata

## 🐛 Problemi?

### Errore: "npm non è riconosciuto"
- Installa Node.js (vedi Passo 1)

### Errore: "Cannot find module"
- Esegui `npm install` nella cartella `gfv-platform`

### Test falliscono
- Leggi il messaggio di errore
- Verifica cosa si aspettava il test
- Controlla il codice testato

## 📚 Prossimi Passi

Dopo aver eseguito i test base, puoi:

1. **Aggiungere test per servizi** (terreni-service, attivita-service)
2. **Aggiungere test per integrazioni** (con mock Firebase)
3. **Aumentare coverage** (testare più parti del codice)

---

**Pronto per testare!** 🚀

Esegui `npm install` e poi `npm test` per vedere i test in azione!

