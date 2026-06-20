# Guida modulo Magazzino

Questa guida è per chi ha **attivato il modulo Magazzino** sull'azienda. Senza quel modulo non troverete **Magazzino** nel menu **Moduli** né queste pagine.

Verificate **Abbonamento** o chiedete all'amministratore se il modulo non compare. Di solito le funzioni magazzino sono pensate per **Manager** e **Amministratore**; altri ruoli possono avere accessi più limitati.

---

## Percorso consigliato

1. **Moduli** → **Magazzino** → **home magazzino** (numeri, azioni rapide). **[Impara qui](#da-dove-si-entra)**
2. **Anagrafica prodotti** per censire prodotti, categorie, unità di misura e soglie. **[Impara qui](#mini-guida-anagrafica-prodotti)**
3. **Movimenti** per entrate e uscite che aggiornano le **giacenze**. **[Impara qui](#mini-guida-movimenti)**
4. **Tracciabilità consumi** per capire dove sono stati usati i prodotti (lettura e filtri). **[Impara qui](#tracciabilita-consumi)**
5. Se usate **Vigneto** o **Frutteto**, gli scarichi da trattamenti o concimazioni possono aggiornare il magazzino quando la configurazione lo prevede. **[Impara qui](#collegamento-con-vigneto-e-frutteto)**

---

## Indice delle sezioni

| Argomento | Vai alla sezione |
|-----------|------------------|
| Entrata e home magazzino | [Impara qui](#da-dove-si-entra) |
| Anagrafica prodotti (nuovo, filtri, categorie) | [Impara qui](#mini-guida-anagrafica-prodotti) |
| Movimenti (entrate, uscite, salvataggio) | [Impara qui](#mini-guida-movimenti) |
| Tracciabilità consumi | [Impara qui](#tracciabilita-consumi) |
| Sotto scorta e avvisi | [Impara qui](#sotto-scorta) |
| Collegamento Vigneto / Frutteto | [Impara qui](#collegamento-con-vigneto-e-frutteto) |
| Se qualcosa non compare | [Impara qui](#se-qualcosa-non-compara) |

---

## Da dove si entra

1. Dalla **dashboard principale** aprite **Moduli** e toccate **Magazzino** (📦). Se avete configurato **I miei accessi**, può esserci anche una scorciatoia lì.
2. **Senza Manodopera**, scorrendo **in fondo** alla dashboard potete trovare un **riquadro** **Magazzino** (eventualmente con avviso ⚠ se ci sono prodotti **sotto scorta**): è un’extra opzionale. Con **Manodopera** attivo i moduli verticali sono **solo** in **Moduli** o nelle scorciatoie. In **Richiede attenzione** possono comparire alert su prodotti sotto scorta che aprono direttamente il magazzino.
3. Arrivate alla **home del magazzino**: riepilogo con numeri (prodotti attivi, valore giacenza, eventuali **sotto scorta**), **azioni rapide** verso **Anagrafica prodotti**, **Movimenti** e **Tracciabilità consumi**.
4. Da lì usate i pulsanti o le schede per aprire la sezione che vi serve. Il pulsante **← Dashboard** riporta alla home generale.

---

## Cosa trovi nella home magazzino

- **Riepilogo**: conteggi utili a colpo d'occhio (prodotti, valore stimato, voci sotto soglia).
- **Azioni rapide**: scorciatoie verso le tre aree principali (anagrafica, movimenti, tracciabilità).
- **Avvisi**: se compaiono messaggi su prodotti sotto scorta, aprite **Anagrafica prodotti** o **Movimenti** per verificare giacenze e ultimi carichi/scarichi.

---

## Mini-guida: Anagrafica prodotti

Pagina **Anagrafica prodotti** (da home magazzino o menu).

### Filtri e lista

Di solito potete filtrare per **stato** (attivo / non attivo), **categoria** (es. fitofarmaci, fertilizzanti, sementi, altro, secondo come avete configurato l'azienda) e **ricerca testuale**. **Pulisci filtri** azzera le scelte.

La tabella mostra nome, categoria, unità di misura, giacenza, soglia di scorta, prezzo dove previsto, stato.

### Nuovo prodotto

1. **Nuovo prodotto** (o equivalente).
2. Compilate i campi richiesti in schermata: di regola **nome**, **categoria**, **unità di misura**, **scorta minima** (soglia per gli avvisi), **prezzo** se lo usate in contabilità interna.
3. Per i **fitofarmaci** possono comparire campi aggiuntivi (es. dosaggi, **giorni di carenza**): seguite le etichette e la normativa.
4. **Salva** per registrare. **Annulla** chiude senza salvare.

### Modifica ed eliminazione

**Modifica** sulla riga apre lo stesso modulo con i dati già presenti; **Salva** conferma. **Elimina** (se presente) chiede conferma: usatelo solo se siete sicuri, perché può essere legato a movimenti o registri di campo.

---

## Mini-guida: Movimenti

Pagina **Movimenti** (entrate e uscite).

### Lista e filtri

Potete filtrare per **tipo** (entrata / uscita), **prodotto** e a volte per **periodo** o testo di ricerca, secondo quanto offre la pagina. La lista mostra data, prodotto, tipo movimento, quantità, riferimenti utili (lavoro, attività, note).

### Nuovo movimento

1. **Nuovo movimento** (o **Registra movimento**).
2. Scegliete **prodotto** e **tipo**: **Entrata** (carico, acquisto, rettifica in positivo) o **Uscita** (scarico, uso, rettifica in negativo).
3. **Data** e **quantità** sono di solito obbligatorie; rispettate l'**unità di misura** del prodotto (kg, l, confezioni, ecc.).
4. Se la pagina lo permette, collegate il movimento a un **lavoro** o a un'**attività** quando lo scarico nasce da un intervento già registrato: aiuta la tracciabilità.
5. **Salva**. Dopo il salvataggio la **giacenza** del prodotto si aggiorna in base alla logica dell'app.

### Modifiche

Se è consentita la **modifica** o l'**eliminazione** di un movimento già registrato, usate le azioni sulla riga e confermate: le giacenze possono ricalcolarsi. Se non vedete il pulsante, il dato potrebbe essere bloccato da regole di sistema o permessi.

---

## Tracciabilità consumi

Pagina di **consultazione** (non sostituisce i movimenti manuali): mostra come i prodotti sono stati **consumati** nel tempo, spesso collegati a **terreno**, **categoria** e contesto di utilizzo (lavori, trattamenti, ecc.).

1. Aprire **Tracciabilità consumi** dalla home magazzino.
2. Impostare i **filtri** (categoria, terreno, vista **raggruppata** o **dettaglio**): usate i pulsanti di aggiornamento previsti in pagina prima di leggere i totali.
3. Le tabelle e i totali dipendono dai **movimenti** e dagli scarichi collegati ai moduli di campo: se mancano registrazioni, i numeri saranno incompleti.

---

## Sotto scorta

Un prodotto è spesso considerato **sotto scorta** quando la **giacenza** scende sotto la **scorta minima** impostata in anagrafica.

- Controllate prima se ci sono **movimenti** dimenticati o quantità errate.
- Correggendo i movimenti o registrando un'**entrata**, la giacenza torna coerente e l'avviso può sparire.

---

## Collegamento con Vigneto e Frutteto

Quando completate un **trattamento** o una **concimazione** in campo e avete spuntato (se previsto) la registrazione dello **scarico in magazzino**, l'app può creare o proporre il **movimento di uscita** collegato.

- I prodotti devono esistere in **anagrafica** con la stessa unità di misura che usate in campo.
- Se lo scarico non compare, verificate permessi, magazzino attivo e che il prodotto sia selezionabile dal registro.

---

## Se qualcosa non compare

- **Modulo non attivo** sull'abbonamento → niente voce **Magazzino** in **Moduli** (né riquadro in fondo pagina).
- **Giacenze strane** → controllate **movimenti** e unità di misura; spesso manca un carico iniziale.
- **Tracciabilità vuota o incompleta** → servono movimenti o scarichi registrati; la pagina è di lettura.
- **Non vedo il pulsante Nuovo** → ruolo o permesso insufficiente; chiedete al manager.

---

## Dove approfondire

- Guida **Core** (Terreni, Diario, Lavori).
- Guide **Vigneto** e **Frutteto** per i registri che generano consumi.
- Guida **Conto terzi** se collegate prezzi e offerte esterne.
