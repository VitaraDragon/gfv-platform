# Prompt per Cursor: landing «Tony bussa ed entra», passo 5 (bussata ed entrata di Tony, senza chat né IA)

> Da incollare in una conversazione **nuova** di Cursor, nel repository `VitaraDragon/gfv-platform` sul PC di Pier (Windows, PowerShell).
> Il prompt è autosufficiente. Si basa sul brief v4.2 del 22/10/2026 (sezioni 1.5, 2.1, 2.2, 2.3, 3.2, 4.7) e sulla decisione di Pier del 26/10/2026: **Tony dal vivo si sviluppa adesso, non a dicembre.**

---

## Chi sono e cosa ti chiedo

Sono Pier, agricoltore. Sviluppo GFV Platform da solo e **non sono un programmatore**: spiegami tutto in italiano semplice.

I passi 1–4 della landing sono fatti (pagina classica, pagine legali, nome e cognome facoltativi per il titolare). Questo è il **passo 5**: la prima parte di «Tony bussa ed entra».

**In questo passo Tony non parla con l'intelligenza artificiale.** Facciamo solo la scena:
1. clic su «Vuoi provare GFV?» → si apre la **prima casella** (avviso su Tony);
2. clic su «Fai entrare Tony» → **TOC TOC TOC** (suono, piccolo scossone della pagina, vibrazione sui telefoni Android);
3. **Tony entra** (sul computer da destra, sul telefono dal basso), composto sopra la pagina vera (clip con sfondo trasparente);
4. Tony resta fermo e respira (loop `idle`), con un **fumetto di solo testo** e due pulsanti: «Crea il tuo account gratuito» e «✕ Saluta Tony»;
5. «✕ Saluta Tony» → Tony esce (clip `exit`) e la pagina torna com'era.

Niente chat, niente Gemini, niente ElevenLabs, niente Firebase, niente chiamate a server esterni: solo file statici del nostro hosting.

Tutto sta dietro un **interruttore nuovo `TONY_BUSSA_ATTIVO`, spento (`false`) di default**: con il flag spento la landing si comporta **esattamente come oggi**, tranne una cosa sola: **si toglie la riga «A dicembre Tony bussa anche qui.»** (non è più vera).

## Regole fisse (valgono per tutto il passo)

1. **Prima controlla che il passo 4 sia su `develop`.** In PowerShell, **un comando per riga, senza `&&`**:
   ```powershell
   git fetch origin
   git switch develop
   git pull origin develop
   ```
   Verifica che esistano `landing/src/config/landing-config.js`, `landing/src/views/LandingHome.vue`, `core/config/nome-titolare-config.js` e `tests/landing/landing-passo1.test.js`. **Se manca qualcosa, fermati e dimmelo.**
2. **Branch** da `develop` aggiornato:
   ```powershell
   git switch -c feat/landing-passo5
   ```
   Se `feat/landing-passo5` esiste già, fermati e chiedimi cosa fare.
