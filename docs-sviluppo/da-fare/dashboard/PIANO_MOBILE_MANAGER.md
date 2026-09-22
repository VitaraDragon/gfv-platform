# Piano (bozza): telefono del manager / proprietario

**Stato:** **aperto — da decidere e perfezionare** (2026-09-19)  
**Non implementare** finché il product owner non chiude le voci in §4 e §8. Questo file raccoglie il ragionamento e le poche decisioni già ferme.  
**Per chi:** agenti e sviluppo che toccano **dashboard**, hub moduli, liste/tabelle standalone, form/modal, Tony in tasca per manager/admin.  
**Fonte:** conversazione 2026-09-19 (dopo il piano campo operai/caposquadra).  
**Registro:** `docs-sviluppo/TONY_DECISIONI_E_REQUISITI.md` §25.  
**Piano gemello (campo, decisioni chiuse):** `docs-sviluppo/da-fare/manodopera/PIANO_CAMPO_MOBILE_MULTILINGUA.md` — **non mescolare** i due lavori.  
**Piano look (pelle Proposta, rollback):** `docs-sviluppo/da-fare/ui/PIANO_PELLE_PROPOSTA_SU_APP.md` — chrome/sheet/sidebar e flag Prova/Pubblicata; **non** è questo file. Le card in tasca restano qui (§4.2).

**Analisi Coerenza Master Plan: [§3 Utenze — manager priorità media] + [Fase 2/4 config > codice]** — Una seconda app mobile manager non è scalabile: duplica decine di pagine, form e Tony. È scalabile **migliorare la stessa app** (home “oggi” + tabelle→card + form a una colonna) perché resta un solo mapping, un solo salvataggio, niente `if (ruolo === 'manager' && mobile)`.

---

## 1. Problema (come l’ha descritto il product owner)

Su **cellulare** la visualizzazione manager/proprietario **non è ottimale**: spesso **confusionaria**, soprattutto

- **tabelle** (molte colonne, scroll orizzontale, difficile capire la riga);
- **compilazione form** (modal da desktop, troppi campi, Salva lontano).

Domanda posta: *vale la pena sviluppare una versione mobile dedicata per manager o proprietario?*

---

## 2. Decisioni già ferme (non riaprire senza il product owner)

| # | Decisione | Motivo |
|---|-----------|--------|
| M1 | **Non** creare una seconda app «tipo campo» per manager/proprietario (niente `field-workspace-manager`, niente home a schede parallela alla dashboard) | Il manager ha tutto l’ERP (lavori, terreni, magazzino, preventivi, compensi, mappe, abbonamento). Duplicare = due prodotti, come la desktop campo che abbiamo deciso di chiudere |
| M2 | Il telefono del manager si sistema **nella stessa app** (dashboard / hub / standalone già esistenti) | Una home, un mapping form, un Tony |
| M3 | Lingua ufficio = **italiano**. Il multilinguismo IT/RO/EN è **solo** profilo campo (`PIANO_CAMPO_MOBILE_MULTILINGUA.md`) | Manager/admin restano in dashboard italiana (campo D8 / decisioni §24.9) |
| M4 | Account manager o amministratore (anche se ha anche capo/operaio) **resta** sulla dashboard ufficio, non sul workspace campo | Già vero in `shouldUseFieldMobileWorkspace` |
| M5 | Priorità di consegna rispetto al filo campo: **prima** (o comunque non al posto di) home unica + guasti + lingue per operaio/capo. Questo piano è **dopo** o in parallelo **leggero** | Chi *vive* sul telefono è il campo; il manager *guarda* il telefono |
| M6 | Non promettere «tutto l’ufficio in tasca» | Preventivo, anagrafiche pesanti, compensi, report: restano da tablet/PC |

Tutto il resto di questo file è **proposta**, non vincolo di implementazione.

---

## 3. Perché non una “versione mobile manager”

| Operaio / caposquadra | Manager / proprietario |
|-----------------------|------------------------|
| Pochi mestieri: lavoro, ore, messaggio, valida, guasto | Tutto l’ERP |
| 20 secondi, mani sporche | In vigneto o in auto: **vedere e sbloccare** |
| Una home a schede ha senso | Una home a schede *in più* è una seconda app |
| Piano campo: decisioni chiuse | Questo piano: da perfezionare |

Il mestiere in tasca del manager è: *«chi manca oggi?», «approva queste ore», «c’è un guasto»* — non ridisegnare un preventivo su 6 pollici.

Tony in tasca (comandi già esistenti, profilo **non** campo) vale più di un layout nuovo: «approva le ore di stamattina» senza cercare la colonna.

