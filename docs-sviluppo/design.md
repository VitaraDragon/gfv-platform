# GFV Platform — design system (riferimento + Stitch)

**Scopo:** singolo file per allineare UI, esperimenti (es. Google Stitch) e futuro refactoring CSS.  
**Fonte codice:** `core/styles/dashboard.css`, `core/styles/tony-widget.css`, `core/styles/responsive-standalone.css`, `docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md`, più **gradient e `theme-color` inline** nelle `*-standalone.html` di core e moduli.

**Nota:** molte pagine standalone duplicano ancora stili inline. Il **verde Sea Green (`#2E8B57`)** è l’identità **Core** (home dashboard, Tony, gran parte dell’amministrazione manodopera). I **moduli applicativi** usano **famiglie cromatiche distinte** (sfondo pagina a gradiente + header coordinato) per orientare l’utente sul contesto anche con attenzione ridotta: vedi **§2.1**.

---

## 1. Prodotto e contesto

- **Nome:** GFV Platform — ERP agricolo (multi-modulo: terreni, manodopera, magazzino, vigneto, frutteto, ecc.).
- **Lingua UI:** italiano.
- **Utenti:** desktop in ufficio + smartphone/tablet in campo; touch-friendly (aree cliccabili ~44px dove possibile).
- **Dashboard home (manager/admin):** panoramica a **griglia di card** (fino a 5 per riga su desktop, come le home modulo); la **mappa satellitare aziendale** è su **`core/mappa-aziendale-standalone.html`** (voce **Mappa** in header).

## 2. Brand e colore

### 2.0 Principio: Core vs moduli (orientamento cromatico)

- **Core / GFV “neutro”:** dashboard home, terreni, diario attività, molte pagine **admin manodopera**, statistiche core, widget **Tony** → predominio **verde Sea Green** `#2E8B57` / `#228B22`, spesso body chiaro `#f5f7fa` sulla dashboard.
- **Moduli:** molte standalone usano **sfondo a gradiente 135deg** (tinta pastello → saturazione più forte) e **header a gradiente** nella stessa famiglia, più **`meta theme-color`** per browser/status bar. Obiettivo UX: **capire subito in quale modulo ci si trova** anche se distratti.
- **Tony** resta sul verde Core ovunque: è il “canale assistente globale”, non un modulo dati.
- **Magazzino vs Core:** entrambi “verdi” ma **tonalità diverse** (Material green `#2E7D32` / `#1B5E20` sul magazzino vs Sea Green sul core): volutamente vicini al dominio “natura” ma **discriminabili**.

### 2.1 Mappa moduli (valori ricorrenti nelle standalone)

Valori tipici (piccole variazioni possono esistere tra pagine). Body = gradiente pagina; Header = barra titolo in alto.

| Area | `theme-color` / accent | Body (gradient 135deg) | Header (gradient 135deg) |
|------|-------------------------|-------------------------|---------------------------|
| **Core** (dashboard home) | `#2E8B57` | `#f5f7fa` (tinta unita) | `#2E8B57` → `#228B22` |
| **Core** (terreni, attività, segnatura ore, molte admin) | `#2E8B57` | spesso `#2E8B57` → `#228B22` | stesso o simile |
| **Vigneto** | `#6A1B9A` | `#E1BEE7` → `#6A1B9A` | `#6A1B9A` → `#4A148C` |
| **Frutteto** | `#FF6F00` | `#FFE0B2` → `#FF6F00` | `#FF6F00` → `#E65100` |
| **Magazzino** | (verde modulo) | `#E8F5E9` → `#2E7D32` | `#2E7D32` → `#1B5E20` |
| **Conto terzi** | `#1976D2` | `#E3F2FD` → `#1976D2` | `#1976D2` → `#1565C0` |
| **Parco macchine / guasti lista** | teal | `#E0F7FA` → `#80DEEA` | `#0097A7` → `#006064` |
| **Report** | `#1F2937` | grigio/scuro (`#111827` → `#374151` ecc.) | `#1F2937` → `#111827` (stile analytics scuro) |
| **Segnalazione guasti** (admin dedicata) | rosso | `#dc3545` → `#c82333` | allineato (allerta) |

