# 🔍 Come Trovare il Progetto Google Cloud

## Problema: Il progetto Firebase non appare in Google Cloud Console

Questo è normale! Un progetto Firebase potrebbe non essere immediatamente visibile in Google Cloud Console.

---

## ✅ Soluzione 1: Cerca il Progetto

1. Nel pop-up "Seleziona un progetto", usa la **barra di ricerca** in alto
2. Cerca: **`gfv-platform`** (o il nome del tuo progetto Firebase)
3. Se non lo trovi, prova a cercare l'**ID del progetto**:
   - Apri `core/firebase-config.js`
   - Cerca `projectId: "..."` 
   - Cerca quel valore nella Google Cloud Console

---

## ✅ Soluzione 2: Vai alla Scheda "Tutti"

1. Nel pop-up, clicca sulla scheda **"Tutti"** (All) invece di "Recenti"
2. Questo mostra TUTTI i progetti, non solo quelli recenti
3. Scorri la lista o usa la ricerca

---

## ✅ Soluzione 3: Usa il Progetto Esistente (CONSIGLIATO)

Vedo che hai già il progetto **"Vendemmia Meccanizzata Maps"** selezionato.

**Puoi usare questo progetto per Google Maps!** È perfetto.

**Vantaggi:**
- ✅ Già configurato
- ✅ Probabilmente ha già Maps JavaScript API abilitata
- ✅ Non devi creare nulla di nuovo

**Procedi così:**
1. Lascia selezionato **"Vendemmia Meccanizzata Maps"**
2. Vai su **"API e servizi"** → **"Libreria"**
3. Cerca **"Maps JavaScript API"**
4. Se è già abilitata → Perfetto! Vai al passo successivo
5. Se non è abilitata → Clicca "ABILITA"

---

## ✅ Soluzione 4: Verifica dal Firebase Console

1. Vai su **https://console.firebase.google.com/**
2. Seleziona il progetto **`gfv-platform`** (o il tuo progetto)
3. Vai su **"Impostazioni progetto"** (⚙️ in alto a sinistra)
4. Scorri fino a **"Impostazioni progetto"**
5. Cerca **"ID progetto Google Cloud"** o **"Google Cloud project ID"**
6. Questo è l'ID che devi cercare in Google Cloud Console

---

## ✅ Soluzione 5: Crea Nuovo Progetto (se necessario)

Se preferisci un progetto separato per Google Maps:

1. Nel pop-up "Seleziona un progetto", clicca **"Nuovo progetto"** (icona ingranaggio in alto a destra)
2. Nome: `GFV Platform Maps`
3. Clicca **"Crea"**
4. Attendi la creazione
5. Seleziona il nuovo progetto

---

## 🎯 Raccomandazione

**Usa il progetto "Vendemmia Meccanizzata Maps" che hai già!**

È la soluzione più semplice e veloce. Non c'è bisogno di creare un nuovo progetto.

---

## 📝 Dopo Aver Trovato/Selezionato il Progetto

1. Vai su **"API e servizi"** → **"Libreria"**
2. Cerca **"Maps JavaScript API"**
3. Se non è abilitata → Clicca **"ABILITA"**
4. Vai su **"API e servizi"** → **"Credenziali"**
5. Clicca **"+ CREA CREDENZIALI"** → **"Chiave API"**
6. Copia la chiave
7. Aggiungila a `core/google-maps-config.js`

---

## ❓ Domande Frequenti

**Q: Devo usare lo stesso progetto di Firebase?**
A: No, puoi usare qualsiasi progetto Google Cloud. Usare lo stesso è più semplice.

**Q: Il progetto Firebase non appare, è un problema?**
A: No, è normale. Puoi usare un progetto Google Cloud esistente o crearne uno nuovo.

**Q: Posso usare "Vendemmia Meccanizzata Maps"?**
A: Sì, assolutamente! È perfetto per questo scopo.

---

**Prossimo passo**: Continua con la configurazione usando il progetto che hai selezionato! 🚀



