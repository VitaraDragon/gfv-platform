# Inventario campo — desktop vs mobile

Verificato sul codice di `origin/develop` il 2026-10-10 (step 0), poi aggiornato con lo step a) dello stesso giorno.

Fonti: `core/dashboard-standalone.html`, `core/js/dashboard-sections.js` (`createCaposquadraSection`, `createOperaioSection`), `core/js/dashboard-controller.js`, `core/js/dashboard-utils.js`, `core/mobile/field-workspace-standalone.html`, `core/mobile/js/field-workspace-controller.js`, `core/mobile/js/pieno-campo-ui.js`, `core/admin/segnalazione-guasti-standalone.html`, `core/admin/impostazioni-standalone.html`, `core/mobile/statistiche-lavoratore-standalone.html`.

Profilo campo = ruoli solo operaio e/o caposquadra, modulo manodopera, senza manager/amministratore. Il menu moduli (magazzino, parco macchine, …) in `dashboard-controller.js` è disegnato solo per manager/amministratore.

| Funzione | Ruolo | Desktop (dove) | Mobile (dove) | Stato |
|----------|--------|----------------|---------------|--------|
| Segna ore | op+capo | card → `segnatura-ore-standalone.html` (lavoro, pausa, note) | slide «Ore» (`#quick-hours-form`: data, inizio, fine, pausa, note; il lavoro è `#selected-work` sulla slide «Lavoro»; riepilogo giorno e sovrapposizioni) | OK — parità campi |
| Validazione ore | capo | card → `admin/validazione-ore-standalone.html` | slide «Valida ore» + lista nel «Lavoro» + link schermo intero | OK (filtri solo nella pagina piena = compito D6) |
| Lavori assegnati / dettaglio | op+capo | card «I Miei Lavori» → `admin/lavori-caposquadra-standalone.html` | slide «Lavoro» (select + GPS) + iframe `embed=mobile` nella slide «Ore» | OK — il completamento è nel compito (`segna completato` nella pagina lavori, anche in iframe) |
| Zone / mappa lavoro | op+capo | in `lavori-caposquadra-standalone` | solo via iframe / «Apri in finestra intera» | PARZIALE (compito D6, ok) |
| La mia squadra | capo | `admin/gestione-squadre-standalone.html` (sola lettura dalla card) | `#squad-members-list` + chiama/email | OK |
| Segnala assenza | capo | non c’è una card in `createCaposquadraSection`. Il manager la ha in Gestione lavori (standby assenza) | `#segnala-assenza-form` | solo mobile per il capo. Non è un buco desktop da portare: la funzione campo c’è già |
| Comunicazioni ricevute | operaio | `#comunicazioni-operaio-section` | slide «Comunicazioni» (storico) | OK |
| Comunicazioni inviate/invio | capo | `#comunicazione-rapida-section` + `#comunicazioni-inviate-section` | slide capo `#quick-communication-form` + elenco invii | OK |
| Statistiche personali | op+capo | `#stat-lavori-oggi-operaio`, `#stat-ore-segnate-operaio`, `#stat-stato-operaio` (solo sezione operaio) | slide «Statistiche» (iframe `statistiche-lavoratore-standalone.html`: ore nel periodo, per mese, per tipo, ore con mezzo) | OK — i tre contatori «lavori oggi / ore segnate / stato» non sono ripetuti. La pagina copre le ore personali. Non è un buco D7 |
| Segnala guasto | op+capo | card operaio → `admin/segnalazione-guasti-standalone.html` solo con `parcoMacchine`. Capo-only veniva rimbalzato (`ruoli.includes('operaio')`) | menu ⚙️ «Segnala guasto» se `parcoMacchine`, stesso form. Ritorno «← Campo» per il profilo campo | OK dallo step a) (2026-10-10). Senza modulo la voce non c’è |
| Pieno carburante | op | non in dashboard | `#pieno-campo-form` (`pieno-campo-ui.js`), solo se il lavoro ha un mezzo e c’è Magazzino | solo mobile, già deciso (§28.7) |
| Magazzino / macchine (consultazione) | op+capo | tile in `createDashboardModuleSidebar` (~r.460–475) e riga tile moduli | nessuna | NON visibile al profilo campo. Il menu moduli è solo manager/amministratore (`dashboard-controller.js`). Nessuna decisione richiesta |
| Impostazioni / push | op+capo | `admin/impostazioni-standalone.html` | ⚙️ → Impostazioni account | OK |
| Cambio password | op+capo | `#password-section` in Impostazioni, visibile per tutti i ruoli | stesso link Impostazioni | OK |
| Logout | op+capo | `#logout-button` (offline + `signOut`) | ⚙️ «Esci», stessa sequenza | OK dallo step a) |
| Guida | op+capo | menu dashboard | ⚙️ «Guida Manodopera» | OK |
| Tony | op+capo | widget dashboard | stesso widget (`standalone-bootstrap.js` + contesto profilo campo) | OK. Whitelist `segnalazione guasti`: apre la pagina, non compila il form. «Elenco guasti» del manager non si apre |
| Cambio tenant (se ≥2) | op+capo | `#switch-tenant-button` se `getUserTenants` > 1 | ⚙️ «Cambia azienda», stesso `showTenantSelector` | OK dallo step a). Nascosto se c’è un solo tenant |
| Toggle desktop/mobile | op+capo | — | `#btn-mode-mobile` / `#btn-mode-desktop` | ancora presente. Fuori da questo step: si toglie nello step b) |

## Decisioni chiuse senza fermarsi

- Magazzino / parco macchine in consultazione non sono una funzione del profilo campo. Restano in dashboard ufficio (D8).
- Segnala assenza del capo è già solo mobile. Il manager continua da Gestione lavori.
- I tre numeri «lavori oggi / stato» della card operaio non hanno un gemello mobile dedicato. Le statistiche personali ci sono nella slide.
- Guasti: stesso salvataggio della pagina esistente, aperta dal menu (compito D6), non un secondo form. L’iframe è stato scartato: la pagina carica mappe, auth e un altro Tony; il link a tutto schermo è lo stesso schema di «Apri validazione completa».

## Note guide (non riscritte in questo step)

- `core/GUIDA/MANODOPERA/tony/guida-tecnica.md` e `documentazione-utente/guida-manodopera-utente.html` dicono ancora che i guasti si trovano dalla dashboard in versione completa (la guida apre la dashboard con `ws=classic`).
- Il caposquadra-only ora può segnalare, se l’azienda ha Parco Macchine.
- Il logout di campo è «Esci» nel menu ⚙️. Il toggle 🖥️ resta fino allo step b).