**Pagine “coltura” condivise** (`pianifica-impianto`, `calcolo-materiali`): oltre al default vigneto in viola, da query `coltura` possono applicarsi temi **frutteto** (arancio) o **oliveto** (verde `#2E7D32`); vedi `shared/config/pianificazione-impianto-colture.js` e script inline in quelle view.

### 2.2 Token globali (superfici, testo, neutri)

| Token | Valore | Uso |
|--------|--------|-----|
| `--color-primary-core` | `#2E8B57` (Sea Green) | Core, Tony, molte admin |
| `--color-primary-core-dark` | `#228B22` | Seconda stop gradienti Core / Tony |
| `--color-page-bg` | `#f5f7fa` | Body dashboard home |
| `--color-surface` | `#ffffff` | Card sezioni, pannelli, legenda mappa |
| `--color-text` | `#333333` | Testo principale |
| `--color-text-muted` | `#666666` | Descrizioni, date secondarie |
| `--color-text-disabled` | `#999999` | Empty state |
| `--color-border` | `#dddddd` | Input, bordi leggeri |
| `--color-neutral-soft` | `#f8f9fa` → `#e9ecef` | Gradient stat-card, sfondo action-card |
| `--color-danger` | `#dc3545` | Errori, flussi allerta |

**Gradiente brand Core + Tony (FAB, header chat, header dashboard home):**  
`linear-gradient(135deg, #2E8B57 0%, #228B22 100%)`

**Ombre ricorrenti:**  
`0 2px 4px rgba(0,0,0,0.1)` (card), `0 4px 6px rgba(0,0,0,0.1)` (header), `0 4px 12px rgba(46, 139, 87, 0.4)` (FAB Tony), `0 8px 32px rgba(0,0,0,0.15)` (pannello chat).

**Focus:** replicare alone/bordo usando l’**accent del modulo corrente** (non solo il verde Core) dove i controlli sono tematizzati.

---

## 3. Tipografia

- **Font stack:** `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif` (body, Tony panel).
- **Titolo app / header:** ~28px desktop → 24px (≤768px) → 20px (≤480px).
- **Titoli sezione (h2 in card):** ~18px; colore di accento **del modulo** (es. viola vigneto, arancio frutteto) oppure `#2E8B57` sul Core.
- **Testo corpo:** 14px tipico; secondario 12–13px.
- **Emoji:** usate in navigazione (es. 🌾 titolo, ⚙️ Impostazioni); in redesign si può ridurre o sostituire con icon set coerente.

---

## 4. Forma e spaziatura

- **Radius card / header dashboard / pannello Tony:** `12px`.
- **Radius bottoni secondari / input:** `6–8px`.
- **Radius pill badge ruolo:** `20px`.
- **Radius FAB Tony:** cerchio `50%`, 64×64px.
- **Container dashboard:** `max-width: 1400px`, padding ~20px (responsive vedi guida).
- **Card sezione:** padding ~20px, ombra leggera.

---

## 5. Componenti ricorrenti

- **Header principale (standalone modulo):** barra a **gradiente della famiglia modulo** (tab §2.1), testo bianco, azioni a destra; sul **Core** resta il verde Sea Green.
- **Body:** spesso **gradiente 135deg** modulo-specifico (non solo grigio chiaro): rinforza il contesto a colpo d’occhio.
- **Sezione / card interne:** superficie **bianca** o neutra per leggibilità; l’accent colore è su header, bordi attivi, titoli, CTA primarie.
- **Action card (griglia moduli):** su dashboard Core, hover con bordo `#2E8B57`; nelle home di modulo, hover/bordo segue l’accent del modulo.
- **Stat card:** pattern simile al Core (gradient grigio, bordo laterale colorato); il colore del bordo/valore segue il modulo dove definito.
- **Tabelle:** spesso in standalone con wrapper `.table-responsive`; su mobile font ~12px, scroll orizzontale.
- **Tony widget:** FAB verde Core in basso a destra; pannello chat bianco con header **verde Core** (identità assistente globale, non colore modulo).

