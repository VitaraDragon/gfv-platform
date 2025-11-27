# 🗺️ Guida Funzionalità – Mappa Aziendale

La mappa aziendale offre una vista completa di poderi, terreni, lavori e stato avanzamento in tempo reale.

---

## 👥 Chi può usarla?

- **Manager** e **Amministratore**: vista completa
- **Caposquadra**: limitata ai lavori assegnati (tramite pagina lavori)
- **Operaio**: solo tramite comunicazioni o lavori assegnati

---

## 🧭 Dove si trova

- Dashboard → sezione superiore → colonna destra (quando modulo Manodopera attivo)
- In modalità solo Core Base, la mappa appare sotto il blocco principale

---

## 🎛️ Elementi della mappa

1. **Poligoni terreni**
   - Colore in base alla coltura (palette dinamica)
   - Clic per vedere dettagli (nome, podere, coltura, superficie, note, link)

2. **Overlay zone lavorate**
   - Poligoni verdi semi-trasparenti
   - Indicano superfici già trattate
   - Vengono generati dai capisquadra quando tracciano l’area lavorata

3. **Indicatori lavori**
   - Marker circolari con lettera/stato:
     - 🔴 = in ritardo
     - 🟡 = in tempo
     - 🟢 = in anticipo
     - 🔵 = in corso (se nessun dato di progresso)
   - Clic per informazioni: nome lavoro, stato, percentuale, superficie lavorata, date

4. **Legenda dinamica**
   - Colture presenti
   - Stato indicatori
   - Spiegazione overlay

---

## 🔍 Filtri disponibili

| Filtro | Descrizione | Ruoli |
| --- | --- | --- |
| **Podere** | Mostra solo i terreni del podere selezionato | Manager/Amministratore |
| **Coltura** | Filtra per coltura (vite, frutteto, ecc.) | Manager/Amministratore |
| **Zone lavorate** | Mostra/nasconde overlay verdi | Manager/Amministratore |
| **Indicatori lavori** | Mostra/nasconde marker stato lavori | Manager/Amministratore |

---

## ⚙️ Come funziona

1. Durante il caricamento la dashboard esegue:
   - Lettura terreni del tenant
   - Calcolo centro e bounding box
   - Disegno poligoni su Google Maps
2. Se il modulo Manodopera è attivo:
   - Recupero lavori attivi
   - Calcolo stato progresso (percentuale completamento vs tempo)
   - Disegno overlay e indicatori
3. Filtri e toggle ricalcolano dinamicamente quali elementi mostrare

---

## 🧠 Suggerimenti pratici

- Traccia sempre i terreni con coordinate precise: senza poligono non appaiono in mappa
- Assicurati che i capisquadra traccino le zone per avere una vista aggiornata
- Usa i filtri per concentrare l’attenzione su un podere/coltura specifica
- Se la mappa appare vuota, controlla che il modulo Manodopera sia attivo (per la vista completa)

---

## 🆘 Problemi frequenti

| Sintomo | Possibile causa | Soluzione |
| --- | --- | --- |
| Mappa non carica | Google Maps API key non configurata | Verifica `core/google-maps-config.js` + guida setup |
| Terreni invisibili | Mancano coordinate poligono | Modifica terreno e disegna il perimetro |
| Indicatori lavori mancanti | Modulo Manodopera disattivato | Attiva modulo o usa vista Core Base |
| Overlay non aggiornati | Caposquadra non ha tracciato la zona | Chiedi di usare lo strumento “Zone lavorate” |

---

## ✅ Checklist attivazione

- [ ] Google Maps API attiva e configurata
- [ ] Terreni con poligoni e coltura impostata
- [ ] Lavori assegnati con stato corretto
- [ ] Modulo Manodopera attivo (per overlay/indicatori)
- [ ] Capisquadra formati sul tracciamento zone

---

Per approfondire, consulta:
- [Gestione Terreni](GESTIONE_TERRENI.md)
- [Gestione Lavori](GESTIONE_LAVORI.md)
- [FAQ](../02-FAQ.md)

