# GFV – valori da etichetta (dosi, carenze, trattamenti)

> **GFV mostra solo quanto riportato in etichetta, non consiglia dosi.**
> Fa fede l'etichetta autorizzata dal Ministero della Salute (link in `url_etichetta`).

Generato il 17/11/2026 (ora di Roma) dalle 58 etichette in
`/workspace/archivio-etichette-fitofarmaci/2026-11-16/` (7) e `2026-11-17/` (51).

## File
- `valori.json` (v3, 17/11/2026; stesso schema `GFV valori etichetta 1.1`): `meta` (schema `GFV valori etichetta 1.1`, data, avviso, conteggi, `segnalazioni_aperte`) + `etichette` (copertura per etichetta) + `righe`.
- `valori-v2.json` / `valori-v2.csv`: versione precedente (v2), conservata invariata.
- `valori-v1.json` / `valori-v1.csv`: versione ancora precedente (prima della revisione del campione di 120 valori), conservata invariata.
  Una riga = prodotto × coltura × avversità (× epoca, se l'etichetta la distingue).
  Contiene **solo** valori confermati (`confermato_2_su_2` o `deciso_dal_terzo`).
- `valori.csv`: gli stessi dati, una riga per valore, **più** i valori proposti e scartati
  (`stato = lasciato_vuoto`, campi numerici vuoti) così si vede cosa manca e perché.
- `scarti.json`: valori proposti e non confermati, con citazione ed esiti dei verificatori. Non va nel prodotto.
- `estrazioni/<reg>.txt`: estrazione fatta leggendo l'etichetta (formato descritto sotto).
- `colture-vocabolario.json`: vocabolario unico delle colture (gruppi con elenco standard, categorie generiche, sinonimi, coltura «padre»).
- `segnalazioni.json`: esito del controllo automatico su eccezioni/sotto-limiti/«altre colture» (vedi sotto).
- Script: `normalizza.py` (colture, epoca, colture citate), `controllo_eccezioni.py`, `parse_dsl.py`, `verifica_a.py`, `verifica_b.py` (+ `tabelle_b.py`), `verifica_c.py`, `combina.py`
  (rigenera tutto: `.venv/bin/python combina.py`), `chk.py <reg>` (controllo rapido di un'estrazione).

## Campi (JSON)
Riga: `id`, `numero_registrazione`, `nome_prodotto`, `file_pdf`, `url_etichetta` (da `INDICE.csv`), `coltura`, `avversita`, `epoca`.
Campi aggiunti in v2:
- `coltura` resta il **testo d'etichetta**; `colture` è la lista normalizzata (minuscolo, senza asterischi, sinonimi risolti:
  kiwi→actinidia, nettarine→nettarina, broccoli→cavolo broccolo, anguria→cocomero, …). Gli elenchi scritti in etichetta sono
  espansi come scritti («Fagiolo, fagiolino, fava» → fagiolo, fagiolino, fava; «DRUPACEE (pesco, …)» → colture elencate).
- `gruppo`: gruppo citato (agrumi, pomacee, cereali, lattughe e insalate, cavoli a testa, …). Se l'etichetta scrive solo il gruppo
  senza elenco, `colture` contiene l'**elenco standard GFV** del gruppo e `colture_da_elenco_standard: true` (non è testo d'etichetta).
  Categorie troppo generiche (orticole, floreali, ornamentali, vivai, forestali, aree non agricole) restano come categoria.
- `ambiente` (es. «pieno campo», «serra») ed `esclusioni` (es. «baby leaf», «cavoletti di bruxelles») presi dalla dicitura.
- `epoca`: solo epoche/fasi vere (stadi, mesi, pre/post-emergenza, …), altrimenti `null`. Il resto (es. «diserbo», «spollonatura»,
  «in banda lungo la fila», «con 2 applicazioni», «prime 2 applicazioni») va in `modalita`; il testo originale resta in `epoca_testo_estrazione`.
