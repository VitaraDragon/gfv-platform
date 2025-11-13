# 🧪 Test Automatici - GFV Platform

## 📋 Cosa Sono i Test Automatici

I test automatici sono codice che verifica automaticamente se il tuo codice funziona correttamente. Invece di testare manualmente ogni volta che modifichi qualcosa, esegui i test e vedi subito se tutto funziona.

## 🚀 Come Eseguire i Test

### Prerequisiti

1. **Installa Node.js** (se non ce l'hai):
   - Scarica da: https://nodejs.org/
   - Versione consigliata: 18.x o superiore

2. **Installa le dipendenze**:
   ```bash
   cd gfv-platform
   npm install
   ```

### Comandi Disponibili

#### Eseguire tutti i test (modalità watch)
```bash
npm test
```
Esegue i test e li ri-esegue automaticamente quando modifichi i file.

#### Eseguire tutti i test una volta
```bash
npm run test:run
```
Esegue tutti i test una volta e mostra i risultati.

#### Eseguire test con interfaccia grafica
```bash
npm run test:ui
```
Apre un'interfaccia web per vedere i test in modo più visuale.

#### Eseguire test con coverage
```bash
npm run test:coverage
```
Mostra quanta parte del codice è coperta dai test.

## 📁 Struttura Test

```
tests/
├── models/              # Test per modelli dati
│   ├── Terreno.test.js
│   └── Attivita.test.js
├── services/            # Test per servizi (da creare)
│   └── ...
├── utils/               # Test per utility
│   └── validations.test.js
└── README.md            # Questo file
```

## ✅ Test Attualmente Disponibili

### Modelli
- ✅ **Terreno.test.js**: Test per modello Terreno
  - Costruttore
  - Validazione
  - Metodi helper (setSuperficieDaMappa, setPolygonCoords, etc.)
  - Conversione Firestore

- ✅ **Attivita.test.js**: Test per modello Attività
  - Costruttore
  - Calcolo ore nette (vari scenari)
  - Validazione (data, orari, pause)
  - Conversione Firestore

### Utility
- ✅ **validations.test.js**: Test per funzioni di validazione
  - Validazione email
  - Validazione data
  - Validazione orario
  - Verifica data non futura

## 🎯 Cosa Testano i Test

### Test Modelli
I test verificano che:
- I modelli creano correttamente oggetti da dati
- Le validazioni funzionano (campi obbligatori, formati, logica)
- I calcoli automatici funzionano (es. ore nette)
- Le conversioni Firestore funzionano

### Test Validazioni
I test verificano che:
- Le funzioni di validazione accettano input validi
- Le funzioni di validazione rifiutano input invalidi
- I messaggi di errore sono corretti

## 📊 Esempio Output

Quando esegui `npm test`, vedi qualcosa come:

```
✓ tests/models/Terreno.test.js (15)
  ✓ Terreno Model (15)
    ✓ Costruttore (3)
      ✓ Crea terreno con dati minimi
      ✓ Crea terreno con tutti i dati
      ✓ Converte superficie in numero
    ✓ Validazione (5)
      ✓ Terreno valido passa validazione
      ✓ Terreno senza nome fallisce validazione
      ...

Test Files  3 passed (3)
     Tests  45 passed (45)
      Time  1.2s
```

## 🔧 Aggiungere Nuovi Test

### 1. Crea file di test
Crea un nuovo file nella cartella appropriata:
```
tests/services/terreni-service.test.js
```

### 2. Scrivi i test
```javascript
import { describe, test, expect } from 'vitest';

describe('TerreniService', () => {
  test('Crea terreno con dati validi', async () => {
    // Test qui
  });
});
```

### 3. Esegui i test
```bash
npm test
```

## 💡 Best Practices

1. **Testa comportamenti, non implementazione**: Testa cosa fa il codice, non come lo fa
2. **Un test = un comportamento**: Ogni test verifica una cosa specifica
3. **Nomi descrittivi**: I nomi dei test devono dire cosa testano
4. **Test indipendenti**: Ogni test deve poter funzionare da solo
5. **Test veloci**: I test devono essere veloci da eseguire

## 🐛 Risoluzione Problemi

### Test falliscono
1. Leggi il messaggio di errore
2. Verifica cosa si aspettava il test
3. Controlla il codice testato
4. Correggi il problema

### Test lenti
- I test dovrebbero essere veloci (< 1 secondo per file)
- Se sono lenti, verifica se stai facendo chiamate a Firebase reali (usa mock)

### Coverage basso
- Aggiungi test per parti di codice non coperte
- Focus su funzionalità critiche

## 📚 Risorse

- **Vitest Docs**: https://vitest.dev/
- **Testing Best Practices**: https://testingjavascript.com/

---

**Nota**: Questi test sono per il codice JavaScript. Non testano l'interfaccia utente (HTML/CSS) o le integrazioni con Firebase reali. Per testare l'UI, servono test end-to-end (E2E) con strumenti come Playwright o Cypress.


