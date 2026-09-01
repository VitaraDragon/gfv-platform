# Linea guida: notifiche push, WhatsApp e preferenze (assenze + policy canali)

**Tipo:** linea guida di prodotto + architettura  
**Data:** 2026-07-29  
**Stato:** **implementata in codice** (S5 2026-08-28 — `functions/notification-dispatch.js`, preferenze Impostazioni). Restano deploy Functions + secret Meta se si vuole WhatsApp. Inventario: `CERCHI_APERTI_2026-09-01.md`.  
**Per chi:** agenti e sviluppatori che lavorano su assenze, sostituzioni manodopera, Impostazioni, PWA, integrazioni esterne

**Documenti correlati:**

- `docs-sviluppo/da-fare/notifiche/SPEC_NOTIFICHE_PUSH_CICLO_LAVORO.md` — **primo tubo FCM** (comunicazioni + stati manager). Questo documento (assenze/WA) si innesta dopo, sullo stesso catalogo.
- `docs-sviluppo/da-fare/tony/PIANO_SOSTITUZIONE_MANODOPERA_SQUADRE.md` — flusso assenza → shortlist → sostituto
- `docs-sviluppo/tony/MASTER_PLAN.md` — proattività Tony (§15.5–§15.6)
- `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` — policy anti-invasività briefing (§15.5)
- `docs-sviluppo/GUIDA_PWA.md` — service worker + push FCM (ciclo + assenze)
- `core/admin/impostazioni-standalone.html` — già presente telefono account (`account-telefono`)

---

## 1. Obiettivo

Far arrivare in tempo a **caposquadra e manager** le urgenze operative che richiedono un’azione **oggi** (in primis **assenza** che lascia un buco sul turno), senza:

- sostituire o duplicare gli alert di **Tony** (scorte, affitti, scadenze, …);
- creare spam su push/WhatsApp;
- imporre orari fissi incompatibili con la campagna.

**Principio unico:**

> **Tony = consapevolezza e guida quando l’utente è in app.**  
> **Push = avviso per agire subito fuori/in app.**  
> **WhatsApp = reminder di escalation se la push/in-app non è stata vista in tempo.**

---

## 2. Cosa non fare (decisioni esplicite)

| No | Perché |
|----|--------|
| **n8n** (account / MCP / orchestratore) per questo flusso | Overkill: stack Firebase (FCM + Cloud Functions + opz. WhatsApp Cloud API) basta. n8n resta eventuale solo per integrazioni esterne future non-core |
| Suoni custom sulla push web | Poco affidabili (specie iOS PWA); MVP = suono di sistema |
| UI “grafica ricca” dentro la toast di sistema | Web Push mostra titolo/corpo/icona; l’azione e la UI ricca sono **in GFV** dopo il tap |
| WhatsApp per scorte / affitti / scadenze di routine | Si sovrappone a Tony §15.5–§15.6 → spam |
| Push 3×/giorno (inizio/metà/fine) su scorte/affitti | Stesso rischio; le fasce restano di Tony in-app |
| Ping ripetuti sullo stesso evento assenza | Max **1 push** + max **1 WhatsApp** di escalation per evento (salvo ripresa esplicita futura documentata) |

---

## 3. Matrice canali per tipo di segnale

| Segnale | Tony (in-app, già/parzialmente presente) | Push | WhatsApp |
|---------|------------------------------------------|------|----------|
| **Assenza turno** (last-minute / oggi) | Opzionale (“c’è un’assenza aperta”) | **Sì, subito** (se preferenza on + in finestra oraria) | **Sì, dopo timeout** se non gestita (vedi §5) |
| **Prodotti sotto scorta** | **Canale principale** (briefing / hub) | No di default | **No** |
| **Affitti / scadenze terreni** | **Canale principale** (vedi §6) | Solo eventuale **1 push** a 7 giorni (opzionale, fase successiva) | **No** |
| Criticità rara (es. scorta 0 “essenziale”) | Sì | Opzionale 1 push | Solo con opt-in esplicito futuro |

**Test pratico** prima di aggiungere un canale esterno a un nuovo segnale:

1. Se l’utente non apre il telefono per alcune ore, **si rompe il turno di oggi?** → sì = candidato push (+ WA).  
2. Altrimenti → resta Tony / badge in-app.

---

## 4. Destinatari (assenze)

- **Sempre:** caposquadra della squadra/lavoro coinvolto **e** manager (tutti i manager attivi del tenant in MVP).
- Se **uno** dei destinatari marca l’evento come gestito (`acted`), l’evento si considera **chiuso per tutti** (niente WA successivi, niente riping).

Ruoli ammessi alle preferenze personali di canale: almeno **manager**, **amministratore**, **caposquadra** (stesso box Impostazioni / preferenze utente).

---

