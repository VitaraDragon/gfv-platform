# 🌾 GFV Platform - Global Farm View

**Piattaforma SaaS multi-tenant per la gestione aziende agricole**

## 📋 Descrizione

GFV Platform è una piattaforma modulare pay-per-use per la gestione completa di aziende agricole. Supporta diversi tipi di colture (vigneti, frutteti, seminativi) e offre funzionalità per clienti, terreni, lavori, calcoli e reportistica.

## 🎯 Caratteristiche Principali

- **Multi-tenant**: Isolamento completo dei dati per ogni azienda
- **Modulare**: Moduli indipendenti per tipo di coltura
- **Ruoli e Permessi**: Sistema completo di gestione accessi
- **Real-time**: Sincronizzazione dati in tempo reale
- **Scalabile**: Architettura pronta per crescita
- **Tony (assistente IA)**: Capocantiere digitale integrato (Gemini via Cloud Function); risponde a domande e comandi testuali; estensibile a voce e azioni nell’app. Vedi `docs-sviluppo/GUIDA_SVILUPPO_TONY.md` e `functions/README.md`.

## 🏗️ Architettura

```
gfv-platform/
├── core/              # Servizi base (sempre inclusi)
│   ├── auth/          # Autenticazione
│   ├── tenant/        # Gestione tenant
│   ├── subscription/  # Gestione abbonamenti
│   ├── models/        # Modelli dati
│   └── services/      # Servizi core
│
├── modules/           # Moduli pay-per-use
│   ├── vendemmia/     # Modulo vigneto
│   ├── frutteto/      # Modulo frutteto
│   ├── seminativo/    # Modulo seminativo
│   └── contoterzi/    # Conto terzi
│
└── shared/            # Componenti condivisi
    ├── components/    # Widget riutilizzabili
    ├── utils/         # Utility functions
    └── styles/        # Stili globali
```

## 🚀 Quick Start

### Prerequisiti

- Node.js (opzionale, per build tools)
- Account Firebase
- Browser moderno (Chrome, Firefox, Safari, Edge)

### Installazione

1. **Clona il repository:**
   ```bash
   git clone https://github.com/tuousername/gfv-platform.git
   cd gfv-platform
   ```

2. **Configura Firebase:**
   - Segui le istruzioni in `core/SETUP_FIREBASE.md`
   - Crea un nuovo progetto Firebase
   - Copia la configurazione in `core/firebase-config.js`

3. **Inizializza l'applicazione:**
   ```javascript
   import { initializeCore } from './core/init.js';
   import { firebaseConfig } from './core/firebase-config.js';
   
   await initializeCore(firebaseConfig);
   ```

## 📚 Documentazione

- [Setup Firebase](core/SETUP_FIREBASE.md) - Configurazione progetto Firebase
- [Core Documentation](core/README.md) - Documentazione servizi core
- [Documentazione utente](documentazione-utente/) - Guide per gli utenti finali
- [Documenti di sviluppo](docs-sviluppo/) - Analisi, piani e riepiloghi creati durante lo sviluppo
- [Guida sviluppo Tony](docs-sviluppo/GUIDA_SVILUPPO_TONY.md) - Assistente IA (Gemini), architettura, come provare
- [Cloud Functions (Tony)](functions/README.md) - Deploy tonyAsk, GEMINI_API_KEY, regione europe-west1

## 🛠️ Tecnologie

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Architettura**: Multi-tenant, Modulare
- **Deploy**: Firebase Hosting (consigliato)

## 📦 Moduli Disponibili

### Core (Sempre incluso)
- Autenticazione e gestione utenti
- Gestione tenant
- Dashboard base

### Modulo Vigneto (€12/mese)
- Calcolo compensi vendemmia
- Gestione tariffe
- Report vendemmia

### Modulo Frutteto (€12/mese)
- Gestione raccolta
- Calcoli produzione

### Conto Terzi (€8/mese)
- Gestione lavori
- Fatturazione

## 🔐 Sicurezza

- Autenticazione obbligatoria
- Isolamento dati per tenant
- Firestore Security Rules
- Validazione input lato client e server

## 📝 Licenza

[Specifica la licenza qui]

## 👥 Contribuire

### Branch e pubblicazione

Il sito online è servito da **GitHub Pages dalla radice di `main`**: ogni commit su `main` è pubblicato subito.

| Branch | Contenuto | Online |
|--------|-----------|--------|
| `main` | Solo versioni verificate | **Sì** — sito pubblico |
| `develop` | Lavoro che funziona ma non ancora verificato a fondo | No |

Flusso:

1. Nuovo lavoro → branch dedicato che parte da `develop`.
2. PR verso `develop`. La CI gira sulle PR e sui push a `develop`.
3. Prove su `develop` **in locale con gli emulatori** (`?emulator=1`) o col simulatore, non sul sito pubblico.
4. Quando la versione è considerata sicura: PR `develop` → `main`. Solo qui cambia ciò che è online.

**Attenzione ai dati:** esiste un solo progetto Firebase (`gfv-platform`). `develop` e `main` condividono lo stesso Firestore, Auth e Storage: il branch protegge il *sito*, non i *dati*. Per provare scritture usa emulatori o simulatore, mai l'ambiente reale.

## 📞 Supporto

[Informazioni di contatto]

## 🗺️ Roadmap

- [x] Core services e modelli base
- [ ] Sistema ruoli e permessi completo
- [ ] Sistema inviti utenti
- [ ] Modulo Vigneto (refactoring da vecchia app)
- [ ] Modulo Frutteto
- [ ] Modulo Conto Terzi
- [ ] App mobile Flutter
- [ ] Integrazione pagamenti (Stripe)

---

**Versione:** 1.0.0-alpha  
**Stato:** In sviluppo attivo
