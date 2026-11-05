# Prompt Cursor — Tony Guida: terreni passo passo (senza asterischi; Podere opzionale)

Copia tutto da «INIZIO PROMPT» a «FINE PROMPT» e incollalo in Cursor (modalità Auto) sul repo `VitaraDragon/gfv-platform`, partendo da `develop` aggiornato. Apri PR su `develop`. **Non mergiare, non deployare, non toccare Cloud Functions / firestore.rules.**

---

## INIZIO PROMPT

### Contesto (decisione Pier, 23/10/2026 — follow-up dopo ritest Agricoltore Nuovo su Pages)

Su main c’è già l’onboarding titolare (#271/#272) in `core/services/tony-guida-app.js` (blocco `--- ONBOARDING TITOLARE NUOVO ---`) + guide CORE + hint Diario. Il ritest ha mostrato due problemi di **testo**, non di UI:

1. Tony parla ancora di **asterischi** («Nome Terreno *», «ha l’asterisco», «Coltura *») e di «compilato automaticamente» senza spiegare bene cosa fare.
2. Il **Podere non è obbligatorio**: non va presentato come passo fisso 2 prima dei Terreni. Se l’utente non ha poderi, si può passare da Impostazioni azienda/account direttamente a Terreni.

**Decisione Pier:** i testi rivolti all’utente devono essere **senza asterischi** e devono spiegare **passo passo** come:
- completare correttamente il form di un **terreno nuovo**;
- **modificare** un terreno già salvato (es. senza coltura, così il Diario non resta bloccato).

Il gate Diario (Coltura obbligatoria lì) resta **voluto**: non toglierlo, non renderlo opzionale, non cambiare validazione.

### Vincoli assoluti

- **NON** modificare: `firestore.rules`, niente sotto `functions/` (incluso `functions/tony-guida-onboarding.js`), modello Terreno, validazione Diario, HTML `required` sul form Terreni.
- **NON** inventare schermate/URL; solo nomi pulsanti come in UI.
- Diff solo contenuti Tony Guida / guide / eventuale micro-hint già esistente.
- A fine lavoro: elenco file toccati + sintesi diff; apri PR verso `develop` (niente merge).

### Cosa cambiare (contenuto)

#### A) `core/services/tony-guida-app.js` — stringa `GUIDA_APP_PER_TONY`

Riscrivi il blocco **ONBOARDING TITOLARE NUOVO** e allinea **TERRENI** / note Diario correlate così:

**Stile frasi per l’utente (obbligatorio):**
- **Zero asterischi** nelle frasi che Tony deve dire (niente `*`, niente «ha l’asterisco», niente «Coltura *»).
- Spiega in italiano semplice: cosa è obbligatorio, cosa è facoltativo, in che ordine compilare.
- Passi numerati, un click alla volta, nomi esatti dei pulsanti come in schermata.
- Per i campi obbligatori in UI (Nome Terreno, Tipo Possesso, e se Affitto la data scadenza) di’ «obbligatorio» a parole, senza `*`.
- Per Categoria Coltura e Coltura: di’ che **vanno scelte sempre** (prima la categoria, poi la coltura), anche se sul form non sono marcate come obbligatorie, perché **senza di esse il Diario attività resta bloccato** (lì la Coltura è obbligatoria e si riempie dalla coltura del terreno; se manca, l’elenco resta vuoto e non si salva). Non parlare di asterischi.
- Non dire solo «si compila automaticamente»: di’ che dopo aver salvato Categoria Coltura e Coltura sul terreno, nel Diario la Coltura si riempie da sola; se è vuota, il terreno non ha ancora la coltura → vai in Modifica.

**Ordine setup (aggiornato):**
1. **Impostazioni** (ingranaggio in alto a destra) → Informazioni Azienda → Salva Impostazioni Azienda; poi Account → Salva Impostazioni Account.
2. **Podere — facoltativo.** Solo se l’utente ha terreni raggruppati in poderi: resta in Impostazioni → Gestione Poderi → ➕ Aggiungi Podere → Nome + mappa se serve → Salva. Se non serve, **salta** e vai ai Terreni. Non presentare il Podere come passo obbligatorio.
3. **Terreno nuovo** — passo passo (vedi sotto).
4. **Recupero / modifica terreno già salvato** — passo passo (vedi sotto).
5. Solo dopo: Diario attività.

**Terreno nuovo — passi da far dire a Tony (senza asterischi):**
1. Dashboard → Terreni.
2. Premi **+ Aggiungi Terreno** (si apre «Aggiungi Terreno»).
3. Compila **Nome Terreno** (obbligatorio).
4. Superficie (ettari): facoltativa (a mano o dalla mappa).
5. **Categoria Coltura** (prima): scegli dall’elenco (voce iniziale «-- Seleziona categoria --»).
6. **Coltura** (dopo): scegli dall’elenco. Senza categoria+coltura il Diario resta bloccato — dillo chiaro.
7. **Podere**: facoltativo; se non serve lascia «-- Nessun podere --».
8. Morfologia: facoltativa (Pianura / Collina / Montagna).
9. **Tipo Possesso**: obbligatorio (Proprietà o Affitto). Se Affitto: anche Data Scadenza Affitto (obbligatoria) e Canone Mensile (facoltativo).
10. Mappa: facoltativa (Cerca, Traccia Confini, ecc.).
11. Note: facoltative.
12. Premi **Salva Terreno** (Annulla chiude senza salvare).

**Modifica terreno già salvato (senza coltura / Diario vuoto) — passi:**
1. Non aprire il Diario prima.
2. Dashboard → Terreni.
3. Sulla riga del terreno premi la matita (**Modifica**). Si apre «Modifica Terreno».
4. Scegli prima **Categoria Coltura**, poi **Coltura**.
5. Premi **Salva Terreno**.
6. Solo dopo: Dashboard → Diario attività — la Coltura si riempie dal terreno; se è ancora vuota, ricontrolla il salvataggio sul terreno.

Aggiorna anche la riga «Setup di un titolare nuovo» in testa alla guida: non dire «Ordine 1 Impostazioni, 2 Poderi, 3 Terreni» come se Poderi fossero obbligatori; di’ Impostazioni → (Podere solo se serve) → Terreni con coltura → poi Diario.

Nella sezione **TERRENI** / Diario: togli dalle istruzioni «da dire all’utente» i riferimenti agli asterischi; puoi tenere note tecniche interne per te (Cursor) se servono, ma le frasi che Tony ripete all’utente devono essere senza `*`.

#### B) Guide CORE (allineare allo stesso tono)

- `core/GUIDA/CORE/utente/guida.md` + mirror `docs-sviluppo/GUIDA/CORE/utente/guida.md`
- se serve, nota breve in `core/GUIDA/CORE/tony/guida-tecnica.md` + mirror

Stesso contenuto utente: Podere opzionale; terreno nuovo e modifica passo passo; **niente asterischi** nel testo rivolto all’utente; insiste su Categoria Coltura → Coltura per sbloccare il Diario.

#### C) Hint Diario (se cita asterischi o è vago)

Se l’hint in `core/attivita-standalone.html` / JS correlato parla di asterischi o è troppo corto, aggiorna solo il testo (es. «Se non vedi colture: apri Terreni, premi Modifica sul terreno, scegli Categoria Coltura e Coltura, Salva Terreno; poi torna qui.»). **Niente** cambio validazione.

#### D) Welcome (opzionale, solo client)

`core/config/tony-guida-onboarding.js` → `tonyGuidaOnboardingWelcomeMessage`: se dice Poderi come passo fisso, ammorbidisci («podere se ti serve, poi terreni con la coltura»). **Non** toccare `functions/tony-guida-onboarding.js`.

### Criteri di accettazione

1. Nelle frasi utente della guida Tony: **zero asterischi** (`*`).
2. Podere presentato come **facoltativo**; setup può andare Impostazioni → Terreni.
3. Terreno nuovo: passi numerati campo per campo fino a Salva Terreno, con insistenza su Categoria Coltura → Coltura e effetto sul Diario.
4. Terreno già salvato: passi Modifica → categoria → coltura → Salva → poi Diario (senza dire solo «si compila automaticamente»).
5. Nessuna modifica a rules/functions/validazione Diario.
6. PR aperta su `develop`; in coda: file toccati + sintesi.

### Fuori scope

- Rendere required Categoria/Coltura sul form Terreni.
- Cambiare messaggio di errore Diario in codice oltre l’hint testo.
- Merge, promote main, deploy.
- Mirror Cloud Functions.

### Verifica

A mente / chat Tony: «Come imposto l’azienda da zero?» e «Ho un terreno ma nel Diario Coltura è vuota» → passi senza `*`, Podere solo se serve, terreno nuovo e modifica chiari.

## FINE PROMPT
