# 🌱 Guida Funzionalità – Gestione Terreni

Questa guida spiega come creare, modificare e monitorare i terreni aziendali dalla dashboard GFV Platform.

---

## 📋 Prerequisiti

- Ruolo **Manager** o **Amministratore**
- Modulo **Core Base** attivo
- Terreni con confini mappati su Google Maps (consigliato)

---

## 🧭 Percorso nell’app

1. Accedi alla dashboard
2. Vai nella sezione **Core Base**
3. Clicca su **Terreni**

---

## ➕ Creare un nuovo terreno

1. Clicca **Nuovo Terreno**
2. Compila i campi:
   - **Nome**: identificativo principale (es. “Vigneto Nord”)
   - **Podere**: scegli dall’elenco o creane uno nuovo
   - **Coltura**: seleziona coltura principale
   - **Superficie**: superficie totale in ettari
   - **Note**: informazioni extra (irrigazione, vincoli, ecc.)
3. **Mappa**:
   - Clicca sulla mappa per inserire i vertici del poligono
   - Trascina i punti per rifinire il perimetro
   - Clicca sul punto per eliminarlo
4. Premi **Salva Terreno**

💡 *Suggerimento*: usa la vista satellitare per tracciare confini precisi.  
🧪 *Validazione*: il sistema evita il salvataggio senza almeno tre punti mappa.

---

## ✏️ Modificare un terreno

1. Seleziona il terreno dalla lista
2. Clicca **Modifica**
3. Aggiorna i campi necessari
4. Salva

📌 Tutti i lavori collegati aggiorneranno automaticamente il nome terreno visualizzato.

---

## 🗑️ Eliminare un terreno

1. Apri il terreno
2. Clicca **Elimina**
3. Conferma

⚠️ *Attenzione*: prima di eliminare, verifica che il terreno non sia utilizzato in lavori attivi o cronologia attività (altrimenti rimangono riferimenti orfani nelle statistiche).

---

## 🗺️ Visualizzazione sulla mappa aziendale

- Ogni terreno appare sulla mappa con colore assegnato in base alla coltura
- Cliccando sul poligono ottieni:
  - Nome terreno
  - Podere
  - Coltura
  - Superficie
  - Note
  - Link rapido alla pagina terreni
- I filtri **Podere** e **Coltura** restringono la mappa ai terreni desiderati

---

## 🔄 Gestione poderi

- Gestisci i poderi da **Impostazioni → Poderi**
- Ogni podere ha:
  - Nome
  - Indirizzo
  - Coordinate (per le comunicazioni e indicazioni stradali)
- Assegna i poderi ai terreni per filtrare velocemente i lavori

---

## 📊 Consigli operativi

- Usa nomi coerenti (es. “VIGNETO-01”) per facilitare i filtri
- Inserisci note su irrigazione, accesso o vincoli per il caposquadra
- Aggiorna subito i confini quando cambia il perimetro reale
- Controlla che le superfici siano corrette: impattano sulle statistiche

---

## 🧪 Checklist rapida

- [ ] Terreni con nome chiaro
- [ ] Podere assegnato
- [ ] Coltura impostata
- [ ] Mappa disegnata
- [ ] Superficie verificata
- [ ] Note inserite (se utili)

---

## ❓ Problemi comuni

| Problema | Possibile causa | Soluzione |
| --- | --- | --- |
| Terreno non appare in mappa | Mancano coordinate | Modifica terreno e traccia il perimetro |
| Superficie = 0 | Campo lasciato vuoto | Inserisci la superficie manualmente |
| Poligono “esce” dalla mappa | Zoom troppo vicino | Usa il pulsante “Reset mappa” |

---

Per dubbi o richieste extra, consulta la [FAQ](../02-FAQ.md) o contatta il supporto.