---

## 6. Responsive (obbligatorio in nuovi mock)

Breakpoint condivisi: **1024px**, **768px**, **480px**.  
Dettaglio classi (container, header, filtri, stats-grid, table-responsive, modal):  
`docs-sviluppo/LINEA_GUIDA_RESPONSIVE_STANDALONE.md`.

---

## 7. Screenshot per Stitch — quando servono

| Obiettivo | Screenshot utili |
|------------|------------------|
| Solo “restyling” coerente col brand | Opzionali: basta questo file + prompt |
| Mock fedeli a schermate reali | **Sì:** dashboard desktop, una lista con tabella+filtri, un form o modal, una vista **375px** mobile |
| Navigazione modulare | Una schermata con griglia “azioni rapide” / card modulo |
| **Rispettare i temi modulo** | Almeno **un’immagine per “famiglia cromatica”** (es. viola vigneto, arancio frutteto, blu conto terzi, cyan parco macchine) oltre al Core |

**Suggerimento pratico:** 3–5 screenshot nitidi (no dati sensibili reali; usa tenant demo o oscura). Se Stitch deve proporre UI coerente con l’orientamento attuale, includere **più moduli con colori diversi**, non solo la dashboard verde.

---

## 8. Prompt per Google Stitch (copia / incolla)

Usa questo blocco come **messaggio iniziale** in Stitch, allegando (se li hai) gli screenshot. Aggiorna le parentesi quadre solo se serve.

```
Sei un designer UI per un’app web B2B agricola italiana: GFV Platform (ERP: terreni, lavori, magazzino, vigneto, frutteto, manodopera, conto terzi, parco macchine, report, mappe, assistente IA “Tony”).

Vincoli da rispettare:
- Lingua interfaccia: italiano.
- Doppio livello cromatico:
  (A) CORE / Tony: verde Sea Green #2E8B57 e #228B22 (dashboard home, amministrazione generale, FAB e header pannello Tony).
  (B) MODULI: ogni modulo ha una propria “famiglia” per sfondo pagina + header (gradient 135deg), così l’utente riconosce il contesto anche se distratto. Esempi da mantenere concettualmente (toni possono essere rifiniti ma le famiglie devono restare distinguibili):
      - Vigneto: viola (#6A1B9A, #4A148C; body da lavanda verso viola).
      - Frutteto: arancio (#FF6F00, #E65100; body da pesca verso arancio).
      - Magazzino: verde bosco Material (#2E7D32, #1B5E20) — NON confonderlo con il verde Core #2E8B57.
      - Conto terzi: blu (#1976D2, #1565C0; body da azzurro chiaro verso blu).
      - Parco macchine / guasti: teal/cyan (#0097A7, #006064; body acqua chiara).
      - Report: tema scuro grigio/antracite.
      - Eccezioni amministrative (es. segnalazione guasti): rosso allerta dove già usato.
- Card e contenuti principali: superfici chiare/bianche, testo #333 / secondario #666, buon contrasto su sfondo modulo colorato.
- Tipografia: stack system UI (Segoe UI, Tahoma, Geneva, Verdana, sans-serif).
- Angoli: card ~12px, bottoni 6–8px; ombre leggere.
- Mobile-first: breakpoint 1024 / 768 / 480; tabelle scroll orizzontale o card; touch target generosi.
- Tony: resta identità Core (verde); non mescolare il colore del modulo dentro il widget salvo dettagli minimi.

Output desiderato:
- [Schermata/e]: [es. “Dashboard Core”, “Lista vigneto”, “Form conto terzi mobile”]
- Stile: [es. “Raffinare mantenendo le famiglie colore per modulo”]
- Consegna: layout chiaro, stati hover/focus, empty state, componenti; per ogni schermata indicare il modulo (così i colori restano coerenti).

Se carico screenshot, allinea colori e densità a ciò che è visibile; non unificare tutto su un solo verde se le schermate mostrano moduli diversi.
```

