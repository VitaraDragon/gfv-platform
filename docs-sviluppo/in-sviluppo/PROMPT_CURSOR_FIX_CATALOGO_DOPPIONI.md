# Fix catalogo doppioni: categorie, colture e tipi lavoro omonimi (unione in codice + seed idempotente)

Repo: VitaraDragon/gfv-platform (ERP agricolo, Firebase + JS). Lavori sul PC Windows, in PowerShell. Il prompt è completo: la patch da applicare è qui sotto, per intero. Base: `origin/develop` = `11b5b91ec5148886a94be690f02e8a57d52d0239` (squash di #277). Le righe citate si riferiscono a develop `11b5b91e`; per tutti i file toccati coincidono con `origin/main` 76ba26f6.

## Perché

Ritest su Pages, tenant **Cascina Conti** (titolare nuovo, nessun modulo coltura attivo), dopo #277/#278:
- **Terreni**: le 9 categorie compaiono una volta sola (ok). Però **Vite** e **Frutteto** danno «Nessuna coltura disponibile» e in Modifica «Vigna Nord» la categoria non viene preselezionata.
- Seminativo mostra ogni coltura due volte.
- **Diario**: categorie tutte doppie e tipo lavoro specifico doppio.

Cause, verificate nel codice:
1. **Seed non idempotente.**
   - `initializeCategoriePredefinite`, `initializeColturePredefinite` e `initializeTipiLavoroPredefiniti` creano con `addDoc`, cioè id casuali (`firebase-service.js:245`, `categorie-service.js:74/124/139`, `colture-service.js:90`, `tipi-lavoro-service.js:100`).
   - Non c'è lock. Il controllo dei doppioni avviene solo su una lettura fatta prima di scrivere.
   - Chiamate concorrenti (load di Terreni `terreni-standalone.html:1534` + `openTerrenoModal` `terreni-events.js:48`, seed in background di Gestione lavori `gestione-lavori-standalone.html:3807`, Diario `attivita-controller.js:2712`) leggono entrambe «vuoto» e scrivono entrambe.
   - In più, `getAllCategorie`, `getAllColture` e `getAllTipiLavoro` restituiscono `[]` sugli errori (`categorie-service.js:278`, `colture-service.js:148`, `tipi-lavoro-service.js:182`), quindi una lettura fallita fa ri-seminare tutto.
2. **Mappe codice→id «vince l'ultima»** (`colture-service.js:62-65`, `tipi-lavoro-service.js:42-52`): le colture e i tipi finiscono su una copia qualsiasi della categoria.
3. **Dedup di #277 prematura.** `loadCategorieColtureTerreni` deduplica SENZA colture e riduce l'array di stato in place (`terreni-controller.js:360-362`). A parità di condizioni decide con `localeCompare` sugli id (`terreni-categorie-colture.js:58`). La seconda dedup «con colture» (`:491`, `:557`) lavora sull'array già ridotto, quindi la copia con le colture è già persa. `localeCompare` non segue l'ordine byte di Firestore: per questo Vite/Frutteto risultano vuoti e Seminativo no.
4. **Preselezione in Modifica.** Il terreno salva solo il nome della coltura (`terreni-events.js:244-277`). La categoria viene ricavata cercando quel nome nella mappa (`terreni-events.js:66-84`) e cade sull'id della copia scartata, che non è nel select.
5. **Diario e cascade lavoro senza dedup.** `attivita-controller.js:2388-2438` (categorie e colture), `buildLavoroCategorieIndex` (`lavoro-cascade-filters.js:58-96`, non deduplica principali né sottocategorie), `filterTipiLavoroByCategoria` (nessuna dedup per nome). Moduli: `frutteti-page.js:250-265` e `seminativi-service.js:172-207` prendono solo la PRIMA copia.

**Nota base:** #277 è già su develop (`11b5b91e`). La patch modifica i file esistenti di #277 (`terreni-categorie-colture.js`, `terreni-controller.js`, `categorie-service.js`, `tests/moduli-identificatori-definiti.test.js`); `tests/terreni-categorie-colture.test.js` resta invariato e passa così com'è.

**Correzione:**
- **(a) Unione in codice.**
  - Nuovo helper puro `core/js/catalogo-dedupe.js`: raggruppa le copie per `codice` (in mancanza, nome normalizzato più ambito); le sottocategorie per codice padre + codice.
  - Canonico deterministico: `predefinita`, poi `createdAt` più vecchio, poi id in ordine byte (niente `localeCompare`). Produce la mappa `aliasToCanon` e gli `aliasIds` sulle canoniche.
  - Unisce le colture di tutto il gruppo sotto il canonico, senza doppioni per nome; deduplica i tipi lavoro per nome + categoria/sottocategoria canonica.
  - Terreni: niente più riduzione in place, colture unite, preselezione via alias, tendina colture senza doppioni.
  - Diario: categorie e colture unite.
  - `buildLavoroCategorieIndex`, `relinkTipiLavoroToCategorie`, `filterTipiLavoroByCategoria` e `resolveLavoroCascadeParents` lavorano su id canonici: ne beneficiano anche Diario e Gestione lavori.
  - Moduli frutteto e seminativo: tutte le copie, senza doppioni. `getTipiLavoroNomi`: nomi unici.
- **(b) Seed idempotente.**
  - Nuovo `core/services/catalogo-seed.js`: `idSeed` → `seed_<codice>` / `seed_<slug nome>`, `conLockSeed` (una promise in corso per tenant), `datiSeed`.
  - I tre seed scrivono con `setDocument` (merge) su id deterministici, leggono con letture «grezze» che LANCIANO in caso di errore (nessuna scrittura se la lettura fallisce) e mappano codice→id canonico tramite helper.
  - `firestore.rules` NON va toccato: `tenants/{t}/categorie|colture|tipiLavoro/{id}` permette già create/update con qualunque id al manager (righe 312-327).
- **Niente pulizia dati.** I doppioni già presenti in Firestore restano: l'unione in codice li nasconde. Terreni, attività e lavori salvano i nomi, non gli id del catalogo.

## Divieti

- NON toccare `core/js/tony/**`, `core/js/gfv-tony-loader.js`, `functions/**`, `firestore.rules`. La patch non li tocca; se ti sembra di doverli cambiare, fermati e chiedi.
- NON fare pulizia dati Firestore, script una tantum, deploy o scritture da console.
- NON modificare a mano `SW_CACHE_BUILD_ID` in `service-worker.js` (vedi passo 5).
- NON lanciare la suite vitest intera (avvia gli emulatori) e NON aprire porte 8183/8080/9099.
- NON fare merge della PR e NON fare checkout di `main` in questa cartella.
- Ignora i file non tracciati che c'erano già (es. `HANDOFF_ESTRAZIONE_SCRIPT_PAGINE.md`, `test-results/`): non aggiungerli e non cancellarli.

## File toccati dalla patch (numstat)

| File | + / − | Cosa |
|---|---|---|
| `core/js/catalogo-dedupe.js` | +300 (nuovo) | helper puro: raggruppa, canonico, alias, unione colture, dedupe tipi |
| `core/services/catalogo-seed.js` | +72 (nuovo) | `idSeed`, `conLockSeed`, `datiSeed` |
| `core/js/terreni-categorie-colture.js` | +3/−1 | tie-break id in ordine byte (niente `localeCompare`) |
| `core/js/terreni-controller.js` | +15/−17 | niente dedup in place: select dalle canoniche, unione colture sotto il canonico |
| `core/js/terreni-events.js` | +10/−10 | preselezione Modifica via alias, tendina colture senza doppioni |
| `core/js/attivita-controller.js` | +6/−0 | Diario: categorie/colture unite |
| `core/js/lavoro-cascade-filters.js` | +21/−7 | indice/filtri/resolve lavoro su id canonici, tipi senza doppioni |
| `core/services/categorie-service.js` | +48/−45 | seed idempotente + `leggiCategorieGrezze` |
| `core/services/colture-service.js` | +36/−32 | seed idempotente, categoria canonica |
| `core/services/tipi-lavoro-service.js` | +31/−30 | seed idempotente, categorie canoniche |
| `core/services/liste-service.js` | +2/−1 | `getTipiLavoroNomi` nomi unici |
| `modules/frutteto/js/frutteti-page.js` | +8/−4 | specie da tutte le copie di Frutteto |
| `modules/seminativo/services/seminativi-service.js` | +10/−4 | colture/terreni da tutte le copie di Seminativo |
| `tests/catalogo-dedupe.test.js` | +203 (nuovo) | 20 test |
| `tests/catalogo-doppioni-scenario.test.js` | +141 (nuovo) | 4 test, scenario in due passi |
| `tests/catalogo-seed-idempotente.test.js` | +165 (nuovo) | 11 test, seed con Firestore finto |
| `tests/moduli-identificatori-definiti.test.js` | +12 | moduli nuovi e toccati in lista; `sottocategoria` in `tipi-lavoro-service.js` segnata come preesistente |

Totale: 17 file, +1123/−151. Non toccati: `tests/terreni-categorie-colture.test.js`, `service-worker.js` (`SW_CACHE_BUILD_ID` su develop = `t1792781516751`, lo aggiorna l'hook al commit). Patch: `fix-catalogo-doppioni.diff`, sha256 `ba6b3bc6f49067968128a2ab5b75a392b505af974b39368f415cd5ee48eaa041`.

## Passi (PowerShell, un comando per riga)

### 1. Riportare il ramo locale esistente su develop aggiornato

Il ramo locale `fix/catalogo-doppioni` esiste già (tentativo precedente, su base sbagliata): va riportato a `origin/develop`. Prima controlla che non ci siano modifiche tracciate da salvare:

```powershell
git status --short
```

Se mostra file tracciati modificati (righe ` M`, `M `, `A `), fermati e chiedimi: il reset li cancellerebbe. I non tracciati preesistenti (`??`) vanno ignorati. Poi:

```powershell
git fetch origin
git rev-parse origin/develop
git checkout fix/catalogo-doppioni
git reset --hard origin/develop
git rev-parse HEAD
```

Entrambi i `rev-parse` devono stampare `11b5b91ec5148886a94be690f02e8a57d52d0239`. Se `origin/develop` è diverso, vai avanti solo se `git apply --check` (passo 2) passa; altrimenti fermati e riportami lo sha. Se `fix/catalogo-doppioni` era già stato pushato su origin, dimmelo prima del passo 7 (servirà un push forzato, da confermare).

### 2. Salvare la patch e applicarla

Crea nella radice del repo il file `fix-catalogo-doppioni.diff` con il contenuto ESATTO del blocco qui sotto, dalla riga `diff --git` all'ultima riga prima della chiusura del blocco. Usa il tuo strumento di scrittura file, non `Set-Content` o `Out-File`. Il file va in UTF-8 senza BOM, con fine riga LF e con un a capo finale. Non riformattarlo e non togliere gli spazi a fine riga: tre righe aggiunte ne hanno (stile dei file originali) e `git apply` li segnala solo come avviso.

Verifica l'impronta prima di applicare:

```powershell
(Get-FileHash fix-catalogo-doppioni.diff -Algorithm SHA256).Hash.ToLower()
```

Deve stampare `ba6b3bc6f49067968128a2ab5b75a392b505af974b39368f415cd5ee48eaa041`. Se è diversa, il file salvato non è identico: correggilo e non andare avanti.

````diff
diff --git a/core/js/attivita-controller.js b/core/js/attivita-controller.js
index 2a95b5ec..78c6eb0b 100644
--- a/core/js/attivita-controller.js
+++ b/core/js/attivita-controller.js
@@ -34,6 +34,7 @@ import {
     resolvePreserveCascadeSelection,
     terrenoHaColturaVite,
 } from './lavoro-cascade-filters.js';
+import { raggruppaCategorie, unisciColturePerCategoria } from './catalogo-dedupe.js';
 
 // ============================================
 // FUNZIONI HELPER
@@ -2413,6 +2414,11 @@ export async function loadListe(params) {
                 });
             }
             
