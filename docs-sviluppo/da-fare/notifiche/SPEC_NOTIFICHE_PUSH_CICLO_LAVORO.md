# Spec: push sul ciclo lavoro (comunicazioni + stati manager)

**Tipo:** specifica di implementazione (catalogo + Firestore + fasi)  
**Data:** 2026-08-25  
**Stato:** decisioni prodotto chiuse — catalogo codice in `core/config/notification-catalog.js`  
**Per chi:** agenti e sviluppatori su PWA, comunicazioni, lavori, Impostazioni

**Documenti correlati:**

- `LINEA_GUIDA_NOTIFICHE_ASSENZE_E_PREFERENZE.md` — assenze + WhatsApp (binario successivo, stesso tubo FCM)
- `docs-sviluppo/tony/MASTER_PLAN.md` — §4 catalogo/config, §15.5–§15.6 Tony in-app (non duplicare su push)
- `core/config/tony-proactive-signals.js` — reminder in-app per ruolo (scorte, ore, ecc.)
- `core/services/comunicazioni-squadra-utils.js` — `destinatari` + `conferme`
- `docs-sviluppo/VIDEO_STORYBOARD_SCRIPT_E_CLIP.md` — ciclo spot (Luca → Mario → Giuseppe)

---

## 1. Obiettivo

Far arrivare **fuori app** solo i segnali del ciclo operativo dello spot:

1. Una **comunicazione** arriva a un destinatario → push a quella persona.
2. Il manager **crea/assegna** un lavoro → push all’assegnatario (caposquadra, o operaio se autonomo).
3. Qualcuno **non conferma** la ricezione entro 6 ore utili → una push al mittente (capo).
4. Gli operai **segnano le ore** → una push aggregata al capo (da validare).
5. Il capo (o il sistema) mette il lavoro in **`completato_da_approvare`** o **`sospeso`** → push al manager/admin.

Tony resta il canale in-app (briefing, scorte, affitti, conteggi). WhatsApp e assenze restano fuori da questo documento.

---

## 2. Principi

| Principio | Come |
|-----------|------|
| Un tubo, tanti eventi | Catalogo in `notification-catalog.js`. Vietato `if (pagina === 'gestione-lavori')` nel core push. |
| Destinatario esplicito | Push a **user id**, non “a un ruolo in astratto”. Il ruolo serve solo a *risolvere* chi è. |
| Manager senza rumore | Nessuna push su % avanzamento, ore validate, o ogni scrittura lavoro. Solo chiusura da approvare e sospeso. |
| Anti-auto-ping | Chi ha fatto l’azione (`actorUserId`) non riceve la push di quell’evento. |
| Fuori orario → coda | Non si perde. Invio all’apertura finestra. |
| iOS PWA best-effort | Accettato; inbox in-app resta comunque. |

Test prima di aggiungere un evento: *se l’utente non apre il telefono per qualche ora, si blocca il turno / una decisione oggi?* Se no → Tony, non push.

---

## 3. Catalogo eventi (MVP)

| `id` | Trigger Firestore | Destinatari | Coalesce | Deep link (già supportato) |
|------|-------------------|-------------|----------|----------------------------|
| `comunicazione_destinatario` | create `tenants/{tid}/comunicazioni` | `destinatari[]` | no (1 per comunicazione × persona) | workspace `?openSlide=comunicazioni` |
| `lavoro_assegnato` | create/update `lavori` con assegnatario nuovo | `caposquadraId` **oppure** `operaioId` (autonomo) | no | workspace `?openSlide=lavoro&focusLavoroId=` |
| `conferme_in_ritardo` | scheduler su comunicazioni con conferme mancanti | mittente (`caposquadraId`) | 1 per `comunicazioneId` | workspace `?openSlide=comunicazioni` |
| `ore_da_validare` | create `lavori/{id}/oreOperai` con `stato=da_validare` | capo del lavoro | 1 per capo × giorno solare (debounce 15 min) | workspace `?openSlide=valida-ore` |
| `lavoro_completato_da_approvare` | update `lavori.stato` → `completato_da_approvare` | manager + amministratore del tenant | no | `gestione-lavori-standalone.html?lavoroId=` |
| `lavoro_sospeso` | update `lavori.stato` → `sospeso` | manager + amministratore del tenant | no | `gestione-lavori-standalone.html?lavoroId=` |