---

## 4. Direzione proposta (da chiudere col product owner)

Obiettivo in una frase, **se confermato**:

> Stessa dashboard/hub, usabile in tasca: in cima «cosa succede oggi», liste critiche a **card**, form **una colonna**. Niente terzo prodotto.

Quattro pezzi. **Nessuno è ancora uno spec chiuso** (quali liste, quale ordine, quanto del form si accorcia).

### 4.1 Home telefono = «cosa succede oggi»

La panoramica c’è già (`dashboard-hub.js`: criticità, oggi, accessi / chip moduli).

**Proposta:** su viewport stretto quella fascia sta **in cima**, a tutta larghezza, con **poche** azioni grandi (ordine e elenco da decidere), ad esempio:

- lavori da approvare / riprendere;
- ore da validare;
- allarmi squadra / assenze;
- guasto aperto;
- magazzino sotto scorta.

Il catalogo moduli (Vigneto, Magazzino, …) **sotto**, non una griglia di card piccole illeggibili.

**Aperto:** quante azioni (4 vs 6)? Solo manodopera o anche magazzino/meteo? Il proprietario senza ruolo manager vede la stessa home?

### 4.2 Tabelle → card solo dove serve in tasca

Oggi la linea guida (`LINEA_GUIDA_RESPONSIVE_STANDALONE.md`) prevede già:

- Opzione A: scroll orizzontale (`.table-responsive`) — **è quello che c’è** sulla maggior parte delle liste;
- Opzione B: ogni riga → **card** (`data-label`) — **preferibile** su smartphone, **non fatto** in modo sistematico.

**Proposta:** non convertire le 25+ tabelle. Solo le liste che si aprono **davvero dal campo**. Candidati da validare col product owner:

| Lista | Perché in tasca | Priorità proposta |
|-------|-----------------|-------------------|
| Gestione lavori | Stati, allarmi, approva/riprendi | Alta |
| Impegni del giorno | Chi c’è / manca | Alta |
| Validazione ore | Approvare dal vigneto | Alta |
| Guasti (gestione) | Urgenza mezzo fermo | Alta |
| Magazzino sotto scorta / movimenti recenti | Segnale operativo | Media |
| Preventivi in attesa | «C’è da accettare?» | Media / da confermare |
| Terreni, clienti, anagrafiche, report, abbonamento | Ufficio | Bassa — restano scroll o «apri da PC» |

Ogni card: **titolo + 2–3 fatti + un’azione**. Filtri e colonne complete restano da tablet/PC.

**Aperto:** conferma della shortlist; se le card sono CSS condiviso (Opzione B della linea guida) o un pattern nuovo; se Tony `currentTableData` resta la stessa riga (sì, va tenuto).

### 4.3 Form: non un secondo form

Stesso `tony-form-mapping.js`, stesso salvataggio, stesso injector.

**Proposta su telefono:** una colonna, obbligatori prima, Salva visibile (pollice), niente tabella dentro il modal. Non inventare form paralleli per «mobile manager».

**Aperto:** quali form si accorciano per primi (lavoro? assenza? movimento magazzino?)? I form lunghi (nuovo preventivo, terreno con mappa) restano «meglio da PC» — da scrivere in guida utente quando si chiude.

### 4.4 Accettare il limite

Da **non** ottimizzare come mestiere quotidiano sul telefono (proposta):

- creare lavoro completo (macchine, zone, assegnazioni complesse);
- nuovo preventivo / tariffe;
- compensi operai;
- report / bilancio;
- anagrafica terreni con disegno confine;
- abbonamento / utenti / impostazioni azienda.

Sul telefono: aprire, capire, approvare, chiamare. Il resto da tablet o PC.

---

## 5. Stato codice oggi (per chi perfeziona il piano)

| Pezzo | Oggi |
|-------|------|
| Home manager | `dashboard-standalone.html` + hub (`dashboard-hub.js`), quick bar, card moduli |
| Hub manodopera | `manodopera-home-standalone.html` — **solo** manager/admin (`PLAN_HUB_MODULO_MANODOPERA.md`) |
| Responsive | `core/styles/responsive-standalone.css` — breakpoint 1024 / 768 / 480 |
| Tabelle | Quasi ovunque **Opzione A** (scroll). JS condiviso tabella/filtri/modal: **non** implementato (linea guida §2.4) |
| Form | Modal/standalone per pagina; mapping Tony centralizzato |
| Workspace campo | Solo operaio/capo-only — manager **non** ci entra |
| Switch Prova/Pubblicata | Solo manager/admin in dashboard (§23) — da non rompere su viewport stretto |