## 5. Flusso assenza (canale primario di prodotto)

```
Assenza salvata (Firestore)
        ↓
Crea evento notifica (stati sotto)
        ↓
Push FCM ai destinatari (se toggle on + in finestra push)
        ↓
Deep link → UI sostituzioni / gestione lavori giorno
        ↓
Se dopo TIMEOUT nessuno ha seen  →  WhatsApp (se toggle on + numero + in finestra WA)
        ↓
Se acted / resolved  →  stop per tutti
```

### 5.1 Stati evento (minimi)

| Stato | Significato |
|-------|-------------|
| `pending` | Creato; push da inviare o inviata |
| `seen` | Almeno un destinatario ha aperto notifica o card in-app |
| `acted` | Azione di gestione (es. sostituto scelto / assenza chiusa dal flusso previsto) |
| `escalated` | Inviato reminder WhatsApp |
| `resolved` / `dismissed` | Chiuso |

### 5.2 Timeout WhatsApp

- **10 minuti** dall’invio push (o dall’istante in cui la push sarebbe partita in finestra — vedi §7).
- Condizione di invio WA: evento ancora **senza `seen` e senza `acted`** (MVP: basta **`seen`** per **non** mandare il WA; non serve aver già scelto il sostituto).
- **Max 1** messaggio WhatsApp per evento.

### 5.3 Contenuto push (MVP)

- **Titolo:** es. `Assenza oggi — [squadra/lavoro]`
- **Corpo:** chi manca + invito ad agire (“Tocca per scegliere il sostituto”)
- **Icona / badge:** asset PWA esistenti
- **Tap:** deep link a gestione lavori / vista giorno con focus assenza  
  (es. query `data=…&assenzaId=…` — da definire in implementazione)
- Azioni native (`Apri` / `Più tardi`): best-effort Android/Chrome; non dipendere da iOS

### 5.4 Inbox in-app (MVP)

- Card / elenco sul **giorno** (gestione lavori / impegni), raggiungibile anche dal deep link.
- Badge dashboard: **fase successiva** (non bloccante per MVP).
- Se push e WA sono entrambi off → resta comunque l’inbox in-app.

---

## 6. Affitti (allineamento a Tony, non a WhatsApp)

Semaforo affitti già in app (`calcolaAlertAffitto`):

| Colore | Finestra tipica |
|--------|-----------------|
| Verde | > 6 mesi |
| Giallo | ≤ 6 mesi e > 30 giorni |
| Rosso | ≤ **30 giorni** |
| Grigio | scaduto |

**Policy reminder:**

| Momento | Canale |
|---------|--------|
| Entra in giallo / almeno a **30 giorni** (rosso) | **Tony** in-app (fasce anti-spam §15.5) — inizio utile per rinnovo |
| A **7 giorni** dalla scadenza | Reminder Tony **rafforzato**; opzionale **1 push** (fase successiva) |
| Scaduto | Tony / lista (audit), non “rinnovo” |
| WhatsApp / digest 3×/giorno | **Vietato** |

> La settimana prima **non** è l’inizio del processo di rinnovo: è l’**escalation**. L’inizio utile resta ≥ 30 giorni (già rosso).

Scorte: restano **solo Tony** (nessun WA; nessuna push di routine).

---

## 7. Preferenze utente (orari e canali)

### 7.1 Perché

Gli orari in campagna sono variabili: **finestra di invio settabile dal manager** (e dal caposquadra per le proprie notifiche), non hardcoded nel codice.

### 7.2 Dove in UI

Nuova sezione **“Notifiche”** in **Impostazioni** (`impostazioni-standalone.html`), vicino ad **Account**.

Il telefono account esiste già (`account-telefono` → tipicamente `users/{uid}.telefono`). Il proprietario/manager spesso **non** è in anagrafica manodopera: **deve poter inserire/aggiornare il numero da questo box** senza passare da profili operai.

### 7.3 Controlli MVP del box

1. Toggle **Notifiche push (assenze)** — on/off  
2. Toggle **WhatsApp** (“solo se non gestisco in tempo”) — on/off  
3. Campo **telefono** (obbligatorio se WA on); hint chiaro; salvataggio su anagrafica utente account  
4. **Orario push:** dalle / alle  
5. **Orario WhatsApp:** dalle / alle (può differire dalla push)  
6. Testo esplicativo breve: Tony continua su scorte/affitti in app; qui si regolano le **urgenze fuori app** (assenze)  
7. (Opzionale subito dopo) “Invia notifica di prova” (solo push)

**MVP:** un solo intervallo continuo al giorno (es. 05:00–21:00). Niente multi-fascia / pausa pranzo al primo rilascio.

### 7.4 Default consigliati (alla prima apertura)

