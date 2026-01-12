# 🔧 Troubleshooting Template EmailJS

## Errore 401 Unauthorized

Se ricevi un errore **401** quando cerchi di salvare il template su EmailJS:

### Soluzioni:

1. **Verifica di essere loggato:**
   - Esci completamente da EmailJS
   - Ricarica la pagina
   - Accedi di nuovo con le tue credenziali
   - Prova a salvare il template

2. **Pulisci cache del browser:**
   - Premi `Ctrl+Shift+Delete` (o `Cmd+Shift+Delete` su Mac)
   - Seleziona "Cookie e altri dati del sito"
   - Clicca "Cancella dati"
   - Ricarica EmailJS e riprova

3. **Prova in modalità incognito:**
   - Apri una finestra in incognito
   - Accedi a EmailJS
   - Prova a creare il template

4. **Verifica il Service ID:**
   - Assicurati di essere nella sezione corretta del tuo account EmailJS
   - Verifica che il Service ID `service_f4to9qr` esista e sia accessibile

## Errore cid:logo.png

Se vedi errori relativi a `cid:logo.png`:

- EmailJS potrebbe cercare di processare immagini inline
- **Soluzione**: Usa la versione minimal del template (`template-email-preventivo-minimal.html`) che non include immagini
- Dopo aver salvato con successo, puoi aggiungere l'immagine manualmente dall'interfaccia EmailJS

## Come Procedere:

1. **Prova prima la versione minimal:**
   - Apri `template-email-preventivo-minimal.html`
   - Copia tutto il contenuto
   - Incolla in EmailJS
   - Prova a salvare

2. **Se funziona:**
   - Aggiungi l'immagine manualmente dall'interfaccia EmailJS (opzione "Add Image")
   - Oppure usa la versione completa dopo

3. **Se non funziona:**
   - Verifica l'autenticazione (vedi sopra)
   - Controlla che non ci siano caratteri speciali problematici
   - Prova a creare un template vuoto e aggiungere il contenuto gradualmente

## Note Importanti:

- EmailJS a volte ha problemi con emoji nelle email - ho rimosso gli emoji dalla versione minimal
- Le variabili devono essere esattamente come nel codice: `{{ragione_sociale}}` (con underscore, non trattini)
- Non copiare i commenti HTML `<!-- -->` - solo il contenuto HTML











