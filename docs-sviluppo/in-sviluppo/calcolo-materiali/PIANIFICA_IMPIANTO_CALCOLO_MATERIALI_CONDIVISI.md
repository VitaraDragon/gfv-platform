# Pianifica nuovo impianto e Calcolo materiali – Modulo condiviso

Documento di indirizzo per la realizzazione del modulo condiviso tra **Vigneto**, **Frutteto** e **Oliveto**.

---

## 1. Obiettivo

- **Pianifica nuovo impianto** e **Calcolo materiali** oggi presenti e funzionanti nel modulo Vigneto devono essere **riutilizzati** anche da Frutteto e Oliveto.
- Le funzioni sono **comuni** ai tre moduli: carraie, orientamento, sesto di impianto, forma di allevamento, calcolo file/ceppi-piante/pali/fili/materiali.
- Obiettivo: **un solo modulo condiviso** che funzioni per vigneto, frutteto e oliveto, con **stessa logica** e **stessa esperienza utente**, differenziando solo etichette, default e opzioni in base alla coltura.

---

## 2. Scelta architetturale: opzione C (ibrido)

- **Pagine condivise** per "Pianifica nuovo impianto" e "Calcolo materiali" (un'unica coppia di pagine/flusso).
- **Configurazione per coltura**: tutte le differenze (etichette, sesti tipici, forme di allevamento, eventuali opzioni) sono gestite tramite una **config per coltura** (vigneto, frutteto, oliveto), **senza "if" sparsi** nella UI.
- La pagina legge sempre da `config` (es. `config.etichettaUnita`, `config.sestiTipici`, `config.formeAllevamento`); non fa confronti diretti sul nome della coltura.
- **Vantaggi**: manutenzione semplice, estensione facile (nuova coltura = nuova config), UX identica tra i tre moduli.

---

## 3. Filtro / selettore coltura (Vigneto | Frutteto | Oliveto)

- Il **filtro (o selettore) coltura** presente in "Pianifica impianto" (e coerente in "Calcolo materiali") è l'elemento che **determina le differenze** tra i tre moduli.
- In base al valore selezionato (vigneto / frutteto / oliveto):
  - si carica la **config** corrispondente (etichette, default, forme di allevamento, opzioni);
  - la pagina si comporta sempre allo stesso modo, ma con testi e numeri adatti alla coltura scelta.
- **Precompilazione dai dati del terreno**:
  - quando l'utente arriva da un **terreno** (anagrafica terreni o anagrafica vigneto/frutteto/oliveto collegata a un terreno), il filtro coltura va **precompilato** con la coltura del terreno (es. terreno "Frutteto" → filtro già su "Frutteto");
  - altri campi derivabili dal terreno (es. **superficie**, **terrenoId** per associare la pianificazione) possono essere **precompilati** allo stesso modo.
- Quindi: **è il filtro coltura a guidare le differenze, e va precompilato (insieme ad altri dati) dai dati del terreno quando si arriva da un terreno.**

---

## 4. Modello dati e query

- **Un solo modello dati** per pianificazioni e calcoli materiali (stessa struttura per vigneto, frutteto, oliveto).
- **Un'unica collezione** (o tabella) con un campo **coltura** (es. `vigneto` | `frutteto` | `oliveto`).
- Le **query** sono le stesse per tutte le colture; al massimo si aggiunge un filtro sul campo `coltura` (es. "pianificazioni per questo utente/tenant e per coltura = frutteto").
- **Nessun "if" nelle query**: non si sceglie "quale query" in base alla coltura; si usa sempre la stessa logica di lettura/scrittura con filtro su `coltura` quando serve.
- Gli "if" restano **solo in UI e config** (quale config mostrare, quali etichette/default/opzioni), **non nella logica delle query**.

---

## 5. Attivazione moduli (uno solo o più insieme)

- Il modulo condiviso deve funzionare:
  - **con un solo modulo attivo** (es. solo Frutteto);
  - **con più moduli attivi** (es. Frutteto + Vigneto, o tutti e tre).
- **Accesso**: dalla **dashboard del singolo modulo** (Vigneto, Frutteto, Oliveto). Ogni dashboard ha il link a "Pianifica impianto" (e "Calcolo materiali") che apre le **stesse pagine** passando il **contesto coltura** (es. parametro `?coltura=frutteto`).
- Il modulo condiviso **non deve "contare" quanti moduli sono attivi**: riceve il contesto (coltura) dal link e applica la config corretta. Nessuna logica speciale per "solo un modulo" vs "più moduli".

---

## 6. Esperienza utente: moduli identici e familiari

- **Stesso flusso** per vigneto, frutteto e oliveto: stesse schermate, stessi passi (carraie, orientamento, sesto, forma di allevamento, risultati).
- **Stessa struttura**: stessi campi, stessi pulsanti, stessa disposizione; cambiano solo **etichette** (es. "ceppo" vs "pianta") e **valori di default** (sesti tipici, forme più usate).
- **Obiettivo**: l'utente che impara il flusso in un modulo (es. Vigneto) si ritrova **la stessa esperienza** in Frutteto e Oliveto, con sensazione di **familiare** e nessuna difficoltà aggiuntiva.

---

## 7. Riepilogo punti operativi

| Aspetto | Decisione |
|--------|-----------|
| Architettura | Opzione C: pagine condivise + config per coltura (vigneto / frutteto / oliveto). |
| Differenze tra moduli | Guidate dal **filtro/selettore coltura**; nessun "if" sparso in UI, solo lettura da config. |
| Precompilazione | Filtro coltura (e altri campi) **precompilati dai dati del terreno** quando si arriva da un terreno. |
| Dati | **Un'unica collezione** (o equivalente) con campo **coltura**; stesse query, eventuale filtro su coltura. |
| Query | Nessun "if" nelle query; "if" solo in UI/config. |
| Moduli attivi | Funziona con **uno solo** o **più moduli** attivi; il contesto arriva dal link (parametro coltura). |
| UX | **Identica** tra i tre moduli: stesso flusso, stessa struttura, solo config (etichette/default/opzioni) diversa. |

---

## 8. Prossimi passi (in sintesi)

1. ~~Definire la **config per coltura** (etichette, sesti tipici, forme di allevamento, eventuali opzioni) per vigneto, frutteto, oliveto.~~ ✅ **Fatto** – `shared/config/pianificazione-impianto-colture.js`
2. ~~Progettare/adeguare il **modello dati** unico (pianificazioni e calcoli materiali) con campo **coltura**~~ – Il modello `PianificazioneImpianto` aveva già `tipoColtura` (vigneto/frutteto/oliveto).
3. ~~Implementare o adattare la **pagina condivisa** "Pianifica nuovo impianto" in modo **config-driven**~~ ✅ **Fatto** – Pagina in `modules/vigneto/views/pianifica-impianto-standalone.html` legge `?coltura=` e applica config (etichette, default, forme allevamento, back link, modulo richiesto).
4. ~~Collegare le **dashboard** Vigneto e Frutteto alla stessa pagina con **parametro coltura**~~ ✅ **Fatto** – Vigneto: `pianifica-impianto-standalone.html?coltura=vigneto`; Frutteto: link a `../../vigneto/views/pianifica-impianto-standalone.html?coltura=frutteto`. Precompilazione **terrenoId** da URL supportata (`?terrenoId=...`).
5. **Da fare**: Calcolo materiali condiviso (stessa logica config-driven); eventuale precompilazione da anagrafica terreni/vigneto/frutteto/oliveto (passaggio terrenoId/superficie/coltura nel link).

---

*Documento di indirizzo – Pianifica impianto e Calcolo materiali condivisi (Vigneto, Frutteto, Oliveto). Ultimo aggiornamento: Pianificazione impianto condivisa implementata (2026-01-29).*
