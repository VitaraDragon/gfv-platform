# 🎯 Piano: Login → Dashboard Base

## 💡 Strategia

### Approccio: "Una Dashboard, Contenuto Dinamico"

**Invece di** creare dashboard separate per ogni ruolo, creiamo:
- **Una dashboard base** che mostra contenuto diverso in base al ruolo
- Usa `PermissionService` per decidere cosa mostrare
- Più semplice da mantenere
- Facile da estendere

---

## 🚀 Step 1: Pagina Login (PRIMA)

**Obiettivo**: Testare che Firebase funzioni e autenticazione funzioni

### File: `core/auth/login.html`

**Funzionalità**:
- Form email/password
- Pulsante "Accedi"
- Gestione errori
- Loading state
- Redirect a dashboard dopo login

**Usa**:
- `auth-service.js` → `signIn()`
- `error-handler.js` (da vecchia app)
- `loading-handler.js` (da vecchia app)

**Dopo login**:
- Redirect a `core/dashboard.html`

---

## 🏠 Step 2: Dashboard Base (DOPO)

**Obiettivo**: Pagina principale che mostra contenuto in base al ruolo

### File: `core/dashboard.html`

**Struttura**:
```
Dashboard Base
├── Header (nome utente, logout)
├── Sidebar (menu navigazione - vuoto per ora)
└── Main Content (dinamico in base al ruolo)
    ├── Se Amministratore: [contenuto admin]
    ├── Se Manager: [contenuto manager]
    ├── Se Caposquadra: [contenuto caposquadra]
    └── Se Operaio: [contenuto operaio]
```

**Usa**:
- `auth-service.js` → `getCurrentUserData()`
- `permission-service.js` → `hasRole()`, `canManageClients()`, etc.
- `tenant-service.js` → `getCurrentTenant()`

---

## 📊 Contenuto Dashboard per Ruolo

### Amministratore (Più Completo)

**Sezioni**:
- Info tenant/azienda
- Statistiche generali
- Gestione utenti (link futuro)
- Gestione abbonamento (link futuro)
- Moduli attivi
- Link a tutti i moduli disponibili

### Manager

**Sezioni**:
- Statistiche operazioni
- Clienti recenti
- Lavori in corso
- Link a moduli: Clienti, Vendemmia, Bilancio

### Caposquadra

**Sezioni**:
- Lavori assegnati
- Ore da validare (priorità)
- Squadra
- Link a moduli: Lavori, Validazione ore

### Operaio

**Sezioni**:
- Lavori di oggi
- Segna ore (form semplice)
- Stato validazione ore
- Link minimi (solo necessari)

---

## 🎯 Ordine di Sviluppo

### Fase 1: Login (Oggi)

1. Crea `core/auth/login.html`
2. Aggiungi form login
3. Collega a `auth-service.js`
4. Testa login con Firebase
5. Redirect a dashboard

**Risultato**: Login funzionante ✅

### Fase 2: Dashboard Base (Dopo Login)

1. Crea `core/dashboard.html`
2. Header con info utente
3. Contenuto base (uguale per tutti)
4. Aggiungi logica per ruolo (inizia con Amministratore)
5. Testa con utenti diversi

**Risultato**: Dashboard che mostra contenuto in base al ruolo ✅

---

## 💻 Implementazione Dashboard

### Approccio: JavaScript Dinamico

```javascript
// Nel dashboard.html
async function loadDashboard() {
  const user = getCurrentUserData();
  
  // Mostra contenuto base
  showBaseContent();
  
  // Aggiungi contenuto in base al ruolo
  if (hasRole(user, 'amministratore')) {
    showAdminContent();
  } else if (hasRole(user, 'manager')) {
    showManagerContent();
  } else if (hasRole(user, 'caposquadra')) {
    showCaposquadraContent();
  } else if (hasRole(user, 'operaio')) {
    showOperaioContent();
  }
}
```

### Vantaggi:

✅ Una sola pagina da mantenere  
✅ Contenuto dinamico  
✅ Facile aggiungere nuove sezioni  
✅ Codice pulito e organizzato

---

## 🎨 Design Dashboard

### Layout Base:

```
┌─────────────────────────────────────┐
│ Header: [Logo] [Nome Utente] [Logout] │
├──────────┬──────────────────────────┤
│          │                          │
│ Sidebar  │  Main Content            │
│ (Menu)   │  (Dinamico per ruolo)    │
│          │                          │
│          │                          │
└──────────┴──────────────────────────┘
```

### Responsive:

- Desktop: Sidebar + Main
- Mobile: Menu hamburger + Main

---

## 📝 Checklist Sviluppo

### Login (`core/auth/login.html`)

- [ ] HTML form (email, password)
- [ ] Stili base
- [ ] JavaScript per gestione form
- [ ] Integrazione `auth-service.js`
- [ ] Gestione errori
- [ ] Loading state
- [ ] Redirect dopo login
- [ ] Test con Firebase

### Dashboard (`core/dashboard.html`)

- [ ] HTML struttura base
- [ ] Header con info utente
- [ ] Sidebar menu (vuoto per ora)
- [ ] Area main content
- [ ] JavaScript per caricamento contenuto
- [ ] Logica per ruolo (inizia con Amministratore)
- [ ] Stili responsive
- [ ] Test con utenti diversi

---

## 🚀 Iniziamo?

**Ordine consigliato**:

1. **Login** (testa Firebase) → 2-3 ore
2. **Dashboard base** (contenuto amministratore) → 3-4 ore
3. **Estendi dashboard** (altri ruoli) → 2-3 ore

**Totale**: 1 giorno per avere login + dashboard funzionante

---

**Vuoi che iniziamo con il Login?** 🚀

