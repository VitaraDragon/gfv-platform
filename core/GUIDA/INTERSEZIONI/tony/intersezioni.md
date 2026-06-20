# Intersezioni tra moduli

Questa sezione ti aiuta a vedere l'app come un sistema unico, non come blocchi separati.

Se ti chiedi "da dove nasce questo dato?" oppure "cosa succede dopo questo passaggio?", qui trovi la risposta.

Quando indichi **dove andare** in chat o in guida, usa sempre il linguaggio dell'app: menu **Moduli**, **home** del modulo (Vigneto, Manodopera, Conto Terzi, …), **Per te oggi**, **I miei accessi**, **Richiede attenzione** — non "card in dashboard" (obsoleto).

---

## 0. Navigazione cross-modulo (2026)

### Ingresso moduli

- **Moduli** (pulsante con conteggio in dashboard) è il percorso **principale** verso Terreni, Diario, Statistiche, Abbonamento e ogni modulo attivo (Vigneto, Manodopera, Magazzino, Conto Terzi, Parco Macchine, Meteo, Report, …).
- Con **Manodopera** attivo **non** cercare grandi tile sparse sotto la panoramica: Vigneto, Magazzino e gli altri verticali sono in **Moduli**, nella **home Manodopera**, in **Per te oggi**, **Accessi rapidi** o **I miei accessi**.
- **Senza Manodopera**, scorrendo **in fondo** alla dashboard possono comparire **riquadri** modulo (Vigneto, Magazzino, …): stessa voce del menu, scorciatoia opzionale.
- **Richiede attenzione** può aprire direttamente un modulo (es. prodotti sotto scorta → Magazzino; lavori da pianificare → Conto Terzi; scadenze/guasti → Parco Macchine).

### Hub e ritorno

| Modulo | Home / hub | Torna indietro con |
|--------|------------|-------------------|
| Manodopera | KPI + Pianificazione / Persone / Controllo | **← Manodopera** dalle pagine interne |
| Vigneto / Frutteto | Dashboard coltura (statistiche, azioni rapide) | **← Dashboard** verso home generale |
| Magazzino | Riepilogo giacenze, azioni rapide | **← Dashboard** |
| Conto Terzi | Panoramica clienti, preventivi, lavori | **← Dashboard** |
| Parco Macchine | Panoramica mezzi, azioni rapide | **← Dashboard** |
| Core (Terreni, Diario, …) | pagina dedicata | **← Dashboard** o breadcrumb equivalente |

### Scorciatoie Terreni (Core)

- Icona **grappolo** (Vigneto) o **mela** (Frutteto) sulla riga terreno → **anagrafica** coltura per quel campo, **non** la dashboard del modulo.
- Per il riepilogo viola/arancio del modulo → **Moduli** → **Vigneto** / **Frutteto**.

### Tony tra moduli

- **Tony Guida** (piano Base): spiega i passaggi e indica **Moduli** + nome modulo; non apre pagine da solo.
- **Tony Avanzato**: può **aprire** moduli e schede (es. «apri Conto Terzi», «vai a validazione ore») se il modulo e i permessi lo consentono.
- Se l'utente è su una pagina e chiede un'azione di **altro modulo**, il percorso tipico è: descrivere **Moduli** → modulo → sezione, oppure (Avanzato) navigazione automatica.

---

## 1. Mappa connessioni principali

