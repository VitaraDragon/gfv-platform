# Proposta regole guasti — in attesa di Pier

**Non deployare da questa PR.** Il file descrive un cambiamento a `firestore.rules`. Le regole vere non sono in questo commit. Pier le applica e le pubblica solo dopo aver confermato.

Stato: proposta A, letta sulle regole di develop (`0407a6e`) e di main (`655d875`). Il sorgente `/workspace/proposta-rules-guasti.md` non era su questa macchina: il testo è ricostruito da quel brief e dalle regole nel repo.

## Cosa succede oggi

Il form `core/admin/segnalazione-guasti-standalone.html` fa tre scritture:

1. `addDoc` su `tenants/{tenantId}/guasti` — consentito a chi appartiene al tenant (regola `guasti`, circa righe 444-449).
2. `updateDoc` su `macchine/{id}` con `stato: 'guasto'` oppure `'guasto-lavoro-in-corso'`.
3. Se il guasto è grave e c’è un lavoro, aggiornamento del lavoro.

La (1) riesce. La (2) fallisce per caposquadra e operaio. La (3) falliva anche perché il form scriveva `motivoSospensione`, chiave non ammessa.

## Macchine — serve un cambio regole (proposta A)

Regola attuale (`macchine`, circa righe 452-464):

- lettura: tutto il tenant;
- creazione ed eliminazione: solo manager/admin;
- aggiornamento: manager/admin senza limiti;
- caposquadra e operaio solo se le chiavi toccate sono `stato` e `updatedAt` **e** `stato == 'disponibile'`.

Quindi capo e operaio possono solo liberare la macchina. Non possono segnarla `guasto` né `guasto-lavoro-in-corso`. La console risponde `Missing or insufficient permissions`.

Proposta A, unica modifica suggerita: nella stessa condizione, accettare anche

- `request.resource.data.stato == 'guasto'`
- `request.resource.data.stato == 'guasto-lavoro-in-corso'`

Restano i vincoli già presenti: solo quelle due chiavi, solo caposquadra o operaio del tenant, niente altri campi. Il manager/admin non cambia.

Non allargare ad altri stati.

## Lavori — non serve un cambio regole

Il caposquadra può aggiornare un lavoro solo se `caposquadraId == uid`, non è un lavoro autonomo (`operaioId` assente o nullo), e le chiavi sono nella lista (c’è `stato`, `sospensioneCausa`, `sospensioneIl`, `aggiornatoIl`; non c’è `motivoSospensione`). Lo stato `sospeso` è già ammesso.

Il client, nella correzione campo, non scrive più `motivoSospensione`. Usa `buildSospendiLavoroPatch` di `core/services/lavoro-sospensione.js`: `stato: 'sospeso'`, `sospensioneCausa`, `sospensioneIl`, `aggiornatoIl`. Scrive solo se il lavoro è del caposquadra, o se l’utente è manager/admin. L’operaio non tenta la scrittura.

Non modificare la regola `lavori` per questo caso.

## Cosa non fare in questo commit

- Non modificare `firestore.rules`.
- Non fare deploy di Cloud Functions.
- Non mergiare questa PR finché Pier non conferma e pubblica le regole.