Non manca «una versione mobile». Manca il **passaggio da tabella/form desktop a telefono** sulle superfici che il manager apre in tasca.

---

## 6. Cosa non fare (anche in bozza)

- Non clonare `field-workspace-standalone.html` per il manager.
- Non tradurre la dashboard in RO/EN «perché c’è il piano campo».
- Non riscrivere 75 HTML per un layout telefono.
- Non mettere `if (isMobile && formId === '…')` nel core Tony.
- Non implementare card su tutte le liste «per completezza».
- Non toccare il workspace campo in questo track (altro piano, altro ordine).
- Non dichiarare questo piano «chiuso» in un PR di codice senza aggiornare §8.

---

## 7. Relazione col piano campo

```
Telefono in azienda
├── Operaio / caposquadra-only → workspace mobile (+ lingue)     [piano CHIUSO, da fare]
└── Manager / proprietario / admin → stessa dashboard, più usabile [QUESTO piano, APERTO]
```

Due home restano **volute**: campo vs ufficio. Quello che non vogliamo è **due uffici** (dashboard + workspace manager) né **due campi** (mobile + desktop classica).

---

## 8. Da decidere (checklist product owner)

Segnare Sì / No / Più tardi. Finché è vuoto, l’agente **non** parte col codice.

| # | Domanda | Nota |
|---|---------|------|
| Q1 | Confermamo M1–M6 (niente seconda app; stessa dashboard; IT; dopo il campo)? | Default proposto: **sì** |
| Q2 | Quali 5–8 liste passano a card per prime? | Tabella §4.2 |
| Q3 | Home telefono: quali 4–6 azioni in cima? | Solo manodopera o anche magazzino/guasti/meteo? |
| Q4 | Proprietario senza manager: stessa home o più «numeri» e meno comandi? | Master Plan: proprietario = tutto + report |
| Q5 | Form: solo CSS una colonna, o anche nascondere campi avanzati su telefono? | Nascondere = prodotto, va deciso per form |
| Q6 | Preventivi / sotto scorta in tasca: sì o «apri da PC»? | |
| Q7 | Quanto «parallelo leggero» col piano campo? Zero finché Fase 1 campo non è mergiata, o card su 1–2 liste subito? | Proposta: **dopo** Fase 1 campo (home+guasti operai) |
| Q8 | Criterio done della prima fetta? | Proposta: dashboard + 2 liste (lavori + ore da validare) usabili a 390px senza scroll orizzontale sulla riga |

---

## 9. Quando si potrà implementare (solo dopo §8)

Ordine **indicato**, non impegnativo:

1. Home dashboard stretta: blocco «oggi» in cima, azioni grandi, moduli sotto.  
2. Pattern card riusabile (CSS/convenzione `data-label`, allineato alla linea guida Opzione B) su **una** lista pilota (Gestione lavori o Validazione ore).  
3. Stesso pattern sulle altre liste della shortlist chiusa in Q2.  
4. Form: una colonna + Salva visibile sui form della pilota, **senza** nuovo mapping.  
5. Guida utente manager (GUIDA + checklist) quando il comportamento telefono è stabile.

Verifica: telefono **e** desktop — il desktop non deve peggiorare (stesse colonne, stessi filtri).

---

## 10. Riferimenti

| Cosa | Path |
|------|------|
| Piano campo (chiuso) | `docs-sviluppo/da-fare/manodopera/PIANO_CAMPO_MOBILE_MULTILINGUA.md` |
| Responsive / tabelle | `docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md` |
| Hub manodopera | `docs-sviluppo/manodopera/PLAN_HUB_MODULO_MANODOPERA.md` |
| Hub dashboard | `core/js/dashboard-hub.js`, `dashboard-standalone.html` |
| Performance dashboard | `docs-sviluppo/dashboard/PLAN_PERFORMANCE_DASHBOARD.md` |
| Priorità ruoli Tony | `docs-sviluppo/tony/MASTER_PLAN.md` §3 |
| Form | `core/config/tony-form-mapping.js` |

---

## 11. Come usare questo file

- **Agente:** leggi §2 (vincoli) e §6 (divieti). Se il compito è «fai la mobile manager», **non** implementare: fai perfezionare §8 col product owner.  
- **Product owner:** completa §8; poi si aggiorna lo **Stato** in testa a «direzione chiusa, da fare» e si allinea `TONY_DECISIONI` §25.  
- **Non** creare altri `TONY_*_MOBILE.md` sparsi.

| Revisione | Data | Cosa |
|-----------|------|------|
| Bozza 0 | 2026-09-19 | Prima stesura da conversazione (niente codice) |