---

## 9. Manutenzione

Quando si centralizzano nuovi token in CSS (idealmente **variabili CSS per modulo** in un unico foglio condiviso), aggiornare **§2.1** e le tabelle in §2.2–§4 così Stitch e il team restano allineati.

---

## 10. Contesto prodotto per Stitch (copia / incolla)

Usa questo blocco **prima** delle richieste di schermate o del prompt in §8: descrive cos’è l’app e come si comporta dal punto di vista utente e UI (non è una specifica API).

```
CONTESTO — GFV Platform (Italia)

Cos’è
- Web app B2B per aziende agricole: ERP “a moduli” (attivano solo ciò che serve: vigneto, frutteto, magazzino, manodopera, conto terzi, parco macchine, ecc.).
- Interfaccia in italiano. Contesto multi-azienda: l’utente lavora nell’ambito di un’azienda (tenant) selezionata.
- Non è un consumer app: schermate dense, tabelle, filtri, form lunghi, flussi operativi ripetuti ogni giorno.

Chi la usa
- Ruoli tipici: responsabile / manager, caposquadra, operaio di campo, chi gestisce amministrazione e magazzino.
- Uso misto: ufficio (desktop) e campo (smartphone/tablet). In campo: poche tap, testi leggibili al sole, mappe e GPS dove serve.

Struttura di navigazione (macro)
- Home dashboard: riepilogo, accesso ai moduli, mappa aziendale dove previsto, collegamenti ad amministrazione e guide.
- Ogni modulo ha proprie liste (cantieri, prodotti, vigneti, preventivi, macchine, …), filtri, dettaglio, form di inserimento/modifica, spesso export o stampa.
- Amministrazione manodopera: squadre, operai, lavori, validazione ore, compensi, guasti — flussi che collegano ufficio e campo.

Assistente “Tony”
- Assistente IA sempre accessibile: pulsante floating (FAB) in basso a destra + pannello chat.
- Aiuta su “dove cliccare”, dati visibili, compilazione guidata di form; identità visiva legata al Core (verde), non al colore del modulo aperto.

Linguaggio visivo (orientamento)
- Il “Core” (dashboard generale, Tony, molta amministrazione) usa un verde Sea Green distintivo.
- Ogni modulo applicativo ha una famiglia cromatica propria (sfondo a gradiente + header coordinato) così, anche con attenzione bassa, si capisce in quale contesto ci si trova (es. viola vigneto, arancio frutteto, blu conto terzi, verde bosco magazzino, teal parco macchine).
- Card e contenuti restano leggibili (superfici chiare, testo scuro) sopra sfondi modulati.

Pattern UI ricorrenti
- Header pagina con titolo, azioni primarie (nuovo, esporta, indietro), spesso breadcrumb implicito via pulsanti.
- Barra filtri sopra le tabelle (select, date, ricerca testuale).
- Tabelle dati con molte colonne; su mobile: scroll orizzontale o layout a schede/card.
- Modal per conferme, dettaglio rapido, wizard passo-passo.
- Stati vuoti, caricamento, errori di permesso o modulo non attivo.

Vincoli di design da rispettare
- Accessibilità ragionevole (contrasto, focus visibile, target touch ~44px sulle azioni critiche).
- Coerenza tra moduli: stessi componenti “mental model” (filtri, tabella, primario/secondario), ma colore ambiente per modulo.
- Non inventare moduli o funzioni non richieste: se manca il brief, chiedi o resta su layout generico ERP agricolo.

Obiettivo della sessione Stitch (compila tu)
- [Cosa vuoi: es. “Ridisegnare header + card dashboard”, “Nuova lista mobile magazzino”, “Refresh solo typography e spacing”]
```

Dopo questo contesto, incolla il prompt operativo della §8 (o una richiesta mirata per singola schermata).
