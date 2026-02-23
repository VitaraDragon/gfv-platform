# Piano di Verifica: Smart Form Filler (Tony)

## Nota architetturale (2026-02-10)

Esistono **due path** per la compilazione del form attività:

1. **INJECT_FORM_DATA (Treasure Map)** – path principale: Gemini restituisce blocco \`\`\`json con `formData` completo → `TonyFormInjector.injectAttivitaForm()`.
2. **SET_FIELD** – path alternativo: comandi singoli (es. solo tipo-lavoro) → `SmartFormFiller.fillField()` per derivare categoria/sottocategoria e impostare in cascata.

Questo documento riguarda la verifica del **SmartFormFiller** (path SET_FIELD). Per il flusso completo INJECT_FORM_DATA vedi `docs-sviluppo/TONY_COMPILAZIONE_ATTIVITA_IMPLEMENTAZIONE.md`.

## Obiettivo
Verificare che la compilazione intelligente dei form (flusso inverso e gestione dipendenze) funzioni correttamente, delegando la logica complessa al codice JS (`SmartFormFiller`) invece che all'IA.

## Scenario di Test
L'utente vuole registrare un'attività di **Trinciatura** nel **Campo A** (Vigneto).

### Condizioni Iniziali
1. L'app è aperta sulla pagina Attività o Dashboard.
2. Modulo Tony Avanzato è attivo.
3. Esiste un Tipo Lavoro "Trinciatura" collegato alla Categoria "Lavorazione del Terreno".
4. Esiste un Terreno "Campo A" con coltura "Vite".

### Flusso Atteso

#### 1. Input Utente
*   **Utente:** "Ho trinciato nel Campo A."
*   **Gemini (Output JSON atteso):**
    ```json
    {
      "text": "Segno trinciatura nel Campo A. Data?",
      "command": {
        "type": "SET_FIELD",
        "field": "attivita-tipo-lavoro-gerarchico",
        "value": "Trinciatura"
      }
    }
    ```
    *(Nota: Gemini invia solo il tipo lavoro specifico, ignorando categorie e sottocategorie)*

#### 2. Esecuzione SmartFormFiller (JS)
*   Il widget riceve `SET_FIELD` per `attivita-tipo-lavoro-gerarchico` con valore "Trinciatura".
*   `SmartFormFiller` intercetta la richiesta.
*   **Analisi Dipendenze:** Rileva che questo campo dipende da `attivita-categoria-principale`.
*   **Derivazione Padre:** Cerca "Trinciatura" nei dati (`window.attivitaState` o context).
    *   Trova `categoriaId` corrispondente a "Lavorazione del Terreno".
*   **Azione 1 (Padre):** Imposta `attivita-categoria-principale` = [ID Lavorazione Terreno].
*   **Attesa:** Aspetta che il dropdown `attivita-tipo-lavoro-gerarchico` si popoli (simulando l'evento change).
*   **Azione 2 (Figlio):** Imposta `attivita-tipo-lavoro-gerarchico` = [ID Trinciatura].

#### 3. Risultato Finale (UI)
*   Il modale Attività è aperto (se non lo era, dovrebbe esserlo o aprirsi).
*   Campo **Categoria** = "Lavorazione del Terreno" (selezionato automaticamente).
*   Campo **Tipo Lavoro** = "Trinciatura" (selezionato automaticamente).
*   Campo **Sottocategoria** = "Tra le File" (se presente logica specifica per Vite).

## Checklist di Verifica Manuale

1.  [ ] **Caricamento Script:** Verificare nella console del browser che `tony-smart-filler.js` sia caricato e `window.SmartFormFiller` esista.
2.  [ ] **Test Dipendenza:** Aprire la console JS e digitare:
    ```javascript
    const filler = new SmartFormFiller();
    // Assicurarsi di essere sulla pagina Attività e di avere i dati caricati
    await filler.fillField('attivita-tipo-lavoro-gerarchico', 'Trinciatura', window.Tony.context);
    ```
3.  [ ] **Verifica Visiva:** Controllare che il dropdown Categoria sia cambiato e successivamente il Tipo Lavoro sia selezionato.
4.  [ ] **Test Chat:** Provare con la chat reale di Tony: "Ho trinciato".
5.  [ ] **Verifica Log:** Controllare i log `[SmartFiller]` in console.

## Verifica Simulazione (Codice)

Puoi eseguire questo snippet in console per simulare il comportamento senza Gemini:

```javascript
(async () => {
    console.log("=== INIZIO TEST SIMULATO ===");
    const filler = new SmartFormFiller();
    
    // Simula contesto dati (se non presenti)
    const mockContext = {
        attivita: {
            tipi_lavoro: [
                { id: "job_123", nome: "Trinciatura", categoriaId: "cat_456" }
            ]
        }
    };
    
    // Simula elementi DOM se necessario (o eseguilo su pagina reale)
    
    console.log("Tentativo di impostare Trinciatura...");
    await filler.fillField('attivita-tipo-lavoro-gerarchico', 'Trinciatura', mockContext);
    
    const catVal = document.getElementById('attivita-categoria-principale')?.value;
    const jobVal = document.getElementById('attivita-tipo-lavoro-gerarchico')?.value;
    
    console.log(`Risultato: Categoria=${catVal}, Lavoro=${jobVal}`);
    
    if (jobVal && catVal) console.log("✅ TEST PASSATO");
    else console.error("❌ TEST FALLITO");
})();
```
