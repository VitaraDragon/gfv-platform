# 📧 Istruzioni per Aggiornare Template Email Inviti su EmailJS

## Passo 1: Accedi a EmailJS
1. Vai su [https://www.emailjs.com/](https://www.emailjs.com/)
2. Accedi al tuo account (stesso account usato per il template preventivi)

## Passo 2: Trova il Template Inviti
1. Vai su **"Email Templates"** nel menu laterale
2. Trova il template con ID: `template_9917fde` (template inviti collaboratori)
3. Clicca per modificarlo

## Passo 3: Copia il Nuovo Codice HTML
1. Apri il file `template-email-invito-semplice.html` in questo progetto
2. Copia **TUTTO** il contenuto (dal primo `<div>` fino all'ultima chiusura `</div>`)
3. **IMPORTANTE**: EmailJS non supporta condizioni `{{#if}}`, quindi le variabili opzionali (come `indirizzo_azienda` o `telefono_azienda`) verranno semplicemente mostrate vuote se non presenti

## Passo 4: Sostituisci il Template EmailJS
1. Nel pannello EmailJS, elimina tutto il contenuto del template esistente
2. Incolla il nuovo codice HTML copiato nell'editor del template
3. Il template dovrebbe mostrare un'anteprima con il design aggiornato, incluso logo e nome azienda

## Passo 5: Verifica le Variabili
EmailJS riconoscerà automaticamente le variabili nel template. Assicurati che queste variabili siano presenti:

**Variabili Invito:**
- `{{nome}}` - Nome del destinatario
- `{{cognome}}` - Cognome del destinatario
- `{{email}}` - Email del destinatario
- `{{ruoli}}` - Ruoli assegnati (formattati con emoji)
- `{{linkRegistrazione}}` - Link per completare la registrazione
- `{{scadeIl}}` - Data scadenza invito (formattata)

**Variabili Azienda (Branding):**
- `{{logo_url}}` - URL del logo aziendale (se presente, altrimenti vuoto)
- `{{nome_azienda}}` - Nome azienda per header (testo semplice)
- `{{nome_azienda_footer}}` - Nome azienda per footer (testo semplice)
- `{{indirizzo_azienda}}` - Indirizzo completo formattato (opzionale)
- `{{telefono_azienda}}` - Telefono formattato (opzionale)
- `{{email_azienda}}` - Email formattata (opzionale)
- `{{piva_azienda}}` - Partita IVA formattata (opzionale)

**Nota**: Le variabili azienda vengono passate come testo semplice dal codice JavaScript. Il template EmailJS le formatta automaticamente. Se una variabile è vuota, semplicemente non verrà visualizzato nulla.

## Passo 6: Salva il Template
1. Clicca su **"Save"** per salvare il template aggiornato
2. Il Template ID rimane lo stesso: `template_9917fde`

## Passo 7: Test
1. Puoi testare il template direttamente da EmailJS usando i dati di esempio
2. Oppure testa dall'applicazione creando un nuovo invito e verificando che l'email mostri logo e nome azienda

## Note Importanti
- **Service ID**: Usa lo stesso Service ID già configurato: `service_f4to9qr`
- **Public Key**: Usa la stessa Public Key già configurata: `AnLLhJOew6d6sCIOG`
- **Branding Aziendale**: Il template ora usa il logo e i dati dell'azienda invece del logo GFV Platform. Configura i dati azienda nelle Impostazioni.
- EmailJS non supporta condizioni `{{#if}}`, quindi le variabili opzionali verranno mostrate vuote se non presenti
- Il design mantiene lo stesso stile dei preventivi (colori blu) ma mostra il branding dell'azienda cliente

## Troubleshooting
- Se le variabili non vengono sostituite, verifica che i nomi nel codice JavaScript corrispondano esattamente a quelli nel template
- Se l'email non viene inviata, controlla la console del browser per errori
- Se il logo non appare, verifica che l'URL del logo sia accessibile pubblicamente e che inizi con `http://` o `https://`
- Se il link di registrazione non funziona, verifica che l'URL base sia corretto

## Differenze rispetto al Template Precedente
- ✅ Aggiunto header con logo aziendale e nome azienda
- ✅ Aggiunto footer con dati azienda completi (indirizzo, telefono, email, P.IVA)
- ✅ Stile allineato al template preventivi per coerenza visiva
- ✅ Mantiene tutte le funzionalità esistenti (invito, ruoli, scadenza, link registrazione)
