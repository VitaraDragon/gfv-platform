# Playbook — Lab sostituzioni manodopera (5 aziende)

Prove manuali su emulator: assenze, shortlist, prestito, equipaggio minimo, ruoli manager / caposquadra / operaio.

## Avvio rapido

```bash
# Terminale 1
npm run sim:emulators

# Terminale 2 — opzionale pulizia precedenti
npm run sim:cleanup

# Seed delle 5 aziende lab
npm run sim:run:sostituzioni-lab

# Terminale 3 — app
npm start
```

Apri: [simulator-dev](http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1)  
Password di tutte le personas: **`SimGFV2026!`**

Per ogni card azienda: **Entra (dashboard)** = manager · **Capo (mobile)** · **Operaio (mobile)**.

## Le 5 aziende

| # | Template | Focus | Cosa è già seedato | Cosa fai tu |
|---|----------|--------|--------------------|-------------|
| 01 | `lab-sost-01-facile-potatura` | Potatura variabile, shortlist facile | Malattia → standby aperto; skill ampie | Assegna sostituto **libero**; chiudi ciclo ore |
| 02 | `lab-sost-02-carro-hard` | Carro raccolta **min 4** | Infortunio → standby; pochi skill carro | Shortlist difficile + banner equipaggio incompleto |
| 03 | `lab-sost-03-prestito-occupati` | Operai già impegnati | Permesso + **sostituzione con prestito** da lavoro scalabile | Verifica badge Prestato/Sostituto; opz. nuova assenza |
| 04 | `lab-sost-04-assenze-miste` | Tipi assenza | malattia, ferie, permesso, **ingiustificata**, non_presenza (miste) | Gestisci standby **ingiustificata**; leggi Impegni |
| 05 | `lab-sost-05-trapianto-e-soft` | Trapiantatrice **min 3** vs potatura soft | Standby trapianto + sostituzione già fatta su potatura | Shortlist stretta sul trapianto; ore sul sostituto potatura |

## Flusso E2E da ripetere (standby aperti)

1. **Manager** — Gestione lavori / Impegni giornalieri (foto giorno).  
2. **Caposquadra** — (già segnalato nel seed) assenza comunicata a voce → in app è in `assenzeOperai`.  
3. **Manager** — conferma → standby (già fatto nel seed dove previsto).  
4. **Manager** — shortlist → scegli sostituto (se **Spostabile**: conferma doppio movimento).  
5. **Caposquadra** — vede avviso sostituto.  
6. **Operaio sostituto** — segna ore sul lavoro.  
7. **Caposquadra** — valida ore → chiude lavoro (**completato da approvare**).  
8. **Manager** — approva chiusura.

## Controlli trasversali

- **Impegni giornalieri**: assente ≠ libero; sostituto / prestato coerenti.  
- **Carro / trapiantatrice**: banner minimo persone.  
- **Potatura**: nessun minimo fisso — equipaggio variabile.  
- Tipi assenza UI: malattia, ferie, permesso, infortunio, non presenza, **ingiustificata**, altro.

## Seed singolo

```bash
npm run sim:run -- --template=lab-sost-02-carro-hard --verbose
```

## Canary automatico (flusso completo)

Oltre alle prove manuali sulle 5 card, c’è un canary Playwright sul tenant classico:

```bash
# Emulator + http-server già su
npm run sim:run -- --template=viticola-conto-terzi-manodopera
npm run manodopera:sostituzione-canary
```

**14 check:** capo segnala assenza (UI) → manager standby + shortlist + assegna → operaio sostituto segna ore → capo valida + zona + `completato_da_approvare` → manager `completato`.

Script: `scripts/manodopera-sostituzione-canary.mjs`. Usa Chrome locale (`playwright-core` channel `chrome`) e la pagina `core/dev/simulator-dev-standalone.html?emulator=1`.

## Come abbiamo verificato in sessione (2026-07-25)

| Step | Comando / strumento | Esito |
|------|---------------------|--------|
| Emulatori | `npm run sim:emulators` | OK (dopo riavvio: istanza precedente “zombie”) |
| App statica | `npm start` → `:8000` | OK |
| Seed 5 lab | `npm run sim:run:sostituzioni-lab` | 5/5 |
| Seed canary | `sim:run -- --template=viticola-conto-terzi-manodopera` | OK |
| Integrità lab | Node Admin su emulator (assenze/impegni) | LAB_VERIFY_OK |
| Canary E2E | `npm run manodopera:sostituzione-canary` | **14/14 PASS** |

**Permessi sicurezza Cursor:** un tentativo di kill di massa processi Java/porte host è stato **rifiutato dall’Auto-review** (troppo invasivo). Non serve per i test: basta riavviare `sim:emulators` se le porte non rispondono.

**GitHub Actions:** queste prove non sono state rilanciate su CI in questa sessione. In passato i fallimenti intermittenti delle suite E2E/sim si sono concentrati soprattutto sui runner GitHub (tempi/emulator/browser), non sul flusso già verde in locale.

## Note tecniche

- Attrezzi lab: `Carro raccolta frutta lab` (`minPersoneEquipaggio: 4`), `Trapiantatrice lab` (`minPersoneEquipaggio: 3`).  
- Skill in `profiliManodopera` (facile / difficile / mista).  
- Codice: `simulator/lib/manodopera-sostituzioni-lab.js`, fasi 02/07/08.  
- Tipo assenza **`ingiustificata`** in `manodopera-assenze-config.js` (+ sim actions).
