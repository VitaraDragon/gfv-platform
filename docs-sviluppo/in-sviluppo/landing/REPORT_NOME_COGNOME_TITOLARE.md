# Report: nome e cognome del titolare (landing passo 3)

| Campo | Valore |
|-------|--------|
| Data analisi | 2026-10-22 |
| Branch di analisi | `develop` |
| Commit analizzato | `df8c5cc2e27e18ab5f38c621434574f487a68491` (Landing passo 2 / PR #263) |
| Branch di questo documento | `feat/landing-passo3` |

**Report in sola lettura: nessun file di codice modificato.**

Tutti i riferimenti `percorso:riga` si riferiscono al commit di develop indicato sopra.

---

## 1. In breve (per Pier)

Sì, si può fare: quasi ovunque l’app, se manca il nome, mostra già l’email o un testo generico («N/A», «Utente»). Non si rompe il login né la creazione dell’azienda.

Nel passo 4 i punti **necessari** sono pochi (soprattutto la pagina di registrazione del titolare). Poi conviene allineare Impostazioni e i test E2E che oggi pretendono nome e cognome pieni. Il resto è già tollerante.

Il rischio vero non è «schermo vuoto»: è la regola **multi-azienda**. Nome e cognome stanno su un solo documento `users/{uid}` condiviso tra tutte le aziende. Se ti registri senza nome e poi un’altra azienda ti invita come operaio, **quel nome dell’invito non viene copiato** sul tuo documento: l’altra azienda ti vede soprattutto con l’email. E un operaio che ha già un account **non può oggi** aprire la propria azienda con la stessa email.

Devi decidere tu: come riconoscere «registrazione dalla landing»; se i ripieghi (azienda → pezzo di email) vanno bene; e cosa fare del caso «stessa persona in due aziende» (vedi §8).

---

## 2. Mappa completa: dove si scrivono e dove si leggono

Legenda gravità: **nessuna** · **estetica** · **funzionale** · **blocca**.

### 2.1 Registrazione del titolare

| file:riga | scrive/legge | per chi | cosa fa | se manca oggi | gravità |
|-----------|--------------|---------|---------|---------------|---------|
| `landing/src/config/landing-config.js:97` + `landing/src/views/LandingHome.vue` (CTA) | — | titolare dalla landing | Link a `core/auth/registrazione-standalone.html` **senza** parametro speciale | Stessa pagina del login «Registrati» | nessuna |
| `core/auth/registrazione-standalone.html:218-240` | valida (HTML) | titolare nuovo | Campi Nome * e Cognome * con `required` | Il browser blocca l’invio | **blocca** |
| `core/auth/registrazione-standalone.html:517-526` | valida (JS) | titolare nuovo | Messaggi «Nome obbligatorio» / «Cognome obbligatorio» | Blocca il submit | **blocca** |
| `core/auth/registrazione-standalone.html:616-702` | **scrive** | titolare/amministratore | Crea Auth + `tenants/{id}` (`nome` azienda, `creatoDa`) + `users/{uid}` con `nome`, `cognome`, `ruoli: ['amministratore']`, `tenantId` | Se togliessi solo HTML, scriverebbe stringhe vuote `""` | **blocca** (oggi) / funzionale (dopo) |
| `core/auth/registrazione-standalone.html` (tutto il flusso) | **non** chiama `updateProfile` | Firebase Auth | **Non** imposta `displayName` Auth | `displayName` resta vuoto anche se nome/cognome sono in Firestore | estetica / funzionale sui registri trattamenti |
| `core/auth/registrazione-standalone.html:211` | testo | tutti | Avviso: se invitati, usare il link email | — | nessuna |
| `core/auth/registrazione-standalone.html:830-836` | errore | email già usata | `auth/email-already-in-use` → «Questa email è già registrata…» | Non si può creare un secondo account con la stessa email | **blocca** (voluto) |
| `core/services/auth-service.js:103-138` (`signUp`) | scrive | generico | `nome/cognome \|\| ''` + `updateProfile` Auth se presenti | Accetta vuoto; `displayName` solo se c’è qualcosa | nessuna (la landing **non** usa questa funzione: registra in pagina) |
| `core/services/auth-service.js:321-339` (`updateUserProfile`) | scrive FS + Auth | sé stessi | Aggiorna `users` e, se nome/cognome, anche `displayName` | Ok | nessuna (poco usata dalle pagine; Impostazioni scrive a mano) |

### 2.2 Registrazione da invito

| file:riga | scrive/legge | per chi | cosa fa | se manca | gravità |
|-----------|--------------|---------|---------|----------|---------|
| `core/admin/gestisci-utenti-standalone.html:387-392, 995-1120` | scrive `inviti` | manager invita | Nome/Cognome * obbligatori sul form invito | Blocca l’invito | **blocca** (ok per operai/membri) |
| `core/services/invito-service-standalone.js:74-77` | scrive `inviti` | invitato | Salva `nome`/`cognome` sull’invito | Stringhe trim | nessuna |
| `core/services/invito-service-standalone.js:243-245, 324-326` | **non** scrive nome | utente **già** esistente | Aggiorna solo `tenantMemberships` | Il nome sull’invito **non** finisce su `users` | **funzionale** (multi-azienda) |
| `core/services/invito-service-standalone.js:358-382` | scrive `users` | utente **nuovo** | Copia `invito.nome` / `invito.cognome` sul documento | Dipende da cosa ha messo chi invita | nessuna |
| `core/auth/registrazione-invito-standalone.html:302-320, 578-579` | legge / precompila | invitato | Nome e cognome precompilati e `disabled` (l’invitato **non** li cambia) | Mostra i valori dell’invito | nessuna |
| `functions/invito-pubblico.js:66-67` | legge | pubblico | Espone nome/cognome dell’invito | `""` se assenti | nessuna |
| `functions/email-resend.js:180` | legge payload | destinatario invito | «Ciao **nome cognome**» | «Ciao  » (spazio vuoto) | estetica |

### 2.3 Modello User e servizi

| file:riga | scrive/legge | per chi | cosa fa | se manca | gravità |
|-----------|--------------|---------|---------|----------|---------|
| `core/models/User.js:75-80, 102-104` | valida / costruisce | modello | «Nome obbligatorio» / «Cognome obbligatorio»; `getFullName()` = `nome + cognome` | `validate()` fallisce; `getFullName()` con null → rischio JS se non stringa | **nessuna in runtime oggi** |
| Uso di `User.js` nel codice app | — | — | **Nessun import** trovato di `core/models/User.js` nei servizi/pagine | La validazione del modello **non** è sul percorso reale di registrazione | nessuna (ma attenzione se qualcuno la collega dopo) |
| `core/services/tenant-service.js:389-416` (`createTenant`) | scrive tenant | helper | Crea tenant per nome; **nessuna UI** «crea azienda» per utente già loggato | — | nessuna (non usato dalla landing) |

### 2.4 Dashboard, intestazioni, campo, Tony (sola lettura)

| file:riga | scrive/legge | per chi | cosa fa | se manca | gravità |
|-----------|--------------|---------|---------|----------|---------|
| `core/dashboard-standalone.html:1552-1553` | legge | utente corrente | Intestazione: nome+cognome oppure email | Mostra email | estetica |
| `core/dashboard-standalone.html:1187` | legge → Tony | corrente | `utente_corrente.nome` = trim nome+cognome oppure email | Tony riceve l’email come «nome» | estetica |
| `core/mobile/js/field-workspace-controller.js:350-352, 415-417` | legge | campo | Header: nome+cognome oppure email oppure etichetta «account» | Ok | nessuna |
| `core/statistiche-standalone.html:974-976` | legge | corrente | Stesso pattern → email | Ok | nessuna |
| `core/terreni-standalone.html:1513-1516` (e simili) | legge | corrente | «Utente: …» oppure `N/A` + email | Ok | estetica |
| `core/js/tony/main.js:7130-7136` | — | tutti | Saluto «Ciao! Sono Tony…» **senza** usare il nome persona | Già neutro | nessuna |
| `functions/tony-manodopera-giorno-context.js:222` | legge | operai nei lavori | `[nome, cognome]` oppure email oppure id | Ok | nessuna |
| `functions/tony-lavoro-entity-parser.js:213-226` | legge | riconoscimento persone | Match su nome+cognome; label senza email | Persona senza nome **difficile da chiamare a voce** | funzionale (se il titolare senza nome è anche in elenco operai) |
| Vari home moduli (`manodopera-home-standalone.html:363`, magazzino, macchine, conto-terzi, …) | legge → Tony | corrente | Stesso fallback email | Ok | nessuna |

### 2.5 Impostazioni e profilo

| file:riga | scrive/legge | per chi | cosa fa | se manca | gravità |
|-----------|--------------|---------|---------|----------|---------|
| `core/admin/impostazioni-standalone.html:451-456` | valida HTML | **tutti** i ruoli (sé stessi) | Nome * e Cognome * `required` | Non puoi salvare il form account senza riempirli | **blocca** (se vuoi restare senza nome) |
| `core/admin/impostazioni-standalone.html:912-913` | legge | sé | Precompila i campi | Campi vuoti se assenti | nessuna |
| `core/admin/impostazioni-standalone.html:1671-1677` | **scrive** | sé | `updateDoc` su `users` di `nome`, `cognome`, `telefono` | **Non** aggiorna `displayName` Auth | funzionale (Auth e Firestore possono divergere) |
| Altre pagine «profilo» dedicate | — | — | Non trovata una seconda pagina profilo oltre a Impostazioni Account | — | — |

**Risposta anticipata §4.1:** sì, il titolare può aggiungere/modificare nome e cognome da **Impostazioni → Impostazioni Account Personale**, ma oggi i campi sono obbligatori nel form HTML; e si aggiorna solo Firestore, non Auth `displayName`.

### 2.6 Gestione utenti, squadre, lavori

| file:riga | scrive/legge | per chi | cosa fa | se manca | gravità |
|-----------|--------------|---------|---------|----------|---------|
| `core/admin/gestisci-utenti-standalone.html:818` | legge | lista utenti | `nome cognome` oppure `'N/A'` | «N/A» | estetica |
| `core/admin/gestisci-utenti-standalone.html:726-727` | legge | deduplica email | Preferisce il record con nome **e** cognome | Record senza nome può perdere in un merge di duplicati | estetica / raro |
| `core/admin/gestisci-utenti-standalone.html` (salvataggio ruoli/stato ~1582+) | scrive | membro | Solo ruoli/stato — **non** nome/cognome di terzi | — | nessuna |
| Menu a tendina lavori (`gestione-lavori-controller.js:1334+`) | legge | capo/operai | nome+cognome oppure email oppure `'N/A'` | Ok | nessuna |
| Squadre / roster / impegni / sostituti | legge | operai | Pattern `[nome, cognome].filter` oppure email | Ok | nessuna |
| `core/admin/statistiche-manodopera-standalone.html:612-643` | legge | filtro operai | Se `nomeCompleto` vuoto, l’operaio **non** entra nel select | Persona senza nome sparisce dal filtro | **funzionale** |

### 2.7 Registri, documenti, export

| file:riga | scrive/legge | per chi | cosa fa | se manca | gravità |
|-----------|--------------|---------|---------|----------|---------|
| `shared/js/trattamenti-coltura-page.js:1659` | legge Auth | chi registra | `utenteRegistroNome = displayName \|\| email \|\| uid` | Con registrazione titolare (Auth senza displayName) → **email** | estetica |
| `modules/seminativo/js/trattamenti-page.js:748` | idem | idem | Idem | Idem | estetica |
| `shared/js/trattamenti-coltura-page.js:253` (`getDisplayNameForUserId`) | legge `users` | operatore su scheda | nome+cognome \|\| email \|\| id | Ok | nessuna |
| PDF/report generici | varia | — | Di solito usano i helper sopra o email | Nessun crash trovato su nome vuoto | nessuna / estetica |

### 2.8 Funzioni cloud, Stripe, regole

| file:riga | scrive/legge | per chi | cosa fa | se manca | gravità |
|-----------|--------------|---------|---------|----------|---------|
| `functions/notification-dispatch.js:416-419` | legge | notifiche | `displayNameFromUserSnap`: nome+cognome \|\| email \|\| id | Ok — **miglior ripiego già esistente** | nessuna |
| `functions/email-resend.js:180` | legge | email invito | Ciao nome cognome | «Ciao  » | estetica |
| `functions/stripe-billing.js:309` | — | checkout | Solo `customer_email` (email Auth) | Nome persona **non** inviato a Stripe | nessuna |
| `functions/stripe-webhooks.js` | — | — | Nessun uso di nome/cognome persona | — | nessuna |
| `functions/accettazione-legale.js` | — | — | Nessun uso di nome/cognome persona | — | nessuna |
| `firestore.rules:67-112` (`users`) | regole | tutti | Create/update **senza** obbligo di `nome`/`cognome` | Consentito lasciare assenti | nessuna |
| `firestore.rules:99-107` | regole | manager su terzi | Manager può aggiornare solo campi contratto, **non** nome/cognome altrui | Allinea al codice UI | nessuna |
| `firestore.rules:125-133` (`tenants` create) | regole | registrazione | Nuovo tenant solo se **non** esiste ancora `users/{uid}`, oppure già manager di quel tenant | Un utente già registrato **non** può creare una seconda azienda dalle rules | **blocca** (scenario C) |

### 2.9 Simulatore e test (solo segnalazione per passo 4)

| file:riga | nota |
|-----------|------|
| `simulator/phases/01-setup-tenant.js` (+ personas) | Seed sempre con `nome`/`cognome` e spesso `displayName` Auth |
| `simulator/manifest.json` | Persone con `displayName` pieno |
| `tests/e2e/sim/scenarios/impostazioni-read.mjs:24-30` | `expect(nome/cognome).not.toHaveValue('')` — **va aggiornato o affiancato** se il titolare può restare senza nome |
| `tests/e2e/sim/helpers/sim-login.js:1214` | Legge `#account-nome` nello scenario Impostazioni |
| Test unitari manodopera/lavori | Usano spesso `nome`/`cognome` di operai di prova — **non** regressione titolare landing |

---

## 3. Il caso multi-azienda (obbligatorio)

Premessa dal codice: **un solo** documento `users/{uid}` per email/account Auth; campi `nome` e `cognome` **globali**; per azienda si usano `tenantId` (vecchio) e `tenantMemberships` (ruolo per azienda).

### 3.1 Scenario A → B: titolare senza nome, poi invitato come operaio

**Oggi (con nome obbligatorio):** A ha già nome; B lo invita; se A esiste già, `acceptInvito` aggiunge solo la membership (`invito-service-standalone.js:243-245`) e **non** riscrive nome/cognome. B vede A con il nome già presente su `users`.

**Dopo il passo 4 (A senza nome):**

1. A si registra dalla landing senza nome → `users` con `nome`/`cognome` vuoti o assenti; Auth `displayName` già vuoto.
2. B invita A compilando Nome/Cognome obbligatori sul form invito → quei valori restano sull’**invito** e nell’email («Ciao Mario Rossi»), **non** sul documento `users` di A (`invito-service-standalone.js:243-245`).
3. Quando A accetta: solo `tenantMemberships` aggiornato; **documento lasciato vuoto** (né completato né sovrascritto).
4. Come lo vede B negli elenchi: dipendenze da pagina — spesso email, oppure `'N/A'` (`gestisci-utenti-standalone.html:818`), raramente vuoto.
5. Come lo vede A nella propria azienda: stessa cosa (email in dashboard; Impostazioni con campi vuoti ma `required` se prova a salvare altro).

**Conclusione:** l’invito di B **non** riempie il nome condiviso. La regola «obbligatori per operai» sul form invito **non** garantisce che l’operaio abbia nome su `users` se l’account esisteva già senza nome.

### 3.2 Scenario C: operaio in D vuole aprire la propria azienda

**Oggi può farlo con la stessa email?** **No.**

- La registrazione titolare chiama sempre `createUserWithEmailAndPassword` (`registrazione-standalone.html:623`) → Firebase risponde `email-already-in-use` (`:830-836`).
- Il testo in pagina dice di usare il link invito se invitati (`:211`).
- Anche se si aggirasse Auth: `firestore.rules:125-133` consente `tenants` create per un uid solo se **non** esiste ancora `users/{uid}`.
- Non esiste UI «crea nuova azienda» per utente già loggato (`createTenant` in `tenant-service.js` è helper senza flusso prodotto).

**Se un giorno si aprisse quel flusso:** nome e cognome resterebbero quelli messi da D (documento condiviso), finché C non li cambia da Impostazioni.

### 3.3 Titolare senza nome aggiunto come membro/caposquadra

Le pagine di invito **richiedono** nome e cognome (`gestisci-utenti-standalone.html:387-392`). L’invito si crea. All’accettazione, se l’utente esiste già, **non** si scrive nome su `users` (vedi 3.1). Non c’è rifiuto per «titolare senza nome»: si invita lo stesso; il documento resta incompleto.

Modifica nome di terzi da gestisci-utenti / manodopera: **non prevista** (né UI né rules per nome).

### 3.4 Un’azienda modifica nome/cognome di un operaio che è titolare altrove

**Oggi non può:** manager aggiorna solo campi contratto (`firestore.rules:99-107`). Solo la persona stessa da Impostazioni (`impostazioni-standalone.html:1671-1677`).

Se quella persona salva un nuovo nome, **cambia ovunque** (tutte le aziende che leggono `users/{uid}`).

### 3.5 Nome condiviso = problema per la decisione?

**Sì, è il nodo principale.** Opzioni possibili (senza sceglierne una):

1. **Lasciare nome globale** e, quando si invita un utente già esistente senza nome, **proporre di scrivere** nome/cognome su `users` (con consenso / solo se vuoti).
2. **Nome per membership** (es. `tenantMemberships[tenantId].nomeVisualizzato`) e lasciare `users.nome` per il «profilo personale» — più lavoro, più chiaro tra aziende.
3. **Obbligare il titolare a mettere nome prima** di poter essere invitato altrove come operaio.
4. **Flusso dedicato** «operaio → apre azienda propria» (stesso Auth, nuovo tenant + membership admin) — oggi assente e bloccato dalle rules.

---

## 4. Risposte alle due domande del brief

### 4.1 Il titolare può aggiungere o modificare nome e cognome dopo?

**Sì**, da `core/admin/impostazioni-standalone.html`:

- Form: `:451-456` (campi obbligatori HTML).
- Caricamento: `:912-913`.
- Salvataggio: `:1671-1677` → aggiorna `users/{uid}` (`nome`, `cognome`, `telefono`).
- **Non** aggiorna `displayName` di Firebase Auth (a differenza di `auth-service.js:updateUserProfile:337-339`).

Se in passo 4 vuoi permettere di restare senza nome, andrebbe rivisto il `required` di Impostazioni (altrimenti il titolare è «forzato» a inserirli al primo salvataggio account). Non fatto in questo report.

### 4.2 Chi apre `registrazione-standalone.html`?

| Provenienza | file:riga |
|-------------|-----------|
| Landing (CTA registrazione) | `landing/src/config/landing-config.js:97`, link in `LandingHome.vue` |
| Login («non hai account?») | `core/auth/login-standalone.html:378` |
| Dashboard se Auth ok ma manca documento `users` (recupero / registrazione incompleta) | `core/dashboard-standalone.html:1424, 1437` |
| Abbonamento se profilo utente non trovato | `core/admin/abbonamento-standalone.html:1045` |
| Tony ingresso login (solo elenco URL note, non un link utente) | `core/js/tony/tony-ingresso-login.js:84` |

**Non** è la pagina degli invitati: quelli usano `registrazione-invito-standalone.html`.

Quindi la stessa pagina serve al titolare nuovo **e** a rientri di emergenza / link generici: **non** è «solo landing».

---

## 5. Come riconoscere «registrazione dalla landing»

Oggi: stesso URL senza segno (`URL_REGISTRAZIONE` → `registrazione-standalone.html`).

Proposte (pro / contro / sicurezza) — **decidi tu**:

### Opzione A — Parametro nell’indirizzo (es. `?da=landing` o `?origine=tony-bussa`)

- **Pro:** poco codice; la landing cambia solo il link; login resta con campi obbligatori.
- **Contro:** chiunque può scrivere a mano `?da=landing` e registrarsi senza nome.
- **Sicurezza:** il parametro **non** è un segreto. Accettabile se «titolare senza nome» è un rischio basso (azienda già identificata dal nome azienda + email). Non basta se un giorno volessi nome obbligatorio per «ogni» titolare tranne un canale firmato.

### Opzione B — Pagina a parte (es. `registrazione-titolare-landing-standalone.html`)

- **Pro:** separazione chiara; meno rischio di ammorbidire per sbaglio altri flussi (dashboard recovery, login).
- **Contro:** duplicazione o condivisione di molto JS; due URL da mantenere; link vecchi.
- **Sicurezza:** l’URL nuovo è comunque pubblico; stessa considerazione del parametro, ma più difficile «inciampare» dal login.

### Opzione C — Facoltativi per **ogni** nuovo titolare (qualsiasi ingresso a `registrazione-standalone.html`)

- **Pro:** semplice; niente flag URL; allinea landing, login e recovery.
- **Contro:** anche chi arriva dal login può creare azienda senza nome; meno fedele al brief «solo dalla landing».
- **Sicurezza:** niente da falsificare; scelta di prodotto.

*(Opzione ibrida possibile: parametro + stessa regola C in futuro quando Tony in chat farà la registrazione.)*

---

## 6. Ripieghi proposti dal brief, verificati sul codice

| Ripiego brief | Funziona oggi? | Dove metterlo | Casi in cui non basta |
|---------------|----------------|---------------|------------------------|
| Su `users`: assenti/`null`, mai stringhe inventate | Sì a livello rules; oggi la registrazione scrive stringhe da input. `signUp` usa `\|\| ''` (stringa vuota). | Scrivere in registrazione solo se valorizzati; evitare `nome: ''` se preferisci «campo assente» | Codice che fa `nome.trim()` **senza** guardia su null (`User.js:75-80` se mai collegato; oggi le pagine usano `(u.nome \|\| '').trim()` → sicuro con null) |
| Mostra: nome+cognome → nome azienda → parte email prima di `@` | **Parziale.** Quasi ovunque: nome+cognome → **email intera** (non pezzo prima di `@`, non nome azienda). Esempio buono: `notification-dispatch.js:416-419`. Dashboard: `:1552-1553`. | Ideale: **una funzione comune** (oggi non esiste un helper unico lato client; il più vicino è `displayNameFromUserSnap` lato functions). Andrebbe creata es. in `core/js/` e riusata | **Multi-azienda:** il «nome azienda» dipende dal tenant aperto (`tenants/{tenantId}.nome`), non dal solo `users.tenantId` se ci sono più membership. Partire da `tenantId` corrente / membership attiva |
| Email e Tony: «Ciao!» senza nome | Tony welcome **già** «Ciao!» senza nome persona (`tony/main.js:7134`). Email invito usa nome (`email-resend.js:180`) — ma è email **all’invitato**, non al titolare | Per email al titolare: ramo dedicato se nome assente. Per Tony: già ok; evitare di passare l’email come `utente_corrente.nome` se si vuole saluto neutro | Se il contesto Tony riceve l’email come nome (`dashboard-standalone.html:1187`), eventuali frasi future «Ciao {nome}» userebbero l’email |
| `displayName` Auth vuoto | **Già così** in registrazione titolare (non chiama `updateProfile`) | Non impostarlo in passo 4 se manca nome | Registri trattamenti usano `displayName \|\| email` → email (ok). Se Impostazioni o `updateUserProfile` riempiono Auth dopo, Auth e Firestore possono divergere |
| Altri utenti: nessun ripiego speciale | Coerente: inviti restano obbligatori; operai in liste usano già email/`N/A` | Non toccare form invito / manodopera | Scenario A: invito obbligatorio **non** scrive su `users` esistente → ripiego email sì, ma non «nome da invito» |

---

## 7. Piano proposto per il passo 4 (solo proposta, niente codice)

### 7.1 File **necessari**

| File | Motivo |
|------|--------|
| `core/auth/registrazione-standalone.html` | Togliere obbligo HTML/JS di nome/cognome **solo** quando riconoscimento landing (o secondo opzione C); scrivere su `users` solo se presenti; tenere obbligatorio nome azienda |
| `landing/src/config/landing-config.js` (+ eventuale `LandingHome.vue`) | Se opzione A/B: link con parametro o URL dedicato |
| Test nuovo (vedi 7.4) | Registrazione titolare senza nome riuscita |

### 7.2 File **consigliati**

| File | Motivo |
|------|--------|
| `core/admin/impostazioni-standalone.html` | Allineare `required` / messaggi se il titolare può restare senza nome; opzionale sync `displayName` Auth |
| Helper comune display (nuovo piccolo modulo o riuso pattern `notification-dispatch`) | Un solo ordine: nome → azienda corrente → local-part email |
| `core/dashboard-standalone.html` (e pochi header) | Usare l’helper invece di passare l’email cruda a Tony come «nome» |
| `tests/e2e/sim/scenarios/impostazioni-read.mjs` | Non fallire se campi vuoti ammessi |
| Documentazione flag (se serve) | Vedi 7.5 |

### 7.3 File da **non toccare** (per questo obiettivo)

- Form e flussi **operai / caposquadra / membri invitati / squadre** (obblighi nome restano).
- `core/auth/registrazione-invito-standalone.html`, `invito-service-standalone.js` (salvo decisione esplicita sullo scenario A «completare nome se vuoto»).
- `core/models/User.js` se resta inutilizzato; se lo si collega, separare validazione «titolare» vs «operaio».
- `firestore.rules` (già non obbligano nome).
- Tony core / `functions/index.js` / parser lavori (sola lettura in questo passo; cambiamenti solo se Pier decide saluti/contesto).
- Stripe, accettazione legale (non dipendono dal nome persona).

### 7.4 Test da scrivere

1. **Registrazione titolare dalla landing senza nome e cognome riuscita** (azienda obbligatoria; documento `users` senza inventare stringhe).
2. Per ogni punto §2 con gravità **funzionale** o **blocca** reso tollerante: smoke (dashboard header, Impostazioni se ammesso vuoto, lista utenti mostra email/N/A).
3. **Non regressione:** creare invito operaio/membro **senza** nome o cognome deve essere ancora rifiutato; `registrazione-invito` resta con nome da invito.
4. (Se si implementa) parametro landing non altera l’invito.

### 7.5 Flag

Se vuoi spegnere tutto da remoto senza deploy codice:

- Esempio: `NOME_TITOLARE_FACOLTATIVO_ATTIVO = false` in un config già usato dalla registrazione (stesso stile dei flag landing/accettazione), oppure Remote Config.
- Prova: flag off → comportamento attuale; flag on + URL landing → campi facoltativi.
- **Non** mescolare con `moduliAttivi` / gate Tony.

### 7.6 Stima e rischi

| Voce | Stima |
|------|--------|
| Solo facoltativi in registrazione + link landing + test base | **½–1** mezza giornata |
| + helper display + Impostazioni + E2E + gestione invito utente esistente senza nome | **1–2** mezze giornate |
| + flusso «operaio apre azienda propria» + rules | **oltre** questo passo (progetto a sé) |

**Rischi:** parametro URL falsificabile; multi-azienda lascia operai «senza nome» in elenco; Impostazioni `required` riconverte in obbligo; Auth `displayName` vs Firestore; Tony che riconosce persone solo per nome.

---

## 8. Domande aperte per Pier

1. **Come distinguere la registrazione dalla landing?** (parametro URL / pagina dedicata / facoltativi per tutti i titolari)  
   *Raccomandazione:* parametro URL (`?da=landing`) se vuoi partire subito; oppure facoltativi per tutti i titolari se ti va bene anche dal link «Registrati» del login. Perché: meno file, e il rischio «parametro scritto a mano» è basso per un titolare che crea comunque un’azienda con email sua.

2. **Cosa fare quando un titolare senza nome viene invitato come operaio?** (lasciare email in elenco / copiare nome dall’invito su `users` solo se vuoto / obbligare a completare il profilo)  
   *Raccomandazione:* se `users.nome` è vuoto all’accettazione invito, **scrivere nome/cognome dall’invito** (solo campi vuoti, non sovrascrivere). Perché: altrimenti la regola «operai con nome» è solo sul form, non sui dati reali.

3. **Il titolare può restare per sempre senza nome, o deve completarlo in Impostazioni?**  
   *Raccomandazione:* permettere di restare senza nome, ma in Impostazioni togliere l’obbligo HTML e mostrare un suggerimento. Perché: altrimenti il passo 4 è vanificato al primo salvataggio account.

4. **Ripiego di visualizzazione: va bene email intera (come oggi) o vuoi pezzo prima di `@` + nome azienda?**  
   *Raccomandazione:* introdurre un helper unico con ordine brief (nome → azienda corrente → local-part email), riusando lo spirito di `displayNameFromUserSnap`. Perché: oggi l’email intera funziona già; il pezzo locale è più leggibile nelle intestazioni.

5. **Serve un flusso «sono già operaio, voglio la mia azienda» con la stessa email?**  
   *Raccomandazione:* **non** nel passo 4; metterlo in backlog. Perché: richiede rules + UI + prodotto multi-tenant; oggi è volutamente bloccato.

6. **Nome per azienda (membership) vs nome globale su `users`?**  
   *Raccomandazione:* a breve restare sul globale + regola «completa se vuoto in invito»; valutare nome-per-tenant solo se ti capita spesso la stessa persona con nomi diversi. Perché: cambio modello pesante.

7. **Flag `NOME_TITOLARE_FACOLTATIVO_ATTIVO` spento di default?**  
   *Raccomandazione:* sì, come gli altri flag landing. Perché: puoi provare su develop/feature senza cambiare il comportamento pubblico finché non lo accendi.

8. **Aggiornare anche `displayName` Auth quando il titolare salva il nome in Impostazioni?**  
   *Raccomandazione:* sì, allineare a `updateUserProfile`. Perché: i registri trattamenti leggono Auth `displayName` prima dell’email.

---

*Fine report passo 3. Nessuna modifica a codice applicativo in questo branch oltre a questo documento e alla riga in `docs-sviluppo/in-sviluppo/README.md`.*
