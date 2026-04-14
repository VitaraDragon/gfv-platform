# Modulo Terreni

Gestione anagrafica terreni, confini e mappa aziendale.

---

## 1. Scopo

Creare e mantenere i terreni aziendali che alimentano attivita, lavori e moduli coltura.

In parole semplici: se il terreno non e` gestito bene, tutto il resto diventa meno preciso.

---

## 2. Dove si trova

- Dashboard -> `Terreni`
- Pagina: area Terreni

---

## 3. Funzionalita principali

- Creazione/modifica terreno (nome, coltura, podere, possesso, scadenze).
- Tracciamento confini su mappa con calcolo superficie.
- Strumenti GPS operativi in mappa (centraggio e acquisizione punto).
- Gestione affitto/scadenza e dati contrattuali.
- Vista mappa aziendale con filtri.

## 3.1 Come usarlo in pratica

- Primo passo: inserisci i terreni principali con nome chiaro e podere corretto.
- Secondo passo: traccia i confini in mappa per avere superfici piu affidabili.
- Terzo passo: aggiorna affitti/scadenze appena cambiano, cosi la dashboard resta utile.
- Quarto passo: verifica sempre coltura e stato del terreno prima di creare lavori collegati.

---

## 4. Termini e concetti

- **Terreno:** unita base su cui si pianificano lavori e attivita.
- **Confini:** poligono mappa che definisce area reale.
- **Podere:** raggruppamento aziendale dei terreni.
- **Tipo possesso:** proprieta o affitto.

---

## 5. Limitazioni e regole

- Gestione completa riservata a manager/amministratore.
- Nel piano Free/Freemium valgono i limiti sui terreni.
- Eliminazione terreno da usare con attenzione se gia collegato a lavori/attivita.
- Le aree lavorate operative si gestiscono nei moduli specialistici/lavori, non come sostituzione dei confini anagrafici.

Consiglio operativo: evita di cancellare un terreno se e` gia in uso; di solito e` meglio dismetterlo o gestirlo con attenzione per non perdere storia.

---

## 6. Relazioni con altri moduli

- `lavori-attivita.md`: ogni lavoro parte da un terreno.
- `vigneto.md` / `frutteto.md`: anagrafiche coltura legate a terreno.
- `conto-terzi.md`: terreni clienti e terreni aziendali in percorsi distinti.
- `intersezioni-moduli.md`: flussi completi cross-modulo.

---

## 7. Se devi fare X, vai qui

- **Devi inserire un nuovo appezzamento:** apri `Terreni` e crea anagrafica completa.
- **Devi aggiornare confini o superficie:** modifica il terreno e usa la mappa.
- **Devi controllare terreni in affitto/scadenza:** filtra e verifica campi contrattuali.
- **Devi collegare un lavoro a un terreno corretto:** verifica prima qui i dati base.
