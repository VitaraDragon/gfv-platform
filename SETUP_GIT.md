# 🔧 Setup Repository Git - GFV Platform

## 📋 Obiettivo

Creare un nuovo repository Git separato per GFV Platform, indipendente dal progetto esistente.

## 🚀 Step 1: Inizializza Repository Locale

Se non hai ancora inizializzato Git nella cartella `gfv-platform`:

```bash
cd gfv-platform
git init
```

## 📝 Step 2: Crea File Iniziali

Assicurati di avere questi file:

- ✅ `README.md` - Documentazione principale
- ✅ `.gitignore` - File da escludere
- ✅ `.gitattributes` - Normalizzazione line endings
- ✅ `core/firebase-config.example.js` - Template configurazione

## 🔒 Step 3: Configura .gitignore

Il file `.gitignore` è già configurato per escludere:
- File di configurazione con chiavi reali
- File temporanei
- Build files
- Node modules

**IMPORTANTE:** Verifica che `core/firebase-config.js` (con chiavi reali) sia nel `.gitignore`.

## 📦 Step 4: Primo Commit

```bash
# Aggiungi tutti i file (esclusi quelli in .gitignore)
git add .

# Crea primo commit
git commit -m "Initial commit: GFV Platform core structure"

# Verifica che firebase-config.js NON sia stato aggiunto
git status
```

Se vedi `core/firebase-config.js` nell'output, aggiungilo esplicitamente al `.gitignore`:

```bash
echo "core/firebase-config.js" >> .gitignore
git add .gitignore
git commit -m "Add firebase-config.js to gitignore"
```

## 🌐 Step 5: Crea Repository Remoto

### Opzione A: GitHub

1. Vai su [GitHub](https://github.com)
2. Clicca **"New repository"**
3. Nome: `gfv-platform`
4. Descrizione: "Piattaforma SaaS multi-tenant per gestione aziende agricole"
5. **NON** inizializzare con README (lo abbiamo già)
6. Clicca **"Create repository"**

### Opzione B: GitLab

1. Vai su [GitLab](https://gitlab.com)
2. Clicca **"New project"**
3. Scegli **"Create blank project"**
4. Nome: `gfv-platform`
5. Visibilità: Privato (consigliato per progetti con chiavi API)
6. Clicca **"Create project"**

### Opzione C: Altro Git Hosting

Usa il tuo provider Git preferito seguendo le loro istruzioni.

## 🔗 Step 6: Collega Repository Remoto

```bash
# Aggiungi remote (sostituisci con il tuo URL)
git remote add origin https://github.com/tuousername/gfv-platform.git

# Verifica remote
git remote -v
```

## 📤 Step 7: Push Primo Commit

```bash
# Push al branch main
git branch -M main
git push -u origin main
```

## ✅ Step 8: Verifica

1. Vai sul repository remoto
2. Verifica che tutti i file siano presenti
3. **IMPORTANTE:** Verifica che `core/firebase-config.js` NON sia presente
4. Verifica che `core/firebase-config.example.js` sia presente

## 🔄 Workflow Consigliato

### Branch Strategy

```bash
main          # Branch principale (solo codice stabile)
├── develop   # Branch di sviluppo
└── feature/* # Branch per nuove feature
```

### Setup Branch Develop

```bash
# Crea branch develop
git checkout -b develop
git push -u origin develop
```

### Workflow Feature

```bash
# Crea branch feature
git checkout develop
git checkout -b feature/nome-feature

# Sviluppa feature
# ... fai commit ...

# Merge in develop
git checkout develop
git merge feature/nome-feature
git push origin develop

# Elimina branch locale
git branch -d feature/nome-feature
```

## 🔐 Sicurezza Repository

### Checklist Pre-Commit

Prima di ogni commit, verifica:

- [ ] Nessun file con chiavi API reali
- [ ] Nessun file `firebase-config.js` con valori reali
- [ ] File `.gitignore` aggiornato
- [ ] File `firebase-config.example.js` presente

### Verifica Pre-Push

```bash
# Verifica che non ci siano file sensibili
git ls-files | grep -i config
# Dovrebbe mostrare solo file .example.js

# Verifica contenuto file sensibili (se esistono)
git diff HEAD -- core/firebase-config.js
# Non dovrebbe mostrare chiavi reali
```

## 📋 File da NON Committare Mai

- ❌ `core/firebase-config.js` (se contiene chiavi reali)
- ❌ `google-maps-config.js` (se contiene chiavi reali)
- ❌ File `.env` con variabili d'ambiente
- ❌ File con password o token
- ❌ File di backup con dati sensibili

## 📝 File da Committare Sempre

- ✅ `core/firebase-config.example.js` (template)
- ✅ `README.md`
- ✅ `.gitignore`
- ✅ Codice sorgente
- ✅ Documentazione

## 🆘 Problemi Comuni

### "Errore: remote origin already exists"

```bash
# Rimuovi remote esistente
git remote remove origin

# Aggiungi nuovo remote
git remote add origin <nuovo-url>
```

### "Errore: file troppo grandi"

Se hai file grandi da escludere:

```bash
# Aggiungi al .gitignore
echo "path/to/large-file" >> .gitignore

# Rimuovi dal tracking (ma mantieni locale)
git rm --cached path/to/large-file
git commit -m "Remove large file from tracking"
```

### "Errore: conflitti line endings"

Il file `.gitattributes` dovrebbe risolvere automaticamente. Se persistono:

```bash
# Normalizza line endings
git add --renormalize .
git commit -m "Normalize line endings"
```

## 📚 Risorse Utili

- [Git Documentation](https://git-scm.com/doc)
- [GitHub Guides](https://guides.github.com/)
- [GitLab Documentation](https://docs.gitlab.com/)

## ✅ Checklist Finale

- [ ] Repository Git inizializzato
- [ ] `.gitignore` configurato correttamente
- [ ] Primo commit creato
- [ ] Repository remoto creato
- [ ] Remote collegato
- [ ] Primo push completato
- [ ] File sensibili esclusi
- [ ] File template inclusi
- [ ] README.md aggiornato

---

**Nota:** Mantieni sempre separati i repository:
- `vendemmia-meccanizzata` (vecchio progetto)
- `gfv-platform` (nuovo progetto) ✅



