# 📖 LEGGIMI PRIMA - Per Nuove Conversazioni

**Ultimo aggiornamento: 2026-03-08.**

## 🎯 Questo File Contiene Tutto

Se stai iniziando una **nuova conversazione** su questo progetto, **LEGGI PRIMA** questo file per capire subito la situazione!

---

## ⚡ Quick Start (30 secondi)

1. **Leggi**: `STATO_PROGETTO_COMPLETO.md` - Contiene TUTTO
2. **Poi leggi**: `STRATEGIA_SVILUPPO.md` - Prossimi passi
3. **Chiedi all'utente**: Cosa vuole sviluppare ora?

---

## 📋 File da Leggere (In Ordine)

### 1. Stato Attuale
- **`STATO_PROGETTO_COMPLETO.md`** ⭐ **LEGGI QUESTO PRIMA!**
  - Cosa abbiamo fatto
  - Cosa funziona
  - Cosa manca
  - Prossimi passi

### 2. Architettura moduli e interazioni
- **`ARCHITETTURA_MODULI_E_INTERAZIONI.md`** ⭐ **Per capire come sono fatti i moduli e come interagiscono**
  - Elenco moduli con servizi, funzioni principali e modelli
  - Soluzioni tecniche (multi-tenant, import dinamici, split macchine/parco-macchine, Tony)
  - Chi chiama chi (interazioni tra core, parco-macchine, vigneto, frutteto, ecc.)
  - Riferimenti a intersezioni-moduli (flussi e ruoli) e ad altri doc

### 3. Strategia
- **`STRATEGIA_SVILUPPO.md`**
  - Strategia di sviluppo
  - Ordine moduli
  - Timeline

### 4. Core Base (Nuovo)
- **`PLAN_CORE_BASE.md`** ⭐ **PIANIFICAZIONE COMPLETA CORE BASE**
  - Visione core base (diario attività)
  - Specifiche complete (terreni, attività, liste, statistiche)
  - Struttura dati
  - Checklist implementazione
  - **LEGGI QUESTO per sviluppare il core base!**

### 5. Tony (assistente IA)
- **`tony/README.md`** ⭐ **Panoramica e link – inizia da qui**
- **`tony/MASTER_PLAN.md`** ⭐ **Piano di riferimento – ogni modifica deve allinearsi**
- **`tony/STATO_ATTUALE.md`** – Stato verificato sul codice
- **`TONY_DECISIONI_E_REQUISITI.md`** – Inventario decisioni e requisiti
- **`GUIDA_SVILUPPO_TONY.md`** – Guida sviluppo modulo Tony

### 6. Architettura
- **`vecchia app/.cursorrules`**
  - Regole complete progetto
  - Architettura target
  - Convenzioni codice

---

## ✅ Cosa Funziona (Testato)

- ✅ **Login** - `core/auth/login-standalone.html` - FUNZIONANTE
- ✅ **Registrazione** - `core/auth/registrazione-standalone.html` - FUNZIONANTE
- ✅ **Registrazione Invito** - `core/auth/registrazione-invito-standalone.html` - FUNZIONANTE
- ✅ **Dashboard completa** - `core/dashboard-standalone.html` - FUNZIONANTE (contenuto per ruolo)
- ✅ **Gestione Utenti** - `core/admin/gestisci-utenti-standalone.html` - FUNZIONANTE
- ✅ **Sistema Inviti** - Completo e funzionante
- ✅ **Stato Online** - Tracciamento in tempo reale funzionante
- ✅ **Core services** - Tutti funzionanti
- ✅ **Firebase** - Configurato e testato

---

## 🚀 Prossimi Passi Pianificati

1. **Core Base** - Vedi `PLAN_CORE_BASE.md` per pianificazione completa
   - Terreni (con mappe opzionali)
   - Diario Attività (con calcolo ore automatico)
   - Liste personalizzabili (tipi lavoro, colture)
   - Statistiche base

2. **Modulo Clienti** oppure **Email service per inviti**

Vedi `STATO_PROGETTO_COMPLETO.md` per dettagli generali.

---

## ⚠️ IMPORTANTE

- **Vecchia app**: `vecchia app/` - NON TOCCARE (ha il suo .git, funzionante)
- **Nuovo progetto**: `gfv-platform/` - Qui sviluppiamo
- **Separazione**: Garantita e verificata

---

## 📞 Se Serve Aiuto

1. Leggi `STATO_PROGETTO_COMPLETO.md`
2. Controlla file di documentazione
3. Chiedi all'utente cosa vuole fare

---

**Questo file ti dà tutto quello che serve per continuare!** 🚀