- **Core ↔ tutti i moduli:** ruoli, azienda selezionata, abbonamento e menu **Moduli** governano tutto.
- **Terreni ↔ Lavori/Attività:** ogni lavoro nasce su un terreno; ore e attività ereditano quel contesto (**Moduli** → **Terreni** / **Diario** / **Manodopera** a seconda del passo).
- **Terreni ↔ Vigneto/Frutteto:** anagrafiche coltura legate al terreno; icone grappolo/mela per anagrafica rapida.
- **Lavori/Attività ↔ Vigneto/Frutteto:** trattamenti, concimazioni, potatura nascono da **lavoro** o **attività Diario** con categoria corretta; vendemmia/raccolta spesso dirette dal modulo coltura.
- **Vigneto/Frutteto ↔ Magazzino:** prodotti, dosaggi, opzione scarico, movimenti uscita, **Tracciabilità consumi**.
- **Conto terzi ↔ Lavori:** preventivo accettato → lavoro da pianificare → **Gestione lavori** (Manodopera) → ore e **Diario** filtrato conto terzi.
- **Parco Macchine ↔ Diario/Lavori:** trattore, attrezzo, ore macchina opzionali nel **Diario** (e flussi Manodopera se attivo).
- **Core/Abbonamento ↔ Moduli:** i flussi esistono solo se i moduli necessari sono attivi (**Moduli** → **Abbonamento**).
- **Report ↔ tutti i moduli:** aggrega dati operativi (ingresso da **Moduli** se modulo Report attivo).

---

## 2. Flussi completi tra moduli

### 2.1 Preventivo conto terzi → lavoro → ore → diario

1. **Moduli** → **Conto Terzi** → **Nuovo preventivo** (cliente, terreno cliente, voci, tariffe).
2. Lista **Preventivi** → invio → accettazione (cliente o manager).
3. **Pianifica lavoro** dal preventivo accettato (o da **Lavori da pianificare** in home Conto Terzi / alert **Richiede attenzione**).
4. **Moduli** → **Manodopera** → **Gestione lavori** (completare pianificazione, assegnazioni).
5. Caposquadra/operaio: ore in **versione mobile** o flussi Manodopera; manager: **Validazione ore** dalla home Manodopera.
6. **Diario attività**: filtri **Lavori in corso** / **completati** conto terzi dalla home Conto Terzi; consolidamento in statistiche.

Ruoli: manager/amministratore per preventivi e pianificazione; caposquadra/operaio per esecuzione.

### 2.2 Trattamento/concimazione → scarico magazzino → tracciabilità

1. Creare prima **lavoro** (**Gestione lavori** / **Manodopera**) o **attività Diario** sul terreno con categoria **Trattamenti** / **Concimazione** / **Potatura**.
2. **Moduli** → **Vigneto** o **Frutteto** → pagina registro (**Trattamenti**, **Concimazioni**, **Potatura**) → riga in elenco → **Azioni** → completare prodotti, superficie, dosaggi.
3. Se modulo **Magazzino** attivo: spuntare **Registra scarico in magazzino** (se previsto) al salvataggio.
4. **Moduli** → **Magazzino** → **Movimenti** (verifica uscita) e **Tracciabilità consumi** (filtri prodotto/terreno).

Ruoli: principalmente manager/amministratore.

### 2.3 Lavoro agricolo con aree lavorate

1. Lavoro su terreno (**Manodopera** → **Gestione lavori** o **Per te oggi**).
2. Esecuzione caposquadra/operaio; eventuali zone/aree nel Diario o nel lavoro.
3. Chiusura lavoro; registri coltura (Vigneto/Frutteto) se categoria lo richiede.
4. Riepilogo in **Statistiche** / dashboard modulo coltura (**Lavori vigneto** / **Lavori frutteto** = lavori + voci Diario, non elenco trattamenti).

### 2.4 Flusso ore tra ruoli (da campo a controllo)

1. Operaio: versione **mobile**, lavoro scelto, registrazione ore.
2. Caposquadra: validazione ore squadra (mobile).
3. Manager: **Manodopera** → **Validazione ore**, **Statistiche manodopera**, alert in **Richiede attenzione** (ore da validare).

---

## 2bis. Procedure guidate (navigazione)

### Da preventivo accettato a lavoro chiuso

**Quando:** cliente conto terzi ha accettato; serve arrivare a lavoro completato e ore validate.

**Percorso Moduli:** **Conto Terzi** (preventivi) → **Manodopera** (lavori, validazione ore) → **Diario** (storico conto terzi).