- `avvisi_controllo`: presente solo sulle righe segnalate dal controllo automatico (frase d'etichetta non rappresentata).
- `colture_non_estratte_etichetta`: copia, sulla riga, delle colture non estratte della sua etichetta.

`etichette[]`: `numero_registrazione`, `nome_prodotto`, `url_etichetta`, `colture_estratte`, `colture_non_estratte`, `nota`.
`colture_non_estratte` = colture del vocabolario citate nella sezione d'impiego e non presenti in nessuna riga
(rilevamento automatico: esclude frasi su fitotossicità, colture limitrofe/successive/di sostituzione, esclusioni). L'app deve
mostrare «non ancora estratto, vedi etichetta», **mai** dedurre che il prodotto sia autorizzato su quella coltura.
Liste di valori (ognuna può avere più voci con condizioni diverse):
- `dose_ha`: `min`, `max`, `unita` (l/ha, kg/ha, ml/ha, g/ha), dose di formulato per ettaro;
- `dose_hl`: `min`, `max`, `unita` (ml/hl, l/hl, g/hl, kg/hl), dose per 100 litri d'acqua;
- `carenza`: `giorni` oppure `non_necessario: true`;
- `max_trattamenti`: `numero`, `periodo` (anno, ogni 2 anni, ciclo, stagione, o vuoto se l'etichetta non lo dice);
- `intervallo_giorni`: `min`, `max` (giorni tra trattamenti);
- `volume_acqua`: `min`, `max` in l/ha, solo se scritto in etichetta.

Ogni voce ha: `condizione` (es. «trattamento tardivo», «dose massima», «in serra»), `pagina` (pagina del PDF),
`citazione` (frasi esatte dell'etichetta; i frammenti non contigui sono separati da « … »),
`da_regola_generale` (true se il valore viene da una frase valida per più colture, es. elenco delle carenze),
`verifica` {`a`,`b`,`c`,`stato`,`motivi`}.
CSV: `id, numero_registrazione, nome_prodotto, coltura, colture (separate da |), gruppo, avversita, epoca, modalita, campo, min, max, unita, giorni, non_necessario, numero, periodo, condizione, pagina, citazione, verifica_a, verifica_b, verifica_c, stato`.

Unità: come in etichetta. Nessuna conversione ml/hl → l/ha: un valore per ettaro c'è solo se l'etichetta lo scrive
(es. «80 ml/hl … 0,375 l/ha», «(15-30 l/ha)»). Decimali con punto nel JSON (0.375).

## Metodo
1. Testo con `pdftotext` (poppler). Tutte le 58 etichette hanno testo estraibile; nessuna scansione.
2. Estrazione: lettura di ogni etichetta e trascrizione in `estrazioni/` di valore + pagina + citazione esatta.
   Dati mancanti o ambigui non vengono scritti (es. «2-4 trattamenti» senza «massimo», colonne «applicazioni» senza «max»,
   «0,5 l/hl» scritto per un prodotto in kg, intestazioni di tabella solo nella pagina precedente).
3. Verifica a due, alla cieca (nessun verificatore vede l'esito dell'altro):
   - **A**: testo poppler della pagina indicata; la citazione deve esserci e contenere numeri e unità del valore.
   - **B**: testo PyMuPDF di tutta l'etichetta, **senza** citazione né pagina; cerca il valore vicino alla coltura e all'avversità
     (frase o riga di tabella, con pdfplumber per le tabelle).
   - A e B d'accordo → `confermato_2_su_2`.
   - In disaccordo → **C** (pdfplumber, righe e intestazioni di tabella, anch'esso senza citazione):
     se conferma → `deciso_dal_terzo`, altrimenti → `lasciato_vuoto`.
   I tre verificatori sono **programmi automatici indipendenti** (motori di testo e logiche diverse), non riletture umane.
   Prova di controllo con valori volutamente sbagliati: B ne ha accettati 0/8, C 1/8.
4. Controllo obbligatorio Sivanto Prime (016273) su fagiolino, afidi: 80 ml/hl; 0,375 l/ha; 1 trattamento/anno se tardivo,
   1 ogni 2 anni se precoce; carenza 7 giorni se tardivo, non necessaria se precoce. Tutti `confermato_2_su_2`.

## Controllo automatico (`controllo_eccezioni.py`, gira dentro `combina.py`)
Per ogni etichetta divide la sezione d'impiego in frasi e cerca:
- `altre_colture`: frasi di carenza con «altre colture / restanti colture / tutte le altre» → segnala le righe senza carenza
  (o con carenza condizionata solo a metà di una coppia precoce/tardivo, pieno campo/serra);
- `sotto_limite`: «non più di / al massimo N … tra lo stadio … e …», «primi/ultimi N trattamenti», «di cui N»;
- `eccezione_avversita`: «contro X … un (solo) trattamento/applicazione/intervento».
Una frase è rappresentata se una citazione di un valore confermato della riga interessata (avversità più simile, altrimenti coltura)
la copre. Le non rappresentate finiscono in `segnalazioni.json` (`stato: aperta`) e in `avvisi_controllo` delle righe.
`presente_solo_in_valori_scartati: true` = il valore era stato estratto ma i verificatori non l'hanno confermato.
Frasi già esaminate e non trasformabili in valore si possono chiudere in `eccezioni_esaminate.json`
(`{"<reg>": [{"frase_contiene": "...", "motivo": "..."}]}`). Prova: sulla v1 il controllo trova 4 dei 4 casi del campione
(Sivanto fagiolo, Century Pro ×2, Jade); Nando Maxi (condizione su valore sbagliato) non è di questo tipo ed è stato cercato a mano.

## Correzioni v2 (revisione campione di 120 valori)
- Nando Maxi (014165) melo: intervallo 6-10 gg senza condizione + 12-14 gg «dopo la fase di frutto noce e/o in periodi senza piogge»
  (in v1 la condizione era attaccata al 6-10). Ricerca di casi simili su tutte le condizioni di intervallo/trattamenti:
  trovato e corretto Corum (014884): max 1 applicazione con 1,25 l/ha, 2 con 0,62 l/ha (soia 1,875 / 0,95).
- Century Pro (016657): noce antracnosi/mal secco 6/anno + max 4 tra rottura gemme e fine fioritura; mal dell'inchiostro 4/anno
  (primi 2 tra fine fioritura e prima cascola, ultimi 2 a colorazione dei frutti). Su castagno e nocciolo gli stessi valori restano vuoti (B e C non confermano).
- Jade (017472): nuova riga frumento duro/tenero «Fusariosi della spiga», 1 trattamento da fine spigatura a fioritura.
- Sivanto Prime (016273): fagiolo e pisello senza baccello, carenza 3 gg per trattamento tardivo («3 giorni prima del raccolto per le altre colture»);
  fagiolino resta 7 gg tardivo (citato espressamente: «fave e fagiolini (trattamento tardivo)»).

## Limiti noti
- Jade (017472): PyMuPDF estrae solo l'intestazione del PDF, quindi il verificatore B non può confermare nulla; i valori Jade
  passano solo con A + C.
- Copertura: per le etichette rameiche e quelle con tabelle lunghe sono state estratte le colture principali, non tutte.
- Valori divisi da un cambio pagina o da parole spezzate («finoc-chio», «applica-zioni») spesso restano vuoti.
- Tabelle con intestazione solo nella prima pagina (es. Airone Liquido, Bordoflow New pag. 2): i valori della seconda pagina
  restano vuoti o non sono stati estratti.
- Erbicidi a dose per gruppo di infestanti (glifosate: Clinic ST, Glifene Biograde, Sitrin): molti valori restano vuoti
  perché la dose non è vicina al nome della coltura.
- Revolution (016667): PDF con testo da OCR rovinato in alcune frasi («Iitrilha»): quelle frasi non sono state usate.
- 7 estrazioni (000013, 001583, 008601, 011070, 015401, 015712, 016562) vengono dal set di prova fatto a mano in
  `set-prova/`; le loro citazioni non sono sempre letterali, quindi hanno più valori vuoti.
- Carenze scritte come fase («sospendere a fine fioritura», Jade) non sono state convertite in giorni.

## Provenienza e licenza
- Etichette: Banca dati prodotti fitosanitari del Ministero della Salute («ultima etichetta autorizzata»), scaricate il 16 e 17/11/2026;
  link di ogni etichetta in `url_etichetta`. Anagrafica: open data Ministero della Salute, licenza IODL 2.0.
- Indicazioni di Coord Legale (non parere legale): i PDF restano solo per sviluppo, **non vanno nel prodotto** e non si ripubblicano.
  Nel prodotto possono andare solo i dati di fatto confermati, legati al numero di registrazione, con l'avviso che fa fede l'etichetta autorizzata.
  Le citazioni servono per il controllo interno; prima di mostrarle agli utenti va sentito Coord Legale.
- Questo database non è un consiglio agronomico: GFV mostra solo quanto riportato in etichetta, non consiglia dosi.

## Correzioni v3 (17/11/2026): Folpan 80 WDG e righe «tutte vuote»
**Segnalazione:** FOLPAN 80 WDG (reg. 008601), vite da vino / peronospora, aveva dose, carenza, massimo e intervallo vuoti, anche se l'etichetta (pag. 1) li riporta.
**Causa:** non era l'estrazione. Il verificatore A (testo + citazione letterale) confermava già i valori; i verificatori B e C li scartavano per il layout:
frasi con la dose prima dell'avversità, coltura composta «uva da vino / uva da tavola» che non coincideva con «vite», colture citate in un'altra colonna o in un altro paragrafo,
elenchi con parentesi, nomi di gruppo (agrumi, pomacee, frutteti), sillabazione e salti pagina, e C che univa colonne nelle etichette A4 orizzontali.
Per la regola «2 su 2» un valore confermato solo da A restava vuoto: in v2 erano 1662 dei 1783 valori vuoti.
**Cosa è cambiato (le regole NON sono state abbassate):** ogni valore ha ancora pagina + citazione e deve passare A e B indipendenti; C decide solo sui disaccordi; nel dubbio resta vuoto.
- B: alias di coltura e di gruppo, parentesi, avversità dopo la dose, sillabazione, pagine unite, «per uva da tavola…» dopo il numero (solo in prosa).
- C: lettura per colonne (A4 orizzontali), alias di coltura composta, avversità dopo la dose, composti più severi per i massimi trattamenti.
- Estrazioni: citazioni rese letterali per 008601, 000013, 015251; Folpan uva da tavola ha il massimo 4 con la condizione «con clima siccitoso».
**Risultato:** valori confermati 2 su 2 7285 → 7881, decisi dal terzo 349 → 317, lasciati vuoti 1783 → 1219 (totale 9417), segnalazioni aperte 4 → 2.
Righe con dose, carenza, massimo e intervallo tutti vuoti: 340 (10 prodotti, 147 sospette) → 89 (4 prodotti, 43 sospette). `diffusione-v2.json` / `diffusione-v3.json`.
**Limiti noti:** restano vuoti per scelta i diserbanti con dosi per singola infestante (glifosate), le tabelle ambigue, le citazioni non letterali fatte a mano e i casi «N per quelle in pieno campo».
Prova con valori sbagliati (`prova_valori_sbagliati.py`, 300 casi): numeri alterati accettati da B 6, da C 10; coltura scambiata accettata da B 65 (21,7%), da C 43 (14%): è un limite dei controlli euristici (prima 18% e 12%), non nascosto.
**Audit a mano v3:** 145 valori (35 nuovi in v3, 30 Folpan, 80 altri), 0 numeri sbagliati, 3 incompleti poi corretti: `audit-v3/audit-campione-v3.md`.
GFV non consiglia dosi: mostra solo ciò che dice l'etichetta.
