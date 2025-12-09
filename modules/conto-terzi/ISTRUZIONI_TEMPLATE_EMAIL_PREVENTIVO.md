# 📧 Istruzioni per Creare Template Email Preventivo su EmailJS

## Passo 1: Accedi a EmailJS
1. Vai su [https://www.emailjs.com/](https://www.emailjs.com/)
2. Accedi al tuo account (stesso account usato per il template inviti)

## Passo 2: Crea Nuovo Template
1. Vai su **"Email Templates"** nel menu laterale
2. Clicca su **"Create New Template"**
3. Scegli un nome: `Preventivo Lavoro` o `GFV Preventivo`

## Passo 3: Copia il Codice HTML
1. Apri il file `template-email-preventivo-semplice.html` in questo progetto
2. Copia **TUTTO** il contenuto (dal primo `<div>` fino all'ultima chiusura `</div>`)
3. **IMPORTANTE**: EmailJS non supporta condizioni `{{#if}}`, quindi ho rimosso tutte le condizioni. Le variabili opzionali (come `terreno_nome` o `note`) verranno semplicemente mostrate vuote se non presenti

## Passo 4: Incolla nel Template EmailJS
1. Nel pannello EmailJS, incolla il codice HTML copiato nell'editor del template
2. Il template dovrebbe mostrare un'anteprima con il design del preventivo

## Passo 5: Configura le Variabili
EmailJS riconoscerà automaticamente le variabili nel template. Assicurati che queste variabili siano presenti:

- `{{ragione_sociale}}` - Nome cliente
- `{{numero_preventivo}}` - Numero preventivo
- `{{tipo_lavoro}}` - Tipo di lavoro
- `{{coltura}}` - Coltura
- `{{tipo_campo}}` - Tipo campo (pianura/collina/montagna)
- `{{superficie}}` - Superficie in ettari
- `{{terreno_nome}}` - Nome terreno (opzionale)
- `{{totale_imponibile}}` - Totale imponibile
- `{{iva_percentuale}}` - Percentuale IVA
- `{{totale_iva}}` - Importo IVA
- `{{totale_con_iva}}` - Totale con IVA
- `{{scadenza}}` - Data scadenza preventivo
- `{{link_accettazione}}` - Link per accettare preventivo
- `{{link_rifiuto}}` - Link per rifiutare preventivo (opzionale)
- `{{note}}` - Note aggiuntive (opzionale)

## Passo 6: Salva e Ottieni Template ID
1. Clicca su **"Save"** per salvare il template
2. Copia il **Template ID** (es: `template_xxxxxxx`)
3. **IMPORTANTE**: Aggiorna il Template ID nel file `preventivi-standalone.html` alla riga dove c'è `'template_9917fde'` (sostituisci con il tuo nuovo Template ID)

## Passo 7: Test
1. Puoi testare il template direttamente da EmailJS usando i dati di esempio
2. Oppure testa dall'applicazione creando un preventivo e cliccando "Invia"

## Note Importanti
- **Service ID**: Usa lo stesso Service ID già configurato: `service_f4to9qr`
- **Public Key**: Usa la stessa Public Key già configurata: `AnLLhJOew6d6sCIOG`
- Il template supporta variabili opzionali (usando `{{#if variabile}}`) per mostrare/nascondere sezioni
- Il design è coerente con il template degli inviti (stesso logo e colori)

## Troubleshooting
- Se le variabili non vengono sostituite, verifica che i nomi nel codice JavaScript corrispondano esattamente a quelli nel template
- Se l'email non viene inviata, controlla la console del browser per errori
- Se il link di accettazione non funziona, verifica che l'URL base sia corretto