**Passi**
1. **Moduli** → **Conto Terzi** → preventivo **accettato** → **Pianifica lavoro**.
2. **Moduli** → **Manodopera** → **Gestione lavori** → completa dati, squadra, date.
3. Campo: ore da operaio/caposquadra.
4. **Validazione ore** (home Manodopera o **Per te oggi**).
5. Chiudi lavoro; verifica in **Diario** (filtro conto terzi completati) e in home Conto Terzi.

**Controllo:** lavoro in storico; ore validate; attività nei riepiloghi.

### Intervento coltura con scarico magazzino

**Percorso Moduli:** **Manodopera** o **Diario** (creazione lavoro/attività) → **Vigneto**/**Frutteto** (registro) → **Magazzino** (tracciabilità).

**Passi**
1. Lavoro/attività con categoria corretta sul terreno del vigneto/frutteto.
2. **Moduli** → **Vigneto**/**Frutteto** → **Trattamenti** o **Concimazioni** → completa riga → prodotti → conferma **scarico magazzino** se serve.
3. **Moduli** → **Magazzino** → **Tracciabilità consumi** (filtra prodotto o terreno).

**Controllo:** movimento uscita in **Movimenti**; intervento nel registro coltura.

### Mezzo in campo (Parco Macchine + Diario)

1. **Moduli** → **Parco Macchine** → censire trattore/attrezzo se mancante.
2. **Moduli** → **Diario attività** (o attività da lavoro Manodopera): campi **trattore** / **attrezzo** / **ore macchina** (opzionali; rispettare CV/compatibility).
3. Scadenze/guasti: alert **Richiede attenzione** o hub Parco Macchine.

---

## 3. Ruoli nelle intersezioni

- **Manager/Amministratore:** dashboard desktop, menu **Moduli**, hub moduli, **Amministrazione** (👑) da Moduli con Manodopera attivo.
- **Caposquadra:** versione **mobile** per ore e squadra; passaggio eventuale a vista desktop per consultazioni.
- **Operaio:** versione **mobile** semplificata; non vede l'intera panoramica manager.

Punto chiave: la stessa funzione può comportarsi in modo diverso in base al ruolo, anche nella stessa pagina.

---

## 4. Piani e disponibilità flussi

- Un flusso cross-modulo funziona solo se **tutti** i moduli coinvolti sono attivi sull'abbonamento.
- Esempio: scarico da trattamento richiede modulo coltura + modulo **Magazzino**.
- Esempio: validazione ore strutturata richiede **Manodopera**; senza Manodopera restano Diario e tariffa proprietario in Impostazioni (Core).
- Se manca un modulo, il flusso resta **parziale** (registro intervento senza scarico, preventivo senza pianificazione lavori strutturata, ecc.).

---

## 5. Tony e intersezioni

- **Tony Guida** (Base): descrive passaggi tra moduli con **Moduli** → nome modulo → sezione; non inventare tile o "card" in dashboard.
- **Tony Avanzato:** può aprire moduli e compilare schede lungo il flusso; rispetta permessi ruolo e moduli attivi.
- **Consigliere moduli** (solo Base): suggerisce moduli mancanti utili al flusso descritto; max 1–2; rimanda ad **Abbonamento**, non promuove Tony Avanzato.

### Esempi pratici

- «Dal preventivo accettato al lavoro operativo»: elencare **Conto Terzi** → pianifica → **Manodopera** → **Gestione lavori** → ore → **Validazione ore**; con Avanzato, aprire i passaggi consentiti.
- «Ho registrato trattamento, come verifico lo scarico?»: **Moduli** → **Magazzino** → **Tracciabilità consumi** (e **Movimenti**); ricordare che la riga trattamento nasce da lavoro/Diario con categoria corretta.
- «Devo passare dal vigneto al magazzino»: non usare Terreni/grappolo per il riepilogo; **Moduli** → **Vigneto** per dashboard, **Moduli** → **Magazzino** per giacenze.
- «Apri manodopera e validazione ore»: intent valido per Avanzato; operaio/caposquadra → solo flussi mobile pertinenti al ruolo.
