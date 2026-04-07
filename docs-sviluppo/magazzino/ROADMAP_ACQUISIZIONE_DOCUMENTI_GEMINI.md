# Roadmap (ipotesi): acquisizione documenti con Gemini / fotocamera e magazzino

**Tipo**: ipotesi di sviluppo e vincoli di compatibilità — non è uno stato di implementazione.  
**Data**: 2026-04-04  
**Riferimento modulo**: `docs-sviluppo/ANALISI_MODULO_MAGAZZINO.md`, `docs-sviluppo/MAGAZZINO_APPENDICE_TRACCIABILITA_DASHBOARD_E_SCARICO.md`

---

## 1. Obiettivo di prodotto

Permettere in un secondo momento l’uso della **fotocamera** e di **Gemini** (o pipeline OCR + LLM) per:

- leggere **bolle di consegna / DDT** e **fatture**;
- **registrare movimenti di magazzino** (in particolare entrate) con meno digitazione manuale.

Il documento fissa **cosa è compatibile** con l’architettura attuale del modulo Prodotti e Magazzino e **quali aggiustamenti** saranno probabilmente necessari.

---

## 2. Vincolo reale: bolla vs fattura

Spesso:

- la **bolla** riporta **merce e quantità** (a volte lotti), **non sempre i prezzi**;
- la **fattura** riporta **prezzi, IVA, totali** e può arrivare **in un secondo momento**.

Non è un bug del flusso utente: è il modo in cui molti acquisti sono documentati. Il gestionale non deve pretendere che **un solo scatto** risolva quantità e prezzi se i due documenti sono separati nel mondo reale.

---

## 3. Compatibilità con il magazzino attuale

**Sì, è compatibile in linea di principio**, previo chiarimento delle regole di business:

| Concetto attuale | Ruolo nel flusso bolla → fattura |
|------------------|----------------------------------|
| Movimento in **unità base** (L, kg, …) | La **quantità** può essere registrata alla **bolla** (entrata “a quantità certa”). |
| **Prezzo unitario** sul movimento (entrata) | Può restare **assente o provvisorio** fino alla **fattura**, poi **aggiornato** (o ricalcolato) quando si collegano i documenti. |
| **Giacenza** | Di norma si aggiorna sulla **quantità** del movimento; va deciso esplicitamente se la giacenza è “confermata” alla bolla o solo alla fattura (policy prodotto). |
| **Confezione** (testo libero sul movimento) | Opzionale: nota su come è stata consegnata la merce; non sostituisce l’unità base. |
| **Un solo registro movimenti** | Resta valido: niente “secondo magazzino” per il solo OCR. |

**Aggiustamenti probabili (da definire in progettazione):**

- consentire **entrata con prezzo opzionale** / stato **“prezzo in attesa”** dove oggi la UI o la validazione potrebbero essere troppo rigide;
- introdurre un **collegamento** tra documento bolla e documento fattura (ID, hash riga, riferimento fornitore) per **aggiornare in blocco** i prezzi sui movimenti già creati;
- regole di **fallback** (ultimo prezzo d’acquisto, listino) solo come **proposta** con conferma utente, non come verità assoluta.

---

## 4. Flusso ideale in due passi (ipotesi)

1. **Acquisizione bolla** → estrazione righe (prodotto/quantità, eventuale lotto) → creazione **movimenti di entrata** (quantità) → prezzi **mancanti o segnaposto**.
2. **Acquisizione fattura** → estrazione prezzi → **associazione** alle righe/movimenti della bolla → **aggiornamento** `prezzoUnitario` (e note contabili se servono).

Variante: **bozza** dei movimenti finché non c’è fattura, poi **conferma** — da valutare rispetto a giacenza e permessi.

---

## 5. Integrazione con Tony / Gemini (quando sarà il momento)

- Comandi e form **restano** allineati al principio: **configurazione** (`tony-form-mapping.js`, servizi), non patch per singola pagina.
- Il Context Builder potrà in futuro esporre **stato documenti in attesa** (es. entrate senza prezzo) se i dati sono modellati in modo interrogabile.
- Nessun obbligo di implementare in questa fase: questo file serve solo da **ancora** per decisioni future.

---

## 6. Confezione e “stesso prodotto, più formati”

Restano valide le scelte già documentate in **ANALISI_MODULO_MAGAZZINO.md** (§5):

- giacenza in **unità continua** (L, kg);
- **confezione** sul movimento come **nota** sul prelievo/carico, non come doppia anagrafica obbligata;
- il dettaglio “2×1 L + 1×5 L” vs “7 L” è **operativo** e va in **nota** o in evoluzioni (lotti) se un giorno servisse tracciabilità fine.

L’OCR potrebbe precompilare il campo **confezione** se il testo della bolla è esplicito; non è requisito per la prima versione del flusso documentale.

---

## 7. Changelog documento

| Data | Modifica |
|------|----------|
| 2026-04-04 | Prima stesura: ipotesi bolla/fattura, compatibilità magazzino, due passi, Tony, confezione. |

---

## 8. Dove è collegato questo file

- `docs-sviluppo/tony/MASTER_PLAN.md` (§11 Riferimenti)
- `docs-sviluppo/tony/README.md` (tabella “Dove trovare cosa”)
- `docs-sviluppo/ANALISI_MODULO_MAGAZZINO.md` (puntatore in coda)
- `.cursor/rules/project-guardian-tony.mdc` (riferimento modulo magazzino / evoluzioni)