**Non in MVP (e non per il manager):** transizione a `completato` (Luca ha già approvato), `in_standby` (assenze), ogni delta `%`, ore già validate.

Lavoro **autonomo** (`operaioId`, niente capo): `lavoro_assegnato` va all’operaio; `ore_da_validare` **non** manda push al manager (resta Tony).

---

## 4. Conferme a 6 ore

Già in modello: `comunicazioni.conferme[]` + bottone «Conferma ricezione».

- Timeout default: **6 ore di tempo utile in finestra push** (non di orologio di notte).
- Esempio: invio alle 20:00, finestra 05:00–21:00 → 1 ora fino alle 21, riprende alle 05 → reminder verso le 10:00.
- **Max 1** push `conferme_in_ritardo` per comunicazione.
- Se tutti i destinatari hanno confermato → niente reminder / annulla coda.
- Finestra e timeout: preferenze utente del **mittente** (chi riceve il reminder).

---

## 5. Digest ore

Se 4 operai segnano alle 18, il capo prende **una** push: titolo con conteggio (*«3 operai hanno segnato le ore — da validare»*), tap su Valida ore.

Chiave coalesce: `ore_da_validare:{caposquadraId}:{yyyy-mm-dd}`. Debounce 15 minuti dall’ultimo insert `oreOperai`.

---

## 6. Preferenze (`users/{uid}.notificationPrefs`)

Allineate alla linea guida assenze (stesso box Impostazioni). **UI S1:** sezione **Notifiche** in `core/admin/impostazioni-standalone.html` (tutti i ruoli), persistenza `users/{uid}.notificationPrefs` via `notification-prefs-service.js`.

| Campo | Default | Note |
|-------|---------|------|
| `pushEnabled` | `true` | Master switch ciclo lavoro |
| `pushWindowStart` / `pushWindowEnd` | `05:00` / `21:00` | Un intervallo continuo |
| `timezone` | `Europe/Rome` | MVP |
| `confermaTimeoutHours` | `6` | Solo per `conferme_in_ritardo` |
| `fcmTokens` | `[]` | Fase FCM: `{ token, ua, updatedAt }` |

Telefono / WhatsApp: solo documento assenze, non questo MVP.

---

## 7. Firestore — `tenants/{tenantId}/notificationEvents/{eventId}`

```
type, sourceCollection, sourceId, lavoroId, lavoroNome,
actorUserId, recipientUserIds[],
title, body, deepLink,
status,           // pending | queued | sent | seen | acted | suppressed
coalesceKey,      // null oppure stringa digest
sendAfter,        // timestamp (coda finestra)
createdAt, sentAt, seenBy[],
escalatedAt       // riservato assenze/WA; unused qui
```

Stati: `queued` = creato fuori finestra; `suppressed` = actor-only / tutti già confermato / preferenza off.

Rules (Fase implementazione write): create/update **solo Cloud Functions** (Admin SDK). Client: read dei propri eventi (`recipientUserIds` contains uid) per inbox futura. MVP può omettere inbox UI.

---

## 8. Fasi

| Fase | Contenuto | Stato |
|------|-----------|--------|
| **S0** | Spec + catalogo + policy destinatari/finestre (questo lavoro) | **fatto** 2026-08-25 |
| **S1** | Preferenze Impostazioni (toggle + orari) senza FCM | **fatto** 2026-08-25 |
| **S2** | CF: create comunicazione / lavoro assegnato → `notificationEvents` | **fatto** 2026-08-25 |
| **S3** | FCM + `push` / `notificationclick` nel service worker + token in login | **fatto** 2026-08-25; **`vapidKey` presente** in `core/config/firebase-config.js` (verifica 2026-09-01) |
| **S4** | Scheduler conferme 6h + digest ore + trigger stati manager | **fatto** 2026-08-25 |
| **S5** | Assenze + WhatsApp (linea guida 2026-07-29) sullo stesso tubo | **fatto** 2026-08-28 |

Non toccare n8n. Non suoni custom.

---

## 9. Relazione con Tony

I segnali `oreDaValidare`, `lavoriDaApprovare`, `lavoriSospesiDaRiprendere` in `tony-proactive-signals.js` restano **in-app**. La push è l’equivalente *fuori app* solo per gli id di questo catalogo, con le regole anti-spam di §2.

---

**Ultimo aggiornamento:** 2026-08-28
