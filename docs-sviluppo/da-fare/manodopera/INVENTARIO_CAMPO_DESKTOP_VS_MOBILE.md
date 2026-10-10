# Inventario campo — desktop vs mobile

Verificato sul codice di `origin/develop` il 2026-10-10 (step 0), poi aggiornato con lo step a) e con le correzioni dopo il test su main #174.

Fonti: `core/dashboard-standalone.html`, `core/js/dashboard-sections.js` (`createCaposquadraSection`, `createOperaioSection`), `core/js/dashboard-controller.js`, `core/js/dashboard-utils.js`, `core/mobile/field-workspace-standalone.html`, `core/mobile/js/field-workspace-controller.js`, `core/mobile/js/field-menu-visibility.js`, `core/mobile/js/pieno-campo-ui.js`, `core/admin/segnalazione-guasti-standalone.html`, `core/js/field-guasti-access.js`, `core/admin/impostazioni-standalone.html`, `core/mobile/statistiche-lavoratore-standalone.html`, `core/admin/validazione-ore-standalone.html`.

Profilo campo = ruoli solo operaio e/o caposquadra, modulo manodopera, senza manager/amministratore. Il menu moduli (magazzino, parco macchine, …) in `dashboard-controller.js` è disegnato solo per manager/amministratore.

| Funzione | Ruolo | Desktop (dove) | Mobile (dove) | Stato |
|----------|--------|----------------|---------------|--------|
| Segna ore | op+capo | card → `segnatura-ore-standalone.html` (lavoro, pausa, note) | slide «Ore» (`#quick-hours-form`: data, inizio, fine, pausa, note; il lavoro è `#selected-work` sulla slide «Lavoro»; riepilogo giorno e sovrapposizioni) | OK — parità campi |
| Validazione ore | capo | card → `admin/validazione-ore-standalone.html` | slide «Valida ore» + lista nel «Lavoro» + link schermo intero solo caposquadra (`?from=field`). L’operaio non vede la voce. Senza permesso la pagina nasconde contatori e «Valida tutte» e dice subito «Non hai i permessi per questa pagina.» | OK (filtri solo nella pagina piena = compito D6). «← Campo» per operaio e caposquadra, anche senza `from`, verso il workspace. «← Dashboard» per manager e manager+capo verso la dashboard, non verso una pagina che rimbalza |
| Lavori assegnati / dettaglio | op+capo | card «I Miei Lavori» → `admin/lavori-caposquadra-standalone.html` | slide «Lavoro» (select + GPS) + iframe `embed=mobile` nella slide «Ore» | OK — il completamento è nel compito (`segna completato` nella pagina lavori, anche in iframe) |
| Zone / mappa lavoro | op+capo | in `lavori-caposquadra-standalone` | solo via iframe / «Apri in finestra intera» | PARZIALE (compito D6, ok) |
| La mia squadra | capo | `admin/gestione-squadre-standalone.html` (sola lettura dalla card) | `#squad-members-list` + chiama/email | OK |
| Segnala assenza | capo | non c’è una card in `createCaposquadraSection`. Il manager la ha in Gestione lavori (standby assenza) | `#segnala-assenza-form` | solo mobile per il capo. Non è un buco desktop da portare: la funzione campo c’è già |
| Comunicazioni ricevute | operaio | `#comunicazioni-operaio-section` | slide «Comunicazioni» (storico) | OK |
| Comunicazioni inviate/invio | capo | `#comunicazione-rapida-section` + `#comunicazioni-inviate-section` | slide capo `#quick-communication-form` + elenco invii | OK |
| Statistiche personali | op+capo | `#stat-lavori-oggi-operaio`, `#stat-ore-segnate-operaio`, `#stat-stato-operaio` (solo sezione operaio) | slide «Statistiche» (iframe `statistiche-lavoratore-standalone.html?embed=mobile`: ore nel periodo, per mese, per tipo, ore con mezzo). Mentre carica dice «Carico le tue ore…». Se non parte in 15 secondi: «Non riesco a caricare le statistiche. Riprova.» | OK — i tre contatori «lavori oggi / ore segnate / stato» non sono ripetuti. La pagina copre le ore personali. Non è un buco D7 |
| Segnala guasto | op+capo | card operaio → `admin/segnalazione-guasti-standalone.html` solo con `parcoMacchine`. Capo-only veniva rimbalzato (`ruoli.includes('operaio')`) | menu ⚙️ «Segnala guasto» se `parcoMacchine`, stesso form. Indietro: «← Campo» solo se arrivi dal workspace e il profilo è campo puro; dalla dashboard è sempre «← Dashboard». Dopo l’invio: «Segnalazione inviata. Grazie.» e, dal campo, ritorno al workspace | OK dallo step a), corretto dopo #174 e con la ripresa del lavoro. Una macchina già in guasto non si riseleziona. Senza modulo la voce non c’è. Se il salvataggio del guasto riesce e macchina o lavoro non si aggiornano, la conferma c’è comunque, l’avviso resta e il ritorno automatico non parte |
| Pieno carburante | op | non in dashboard | `#pieno-campo-form` (`pieno-campo-ui.js`), solo se il lavoro ha un mezzo e c’è Magazzino | solo mobile, già deciso (§28.7) |
| Magazzino / macchine (consultazione) | op+capo | tile in `createDashboardModuleSidebar` (~r.460–475) e riga tile moduli | nessuna | NON visibile al profilo campo. Il menu moduli è solo manager/amministratore (`dashboard-controller.js`). Nessuna decisione richiesta |
| Impostazioni / push | op+capo | `admin/impostazioni-standalone.html` | ⚙️ → Impostazioni account | OK |
| Cambio password | op+capo | `#password-section` in Impostazioni, visibile per tutti i ruoli | stesso link Impostazioni | OK |
| Logout | op+capo | `#logout-button` (offline + `signOut`) | ⚙️ «Esci», stessa sequenza | OK dallo step a) |
| Guida | op+capo | menu dashboard | ⚙️ «Guida Manodopera» | OK |
| Tony | op+capo | widget dashboard | stesso widget (`standalone-bootstrap.js` + contesto profilo campo) | OK. Whitelist `segnalazione guasti`: apre la pagina, non compila il form. «Elenco guasti» del manager non si apre |
| Cambio tenant (se ≥2) | op+capo | `#switch-tenant-button` se `getUserTenants` > 1 | ⚙️ «Cambia azienda», stesso `showTenantSelector`. Nascosto anche nello stile (non solo con l’attributo hidden) se c’è un solo tenant. Il conteggio si aspetta prima di mostrarla | OK. Nascosto se c’è un solo tenant |
| Toggle desktop/mobile | op+capo | — | rimosso nello step b) | il profilo campo non ha più 🖥️ né 📱. `?ws=classic` non è una casa. Un indirizzo desktop digitato a mano torna al workspace |

