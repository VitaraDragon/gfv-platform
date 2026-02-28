# 📁 Struttura Progetti - Separazione Vecchia App e GFV Platform

**Ultimo aggiornamento: 2026-02-25 (verifica allineamento codice/doc).**

## ✅ Stato Attuale

### Vecchia App (Vendemmia Meccanizzata)
- **Posizione**: `gfv-platform/vecchia app/`
- **Repository Git**: `gfv-platform/vecchia app/.git` ✅ **INTATTO**
- **Stato**: Funzionante, non modificato
- **Progetto Firebase**: `vendemmia-meccanizzata` (vecchio)
- **File**: Tutti i file originali presenti

### Nuovo Progetto (GFV Platform)
- **Posizione**: `gfv-platform/` (root)
- **Repository Git**: `gfv-platform/.git` ✅ **PRESENTE** (separato da vecchia app)
- **Stato**: In sviluppo attivo
- **Progetto Firebase**: `gfv-platform` ✅ **CONFIGURATO** (Authentication, Firestore, Functions, Hosting)
- **File**: `core/`, `modules/`, `shared/`, `functions/`, `docs-sviluppo/`, etc.

## 🔒 Separazione Garantita

### Repository Git Separati

```
gfv-platform/
├── .git/                    # ✅ Repository Git GFV Platform (separato)
│   └── Solo per GFV Platform
│
└── vecchia app/
    ├── .git/                # ✅ Repository Git esistente (INTATTO)
    │   └── Vecchia app funzionante
    │
    └── [tutti i file originali]  # ✅ NON MODIFICATI
```

### Progetti Firebase Separati

```
Firebase Projects:
├── vendemmia-meccanizzata   # ✅ Vecchia app (esistente, funzionante)
│   └── Usato da: vecchia app/
│
└── gfv-platform             # ✅ Progetto configurato
    └── Usato da: core/, functions/, hosting
```

## 📋 Verifica Separazione

### ✅ Vecchia App - Tutto OK

- [x] Repository Git funzionante in `vecchia app/.git`
- [x] Nessun file modificato dal nuovo progetto
- [x] Configurazione Firebase originale intatta
- [x] Tutti i file originali presenti

### ✅ Nuovo Progetto - Stato attuale

- [x] Repository Git presente in `gfv-platform/.git`
- [x] Progetto Firebase creato e configurato (`gfv-platform`)
- [x] Configurazione Firebase in uso (es. `core/config/firebase-config.js`, Cloud Functions, Hosting)

## 🚀 Setup Nuovo Repository Git

Il nuovo repository Git deve essere creato **SOLO** nella root `gfv-platform/`, **NON** in `vecchia app/`.

### Comandi da Eseguire

```bash
# Vai nella root del nuovo progetto (NON in vecchia app!)
cd C:\Users\Pier\Desktop\GFV\gfv-platform

# Inizializza NUOVO repository Git
git init

# Aggiungi solo i file del nuovo progetto
git add core/
git add shared/
git add README.md
git add .gitignore
git add .gitattributes
git add LICENSE
git add SETUP_GIT.md
git add STRUTTURA_PROGETTI.md

# NON aggiungere vecchia app/ (ha il suo repository)
# Verifica che vecchia app/ non sia traccata
git status

# Crea primo commit
git commit -m "Initial commit: GFV Platform core structure"
```

## ⚠️ IMPORTANTE - Cosa NON Fare

### ❌ NON Fare:

1. **NON** inizializzare Git dentro `vecchia app/` (già ha il suo repository)
2. **NON** aggiungere `vecchia app/` al nuovo repository
3. **NON** modificare file in `vecchia app/`
4. **NON** usare il vecchio progetto Firebase per GFV Platform

### ✅ Fare:

1. **Creare** nuovo repository Git in `gfv-platform/`
2. **Creare** nuovo progetto Firebase `gfv-platform`
3. **Mantenere** `vecchia app/` completamente separata
4. **Usare** `.gitignore` per escludere `vecchia app/` dal nuovo repository

## 📝 .gitignore per Nuovo Repository

Il file `.gitignore` in `gfv-platform/` dovrebbe escludere `vecchia app/`:

```gitignore
# Escludi vecchia app (ha il suo repository Git)
vecchia app/

# File sensibili
core/firebase-config.js
google-maps-config.js

# Altri file da escludere...
```

## 🔍 Verifica Finale

Dopo aver creato il nuovo repository, verifica:

```bash
# Nel nuovo repository (gfv-platform/)
git status

# NON dovrebbe mostrare:
# - vecchia app/ (esclusa)
# - core/firebase-config.js (escluso se contiene chiavi)

# Dovrebbe mostrare:
# - core/ (tranne firebase-config.js)
# - shared/
# - README.md
# - .gitignore
```

## 📊 Struttura Finale

```
Desktop/GFV/
└── gfv-platform/
    ├── .git/                    # NUOVO repository Git
    ├── core/                    # Nuovo core
    ├── shared/                  # Nuovo shared
    ├── README.md                # Nuovo README
    ├── .gitignore               # Esclude vecchia app/
    │
    └── vecchia app/             # SEPARATA
        ├── .git/                # Vecchio repository Git (INTATTO)
        ├── index.html           # File originali
        ├── firebase-config.js   # Config vecchia app
        └── ...                  # Tutti i file originali
```

## ✅ Checklist Separazione

- [x] Vecchia app repository Git intatto
- [x] Nessun file della vecchia app modificato
- [x] Nuovo progetto in cartelle separate (`core/`, `shared/`)
- [ ] Nuovo repository Git creato (da fare)
- [ ] Nuovo progetto Firebase creato (da fare)
- [ ] `.gitignore` esclude `vecchia app/`
- [ ] Configurazione Firebase separata

## 🆘 Se Qualcosa Va Storto

### Ripristino Vecchia App

Se per errore hai modificato qualcosa nella vecchia app:

```bash
cd "C:\Users\Pier\Desktop\GFV\gfv-platform\vecchia app"
git status                    # Vedi modifiche
git checkout .                # Ripristina tutti i file
git clean -fd                 # Rimuovi file non tracciati (attenzione!)
```

### Verifica Integrità

```bash
# Verifica che vecchia app sia separata
cd "C:\Users\Pier\Desktop\GFV\gfv-platform\vecchia app"
git log --oneline -5          # Dovrebbe mostrare commit originali
git remote -v                 # Dovrebbe mostrare remote originale
```

---

**Conclusione**: La vecchia app è completamente intatta e separata. Il nuovo progetto GFV Platform è pronto per essere inizializzato come repository Git separato.






