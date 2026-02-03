# Guida dell'app GFV Platform (per assistente e riferimento)

Indice della guida modulare dell'app. Serve come **base di conoscenza per l'assistente** (Gemini), come **riferimento unico** per sviluppatori e onboarding, e per padroneggiare tutte le funzionalità dell'app. Vedi `docs-sviluppo/PIANO_GUIDA_APP_ASSISTENTE.md` per intent, struttura e modalità di sviluppo.

**Moduli coperti:** Core, Terreni, Lavori e attività, Vigneto, Frutteto, Magazzino, Conto terzi, Intersezioni tra moduli.

---

## Indice delle sezioni

| Sezione | File | Stato |
|--------|------|--------|
| **Core** (panoramica, accesso, ruoli, navigazione, glossario, regole) | [core.md](core.md) | fatto |
| **Terreni** | [moduli/terreni.md](moduli/terreni.md) | fatto |
| **Lavori e attività** | [moduli/lavori-attivita.md](moduli/lavori-attivita.md) | fatto |
| **Modulo Vigneto** | [moduli/vigneto.md](moduli/vigneto.md) | fatto |
| **Modulo Frutteto** | [moduli/frutteto.md](moduli/frutteto.md) | fatto |
| **Modulo Magazzino** | [moduli/magazzino.md](moduli/magazzino.md) | fatto |
| **Modulo Conto terzi** | [moduli/conto-terzi.md](moduli/conto-terzi.md) | fatto |
| **Intersezioni tra moduli** | [intersezioni-moduli.md](intersezioni-moduli.md) | fatto |

---

## Struttura cartelle

- **`guida-app/`** — radice della guida (questo README, core, intersezioni).
- **`guida-app/moduli/`** — un file per ogni modulo (Terreni, Lavori, Vigneto, Frutteto, Magazzino, Conto terzi).

Ogni blocco rispetta lo schema del Piano (§5): Titolo, Scopo, Dove si trova, Funzionalità, Termini, Limitazioni, Relazioni con altri moduli.

---

## Come includere un nuovo modulo

Quando nell’app aggiungi un **nuovo modulo** (es. Parco macchine, Oliveto, Report), per includerlo nella guida:

1. **Aggiungi la voce alla checklist**  
   In `docs-sviluppo/CHECKLIST_SEZIONI_GUIDA_APP.md`: aggiungi una riga nella tabella “Ordine di implementazione” e “Checklist sezioni (stato)”, e un blocco “Istruzioni per sezione” con lo stesso schema di S7–S10 (cosa fare, output, schema §5, dipendenze). Dipendenze tipiche: S1–S4; altre sezioni moduli utili per “Relazioni”.

2. **Crea il file del modulo**  
   Crea `guida-app/moduli/<nome-modulo>.md` (es. `parco-macchine.md`, `oliveto.md`). Compila seguendo lo **schema fisso** del Piano (§5):
   - Titolo (nome sezione o modulo)
   - Scopo (cosa fa, in breve)
   - Dove si trova (navigazione: menu, percorsi, link)
   - Funzionalità / azioni principali (elenco)
   - Termini e concetti (glossario locale)
   - Limitazioni / regole (permessi, abbonamenti, eccezioni)
   - Relazioni con altri moduli (con chi si interseca; dettagli in “Intersezioni tra moduli”)

   Descrivi solo ciò che **esiste nell’app** (usa codice o documentazione esistente). Riferimenti: `PIANO_GUIDA_APP_ASSISTENTE.md` §3.2, §5 e §1.2 (ambito di copertura).

3. **Aggiorna l’indice**  
   In questo README: aggiungi una riga nella tabella “Indice delle sezioni” con link a `moduli/<nome-modulo>.md` e stato “da compilare” o “fatto”. Aggiorna la riga “Moduli coperti” in cima al file.

4. **Aggiorna “Intersezioni tra moduli”**  
   Se il nuovo modulo si interseca con altri (es. usa prodotti Magazzino, lavori, terreni, ruoli): in `guida-app/intersezioni-moduli.md` aggiungi le righe nella **matrice** (modulo A ↔ modulo B), eventuali **flussi** che lo coinvolgono e, se serve, note in **Ruoli e moduli**. In fine documento c’è la nota: “Quando si aggiunge un nuovo modulo che si interseca con altri, aggiornare questo documento”.

5. **Aggiorna i moduli collegati**  
   Nei file degli **altri moduli** che si relazionano con il nuovo (es. Lavori, Core, Terreni), nella sezione “Relazioni con altri moduli” aggiungi una riga che cita il nuovo modulo e il tipo di collegamento.

6. **Eventuali modifiche al Core**  
   Se il nuovo modulo introduce **termini** usati in tutta l’app o **regole** comuni (es. nuovo ruolo, nuovo ambito §1.2), aggiorna `guida-app/core.md` (glossario, regole comuni) e, se serve, la parte “Relazioni con altri moduli” del core.

**Riferimenti:** `docs-sviluppo/PIANO_GUIDA_APP_ASSISTENTE.md` (Fase 3 – Manutenzione e nuovi moduli, §3.2, §5); `docs-sviluppo/CHECKLIST_SEZIONI_GUIDA_APP.md` (Estensioni future, istruzioni S7–S10).
