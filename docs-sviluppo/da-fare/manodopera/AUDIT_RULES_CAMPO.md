# Audit regole Firestore — profilo campo

**Data:** 2026-10-10. **Solo documento.** Questo step non modifica `firestore.rules` e non apre una PR di regole.

Fonte: `firestore.rules` (file reale, ogni `match`). Cosa usa il workspace: `core/mobile/js/field-workspace-controller.js`, pagine compito (lavori caposquadra, validazione ore, segnatura ore, statistiche lavoratore, segnalazione guasti, impostazioni), servizi manodopera collegati.

**Profilo campo** = operaio e/o caposquadra, modulo manodopera, senza manager né amministratore.

**Guardia di interfaccia** (`field-route-guard.js`): un indirizzo desktop digitato a mano torna al workspace. Non è un permesso. Se le regole lasciano leggere una collezione, la pagina — o un altro client — la legge lo stesso.

**Lettura «appartiene al tenant»** = `belongsToTenant`: ogni membro attivo (anche operaio e caposquadra), non solo manager.

## Conclusione

Non apro una PR «rules - needs Pier deploy».

Restringere le letture larghe (lavori, ore, comunicazioni, terreni, macchine, categorie) senza riscrivere le query rompe il workspace: oggi elenca la collezione e filtra nel browser. In Firestore, se una regola nega anche un solo documento di una `list`, fallisce tutta la query.

Alcune scritture sono troppo larghe (`attivita`, `zoneLavorate`, statistiche aggregate, `guasti`). `zoneLavorate` e la creazione guasti servono al campo. `guasti` usa `users.tenantId` e non `belongsToTenant`: chi ha solo `tenantMemberships` può essere negato, e il commento nel file dice che il controllo diretto evita un problema con `onSnapshot`. Cambiarlo va provato sull’emulatore e deployato da Pier, non insieme a questa interfaccia.

## Cosa non ha un blocco proprio

| Dato | Dove vive nel codice | Regola |
|------|----------------------|--------|
| Fatture | Nessuna collezione `fatture`. L’archivio acquisti è `documentiAcquisiti`; i movimenti sono `movimentiMagazzino`. | Lettura a ogni membro; scrittura solo manager/admin. |
| Compensi | Campi contratto su `users` (`tipoContratto`, `tariffaPersonalizzata`, …) e documento `tenants/{id}/tariffe/operai`. | Update di quei campi su `users`: solo manager/admin dello stesso `tenantId`. Tariffe: lettura membro, scrittura manager. |
| Abbonamento | Campi `plan` / `piano` / `modules` sul documento `tenants/{id}`. Stripe aggiorna da Cloud Functions (Admin SDK, fuori dalle rules). | Lettura a ogni membro. Update del documento tenant: solo manager/admin. |
| Report | Pagine che leggono terreni, lavori, ore, statistiche. Nessuna collezione `report`. | Vale la regola della collezione letta. |

Senza una regola, l’accesso client è negato. Non c’è un buco «fatture senza match»: non c’è quella collezione.

## Tabella

Giudizio: **ok** / **lettura troppo larga** / **scrittura troppo larga**.

