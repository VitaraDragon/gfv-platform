# Modulo Terreni

Blocco della guida dedicato alla gestione dei terreni: creazione, modifica, eliminazione, tracciamento confini sulla mappa e visualizzazione sulla mappa aziendale. Include il contesto delle zone lavorate (dove si tracciano e da chi).

---

## 1. Titolo

**Terreni** – Gestione terreni, tracciamento confini e mappa aziendale.

---

## 2. Scopo

Permettere all’utente di **creare, modificare ed eliminare** i terreni dell’azienda, di **tracciare il perimetro** di ogni terreno sulla mappa (con calcolo automatico della superficie) e di **visualizzare tutti i terreni** sulla mappa aziendale. I terreni sono la base per attività, lavori e moduli (Vigneto, Frutteto, ecc.); le **zone lavorate** (segmenti di terreno effettivamente lavorati) si tracciano in contesto **lavoro** (moduli Vigneto/Frutteto), non nella pagina Terreni.

---

## 3. Dove si trova

- **Menu / navigazione:** Dashboard → **Terreni** (card "Terreni" o "Apri Terreni").
- **Percorso:** `terreni-standalone.html` (dalla root core).
- **Mappa aziendale:** nella Dashboard, sezione "Vista Mappa Aziendale" (con filtri podere/coltura e opzione "Zone Lavorate" / "Indicatori Lavori" se il modulo Manodopera è attivo).

---

## 4. Funzionalità principali

- **Creazione terreno:** pulsante "Aggiungi nuovo terreno" (o equivalente); si apre un modulo (modal) con form (nome, superficie, coltura, podere, tipo possesso, data scadenza affitto se in affitto, canone, note) e mappa. Nome è obbligatorio; superficie può essere inserita a mano o **calcolata tracciando i confini** sulla mappa.
- **Modifica terreno:** dalla tabella/elenco terreni, pulsante "Modifica" su una riga; si apre lo stesso modulo con dati precompilati; i confini già tracciati vengono caricati sulla mappa e si possono modificare trascinando i **vertici** (pallini verdi).
- **Eliminazione terreno:** azione di eliminazione dall’elenco (con eventuale conferma). Attenzione: terreni collegati ad attività o lavori possono richiedere gestione coerente (limitazioni in §6).
- **Tracciamento confini:**
  - **Ricerca indirizzo:** campo "Cerca" sulla mappa permette di digitare un indirizzo e centrare la mappa su quel punto (geocoding).
  - **Attivazione disegno:** pulsante **"✏️ Traccia Confini"** attiva la modalità disegno; il cursore diventa a croce. Cliccando sulla mappa si aggiungono **punti (vertici)** al perimetro. Per un nuovo terreno si inizia da zero; in modifica i vertici esistenti sono già visibili e **editabili** (trascinamento).
  - **Chiusura e forma:** il poligono si costruisce punto per punto; si può **trascinare** l’intero poligono o i singoli vertici. Servono **almeno 3 punti** per avere un’area valida.
  - **Superficie calcolata:** l’area viene calcolata in tempo reale (Google Maps Geometry: `computeArea` in m², convertita in ettari). Il valore viene scritto nel campo **Superficie** del form; se si modifica il perimetro, la superficie si aggiorna. È possibile anche inserire manualmente la superficie; il valore dalla mappa ha priorità se presente.
  - **Stop / Cancella:** "⏹️ Stop Tracciamento" disattiva il disegno; è disponibile un’azione per **cancellare** il poligono tracciato (e azzerare la superficie da mappa).
- **Validazioni form:** nome obbligatorio; superficie non negativa; se tipo possesso è "affitto", data scadenza affitto obbligatoria; canone non negativo; tipo campo (se usato) deve essere uno tra pianura, collina, montagna. Messaggi di errore espliciti in caso di validazione fallita.
- **Visualizzazione su mappa aziendale:** nella Dashboard, sezione "Vista Mappa Aziendale" vengono mostrati tutti i terreni del tenant con i loro confini sulla mappa satellitare. Filtri per **podere** e **coltura** restringono i terreni visibili. Con modulo Manodopera attivo: pulsanti **"Zone Lavorate"** e **"Indicatori Lavori"** per mostrare/nascondere overlay delle zone lavorate e indicatori stato lavori.

### Zone lavorate (contestualizzate ai terreni)

