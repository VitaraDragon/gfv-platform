# Magazzino – Appendice: tracciabilità, dashboard a card, viste tematiche, scarico da trattamenti

**Data**: 2026-04-02  
**Tipo**: decisioni di prodotto / architettura (memoria di lavoro)  
**Riferimento analisi modulo**: `ANALISI_MODULO_MAGAZZINO.md` (§ 6.3–6.4 e decisioni tabella in § 0)

Questo documento **non sostituisce** l’analisi storica del modulo; **consolida** quanto concordato in conversazione di sviluppo così non si perde il filo tra idee sparse e implementazione futura.

---

## 1. Problema da risolvere in UX

- Una **sola tabella “Movimenti”** con carichi, scarichi manuali, scarichi futuri da trattamenti, rettifiche, ecc. rischia di diventare **di difficile lettura** per chi deve capire *dove* e *per cosa* è stato usato un prodotto.
- L’utente ragiona per **contesti operativi** (trattamenti, concimazioni, interventi con ricambi, sementi, …), non solo per “riga di movimento”.

**Decisione:** mantenere **un registro contabile unico** (movimenti in `movimentiMagazzino` + collegamenti), ma **presentare** all’utente **viste separate** (sottosezioni / schede / elenchi tematici), non tutto mescolato senza filtri.

---

## 2. Pattern dashboard Magazzino (allineato agli altri moduli)

**Decisione:** dalla **home del modulo Magazzino** (`magazzino-home` o evoluzione), struttura a **card** che portano a elenchi dedicati, ad esempio:

| Card / area | Contenuto atteso (indicativo) |
|-------------|----------------------------------|
| Anagrafica prodotti | Lista e gestione prodotti (già esistente) |
| Movimenti | Registro completo entrate/uscite (già esistente) |
| Elenco trattamenti (uso prodotti) | Vista tematica: uso fitosanitari / trattamenti collegati a prodotti magazzino |
| Elenco concimazioni | Vista tematica: interventi classificabili come concimazione |
| Elenco ricambi usati | Vista tematica: consumi ricambi / materiali legati a interventi |
| Elenco sementi (e simili) | Altre viste per categoria d’uso, da definire con regole stabili |

Le etichette esatte e il numero di card possono essere rifinite in fase di UX; l’idea fissa è: **stesso pattern a card** usato altrove nella piattaforma, **ingresso unico** al modulo, **tracciabilità per filone operativo**.

---

## 3. Cosa mostrano le tabelle tematiche

**Obiettivo per l’utente:** capire per ogni filone **dove** è andato il prodotto, **quando**, **a che costo**, su **quale terreno**, **chi** ha eseguito, con **quale mezzo/attrezzatura** ove applicabile.

**Decisione sui dati:** queste colonne **non arrivano solo** dal documento movimento. Si integrano informazioni da:

- **`movimentiMagazzino`** (data, prodotto, quantità, tipo entrata/uscita, costi ove presenti sul movimento, note, collegamenti);
- **`attività`** (diario / core);
- **`lavori`** (gestione lavori);
- **Trattamenti** moduli **Vigneto** / **Frutteto** (dove il prodotto è già legato all’anagrafica e ai calcoli dose/superficie/costo).

La UI delle viste tematiche è quindi un **report / elenco arricchito** (join logico lato client o campi denormalizzati leggeri in fase di salvataggio, da decidere in progettazione tecnica).

---

## 4. Tracciabilità “totale” del prodotto

**Decisione di intento:** per ogni prodotto si vuole poter rispondere: *storico movimenti*, *usi per tipo di intervento*, *collegamento a terreno e soggetti* — senza duplicare fonti di verità contraddittorie.

- **Fonte contabile:** resta il **movimento** (e la giacenza aggiornata dall’anagrafica prodotto).
- **Fonte contesto agronomico:** trattamenti, attività, lavori — con **link** espliciti ove possibile (oggi: `lavoroId` / `attivitaId` sul movimento; in futuro: riferimento a trattamento se si implementa lo scarico automatico).

---

## 5. Scarico automatico dai trattamenti

**Stato al 2026-04-02:** la funzionalità **non è implementata** nel codice. È descritta come evoluzione in `ANALISI_MODULO_MAGAZZINO.md` (§ 6.3–6.4) e in documentazione utente (`documentazione-utente/.../PRODOTTI_E_MAGAZZINO.md`: fase successiva).

**Decisioni già discusse (da realizzare in sviluppo):**

- Alla conferma trattamento, opzione tipo **«Registra scarico in magazzino»**; creazione movimento di **uscita** tramite lo stesso flusso centralizzato (`movimenti-service` / `createMovimento`), non logica duplicata.
- **Idempotenza** in modifica trattamento (stesso movimento aggiornato / storno + nuovo — strategia da fissare).
- **Visuale:** gli scarichi automatici compaiono nel **registro Movimenti** come gli altri; in più **link** dal trattamento al movimento e viste tematiche come sopra.

---

## 6. Principi per non perdere coerenza in implementazione

1. **Un solo registro movimenti** per quantità e giacenza; le viste tematiche sono **filtri/report**, non secondi magazzini paralleli.
2. **Categorizzazione stabile** (tag, tipo intervento, categoria lavoro, origine movimento) per alimentare le card senza dipendere solo da testo libero nelle note.
3. **Costo per intervento:** definire da dove si legge il costo mostrato (movimento vs trattamento vs aggregato) per evitare totali diversi sulla stessa operazione.
4. **Consegna a fasi:** es. prima Movimenti + vista “da trattamenti”; poi concimazioni / ricambi / sementi con regole chiare.

---

## 7. Tony (assistente)

L’assistente Tony può in una fase successiva **riusare gli stessi dati** (contesto magazzino + liste) per rispondere a domande; **non** è prerequisito per definire dashboard e viste. Rif. canone liste: `.cursor/rules/tony-pagina-lista-e-form.mdc`.

---

## 8. Modifica di questo documento

Aggiornare questo file quando le decisioni sopra cambiano o quando una fase di sviluppo viene completata (breve changelog in coda).

### Changelog

| Data | Modifica |
|------|----------|
| 2026-04-02 | Prima stesura: dashboard a card, viste tematiche, fonti dati, stato scarico automatico, principi implementativi. |