| Collezione | Lettura operaio / capo | Scrittura operaio / capo | Scrittura manager/admin | Serve al workspace | Giudizio | Rischio se si stringe adesso |
|------------|------------------------|--------------------------|-------------------------|--------------------|----------|------------------------------|
| `users/{userId}` r.67 | Il proprio documento. I colleghi solo se entrambi hanno lo stesso `tenantId` deprecato. Manager/admin anche per cercare un’email. | Il proprio documento, tutti i campi. I campi contratto di un altro: no. | Update campi contratto di un utente dello stesso `tenantId`. Delete: solo il proprio. Create: solo il proprio uid. | Sì, lettura: nome, ruoli, tenant. Il capo legge i nomi della squadra. | ok sulla scrittura. Lettura colleghi legata al `tenantId` vecchio, non a `tenantMemberships`. | Allargare la lettura ai membership senza filtro può esporre email di un altro tenant. Stringere toglie i nomi in squadra e comunicazioni. |
| `tenants/{tenantId}` r.115 | Ogni membro (e il creatore in registrazione). Piano, moduli, anagrafica. | No. | Create/update/delete. | Sì, lettura moduli e nome azienda. | ok | Negare la lettura al campo spegne moduli, menu guasti e ingresso. |
| `inviti/{invitoId}` r.143 | No. | No. L’accettato può aggiornare solo `stato`/`accettatoIl` sul proprio invito. | List, create, update, delete. | No. | ok | — |
| `clienti` r.204 | Sì, tutto il tenant. | No. | Sì. | No. | lettura troppo larga | Il campo non ne ha bisogno. Una `list` negata non rompe il workspace. Rompe Conto terzi e il simulatore se un operaio apre quella pagina (oggi la guardia lo manda via, le rules no). |
| `tariffe` r.210 | Sì. | No. | Sì. | No (i compensi sono del manager). | lettura troppo larga | Come sopra. Il campo non legge le tariffe. |
| `preventivi` r.216 | Sì. | No. | Sì. Lo stato dal link pubblico è una Cloud Function. | No. | lettura troppo larga | Come i clienti. |
| `poderi-clienti` r.231 | Sì. | No. | Sì. | No. | lettura troppo larga | Come i clienti. |
| `prodotti` r.237 | Sì. | No. | Sì. | Solo se il pieno in campo legge l’anagrafica carburante. | lettura troppo larga per il resto del magazzino | Negare la lettura rompe il pieno. Una proiezione «solo nome e unità dei carburanti» è un refactor. |
| `movimentiMagazzino` r.243 | Sì. | No. | Sì. | Il pieno non scrive da qui: chiama una Cloud Function. Il campo non ha bisogno della scrittura client. | lettura troppo larga | Stringere la lettura non rompe il pieno. |
| `documentiAcquisiti` r.249 | Sì. | No. | Sì. | No. | lettura troppo larga | Archivi fatture/DDT visibili a ogni membro. |
| `terreni` r.255 | Sì. | No. | Sì. | Sì, lettura: la pagina lavori caposquadra carica i terreni per i nomi e la mappa zone. | lettura troppo larga (serve il nome, non tutto) | Una `list` con documenti negati fallisce. Tenerla, oppure esporre un elenco ridotto. |
| `calcoli-vendemmia-meccanica` r.261 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `spese-vendemmia-meccanica` r.267 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `poderi` r.273 | Sì. | No. | Sì. | No, salvo un nome mostrato dentro un lavoro. | lettura troppo larga | — |
| `meteoCache` r.279 | No (`read, write: if false`). | No. | No. Scrive la Function. | No. | ok | — |
| `tonyContextCache` r.284 | No. | No. | No. | No. | ok | — |
| `tonyOnboardingQuota` r.289 | No. | No. | No. | No. | ok | — |
| `liste` r.294 | Sì. | No. | Sì. | Forse nomi colture. | lettura troppo larga | — |
| `impostazioni` r.300 | Sì (coefficienti, tariffe operai). | No. | Sì. | Lettura possibile per etichette. Non è la pagina Impostazioni account. | lettura troppo larga | — |
| `categorie` r.306 | Sì. | No. | Sì. | Sì, lettura nomi. | lettura troppo larga ma utile | Tenerla o ridurla a nome. |
| `tipiLavoro` r.312 | Sì. | No. | Sì. | Sì, lettura nomi tipi. | lettura troppo larga ma utile | Come le categorie. |
| `colture` r.318 | Sì. | No. | Sì. | Lettura nomi. | lettura troppo larga ma utile | — |
| `categorieLavori` r.324 | Sì. | No. | Sì. | Legacy. | lettura troppo larga | — |
| `categorieAttrezzi` r.330 | Sì. | No. | Sì. | Legacy. | lettura troppo larga | — |
| `lavori` r.336 | Sì, **tutti** i lavori del tenant. | Create/delete: no. Update capo: solo il proprio lavoro di squadra, chiavi in lista (stato, superfici, sospensione, …). Update operaio: solo il proprio autonomo, stesse chiavi. | Tutto. | Sì. Il workspace e «I miei lavori» leggono i lavori assegnati, ma la query non è «solo i miei»: il filtro è nel client (`fetchLavoriDocumentsForFieldUser`). | lettura troppo larga. Scrittura ok. | Solo i lavori assegnati in rules rompe la `list` finché il client non chiede un sottoinsieme che le rules accettano. Tocca anche Tony, statistiche, gestione lavori, simulatore. |
| `attivita` r.408 | Sì. | **Create, update e delete per ogni membro.** | Sì, come membro. | No. Il diario è dell’ufficio. | scrittura troppo larga | Il workspace non scrive qui. Il diario e il simulatore sì: non stringere senza un giro sui ruoli che creano attività. |
| `squadre` r.414 | Sì, tutte. | No. | Sì. | Sì, lettura: il capo legge le squadre di cui è `caposquadraId`. | lettura troppo larga (vede anche le altre squadre) | Una query `where caposquadraId == uid` può restare se la regola permette quei documenti. Una `list` senza filtro fallisce se si nega il resto. |
| `profiliManodopera` r.420 | Sì. | No. | Sì. | No (scheda skill del manager). | lettura troppo larga | — |
| `assenzeOperai` r.427 | Sì, tutte. | Create: capo solo se `stato == segnalata`. Update capo: solo mentre resta `segnalata`. Delete: no. | Tutto. | Sì: il capo segnala l’assenza. | lettura troppo larga. Scrittura ok. | — |
| `guasti` r.444 | Solo se `users.tenantId == tenantId`. Non usa `belongsToTenant`. | Create, update **e delete** per chiunque abbia quel `tenantId`. | Come sopra, non un controllo manager. | Sì: la segnalazione crea il guasto. L’elenco guasti del manager non è una pagina campo. | scrittura troppo larga. Il controllo `tenantId` esclude chi ha solo `tenantMemberships`. | Il commento in rules evita `belongsToTenant` per `onSnapshot`. Cambiarlo è una PR a parte, con emulatore (consentito/negato per operaio, capo, manager, altro tenant) e deploy di Pier. |
| `macchine` r.452 | Sì. | Create/delete: no. Update: solo `stato` + `updatedAt`, valori `disponibile`, `guasto`, `guasto-lavoro-in-corso`. | Tutto. | Sì, lettura nomi mezzi. Update stato in segnalazione guasto. | lettura troppo larga (serve il nome e lo stato). Scrittura ok dopo il vincolo stato. | Tenerla in lettura, o un elenco ridotto. |
| `vigneti` r.472 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `vigneti/…/vendemmie` r.478 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `vigneti/…/potature` r.484 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `vigneti/…/trattamenti` r.490 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `statistiche_vigneto` r.499 | Sì. | **Create e update per ogni membro.** Delete: no. | Delete sì. | No. | scrittura troppo larga | Sono cache. Un membro può sovrascrivere i numeri. Stringere a manager può rompere la pagina che ricalcola al volo. |
| `statistiche_frutteto` r.506 | Sì. | Come sopra. | Delete sì. | No. | scrittura troppo larga | Come il vigneto. |
| `frutteti` r.513 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `frutteti/…/raccolte` r.519 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `frutteti/…/potature` r.525 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `frutteti/…/trattamenti` r.531 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `seminativi` r.537 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `semineSeminativo` r.543 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `trattamentiSeminativo` r.549 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `raccolteSeminativo` r.555 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `raccolteFrutta` r.561 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `pianificazioni-impianti` r.567 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `lavori/…/oreOperai` r.579 | Sì, **le ore di tutti** su quel lavoro. | Create: solo le proprie, `stato == da_validare`. Update: le proprie se in attesa o rifiutate; il capo sul lavoro di squadra se non è la sua riga. Delete: le proprie in attesa o rifiutate. | Update e delete. | Sì. L’operaio legge e scrive le sue. Il capo legge le ore del lavoro per validare. | lettura troppo larga. Scrittura ok. | «Solo le proprie / solo il proprio lavoro» rompe la `list` del capo se la query non è già filtrata, e le statistiche che sommano le ore. |
| `lavori/…/zoneLavorate` r.629 | Sì, anche le zone degli altri. | **Create e update per ogni membro**, anche su zone altrui. Delete: proprietario (`operaioId` o `caposquadraId`) o manager. | Sì. | Sì: il tracciamento zone nella pagina lavori crea e aggiorna. | scrittura troppo larga. Lettura larga. | Vietare create/update al membro rompe la mappa zone del campo. Limitare al proprio `operaioId` richiede che il client scriva già quel campo in modo coerente. |
| `macchine/…/manutenzioni` r.641 | Sì. | No. | Sì. | No. | lettura troppo larga | — |
| `comunicazioni` r.647 | Sì, **tutte**. Il filtro destinatario è solo nel client (commento in rules, r.648–649). | Create: capo (e manager). Update operaio: solo `conferme`. Update capo: tutto. Delete: no. | Create, update, delete. | Sì. Il capo crea. L’operaio conferma. Entrambi leggono e poi filtrano. | lettura troppo larga. Scrittura ok. | «Solo i destinatari» non si può esprimere su una `list` senza un campo interrogabile che le rules e la query condividono. Oggi un operaio può leggere anche i messaggi non suoi. |
| `notificationEvents` r.669 | Solo se `recipientUserIds` contiene il proprio uid. | Create e delete: no. Update: solo il proprio evento, verso `status == seen`, chiavi in lista. | Come il destinatario, non un accesso in più. | Sì, lettura delle proprie notifiche. | ok | — |

Il `match` generico `tenants/{tenantId}/{document=**}` (r.197) è commentato. Non concede nulla.

## Cosa servirebbe, più avanti, senza rompere il campo

1. **Lavori e ore:** query già ristrette (`caposquadraId`, `operaioId`, lavoro assegnato) e rules allineate a quelle query. Finché il client fa `getDocs` sull’intera collezione, le rules non possono negare i documenti degli altri.
2. **Comunicazioni:** stesso vincolo. Il filtro destinatario va in query, non solo in JavaScript.
3. **Terreni, macchine, categorie, tipi lavoro:** il campo ha bisogno dei nomi. O si tengono in lettura, o si espone un elenco corto (id, nome) che le pagine compito usano al posto della collezione intera.
4. **Guasti:** create per capo/operaio, delete solo manager, e un controllo che funzioni anche con `tenantMemberships`. PR separata, emulatore, deploy di Pier. Non in questo step.
5. **Attività e statistiche aggregate:** scrittura solo manager, dopo aver visto chi le ricalcola (diario, pagine vigneto/frutteto, simulatore).

Nessuna di queste entra in questa PR.
