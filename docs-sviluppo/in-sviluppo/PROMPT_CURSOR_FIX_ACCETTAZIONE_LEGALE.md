# Fix accettazione legale: getInvitoPubblico senza dati superflui, registrazione senza rollback, gate bloccante, accettazioni per azienda

Repo: VitaraDragon/gfv-platform (ERP agricolo, Firebase + JS). Lavori sul PC Windows, in PowerShell, in una **chat NUOVA di Cursor**. Il prompt è completo: la patch da applicare è qui sotto, per intero. Base: `origin/develop` = `38dde025fc2f1be7084f41329e37001b9533cd29` (#279). Le righe citate si riferiscono a quella base; per questi file `origin/main` (`b1c359d2`) è identico.

## Perché

Accettazione legale introdotta con #190–#195 (flag `ACCETTAZIONE_LEGALE_ATTIVA` spento, `core/config/accettazione-legale-config.js:7`). Due problemi aperti, più alcuni difetti trovati verificando il codice:

1. **`getInvitoPubblico` espone dati non necessari.** La callable pubblica (senza login, `functions/index.js:4459-4476`) restituisce `cellulare` (`functions/invito-pubblico.js:75`), oltre a `token` (`:73`) e `stato` (`:69`). Chiunque abbia il link vede il numero inserito dal manager. Il client usa `cellulare` solo per il prefill (`registrazione-invito-standalone.html:581-582`); il campo resta obbligatorio e lo digita l'invitato. `token` il client lo ha già dall'URL (`:498`, `:735`); `stato` non viene mai letto (è sempre `invitato`, `invito-pubblico.js:128`).
2. **Registrazione che fallisce a metà.** In tutti i percorsi la callable `registraAccettazioniLegali` parte DOPO la creazione di account e membership:
   - invito: `acceptInvito` crea Auth, `users` con membership e mette l'invito ad `accettato` (`invito-service-standalone.js:287`, `:392`, `:395`). Poi la callable (`registrazione-invito-standalone.html:829`, `:851`, `:933`).
   - landing: `createUser` (`registrazione-standalone.html:646`), tenant (`:682`), users (`:716-726`). Poi la callable (`:781-792`).

   Se la callable fallisce, la pagina mostra un errore e non fa il redirect (invito `:862-990`, landing `:810-879`). L'account resta, l'invito è già consumato (un nuovo tentativo dà «Token invalido o già utilizzato», `invito-pubblico.js:128`), la landing non pulisce (`:818`, cleanup solo se `!userDocCreated`).
3. **Il gate di ingresso lascia entrare se fallisce.** Dashboard `dashboard-standalone.html:427-429` e field workspace `field-workspace-standalone.html:306-308` fanno solo `console.warn`. Inoltre il field workspace carica il controller in parallelo al gate (`:310`).
4. **Accettazioni non per azienda.** L'id della riga è `uid_tipo_versione` (`functions/lib/accettazione-legale-core.js:107-109`) e lo `stato` legge tutte le righe dell'uid (`functions/accettazione-legale.js:45-55`). Un utente esistente che entra in una seconda azienda con la stessa versione riceve `already-exists`, scartato in silenzio (`:93`): per la nuova azienda non c'è prova e il gate non la chiede.
5. **Bug trovato nel fallback email-già-in-uso dell'invito.** `password` è dichiarata dentro il `try` (`:713`) e letta nel `catch` (`:869`, `:877`): è una ReferenceError, quindi il secondo fallback non funzionava.

**Correzione (opzione B del report):**
- **functions/invito-pubblico.js**: allowlist esatta `id, email, nome, cognome, ruoli, scadeIl, isExistingUser, tenantId, inviatoDa, aziendaNome` (tolti `cellulare`, `token`, `stato`).
- **Client invito**: il token viene preso dall'URL (`token`, non `inviteData.token`); niente prefill del cellulare (campo vuoto, obbligatorio come prima). `verifyInviteToken` e `acceptInvito` non usano i campi tolti (verificato).
- **Nuovo helper `core/js/accettazione-legale-registrazione.js`**:
  - `registraAccettazioneDopoAccount({ attiva, registra })` non lancia mai. Restituisce `saltata` (flag spento, callable mai chiamata), `registrata` oppure `rimandata`.
  - `messaggioFineRegistrazione` mostra «Account creato. Conferma le condizioni al primo accesso.».
  - È usato in tutti i percorsi: nuovo utente, utente esistente, entrambi i fallback email-già-in-uso (3 punti di chiamata nella pagina invito; il primo fallback confluisce nel ramo «nuova membership») e la landing.
  - Se fallisce solo la callable, non c'è rollback né `deleteUser`: messaggio e redirect normale, poi il gate chiede l'accettazione.
- **Gate (`core/js/accettazione-legale-gate.js`)**, solo a flag acceso:
  - `eseguiGate` con `mostraErrore`: se `leggiStato` fallisce, overlay bloccante con **Riprova** (rilegge) ed **Esci** (logout e login); senza `mostraErrore` l'errore viene rilanciato.
  - `avviaDaFirebase` ripete finché non riesce, senza mai entrare.
  - Tenant e ruoli sono quelli dell'azienda corrente (`risolviTenantERuoli`: contesto della pagina, poi `getCurrentTenantId` verificato sulla membership, poi legacy).
  - Dashboard: se con flag acceso i moduli del gate non si caricano, ingresso bloccato con Riprova (ricarica).
  - Field workspace: il controller viene importato **solo dopo** il gate (`await import('./js/field-workspace-controller.js?v=2026-10-21b')`); a flag spento parte subito come prima.
- **Accettazioni per azienda** (functions):
  - `idAccettazione(uid, tenantId, tipo, versione)` → `uid_tenantId_tipo_versione`, per **entrambi i canali**. Per la landing il `tenantId` c'è: è quello appena creato, verificato con `tenant.creatoDa === uid`; il DPA è per azienda.
  - `stato` richiede `tenantId`, verifica la membership (`permission-denied` se non appartieni) e filtra le righe per tenant in memoria (nessun indice nuovo).
  - `already-exists` = stessa azienda, stesso documento e versione: viene ignorato, idempotente, non sovrascrive la prova. `tenantId` con `/` viene rifiutato.
  - Nessuna migrazione: con il flag spento la collezione è vuota.
- **Fix ReferenceError**: nel secondo fallback `password` viene riletta da `passwordInput.value`.
- `ACCETTAZIONE_LEGALE_ATTIVA` resta `false`. Nessuna modifica a `firestore.rules` (la collezione `accettazioniLegali` resta solo Admin) né a `tony/**`.

## Divieti

- NON toccare `core/js/tony/**`, `core/js/gfv-tony-loader.js`, `firestore.rules`, `core/config/accettazione-legale-config.js` (il flag resta `false`).
- NON fare **deploy** di nessun tipo (`firebase deploy` compreso). Le functions le pubblica Pier a mano, dopo il merge su main (vedi in fondo).
- NON scrivere su Firestore, niente script una tantum.
- NON modificare a mano `SW_CACHE_BUILD_ID` in `service-worker.js` (vedi passo 5).
- NON lanciare la suite vitest intera (avvia gli emulatori) e NON aprire porte 8183/8080/9099.
- NON fare merge della PR e NON fare checkout di `main` in questa cartella.
- Ignora i file non tracciati che c'erano già: non aggiungerli e non cancellarli.

## File toccati dalla patch (numstat)

| File | + / − | Cosa |
|---|---|---|
| `functions/invito-pubblico.js` | +2/−3 | allowlist senza cellulare, token, stato |
| `functions/lib/accettazione-legale-core.js` | +17/−4 | id con tenantId; `stato` richiede tenantId; tenantId senza `/` |
| `functions/accettazione-legale.js` | +14/−8 | `stato` per tenant con verifica membership; righe per tenant |
| `core/js/accettazione-legale-registrazione.js` | +47 (nuovo) | helper: accettazione dopo l'account, mai rollback |
| `core/js/accettazione-legale-gate.js` | +124/−6 | Riprova/Esci se lo stato non si legge; tenant corrente; `risolviTenantERuoli` |
| `core/auth/registrazione-invito-standalone.html` | +21/−12 | helper su 3 punti, token dall'URL, niente prefill cellulare, fix ReferenceError `password` |
| `core/auth/registrazione-standalone.html` | +19/−13 | helper per la callable della landing |
| `core/dashboard-standalone.html` | +30/−1 | flag acceso: errore di caricamento → ingresso bloccato |
| `core/mobile/field-workspace-standalone.html` | +30/−2 | controller importato dopo il gate; flag acceso: blocco se il gate non si carica |
| `tests/accettazione-legale-registrazione.test.js` | +104 (nuovo) | 7 test |
| `tests/accettazione-legale-gate.test.js` | +124/−1 | 13 test (9 nuovi) |
| `tests/accettazione-legale-functions.test.js` | +91/−3 | 13 test (7 nuovi, id con tenant) |
| `tests/services/invito-pubblico.test.js` | +11/−7 | allowlist esatta senza cellulare/token/stato |
| `tests/moduli-identificatori-definiti.test.js` | +5 | nuovi moduli e pagine in lista |

Totale: 14 file, +638/−60. Patch: `fix-accettazione-legale.diff`, sha256 `9f7227b229a344158ba9ba37032858b53407f66c7c5d00ca3346e24a5c0ae748`.

## Passi (PowerShell, un comando per riga)

### 1. Partire da develop aggiornato

```powershell
git status --short
git fetch origin
git rev-parse origin/develop
git checkout -b fix/accettazione-legale origin/develop
git rev-parse HEAD
```

Entrambi i `rev-parse` devono stampare `38dde025fc2f1be7084f41329e37001b9533cd29`. Se `origin/develop` è diverso, vai avanti solo se `git apply --check` (passo 2) passa; altrimenti fermati e riportami lo sha. Se `git status --short` mostra modifiche tracciate, fermati e chiedimi. Se il branch `fix/accettazione-legale` esiste già, fermati e chiedimi.

### 2. Salvare la patch e applicarla

Crea nella radice del repo il file `fix-accettazione-legale.diff` con il contenuto ESATTO del blocco qui sotto, dalla riga `diff --git` all'ultima riga prima della chiusura del blocco. Usa il tuo strumento di scrittura file, non `Set-Content` o `Out-File`. Il file va in UTF-8 senza BOM, con fine riga LF e con un a capo finale. Non riformattarlo.

Verifica l'impronta prima di applicare:

```powershell
(Get-FileHash fix-accettazione-legale.diff -Algorithm SHA256).Hash.ToLower()
```

Deve stampare `9f7227b229a344158ba9ba37032858b53407f66c7c5d00ca3346e24a5c0ae748`. Se è diversa, il file salvato non è identico: correggilo e non andare avanti.

````diff
diff --git a/core/auth/registrazione-invito-standalone.html b/core/auth/registrazione-invito-standalone.html
index c4a516d4..cf5dbf82 100644
--- a/core/auth/registrazione-invito-standalone.html
+++ b/core/auth/registrazione-invito-standalone.html
@@ -395,6 +395,7 @@
         import { onAuthStateChanged, signOut } from '../services/firebase-service.js';
         import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
         import { fetchInvitoByToken } from '../services/invito-service-standalone.js';
+        import { registraAccettazioneDopoAccount, messaggioFineRegistrazione } from '../js/accettazione-legale-registrazione.js';
 
         const app = getAppInstance();
         const auth = getAuthInstance();
@@ -477,6 +478,15 @@
             await registra(Object.assign({ azione: 'registra' }, payload));
         }
 