- **Cosa sono:** le zone lavorate sono i segmenti/aree di terreno effettivamente lavorati in un **lavoro** (es. trattamento, vendemmia, potatura, raccolta).
- **Dove si tracciano:** non nella pagina Terreni, ma nelle pagine dei **moduli Vigneto e Frutteto** (Trattamenti, Vendemmia, Potatura, Raccolta frutta) quando si lavora su un **lavoro** assegnato a un terreno. Il terreno deve avere **confini già tracciati**; altrimenti l’app può mostrare un messaggio tipo "Il terreno non ha confini tracciati. Traccia prima i confini del terreno."
- **Dove si salvano:** sotto il documento **lavoro** nel tenant: `tenants/{tenantId}/lavori/{lavoroId}/zoneLavorate`.
- **Da chi:** in genere il **caposquadra** (o chi segna le ore / gestisce il lavoro) traccia le zone lavorate nel contesto del modulo (es. trattamento vigneto, raccolta frutta). Dettagli su ruoli e flussi in Lavori e attività e nei moduli Vigneto/Frutteto.
- **Relazione con terreni:** ogni zona lavorata è associata a un lavoro che è a sua volta associato a un terreno; la superficie lavorata contribuisce a statistiche e totali (es. superficie totale lavorata per lavoro).

---

## 5. Termini specifici

| Termine | Definizione breve |
|--------|--------------------|
| **Terreno** | Unità di suolo gestita dall'azienda: nome, superficie, coltura, podere, tipo possesso (proprietà/affitto), eventuale perimetro sulla mappa. |
| **Confini / perimetro** | Sequenza di punti (vertici) sulla mappa che delimitano l’area del terreno; si tracciano con "Traccia Confini". |
| **Vertice** | Punto del perimetro; in modifica si possono trascinare i vertici (pallini verdi) per modificare la forma. |
| **Superficie (da mappa)** | Area del poligono calcolata automaticamente (Google Maps Geometry) in ettari; si aggiorna in tempo reale mentre si traccia o si modificano i vertici. |
| **Podere** | Unità organizzativa aziendale a cui può essere associato il terreno; usato per filtri e report. |
| **Coltura** | Tipo di coltivazione (es. vigneto, frutteto); lista gestita a livello aziendale; usata per filtri e colori sulla mappa. |
| **Tipo possesso** | "proprietà" o "affitto"; se "affitto" sono richiesti data scadenza affitto e opzionalmente canone. |
| **Mappa aziendale** | Vista nella Dashboard che mostra tutti i terreni (o filtrati per podere/coltura) con i loro confini sulla mappa. |
| **Zone lavorate** | Aree/segmenti di terreno effettivamente lavorati in un lavoro; tracciate nei moduli Vigneto/Frutteto, salvate sotto il documento lavoro. |

---

## 6. Limitazioni e regole

- **Permessi:** la gestione terreni (crea, modifica, elimina) è tipicamente disponibile per **manager** e **amministratore**; altri ruoli possono avere sola lettura o nessun accesso (dipende dalla configurazione app). La **mappa aziendale** e la **visualizzazione** terreni seguono le stesse regole di visibilità dati per tenant e ruolo.
- **Limiti piano:** con piano **Free** sono consentiti al massimo **5 terreni**; oltre è necessario piano Base.
- **Tracciamento confini:** richiede **Google Maps** (chiave API configurata) e libreria **Geometry**; se Maps non è disponibile, la mappa non viene caricata e non è possibile tracciare i confini (la superficie può essere inserita solo a mano).
- **Zone lavorate:** per tracciare zone lavorate in Vigneto/Frutteto il **terreno** del lavoro deve avere **confini già tracciati**; altrimenti l’app segnala di tracciare prima i confini nella pagina Terreni.
- **Eliminazione:** eliminare un terreno può avere conseguenze su attività, lavori e moduli collegati; l’app può impedire l’eliminazione se ci sono riferimenti attivi o richiedere conferma.
- **Terreni clienti (Conto terzi):** i terreni possono essere associati a un **cliente** (`clienteId`); in quel caso compaiono in contesti Conto terzi e possono avere campo **tipo campo** (pianura, collina, montagna). La lista Terreni può filtrare tra terreni aziendali e terreni per cliente.

---

## 7. Relazioni con altri moduli

- **Core (Attività, Statistiche):** le attività e le statistiche usano i terreni (associazione terreno–attività, ore per terreno, ecc.).
- **Lavori e attività:** i lavori sono associati a un terreno; le **zone lavorate** sono salvate sotto il lavoro e richiedono che il terreno abbia confini tracciati.
- **Vigneto / Frutteto:** trattamenti, vendemmia, potatura, raccolta lavorano su terreni e su lavori; le zone lavorate si tracciano in quelle pagine. Da un terreno si può aprire il modulo Vigneto o Frutteto (link contestuali) se il modulo è attivo.
- **Dashboard / Mappa aziendale:** visualizza i terreni; con Manodopera attivo mostra anche overlay zone lavorate e indicatori lavori.
- **Conto terzi:** terreni possono essere di clienti (clienteId); gestione clienti e preventivi/lavori per terzi si collega ai terreni cliente.
- **Impostazioni:** i **poderi** e le **colture** sono configurati a livello aziendale (liste condivise); la pagina Terreni usa podere e coltura dai dati aziendali.

Dettagli sui flussi che coinvolgono più moduli (es. terreno → lavoro → zone lavorate → attività) in **Intersezioni tra moduli** (`intersezioni-moduli.md`).