| Preferenza | Default |
|------------|---------|
| Push assenze | **on** |
| WhatsApp | **off** finché non c’è un telefono valido |
| Finestra push | 05:00–21:00 |
| Finestra WhatsApp | 06:00–20:00 |
| Timezone | `Europe/Rome` (o timezone tenant se un giorno esiste) |

### 7.5 Regole se manca qualcosa

| Situazione | Comportamento |
|------------|----------------|
| Push off | Nessuna push; se WA on → escalation dopo timeout **nella finestra WA** (o in coda) |
| WA on senza telefono | Toggle non attivabile / salvataggio bloccato finché non inserisce il numero |
| Evento **fuori finestra** | **Non si perde:** accodato; invio all’**apertura** della finestra corrispondente |
| Timeout 10 min | Si conta solo su tempo **utile in finestra** (o dal primo istante push inviata in finestra) |
| Push e WA entrambi off | Solo inbox in-app |
| Opt-in WhatsApp | Obbligatorio (toggle + numero); rispetto privacy / uso Meta Business API in fase implementativa |

---

## 8. Architettura tecnica (senza n8n)

### 8.1 Stack previsto

| Pezzo | Ruolo |
|-------|--------|
| Firestore | Eventi notifica tenant-scoped + preferenze utente |
| Cloud Functions | Alla write assenza → crea evento → invia FCM; job/schedule per coda orari + escalation WA |
| FCM + Service Worker | Push; estendere `service-worker.js` (`push` + `notificationclick`) |
| WhatsApp Cloud API (Meta) | Solo fase escalation; template approvati |
| Impostazioni UI | Preferenze + telefono |

**Non richiesto:** n8n, MCP n8n.

### 8.2 Fasi di implementazione suggerite

| Fase | Contenuto |
|------|-----------|
| **0** | Modello preferenze + UI Impostazioni (toggle, orari, telefono) + inbox in-app + stati evento (anche senza push reale) |
| **1** | FCM + SW + invio push assenze + deep link + rispetto finestre orarie / coda |
| **2** | Escalation WhatsApp (10 min, opt-in, template, `escalated`) |
| **3** (opz.) | 1 push affitti a 7 giorni; badge dashboard; notifica di prova |

### 8.3 Vincoli PWA / iOS

- Push web: buona su Android Chrome; su **iOS PWA best-effort**.
- Accettato in prodotto: se la push non arriva, il **WhatsApp a 10 min** (in finestra) è la rete di sicurezza — a patto che l’utente abbia opt-in e numero.

---

## 9. Relazione con Tony (anti-spam)

- I reminder §15.5–§15.6 (dashboard/hub, fingerprint, fasce) restano il canale per **scorte, affitti, guasti, prezzi in attesa, …**.
- Le **notifiche esterne** di questo documento **non** sostituiscono Tony e **non** ripetono gli stessi segnali su WA.
- Eventuale menzione Tony di “assenza aperta” è complementare, non un secondo sistema di ping.

Testo da mostrare in Impostazioni (orientativo):

> Tony ti ricorda in app scorte, affitti e scadenze. Qui configuri solo le urgenze operative (assenze): push per agire subito e, se vuoi, WhatsApp se non apri la notifica in tempo.

---

## 10. Checklist decisioni (chiusa al 2026-07-29)

- [x] Niente n8n per questo flusso  
- [x] App/push = agire; WhatsApp = escalation se non vista  
- [x] Destinatari assenza: caposquadra + manager sempre  
- [x] Timeout WA assenza: **10 minuti**; max 1 WA; stop se `seen`/`acted`  
- [x] Scorte: solo Tony  
- [x] Affitti: Tony da giallo/rosso; rafforzamento a **7 giorni**; niente WA  
- [x] Orari **settabili** (push e WA separati)  
- [x] Box preferenze in Impostazioni con toggle e telefono inseribile lì  
- [x] Fuori orario → coda, non drop  
- [x] Niente suoni custom MVP  
- [x] Inbox giorno in MVP; badge dashboard dopo  

---

## 11. Prossimi passi (quando si implementa)

1. Spec collezioni Firestore (`notificationEvents`, campi preferenze su `users` o doc dedicato).  
2. UI sezione Notifiche in Impostazioni + validazione telefono E.164.  
3. Hook assenza → creazione evento (allineato a servizi assenza/sostituzione esistenti).  
4. FCM + aggiornamento `GUIDA_PWA.md` / checklist push.  
5. Meta WhatsApp + template + secrets Functions.  
6. Aggiornare, a lavoro fatto, solo i 4 file Tony consentiti dalle regole agente se lo stato prodotto cambia (`COSA_ABBIAMO_FATTO`, `STATO_ATTUALE`, eventualmente `MASTER_PLAN` / `TONY_DECISIONI_E_REQUISITI`).

---

**Ultimo aggiornamento:** 2026-07-29