+        // Account e membership esistono già: se fallisce solo la presa visione non si annulla nulla,
+        // si prosegue e il gate di ingresso la richiede al primo accesso. Flag spento: nessuna chiamata.
+        function completaPresaVisione() {
+            return registraAccettazioneDopoAccount({
+                attiva: accettazioneLegaleAttiva,
+                registra: registraPresaVisioneSeAttiva
+            });
+        }
+
         try {
             const configLegale = await import('../config/accettazione-legale-config.js');
             if (configLegale.ACCETTAZIONE_LEGALE_ATTIVA === true) {
@@ -577,11 +587,8 @@
                 emailInput.value = inviteData.email;
                 nomeInput.value = inviteData.nome;
                 cognomeInput.value = inviteData.cognome;
-                // Pre-compila cellulare se presente nell'invito, altrimenti lascia vuoto (sarà obbligatorio)
-                if (inviteData.cellulare) {
-                    cellulareInput.value = inviteData.cellulare;
-                } else {
-                    // Assicurati che il campo sia vuoto se non presente nell'invito
+                // Il cellulare non arriva dall'invito (dato non esposto dalla callable): lo digita l'invitato, campo obbligatorio.
+                if (cellulareInput) {
                     cellulareInput.value = '';
                 }
                 
@@ -732,7 +739,7 @@
                         where,
                         getDocs,
                         serverTimestamp,
-                        inviteData.token || (new URLSearchParams(window.location.search).get('token')),
+                        token,
                         password
                     );
                 } catch (acceptError) {
@@ -826,9 +833,9 @@
                         });
                     }
                     
-                    await registraPresaVisioneSeAttiva();
+                    const esitoLegale = await completaPresaVisione();
                     hideLoading();
-                    successMessage.textContent = `✅ Aggiunto a ${userData._newTenantId || 'nuova azienda'} con successo! Reindirizzamento alla dashboard...`;
+                    successMessage.textContent = messaggioFineRegistrazione(esitoLegale, `✅ Aggiunto a ${userData._newTenantId || 'nuova azienda'} con successo! Reindirizzamento alla dashboard...`);
                     successMessage.classList.add('show');
                     
                     // Redirect a dashboard
@@ -848,9 +855,9 @@
                     sessionStorage.setItem('gfv_user_just_registered', 'true');
                     sessionStorage.setItem('gfv_registered_user_id', auth.currentUser.uid);
                     
-                    await registraPresaVisioneSeAttiva();
+                    const esitoLegale = await completaPresaVisione();
                     hideLoading();
-                    successMessage.textContent = '✅ Registrazione completata con successo! Reindirizzamento alla dashboard...';
+                    successMessage.textContent = messaggioFineRegistrazione(esitoLegale, '✅ Registrazione completata con successo! Reindirizzamento alla dashboard...');
                     successMessage.classList.add('show');
                     
                     // Redirect a dashboard (l'utente è già loggato)
@@ -866,6 +873,8 @@
                     (String(error).includes('email-already-in-use'));
                 
                 if (isEmailAlreadyInUse) {
+                    // `password` del try non è visibile nel catch: va riletta qui (prima era una ReferenceError).
+                    const password = passwordInput.value;
                     if (!password) {
                         hideLoading();
                         showError('Password richiesta. Questa email è già registrata. Inserisci la password del tuo account esistente.');
@@ -930,9 +939,9 @@
                             });
                         }
                         
-                        await registraPresaVisioneSeAttiva();
+                        const esitoLegale = await completaPresaVisione();
                         hideLoading();
-                        successMessage.textContent = `✅ Aggiunto a ${invito.tenantId || 'nuova azienda'} con successo! Reindirizzamento alla dashboard...`;
+                        successMessage.textContent = messaggioFineRegistrazione(esitoLegale, `✅ Aggiunto a ${invito.tenantId || 'nuova azienda'} con successo! Reindirizzamento alla dashboard...`);
                         successMessage.classList.add('show');
                         
                         // Redirect a dashboard
diff --git a/core/auth/registrazione-standalone.html b/core/auth/registrazione-standalone.html
index 71b1cb5e..14b9ecb8 100644
--- a/core/auth/registrazione-standalone.html
+++ b/core/auth/registrazione-standalone.html
@@ -327,6 +327,7 @@
         import { onAuthStateChanged } from '../services/firebase-service.js';
         import { createUserWithEmailAndPassword, deleteUser } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
         import { computeTonyGuidaOnboardingEndsAt } from '../config/tony-guida-onboarding.js';
+        import { registraAccettazioneDopoAccount, messaggioFineRegistrazione } from '../js/accettazione-legale-registrazione.js';
         import { NOME_TITOLARE_FACOLTATIVO_ATTIVO } from '../config/nome-titolare-config.js';
         import {
             isDaLanding,
@@ -778,21 +779,26 @@ ruoliSalvati = savedData2.ruoli;
                     throw new Error('Impossibile salvare il tenantId. Controlla la console per dettagli.');
                 }
 
-                if (accettazioneLegaleAttiva) {
-                    const moduloLegale = await import('../services/accettazione-legale.js');
-                    const payloadLegale = moduloLegale.costruisciPayloadAccettazione({
-                        canale: 'registrazione',
-                        tenantId: tenantId,
-                        ruolo: 'amministratore',
-                        documenti: ['termini-b2b', 'privacy', 'dpa'],
-                        config: accettazioneConfig
-                    });
-                    const registraAccettazioni = getHttpsCallable('registraAccettazioniLegali');
-                    await registraAccettazioni(Object.assign({ azione: 'registra' }, payloadLegale));
-                }
+                // Tenant e utente esistono già: se fallisce solo l'accettazione non si annulla nulla
+                // (niente deleteUser), si prosegue e il gate di ingresso la richiede al primo accesso.
+                const esitoLegale = await registraAccettazioneDopoAccount({
+                    attiva: accettazioneLegaleAttiva,
+                    registra: async () => {
+                        const moduloLegale = await import('../services/accettazione-legale.js');
+                        const payloadLegale = moduloLegale.costruisciPayloadAccettazione({
+                            canale: 'registrazione',
+                            tenantId: tenantId,
+                            ruolo: 'amministratore',
+                            documenti: ['termini-b2b', 'privacy', 'dpa'],
+                            config: accettazioneConfig
+                        });
+                        const registraAccettazioni = getHttpsCallable('registraAccettazioniLegali');
+                        await registraAccettazioni(Object.assign({ azione: 'registra' }, payloadLegale));
+                    }
+                });
 
 // Successo!
-                showSuccess('✅ Account creato con successo! Reindirizzamento alla dashboard...');
+                showSuccess(messaggioFineRegistrazione(esitoLegale, '✅ Account creato con successo! Reindirizzamento alla dashboard...'));
                 
                 // Salva flag che l'utente si è appena registrato
                 sessionStorage.setItem('gfv_user_just_registered', 'true');
diff --git a/core/dashboard-standalone.html b/core/dashboard-standalone.html
index 040b57e8..375a9e4b 100644
--- a/core/dashboard-standalone.html
+++ b/core/dashboard-standalone.html
@@ -409,15 +409,18 @@
         }
 
         async function attendiAccettazioneLegaleSeServe(userData, aziendaNome) {
+            let flagAcceso = false;
             try {
                 const config = await import('./config/accettazione-legale-config.js');
                 if (config.ACCETTAZIONE_LEGALE_ATTIVA !== true) return;
+                flagAcceso = true;
                 const legale = await import('./services/accettazione-legale.js');
                 if (!legale.validaConfigLegale(config, true).ok) {
                     console.warn('[accettazione-legale] config non valida, ingresso invariato');
                     return;
                 }
                 const gate = await import('./js/accettazione-legale-gate.js');
+                // Con il flag acceso il gate non lascia entrare se non riesce a leggere lo stato (Riprova / Esci).
                 await gate.avviaDaFirebase({
                     ruoli: (userData && userData.ruoli) || [],
                     tenantId: userData && userData.tenantId,
@@ -425,10 +428,36 @@
                     config: config
                 });
             } catch (error) {
-                console.warn('[accettazione-legale] ingresso invariato');
+                if (!flagAcceso) {
+                    console.warn('[accettazione-legale] ingresso invariato');
+                    return;
+                }
+                // Flag acceso ma moduli del gate non caricati: ingresso bloccato, si ricarica la pagina.
+                console.warn('[accettazione-legale] gate non caricato, ingresso bloccato');
+                bloccaIngressoLegale();
+                await new Promise(() => {});
             }
         }
 