## Decisioni chiuse senza fermarsi

- Magazzino / parco macchine in consultazione non sono una funzione del profilo campo. Restano in dashboard ufficio (D8).
- Segnala assenza del capo è già solo mobile. Il manager continua da Gestione lavori.
- I tre numeri «lavori oggi / stato» della card operaio non hanno un gemello mobile dedicato. Le statistiche personali ci sono nella slide.
- Guasti: stesso salvataggio della pagina esistente, aperta dal menu (compito D6), non un secondo form. L’iframe è stato scartato: la pagina carica mappe, auth e un altro Tony; il link a tutto schermo è lo stesso schema di «Apri validazione completa».

## Note dopo il test su main #174 (2026-10-10)

- Il menu ⚙️, finché il workspace non è pronto, mostra «Sto preparando il workspace…». Si può solo usare «Esci».
- Select Trattore: se non ci sono trattori attivi, l’opzione vuota dice «Nessun trattore disponibile». La lettura delle macchine è consentita a tutto il tenant (`firestore.rules`, macchine `allow read`). Non è un divieto di lettura.
- Lo stato macchina «guasto» da capo o operaio resta negato dalle regole (possono scrivere solo `stato == disponibile`). Proposta a parte, in attesa di Pier. Il form non resta bloccato: il guasto è salvato, l’avviso è non bloccante.
- La sospensione del lavoro, se è il lavoro del caposquadra (o l’utente è manager/admin), scrive `stato`, `sospensioneCausa`, `sospensioneIl`, `aggiornatoIl`. L’operaio non tenta quella scrittura.

## Note guide (non riscritte in questo step)

- La guida aperta dal menu campo non manda più l’operaio o il caposquadra alla dashboard con `ws=classic`.
- Il caposquadra-only ora può segnalare, se l’azienda ha Parco Macchine.
- Il logout di campo è «Esci» nel menu ⚙️. Il toggle 🖥️ è stato tolto nello step b).