+            // Una voce per codice: copie omonime unite sotto la canonica, colture senza doppioni
+            const gruppiColture = raggruppaCategorie(categorieColture);
+            categorieColture = gruppiColture.canoniche;
+            colturePerCategoria = unisciColturePerCategoria(colturePerCategoria, gruppiColture.aliasToCanon);
+
             // Popola dropdown categoria (sia quando si carica la pagina che quando si apre il modal)
             const categoriaSelect = document.getElementById('attivita-coltura-categoria');
             if (categoriaSelect) {
diff --git a/core/js/catalogo-dedupe.js b/core/js/catalogo-dedupe.js
new file mode 100644
index 00000000..2ac8958d
--- /dev/null
+++ b/core/js/catalogo-dedupe.js
@@ -0,0 +1,300 @@
+/**
+ * Unione delle copie omonime del catalogo (categorie, colture, tipi lavoro).
+ * Funzioni pure: nessuna lettura/scrittura Firestore.
+ *
+ * Due documenti con lo stesso codice (o nome, se manca il codice) sono la stessa voce:
+ * se ne sceglie uno canonico in modo deterministico e gli altri diventano alias.
+ * @module core/js/catalogo-dedupe
+ */
+
+/**
+ * Testo normalizzato per confronti: trim, minuscolo, spazi singoli.
+ * @param {unknown} value
+ * @returns {string}
+ */
+export function normalizzaTesto(value) {
+  if (value == null) return '';
+  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
+}
+
+/**
+ * Chiave di raggruppamento di una voce: codice, altrimenti nome, altrimenti id.
+ * @param {{ codice?: string, nome?: string, id?: string }|null|undefined} item
+ * @returns {string}
+ */
+export function chiaveCatalogo(item) {
+  if (!item || typeof item !== 'object') return '';
+  const codice = normalizzaTesto(item.codice);
+  if (codice) return `c:${codice}`;
+  const nome = normalizzaTesto(item.nome);
+  // Senza codice: nome + ambito, così due categorie custom omonime ma per ambiti diversi restano distinte
+  if (nome) return item.applicabileA ? `n:${nome}@${normalizzaTesto(item.applicabileA)}` : `n:${nome}`;
+  return item.id != null && item.id !== '' ? `i:${item.id}` : '';
+}
+
+/**
+ * Millisecondi da Timestamp Firestore, Date, {seconds} o numero. null se assente.
+ * @param {unknown} value
+ * @returns {number|null}
+ */
+export function millisDa(value) {
+  if (value == null) return null;
+  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
+  if (value instanceof Date) {
+    const t = value.getTime();
+    return Number.isFinite(t) ? t : null;
+  }
+  if (typeof value.toMillis === 'function') {
+    const t = value.toMillis();
+    return Number.isFinite(t) ? t : null;
+  }
+  if (typeof value.seconds === 'number') {
+    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
+  }
+  return null;
+}
+
+function confrontaByte(a, b) {
+  if (a === b) return 0;
+  return a < b ? -1 : 1;
+}
+
+/**
+ * Ordine di preferenza tra due copie della stessa voce (negativo se vince a).
+ * 1) predefinita/predefinito; 2) createdAt più vecchio (chi non lo ha perde);
+ * 3) id in ordine byte (niente localeCompare: stabile e uguale ovunque).
+ * @param {object} a
+ * @param {object} b
+ * @returns {number}
+ */
+export function confrontaCanonico(a, b) {
+  const predA = a && (a.predefinita || a.predefinito) ? 1 : 0;
+  const predB = b && (b.predefinita || b.predefinito) ? 1 : 0;
+  if (predA !== predB) return predB - predA;
+
+  const tA = millisDa(a && a.createdAt);
+  const tB = millisDa(b && b.createdAt);
+  if (tA != null && tB != null && tA !== tB) return tA - tB;
+  if (tA != null && tB == null) return -1;
+  if (tA == null && tB != null) return 1;
+
+  const idA = a && a.id != null ? String(a.id) : '';
+  const idB = b && b.id != null ? String(b.id) : '';
+  return confrontaByte(idA, idB);
+}
+
+function copiaCon(item, extra) {
+  const copia = Object.create(Object.getPrototypeOf(item) || Object.prototype);
+  return Object.assign(copia, item, extra);
+}
+
+/**
+ * Raggruppa le categorie omonime. Le sottocategorie sono raggruppate per
+ * (chiave del padre canonico, chiave propria), così le copie di «Potatura › Manuale»
+ * si uniscono anche se appese a copie diverse di «Potatura».
+ *
+ * @param {Array<object>|null|undefined} categorie
+ * @returns {{ canoniche: Array<object>, aliasToCanon: Map<string, string> }}
+ *   canoniche: una per gruppo, nell'ordine della prima occorrenza, copia dell'originale con
+ *   `aliasIds` (tutti gli id del gruppo, canonico incluso) e `parentId` riscritto sul canonico.
+ *   aliasToCanon: id di ogni copia → id canonico.
+ */
+export function raggruppaCategorie(categorie) {
+  const list = (Array.isArray(categorie) ? categorie : []).filter(
+    (c) => c && typeof c === 'object' && c.id != null && c.id !== ''
+  );
+  const byId = new Map(list.map((c) => [String(c.id), c]));
+
+  const chiaveCache = new Map();
+  const chiaveDi = (cat, visti = new Set()) => {
+    const id = String(cat.id);
+    if (chiaveCache.has(id)) return chiaveCache.get(id);
+    const propria = chiaveCatalogo(cat);
+    let chiave = propria;
+    const parentRef = cat.parentId != null && cat.parentId !== '' ? String(cat.parentId) : '';
+    if (parentRef) {
+      const padre = byId.get(parentRef);
+      if (padre && !visti.has(id)) {
+        visti.add(id);
+        chiave = `${chiaveDi(padre, visti)}>${propria}`;
+      } else {
+        chiave = `p:${normalizzaTesto(parentRef)}>${propria}`;
+      }
+    }
+    chiaveCache.set(id, chiave);
+    return chiave;
+  };
+
+  const gruppi = new Map();
+  for (const cat of list) {
+    const chiave = chiaveDi(cat);
+    if (!chiave) continue;
+    if (!gruppi.has(chiave)) gruppi.set(chiave, []);
+    gruppi.get(chiave).push(cat);
+  }
+
+  const aliasToCanon = new Map();
+  const scelte = [];
+  for (const membri of gruppi.values()) {
+    const ordinati = membri.slice().sort(confrontaCanonico);
+    const canonico = ordinati[0];
+    const canonId = String(canonico.id);
+    membri.forEach((m) => aliasToCanon.set(String(m.id), canonId));
+    scelte.push({ canonico, aliasIds: membri.map((m) => String(m.id)) });
+  }
+
+  const canoniche = scelte.map(({ canonico, aliasIds }) => {
+    const extra = { aliasIds };
+    if (canonico.parentId != null && canonico.parentId !== '') {
+      const parentCanon = aliasToCanon.get(String(canonico.parentId));
+      if (parentCanon) extra.parentId = parentCanon;
+    }
+    return copiaCon(canonico, extra);
+  });
+
+  return { canoniche, aliasToCanon };
+}
+
+/**
+ * Id canonico di una voce (o l'id stesso se non è un alias noto).
+ * @param {string|null|undefined} id
+ * @param {Map<string, string>|null|undefined} aliasToCanon
+ * @returns {string|null}
+ */
+export function canonicoDi(id, aliasToCanon) {
+  if (id == null || id === '') return id == null ? null : '';
+  const key = String(id);
+  return (aliasToCanon && aliasToCanon.get(key)) || key;
+}
+
+/**
+ * Mappa alias → canonico ricavata da voci canoniche che portano `aliasIds`.
+ * @param {Array<object>} canoniche
+ * @returns {Map<string, string>}
+ */
+export function aliasMapDaCanoniche(canoniche) {
+  const map = new Map();
+  (Array.isArray(canoniche) ? canoniche : []).forEach((c) => {
+    if (!c || c.id == null) return;
+    const canonId = String(c.id);
+    map.set(canonId, canonId);
+    (Array.isArray(c.aliasIds) ? c.aliasIds : []).forEach((a) => map.set(String(a), canonId));
+  });
+  return map;
+}
+
+/**
+ * Toglie i doppioni per nome (normalizzato) tenendo la copia canonica.
+ * L'ordine segue la prima occorrenza di ogni nome.
+ * @param {Array<object|string>} lista
+ * @returns {Array<object|string>}
+ */
+export function dedupePerNome(lista) {
+  if (!Array.isArray(lista)) return [];
+  const scelti = new Map();
+  const ordine = [];
+  for (const item of lista) {
+    if (item == null) continue;
+    const nome = normalizzaTesto(typeof item === 'string' ? item : item.nome);
+    if (!nome) continue;
+    if (!scelti.has(nome)) {
+      scelti.set(nome, item);
+      ordine.push(nome);
+    } else if (typeof item === 'object' && confrontaCanonico(item, scelti.get(nome)) < 0) {
+      scelti.set(nome, item);
+    }
+  }
+  return ordine.map((n) => scelti.get(n));
+}
+
+/**
+ * Unisce le colture di tutte le copie di una categoria sotto l'id canonico,
+ * senza doppioni per nome. Non modifica l'oggetto in ingresso.
+ * @param {Record<string, Array<object>>|null|undefined} colturePerCategoria
+ * @param {Map<string, string>|null|undefined} aliasToCanon
+ * @returns {Record<string, Array<object>>}
+ */
+export function unisciColturePerCategoria(colturePerCategoria, aliasToCanon) {
+  const out = {};
+  if (!colturePerCategoria || typeof colturePerCategoria !== 'object') return out;
+  for (const [catId, lista] of Object.entries(colturePerCategoria)) {
+    const canon = canonicoDi(catId, aliasToCanon);
+    if (!out[canon]) out[canon] = [];
+    if (Array.isArray(lista)) out[canon].push(...lista);
+  }
+  for (const key of Object.keys(out)) {
+    out[key] = dedupePerNome(out[key]);
+  }
+  return out;
+}
+
+/**
+ * Tipi lavoro senza doppioni: stessa chiave nome + categoria canonica + sottocategoria canonica.
+ * Restituisce copie con categoriaId/sottocategoriaId riscritti sul canonico.
+ * @param {Array<object>} tipi
+ * @param {Map<string, string>|null|undefined} aliasToCanon
+ * @returns {Array<object>}
+ */
+export function dedupeTipiLavoro(tipi, aliasToCanon) {
+  if (!Array.isArray(tipi)) return [];
+  const scelti = new Map();
+  const ordine = [];
+  for (const tipo of tipi) {
+    if (!tipo || typeof tipo !== 'object') continue;
+    const categoriaId = tipo.categoriaId != null && tipo.categoriaId !== ''
+      ? canonicoDi(tipo.categoriaId, aliasToCanon)
+      : tipo.categoriaId ?? null;
+    const sottocategoriaId = tipo.sottocategoriaId != null && tipo.sottocategoriaId !== ''
+      ? canonicoDi(tipo.sottocategoriaId, aliasToCanon)
+      : tipo.sottocategoriaId ?? null;
+    const riga = categoriaId === tipo.categoriaId && sottocategoriaId === tipo.sottocategoriaId
+      ? tipo
+      : { ...tipo, categoriaId, sottocategoriaId };
+    const nome = normalizzaTesto(tipo.nome);
+    const chiave = nome ? `${nome}|${categoriaId || ''}|${sottocategoriaId || ''}` : `i:${tipo.id}`;
+    if (!scelti.has(chiave)) {
+      scelti.set(chiave, riga);
+      ordine.push(chiave);
+    } else if (confrontaCanonico(riga, scelti.get(chiave)) < 0) {
+      scelti.set(chiave, riga);
+    }
+  }
+  return ordine.map((k) => scelti.get(k));
+}
+
+/**
+ * Mappe codice → id canonico per i seed (principali/colture e sottocategorie separate).
+ * @param {Array<object>} categorie
+ * @returns {{ principali: Map<string, string>, sottocategorie: Map<string, string>, canoniche: Array<object> }}
+ */
+export function mappeCodiceCanonico(categorie) {
+  const { canoniche } = raggruppaCategorie(categorie);
+  const principali = new Map();
+  const sottocategorie = new Map();
+  canoniche.forEach((c) => {
+    const codice = normalizzaTesto(c.codice);
+    if (!codice) return;
+    const target = c.parentId ? sottocategorie : principali;
+    if (!target.has(codice)) target.set(codice, String(c.id));
+  });
+  return { principali, sottocategorie, canoniche };
+}
+
+/**
+ * Categoria (id canonico) che contiene una coltura, cercata per nome.
+ * Serve alla preselezione in Modifica: il terreno salva solo il nome della coltura.
+ * @param {string} nomeColtura
+ * @param {Record<string, Array<object|string>>|null|undefined} colturePerCategoria
+ * @param {Map<string, string>|null|undefined} aliasToCanon
+ * @returns {string|null}
+ */
+export function trovaCategoriaPerColtura(nomeColtura, colturePerCategoria, aliasToCanon) {
+  const cercato = normalizzaTesto(nomeColtura);
+  if (!cercato || !colturePerCategoria || typeof colturePerCategoria !== 'object') return null;
+  for (const [catId, lista] of Object.entries(colturePerCategoria)) {
+    if (catId === 'senza_categoria' || !Array.isArray(lista)) continue;
+    const trovata = lista.some((c) => normalizzaTesto(typeof c === 'string' ? c : c && c.nome) === cercato);
+    if (trovata) return canonicoDi(catId, aliasToCanon);
+  }
+  return null;
+}
diff --git a/core/js/lavoro-cascade-filters.js b/core/js/lavoro-cascade-filters.js
index d6c86ffa..d93dd435 100644
--- a/core/js/lavoro-cascade-filters.js
+++ b/core/js/lavoro-cascade-filters.js
@@ -3,6 +3,8 @@
  * @module core/js/lavoro-cascade-filters
  */
 
+import { raggruppaCategorie, aliasMapDaCanoniche, canonicoDi, dedupeTipiLavoro } from './catalogo-dedupe.js';
+
 function sottocategorieMapEntries(sottocategorieLavoriMap) {
   if (!sottocategorieLavoriMap) return [];
   if (sottocategorieLavoriMap instanceof Map) return Array.from(sottocategorieLavoriMap.entries());
@@ -56,7 +58,11 @@ function isCategoriaLavori(categoria) {
  * @returns {{ principali: Array, map: Map }}
  */
 export function buildLavoroCategorieIndex(categorie) {
-  const list = (Array.isArray(categorie) ? categorie : []).filter((c) => c && c.id);
+  // Copie omonime (stesso codice; sottocategorie: stesso codice padre + codice) → una sola voce
+  // canonica con `aliasIds`; `parentId` delle sottocategorie riscritto sul padre canonico.
+  const list = raggruppaCategorie(
+    (Array.isArray(categorie) ? categorie : []).filter((c) => c && c.id)
+  ).canoniche;
   const byId = new Map(list.map((c) => [String(c.id), c]));
   const byCodice = new Map();
   list.forEach((c) => {
@@ -122,11 +128,14 @@ export function relinkTipiLavoroToCategorie(tipiLavoroList, categorieLavoriPrinc
   flat.forEach((c) => {
     if (c && c.codice) byCodice.set(String(c.codice).toLowerCase(), c);
   });
+  // Tipi appesi a una copia non canonica della categoria → id canonico
+  const alias = aliasMapDaCanoniche(flat);
+  const versoCanonico = (ref) => (ref == null || ref === '' ? ref : canonicoDi(ref, alias));
 
   return tipiLavoroList.map((tipo) => {
     if (!tipo) return tipo;
-    let categoriaId = resolveCategoriaRef(tipo.categoriaId, byId, byCodice);
-    let sottocategoriaId = resolveCategoriaRef(tipo.sottocategoriaId, byId, byCodice);
+    let categoriaId = resolveCategoriaRef(versoCanonico(tipo.categoriaId), byId, byCodice);
+    let sottocategoriaId = resolveCategoriaRef(versoCanonico(tipo.sottocategoriaId), byId, byCodice);
     const asSub = (id) => {
       const row = id ? byId.get(String(id)) : null;
       return row && row.parentId ? row : null;
@@ -160,6 +169,10 @@ export function resolveLavoroCascadeParents(
 ) {
   const principali = Array.isArray(categorieLavoriPrincipali) ? categorieLavoriPrincipali : [];
   const principaleIds = new Set(principali.filter((c) => c && c.id).map((c) => String(c.id)));
+  // Id salvato su una copia omonima (seed doppio) → id canonico presente nei select
+  const alias = aliasMapDaCanoniche(allCategorieFlat(principali, sottocategorieLavoriMap));
+  if (categoriaOrSubId) categoriaOrSubId = canonicoDi(categoriaOrSubId, alias);
+  if (sottocategoriaId) sottocategoriaId = canonicoDi(sottocategoriaId, alias);
   const childHint = sottocategoriaId || null;
 
   if (!categoriaOrSubId && !childHint) {
@@ -215,24 +228,25 @@ export function filterTipiLavoroByCategoria(
 
   if (categoriaTrovata && categoriaTrovata.parentId) {
     const parentId = categoriaTrovata.parentId;
-    return tipi.filter(
+    return dedupeTipiLavoro(tipi.filter(
       (tipo) =>
         sameId(tipo.sottocategoriaId, categoriaKey) ||
         sameId(tipo.categoriaId, categoriaKey) ||
         (sameId(tipo.categoriaId, parentId) && !tipo.sottocategoriaId)
-    );
+    ));
   }
 
   const allCategorieIds = [categoriaKey];
   const sottocat = getSottocategorieForParent(categoriaKey, sottocategorieLavoriMap);
   sottocat.forEach((subcat) => allCategorieIds.push(String(subcat.id)));
 
-  return tipi.filter(
+  // Doppioni (stesso nome, stessa categoria/sottocategoria canonica) → uno solo
+  return dedupeTipiLavoro(tipi.filter(
     (tipo) =>
       sameId(tipo.categoriaId, categoriaKey) ||
       (tipo.sottocategoriaId && allCategorieIds.includes(String(tipo.sottocategoriaId))) ||
       (tipo.categoriaId && allCategorieIds.includes(String(tipo.categoriaId)) && !tipo.sottocategoriaId)
-  );
+  ));
 }
 
 /** Colture uniche dai terreni (populateColtureFromTerreni). */
diff --git a/core/js/terreni-categorie-colture.js b/core/js/terreni-categorie-colture.js
index d8bfafa6..f9e70e2f 100644
--- a/core/js/terreni-categorie-colture.js
+++ b/core/js/terreni-categorie-colture.js
@@ -55,7 +55,9 @@ export function confrontaCategorieDuplicate(a, b, colturePerCategoria) {
 
   const idA = a && a.id != null ? String(a.id) : '';
   const idB = b && b.id != null ? String(b.id) : '';
-  return idA.localeCompare(idB);
+  // Confronto byte (non localeCompare): stesso ordine di Firestore e del canonico in catalogo-dedupe.js
+  if (idA === idB) return 0;
+  return idA < idB ? -1 : 1;
 }
 
 /**
diff --git a/core/js/terreni-controller.js b/core/js/terreni-controller.js
index 5cf4842b..e3e11487 100644
--- a/core/js/terreni-controller.js
+++ b/core/js/terreni-controller.js
@@ -356,13 +356,11 @@ export async function loadCategorieColtureTerreni(currentTenantId, db, app, auth
             categorieColtureTerreni.push(...categorie);
         }
 
-        // Popola dropdown categoria con dedupe (le colture possono non essere ancora caricate)
-        const deduped = dedupeCategorieColture(categorieColtureTerreni, null);
-        categorieColtureTerreni.length = 0;
-        categorieColtureTerreni.push(...deduped);
+        // Popola dropdown con una sola voce per codice (copia canonica). L'array di stato
+        // resta con TUTTE le copie: serve dopo per unire le colture di ogni copia sotto il canonico.
         popolaSelectCategorieColture(
             document.getElementById('terreno-coltura-categoria'),
-            categorieColtureTerreni,
+            raggruppaCategorie(categorieColtureTerreni).canoniche,
             null
         );
     } catch (error) {
@@ -480,6 +478,14 @@ export async function loadColturePerCategoriaTerreni(currentTenantId, db, app, a
             Object.assign(colturePerCategoriaTerreni, colturePerCategoria);
         }
 
+        // Unisci le colture di tutte le copie omonime sotto la categoria canonica
+        if (Array.isArray(categorieColtureTerreni) && categorieColtureTerreni.length > 0) {
+            const { aliasToCanon } = raggruppaCategorie(categorieColtureTerreni);
+            const unite = unisciColturePerCategoria(colturePerCategoriaTerreni, aliasToCanon);
+            Object.keys(colturePerCategoriaTerreni).forEach(key => delete colturePerCategoriaTerreni[key]);
+            Object.assign(colturePerCategoriaTerreni, unite);
+        }
+
         // Estrai tutte le colture per retrocompatibilità
         colture.length = 0; // Svuota array
         Object.values(colturePerCategoriaTerreni).forEach(coltureList => {
@@ -488,12 +494,9 @@ export async function loadColturePerCategoriaTerreni(currentTenantId, db, app, a
 
         // Dopo seed/caricamento: ripopola il select categorie con dedupe usando le colture note
         if (Array.isArray(categorieColtureTerreni)) {
-            const deduped = dedupeCategorieColture(categorieColtureTerreni, colturePerCategoriaTerreni);
-            categorieColtureTerreni.length = 0;
-            categorieColtureTerreni.push(...deduped);
             popolaSelectCategorieColture(
                 document.getElementById('terreno-coltura-categoria'),
-                categorieColtureTerreni,
+                raggruppaCategorie(categorieColtureTerreni).canoniche,
                 colturePerCategoriaTerreni
             );
         }
@@ -554,12 +557,9 @@ export async function loadColture(currentTenantId, db, app, auth, categorieColtu
     // Ripopola a fine carico se le categorie ci sono ancora (dopo catch di fallback
     // categorieColtureTerreni è vuoto e il select mostra già il messaggio di errore).
     if (Array.isArray(categorieColtureTerreni) && categorieColtureTerreni.length > 0) {
-        const deduped = dedupeCategorieColture(categorieColtureTerreni, colturePerCategoriaTerreni);
-        categorieColtureTerreni.length = 0;
-        categorieColtureTerreni.push(...deduped);
         popolaSelectCategorieColture(
             document.getElementById('terreno-coltura-categoria'),
-            categorieColtureTerreni,
+            raggruppaCategorie(categorieColtureTerreni).canoniche,
             colturePerCategoriaTerreni
         );
         const categoriaSelect = document.getElementById('terreno-coltura-categoria');
@@ -573,10 +573,8 @@ export async function loadColture(currentTenantId, db, app, auth, categorieColtu
 // IMPORTS UTILITY
 // ============================================
 import { escapeHtml, calcolaAlertAffitto, formattaDataScadenza, showAlert } from './terreni-utils.js';
-import {
-    dedupeCategorieColture,
-    popolaSelectCategorieColture,
-} from './terreni-categorie-colture.js';
+import { popolaSelectCategorieColture } from './terreni-categorie-colture.js';
+import { raggruppaCategorie, unisciColturePerCategoria } from './catalogo-dedupe.js';
 
 // ============================================
 // FUNZIONI PRINCIPALI
diff --git a/core/js/terreni-events.js b/core/js/terreni-events.js
index cda8983e..08e3c936 100644
--- a/core/js/terreni-events.js
+++ b/core/js/terreni-events.js
@@ -8,6 +8,7 @@
 // IMPORTS
 // ============================================
 import { showAlert } from './terreni-utils.js';
+import { raggruppaCategorie, trovaCategoriaPerColtura, dedupePerNome } from './catalogo-dedupe.js';
 
 // ============================================
 // FUNZIONI EVENT HANDLERS
@@ -65,15 +66,14 @@ export async function openTerrenoModal(
             // Trova la categoria della coltura selezionata
             const colturaNome = terreno.coltura || '';
             if (colturaNome) {
-                // Cerca la coltura nelle categorie caricate
-                let categoriaIdTrovata = null;
-                for (const [catId, coltureList] of Object.entries(state.colturePerCategoriaTerreni || {})) {
-                    const colturaTrovata = coltureList.find(c => c.nome === colturaNome);
-                    if (colturaTrovata) {
-                        categoriaIdTrovata = catId;
-                        break;
-                    }
-                }
+                // Cerca la coltura nelle categorie caricate; se è sotto una copia omonima
+                // della categoria, risali alla copia canonica (l'unica presente nel select)
+                const { aliasToCanon } = raggruppaCategorie(state.categorieColtureTerreni || []);
+                const categoriaIdTrovata = trovaCategoriaPerColtura(
+                    colturaNome,
+                    state.colturePerCategoriaTerreni,
+                    aliasToCanon
+                );
                 
                 // Imposta la categoria se trovata
                 const categoriaSelect = document.getElementById('terreno-coltura-categoria');
@@ -569,7 +569,7 @@ export function updateColtureDropdownTerreni(state, updateState, getColturaColor
     }
     
     // Popola con le colture della categoria selezionata
-    const coltureCategoria = state.colturePerCategoriaTerreni?.[categoriaId] || [];
+    const coltureCategoria = dedupePerNome(state.colturePerCategoriaTerreni?.[categoriaId] || []);
     
     if (coltureCategoria.length === 0) {
         colturaSelect.innerHTML = '<option value="">-- Nessuna coltura disponibile per questa categoria --</option>';
diff --git a/core/services/catalogo-seed.js b/core/services/catalogo-seed.js
new file mode 100644
index 00000000..1c9055d8
--- /dev/null
+++ b/core/services/catalogo-seed.js
@@ -0,0 +1,72 @@
+/**
+ * Supporto seed catalogo: id documento deterministici e lock in memoria per tenant.
+ * @module core/services/catalogo-seed
+ */
+
+/**
+ * Slug per id documento: minuscolo, senza accenti, solo [a-z0-9_].
+ * @param {unknown} value
+ * @returns {string}
+ */
+export function slugCatalogo(value) {
+  return String(value == null ? '' : value)
+    .normalize('NFD')
+    .replace(/[\u0300-\u036f]/g, '')
+    .toLowerCase()
+    .replace(/[^a-z0-9]+/g, '_')
+    .replace(/^_+|_+$/g, '');
+}
+
+/**
+ * Id deterministico di una voce seed (stesso valore da ogni pagina/tab).
+ * @param {unknown} codiceONome
+ * @returns {string} es. `seed_vite`, `seed_fico_d_india`
+ */
+export function idSeed(codiceONome) {
+  const slug = slugCatalogo(codiceONome);
+  if (!slug) throw new Error('Codice seed vuoto');
+  return `seed_${slug}`;
+}
+
+/**
+ * Dati da scrivere con setDocument(merge): senza id e senza timestamp del modello
+ * (createdAt lo aggiunge setDocument solo se il documento non esiste ancora).
+ * @param {object} dati
+ * @returns {object}
+ */
+export function datiSeed(dati) {
+  const out = { ...(dati || {}) };
+  delete out.id;
+  delete out.createdAt;
+  delete out.updatedAt;
+  return out;
+}
+
+const inCorso = new Map();
+
+/**
+ * Esegue `fn` una sola volta per (nome, tenant) finché è in corso: le chiamate concorrenti
+ * ricevono la stessa promise. Terminata (bene o male), la chiamata successiva riparte.
+ * @template T
+ * @param {string} nome
+ * @param {string} tenantId
+ * @param {() => Promise<T>} fn
+ * @returns {Promise<T>}
+ */
+export function conLockSeed(nome, tenantId, fn) {
+  const key = `${nome}:${tenantId}`;
+  const esistente = inCorso.get(key);
+  if (esistente) return esistente;
+  const p = Promise.resolve()
+    .then(fn)
+    .finally(() => {
+      if (inCorso.get(key) === p) inCorso.delete(key);
+    });
+  inCorso.set(key, p);
+  return p;
+}
+
+/** Solo test: svuota i lock. */
+export function _resetLockSeed() {
+  inCorso.clear();
+}
diff --git a/core/services/categorie-service.js b/core/services/categorie-service.js
index c0f5a037..3a950fb3 100644
--- a/core/services/categorie-service.js
+++ b/core/services/categorie-service.js
@@ -10,10 +10,13 @@ import {
   getDocumentData, 
   updateDocument,
   deleteDocument,
-  getCollectionData 
+  getCollectionData,
+  setDocument
 } from './firebase-service.js';
 import { getCurrentTenantId } from './tenant-service.js';
 import { Categoria } from '../models/Categoria.js';
+import { conLockSeed, idSeed, datiSeed } from './catalogo-seed.js';
+import { mappeCodiceCanonico } from '../js/catalogo-dedupe.js';
 import {
   CATEGORIE_PRINCIPALI_PREDEFINITE,
   CATEGORIE_COLTURE_PREDEFINITE,
@@ -29,37 +32,46 @@ export {
 const COLLECTION_NAME = 'categorie';
 
 /**
- * Inizializza categorie predefinite per il tenant corrente
+ * Legge tutte le categorie del tenant senza filtri né ordinamento.
+ * A differenza di getAllCategorie, se la lettura fallisce LANCIA: i seed non devono
+ * scambiare un errore di rete/permessi per «catalogo vuoto» e ricreare tutto.
+ * @param {string} tenantId
+ * @returns {Promise<Array<Categoria>>}
+ */
+export async function leggiCategorieGrezze(tenantId) {
+  const documents = await getCollectionData(COLLECTION_NAME, { tenantId });
+  return (documents || []).map(doc => Categoria.fromData(doc));
+}
+
+/**
+ * Inizializza categorie predefinite per il tenant corrente.
+ * Idempotente: id documento deterministici (`seed_<codice>`) scritti con setDocument (merge),
+ * una sola esecuzione alla volta per tenant, nessuna scrittura se la lettura fallisce.
  * @returns {Promise<void>}
  */
 export async function initializeCategoriePredefinite() {
+  const tenantId = getCurrentTenantId();
+  if (!tenantId) {
+    throw new Error('Errore inizializzazione categorie: Nessun tenant corrente disponibile');
+  }
+  return conLockSeed('categorie', tenantId, () => seedCategoriePredefinite(tenantId));
+}
+
+async function seedCategoriePredefinite(tenantId) {
   try {
-    const tenantId = getCurrentTenantId();
-    if (!tenantId) {
-      throw new Error('Nessun tenant corrente disponibile');
-    }
-    
-    let categorieEsistenti = await getAllCategorie();
-    // Evita re-seed silenzioso se getAllCategorie torna [] per filtri/indici:
-    // secondo tentativo grezzo senza where/orderBy.
-    if (!Array.isArray(categorieEsistenti) || categorieEsistenti.length === 0) {
-      try {
-        const tenantIdRaw = getCurrentTenantId();
-        const grezzi = await getCollectionData(COLLECTION_NAME, { tenantId: tenantIdRaw });
-        if (Array.isArray(grezzi) && grezzi.length > 0) {
-          categorieEsistenti = grezzi.map(doc => Categoria.fromData(doc));
-          console.warn(
-            'initializeCategoriePredefinite: getAllCategorie vuoto, uso lettura grezza (' +
-              categorieEsistenti.length +
-              ' doc)'
-          );
-        }
-      } catch (rawErr) {
-        console.warn('initializeCategoriePredefinite: lettura grezza fallita:', rawErr && rawErr.message);
-      }
-    }
-    const codiciEsistenti = new Set(categorieEsistenti.map(c => c.codice));
-    const categorieMap = new Map(); // codice -> id
+    // Lettura grezza: se fallisce si esce senza scrivere nulla.
+    const categorieEsistenti = await leggiCategorieGrezze(tenantId);
+    const codiciEsistenti = new Set(
+      categorieEsistenti.map(c => (c.codice ? String(c.codice).toLowerCase() : '')).filter(Boolean)
+    );
+    // codice -> id canonico (copie omonime già presenti: si usa sempre la stessa)
+    const { principali: categorieMap } = mappeCodiceCanonico(categorieEsistenti);
+
+    const scriviSeed = async (dati) => {
+      const id = idSeed(dati.codice);
+      await setDocument(COLLECTION_NAME, id, datiSeed(dati), tenantId);
+      return id;
+    };
     
     // Crea categorie principali
     for (const categoriaPredefinita of CATEGORIE_PRINCIPALI_PREDEFINITE) {
@@ -71,14 +83,9 @@ export async function initializeCategoriePredefinite() {
         
         const validation = categoria.validate();
         if (validation.valid) {
-          const categoriaId = await createDocument(COLLECTION_NAME, categoria.toFirestore(), tenantId);
+          const categoriaId = await scriviSeed(categoria.toFirestore());
           categorieMap.set(categoriaPredefinita.codice, categoriaId);
-        }
-      } else {
-        // Trova ID esistente
-        const categoriaEsistente = categorieEsistenti.find(c => c.codice === categoriaPredefinita.codice);
-        if (categoriaEsistente) {
-          categorieMap.set(categoriaPredefinita.codice, categoriaEsistente.id);
+          codiciEsistenti.add(categoriaPredefinita.codice);
         }
       }
     }
@@ -86,10 +93,10 @@ export async function initializeCategoriePredefinite() {
     // Rimuovi vecchie sottocategorie obsolete (es. "Meccanica" invece di "Meccanico")
     const codiciObsoleti = ['potatura_meccanica']; // Vecchi codici da rimuovere
     for (const codiceObsoleto of codiciObsoleti) {
-      const sottocategoriaObsoleta = categorieEsistenti.find(c => 
+      const sottocategorieObsolete = categorieEsistenti.filter(c => 
         c.codice && c.codice.toLowerCase() === codiceObsoleto.toLowerCase()
       );
-      if (sottocategoriaObsoleta) {
+      for (const sottocategoriaObsoleta of sottocategorieObsolete) {
         try {
           await deleteDocument(COLLECTION_NAME, sottocategoriaObsoleta.id, tenantId);
 
@@ -121,7 +128,8 @@ export async function initializeCategoriePredefinite() {
         
         const validation = sottocategoria.validate();
         if (validation.valid) {
-          await createDocument(COLLECTION_NAME, sottocategoria.toFirestore(), tenantId);
+          await scriviSeed(sottocategoria.toFirestore());
+          codiciEsistenti.add(sottocategoriaPredefinita.codice);
         }
       }
     }
@@ -136,14 +144,9 @@ export async function initializeCategoriePredefinite() {
         
         const validation = categoria.validate();
         if (validation.valid) {
-          const categoriaId = await createDocument(COLLECTION_NAME, categoria.toFirestore(), tenantId);
+          const categoriaId = await scriviSeed(categoria.toFirestore());
           categorieMap.set(categoriaColturaPredefinita.codice, categoriaId);
-        }
-      } else {
-        // Trova ID esistente
-        const categoriaEsistente = categorieEsistenti.find(c => c.codice === categoriaColturaPredefinita.codice);
-        if (categoriaEsistente) {
-          categorieMap.set(categoriaColturaPredefinita.codice, categoriaEsistente.id);
+          codiciEsistenti.add(categoriaColturaPredefinita.codice);
         }
       }
     }
diff --git a/core/services/colture-service.js b/core/services/colture-service.js
index 8598f738..03aee453 100644
--- a/core/services/colture-service.js
+++ b/core/services/colture-service.js
@@ -10,68 +10,67 @@ import {
   getDocumentData, 
   updateDocument,
   deleteDocument,
-  getCollectionData 
+  getCollectionData,
+  setDocument
 } from './firebase-service.js';
 import { getCurrentTenantId } from './tenant-service.js';
 import { Coltura } from '../models/Coltura.js';
 import { COLTURE_PREDEFINITE } from '../config/app-catalog-seed-data.js';
+import { conLockSeed, idSeed, datiSeed } from './catalogo-seed.js';
+import { mappeCodiceCanonico } from '../js/catalogo-dedupe.js';
 
 export { COLTURE_PREDEFINITE };
 
 const COLLECTION_NAME = 'colture';
 
 /**
- * Inizializza colture predefinite per il tenant corrente
- * Inizializza automaticamente le categorie se non esistono
+ * Inizializza colture predefinite per il tenant corrente.
+ * Inizializza automaticamente le categorie se non esistono.
+ * Idempotente: id deterministici (`seed_<nome>`) con setDocument (merge), una sola esecuzione
+ * alla volta per tenant, nessuna scrittura se una lettura fallisce, categoria = copia canonica.
  * @returns {Promise<void>}
  */
 export async function initializeColturePredefinite() {
+  const tenantId = getCurrentTenantId();
+  if (!tenantId) {
+    throw new Error('Errore inizializzazione colture: Nessun tenant corrente disponibile');
+  }
+  return conLockSeed('colture', tenantId, () => seedColturePredefinite(tenantId));
+}
+
+async function seedColturePredefinite(tenantId) {
   try {
-    const tenantId = getCurrentTenantId();
-    if (!tenantId) {
-      throw new Error('Nessun tenant corrente disponibile');
-    }
-    
     // Assicura che le categorie siano inizializzate prima
-    const { getAllCategorie, initializeCategoriePredefinite } = await import('./categorie-service.js');
+    const { leggiCategorieGrezze, initializeCategoriePredefinite } = await import('./categorie-service.js');
     
-    // Verifica se ci sono categorie per colture
-    let categorieColture = await getAllCategorie({
-      applicabileA: 'colture',
-      orderBy: 'ordine',
-      orderDirection: 'asc'
-    });
+    // Lettura grezza (lancia se fallisce: niente seed su errore di lettura)
+    const soloColture = (lista) => lista.filter(c => c.applicabileA === 'colture');
+    let categorieColture = soloColture(await leggiCategorieGrezze(tenantId));
     
     // Se non ci sono categorie, inizializzale
     if (categorieColture.length === 0) {
       try {
         await initializeCategoriePredefinite();
-        // Ricarica le categorie dopo l'inizializzazione
-        categorieColture = await getAllCategorie({
-          applicabileA: 'colture',
-          orderBy: 'ordine',
-          orderDirection: 'asc'
-        });
       } catch (catError) {
         console.warn('⚠️ Errore inizializzazione categorie:', catError.message);
-        // Continua comunque, potrebbe essere che esistano già
       }
+      // Ricarica le categorie dopo l'inizializzazione
+      categorieColture = soloColture(await leggiCategorieGrezze(tenantId));
     }
     
-    // Crea mappa codice categoria -> id categoria
-    const categorieMap = new Map();
-    categorieColture.forEach(cat => {
-      categorieMap.set(cat.codice, cat.id);
-    });
+    // codice categoria -> id canonico (stessa copia per ogni esecuzione)
+    const { principali: categorieMap } = mappeCodiceCanonico(categorieColture);
     
-    // Carica tutte le colture esistenti
-    const coltureEsistenti = await getAllColture();
-    const nomiEsistenti = new Set(coltureEsistenti.map(c => c.nome.toLowerCase()));
+    // Carica tutte le colture esistenti (lancia se fallisce)
+    const coltureDocs = await getCollectionData(COLLECTION_NAME, { tenantId });
+    const nomiEsistenti = new Set(
+      (coltureDocs || []).map(c => String(c.nome || '').toLowerCase()).filter(Boolean)
+    );
     
     // Crea colture predefinite mancanti
     for (const colturaData of COLTURE_PREDEFINITE) {
       if (!nomiEsistenti.has(colturaData.nome.toLowerCase())) {
-        const categoriaId = categorieMap.get(colturaData.categoriaCodice);
+        const categoriaId = categorieMap.get(String(colturaData.categoriaCodice).toLowerCase());
         if (!categoriaId) {
           console.warn(`Categoria ${colturaData.categoriaCodice} non trovata per coltura ${colturaData.nome}`);
           continue;
@@ -87,7 +86,12 @@ export async function initializeColturePredefinite() {
         
         const validation = coltura.validate();
         if (validation.valid) {
-          await createDocument(COLLECTION_NAME, coltura.toFirestore(), tenantId);
+          await setDocument(
+            COLLECTION_NAME,
+            idSeed(colturaData.nome),
+            datiSeed(coltura.toFirestore()),
+            tenantId
+          );
           nomiEsistenti.add(colturaData.nome.toLowerCase());
         }
       }
diff --git a/core/services/liste-service.js b/core/services/liste-service.js
index 37fae423..94c17ab0 100644
--- a/core/services/liste-service.js
+++ b/core/services/liste-service.js
@@ -538,7 +538,8 @@ export async function getTipiLavoroNomi() {
     const tipiLavoro = await getAllTipiLavoro({ orderBy: 'nome', orderDirection: 'asc' });
     
     if (tipiLavoro && tipiLavoro.length > 0) {
-      return tipiLavoro.map(t => t.nome);
+      // Nomi unici: copie omonime dei tipi predefiniti non devono comparire due volte
+      return [...new Set(tipiLavoro.map(t => t.nome).filter(Boolean))];
     }
   } catch (error) {
     console.warn('Impossibile leggere da tipiLavoro, uso ListePersonalizzate:', error.message);
diff --git a/core/services/tipi-lavoro-service.js b/core/services/tipi-lavoro-service.js
index da20309e..8660a10a 100644
--- a/core/services/tipi-lavoro-service.js
+++ b/core/services/tipi-lavoro-service.js
@@ -10,50 +10,51 @@ import {
   getDocumentData, 
   updateDocument,
   deleteDocument,
-  getCollectionData 
+  getCollectionData,
+  setDocument
 } from './firebase-service.js';
 import { getCurrentTenantId } from './tenant-service.js';
 import { TipoLavoro } from '../models/TipoLavoro.js';
 import { TIPI_LAVORO_PREDEFINITI, TIPI_LAVORO_CANONICAL_FIXES } from '../config/app-catalog-seed-data.js';
+import { conLockSeed, idSeed, datiSeed } from './catalogo-seed.js';
+import { mappeCodiceCanonico } from '../js/catalogo-dedupe.js';
 
 export { TIPI_LAVORO_PREDEFINITI };
 
 const COLLECTION_NAME = 'tipiLavoro';
 
 /**
- * Inizializza tipi lavoro predefiniti per il tenant corrente
+ * Inizializza tipi lavoro predefiniti per il tenant corrente.
+ * Idempotente: id deterministici (`seed_<nome>`) con setDocument (merge), una sola esecuzione
+ * alla volta per tenant, nessuna scrittura se una lettura fallisce, categorie = copia canonica.
  * @returns {Promise<void>}
  */
 export async function initializeTipiLavoroPredefiniti() {
+  const tenantId = getCurrentTenantId();
+  if (!tenantId) {
+    throw new Error('Errore inizializzazione tipi lavoro: Nessun tenant corrente disponibile');
+  }
+  return conLockSeed('tipiLavoro', tenantId, () => seedTipiLavoroPredefiniti(tenantId));
+}
+
+async function seedTipiLavoroPredefiniti(tenantId) {
   try {
-    const tenantId = getCurrentTenantId();
-    if (!tenantId) {
-      throw new Error('Nessun tenant corrente disponibile');
-    }
-    
     // Importa servizio categorie per ottenere ID categorie e sottocategorie
-    const { getCategoriaByCodice, getAllCategorie } = await import('./categorie-service.js');
-    
-    // Carica tutte le categorie e sottocategorie per creare mappa codice -> id
-    const tutteCategorie = await getAllCategorie();
-    const categorieMap = new Map(); // codice -> id
-    const sottocategorieMap = new Map(); // codice -> id
-    
-    tutteCategorie.forEach(cat => {
-      if (cat.codice) {
-        if (cat.parentId) {
-          // È una sottocategoria
-          sottocategorieMap.set(cat.codice.toLowerCase(), cat.id);
-        } else {
-          // È una categoria principale
-          categorieMap.set(cat.codice.toLowerCase(), cat.id);
-        }
-      }
-    });
-    
-    // Carica tutti i tipi lavoro esistenti
-    const tipiEsistenti = await getAllTipiLavoro();
-    const nomiEsistenti = new Set(tipiEsistenti.map(t => t.nome.toLowerCase()));
+    const { leggiCategorieGrezze } = await import('./categorie-service.js');
+    
+    // Lettura grezza (lancia se fallisce). Mappe codice -> id canonico: copie omonime
+    // di una categoria convergono sempre sulla stessa.
+    const {
+      principali: categorieMap,
+      sottocategorie: sottocategorieMap,
+      canoniche: tutteCategorie
+    } = mappeCodiceCanonico(await leggiCategorieGrezze(tenantId));
+    
+    // Carica tutti i tipi lavoro esistenti (lancia se fallisce)
+    const tipiDocs = await getCollectionData(COLLECTION_NAME, { tenantId });
+    const nomiEsistenti = new Set(
+      (tipiDocs || []).map(t => String(t.nome || '').toLowerCase()).filter(Boolean)
+    );
     
     // Per ogni tipo lavoro predefinito, crea se non esiste
     for (const tipoData of TIPI_LAVORO_PREDEFINITI) {
@@ -97,7 +98,7 @@ export async function initializeTipiLavoroPredefiniti() {
       
       const validation = tipo.validate();
       if (validation.valid) {
-        await createDocument(COLLECTION_NAME, tipo.toFirestore(), tenantId);
+        await setDocument(COLLECTION_NAME, idSeed(tipoData.nome), datiSeed(tipo.toFirestore()), tenantId);
         nomiEsistenti.add(tipoData.nome.toLowerCase());
       }
     }
diff --git a/modules/frutteto/js/frutteti-page.js b/modules/frutteto/js/frutteti-page.js
index 42803763..4a2b4e0b 100644
--- a/modules/frutteto/js/frutteti-page.js
+++ b/modules/frutteto/js/frutteti-page.js
@@ -25,6 +25,7 @@ const tenantServiceModule = await import(resolvePath('../../../core/services/ten
 const authServiceModule = await import(resolvePath('../../../core/services/auth-service.js'));
 const coltureServiceModule = await import(resolvePath('../../../core/services/colture-service.js'));
 const categorieServiceModule = await import(resolvePath('../../../core/services/categorie-service.js'));
+const catalogoDedupeModule = await import(resolvePath('../../../core/js/catalogo-dedupe.js'));
 const varietaFruttetoServiceModule = await import(resolvePath('../../../core/services/varieta-frutteto-service.js'));
 
 // Import configurazione forme di allevamento frutteto
@@ -38,6 +39,7 @@ const { getCurrentTenantId, getCurrentTenant, initializeTenantService } = tenant
 const { initializeAuthService } = authServiceModule;
 const { getAllColture } = coltureServiceModule;
 const { getAllCategorie } = categorieServiceModule;
+const { raggruppaCategorie, dedupePerNome } = catalogoDedupeModule;
 
 let terreni = [];
 let allFrutteti = [];
@@ -247,7 +249,8 @@ async function populateSpecieSelects() {
             applicabileA: 'colture',
             orderBy: 'ordine'
         });
-        const categoriaFrutteto = categorie.find(c => c.codice === 'frutteto');
+        // Copie omonime della categoria (seed doppio): una canonica con tutti gli id in aliasIds
+        const categoriaFrutteto = raggruppaCategorie(categorie).canoniche.find(c => c.codice === 'frutteto');
         
         if (!categoriaFrutteto) {
             console.warn('[FRUTTETI] Categoria frutteto non trovata');
@@ -259,10 +262,11 @@ async function populateSpecieSelects() {
             orderBy: 'nome',
             orderDirection: 'asc'
         });
-        const coltureFrutteto = tutteColture.filter(c => c.categoriaId === categoriaFrutteto.id);
+        const idsFrutteto = new Set(categoriaFrutteto.aliasIds || [String(categoriaFrutteto.id)]);
+        const coltureFrutteto = tutteColture.filter(c => idsFrutteto.has(String(c.categoriaId)));
 
-        // Estrai i nomi delle specie e salva in variabile globale
-        specieFruttetoDisponibili = coltureFrutteto.map(c => c.nome).filter(Boolean).sort();
+        // Estrai i nomi delle specie (senza doppioni) e salva in variabile globale
+        specieFruttetoDisponibili = dedupePerNome(coltureFrutteto.map(c => c.nome).filter(Boolean)).sort();
 
         specieSelect.innerHTML = '<option value="">Seleziona specie</option>' +
             specieFruttetoDisponibili.map(s => `<option value="${s}">${s}</option>`).join('');
diff --git a/modules/seminativo/services/seminativi-service.js b/modules/seminativo/services/seminativi-service.js
index bbb3f877..ba5350a2 100644
--- a/modules/seminativo/services/seminativi-service.js
+++ b/modules/seminativo/services/seminativi-service.js
@@ -16,6 +16,7 @@ import { getCurrentTenantId } from '../../../core/services/tenant-service.js';
 import { getAllTerreni } from '../../../core/services/terreni-service.js';
 import { getAllColture } from '../../../core/services/colture-service.js';
 import { getAllCategorie } from '../../../core/services/categorie-service.js';
+import { raggruppaCategorie, dedupePerNome } from '../../../core/js/catalogo-dedupe.js';
 import { SEMINATIVO_COLLECTION } from '../config/seminativo-hub.js';
 import {
   SeminativoCampagna,
@@ -169,12 +170,15 @@ export async function listTerreniSeminativo() {
       applicabileA: 'colture',
       orderBy: 'ordine'
     });
-    const categoria = (categorie || []).find((c) => {
+    // Tutte le copie omonime della categoria (seed doppio) contano come Seminativo
+    const categoria = raggruppaCategorie(categorie || []).canoniche.find((c) => {
       const codice = String(c.codice || '').toLowerCase();
       const nome = String(c.nome || '').toLowerCase();
       return codice === CATEGORIA_CODICE || nome.includes('seminativ');
     });
-    if (categoria && categoria.id) ctx.categoriaIds.add(String(categoria.id));
+    if (categoria && categoria.id) {
+      (categoria.aliasIds || [String(categoria.id)]).forEach((id) => ctx.categoriaIds.add(String(id)));
+    }
     const colture = await listColtureSeminativo();
     (colture || []).forEach((c) => {
       const nome = String(c.nome || '').trim().toLowerCase();
@@ -195,7 +199,8 @@ export async function listColtureSeminativo() {
     applicabileA: 'colture',
     orderBy: 'ordine'
   });
-  const categoria = categorie.find((c) => {
+  // Copie omonime della categoria: si prendono le colture di tutte, senza doppioni per nome
+  const categoria = raggruppaCategorie(categorie).canoniche.find((c) => {
     const codice = String(c.codice || '').toLowerCase();
     const nome = String(c.nome || '').toLowerCase();
     return codice === CATEGORIA_CODICE || nome.includes('seminativ');
@@ -204,5 +209,6 @@ export async function listColtureSeminativo() {
   if (!categoria) {
     return tutte.filter((c) => String(c.categoriaCodice || '').toLowerCase() === CATEGORIA_CODICE);
   }
-  return tutte.filter((c) => c.categoriaId === categoria.id);
+  const ids = new Set(categoria.aliasIds || [String(categoria.id)]);
+  return dedupePerNome(tutte.filter((c) => ids.has(String(c.categoriaId))));
 }
diff --git a/tests/catalogo-dedupe.test.js b/tests/catalogo-dedupe.test.js
new file mode 100644
index 00000000..b8c70d1b
--- /dev/null
+++ b/tests/catalogo-dedupe.test.js
@@ -0,0 +1,203 @@
+/**
+ * Helper catalogo-dedupe: raggruppamento copie omonime, canonico deterministico,
+ * unione colture, alias, tipi lavoro e cascade lavoro senza doppioni. Vitest puro.
+ */
+import { describe, it, expect } from 'vitest';
+import {
+  chiaveCatalogo,
+  confrontaCanonico,
+  raggruppaCategorie,
+  canonicoDi,
+  aliasMapDaCanoniche,
+  dedupePerNome,
+  unisciColturePerCategoria,
+  dedupeTipiLavoro,
+  mappeCodiceCanonico,
+  trovaCategoriaPerColtura,
+} from '../core/js/catalogo-dedupe.js';
+import {
+  buildLavoroCategorieIndex,
+  filterTipiLavoroByCategoria,
+  getSottocategorieForParent,
+  resolveLavoroCascadeParents,
+} from '../core/js/lavoro-cascade-filters.js';
+
+describe('chiaveCatalogo', () => {
+  it('usa il codice normalizzato', () => {
+    expect(chiaveCatalogo({ codice: ' Vite ', nome: 'Altro' })).toBe('c:vite');
+  });
+  it('senza codice usa nome normalizzato (+ ambito se presente)', () => {
+    expect(chiaveCatalogo({ nome: '  Frutteto   Misto ' })).toBe('n:frutteto misto');
+    expect(chiaveCatalogo({ nome: 'Potatura', applicabileA: 'lavori' })).toBe('n:potatura@lavori');
+  });
+  it('ultima risorsa: id', () => {
+    expect(chiaveCatalogo({ id: 'x' })).toBe('i:x');
+    expect(chiaveCatalogo(null)).toBe('');
+  });
+});
+
+describe('confrontaCanonico (deterministico)', () => {
+  it('predefinita batte non predefinita', () => {
+    expect(confrontaCanonico({ id: 'z', predefinita: true }, { id: 'a' })).toBeLessThan(0);
+  });
+  it('a parità vince createdAt più vecchio (Date, Timestamp, seconds)', () => {
+    const vecchio = { id: 'z', createdAt: new Date('2026-10-01') };
+    const nuovo = { id: 'a', createdAt: { toMillis: () => Date.parse('2026-10-02') } };
+    expect(confrontaCanonico(vecchio, nuovo)).toBeLessThan(0);
+    expect(confrontaCanonico({ id: 'b', createdAt: { seconds: 10 } }, { id: 'a', createdAt: { seconds: 20 } })).toBeLessThan(0);
+  });
+  it('chi ha createdAt batte chi non lo ha', () => {
+    expect(confrontaCanonico({ id: 'z', createdAt: new Date(1) }, { id: 'a' })).toBeLessThan(0);
+  });
+  it('ultimo criterio: id in ordine byte, non localeCompare', () => {
+    // 'B' (0x42) < 'a' (0x61) in byte; localeCompare direbbe il contrario
+    expect('aZ1'.localeCompare('B9x')).toBeLessThan(0);
+    expect(confrontaCanonico({ id: 'B9x' }, { id: 'aZ1' })).toBeLessThan(0);
+  });
+});
+
+describe('raggruppaCategorie', () => {
+  const cats = [
+    { id: 'v2', codice: 'vite', nome: 'Vite', predefinita: true, createdAt: new Date('2026-10-23T10:00:05Z') },
+    { id: 'v1', codice: 'vite', nome: 'Vite', predefinita: true, createdAt: new Date('2026-10-23T10:00:00Z') },
+    { id: 'f1', codice: 'frutteto', nome: 'Frutteto', predefinita: true },
+    { id: 'f2', codice: 'FRUTTETO', nome: 'Frutteto', predefinita: true },
+  ];
+
+  it('una canonica per codice, ordine della prima occorrenza, aliasIds e mappa alias', () => {
+    const { canoniche, aliasToCanon } = raggruppaCategorie(cats);
+    expect(canoniche.map((c) => c.id)).toEqual(['v1', 'f1']);
+    expect(canoniche[0].aliasIds).toEqual(['v2', 'v1']);
+    expect(aliasToCanon.get('v2')).toBe('v1');
+    expect(aliasToCanon.get('f2')).toBe('f1');
+    expect(canonicoDi('v2', aliasToCanon)).toBe('v1');
+    expect(canonicoDi('sconosciuto', aliasToCanon)).toBe('sconosciuto');
+  });
+
+  it('stesso risultato con input in ordine diverso', () => {
+    const a = raggruppaCategorie(cats).canoniche.map((c) => c.id).sort();
+    const b = raggruppaCategorie(cats.slice().reverse()).canoniche.map((c) => c.id).sort();
+    expect(a).toEqual(b);
+  });
+
+  it('non modifica gli oggetti in ingresso e conserva il prototipo', () => {
+    class Cat { constructor(d) { Object.assign(this, d); } etichetta() { return this.nome; } }
+    const input = [new Cat({ id: 'a', codice: 'x', nome: 'X' }), new Cat({ id: 'b', codice: 'x', nome: 'X' })];
+    const { canoniche } = raggruppaCategorie(input);
+    expect(input[0].aliasIds).toBeUndefined();
+    expect(canoniche[0].etichetta()).toBe('X');
+  });
+
+  it('sottocategorie: chiave codice padre + codice, parentId riscritto sul padre canonico', () => {
+    const { canoniche, aliasToCanon } = raggruppaCategorie([
+      { id: 'p1', codice: 'potatura', predefinita: true, createdAt: new Date(1) },
+      { id: 'p2', codice: 'potatura', predefinita: true, createdAt: new Date(2) },
+      { id: 's1', codice: 'potatura_manuale', parentId: 'p1', predefinita: true, createdAt: new Date(3) },
+      { id: 's2', codice: 'potatura_manuale', parentId: 'p2', predefinita: true, createdAt: new Date(4) },
+      { id: 'r1', codice: 'manuale', parentId: 'p1' },
+      { id: 'q1', codice: 'raccolta' },
+      { id: 'r2', codice: 'manuale', parentId: 'q1' },
+    ]);
+    expect(canoniche.map((c) => c.id)).toEqual(['p1', 's1', 'r1', 'q1', 'r2']);
+    expect(aliasToCanon.get('s2')).toBe('s1');
+    const r2 = canoniche.find((c) => c.id === 'r2');
+    expect(r2.parentId).toBe('q1');
+    const s1 = raggruppaCategorie([
+      { id: 'p1', codice: 'potatura', createdAt: new Date(2) },
+      { id: 'p2', codice: 'potatura', createdAt: new Date(1) },
+      { id: 's1', codice: 'potatura_manuale', parentId: 'p1' },
+    ]).canoniche.find((c) => c.id === 's1');
+    expect(s1.parentId).toBe('p2');
+  });
+
+  it('aliasMapDaCanoniche ricostruisce la mappa dagli aliasIds', () => {
+    const { canoniche } = raggruppaCategorie(cats);
+    const map = aliasMapDaCanoniche(canoniche);
+    expect(map.get('v2')).toBe('v1');
+    expect(map.get('v1')).toBe('v1');
+  });
+
+  it('mappeCodiceCanonico separa principali e sottocategorie', () => {
+    const { principali, sottocategorie } = mappeCodiceCanonico([
+      ...cats,
+      { id: 'sub', codice: 'vendemmia', parentId: 'v2' },
+    ]);
+    expect(principali.get('vite')).toBe('v1');
+    expect(principali.get('frutteto')).toBe('f1');
+    expect(sottocategorie.get('vendemmia')).toBe('sub');
+  });
+});
+
+describe('colture: unione sotto il canonico', () => {
+  it('unisce le colture di tutte le copie e toglie i doppioni per nome', () => {
+    const { aliasToCanon } = raggruppaCategorie([
+      { id: 'v1', codice: 'vite', createdAt: new Date(1) },
+      { id: 'v2', codice: 'vite', createdAt: new Date(2) },
+    ]);
+    const out = unisciColturePerCategoria(
+      {
+        v2: [{ id: 'c1', nome: 'Vite' }, { id: 'c2', nome: 'Vite da Vino' }],
+        v1: [{ id: 'c3', nome: 'vite ' }],
+        senza_categoria: [{ id: 'x', nome: 'Boh' }],
+      },
+      aliasToCanon
+    );
+    expect(Object.keys(out).sort()).toEqual(['senza_categoria', 'v1']);
+    expect(out.v1.map((c) => c.nome)).toEqual(['Vite', 'Vite da Vino']);
+  });
+
+  it('dedupePerNome su stringhe e oggetti', () => {
+    expect(dedupePerNome(['Grano', 'grano', 'Mais'])).toEqual(['Grano', 'Mais']);
+    expect(dedupePerNome([{ id: 'b', nome: 'Mais' }, { id: 'a', nome: 'Mais' }]).map((c) => c.id)).toEqual(['a']);
+  });
+
+  it('trovaCategoriaPerColtura risale al canonico', () => {
+    const alias = new Map([['v2', 'v1'], ['v1', 'v1']]);
+    expect(trovaCategoriaPerColtura('Vite', { v2: [{ nome: 'Vite' }] }, alias)).toBe('v1');
+    expect(trovaCategoriaPerColtura('Nessuna', { v2: [{ nome: 'Vite' }] }, alias)).toBeNull();
+    expect(trovaCategoriaPerColtura('Boh', { senza_categoria: [{ nome: 'Boh' }] }, alias)).toBeNull();
+  });
+});
+
+describe('tipi lavoro e cascade senza doppioni', () => {
+  const categorie = [
+    { id: 'P1', codice: 'potatura', nome: 'Potatura', applicabileA: 'entrambi', predefinita: true, ordine: 4, createdAt: new Date(1) },
+    { id: 'P2', codice: 'potatura', nome: 'Potatura', applicabileA: 'entrambi', predefinita: true, ordine: 4, createdAt: new Date(2) },
+    { id: 'S1', codice: 'potatura_manuale', nome: 'Manuale', parentId: 'P1', applicabileA: 'lavori', predefinita: true, createdAt: new Date(3) },
+    { id: 'S2', codice: 'potatura_manuale', nome: 'Manuale', parentId: 'P2', applicabileA: 'lavori', predefinita: true, createdAt: new Date(4) },
+  ];
+  const tipi = [
+    { id: 't1', nome: 'Potatura di produzione', categoriaId: 'P1', sottocategoriaId: 'S1', predefinito: true },
+    { id: 't2', nome: 'Potatura di produzione', categoriaId: 'P2', sottocategoriaId: 'S2', predefinito: true },
+    { id: 't3', nome: 'Potatura verde', categoriaId: 'P2', sottocategoriaId: null, predefinito: true },
+  ];
+
+  it('buildLavoroCategorieIndex: principali uniche, sottocategorie unite sotto il padre canonico', () => {
+    const { principali, map } = buildLavoroCategorieIndex(categorie);
+    expect(principali.map((c) => c.id)).toEqual(['P1']);
+    expect(getSottocategorieForParent('P1', map).map((s) => s.id)).toEqual(['S1']);
+    expect(map.has('P2')).toBe(false);
+  });
+
+  it('filterTipiLavoroByCategoria: un solo tipo per nome, anche se appeso alla copia', () => {
+    const { principali, map } = buildLavoroCategorieIndex(categorie);
+    const perPrincipale = filterTipiLavoroByCategoria('P1', tipi, principali, map);
+    expect(perPrincipale.map((t) => t.nome).sort()).toEqual(['Potatura di produzione', 'Potatura verde']);
+    const perSotto = filterTipiLavoroByCategoria('S1', tipi, principali, map);
+    expect(perSotto.map((t) => t.nome)).toEqual(['Potatura di produzione', 'Potatura verde']);
+    expect(perSotto.filter((t) => t.nome === 'Potatura di produzione')).toHaveLength(1);
+  });
+
+  it('resolveLavoroCascadeParents: id salvato sulla copia → select sul canonico', () => {
+    const { principali, map } = buildLavoroCategorieIndex(categorie);
+    expect(resolveLavoroCascadeParents('S2', null, principali, map)).toEqual({ categoriaPrincipaleId: 'P1', sottocategoriaId: 'S1' });
+    expect(resolveLavoroCascadeParents('P2', 'S2', principali, map)).toEqual({ categoriaPrincipaleId: 'P1', sottocategoriaId: 'S1' });
+  });
+
+  it('dedupeTipiLavoro riscrive gli id sul canonico', () => {
+    const alias = new Map([['P2', 'P1'], ['S2', 'S1']]);
+    const out = dedupeTipiLavoro(tipi, alias);
+    expect(out).toHaveLength(2);
+    expect(out.find((t) => t.nome === 'Potatura verde').categoriaId).toBe('P1');
+  });
+});
diff --git a/tests/catalogo-doppioni-scenario.test.js b/tests/catalogo-doppioni-scenario.test.js
new file mode 100644
index 00000000..24efed8b
--- /dev/null
+++ b/tests/catalogo-doppioni-scenario.test.js
@@ -0,0 +1,141 @@
+/**
+ * Scenario reale in due passi (pagina Terreni, tenant con seed doppio):
+ * 1) si caricano le categorie (le colture non ci sono ancora);
+ * 2) arrivano le colture, con categoriaId sulla copia NON canonica.
+ * Vite/Frutteto devono avere colture, Seminativo senza doppioni, la Modifica preseleziona.
+ * Vitest puro: select finti, servizi mockati, niente emulatori.
+ */
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+
+vi.mock('../core/services/firebase-service.js', () => ({
+  setFirebaseInstances: vi.fn(),
+  timestampToDate: (v) => (v instanceof Date ? v : new Date(v)),
+  dateToTimestamp: (v) => v,
+}));
+vi.mock('../core/services/tenant-service.js', () => ({
+  setCurrentTenantId: vi.fn(),
+  getCurrentTenantId: vi.fn(() => 'cascina-conti'),
+}));
+vi.mock('../core/services/categorie-service.js', () => ({
+  getAllCategorie: vi.fn(),
+  initializeCategoriePredefinite: vi.fn(async () => {}),
+}));
+vi.mock('../core/services/colture-service.js', () => ({
+  initializeColturePredefinite: vi.fn(async () => {}),
+  getAllColture: vi.fn(),
+  getColturePerCategoria: vi.fn(),
+}));
+
+import { getAllCategorie } from '../core/services/categorie-service.js';
+import { getAllColture, getColturePerCategoria } from '../core/services/colture-service.js';
+import {
+  loadCategorieColtureTerreni,
+  loadColturePerCategoriaTerreni,
+  loadColture,
+} from '../core/js/terreni-controller.js';
+import { updateColtureDropdownTerreni } from '../core/js/terreni-events.js';
+import { raggruppaCategorie, trovaCategoriaPerColtura } from '../core/js/catalogo-dedupe.js';
+
+/** Select minimale: come il DOM, un value non presente tra le option diventa ''. */
+class FakeSelect {
+  constructor() { this.options = []; this._value = ''; }
+  set innerHTML(html) {
+    this.options = [];
+    this._value = '';
+    const m = /<option value="([^"]*)">([^<]*)<\/option>/.exec(String(html || ''));
+    if (m) this.options.push({ value: m[1], textContent: m[2] });
+  }
+  get innerHTML() { return ''; }
+  appendChild(opt) { this.options.push(opt); }
+  get value() { return this._value; }
+  set value(v) { this._value = this.options.some((o) => o.value === String(v)) ? String(v) : ''; }
+  valori() { return this.options.filter((o) => o.value).map((o) => o.value); }
+}
+
+const T0 = Date.parse('2026-10-23T10:00:00Z');
+const categorieDoppie = [
+  // Vite: canonica = v-old (createdAt più vecchio); colture tutte su v-new
+  { id: 'v-new', codice: 'vite', nome: 'Vite', applicabileA: 'colture', predefinita: true, ordine: 3, createdAt: new Date(T0 + 5000) },
+  { id: 'v-old', codice: 'vite', nome: 'Vite', applicabileA: 'colture', predefinita: true, ordine: 3, createdAt: new Date(T0) },
+  // Frutteto: niente createdAt, canonica per id byte ('B…' < 'a…'); colture su 'aF'
+  { id: 'aF', codice: 'frutteto', nome: 'Frutteto', applicabileA: 'colture', predefinita: true, ordine: 1 },
+  { id: 'BF', codice: 'frutteto', nome: 'Frutteto', applicabileA: 'colture', predefinita: true, ordine: 1 },
+  // Seminativo: colture doppie sulla stessa copia
+  { id: 's1', codice: 'seminativo', nome: 'Seminativo', applicabileA: 'colture', predefinita: true, ordine: 2, createdAt: new Date(T0) },
+  { id: 's2', codice: 'seminativo', nome: 'Seminativo', applicabileA: 'colture', predefinita: true, ordine: 2, createdAt: new Date(T0 + 1) },
+];
+const colturePerCategoriaDb = {
+  'v-new': [{ id: 'c1', nome: 'Vite' }, { id: 'c2', nome: 'Vite da Vino' }, { id: 'c3', nome: 'Vite' }],
+  aF: [{ id: 'c4', nome: 'Melo' }, { id: 'c5', nome: 'Pesco' }],
+  s1: [{ id: 'c6', nome: 'Grano' }, { id: 'c7', nome: 'Grano' }, { id: 'c8', nome: 'Mais' }],
+};
+
+let selects;
+beforeEach(() => {
+  vi.clearAllMocks();
+  selects = { 'terreno-coltura-categoria': new FakeSelect(), 'terreno-coltura': new FakeSelect() };
+  globalThis.window = { location: { protocol: 'https:' } };
+  globalThis.document = {
+    getElementById: (id) => selects[id] || null,
+    createElement: () => ({ value: '', textContent: '' }),
+  };
+  getAllCategorie.mockResolvedValue(categorieDoppie.map((c) => ({ ...c })));
+  getAllColture.mockResolvedValue(new Array(25).fill({ nome: 'x' }));
+  getColturePerCategoria.mockResolvedValue(JSON.parse(JSON.stringify(colturePerCategoriaDb)));
+});
+afterEach(() => {
+  delete globalThis.window;
+  delete globalThis.document;
+});
+
+describe('Terreni: dedup in due passi senza perdere le colture', () => {
+  it('passo 1 (solo categorie): select con le sole canoniche, stato con tutte le copie', async () => {
+    const stato = [];
+    await loadCategorieColtureTerreni('cascina-conti', {}, {}, {}, stato);
+    expect(selects['terreno-coltura-categoria'].valori()).toEqual(['BF', 's1', 'v-old']);
+    expect(stato).toHaveLength(6);
+  });
+
+  it('passo 2 (colture su copia non canonica): Vite e Frutteto hanno colture, Seminativo senza doppioni', async () => {
+    const stato = [];
+    const perCategoria = {};
+    const colture = [];
+    await loadCategorieColtureTerreni('cascina-conti', {}, {}, {}, stato);
+    await loadColturePerCategoriaTerreni('cascina-conti', {}, {}, {}, perCategoria, colture, stato);
+
+    expect(perCategoria['v-old'].map((c) => c.nome)).toEqual(['Vite', 'Vite da Vino']);
+    expect(perCategoria.BF.map((c) => c.nome)).toEqual(['Melo', 'Pesco']);
+    expect(perCategoria.s1.map((c) => c.nome)).toEqual(['Grano', 'Mais']);
+    expect(perCategoria['v-new']).toBeUndefined();
+    expect(perCategoria.aF).toBeUndefined();
+
+    const state = { colturePerCategoriaTerreni: perCategoria, categorieColtureTerreni: stato };
+    for (const [catId, attese] of [['v-old', ['Vite', 'Vite da Vino']], ['BF', ['Melo', 'Pesco']], ['s1', ['Grano', 'Mais']]]) {
+      selects['terreno-coltura-categoria'].value = catId;
+      updateColtureDropdownTerreni(state, () => {}, null);
+      expect(selects['terreno-coltura'].valori()).toEqual(attese);
+    }
+  });
+
+  it('loadColture completo + Modifica «Vigna Nord» (coltura Vite) preseleziona la categoria', async () => {
+    const state = { categorieColtureTerreni: [], colturePerCategoriaTerreni: {}, colture: [] };
+    await loadColture('cascina-conti', {}, {}, {}, state.categorieColtureTerreni, state.colturePerCategoriaTerreni, state.colture);
+    expect(selects['terreno-coltura-categoria'].valori()).toEqual(['BF', 's1', 'v-old']);
+
+    // stessa logica di openTerrenoModal (terreni-events.js)
+    const { aliasToCanon } = raggruppaCategorie(state.categorieColtureTerreni);
+    const catId = trovaCategoriaPerColtura('Vite', state.colturePerCategoriaTerreni, aliasToCanon);
+    expect(catId).toBe('v-old');
+    selects['terreno-coltura-categoria'].value = catId;
+    expect(selects['terreno-coltura-categoria'].value).toBe('v-old');
+    updateColtureDropdownTerreni(state, () => {}, null);
+    selects['terreno-coltura'].value = 'Vite';
+    expect(selects['terreno-coltura'].value).toBe('Vite');
+  });
+
+  it('anche se il canonico scelto non ha colture proprie, un alias le porta (id «vecchio» salvato altrove)', () => {
+    const { aliasToCanon } = raggruppaCategorie(categorieDoppie);
+    expect(trovaCategoriaPerColtura('Vite', colturePerCategoriaDb, aliasToCanon)).toBe('v-old');
+    expect(trovaCategoriaPerColtura('Pesco', colturePerCategoriaDb, aliasToCanon)).toBe('BF');
+  });
+});
diff --git a/tests/catalogo-seed-idempotente.test.js b/tests/catalogo-seed-idempotente.test.js
new file mode 100644
index 00000000..4d7c7c1b
--- /dev/null
+++ b/tests/catalogo-seed-idempotente.test.js
@@ -0,0 +1,165 @@
+/**
+ * Seed catalogo idempotente (categorie, colture, tipi lavoro) con Firestore finto in memoria.
+ * - id deterministici `seed_<codice|nome>` via setDocument (merge), mai addDoc;
+ * - due chiamate concorrenti → una sola scrittura per voce;
+ * - lettura fallita → nessuna scrittura;
+ * - copie omonime già presenti → colture/tipi agganciati alla copia canonica.
+ */
+import { describe, it, expect, vi, beforeEach } from 'vitest';
+
+const db = vi.hoisted(() => ({ store: {}, failRead: false, writes: [] }));
+
+vi.mock('../core/services/firebase-service.js', () => {
+  const tick = () => new Promise((r) => setTimeout(r, 0));
+  return {
+    timestampToDate: (v) => (v instanceof Date ? v : new Date(v)),
+    dateToTimestamp: (v) => v,
+    getCollectionData: vi.fn(async (col) => {
+      await tick();
+      if (db.failRead) throw new Error('Errore lettura collection: unavailable');
+      return Object.entries(db.store[col] || {}).map(([id, d]) => ({ id, ...d }));
+    }),
+    setDocument: vi.fn(async (col, id, data) => {
+      await tick();
+      db.writes.push(`${col}/${id}`);
+      db.store[col] = db.store[col] || {};
+      const esiste = !!db.store[col][id];
+      // come firebase-service.setDocument: createdAt solo alla prima scrittura
+      db.store[col][id] = { ...(db.store[col][id] || {}), ...data, ...(esiste ? {} : { createdAt: new Date('2026-01-01T00:00:00Z') }) };
+    }),
+    createDocument: vi.fn(async () => { throw new Error('addDoc non deve essere usato dai seed'); }),
+    updateDocument: vi.fn(async () => {}),
+    deleteDocument: vi.fn(async () => {}),
+    getDocumentData: vi.fn(async () => null),
+  };
+});
+vi.mock('../core/services/tenant-service.js', () => ({
+  getCurrentTenantId: vi.fn(() => 'cascina-conti'),
+}));
+
+import { setDocument, createDocument } from '../core/services/firebase-service.js';
+import { initializeCategoriePredefinite } from '../core/services/categorie-service.js';
+import { initializeColturePredefinite } from '../core/services/colture-service.js';
+import { initializeTipiLavoroPredefiniti } from '../core/services/tipi-lavoro-service.js';
+import { idSeed, slugCatalogo, conLockSeed, _resetLockSeed } from '../core/services/catalogo-seed.js';
+import {
+  CATEGORIE_PRINCIPALI_PREDEFINITE,
+  CATEGORIE_COLTURE_PREDEFINITE,
+  SOTTOCATEGORIE_PREDEFINITE,
+  COLTURE_PREDEFINITE,
+} from '../core/config/app-catalog-seed-data.js';
+
+const NUM_CATEGORIE =
+  CATEGORIE_PRINCIPALI_PREDEFINITE.length + CATEGORIE_COLTURE_PREDEFINITE.length + SOTTOCATEGORIE_PREDEFINITE.length;
+
+beforeEach(() => {
+  vi.clearAllMocks();
+  _resetLockSeed();
+  db.store = {};
+  db.failRead = false;
+  db.writes = [];
+  vi.spyOn(console, 'warn').mockImplementation(() => {});
+  vi.spyOn(console, 'error').mockImplementation(() => {});
+});
+
+describe('catalogo-seed utilità', () => {
+  it('idSeed deterministico, minuscolo, senza accenti', () => {
+    expect(idSeed('vite')).toBe('seed_vite');
+    expect(idSeed("Fico d'India")).toBe('seed_fico_d_india');
+    expect(slugCatalogo(' Erba Médica ')).toBe('erba_medica');
+    expect(() => idSeed('  ')).toThrow();
+  });
+  it('id seed unici su tutto il catalogo predefinito', () => {
+    const cat = [...CATEGORIE_PRINCIPALI_PREDEFINITE, ...CATEGORIE_COLTURE_PREDEFINITE, ...SOTTOCATEGORIE_PREDEFINITE].map((c) => idSeed(c.codice));
+    expect(new Set(cat).size).toBe(cat.length);
+    const col = COLTURE_PREDEFINITE.map((c) => idSeed(c.nome));
+    expect(new Set(col).size).toBe(col.length);
+  });
+  it('conLockSeed: chiamate concorrenti condividono la stessa esecuzione', async () => {
+    const fn = vi.fn(async () => 'ok');
+    const [a, b] = await Promise.all([conLockSeed('x', 't', fn), conLockSeed('x', 't', fn)]);
+    expect([a, b]).toEqual(['ok', 'ok']);
+    expect(fn).toHaveBeenCalledTimes(1);
+    await conLockSeed('x', 't', fn);
+    expect(fn).toHaveBeenCalledTimes(2);
+  });
+});
+
+describe('initializeCategoriePredefinite', () => {
+  it('due chiamate concorrenti → una sola scrittura per codice, id seed_<codice>', async () => {
+    await Promise.all([initializeCategoriePredefinite(), initializeCategoriePredefinite()]);
+    expect(createDocument).not.toHaveBeenCalled();
+    expect(db.writes).toHaveLength(NUM_CATEGORIE);
+    expect(new Set(db.writes).size).toBe(NUM_CATEGORIE);
+    expect(db.store.categorie.seed_vite).toMatchObject({ codice: 'vite', applicabileA: 'colture' });
+    const sub = Object.values(db.store.categorie).find((c) => c.parentId);
+    expect(String(sub.parentId).startsWith('seed_')).toBe(true);
+    // i dati passati a setDocument non portano createdAt/id del modello (li gestisce setDocument)
+    expect(setDocument.mock.calls.every(([, , data]) => !('createdAt' in data) && !('id' in data))).toBe(true);
+  });
+
+  it('seconda esecuzione non scrive nulla', async () => {
+    await initializeCategoriePredefinite();
+    const prima = db.writes.length;
+    await initializeCategoriePredefinite();
+    expect(db.writes.length).toBe(prima);
+  });
+
+  it('lettura fallita → nessuna scrittura e errore propagato', async () => {
+    db.failRead = true;
+    await expect(initializeCategoriePredefinite()).rejects.toThrow(/inizializzazione categorie/);
+    expect(setDocument).not.toHaveBeenCalled();
+  });
+});
+
+describe('initializeColturePredefinite', () => {
+  it('concorrenti → una scrittura per coltura; categoria = copia canonica fra le omonime', async () => {
+    db.store.categorie = {
+      'vite-nuova': { codice: 'vite', nome: 'Vite', applicabileA: 'colture', predefinita: true, createdAt: new Date('2026-10-23T10:00:05Z') },
+      'vite-vecchia': { codice: 'vite', nome: 'Vite', applicabileA: 'colture', predefinita: true, createdAt: new Date('2026-10-23T10:00:00Z') },
+      'frutteto-x': { codice: 'frutteto', nome: 'Frutteto', applicabileA: 'colture', predefinita: true },
+    };
+    await Promise.all([initializeColturePredefinite(), initializeColturePredefinite()]);
+    const scritte = db.writes.filter((w) => w.startsWith('colture/'));
+    expect(new Set(scritte).size).toBe(scritte.length);
+    expect(db.store.colture[idSeed('Vite da Vino')].categoriaId).toBe('vite-vecchia');
+    expect(db.store.colture[idSeed('Pesco')].categoriaId).toBe('frutteto-x');
+    expect(db.store.colture[idSeed('Grano')]).toBeUndefined(); // categoria seminativo assente
+  });
+
+  it('colture già presenti per nome non vengono riscritte', async () => {
+    db.store.categorie = { v: { codice: 'vite', nome: 'Vite', applicabileA: 'colture' } };
+    db.store.colture = { vecchio: { nome: 'vite', categoriaId: 'v' } };
+    await initializeColturePredefinite();
+    expect(db.writes).not.toContain(`colture/${idSeed('Vite')}`);
+    expect(db.writes).toContain(`colture/${idSeed('Vite da Vino')}`);
+  });
+
+  it('lettura fallita → nessuna scrittura', async () => {
+    db.failRead = true;
+    await expect(initializeColturePredefinite()).rejects.toThrow();
+    expect(setDocument).not.toHaveBeenCalled();
+  });
+});
+
+describe('initializeTipiLavoroPredefiniti', () => {
+  it('concorrenti → una scrittura per tipo, agganciati alle categorie canoniche', async () => {
+    await initializeCategoriePredefinite();
+    // copia omonima più recente di una principale: non deve essere scelta
+    db.store.categorie['zzz-copia'] = { codice: 'potatura', nome: 'Potatura', applicabileA: 'entrambi', predefinita: true, createdAt: new Date() };
+    db.writes = [];
+    await Promise.all([initializeTipiLavoroPredefiniti(), initializeTipiLavoroPredefiniti()]);
+    const scritte = db.writes.filter((w) => w.startsWith('tipiLavoro/'));
+    expect(scritte.length).toBeGreaterThan(0);
+    expect(new Set(scritte).size).toBe(scritte.length);
+    expect(scritte.every((w) => w.startsWith('tipiLavoro/seed_'))).toBe(true);
+    const usaCopia = Object.values(db.store.tipiLavoro).some((t) => t.categoriaId === 'zzz-copia');
+    expect(usaCopia).toBe(false);
+  });
+
+  it('lettura fallita → nessuna scrittura', async () => {
+    db.failRead = true;
+    await expect(initializeTipiLavoroPredefiniti()).rejects.toThrow();
+    expect(setDocument).not.toHaveBeenCalled();
+  });
+});
diff --git a/tests/moduli-identificatori-definiti.test.js b/tests/moduli-identificatori-definiti.test.js
index af18961a..4fdbacf9 100644
--- a/tests/moduli-identificatori-definiti.test.js
+++ b/tests/moduli-identificatori-definiti.test.js
@@ -20,12 +20,21 @@ const MODULI = [
   'core/js/dashboard-deadlines.js',
   'core/js/dashboard-meteo.js',
   'core/js/dashboard-quick-bar.js',
+  'core/js/catalogo-dedupe.js',
+  'core/js/lavoro-cascade-filters.js',
   'core/js/lavoro-progresso-display.js',
   'core/js/terreni-categorie-colture.js',
+  'core/js/terreni-controller.js',
+  'core/js/terreni-events.js',
   'core/admin/js/gestione-lavori-controller.js',
   'core/admin/js/gestione-lavori-maps.js',
+  'core/services/catalogo-seed.js',
+  'core/services/categorie-service.js',
+  'core/services/colture-service.js',
+  'core/services/tipi-lavoro-service.js',
   'core/services/zone-lavorate-area.js',
   'core/services/zone-lavorate-permessi.js',
+  'modules/seminativo/services/seminativi-service.js',
   'modules/vendemmia-meccanica/js/vm-zone-mappa.js',
   'modules/vendemmia-meccanica/services/lavoro-piano-sync-service.js',
   'modules/vendemmia-meccanica/services/piano-stagione-service.js',
@@ -44,10 +53,13 @@ const PAGINE = [
  * Nomi già liberi su origin/develop, fuori da questa PR.
  * dashboard-data: loadLavoriOggiOperaio legge caposquadraId senza dichiararlo.
  * dashboard: deleteDoc è chiamato senza essere nell'import di firebase-service.
+ * tipi-lavoro-service: createTipoLavoro usa `sottocategoria` non dichiarata (già su develop).
  */
 const PREESISTENTI = {
   'core/js/dashboard-data.js': new Set(['caposquadraId']),
   'core/dashboard-standalone.html': new Set(['deleteDoc']),
+  // tipi-lavoro-service: createTipoLavoro legge `sottocategoria` mai dichiarata nel messaggio duplicato (follow-up).
+  'core/services/tipi-lavoro-service.js': new Set(['sottocategoria']),
 };
 
 const GLOBALI = new Set([
````

Poi:

```powershell
git apply --check fix-catalogo-doppioni.diff
git apply fix-catalogo-doppioni.diff
Remove-Item fix-catalogo-doppioni.diff
git status --short
```

Ti aspetti, oltre agli eventuali non tracciati da ignorare:

```
 M core/js/attivita-controller.js
 M core/js/lavoro-cascade-filters.js
 M core/js/terreni-categorie-colture.js
 M core/js/terreni-controller.js
 M core/js/terreni-events.js
 M core/services/categorie-service.js
 M core/services/colture-service.js
 M core/services/liste-service.js
 M core/services/tipi-lavoro-service.js
 M modules/frutteto/js/frutteti-page.js
 M modules/seminativo/services/seminativi-service.js
 M tests/moduli-identificatori-definiti.test.js
?? core/js/catalogo-dedupe.js
?? core/services/catalogo-seed.js
?? tests/catalogo-dedupe.test.js
?? tests/catalogo-doppioni-scenario.test.js
?? tests/catalogo-seed-idempotente.test.js
```

Se `git apply --check` fallisce, NON applicare a mano. Prova una volta `git apply --check --ignore-whitespace fix-catalogo-doppioni.diff`, solo per capire se il problema sono i fine riga (CRLF) del file salvato. Poi fermati e riportami l'errore esatto.

Controllo che non sia stato toccato niente di vietato. Questo comando non deve stampare nulla:

```powershell
git status --short -- core/js/tony core/js/gfv-tony-loader.js functions firestore.rules
```

### 3. Test (solo i file nuovi o toccati, uno per uno)

Se `node_modules` manca, prima esegui `npm ci`.

```powershell
npx vitest run tests/catalogo-dedupe.test.js
npx vitest run tests/catalogo-doppioni-scenario.test.js
npx vitest run tests/catalogo-seed-idempotente.test.js
npx vitest run tests/terreni-categorie-colture.test.js
npx vitest run tests/moduli-identificatori-definiti.test.js
npx vitest run tests/cascade-colture-lavori.test.js
npx vitest run tests/app-update-form-sporco.test.js
npx vitest run tests/seminativo-anagrafica.test.js
npx vitest run tests/seminativo-concimazioni.test.js
npx vitest run tests/seminativo-hub.test.js
npx vitest run tests/seminativo-lavorazioni.test.js
npx vitest run tests/seminativo-module-skeleton.test.js
npx vitest run tests/seminativo-raccolta.test.js
npx vitest run tests/seminativo-rotazione.test.js
npx vitest run tests/seminativo-semina.test.js
npx vitest run tests/seminativo-spese.test.js
npx vitest run tests/seminativo-statistiche.test.js
npx vitest run tests/seminativo-trattamenti.test.js
```

Risultati attesi (verificati su develop 11b5b91e + patch):

| File | Test superati |
|---|---|
| `catalogo-dedupe` | 20 |
| `catalogo-doppioni-scenario` | 4 |
| `catalogo-seed-idempotente` | 11 |
| `terreni-categorie-colture` | 11 |
| `moduli-identificatori-definiti` | 33 |
| `cascade-colture-lavori` | 14 |
| `app-update-form-sporco` | 9 |
| `seminativo-anagrafica` | 6 |
| `seminativo-concimazioni` | 4 |
| `seminativo-hub` | 4 |
| `seminativo-lavorazioni` | 5 |
| `seminativo-module-skeleton` | 7 |
| `seminativo-raccolta` | 5 |
| `seminativo-rotazione` | 4 |
| `seminativo-semina` | 5 |
| `seminativo-spese` | 4 |
| `seminativo-statistiche` | 3 |
| `seminativo-trattamenti` | 4 |

Cosa coprono i test nuovi:
- **`catalogo-dedupe`**: raggruppamento per codice/nome; canonico deterministico (predefinita, poi `createdAt`, poi id byte: `'B9x'` batte `'aZ1'`); alias; sottocategorie unite sotto il padre canonico; unione colture con dedupe per nome; tipi lavoro senza doppioni; cascade lavoro (principali e sottocategorie singole, tipo specifico singolo, `resolveLavoroCascadeParents` da id copia a id canonico).
- **`catalogo-doppioni-scenario`**, scenario in due passi su `terreni-controller`/`terreni-events` reali con select finti:
  - prima le categorie senza colture, poi le colture con `categoriaId` sulla copia NON canonica;
  - Vite e Frutteto hanno colture, Seminativo è senza doppioni;
  - la Modifica di «Vigna Nord» (coltura Vite) preseleziona la categoria;
  - con `terreni-controller.js`, `terreni-events.js` e `terreni-categorie-colture.js` di develop (senza patch) tre di questi quattro test falliscono.
- **`catalogo-seed-idempotente`**, Firestore finto in memoria:
  - due chiamate concorrenti producono una sola scrittura per voce, con id `seed_*`, mai `addDoc`;
  - la seconda esecuzione non scrive nulla;
  - una lettura fallita non scrive nulla e propaga l'errore;
  - colture e tipi vengono agganciati alla copia canonica fra le omonime.

`tests/cascade-v3-smoke-bench.test.js` fallisce già su develop pulito (import `https:` non supportato in Node): non c'entra, non lanciarlo. Non lanciare altro. Chiudi eventuali processi vitest rimasti.

### 4. simulator/manifest.json

```powershell
git status --short simulator/manifest.json
```

Se risulta modificato:

```powershell
git checkout -- simulator/manifest.json
```

### 5. Cache PWA (SW_CACHE_BUILD_ID)

Il bump lo fa l'hook `.githooks/pre-commit`: esegue `node scripts/bump-pwa-cache-version.mjs`, cioè lo stesso script di `npm run bump:pwa-cache`, e poi `git add service-worker.js`. Controlla che l'hook sia attivo:

```powershell
git config --get core.hooksPath
```

- Se stampa `.githooks`, non fare nulla: al commit l'hook aggiorna e aggiunge `service-worker.js` da solo. NON lanciare anche `npm run bump:pwa-cache`.
- Se non stampa nulla, l'hook non è attivo. In questo caso, e solo in questo, esegui prima del commit:

```powershell
npm run bump:pwa-cache
git add service-worker.js
```

### 6. Commit (solo i file toccati, elencati)

```powershell
git add core/js/catalogo-dedupe.js core/services/catalogo-seed.js core/js/terreni-categorie-colture.js core/js/terreni-controller.js core/js/terreni-events.js core/js/attivita-controller.js core/js/lavoro-cascade-filters.js core/services/categorie-service.js core/services/colture-service.js core/services/tipi-lavoro-service.js core/services/liste-service.js modules/frutteto/js/frutteti-page.js modules/seminativo/services/seminativi-service.js
git add tests/catalogo-dedupe.test.js tests/catalogo-doppioni-scenario.test.js tests/catalogo-seed-idempotente.test.js tests/moduli-identificatori-definiti.test.js
git commit -m "Catalogo: unisci categorie/colture/tipi lavoro omonimi e rendi idempotente il seed (id seed_*, lock, niente seed su lettura fallita)"
git show --stat HEAD
```

In `git show --stat` ti aspetti i 17 file sopra più `service-worker.js` (una riga, il bump dell'hook). Nient'altro.

### 7. Push e PR in BOZZA verso develop (nessun merge)

```powershell
git push -u origin fix/catalogo-doppioni
gh pr create --draft --base develop --head fix/catalogo-doppioni --title "Catalogo: niente doppioni di categorie, colture e tipi lavoro (unione in codice + seed idempotente)" --body "Ritest Cascina Conti dopo #277: Vite/Frutteto senza colture, Modifica Vigna Nord senza categoria preselezionata, Seminativo colture x2, Diario categorie x2 e tipo lavoro specifico x2. Cause: seed con addDoc (id casuali) senza lock e con riseed se la lettura torna [] per errore; mappe codice->id last-wins; dedup di #277 fatta prima delle colture e in place (terreni-controller.js:360-362) con tie-break localeCompare. Fix (a): helper puro core/js/catalogo-dedupe.js (gruppi per codice o nome, sottocategorie per codice padre+codice, canonico deterministico predefinita > createdAt > id byte, alias, unione colture per nome, dedupe tipi per nome+categoria canonica) usato in Terreni (niente riduzione in place, preselezione via alias, tendina senza doppioni), Diario, lavoro-cascade-filters (indice, relink, filtro, resolve: quindi anche Gestione lavori), moduli frutteto/seminativo, getTipiLavoroNomi. Fix (b): seed categorie/colture/tipi con id deterministici seed_* e setDocument merge, lock in memoria per tenant, letture grezze che lanciano (nessuna scrittura su errore), mappe codice->canonico; firestore.rules invariato (permette gia' create/update con id client al manager). Nessuna pulizia dati: i doppioni gia' in Firestore restano, nascosti dall'unione; pulizia da decidere dopo il ritest. Nessun tocco a tony/, gfv-tony-loader, functions, firestore.rules. Test puri: catalogo-dedupe (20), catalogo-doppioni-scenario (4), catalogo-seed-idempotente (11), terreni-categorie-colture (11, invariato), moduli-identificatori-definiti (33), cascade-colture-lavori (14)."
```

NON fare merge. Riportami il link della PR.

### 8. Cosa riportarmi

- lo sha di partenza (`git rev-parse HEAD` del passo 1) e l'hash sha256 del `.diff`;
- l'esito di `git apply --check`;
- l'output finale di ogni `npx vitest run`;
- il `git show --stat HEAD`;
- se `simulator/manifest.json` è stato ripristinato;
- il valore di `core.hooksPath`;
- il link della PR in bozza.

## Ritest manuale su Pages (dopo merge e deploy, deciso da me)

Su Cascina Conti, con i doppioni ancora in Firestore:
- [ ] **Terreni**, «+ Aggiungi Terreno»: in Categoria Coltura ogni nome appare una volta sola.
- [ ] **Vite** elenca Vite, Vite da Tavola e Vite da Vino; **Frutteto** elenca le specie. Nessun «Nessuna coltura disponibile».
- [ ] **Seminativo**: ogni coltura una volta sola (Grano, Mais, …).
- [ ] **Modifica «Vigna Nord»**: Categoria = Vite preselezionata e Coltura = Vite. Salva e riapri: invariato.
- [ ] **Diario**, nuova attività: Categoria coltura con voci singole e colture singole. Categoria lavoro e sottocategoria singole. **Tipo lavoro specifico** senza doppioni (es. Potatura → Manuale).
- [ ] **Gestione lavori**, crea o modifica un lavoro: categoria, sottocategoria e tipo lavoro singoli; in Modifica la categoria è preselezionata.
- [ ] Console pulita; salvataggi ok.
- [ ] Tenant NUOVO di prova: aprire Terreni e subito «Aggiungi Terreno» (o Terreni + Gestione lavori in due tab). In Firestore le categorie hanno id `seed_<codice>` e le colture e i tipi id `seed_<nome>`, senza copie.

**I doppioni già in Firestore restano.** Questa PR li nasconde nell'interfaccia e impedisce di crearne di nuovi. L'eventuale pulizia (script Admin una tantum: rimappare `colture.categoriaId`, `categorie.parentId`, `tipiLavoro.categoriaId/sottocategoriaId`, `macchine.categoriaFunzione`, conto terzi `categoriaColturaId`, `colturaId` dei moduli, poi cancellare le copie) è un lavoro separato, da decidere dopo questo ritest.

## Follow-up fuori da questa PR (solo segnalati)

- **Impostazioni** (`core/admin/impostazioni-standalone.html`): i loader categorie/colture/tipi (`:2356`, `:2528`, `:2568`, `:2830`, `:2903`) mostrano ancora le copie. Inoltre `pulisciDuplicatiTipiLavoro` (`:1892-1951`) non rimuove i doppioni predefiniti.
- **Conto terzi** (tariffe, nuovo-preventivo, terreni-clienti, preventivi) carica categorie e colture senza unione e chiama ancora il seed colture con guardia `<20`, che ora però è idempotente.
- **Fallback file://** con `addDoc`: `terreni-controller.js:181-300`, `impostazioni-standalone.html:2041`, `attivita-controller.js:2338`. Su Pages non vengono eseguiti.
- **Gestione lavori**, creazione categoria/tipo (`gestione-lavori-events.js:1465`, `:1615`) e migrazioni `migraCategorieLavoriEsistenti`/`migraDatiEsistenti` (`gestione-lavori-standalone.html:3946`, `:4003`): non toccate.
- **`createTipoLavoro`** (`tipi-lavoro-service.js`, messaggio per i duplicati) usa `sottocategoria` mai dichiarata: bug già presente su develop, segnato in `moduli-identificatori-definiti.test.js`.
- **Tony** (non toccato): il contesto server carica al massimo 50 categorie (`functions/index.js:648`); con i doppioni in Firestore (76) la lista viene troncata.