+        function bloccaIngressoLegale() {
+            const fondo = document.createElement('div');
+            fondo.id = 'accettazione-legale-gate-errore';
+            fondo.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
+            const pannello = document.createElement('div');
+            pannello.style.cssText = 'background:#fff;border-radius:12px;max-width:520px;width:100%;padding:24px;font:16px/1.4 system-ui,sans-serif;color:#1a1a1a;';
+            const testo = document.createElement('p');
+            testo.textContent = 'Non riesco a verificare le condizioni di uso. Controlla la connessione e riprova.';
+            const btn = document.createElement('button');
+            btn.type = 'button';
+            btn.textContent = 'Riprova';
+            btn.style.cssText = 'margin-top:8px;padding:12px 16px;background:#2E8B57;color:#fff;border:0;border-radius:8px;';
+            btn.addEventListener('click', () => window.location.reload());
+            pannello.appendChild(testo);
+            pannello.appendChild(btn);
+            fondo.appendChild(pannello);
+            document.body.appendChild(fondo);
+        }
+
         function applicaIngressoDopoLogin(userData, availableModules) {
             if (window.__gfvRedirectWorkspaceDeciso) {
                 return window.__gfvIngressoScelta || 'dashboard';
diff --git a/core/js/accettazione-legale-gate.js b/core/js/accettazione-legale-gate.js
index 9e77ef34..c9bf21cd 100644
--- a/core/js/accettazione-legale-gate.js
+++ b/core/js/accettazione-legale-gate.js
@@ -1,6 +1,8 @@
 /**
  * Ri-accettazione al primo ingresso. Con il flag spento non chiama la rete e non disegna nulla.
  * Le pagine importano questo file solo se il flag è acceso.
+ * Flag acceso: se lo stato non si legge, l'ingresso resta bloccato (Riprova / Esci), mai fail-open.
+ * Lo stato e la registrazione sono per l'azienda corrente.
  */
 import {
   documentiRichiestiPerRuolo,
@@ -45,14 +47,25 @@ export function pianoGate(input) {
 }
 
 /**
- * @param {{ attiva?: boolean, configOk?: boolean, ruoli?: string[], config?: object, leggiStato?: () => Promise<Array<{tipo?: string, versione?: string}>>, mostra?: (piano: object) => Promise<void> }} opts
+ * Se `leggiStato` lancia: con `mostraErrore` aspetta il "Riprova" e rilegge, senza mai lasciar entrare;
+ * senza `mostraErrore` rilancia (chi chiama deve bloccare).
+ * @param {{ attiva?: boolean, configOk?: boolean, ruoli?: string[], config?: object, leggiStato?: () => Promise<Array<{tipo?: string, versione?: string}>>, mostra?: (piano: object) => Promise<void>, mostraErrore?: (err: unknown) => Promise<void> }} opts
  */
 export async function eseguiGate(opts) {
   const prima = pianoGate(Object.assign({}, opts, { accettazioni: [] }));
   if (!prima.chiamare || typeof opts.leggiStato !== 'function') {
     return { mostrato: false };
   }
-  const accettazioni = await opts.leggiStato();
+  let accettazioni;
+  for (;;) {
+    try {
+      accettazioni = await opts.leggiStato();
+      break;
+    } catch (err) {
+      if (typeof opts.mostraErrore !== 'function') throw err;
+      await opts.mostraErrore(err);
+    }
+  }
   const dopo = pianoGate(Object.assign({}, opts, { accettazioni: accettazioni || [] }));
   if (!dopo.mostra || typeof opts.mostra !== 'function') {
     return { mostrato: false };
@@ -190,9 +203,98 @@ function mostraOverlay(opts) {
   });
 }
 
+/**
+ * Overlay bloccante quando non riesco a verificare le condizioni.
+ * Si risolve solo con "Riprova"; "Esci" fa logout e porta al login.
+ * @param {{ messaggio?: string, esci?: () => Promise<void> }} opts
+ * @returns {Promise<void>}
+ */
+export function mostraErroreBloccante(opts) {
+  const o = opts || {};
+  return new Promise((resolve) => {
+    const vecchio = document.getElementById('accettazione-legale-gate-errore');
+    if (vecchio) vecchio.remove();
+    const fondo = document.createElement('div');
+    fondo.id = 'accettazione-legale-gate-errore';
+    fondo.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
+    const pannello = document.createElement('div');
+    pannello.style.cssText = 'background:#fff;border-radius:12px;max-width:520px;width:100%;padding:24px;font:16px/1.4 system-ui,sans-serif;color:#1a1a1a;';
+    const testo = document.createElement('p');
+    testo.textContent = o.messaggio || 'Non riesco a verificare le condizioni di uso. Controlla la connessione e riprova.';
+    pannello.appendChild(testo);
+    const riprova = document.createElement('button');
+    riprova.type = 'button';
+    riprova.textContent = 'Riprova';
+    riprova.style.cssText = 'margin:8px 8px 0 0;padding:12px 16px;background:#2E8B57;color:#fff;border:0;border-radius:8px;';
+    riprova.addEventListener('click', () => {
+      fondo.remove();
+      resolve();
+    });
+    pannello.appendChild(riprova);
+    if (typeof o.esci === 'function') {
+      const esci = document.createElement('button');
+      esci.type = 'button';
+      esci.textContent = 'Esci';
+      esci.style.cssText = 'margin-top:8px;padding:12px 16px;background:#fff;color:#1a1a1a;border:1px solid #ccc;border-radius:8px;';
+      esci.addEventListener('click', () => {
+        Promise.resolve(o.esci()).catch(() => {});
+      });
+      pannello.appendChild(esci);
+    }
+    fondo.appendChild(pannello);
+    document.body.appendChild(fondo);
+  });
+}
+
+async function esciVersoLogin(firebase) {
+  try {
+    await firebase.signOut(firebase.getAuthInstance());
+  } catch (err) { /* ignore: si va comunque al login */ }
+  let url = new URL('../auth/login-standalone.html', import.meta.url).href;
+  try {
+    const emu = await import('./firebase-emulator-dev.js');
+    url = emu.withEmulatorQuery(url);
+  } catch (err) { /* ignore */ }
+  window.location.href = url;
+}
+
+/**
+ * Tenant e ruoli per il gate: contesto della pagina, poi tenant corrente, poi campi legacy del doc utente.
+ * @param {{ ruoli?: string[], tenantId?: string }|null|undefined} contesto
+ * @param {object|null} userData
+ * @param {string} tenantCorrente
+ * @param {(data: object, tenantId: string) => string[]} [ruoliDaMembership]
+ * @returns {{ tenantId: string, ruoli: string[] }}
+ */
+export function risolviTenantERuoli(contesto, userData, tenantCorrente, ruoliDaMembership) {
+  const data = userData && typeof userData === 'object' ? userData : {};
+  let tenantId = contesto && typeof contesto.tenantId === 'string' ? contesto.tenantId : '';
+  if (!tenantId && typeof tenantCorrente === 'string') tenantId = tenantCorrente;
+  if (!tenantId && typeof data.tenantId === 'string') tenantId = data.tenantId;
+  let ruoli = contesto && Array.isArray(contesto.ruoli) && contesto.ruoli.length ? contesto.ruoli : [];
+  if (!ruoli.length && tenantId && typeof ruoliDaMembership === 'function') {
+    ruoli = ruoliDaMembership(data, tenantId) || [];
+  }
+  if (!ruoli.length && Array.isArray(data.ruoli) && (!tenantId || data.tenantId === tenantId)) ruoli = data.ruoli;
+  return { tenantId, ruoli };
+}
+
 export async function avviaDaFirebase(contesto) {
-  const config = contesto && contesto.config;
   const firebase = await import('../services/firebase-service.js');
+  const esci = () => esciVersoLogin(firebase);
+  const mostraErrore = () => mostraErroreBloccante({ esci });
+  for (;;) {
+    try {
+      return await avviaUnaVolta(contesto, firebase, mostraErrore);
+    } catch (err) {
+      console.warn('[accettazione-legale] verifica non riuscita, ingresso bloccato');
+      await mostraErrore(err);
+    }
+  }
+}
+
+async function avviaUnaVolta(contesto, firebase, mostraErrore) {
+  const config = contesto && contesto.config;
   const auth = firebase.getAuthInstance();
   let user = auth.currentUser;
   if (!user) {
@@ -210,8 +312,23 @@ export async function avviaDaFirebase(contesto) {
     const snap = await firebase.getDoc(firebase.doc(firebase.getDb(), 'users', user.uid));
     if (!snap.exists()) return { mostrato: false };
     const data = snap.data() || {};
-    if (!Array.isArray(ruoli) || !ruoli.length) ruoli = data.ruoli || [];
-    if (!tenantId) tenantId = data.tenantId || '';
+    let tenantCorrente = '';
+    let ruoliDaMembership = null;
+    try {
+      const tenantService = await import('../services/tenant-service.js');
+      tenantCorrente = tenantService.getCurrentTenantId() || '';
+      ruoliDaMembership = tenantService.getUserRolesFromData;
+    } catch (err) { /* fallback legacy sotto */ }
+    if (tenantCorrente && !(data.tenantId === tenantCorrente
+      || (data.tenantMemberships && Object.prototype.hasOwnProperty.call(data.tenantMemberships, tenantCorrente)))) {
+      tenantCorrente = '';
+    }
+    const risolti = risolviTenantERuoli(contesto, data, tenantCorrente, ruoliDaMembership);
+    ruoli = risolti.ruoli;
+    tenantId = risolti.tenantId;
+  }
+  if (canalePerRuoli(ruoli) && !tenantId) {
+    throw new Error('azienda corrente non trovata');
   }
   let aziendaNome = contesto && typeof contesto.aziendaNome === 'string' ? contesto.aziendaNome : '';
   if (!aziendaNome.trim() && tenantId) {
@@ -228,8 +345,9 @@ export async function avviaDaFirebase(contesto) {
     configOk: true,
     ruoli,
     config,
+    mostraErrore,
     leggiStato: async () => {
-      const res = await callable({ azione: 'stato' });
+      const res = await callable({ azione: 'stato', tenantId });
       const data = res && res.data;
       return (data && data.documenti) || [];
     },
diff --git a/core/js/accettazione-legale-registrazione.js b/core/js/accettazione-legale-registrazione.js
new file mode 100644
index 00000000..ad1525ba
--- /dev/null
+++ b/core/js/accettazione-legale-registrazione.js
@@ -0,0 +1,47 @@
+/**
+ * Registrazione (landing o invito): accettazione legale DOPO che account e membership esistono.
+ * Se fallisce solo la callable, l'account resta valido: niente rollback, niente deleteUser.
+ * L'utente prosegue verso la dashboard e il gate di ingresso gli richiede l'accettazione.
+ * Flag spento: la callable non viene mai chiamata.
+ * @module core/js/accettazione-legale-registrazione
+ */
+
+export const ESITO_ACCETTAZIONE = Object.freeze({
+  SALTATA: 'saltata',
+  REGISTRATA: 'registrata',
+  RIMANDATA: 'rimandata'
+});
+
+export const MESSAGGIO_ACCETTAZIONE_RIMANDATA = 'Account creato. Conferma le condizioni al primo accesso.';
+
+/**
+ * @param {{ attiva?: boolean, registra?: () => Promise<unknown>, avvisa?: (err: unknown) => void }} opts
+ * @returns {Promise<'saltata'|'registrata'|'rimandata'>} non lancia mai
+ */
+export async function registraAccettazioneDopoAccount(opts) {
+  const o = opts || {};
+  if (o.attiva !== true || typeof o.registra !== 'function') return ESITO_ACCETTAZIONE.SALTATA;
+  try {
+    await o.registra();
+    return ESITO_ACCETTAZIONE.REGISTRATA;
+  } catch (err) {
+    try {
+      if (typeof o.avvisa === 'function') o.avvisa(err);
+      else console.warn('[accettazione-legale] registrazione rimandata al primo accesso');
+    } catch (_) { /* ignore */ }
+    return ESITO_ACCETTAZIONE.RIMANDATA;
+  }
+}
+
+/**
+ * Testo del messaggio di esito: con accettazione rimandata avvisa l'utente, poi il redirect è lo stesso.
+ * @param {string} esito
+ * @param {string} messaggioOk
+ * @returns {string}
+ */
+export function messaggioFineRegistrazione(esito, messaggioOk) {
+  if (esito === ESITO_ACCETTAZIONE.RIMANDATA) {
+    return '✅ ' + MESSAGGIO_ACCETTAZIONE_RIMANDATA + ' Reindirizzamento alla dashboard...';
+  }
+  return messaggioOk;
+}
diff --git a/core/mobile/field-workspace-standalone.html b/core/mobile/field-workspace-standalone.html
index b04b17a0..708475ba 100644
--- a/core/mobile/field-workspace-standalone.html
+++ b/core/mobile/field-workspace-standalone.html
@@ -292,21 +292,49 @@
     <script src="../js/dashboard-utils.js"></script>
     <script type="module" src="../js/standalone-bootstrap.js" data-config-base="../"></script>
     <script type="module">
+        // Il controller parte solo dopo il gate. Flag spento: nessun gate, il controller parte subito.
+        let flagAcceso = false;
+        let bloccato = false;
         try {
             const config = await import('../config/accettazione-legale-config.js');
             if (config.ACCETTAZIONE_LEGALE_ATTIVA === true) {
+                flagAcceso = true;
                 const legale = await import('../services/accettazione-legale.js');
                 if (legale.validaConfigLegale(config, true).ok) {
                     const gate = await import('../js/accettazione-legale-gate.js');
+                    // Non lascia entrare se lo stato non si legge (Riprova / Esci).
                     await gate.avviaDaFirebase({ config: config });
                 } else {
                     console.warn('[accettazione-legale] config non valida, ingresso invariato');
                 }
             }
         } catch (error) {
-            console.warn('[accettazione-legale] ingresso invariato');
+            if (flagAcceso) {
+                bloccato = true;
+                console.warn('[accettazione-legale] gate non caricato, ingresso bloccato');
+                const fondo = document.createElement('div');
+                fondo.id = 'accettazione-legale-gate-errore';
+                fondo.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;';
+                const pannello = document.createElement('div');
+                pannello.style.cssText = 'background:#fff;border-radius:12px;max-width:520px;width:100%;padding:24px;font:16px/1.4 system-ui,sans-serif;color:#1a1a1a;';
+                const testo = document.createElement('p');
+                testo.textContent = 'Non riesco a verificare le condizioni di uso. Controlla la connessione e riprova.';
+                const btn = document.createElement('button');
+                btn.type = 'button';
+                btn.textContent = 'Riprova';
+                btn.style.cssText = 'margin-top:8px;padding:12px 16px;background:#2E8B57;color:#fff;border:0;border-radius:8px;';
+                btn.addEventListener('click', () => window.location.reload());
+                pannello.appendChild(testo);
+                pannello.appendChild(btn);
+                fondo.appendChild(pannello);
+                document.body.appendChild(fondo);
+            } else {
+                console.warn('[accettazione-legale] ingresso invariato');
+            }
+        }
+        if (!bloccato) {
+            await import('./js/field-workspace-controller.js?v=2026-10-21b');
         }
     </script>
-    <script type="module" src="./js/field-workspace-controller.js?v=2026-10-21b"></script>
 </body>
 </html>
diff --git a/functions/accettazione-legale.js b/functions/accettazione-legale.js
index 957f6136..527193b3 100644
--- a/functions/accettazione-legale.js
+++ b/functions/accettazione-legale.js
@@ -1,6 +1,7 @@
 /**
  * Callable registraAccettazioniLegali: registra oppure legge lo stato.
  * Scrive solo con Admin SDK. Il client non ha accesso alla collezione.
+ * Righe e stato sono per azienda: lo stato chiede il tenantId e verifica la membership.
  */
 const admin = require("firebase-admin");
 const { FieldValue } = require("firebase-admin/firestore");
@@ -42,23 +43,27 @@ async function handleRegistraAccettazioniLegali(request, db) {
     throw new HttpsError(check.code, check.error);
   }
 
+  const userSnap = await database.collection("users").doc(uid).get();
+  if (!userSnap.exists) {
+    throw new HttpsError("permission-denied", "Utente non trovato.");
+  }
+  const userData = userSnap.data() || {};
+
   if (check.azione === "stato") {
+    if (!appartieneAlTenant(userData, check.tenantId)) {
+      throw new HttpsError("permission-denied", "Non appartieni a questa azienda.");
+    }
+    // Filtro per azienda in memoria: niente indice composito nuovo.
     const snap = await database.collection("accettazioniLegali").where("uid", "==", uid).get();
     const documenti = [];
     snap.forEach(function (docSnap) {
       const row = docSnap.data() || {};
-      if (typeof row.tipo === "string" && typeof row.versione === "string") {
+      if (row.tenantId === check.tenantId && typeof row.tipo === "string" && typeof row.versione === "string") {
         documenti.push({ tipo: row.tipo, versione: row.versione });
       }
     });
     return { documenti: documenti };
   }
-
-  const userSnap = await database.collection("users").doc(uid).get();
-  if (!userSnap.exists) {
-    throw new HttpsError("permission-denied", "Utente non trovato.");
-  }
-  const userData = userSnap.data() || {};
   const ruoli = ruoliDi(userData, check.tenantId);
 
   if (check.canale === "registrazione") {
@@ -76,7 +81,7 @@ async function handleRegistraAccettazioniLegali(request, db) {
 
   for (let i = 0; i < check.righe.length; i++) {
     const riga = check.righe[i];
-    const ref = database.collection("accettazioniLegali").doc(idAccettazione(uid, riga.tipo, riga.versione));
+    const ref = database.collection("accettazioniLegali").doc(idAccettazione(uid, check.tenantId, riga.tipo, riga.versione));
     const row = {
       uid: uid,
       tenantId: check.tenantId,
@@ -90,6 +95,7 @@ async function handleRegistraAccettazioniLegali(request, db) {
     try {
       await ref.create(row);
     } catch (err) {
+      // Stessa azienda, stesso documento e versione: già accettato, non si sovrascrive la prova.
       if (giaEsiste(err)) continue;
       console.error("[registraAccettazioniLegali]", check.canale, riga.tipo);
       throw new HttpsError("internal", "Registrazione accettazione non riuscita.");
diff --git a/functions/invito-pubblico.js b/functions/invito-pubblico.js
index b89010d9..f57f10f3 100644
--- a/functions/invito-pubblico.js
+++ b/functions/invito-pubblico.js
@@ -1,6 +1,8 @@
 /**
  * Invito pubblico (link email di registrazione): lookup Admin per token.
  * I campi restituiti sono un allowlist — niente dump del documento.
+ * Non escono cellulare, token e stato: il client ha già il token dall'URL,
+ * lo stato è sempre "invitato" e il cellulare lo digita l'invitato.
  */
 
 const INVITO_TOKEN_MIN_LEN = 10;
@@ -66,13 +68,10 @@ function sanitizeInvitoForPublic(id, data) {
     nome: typeof src.nome === "string" ? src.nome : "",
     cognome: typeof src.cognome === "string" ? src.cognome : "",
     ruoli: normalizeRuoli(src.ruoli),
-    stato: typeof src.stato === "string" ? src.stato : "",
     scadeIl: firestoreTimestampToIso(src.scadeIl),
     isExistingUser: src.isExistingUser === true || src.isExistingUser === "true",
     tenantId: typeof src.tenantId === "string" ? src.tenantId : "",
-    token: typeof src.token === "string" ? src.token : "",
     inviatoDa: typeof src.inviatoDa === "string" ? src.inviatoDa : "",
-    cellulare: typeof src.cellulare === "string" ? src.cellulare : "",
     aziendaNome: typeof src.aziendaNome === "string" ? src.aziendaNome : "",
   };
 }
diff --git a/functions/lib/accettazione-legale-core.js b/functions/lib/accettazione-legale-core.js
index b4d46bb7..e38cedfb 100644
--- a/functions/lib/accettazione-legale-core.js
+++ b/functions/lib/accettazione-legale-core.js
@@ -38,13 +38,18 @@ function validaPayloadAccettazione(data) {
   if (azione !== "registra" && azione !== "stato") {
     return fallisce("invalid-argument", "Azione non valida.");
   }
-  if (azione === "stato") return { ok: true, azione: "stato" };
+  if (azione === "stato") {
+    if (typeof src.tenantId !== "string" || !src.tenantId.trim() || src.tenantId.indexOf("/") >= 0) {
+      return fallisce("invalid-argument", "Azienda mancante.");
+    }
+    return { ok: true, azione: "stato", tenantId: src.tenantId.trim() };
+  }
 
   const canale = src.canale;
   if (canale !== "registrazione" && canale !== "invito") {
     return fallisce("invalid-argument", "Canale non valido.");
   }
-  if (typeof src.tenantId !== "string" || !src.tenantId.trim()) {
+  if (typeof src.tenantId !== "string" || !src.tenantId.trim() || src.tenantId.indexOf("/") >= 0) {
     return fallisce("invalid-argument", "Azienda mancante.");
   }
   if (typeof src.ruolo !== "string" || !src.ruolo.trim()) {
@@ -104,8 +109,16 @@ function validaPayloadAccettazione(data) {
   };
 }
 
-function idAccettazione(uid, tipo, versione) {
-  return uid + "_" + tipo + "_" + versione;
+/**
+ * Una riga per utente, azienda, documento e versione: chi entra in una seconda
+ * azienda deve accettare di nuovo (l'informativa e il DPA sono per azienda).
+ * Vale per entrambi i canali: in registrazione il tenantId è quello appena creato.
+ */
+function idAccettazione(uid, tenantId, tipo, versione) {
+  if (typeof tenantId !== "string" || !tenantId) {
+    throw new Error("tenantId obbligatorio per l'id accettazione");
+  }
+  return uid + "_" + tenantId + "_" + tipo + "_" + versione;
 }
 
 module.exports = {
diff --git a/tests/accettazione-legale-functions.test.js b/tests/accettazione-legale-functions.test.js
index 62cecbeb..9364b2df 100644
--- a/tests/accettazione-legale-functions.test.js
+++ b/tests/accettazione-legale-functions.test.js
@@ -109,7 +109,7 @@ describe('registraAccettazioniLegali', () => {
   });
 
   it('ignora il documento già presente e non lo sovrascrive', async () => {
-    const id = idAccettazione('admin1', 'dpa', 'dpa-2026-03-01');
+    const id = idAccettazione('admin1', 'az1', 'dpa', 'dpa-2026-03-01');
     const db = fakeDb(Object.assign(baseSeed(), {
       ['accettazioniLegali/' + id]: {
         uid: 'admin1',
@@ -130,7 +130,7 @@ describe('registraAccettazioniLegali', () => {
     }, db);
     expect(res).toEqual({ ok: true });
     expect(db.docs.get('accettazioniLegali/' + id).marker).toBe('vecchio');
-    expect(db.docs.has('accettazioniLegali/' + idAccettazione('admin1', 'privacy', 'privacy-2026-03-01'))).toBe(true);
+    expect(db.docs.has('accettazioniLegali/' + idAccettazione('admin1', 'az1', 'privacy', 'privacy-2026-03-01'))).toBe(true);
   });
 
   it('non copia uid, email o ip dal payload: l\'uid della riga è quello di auth', async () => {
@@ -148,7 +148,7 @@ describe('registraAccettazioniLegali', () => {
         ip: '203.0.113.5'
       }
     }, db);
-    const path = 'accettazioniLegali/' + idAccettazione('admin1', 'termini-b2b', 'termini-b2b-2026-03-01');
+    const path = 'accettazioniLegali/' + idAccettazione('admin1', 'az1', 'termini-b2b', 'termini-b2b-2026-03-01');
     const row = db.docs.get(path);
     expect(row.uid).toBe('admin1');
     expect(row.email).toBeUndefined();
@@ -179,4 +179,92 @@ describe('registraAccettazioniLegali', () => {
       }
     }, db)).rejects.toMatchObject({ code: 'failed-precondition' });
   });
+
+});
+
+function informativa() {
+  return [{
+    tipo: 'informativa-lavoratori',
+    versione: 'informativa-lavoratori-2026-03-01',
+    versioneTestoCasella: 'casella-invito-v1'
+  }];
+}
+
+function seedDueAziende() {
+  return {
+    'users/op1': {
+      ruoli: ['operaio'],
+      tenantId: 'az1',
+      tenantMemberships: {
+        az1: { ruoli: ['operaio'], stato: 'attivo' },
+        az2: { ruoli: ['operaio'], stato: 'attivo' }
+      }
+    },
+    'tenants/az1': { creatoDa: 'admin1', nome: 'Azienda 1' },
+    'tenants/az2': { creatoDa: 'admin2', nome: 'Azienda 2' }
+  };
+}
+
+function registraInvito(db, tenantId) {
+  return handleRegistraAccettazioniLegali({
+    auth: { uid: 'op1' },
+    data: { azione: 'registra', canale: 'invito', tenantId, ruolo: 'operaio', documenti: informativa() }
+  }, db);
+}
+
+function stato(db, tenantId, uid = 'op1') {
+  return handleRegistraAccettazioniLegali({ auth: { uid }, data: { azione: 'stato', tenantId } }, db);
+}
+
+describe('accettazioni per azienda', () => {
+  it('id diverso per azienda, stesso utente, documento e versione', () => {
+    const a = idAccettazione('op1', 'az1', 'informativa-lavoratori', 'informativa-lavoratori-2026-03-01');
+    const b = idAccettazione('op1', 'az2', 'informativa-lavoratori', 'informativa-lavoratori-2026-03-01');
+    expect(a).not.toBe(b);
+    expect(a).toBe('op1_az1_informativa-lavoratori_informativa-lavoratori-2026-03-01');
+    expect(() => idAccettazione('op1', '', 'dpa', 'dpa-2026-03-01')).toThrow();
+  });
+
+  it('la seconda azienda crea una riga sua (niente already-exists silenzioso)', async () => {
+    const db = fakeDb(seedDueAziende());
+    await registraInvito(db, 'az1');
+    await registraInvito(db, 'az2');
+    const righe = [...db.docs.keys()].filter((k) => k.startsWith('accettazioniLegali/'));
+    expect(righe.sort()).toEqual([
+      'accettazioniLegali/op1_az1_informativa-lavoratori_informativa-lavoratori-2026-03-01',
+      'accettazioniLegali/op1_az2_informativa-lavoratori_informativa-lavoratori-2026-03-01'
+    ]);
+    expect(db.docs.get(righe.sort()[1]).tenantId).toBe('az2');
+  });
+
+  it('ripetere nella stessa azienda è idempotente e non sovrascrive', async () => {
+    const db = fakeDb(seedDueAziende());
+    await registraInvito(db, 'az1');
+    const id = 'accettazioniLegali/op1_az1_informativa-lavoratori_informativa-lavoratori-2026-03-01';
+    db.docs.get(id).marker = 'primo';
+    await expect(registraInvito(db, 'az1')).resolves.toEqual({ ok: true });
+    expect(db.docs.get(id).marker).toBe('primo');
+  });
+
+  it('stato filtrato per azienda: accettata in az1, mancante in az2', async () => {
+    const db = fakeDb(seedDueAziende());
+    await registraInvito(db, 'az1');
+    expect(await stato(db, 'az1')).toEqual({
+      documenti: [{ tipo: 'informativa-lavoratori', versione: 'informativa-lavoratori-2026-03-01' }]
+    });
+    expect(await stato(db, 'az2')).toEqual({ documenti: [] });
+  });
+
+  it('stato senza tenantId: invalid-argument', async () => {
+    await expect(handleRegistraAccettazioniLegali({ auth: { uid: 'op1' }, data: { azione: 'stato' } }, fakeDb(seedDueAziende())))
+      .rejects.toMatchObject({ code: 'invalid-argument' });
+  });
+
+  it('stato di un\'azienda a cui non appartieni: permission-denied', async () => {
+    await expect(stato(fakeDb(seedDueAziende()), 'az3')).rejects.toMatchObject({ code: 'permission-denied' });
+  });
+
+  it('tenantId con "/" rifiutato', async () => {
+    await expect(registraInvito(fakeDb(seedDueAziende()), 'az1/x')).rejects.toMatchObject({ code: 'invalid-argument' });
+  });
 });
diff --git a/tests/accettazione-legale-gate.test.js b/tests/accettazione-legale-gate.test.js
index 8a17611c..e76c8014 100644
--- a/tests/accettazione-legale-gate.test.js
+++ b/tests/accettazione-legale-gate.test.js
@@ -2,7 +2,13 @@
  * @vitest-environment node
  */
 import { describe, it, expect, vi } from 'vitest';
-import { pianoGate, eseguiGate } from '../core/js/accettazione-legale-gate.js';
+import { readFileSync } from 'node:fs';
+import { dirname, join } from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { pianoGate, eseguiGate, risolviTenantERuoli } from '../core/js/accettazione-legale-gate.js';
+
+const root = join(dirname(fileURLToPath(import.meta.url)), '..');
+const leggi = (rel) => readFileSync(join(root, rel), 'utf8');
 
 const config = {
   DOCUMENTI_LEGALI: {
@@ -83,3 +89,119 @@ describe('pianoGate', () => {
     expect(mostra).not.toHaveBeenCalled();
   });
 });
+
+describe('eseguiGate: stato non leggibile → ingresso bloccato', () => {
+  const base = { attiva: true, configOk: true, ruoli: ['operaio'], config };
+
+  it('senza mostraErrore rilancia (chi chiama deve bloccare)', async () => {
+    const mostra = vi.fn();
+    await expect(eseguiGate(Object.assign({}, base, {
+      leggiStato: async () => { throw new Error('unavailable'); },
+      mostra
+    }))).rejects.toThrow('unavailable');
+    expect(mostra).not.toHaveBeenCalled();
+  });
+
+  it('con mostraErrore che non viene risolto resta in attesa: non entra', async () => {
+    const mostra = vi.fn();
+    const mostraErrore = vi.fn(() => new Promise(() => {}));
+    const gate = eseguiGate(Object.assign({}, base, {
+      leggiStato: async () => { throw new Error('unavailable'); },
+      mostra,
+      mostraErrore
+    }));
+    const esito = await Promise.race([gate.then(() => 'entrato'), new Promise((r) => setTimeout(() => r('bloccato'), 30))]);
+    expect(esito).toBe('bloccato');
+    expect(mostraErrore).toHaveBeenCalledTimes(1);
+    expect(mostra).not.toHaveBeenCalled();
+  });
+
+  it('Riprova: rilegge e poi mostra la richiesta di accettazione', async () => {
+    let tentativi = 0;
+    const mostra = vi.fn().mockResolvedValue();
+    const mostraErrore = vi.fn().mockResolvedValue();
+    const esito = await eseguiGate(Object.assign({}, base, {
+      leggiStato: async () => {
+        tentativi += 1;
+        if (tentativi === 1) throw new Error('unavailable');
+        return [];
+      },
+      mostra,
+      mostraErrore
+    }));
+    expect(tentativi).toBe(2);
+    expect(mostraErrore).toHaveBeenCalledTimes(1);
+    expect(mostra).toHaveBeenCalledTimes(1);
+    expect(esito).toEqual({ mostrato: true });
+  });
+
+  it('flag spento: leggiStato e mostraErrore mai chiamati', async () => {
+    const leggiStato = vi.fn();
+    const mostraErrore = vi.fn();
+    expect(await eseguiGate(Object.assign({}, base, { attiva: false, leggiStato, mostraErrore }))).toEqual({ mostrato: false });
+    expect(leggiStato).not.toHaveBeenCalled();
+    expect(mostraErrore).not.toHaveBeenCalled();
+  });
+});
+
+describe('gate per azienda', () => {
+  it('seconda azienda: stato vuoto per az2 → richiede l\'informativa anche se accettata in az1', async () => {
+    const statoPerTenant = {
+      az1: [{ tipo: 'informativa-lavoratori', versione: 'informativa-lavoratori-2026-03-01' }],
+      az2: []
+    };
+    const mostra = vi.fn().mockResolvedValue();
+    for (const tenantId of ['az1', 'az2']) {
+      await eseguiGate({
+        attiva: true, configOk: true, ruoli: ['operaio'], config,
+        leggiStato: async () => statoPerTenant[tenantId],
+        mostra
+      });
+    }
+    expect(mostra).toHaveBeenCalledTimes(1);
+  });
+
+  it('risolviTenantERuoli: contesto, poi tenant corrente con ruoli della membership, poi legacy', () => {
+    const user = {
+      tenantId: 'az1',
+      ruoli: ['amministratore'],
+      tenantMemberships: { az1: { ruoli: ['amministratore'] }, az2: { ruoli: ['operaio'] } }
+    };
+    const daMembership = (data, t) => (data.tenantMemberships[t] && data.tenantMemberships[t].ruoli) || [];
+    expect(risolviTenantERuoli({ tenantId: 'az2', ruoli: ['caposquadra'] }, user, 'az1', daMembership))
+      .toEqual({ tenantId: 'az2', ruoli: ['caposquadra'] });
+    expect(risolviTenantERuoli(null, user, 'az2', daMembership)).toEqual({ tenantId: 'az2', ruoli: ['operaio'] });
+    expect(risolviTenantERuoli(null, user, '', null)).toEqual({ tenantId: 'az1', ruoli: ['amministratore'] });
+    // Ruoli legacy di un'altra azienda non si applicano al tenant corrente.
+    expect(risolviTenantERuoli(null, { tenantId: 'az1', ruoli: ['amministratore'] }, 'az2', null))
+      .toEqual({ tenantId: 'az2', ruoli: [] });
+  });
+
+  it('avviaDaFirebase passa il tenantId alla callable stato', () => {
+    const src = leggi('core/js/accettazione-legale-gate.js');
+    expect(src).toMatch(/callable\(\{ azione: 'stato', tenantId \}\)/);
+    expect(src).toMatch(/mostraErrore,\s*\n\s*leggiStato/);
+  });
+});
+
+describe('pagine di ingresso: flag acceso non è fail-open', () => {
+  it('dashboard: con flag acceso un errore di caricamento blocca', () => {
+    const html = leggi('core/dashboard-standalone.html');
+    const inizio = html.indexOf('async function attendiAccettazioneLegaleSeServe');
+    const blocco = html.slice(inizio, html.indexOf('function applicaIngressoDopoLogin', inizio));
+    expect(blocco).toContain('flagAcceso = true');
+    expect(blocco).toMatch(/if \(!flagAcceso\)/);
+    expect(blocco).toContain('bloccaIngressoLegale()');
+    expect(blocco).toContain('await new Promise(() => {})');
+  });
+
+  it('field workspace: il controller parte solo dopo il gate', () => {
+    const html = leggi('core/mobile/field-workspace-standalone.html');
+    expect(html).not.toMatch(/<script type="module" src="\.\/js\/field-workspace-controller\.js/);
+    const gate = html.indexOf('await gate.avviaDaFirebase(');
+    const controller = html.indexOf("await import('./js/field-workspace-controller.js?v=2026-10-21b')");
+    expect(gate).toBeGreaterThan(-1);
+    expect(controller).toBeGreaterThan(gate);
+    expect(html).toMatch(/if \(!bloccato\) \{\s*await import\('\.\/js\/field-workspace-controller/);
+  });
+});
diff --git a/tests/accettazione-legale-registrazione.test.js b/tests/accettazione-legale-registrazione.test.js
new file mode 100644
index 00000000..0c7857f9
--- /dev/null
+++ b/tests/accettazione-legale-registrazione.test.js
@@ -0,0 +1,104 @@
+/**
+ * @vitest-environment node
+ * Registrazione (landing e invito): se fallisce solo registraAccettazioniLegali dopo
+ * account/membership, niente rollback e redirect normale; il gate chiede l'accettazione.
+ */
+import { readFileSync } from 'node:fs';
+import { dirname, join } from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { describe, it, expect, vi } from 'vitest';
+import {
+  registraAccettazioneDopoAccount,
+  messaggioFineRegistrazione,
+  ESITO_ACCETTAZIONE,
+  MESSAGGIO_ACCETTAZIONE_RIMANDATA
+} from '../core/js/accettazione-legale-registrazione.js';
+
+const root = join(dirname(fileURLToPath(import.meta.url)), '..');
+const leggi = (rel) => readFileSync(join(root, rel), 'utf8');
+
+describe('registraAccettazioneDopoAccount', () => {
+  it('flag spento: callable mai chiamata', async () => {
+    const registra = vi.fn();
+    expect(await registraAccettazioneDopoAccount({ attiva: false, registra })).toBe(ESITO_ACCETTAZIONE.SALTATA);
+    expect(await registraAccettazioneDopoAccount({ registra })).toBe(ESITO_ACCETTAZIONE.SALTATA);
+    expect(registra).not.toHaveBeenCalled();
+  });
+
+  it('flag acceso e callable ok: registrata, messaggio invariato', async () => {
+    const registra = vi.fn().mockResolvedValue({ data: { ok: true } });
+    const esito = await registraAccettazioneDopoAccount({ attiva: true, registra });
+    expect(esito).toBe(ESITO_ACCETTAZIONE.REGISTRATA);
+    expect(registra).toHaveBeenCalledTimes(1);
+    expect(messaggioFineRegistrazione(esito, 'OK')).toBe('OK');
+  });
+
+  it('callable fallita: non lancia, esito rimandata e messaggio "conferma al primo accesso"', async () => {
+    const avvisa = vi.fn();
+    const registra = vi.fn().mockRejectedValue(Object.assign(new Error('internal'), { code: 'functions/internal' }));
+    const esito = await registraAccettazioneDopoAccount({ attiva: true, registra, avvisa });
+    expect(esito).toBe(ESITO_ACCETTAZIONE.RIMANDATA);
+    expect(avvisa).toHaveBeenCalledTimes(1);
+    const msg = messaggioFineRegistrazione(esito, 'OK');
+    expect(msg).toContain(MESSAGGIO_ACCETTAZIONE_RIMANDATA);
+    expect(msg).toContain('dashboard');
+  });
+
+  it('callable fallita in un flusso: redirect eseguito, nessun deleteUser', async () => {
+    // Stesso ordine delle pagine: account creato → accettazione → messaggio → redirect; il catch con cleanup non si raggiunge.
+    const deleteUser = vi.fn();
+    const redirect = vi.fn();
+    async function flusso(registra) {
+      try {
+        const esito = await registraAccettazioneDopoAccount({ attiva: true, registra, avvisa: () => {} });
+        redirect(messaggioFineRegistrazione(esito, 'ok'));
+      } catch (err) {
+        deleteUser();
+      }
+    }
+    await flusso(() => Promise.reject(new Error('rete')));
+    expect(redirect).toHaveBeenCalledTimes(1);
+    expect(deleteUser).not.toHaveBeenCalled();
+  });
+});
+
+describe('pagine di registrazione usano l\'helper', () => {
+  it('landing: callable solo dentro registraAccettazioneDopoAccount, dopo il doc utente e prima del redirect', () => {
+    const html = leggi('core/auth/registrazione-standalone.html');
+    const helper = html.indexOf('await registraAccettazioneDopoAccount(');
+    const callable = html.indexOf("getHttpsCallable('registraAccettazioniLegali')");
+    const docUtente = html.lastIndexOf('userDocCreated = true', helper);
+    const redirect = html.indexOf("window.location.href = '../dashboard-standalone.html'", helper);
+    expect(helper).toBeGreaterThan(-1);
+    expect(docUtente).toBeGreaterThan(-1);
+    expect(callable).toBeGreaterThan(helper);
+    expect(redirect).toBeGreaterThan(callable);
+    expect(html.split("getHttpsCallable('registraAccettazioniLegali')").length - 1).toBe(1);
+    // Il cleanup con deleteUser resta solo per il caso "doc utente non creato".
+    expect(html).toMatch(/if \(firebaseUser && !userDocCreated\)/);
+    expect(html).toContain('messaggioFineRegistrazione(esitoLegale');
+  });
+
+  it('invito: tutti i percorsi (nuovo, esistente, due fallback) passano da completaPresaVisione', () => {
+    const html = leggi('core/auth/registrazione-invito-standalone.html');
+    expect(html).not.toMatch(/await registraPresaVisioneSeAttiva\(\)/);
+    expect(html.split('await completaPresaVisione()').length - 1).toBe(3);
+    expect(html).toMatch(/registraAccettazioneDopoAccount\(\{\s*attiva: accettazioneLegaleAttiva,\s*registra: registraPresaVisioneSeAttiva/);
+    expect(html).not.toContain('deleteUser');
+    const parti = html.split('await completaPresaVisione()').slice(1);
+    parti.forEach((parte) => {
+      const redirect = parte.indexOf("window.location.href = '../dashboard-standalone.html'");
+      expect(redirect).toBeGreaterThan(-1);
+      expect(parte.slice(0, redirect)).toContain('messaggioFineRegistrazione(esitoLegale');
+    });
+  });
+
+  it('invito: niente cellulare né token dalla risposta della callable', () => {
+    const html = leggi('core/auth/registrazione-invito-standalone.html');
+    expect(html).not.toMatch(/inviteData\.cellulare/);
+    expect(html).not.toMatch(/inviteData\.token/);
+    expect(html).not.toMatch(/invit[oe]Data\.stato/);
+    const svc = leggi('core/services/invito-service-standalone.js');
+    expect(svc).not.toMatch(/invit[oe]\w*\.(cellulare|token|stato)\b/);
+  });
+});
diff --git a/tests/moduli-identificatori-definiti.test.js b/tests/moduli-identificatori-definiti.test.js
index 4fdbacf9..a8671701 100644
--- a/tests/moduli-identificatori-definiti.test.js
+++ b/tests/moduli-identificatori-definiti.test.js
@@ -12,6 +12,8 @@ import { describe, expect, it } from 'vitest';
 const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
 
 const MODULI = [
+  'core/js/accettazione-legale-gate.js',
+  'core/js/accettazione-legale-registrazione.js',
   'core/js/attivita-controller.js',
   'core/js/attivita-maps.js',
   'core/js/dashboard-briefing-helpers.js',
@@ -45,7 +47,10 @@ const PAGINE = [
   'core/admin/gestione-lavori-standalone.html',
   'core/admin/lavori-caposquadra-standalone.html',
   'core/attivita-standalone.html',
+  'core/auth/registrazione-invito-standalone.html',
+  'core/auth/registrazione-standalone.html',
   'core/dashboard-standalone.html',
+  'core/mobile/field-workspace-standalone.html',
   'modules/vendemmia-meccanica/views/piano-stagione-standalone.html',
 ];
 
diff --git a/tests/services/invito-pubblico.test.js b/tests/services/invito-pubblico.test.js
index 95d354f2..769751f2 100644
--- a/tests/services/invito-pubblico.test.js
+++ b/tests/services/invito-pubblico.test.js
@@ -71,10 +71,12 @@ describe('invito-pubblico — token e sanitize', () => {
     expect(out.secretInterno).toBeUndefined();
     expect(out.noteAdmin).toBeUndefined();
     expect(out.aziendaNome).toBe('');
-    expect(out.cellulare).toBe('333');
+    // Allowlist esatta: niente cellulare, token, stato.
+    expect(out.cellulare).toBeUndefined();
+    expect(out.token).toBeUndefined();
+    expect(out.stato).toBeUndefined();
     expect(Object.keys(out).sort()).toEqual([
       'aziendaNome',
-      'cellulare',
       'cognome',
       'email',
       'id',
@@ -83,9 +85,7 @@ describe('invito-pubblico — token e sanitize', () => {
       'nome',
       'ruoli',
       'scadeIl',
-      'stato',
       'tenantId',
-      'token',
     ]);
   });
 
@@ -154,10 +154,12 @@ describe('handleGetInvitoPubblico', () => {
     expect(res.invito.email).toBe('ada@gfv.test');
     expect(res.invito.leak).toBeUndefined();
     expect(res.invito.aziendaNome).toBe('');
-    expect(res.invito.cellulare).toBe('');
+    expect(res.invito.cellulare).toBeUndefined();
+    expect(res.invito.token).toBeUndefined();
+    expect(res.invito.stato).toBeUndefined();
   });
 
-  it('aggiunge aziendaNome letto dal tenant e lascia il cellulare', async () => {
+  it('aggiunge aziendaNome letto dal tenant e non espone il cellulare', async () => {
     const future = new Date('2027-01-01T00:00:00.000Z');
     const invito = fakeDoc('ok1', {
       stato: 'invitato',
@@ -194,7 +196,9 @@ describe('handleGetInvitoPubblico', () => {
     };
     const res = await handleGetInvitoPubblico(db, LONG_TOKEN, new Date('2026-09-18'));
     expect(res.invito.aziendaNome).toBe('Vigna Rossi');
-    expect(res.invito.cellulare).toBe('333');
+    expect(res.invito.cellulare).toBeUndefined();
+    expect(JSON.stringify(res)).not.toContain('333');
+    expect(JSON.stringify(res)).not.toContain(LONG_TOKEN);
   });
 });
 
````

Poi:

```powershell
git apply --check fix-accettazione-legale.diff
git apply fix-accettazione-legale.diff
Remove-Item fix-accettazione-legale.diff
git status --short
```

Ti aspetti, oltre agli eventuali non tracciati da ignorare:

```
 M core/auth/registrazione-invito-standalone.html
 M core/auth/registrazione-standalone.html
 M core/dashboard-standalone.html
 M core/js/accettazione-legale-gate.js
 M core/mobile/field-workspace-standalone.html
 M functions/accettazione-legale.js
 M functions/invito-pubblico.js
 M functions/lib/accettazione-legale-core.js
 M tests/accettazione-legale-functions.test.js
 M tests/accettazione-legale-gate.test.js
 M tests/moduli-identificatori-definiti.test.js
 M tests/services/invito-pubblico.test.js
?? core/js/accettazione-legale-registrazione.js
?? tests/accettazione-legale-registrazione.test.js
```

Se `git apply --check` fallisce, NON applicare a mano. Prova una volta `git apply --check --ignore-whitespace fix-accettazione-legale.diff`, solo per capire se il problema sono i fine riga (CRLF) del file salvato. Poi fermati e riportami l'errore esatto.

Controllo che non sia stato toccato niente di vietato. Questo comando non deve stampare nulla:

```powershell
git status --short -- core/js/tony core/js/gfv-tony-loader.js firestore.rules core/config/accettazione-legale-config.js
```

### 3. Test (uno per uno)

Se `node_modules` manca, prima esegui `npm ci`. `tests/accettazione-legale-functions.test.js` carica i moduli di `functions/` (serve `firebase-functions`): se `functions/node_modules` manca, esegui `npm ci --prefix functions`.

```powershell
npx vitest run tests/accettazione-legale-registrazione.test.js
npx vitest run tests/accettazione-legale-gate.test.js
npx vitest run tests/accettazione-legale-functions.test.js
npx vitest run tests/services/invito-pubblico.test.js
npx vitest run tests/config/accettazione-legale-config.test.js
npx vitest run tests/services/accettazione-legale.test.js
npx vitest run tests/invito-client-no-public-query.test.js
npx vitest run tests/moduli-identificatori-definiti.test.js
npx vitest run tests/functions-index-handlers-defined.test.js
npx vitest run tests/relative-imports-resolve.test.js
npx vitest run tests/auth-form-query-guard.test.js
npx vitest run tests/console-ingresso-transizioni.test.js
npx vitest run tests/ingresso-attesa.test.js
npx vitest run tests/field-documentation-guide-link.test.js
npx vitest run tests/landing/landing-passo2.test.js
npx vitest run tests/nome-titolare-passo4.test.js
npx vitest run tests/sw-strategy.test.js
npx vitest run tests/app-update-form-sporco.test.js
```

Risultati attesi (verificati su develop 38dde025 + patch):

| File | Test superati |
|---|---|
| `accettazione-legale-registrazione` | 7 |
| `accettazione-legale-gate` | 13 |
| `accettazione-legale-functions` | 13 |
| `services/invito-pubblico` | 11 |
| `config/accettazione-legale-config` | 4 |
| `services/accettazione-legale` | 20 |
| `invito-client-no-public-query` | 4 |
| `moduli-identificatori-definiti` | 38 |
| `functions-index-handlers-defined` | 2 |
| `relative-imports-resolve` | 4 |
| `auth-form-query-guard` | 11 |
| `console-ingresso-transizioni` | 79 |
| `ingresso-attesa` | 9 |
| `field-documentation-guide-link` | 2 |
| `landing/landing-passo2` | 20 |
| `nome-titolare-passo4` | 20 |
| `sw-strategy` | 23 |
| `app-update-form-sporco` | 9 |

Senza la patch i test nuovi o aggiornati falliscono: registrazione (manca l'helper), gate (`unavailable` non gestito), functions (`stato` senza tenantId accettato), invito-pubblico (`cellulare` ancora esposto).

`tests/config/field-ui-i18n.test.js` ha 1 test che fallisce già su develop pulito (`t(k` chiave dinamica nel controller): non c'entra, non lanciarlo. Non lanciare altro. Chiudi eventuali processi vitest rimasti.

### 4. simulator/manifest.json

```powershell
git status --short simulator/manifest.json
```

Se risulta modificato:

```powershell
git checkout -- simulator/manifest.json
```

### 5. Cache PWA (SW_CACHE_BUILD_ID)

Il bump lo fa l'hook `.githooks/pre-commit`: esegue `node scripts/bump-pwa-cache-version.mjs`, cioè lo stesso script di `npm run bump:pwa-cache`, e poi `git add service-worker.js`. Non scrivere un valore a mano. Controlla che l'hook sia attivo:

```powershell
git config --get core.hooksPath
```

- Se stampa `.githooks`, non fare nulla: al commit l'hook aggiorna e aggiunge `service-worker.js` da solo. NON lanciare anche `npm run bump:pwa-cache`.
- Se non stampa nulla, l'hook non è attivo. In questo caso, e solo in questo, esegui prima del commit:

```powershell
npm run bump:pwa-cache
git add service-worker.js
```

### 6. Commit (solo i file toccati, elencati)

```powershell
git add functions/invito-pubblico.js functions/lib/accettazione-legale-core.js functions/accettazione-legale.js
git add core/js/accettazione-legale-registrazione.js core/js/accettazione-legale-gate.js core/auth/registrazione-invito-standalone.html core/auth/registrazione-standalone.html core/dashboard-standalone.html core/mobile/field-workspace-standalone.html
git add tests/accettazione-legale-registrazione.test.js tests/accettazione-legale-gate.test.js tests/accettazione-legale-functions.test.js tests/services/invito-pubblico.test.js tests/moduli-identificatori-definiti.test.js
git commit -m "Accettazione legale: invito pubblico senza cellulare/token/stato, registrazione senza rollback se fallisce solo l'accettazione, gate bloccante con Riprova, accettazioni per azienda"
git show --stat HEAD
```

In `git show --stat` ti aspetti i 14 file sopra più `service-worker.js` (una riga, il bump dell'hook). Nient'altro.

### 7. Push e PR in BOZZA verso develop (nessun merge)

```powershell
git push -u origin fix/accettazione-legale
gh pr create --draft --base develop --head fix/accettazione-legale --title "Accettazione legale: invito pubblico minimo, registrazione senza rollback, gate bloccante, accettazioni per azienda" --body "Flag ACCETTAZIONE_LEGALE_ATTIVA resta false. (1) getInvitoPubblico: allowlist esatta id, email, nome, cognome, ruoli, scadeIl, isExistingUser, tenantId, inviatoDa, aziendaNome; tolti cellulare, token, stato. Client: token dall'URL, niente prefill cellulare (campo obbligatorio come prima). (2) Nuovo helper core/js/accettazione-legale-registrazione.js usato da landing e da tutti i percorsi invito (nuovo, esistente, due fallback email-already-in-use): se fallisce solo registraAccettazioniLegali dopo account/membership niente rollback ne' deleteUser, messaggio 'Account creato. Conferma le condizioni al primo accesso.' e redirect normale; il gate chiede l'accettazione. Flag spento: callable mai chiamata. (3) Gate: con flag acceso, se lo stato non si legge overlay bloccante Riprova/Esci, mai fail-open; dashboard bloccata se i moduli del gate non si caricano; field workspace importa il controller solo dopo il gate. Tenant e ruoli dell'azienda corrente. (4) Accettazioni per azienda: id uid_tenantId_tipo_versione (entrambi i canali; in registrazione il tenantId e' quello creato, verificato con creatoDa), stato con tenantId obbligatorio e verifica membership, filtro in memoria (nessun indice), already-exists = stessa azienda idempotente. Nessuna migrazione (flag spento). Fix ReferenceError password nel secondo fallback email-already-in-use dell'invito. Nessun tocco a firestore.rules, tony, config flag. Functions toccate: getInvitoPubblico, registraAccettazioniLegali (deploy manuale dopo il merge su main, non in questa PR). Test: accettazione-legale-registrazione (7), accettazione-legale-gate (13), accettazione-legale-functions (13), invito-pubblico (11), moduli-identificatori-definiti (38)."
```

NON fare merge. NON fare deploy. Riportami il link della PR.

### 8. Cosa riportarmi

- lo sha di partenza (`git rev-parse HEAD` del passo 1) e l'hash sha256 del `.diff`;
- l'esito di `git apply --check`;
- l'output finale di ogni `npx vitest run`;
- il `git show --stat HEAD`;
- se `simulator/manifest.json` è stato ripristinato;
- il valore di `core.hooksPath`;
- il link della PR in bozza.

---

## Per PIER (non per Cursor): deploy delle functions

Cursor NON esegue deploy. Solo **dopo il merge su main** (e il deploy di Pages che ne segue), dalla radice del repo aggiornato su `main`:

```powershell
git checkout main
git pull
firebase deploy --only "functions:getInvitoPubblico,functions:registraAccettazioniLegali"
```

Le due functions sono indipendenti dall'ordine con il client: il client nuovo ignora `cellulare` se la function vecchia lo manda ancora; con il flag spento nessuno chiama `registraAccettazioniLegali`. Le virgolette servono in PowerShell per la virgola. La regione (europe-west1) è nel codice.

## Ritest manuale su Pages (dopo merge e deploy)

Con il **flag spento** (come oggi):
- [ ] Link di invito: il form si apre con email, nome e cognome precompilati. **Cellulare vuoto** (unico cambiamento visibile): va digitato, resta obbligatorio.
- [ ] Registrazione da invito (nuovo utente) va a buon fine e porta alla dashboard come prima; il cellulare digitato è salvato sull'utente.
- [ ] Invito a un utente già registrato (password del suo account): azienda aggiunta, redirect alla dashboard.
- [ ] Registrazione da landing (nuova azienda) invariata.
- [ ] Dashboard e area campo (field workspace) si aprono come prima, nessun overlay; l'area campo carica normalmente (lavori, segna ore).
- [ ] Console: nessun errore nuovo. In DevTools → Network la risposta di `getInvitoPubblico` non contiene `cellulare`, `token`, `stato` (dopo il deploy della function).

**Quando si accenderà il flag** (decisione separata; prima compilare versioni e url reali in `accettazione-legale-config.js`):
- Le functions di questa PR devono essere già deployate (lo `stato` ora richiede `tenantId`).
- Simulare un errore della callable (es. offline al momento del clic): la registrazione mostra «Account creato. Conferma le condizioni al primo accesso.» e va in dashboard; lì l'overlay chiede l'accettazione.
- Con rete assente all'ingresso: overlay «Non riesco a verificare…» con Riprova/Esci, nessun accesso alla dashboard o all'area campo.
- Utente in due aziende: dopo l'accettazione nella prima, entrando nella seconda l'informativa viene richiesta di nuovo; in Firestore due righe `uid_<tenant>_informativa-lavoratori_<versione>`.

## Rischi e follow-up (solo segnalati)

- **Invitato con ruolo `amministratore`** (possibile da Gestisci utenti, `gestisci-utenti-standalone.html:403`): il gate lo tratta come canale `registrazione` (`canalePerRuoli`), ma il server accetta quel canale solo da chi ha creato l'azienda (`accettazione-legale.js:64-72`). A flag acceso resterebbe bloccato sull'overlay. Già vero su develop; da decidere quali documenti accetta un amministratore invitato PRIMA di accendere il flag.
- Config non valida a flag acceso: ingresso e registrazione restano invariati (warning), come oggi. È una scelta: il flag non si accende con la config incompleta.
- La pagina invito duplica ancora la logica membership in tre posti (`acceptInvito` e i due fallback): non unificata qui per tenere la patch piccola.
- `inviatoDa` resta nella risposta pubblica (uid interno, serve per `creatoDa` della membership); toglierlo richiede di scrivere la membership lato server.