3. **Flag spento = nessun cambiamento visibile online.** `TONY_BUSSA_ATTIVO = false` e `LANDING_ATTIVA = false` non si cambiano. Con il flag spento i pulsanti «Vuoi provare GFV?» restano **link** alla registrazione classica (`URL_REGISTRAZIONE`), come oggi. Anche `TESTI_LEGALI_PRONTI` e `IVA_CONFERMATA` restano `false`.
4. **Tony dell'app non si tocca:** niente modifiche in `core/`, `shared/`, `modules/`, `functions/`, `gfv-tony-loader.js`, `firestore.rules`, `storage.rules`, `firebase.json`, `package.json` della radice, `index.html` della radice, `landing/src/views/ComingSoon.vue`. Lavori **solo** in `landing/` e `tests/landing/`. Se ti sembra di dover toccare altro, fermati e chiedimelo.
5. **Niente da fuori.** Nessuna libreria nuova (niente dipendenze npm in questo passo), nessun font o script esterno, nessun Firebase, nessun reCAPTCHA, nessuna richiesta a domini esterni. I test esistenti «niente da fuori» (`tests/landing/landing-passo1.test.js` e `landing-passo2.test.js`) **devono passare senza modifiche**.
6. **Le clip si scaricano solo dopo il clic** su «Vuoi provare GFV?» (quando si apre la prima casella), **mai** all'apertura della pagina. Chi non clicca non scarica niente di Tony dal vivo. Il componente della scena va caricato in modo «pigro» (`defineAsyncComponent` con `import()`), così non pesa sulla pagina iniziale.
7. **Testi:** nessuna parola vietata («certificato», «collegato al SIAN», «a norma», «registro», «quaderno di campagna», «fattura»); il servizio si chiama solo «Global Farm View» (sigla GFV). **Senza il modulo Tony Avanzato, Tony spiega e basta: non apre pagine e non compila niente.** Nessun testo deve dire o far capire il contrario (niente «ti porto io», «lo apro io», «lo registro io»). I testi della prima casella sono **BOZZA**: segnali con il commento `// BOZZA: da far rivedere`, come gli altri.
8. **Test:** test **Vitest puri** in `tests/landing/landing-passo5.test.js`, senza browser e senza rete. I test dei passi 1–4 devono continuare a passare. Poi `npm run test:run`. **Fallimenti noti sul mio PC Windows** (`ERR_UNSUPPORTED_ESM_URL_SCHEME`, test del simulatore con l'emulatore spento) **non sono regressioni**: elencali a parte senza correggerli.
9. **`simulator/manifest.json`:** se dopo i test risulta modificato, ripristinalo:
   ```powershell
   git restore simulator/manifest.json
   ```
10. **Cache PWA:** controlla `git config core.hooksPath`. Se risponde `.githooks`, l'hook fa da solo. Se non risponde niente: in questo passo **non** tocchi file dell'app (`core/`, `shared/`, `modules/`), quindi **non** serve `npm run bump:pwa-cache`.
11. **Mai nei commit:** `docs-sviluppo/in-sviluppo/HANDOFF_ESTRAZIONE_SCRIPT_PAGINE.md` e la cartella `test-results/`. Aggiungi i file **uno per uno o per cartella del passo** (`git add landing/public/tony-live`). Mai `git add .` né `git add -A`. Prima del commit mostrami `git status`.
12. **Nessun deploy** in nessuna forma (`deploy:landing`, `deploy:hosting`, `deploy:functions`, `deploy:rules`, `deploy:firebase`, `firebase deploy`). Niente console Firebase.
13. **PR:** alla fine apri una **PR in bozza (draft) verso `develop`**. **Non fare il merge**, niente push su `develop` né su `main`.

## A. Gli asset (clip e suoni): copiali dal mio PC nel repo

I file li ha preparati Spot GFV e sono già sul mio PC, estratti in `Downloads\gfv-landing-tony\live\` (le clip) e `Downloads\gfv-landing-tony\live\audio\` (i suoni). **Non sono nel repo**: copiali tu con PowerShell, uno per riga. Questi file **vanno nel repo** (sono piccoli, circa 3,9 MB in tutto) nella cartella nuova `landing/public/tony-live/`, che **non** è nel `.gitignore` (il `.gitignore` esclude solo `landing/public/video/*.mp4` e `*.webm`: non cambiarlo).

```powershell
New-Item -ItemType Directory -Force -Path landing\public\tony-live
New-Item -ItemType Directory -Force -Path landing\public\tony-live\audio
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-entry-desktop-desktop-576x720-alpha.webm landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-entry-desktop-desktop-576x1440-stacked-alpha.mp4 landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-entry-mobile-mobile-432x540-alpha.webm landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-entry-mobile-mobile-432x1080-stacked-alpha.mp4 landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-idle-loop-desktop-576x720-alpha.webm landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-idle-loop-desktop-576x1440-stacked-alpha.mp4 landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-idle-loop-mobile-432x540-alpha.webm landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-idle-loop-mobile-432x1080-stacked-alpha.mp4 landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-exit-desktop-576x720-alpha.webm landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-exit-desktop-576x1440-stacked-alpha.mp4 landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-exit-mobile-432x540-alpha.webm landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\tony-exit-mobile-432x1080-stacked-alpha.mp4 landing\public\tony-live\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-bussata-desktop-vetro.mp3 landing\public\tony-live\audio\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-bussata-desktop-vetro.ogg landing\public\tony-live\audio\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-bussata-mobile-telefono.mp3 landing\public\tony-live\audio\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-bussata-mobile-telefono.ogg landing\public\tony-live\audio\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-knock-glass-03.mp3 landing\public\tony-live\audio\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-knock-glass-03.ogg landing\public\tony-live\audio\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-knock-phone-03.mp3 landing\public\tony-live\audio\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-knock-phone-03.ogg landing\public\tony-live\audio\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-whoosh-soft-01.mp3 landing\public\tony-live\audio\
Copy-Item $HOME\Downloads\gfv-landing-tony\live\audio\tony-whoosh-soft-01.ogg landing\public\tony-live\audio\
```

**Se un file non c'è, fermati e dimmi quali mancano** (vuol dire che non ho ancora estratto gli zip `live-B-web.zip` o `live-C-audio-v2.zip`: lo faccio io e poi riprendiamo). Non cercare di generare o scaricare i file da altre parti.

Cosa sono:
- `*-alpha.webm` = **WebM VP9 con trasparenza**: per Chrome, Edge, Firefox, Android.
- `*-stacked-alpha.mp4` = **MP4 H.264** in cui la **metà alta è il colore** e la **metà bassa è la trasparenza** (in grigi: bianco = visibile, nero = trasparente). Serve per **Safari e iPhone**, che non gestiscono bene la trasparenza dei WebM. Si disegna su un `<canvas>` (sezione C).
- Varianti: `desktop` 576×720 (per finestre ≥ 768 px) e `mobile` 432×540 (sotto 768 px). Tutte le clip hanno rapporto 4:5. Durate: entry circa 2,9 s, idle 4 s (loop continuo), exit circa 3 s.
- `tony-bussata-desktop-vetro` e `tony-bussata-mobile-telefono` = la bussata **intera già montata** (1,63 s) con i tre colpi già al posto giusto: **0,4 s, 0,7 s e 1,1 s** dall'inizio del file. `tony-knock-*-03` = il terzo colpo da solo (serve per ripeterlo se le clip tardano). `tony-whoosh-soft-01` = fruscio leggero per l'entrata.

## B. Il flag e la configurazione

In `landing/src/config/landing-config.js`, nello stesso stile degli altri flag:
- `export const TONY_BUSSA_ATTIVO = false;` con un commento di una riga in italiano («Tony bussa ed entra sulla landing. Spento: i pulsanti portano alla registrazione classica.»).
- `export const VERSIONE_AVVISO_TONY = 'avviso-tony-2026-10-26';` (versione della prima casella, salvata con la presa visione).

Per poterlo provare **in locale senza accendere il flag**, crea in `landing/src/lib/tony-bussa-logica.js` una funzione pura come `scegliVistaHome`:
- `tonyBussaVisibile({ flag, dev, query })` → `true` se `flag === true`, **oppure** se `dev === true` **e** l'indirizzo contiene `?tonybussa=1`. In tutti gli altri casi `false`.
- `dev` si calcola come nel router: `import.meta.env.DEV === true || import.meta.env.MODE === 'anteprima'`. **Nella build normale (quella del deploy) con il flag spento deve essere sempre `false`**, anche con `?tonybussa=1`.

## C. La logica pura (`landing/src/lib/tony-bussa-logica.js`)

Tutto quello che si può, scrivilo come **funzioni pure** (niente DOM, niente Vue), così si testa con Vitest:

1. **`varianteScena(larghezzaPx)`** → `'desktop'` se ≥ 768, altrimenti `'mobile'` (stessa soglia di `formatoVideo`).
2. **`formatoClip({ userAgent, webmAlfaSupportato })`** → `'webm'` oppure `'stacked'`. Regola: Safari (desktop o iPhone/iPad, cioè WebKit **senza** Chrome/Chromium/Edge/Firefox nel user agent, e **tutti** i browser su iOS/iPadOS) → `'stacked'`; altrimenti `'webm'` se `webmAlfaSupportato` è vero (in pagina: `video.canPlayType('video/webm; codecs="vp09.00.10.08"')` diverso da stringa vuota), altrimenti `'stacked'`.
3. **`percorsoClip(nome, variante, formato)`** con `nome` tra `'entry'`, `'idle'`, `'exit'` → il percorso giusto sotto `/tony-live/` (attenzione: l'entrata desktop è `tony-entry-desktop-desktop-…`, quella mobile è `tony-entry-mobile-mobile-…`; idle ed exit sono `tony-idle-loop-<variante>-…` e `tony-exit-<variante>-…`).
4. **`percorsiAudio(variante)`** → per desktop la bussata «vetro», il terzo colpo «glass» e il whoosh; per mobile la bussata «telefono», il terzo colpo «phone» e il whoosh. Ognuno con MP3 e OGG.
5. **`tempiScena({ variante, riduciMovimento })`** → i tempi in millisecondi, presi dal brief:
   - chiusura della prima casella con dissolvenza: 200 ms;
   - avvio del suono della bussata: 0 (i colpi sono già dentro il file a 400, 700, 1100 ms);
   - scossone della pagina a 400, 700 e 1100 ms: spostamento di **2 px per 80 ms** su desktop, **1–2 px** su mobile; **nessuno scossone** se `riduciMovimento`;
   - solo desktop: **impronta di nocche** semitrasparente nell'angolo in basso a destra a 1100 ms per 400 ms (niente se `riduciMovimento`);
   - entrata di Tony a **2000 ms** con il whoosh;
   - attesa massima delle clip: se a 2000 ms la clip `entry` non è pronta, si ripete il **terzo colpo** e si parte appena è pronta; a **5000 ms** senza clip si mostra Tony **statico** (per ora `landing/src/assets/tony-icon.png` in un cerchio) e il fumetto compare lo stesso.
6. **`SCHEMA_VIBRAZIONE = [40, 260, 40, 340, 60]`** e **`dovrebbeVibrare({ variante, haVibrate, riduciMovimento })`**: vibra solo su mobile, solo se `navigator.vibrate` esiste, mai con `riduciMovimento`. La vibrazione parte a **400 ms** (così i tre impulsi cadono sui tre colpi). iPhone non vibra: va bene così.
7. **Presa visione della prima casella** con il `localStorage` passato come parametro (per i test): `leggiPresaVisione(storage, versione)` e `salvaPresaVisione(storage, versione, adesso)`. Chiave unica, per esempio `gfv-avviso-tony`, valore JSON `{ versione, data }`. **Niente cookie.** Se la versione salvata è uguale a quella attuale, al clic successivo su «Vuoi provare GFV?» si salta la casella e si va subito alla bussata. Se `localStorage` non è disponibile (navigazione privata che lo blocca), non deve rompersi niente: si mostra la casella ogni volta.
8. **Macchina a stati** semplice: `prossimoStato(stato, evento)` con gli stati `nascosto → avviso → bussa → entra → idle → esce → nascosto`, più `statico` per il ripiego. Eventi: `apri`, `conferma`, `rinuncia`, `bussataFinita`, `entrataFinita`, `clipNonPronta`, `saluta`, `uscitaFinita`. Un evento non previsto lascia lo stato com'è.

E in `landing/src/lib/stacked-alpha-player.js` il **player per i file «stacked»**: un `<video>` nascosto (`muted`, `playsinline`) e un `<canvas>` visibile; a ogni fotogramma (`requestVideoFrameCallback` se c'è, altrimenti `requestAnimationFrame`) disegna la metà alta come colore e usa la metà bassa come trasparenza. Funzioni `avvia(canvas, src, { loop, onFine })` e `ferma()`, che libera il video e smette di disegnare. Il canvas deve avere le dimensioni della metà alta (es. 576×720). Un esempio minimo che funziona (da migliorare se serve, per esempio con WebGL se il 2D è lento sui telefoni):

```js
// metà alta = colore, metà bassa = alfa
const w = v.videoWidth, h = v.videoHeight / 2;
bctx.drawImage(v, 0, 0);
const col = bctx.getImageData(0, 0, w, h), al = bctx.getImageData(0, h, w, h);
for (let i = 3; i < col.data.length; i += 4) col.data[i] = al.data[i - 3];
ctx.putImageData(col, 0, 0);
```

## D. I componenti

### D1. `landing/src/components/TonyAvviso.vue` — la prima casella (modale). BOZZA
- **Titolo:** «Stai per parlare con Tony»
- **Testo** (dal brief, BOZZA, da mettere in `testi-landing.js`):
  > Tony è un **assistente virtuale basato sull'intelligenza artificiale**, non una persona. **Anche la voce di Tony è generata con l'intelligenza artificiale.** Risponde solo su Global Farm View e può sbagliare: per prezzi e condizioni valgono la pagina dei prezzi e i Termini.
  > Le tue domande sono elaborate da Google (Gemini) e la voce da ElevenLabs. **Noi non salviamo il testo della conversazione; Google ed ElevenLabs lo elaborano per rispondere e possono conservarlo per breve tempo per motivi di sicurezza**, come spiegato nell'informativa. In chiacchierata non scrivere nome, telefono o email: se decidi di registrarti, email e password le inserisci in un modulo a parte, che Tony non legge.
  > Per proteggere il servizio usiamo Google reCAPTCHA. Per limitare le domande teniamo **contatori temporanei**, legati a un codice calcolato dal tuo IP, che non salviamo in chiaro e che si cancella dopo 48 ore.
  > Se usi il microfono, la dettatura è gestita dal tuo browser. **Servizio riservato a maggiorenni che usano Global Farm View per la propria attività agricola.**
  > Titolare: Pierpaolo Rossi[, email se `EMAIL_CONTATTO` non è vuota]. [Informativa privacy](/privacy#tony)

  Nota: la parola «reCAPTCHA» scritta qui farebbe fallire il test «niente da fuori» del passo 1, che cerca la stringa `recaptcha` in tutti i file di `landing/src`. **Non modificare quel test.** Scrivi nel testo «Google reCAPTCHA» spezzando la parola in modo che il sorgente non contenga la sequenza `recaptcha` (per esempio `'Google re' + 'CAPTCHA'` con un commento che spiega perché), **oppure** proponimi un'alternativa nel riepilogo. Il visitatore deve leggere «Google reCAPTCHA».
- **Casella** obbligatoria (presa visione, **non preselezionata**): «Ho letto e voglio parlare con Tony.»
- **Opzione** «Audio attivo», **preselezionata**: se la tolgo, niente suoni (restano scossone, impronta e testo).
- **Pulsanti:** «Fai entrare Tony» (attivo solo con la casella spuntata) e «No, grazie» (chiude e basta).
- Accessibile: `role="dialog"`, `aria-modal="true"`, titolo collegato, focus sul primo elemento, **Esc** chiude, il focus torna al pulsante che l'ha aperta.
- **Mentre la casella è aperta**, in background si **precaricano** le clip `entry` e `idle` della variante giusta e i suoni (con `fetch` o creando gli elementi `<video>`/`<audio>` con `preload="auto"`), così alla bussata sono pronte.

### D2. `landing/src/components/TonyStage.vue` — la scena
- Caricato **solo** quando serve (`defineAsyncComponent(() => import('./TonyStage.vue'))` in `LandingHome.vue`).
- **La pagina non cambia:** nessun overlay scuro, nessuno spinner. Tony è `position: fixed` sopra la pagina.
- **Desktop (≥ 1024 px secondo il brief; usa la soglia di `varianteScena` per le clip e sistema il CSS tra 768 e 1023 px in modo ragionevole):** Tony in basso a destra, alto circa il **28–32% dell'altezza della finestra**, senza coprire il pulsante principale; il fumetto a sinistra di Tony, largo 360–400 px.
- **Mobile (< 768 px):** Tony sale dal basso e si ferma a mezzo busto, circa il **30% dello schermo**; il fumetto è un **pannello dal basso** (in questo passo può essere più basso del 55% previsto per la chat, visto che c'è solo il saluto).
- Sopra il fumetto, **sempre visibile**, l'etichetta fissa: **«Tony · assistente virtuale con IA»**.
- **Due elementi video sovrapposti** (o due canvas per il formato stacked) per passare da `entry` a `idle` **senza stacchi**: l'ultimo fotogramma dell'entrata è uguale al primo dell'idle.
- **Testo del fumetto** (solo testo in questo passo, niente voce; in `testi-landing.js`, prendi i giorni da `GIORNI_GUIDA_TONY`):
  - desktop: «Ehi, ciao! Sono Tony. Ho bussato perché mi hai chiamato. Presto potrai farmi domande qui. Intanto crea il tuo account gratuito: dentro Global Farm View ti guido io per 7 giorni.»
  - mobile: «Ciao! Sono Tony. Presto potrai farmi domande qui. Intanto crea il tuo account gratuito: dentro GFV ti guido io per 7 giorni.»
  («Ti guido» = Tony spiega: va bene. Non scrivere che Tony apre pagine o fa operazioni.)
- **Pulsanti nel fumetto:** «Crea il tuo account gratuito» (link a `URL_REGISTRAZIONE`, quello che c'è già) e «✕ Saluta Tony» → clip `exit`, poi tutto sparisce e il pulsante «Vuoi provare GFV?» si può premere di nuovo. Anche **Esc** saluta Tony.
- **Audio:** si avvia **solo dentro il clic** su «Fai entrare Tony» (è il gesto che permette al browser di suonare). Formato: OGG se `canPlayType('audio/ogg; codecs="vorbis"')`, altrimenti MP3. Volume normale; se il browser blocca l'audio, si va avanti in silenzio senza errori.
- **Vibrazione:** solo come da `dovrebbeVibrare`, a 400 ms, con `SCHEMA_VIBRAZIONE`.
- **Scossone:** trasformazione CSS (`translate`) sul contenitore della pagina, non sul `body` intero se crea problemi di scroll; mai con `prefers-reduced-motion`.
- **`prefers-reduced-motion`:** niente scossone, niente impronta, niente entrata animata: Tony **compare con una dissolvenza** direttamente in `idle`; all'uscita sparisce con una dissolvenza.
- **Pulizia:** quando Tony esce o il componente si smonta, fermare video, audio, timer e `requestAnimationFrame` (niente perdite di memoria, niente suoni che continuano).

### D3. `landing/src/views/LandingHome.vue`
- Togli **le due** righe `<p class="cta-whisper">{{ t.hero.tonyDicembre }}</p>` e la chiave `tonyDicembre` da `testi-landing.js`. Se la classe CSS `.cta-whisper` non serve più, toglila.
- I **tre** pulsanti «Vuoi provare GFV?» (desktop, mobile, chiusura):
  - se `tonyBussaVisibile(...)` è **falso** → restano **identici a oggi** (link `<a :href="URL_REGISTRAZIONE">`);
  - se è **vero** → diventano `<button type="button">` con lo stesso aspetto, che aprono la prima casella (o direttamente la bussata se la presa visione è già salvata con la versione attuale).
- Il link «Preferisco registrarmi da solo» resta com'è in tutti i casi.

## E. File del passo (attesi)
- `landing/src/config/landing-config.js` — flag e versione avviso;
- `landing/src/content/testi-landing.js` — via `tonyDicembre`, testi nuovi (prima casella BOZZA, etichetta, saluti, pulsanti);
- `landing/src/lib/tony-bussa-logica.js` — nuovo;
- `landing/src/lib/stacked-alpha-player.js` — nuovo;
- `landing/src/components/TonyAvviso.vue` — nuovo;
- `landing/src/components/TonyStage.vue` — nuovo;
- `landing/src/views/LandingHome.vue`;
- `landing/public/tony-live/**` — asset copiati (sezione A);
- `landing/README.md` — breve sezione «Tony bussa ed entra (passo 5)»: flag, come provarlo in locale con `?tonybussa=1`, dove stanno gli asset e da dove vengono;
- `tests/landing/landing-passo5.test.js` — nuovo.
Se devi toccare altri file, fermati e dimmi quali e perché.

## F. Test (`tests/landing/landing-passo5.test.js`)
1. `TONY_BUSSA_ATTIVO` è `false`.
2. `tonyBussaVisibile`: flag spento + build normale → `false` anche con `?tonybussa=1`; flag spento + dev + `?tonybussa=1` → `true`; flag spento + dev senza parametro → `false`; flag acceso → `true`.
3. `varianteScena`: 375 e 767 → mobile; 768 e 1440 → desktop.
4. `formatoClip`: user agent di Safari macOS, iPhone Safari, iPhone Chrome (`CriOS`) → `stacked`; Chrome desktop, Edge, Firefox, Chrome Android con WebM supportato → `webm`; Chrome con WebM **non** supportato → `stacked`.
5. `percorsoClip` e `percorsiAudio`: ogni percorso restituito per tutte le combinazioni **esiste davvero** in `landing/public/` (controllo con `fs.existsSync`).
6. **Pesi** (brief 3.2): per ogni variante e formato, `entry` ≤ 1,8 MB desktop / 1,2 MB mobile; ogni loop ≤ 800 KB desktop / 500 KB mobile; i suoni scaricati in una scena (bussata + terzo colpo + whoosh, un solo formato) ≤ 60 KB.
7. `tempiScena`: colpi a 400/700/1100, entrata a 2000, statico a 5000; con `riduciMovimento` niente scossone e niente impronta; impronta solo su desktop.
8. `dovrebbeVibrare` e `SCHEMA_VIBRAZIONE` uguale a `[40, 260, 40, 340, 60]`; mai su desktop, mai senza `vibrate`, mai con `riduciMovimento`.
9. Presa visione: salva e rilegge con la stessa versione; con versione diversa → da rifare; `localStorage` che lancia errori → nessuna eccezione, si mostra la casella.
10. `prossimoStato`: il percorso completo, «No, grazie» dalla casella torna a `nascosto`, `clipNonPronta` porta a `statico`, eventi non previsti non cambiano stato.
11. **Testi:** nessuna parola vietata nei testi nuovi; non c'è più «dicembre» in `testi-landing.js` né in `LandingHome.vue`; nei testi di Tony nessuna frase che prometta di aprire pagine o fare operazioni (cerca per esempio «ti porto», «apro», «registro io», «compilo»); la prima casella contiene «non una persona», «Gemini», «ElevenLabs», «48 ore», «maggiorenni».
12. **Caricamento pigro:** `LandingHome.vue` importa `TonyStage.vue` solo tramite `import()` (nessun `import TonyStage from` statico); nessun file di `landing/src` contiene percorsi `/tony-live/` fuori da `tony-bussa-logica.js` (così le clip non entrano nella pagina iniziale).
13. **Con il flag spento i pulsanti restano link:** nel template di `LandingHome.vue` c'è ancora `:href="URL_REGISTRAZIONE"` per i tre «Vuoi provare GFV?».

Poi `npm run test:run` (ricorda la regola 9).

## G. Prova a mano (in locale, non è un deploy)
```powershell
cd landing
npm install
npm run dev
```
Apri `http://localhost:5173/?tonybussa=1`:
- sul computer: casella → bussata con scossone e impronta → Tony entra da destra → idle → «✕ Saluta Tony» esce;
- con gli strumenti del browser in modalità telefono (larghezza 390): Tony entra dal basso, fumetto in basso;
- con «Audio attivo» tolto: niente suono, il resto c'è;
- con «riduci movimento» attivo nel sistema: Tony compare con una dissolvenza;
- **senza** `?tonybussa=1`: i pulsanti portano alla registrazione classica come oggi.
Poi controlla che la build normale non sia cambiata:
```powershell
npm run build
npm run preview
```
Deve comparire «Coming soon», come oggi. Torna alla radice con `cd ..`.

Se puoi, dimmi anche come provarlo dal mio telefono Android e da un iPhone sulla stessa rete (`npm run dev -- --host`): lo farò io.

## H. Commit e PR
- Messaggio di commit in italiano: `feat(landing): passo 5, Tony bussa ed entra (clip e suoni, senza IA, flag spento)`.
- Push e **PR in bozza verso `develop`**:
  ```powershell
  git push -u origin feat/landing-passo5
  gh pr create --draft --base develop --title "Landing passo 5: Tony bussa ed entra (clip e suoni, flag TONY_BUSSA_ATTIVO spento)" --body "Prima casella, bussata (suono, scossone, impronta, vibrazione), entrata, idle e uscita di Tony con clip trasparenti (WebM alfa e MP4 stacked per Safari). Niente chat, niente IA, niente Firebase. Tolta la riga 'A dicembre Tony bussa anche qui.'. Con il flag spento il comportamento è invariato. Nessun deploy."
  ```
  Se `gh` non è disponibile, dimmelo e dammi il link per aprire la PR dal browser.
- **Niente merge.**

## Cosa mi riporti alla fine (checklist per Pier)
Rispondimi in italiano semplice, con questa lista:
- [ ] Il passo 4 era su `develop`? (hash del commit di `develop` da cui sei partito)
- [ ] Gli asset c'erano tutti nella cartella Downloads? Quanto pesa `landing/public/tony-live/`?
- [ ] Nome del branch e link della PR in bozza.
- [ ] Dove sta il flag e come si accende; come provo in locale (`?tonybussa=1`).
- [ ] Elenco dei file cambiati, con una riga ciascuno.
- [ ] Conferma: con il flag spento i pulsanti sono identici a oggi e la build normale mostra ancora «Coming soon»; l'unico cambiamento visibile è la riga «A dicembre…» tolta.
- [ ] Conferma: niente in `core/`, `functions/`, `firestore.rules`, `firebase.json`, Tony dell'app; nessuna dipendenza nuova; nessuna richiesta a domini esterni.
- [ ] Come hai risolto la parola «reCAPTCHA» nella prima casella senza toccare il test del passo 1.
- [ ] Risultato dei test: nuovi test passati; fallimenti noti di Windows elencati a parte; altri fallimenti.
- [ ] `simulator/manifest.json` ripristinato? `git status` finale pulito (niente HANDOFF, niente `test-results/`)?
- [ ] Cosa hai provato a mano e cosa resta da provare sui telefoni veri (Android con vibrazione, iPhone con il formato stacked).
- [ ] Dubbi o rischi (per esempio il player stacked lento sui telefoni vecchi).
- [ ] Ricorda: **nessun deploy** fatto.

## Dopo l'unione (lo faccio io, non tu)
PR squash su `develop`, poi `promote/landing-passo5` verso `main`. Con il flag spento **non serve pubblicare** la landing; quando vorrò, userò solo `npm run deploy:landing`.
