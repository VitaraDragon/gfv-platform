# Fix categorie coltura duplicate nel form terreno

Repo: VitaraDragon/gfv-platform (ERP agricolo, Firebase + JS). Lavori sul PC Windows, in PowerShell. Questo prompt è completo: la patch da applicare è qui sotto, integrale.

## Perché

Su tenant nuovi (es. Cascina Conti) il form **Terreni** mostra **Categoria Coltura** duplicate: stesso nome, id Firestore diversi. Scegliendo la prima copia, **Coltura** resta «Nessuna coltura disponibile per questa categoria»; la seconda copia ha le colture.

Causa confermata:
1. il seed (`initializeCategoriePredefinite` / `initializeColturePredefinite`) può creare documenti omonimi con id diversi;
2. `loadCategorieColtureTerreni` popola `#terreno-coltura-categoria` senza deduplicare;
3. le colture hanno `categoriaId` solo sull’id del seed riuscito, quindi una copia resta orfana;
4. oggi `loadColture` chiama prima le categorie e poi le colture: al populate del select categorie la mappa `colturePerCategoriaTerreni` può essere ancora vuota, quindi non si può ancora preferire la copia “con colture”.

Non dipende dai moduli vigneto/frutteto/seminativo.

**Correzione (minima):**
- helper puro `core/js/terreni-categorie-colture.js` con `dedupeCategorieColture` / `popolaSelectCategorieColture` (dedupe per `codice`, fallback nome normalizzato; se due doc stessa chiave preferisci quella con almeno una coltura in `colturePerCategoriaTerreni`, altrimenti `predefinita` / ordine migliore);
- `loadCategorieColtureTerreni` popola con dedupe;
- a fine `loadColture` (e dopo il seed in `loadColturePerCategoriaTerreni`) ripopola sempre il select con la mappa colture già disponibile;
- nel `catch` di `loadColturePerCategoriaTerreni` (fallback a `liste/personalizzate`): svuota la mappa colture-per-categoria, mostra un messaggio chiaro nel select categorie e non lascia categorie piene con colture vuote;
- opzionale basso rischio: in `initializeCategoriePredefinite`, se `getAllCategorie()` torna `[]`, secondo tentativo di lettura grezza (`getCollectionData` senza filtri) prima di creare — evita re-seed silenzioso. Nessuna cancellazione di documenti Firestore orfani in questa patch (solo merge in memoria nel dropdown).

## Divieti

- NON toccare niente sotto `core/js/tony/**`, né `core/js/gfv-tony-loader.js`, né `functions/`, né `firestore.rules`, né i moduli coltura (vigneto/frutteto/seminativo). La patch non li tocca: se ti sembra di doverli cambiare, fermati e chiedi.
- NON modificare a mano `SW_CACHE_BUILD_ID` in `service-worker.js`.
- NON lanciare la suite vitest intera (avvia gli emulatori) e NON aprire porte 8183/8080/9099.
- NON fare merge della PR e NON fare checkout di `main` in questa cartella.
- Ignora i due file non tracciati `HANDOFF_ESTRAZIONE_SCRIPT_PAGINE.md` e `test-results/`: non aggiungerli e non cancellarli.
- NON push/PR/deploy da ambienti diversi da questa cartella di lavoro Windows di Pier.

## File toccati dalla patch

- `core/js/terreni-categorie-colture.js`: nuovo, 174 righe (helper puro).
- `core/js/terreni-controller.js`: +61/−22. Dedupe/populate; ripopolo dopo seed e a fine `loadColture`; catch con messaggio errore.
- `core/services/categorie-service.js`: +19/−1. Secondo tentativo grezzo se `getAllCategorie()` è vuoto.
- `tests/terreni-categorie-colture.test.js`: nuovo, 174 righe, Vitest puro, senza emulatori.
- `tests/moduli-identificatori-definiti.test.js`: +1, aggiunge il modulo nuovo alla lista.

## Passi (PowerShell, un comando per riga)

### 1. Partire da develop aggiornato

```powershell
git status --short
git fetch origin
git checkout develop
git pull --ff-only origin develop
git checkout -b fix/categorie-colture-duplicate
```

Se `git status --short` mostra modifiche diverse dai due file non tracciati da ignorare, fermati e chiedimi.

### 2. Salvare la patch e applicarla

Crea nella radice del repo il file `fix-categorie-colture-duplicate.diff` con il contenuto ESATTO del blocco qui sotto, dalla riga `diff --git` all’ultima riga prima della chiusura del blocco. Usa il tuo strumento di scrittura file, non `Set-Content` o `Out-File`. Il file va in UTF-8 senza BOM, con fine riga LF e con un a capo finale. Non riformattarlo e non togliere spazi.

````diff
diff --git a/core/js/terreni-categorie-colture.js b/core/js/terreni-categorie-colture.js
new file mode 100644
index 00000000..d8bfafa6
--- /dev/null
+++ b/core/js/terreni-categorie-colture.js
@@ -0,0 +1,174 @@
+/**
+ * Deduplica e popola il select «Categoria Coltura» del form terreno.
+ * Funzioni pure (salvo popolaSelect, che tocca solo l'elemento passato).
+ * @module core/js/terreni-categorie-colture
+ */
+
+/**
+ * Chiave di dedupe: codice normalizzato, altrimenti nome normalizzato.
+ * @param {{ codice?: string, nome?: string, id?: string }|null|undefined} cat
+ * @returns {string}
+ */
+export function chiaveDedupeCategoria(cat) {
+  if (!cat || typeof cat !== 'object') return '';
+  const codice = typeof cat.codice === 'string' ? cat.codice.trim().toLowerCase() : '';
+  if (codice) return `c:${codice}`;
+  const nome = typeof cat.nome === 'string' ? cat.nome.trim().toLowerCase() : '';
+  if (nome) return `n:${nome}`;
+  return cat.id ? `i:${cat.id}` : '';
+}
+
+/**
+ * Quante colture sono associate all'id categoria nella mappa.
+ * @param {{ id?: string }|null|undefined} cat
+ * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
+ * @returns {number}
+ */
+export function conteggioColtureCategoria(cat, colturePerCategoria) {
+  if (!cat || !cat.id || !colturePerCategoria || typeof colturePerCategoria !== 'object') {
+    return 0;
+  }
+  const lista = colturePerCategoria[cat.id];
+  return Array.isArray(lista) ? lista.length : 0;
+}
+
+/**
+ * Preferisci la categoria con almeno una coltura; altrimenti predefinita;
+ * altrimenti ordine minore; altrimenti id stabile.
+ * @param {object} a
+ * @param {object} b
+ * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
+ * @returns {number} negativo se a batte b
+ */
+export function confrontaCategorieDuplicate(a, b, colturePerCategoria) {
+  const colA = conteggioColtureCategoria(a, colturePerCategoria) > 0 ? 1 : 0;
+  const colB = conteggioColtureCategoria(b, colturePerCategoria) > 0 ? 1 : 0;
+  if (colA !== colB) return colB - colA;
+
+  const predA = a && a.predefinita ? 1 : 0;
+  const predB = b && b.predefinita ? 1 : 0;
+  if (predA !== predB) return predB - predA;
+
+  const ordA = Number.isFinite(a && a.ordine) ? a.ordine : 999;
+  const ordB = Number.isFinite(b && b.ordine) ? b.ordine : 999;
+  if (ordA !== ordB) return ordA - ordB;
+
+  const idA = a && a.id != null ? String(a.id) : '';
+  const idB = b && b.id != null ? String(b.id) : '';
+  return idA.localeCompare(idB);
+}
+
+/**
+ * Deduplica categorie omonime (stesso codice, fallback nome).
+ * Se due doc condividono la chiave, resta quella preferita da confrontaCategorieDuplicate.
+ * @param {Array<object>|null|undefined} categorie
+ * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
+ * @returns {Array<object>}
+ */
+export function dedupeCategorieColture(categorie, colturePerCategoria) {
+  if (!Array.isArray(categorie) || categorie.length === 0) return [];
+
+  const migliori = new Map();
+  for (const cat of categorie) {
+    if (!cat || typeof cat !== 'object') continue;
+    const chiave = chiaveDedupeCategoria(cat);
+    if (!chiave) continue;
+    const attuale = migliori.get(chiave);
+    if (!attuale || confrontaCategorieDuplicate(cat, attuale, colturePerCategoria) < 0) {
+      migliori.set(chiave, cat);
+    }
+  }
+
+  const risultato = Array.from(migliori.values());
+  risultato.sort((a, b) => {
+    const ordA = Number.isFinite(a && a.ordine) ? a.ordine : 999;
+    const ordB = Number.isFinite(b && b.ordine) ? b.ordine : 999;
+    if (ordA !== ordB) return ordA - ordB;
+    const nomeA = (a && a.nome) || '';
+    const nomeB = (b && b.nome) || '';
+    return String(nomeA).localeCompare(String(nomeB), 'it');
+  });
+  return risultato;
+}
+
+/**
+ * Opzioni per il select categoria (senza DOM).
+ * @param {Array<object>|null|undefined} categorie
+ * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
+ * @returns {Array<{ value: string, text: string }>}
+ */
+export function opzioniSelectCategorieColture(categorie, colturePerCategoria) {
+  return dedupeCategorieColture(categorie, colturePerCategoria).map((cat) => ({
+    value: cat.id != null ? String(cat.id) : '',
+    text: cat.nome != null ? String(cat.nome) : String(cat.id || ''),
+  }));
+}
+
+/**
+ * Crea un'option. Accetta un factory opzionale per i test senza DOM.
+ * @param {string} value
+ * @param {string} text
+ * @param {((tag: string) => { value: string, textContent: string })|null} createElement
+ */
+function creaOption(value, text, createElement) {
+  if (typeof createElement === 'function') {
+    const option = createElement('option');
+    option.value = value;
+    option.textContent = text;
+    return option;
+  }
+  if (typeof document !== 'undefined' && document.createElement) {
+    const option = document.createElement('option');
+    option.value = value;
+    option.textContent = text;
+    return option;
+  }
+  return { value, textContent: text };
+}
+
+/**
+ * Popola il select categorie con dedupe. Conserva il value corrente se ancora valido.
+ * @param {{ innerHTML?: string, value?: string, appendChild?: Function }|null|undefined} selectEl
+ * @param {Array<object>|null|undefined} categorie
+ * @param {Record<string, unknown[]>|null|undefined} colturePerCategoria
+ * @param {{ placeholder?: string, messaggioErrore?: string|null, createElement?: Function }} [opts]
+ * @returns {Array<object>} categorie mostrate (vuoto se messaggioErrore)
+ */
+export function popolaSelectCategorieColture(selectEl, categorie, colturePerCategoria, opts = {}) {
+  const deduped = dedupeCategorieColture(categorie, colturePerCategoria);
+  if (!selectEl) return deduped;
+
+  const placeholder = opts.placeholder != null ? opts.placeholder : '-- Seleziona categoria --';
+  const messaggioErrore = opts.messaggioErrore != null ? opts.messaggioErrore : null;
+  const createElement = opts.createElement || null;
+  const previous = selectEl.value || '';
+
+  selectEl.innerHTML = '';
+
+  const append = (opt) => {
+    if (typeof selectEl.appendChild === 'function') {
+      selectEl.appendChild(opt);
+    }
+  };
+
+  if (messaggioErrore) {
+    append(creaOption('', messaggioErrore, createElement));
+    selectEl.value = '';
+    return [];
+  }
+
+  append(creaOption('', placeholder, createElement));
+  for (const cat of deduped) {
+    append(
+      creaOption(
+        cat.id != null ? String(cat.id) : '',
+        cat.nome != null ? String(cat.nome) : '',
+        createElement
+      )
+    );
+  }
+
+  const ancoraPresente = deduped.some((c) => c.id != null && String(c.id) === previous);
+  selectEl.value = ancoraPresente ? previous : '';
+  return deduped;
+}
diff --git a/core/js/terreni-controller.js b/core/js/terreni-controller.js
index d44a4e9d..5cf4842b 100644
--- a/core/js/terreni-controller.js
+++ b/core/js/terreni-controller.js
@@ -356,17 +356,15 @@ export async function loadCategorieColtureTerreni(currentTenantId, db, app, auth
             categorieColtureTerreni.push(...categorie);
         }
 
-        // Popola dropdown categoria (se esiste)
-        const categoriaSelect = document.getElementById('terreno-coltura-categoria');
-        if (categoriaSelect) {
-            categoriaSelect.innerHTML = '<option value="">-- Seleziona categoria --</option>';
-            categorieColtureTerreni.forEach(cat => {
-                const option = document.createElement('option');
-                option.value = cat.id;
-                option.textContent = cat.nome;
-                categoriaSelect.appendChild(option);
-            });
-        }
+        // Popola dropdown categoria con dedupe (le colture possono non essere ancora caricate)
+        const deduped = dedupeCategorieColture(categorieColtureTerreni, null);
+        categorieColtureTerreni.length = 0;
+        categorieColtureTerreni.push(...deduped);
+        popolaSelectCategorieColture(
+            document.getElementById('terreno-coltura-categoria'),
+            categorieColtureTerreni,
+            null
+        );
     } catch (error) {
         console.error('Errore caricamento categorie colture:', error);
     }
@@ -380,8 +378,9 @@ export async function loadCategorieColtureTerreni(currentTenantId, db, app, auth
  * @param {Object} auth - Istanza Firebase Auth
  * @param {Object} colturePerCategoriaTerreni - Oggetto {categoriaId: [colture]} (modificato in place)
  * @param {Array} colture - Array colture (modificato in place, per retrocompatibilità)
+ * @param {Array|null} [categorieColtureTerreni=null] - Categorie già caricate (per ripopolare il select dopo seed)
  */
-export async function loadColturePerCategoriaTerreni(currentTenantId, db, app, auth, colturePerCategoriaTerreni, colture) {
+export async function loadColturePerCategoriaTerreni(currentTenantId, db, app, auth, colturePerCategoriaTerreni, colture, categorieColtureTerreni = null) {
     try {
         if (!currentTenantId) return;
 
@@ -487,16 +486,28 @@ export async function loadColturePerCategoriaTerreni(currentTenantId, db, app, a
             coltureList.forEach(c => colture.push(c.nome));
         });
 
-        // Non popolare direttamente il dropdown, sarà popolato quando si seleziona una categoria
-        // Aggiorna il dropdown se c'è già una categoria selezionata
+        // Dopo seed/caricamento: ripopola il select categorie con dedupe usando le colture note
+        if (Array.isArray(categorieColtureTerreni)) {
+            const deduped = dedupeCategorieColture(categorieColtureTerreni, colturePerCategoriaTerreni);
+            categorieColtureTerreni.length = 0;
+            categorieColtureTerreni.push(...deduped);
+            popolaSelectCategorieColture(
+                document.getElementById('terreno-coltura-categoria'),
+                categorieColtureTerreni,
+                colturePerCategoriaTerreni
+            );
+        }
+
+        // Aggiorna il dropdown colture se c'è già una categoria selezionata
         const categoriaSelect = document.getElementById('terreno-coltura-categoria');
         if (categoriaSelect && categoriaSelect.value && window.updateColtureDropdownTerreni) {
             window.updateColtureDropdownTerreni();
         }
     } catch (error) {
         console.error('Errore caricamento colture:', error);
-        // Fallback: usa ListePersonalizzate se colture non disponibile
+        // Fallback: liste piatte — NON lasciare select categorie piene con mappa colture vuota
         console.warn('Impossibile caricare da colture, uso ListePersonalizzate:', error.message);
+        Object.keys(colturePerCategoriaTerreni).forEach(key => delete colturePerCategoriaTerreni[key]);
         const { doc, getDoc } = await import('../services/firebase-service.js');
         const listeRef = doc(db, `tenants/${currentTenantId}/liste`, 'personalizzate');
         const listeSnap = await getDoc(listeRef);
@@ -506,15 +517,21 @@ export async function loadColturePerCategoriaTerreni(currentTenantId, db, app, a
             colture.length = 0;
             colture.push(...(data.colture || []));
         } else {
-            // Se non esistono, usa predefinite
             colture.length = 0;
             colture.push('Vite', 'Frutteto', 'Seminativo', 'Orto', 'Prato', 'Olivo', 'Agrumeto', 'Bosco');
         }
-        
-        // Non popolare direttamente il dropdown, sarà popolato quando si seleziona una categoria
-        const categoriaSelect = document.getElementById('terreno-coltura-categoria');
-        if (categoriaSelect && categoriaSelect.value && window.updateColtureDropdownTerreni) {
-            window.updateColtureDropdownTerreni();
+
+        popolaSelectCategorieColture(
+            document.getElementById('terreno-coltura-categoria'),
+            Array.isArray(categorieColtureTerreni) ? categorieColtureTerreni : [],
+            colturePerCategoriaTerreni,
+            {
+                messaggioErrore: '-- Errore caricamento colture: riprova o ricarica la pagina --',
+            }
+        );
+        if (Array.isArray(categorieColtureTerreni)) {
+            // Non fingere che le categorie orfane funzionino: svuota lo stato categorie del form
+            categorieColtureTerreni.length = 0;
         }
     }
 }
@@ -531,13 +548,35 @@ export async function loadColturePerCategoriaTerreni(currentTenantId, db, app, a
  */
 export async function loadColture(currentTenantId, db, app, auth, categorieColtureTerreni, colturePerCategoriaTerreni, colture) {
     await loadCategorieColtureTerreni(currentTenantId, db, app, auth, categorieColtureTerreni);
-    await loadColturePerCategoriaTerreni(currentTenantId, db, app, auth, colturePerCategoriaTerreni, colture);
+    await loadColturePerCategoriaTerreni(
+        currentTenantId, db, app, auth, colturePerCategoriaTerreni, colture, categorieColtureTerreni
+    );
+    // Ripopola a fine carico se le categorie ci sono ancora (dopo catch di fallback
+    // categorieColtureTerreni è vuoto e il select mostra già il messaggio di errore).
+    if (Array.isArray(categorieColtureTerreni) && categorieColtureTerreni.length > 0) {
+        const deduped = dedupeCategorieColture(categorieColtureTerreni, colturePerCategoriaTerreni);
+        categorieColtureTerreni.length = 0;
+        categorieColtureTerreni.push(...deduped);
+        popolaSelectCategorieColture(
+            document.getElementById('terreno-coltura-categoria'),
+            categorieColtureTerreni,
+            colturePerCategoriaTerreni
+        );
+        const categoriaSelect = document.getElementById('terreno-coltura-categoria');
+        if (categoriaSelect && categoriaSelect.value && window.updateColtureDropdownTerreni) {
+            window.updateColtureDropdownTerreni();
+        }
+    }
 }
 
 // ============================================
 // IMPORTS UTILITY
 // ============================================
 import { escapeHtml, calcolaAlertAffitto, formattaDataScadenza, showAlert } from './terreni-utils.js';
+import {
+    dedupeCategorieColture,
+    popolaSelectCategorieColture,
+} from './terreni-categorie-colture.js';
 
 // ============================================
 // FUNZIONI PRINCIPALI
diff --git a/core/services/categorie-service.js b/core/services/categorie-service.js
index 800de3da..c0f5a037 100644
--- a/core/services/categorie-service.js
+++ b/core/services/categorie-service.js
@@ -39,7 +39,25 @@ export async function initializeCategoriePredefinite() {
       throw new Error('Nessun tenant corrente disponibile');
     }
     
-    const categorieEsistenti = await getAllCategorie();
+    let categorieEsistenti = await getAllCategorie();
+    // Evita re-seed silenzioso se getAllCategorie torna [] per filtri/indici:
+    // secondo tentativo grezzo senza where/orderBy.
+    if (!Array.isArray(categorieEsistenti) || categorieEsistenti.length === 0) {
+      try {
+        const tenantIdRaw = getCurrentTenantId();
+        const grezzi = await getCollectionData(COLLECTION_NAME, { tenantId: tenantIdRaw });
+        if (Array.isArray(grezzi) && grezzi.length > 0) {
+          categorieEsistenti = grezzi.map(doc => Categoria.fromData(doc));
+          console.warn(
+            'initializeCategoriePredefinite: getAllCategorie vuoto, uso lettura grezza (' +
+              categorieEsistenti.length +
+              ' doc)'
+          );
+        }
+      } catch (rawErr) {
+        console.warn('initializeCategoriePredefinite: lettura grezza fallita:', rawErr && rawErr.message);
+      }
+    }
     const codiciEsistenti = new Set(categorieEsistenti.map(c => c.codice));
     const categorieMap = new Map(); // codice -> id
     
diff --git a/tests/moduli-identificatori-definiti.test.js b/tests/moduli-identificatori-definiti.test.js
index 917b8745..5ac86369 100644
--- a/tests/moduli-identificatori-definiti.test.js
+++ b/tests/moduli-identificatori-definiti.test.js
@@ -20,6 +20,7 @@ const MODULI = [
   'core/js/dashboard-meteo.js',
   'core/js/dashboard-quick-bar.js',
   'core/js/lavoro-progresso-display.js',
+  'core/js/terreni-categorie-colture.js',
   'core/admin/js/gestione-lavori-controller.js',
   'core/admin/js/gestione-lavori-maps.js',
   'core/services/zone-lavorate-area.js',
diff --git a/tests/terreni-categorie-colture.test.js b/tests/terreni-categorie-colture.test.js
new file mode 100644
index 00000000..26313e0b
--- /dev/null
+++ b/tests/terreni-categorie-colture.test.js
@@ -0,0 +1,174 @@
+/**
+ * Deduplica categorie coltura omonime nel form terreno.
+ * Bug: seed può creare doc stesso nome/codice con id diversi; la prima copia
+ * nel select non ha colture («Nessuna coltura disponibile»), la seconda sì.
+ */
+import { describe, it, expect } from 'vitest';
+import {
+  chiaveDedupeCategoria,
+  conteggioColtureCategoria,
+  confrontaCategorieDuplicate,
+  dedupeCategorieColture,
+  opzioniSelectCategorieColture,
+  popolaSelectCategorieColture,
+} from '../core/js/terreni-categorie-colture.js';
+
+function fakeSelect(initialValue = '') {
+  const options = [];
+  return {
+    options,
+    value: initialValue,
+    set innerHTML(_html) {
+      options.length = 0;
+    },
+    get innerHTML() {
+      return options.map((o) => `<option value="${o.value}">${o.textContent}</option>`).join('');
+    },
+    appendChild(opt) {
+      options.push(opt);
+      return opt;
+    },
+  };
+}
+
+const createElement = () => ({ value: '', textContent: '' });
+
+describe('chiaveDedupeCategoria', () => {
+  it('preferisce il codice normalizzato', () => {
+    expect(chiaveDedupeCategoria({ codice: ' Vite ', nome: 'Altro' })).toBe('c:vite');
+  });
+
+  it('usa il nome se manca il codice', () => {
+    expect(chiaveDedupeCategoria({ nome: ' Frutteto ' })).toBe('n:frutteto');
+  });
+});
+
+describe('dedupeCategorieColture', () => {
+  const orfana = {
+    id: 'id-orfana',
+    nome: 'Vite',
+    codice: 'vite',
+    predefinita: true,
+    ordine: 3,
+  };
+  const conColture = {
+    id: 'id-buona',
+    nome: 'Vite',
+    codice: 'vite',
+    predefinita: true,
+    ordine: 3,
+  };
+  const altra = {
+    id: 'id-frutteto',
+    nome: 'Frutteto',
+    codice: 'frutteto',
+    predefinita: true,
+    ordine: 1,
+  };
+
+  it('con due doc stesso codice tiene quella che ha colture', () => {
+    const colturePerCategoria = {
+      'id-buona': [{ id: 'c1', nome: 'Chardonnay' }],
+    };
+    const out = dedupeCategorieColture([orfana, conColture, altra], colturePerCategoria);
+    expect(out.map((c) => c.id)).toEqual(['id-frutteto', 'id-buona']);
+  });
+
+  it('senza mappa colture preferisce predefinita poi ordine', () => {
+    const a = { id: 'a', nome: 'Vite', codice: 'vite', predefinita: false, ordine: 1 };
+    const b = { id: 'b', nome: 'Vite', codice: 'vite', predefinita: true, ordine: 9 };
+    const out = dedupeCategorieColture([a, b], {});
+    expect(out).toHaveLength(1);
+    expect(out[0].id).toBe('b');
+  });
+
+  it('dedupe anche per nome se manca codice', () => {
+    const a = { id: 'x1', nome: 'Orto', ordine: 2 };
+    const b = { id: 'x2', nome: 'Orto', ordine: 1 };
+    const out = dedupeCategorieColture([a, b], { x1: [{ nome: 'Pomodoro' }] });
+    expect(out).toHaveLength(1);
+    expect(out[0].id).toBe('x1');
+  });
+});
+
+describe('confrontaCategorieDuplicate / conteggio', () => {
+  it('conteggioColtureCategoria legge la mappa', () => {
+    expect(conteggioColtureCategoria({ id: 'a' }, { a: [1, 2] })).toBe(2);
+    expect(conteggioColtureCategoria({ id: 'a' }, {})).toBe(0);
+  });
+
+  it('preferisce chi ha colture', () => {
+    const a = { id: 'a', predefinita: true, ordine: 1 };
+    const b = { id: 'b', predefinita: false, ordine: 99 };
+    const map = { b: [{ nome: 'x' }] };
+    expect(confrontaCategorieDuplicate(b, a, map)).toBeLessThan(0);
+  });
+});
+
+describe('popolaSelectCategorieColture', () => {
+  it('nel select resta solo la categoria con colture (stesso codice)', () => {
+    const select = fakeSelect();
+    const categorie = [
+      { id: 'orfana', nome: 'Vite', codice: 'vite', ordine: 3, predefinita: true },
+      { id: 'buona', nome: 'Vite', codice: 'vite', ordine: 3, predefinita: true },
+      { id: 'frutteto', nome: 'Frutteto', codice: 'frutteto', ordine: 1, predefinita: true },
+    ];
+    const colturePerCategoria = {
+      buona: [{ id: 'c1', nome: 'Chardonnay' }],
+    };
+
+    const shown = popolaSelectCategorieColture(select, categorie, colturePerCategoria, {
+      createElement,
+    });
+
+    expect(shown.map((c) => c.id)).toEqual(['frutteto', 'buona']);
+    const values = select.options.map((o) => o.value).filter(Boolean);
+    expect(values).toEqual(['frutteto', 'buona']);
+    expect(select.options.some((o) => o.value === 'orfana')).toBe(false);
+  });
+
+  it('dopo «seed» simulato il select si aggiorna dalla copia orfana a quella con colture', () => {
+    const select = fakeSelect('orfana');
+    const categorie = [
+      { id: 'orfana', nome: 'Vite', codice: 'vite', ordine: 3, predefinita: true },
+      { id: 'buona', nome: 'Vite', codice: 'vite', ordine: 3, predefinita: true },
+    ];
+
+    // Prima del seed: nessuna coltura nota → resta una sola (predefinita/ordine/id)
+    popolaSelectCategorieColture(select, categorie, {}, { createElement });
+    expect(select.options.filter((o) => o.value).map((o) => o.value)).toHaveLength(1);
+
+    // Dopo seed: la copia «buona» ha colture → il select mostra quella
+    const dopoSeed = {
+      buona: [{ id: 'c1', nome: 'Chardonnay' }, { id: 'c2', nome: 'Merlot' }],
+    };
+    popolaSelectCategorieColture(select, categorie, dopoSeed, { createElement });
+    const values = select.options.filter((o) => o.value).map((o) => o.value);
+    expect(values).toEqual(['buona']);
+    expect(select.value).toBe(''); // previous «orfana» non è più tra le opzioni
+  });
+
+  it('con messaggioErrore non mostra categorie (fallback catch)', () => {
+    const select = fakeSelect();
+    const shown = popolaSelectCategorieColture(
+      select,
+      [{ id: 'a', nome: 'Vite', codice: 'vite' }],
+      {},
+      { messaggioErrore: '-- Errore caricamento colture --', createElement }
+    );
+    expect(shown).toEqual([]);
+    expect(select.options).toHaveLength(1);
+    expect(select.options[0].textContent).toContain('Errore');
+  });
+
+  it('opzioniSelectCategorieColture allinea value/text', () => {
+    const opts = opzioniSelectCategorieColture(
+      [
+        { id: '1', nome: 'A', codice: 'a', ordine: 2 },
+        { id: '2', nome: 'A', codice: 'a', ordine: 2 },
+      ],
+      { '1': [{ nome: 'x' }] }
+    );
+    expect(opts).toEqual([{ value: '1', text: 'A' }]);
+  });
+});
````

Poi:

```powershell
git apply --check fix-categorie-colture-duplicate.diff
git apply fix-categorie-colture-duplicate.diff
Remove-Item fix-categorie-colture-duplicate.diff
git status --short
```

Ti aspetti, oltre ai due non tracciati da ignorare:

```
 M core/js/terreni-controller.js
 M core/services/categorie-service.js
 M tests/moduli-identificatori-definiti.test.js
?? core/js/terreni-categorie-colture.js
?? tests/terreni-categorie-colture.test.js
```

Se `git apply --check` fallisce, NON applicare a mano. Prova una volta `git apply --check --ignore-whitespace fix-categorie-colture-duplicate.diff` solo per capire se il problema sono i fine riga (CRLF) del file salvato. Poi fermati e riportami l’errore esatto.

Controllo rapido che non sia stato toccato niente di vietato. Questo comando non deve stampare nulla:

```powershell
git status --short -- core/js/tony core/js/gfv-tony-loader.js functions firestore.rules modules/vigneto modules/frutteto modules/seminativo
```

### 3. Test (solo i file nuovi o toccati, uno per uno)

Se `node_modules` manca, prima esegui `npm ci`.

```powershell
npx vitest run tests/terreni-categorie-colture.test.js
npx vitest run tests/moduli-identificatori-definiti.test.js
```

Risultati attesi: **11** test superati nel primo file e **23** nel secondo. Il primo file copre:
- dedupe per codice e per nome;
- preferenza della copia con colture rispetto all’orfana;
- preferenza `predefinita` / ordine se la mappa colture è vuota;
- populate del select: restano solo le categorie non orfane;
- dopo «seed» simulato il select passa dalla copia orfana a quella con colture;
- con `messaggioErrore` (fallback catch) il select non mostra categorie false.

I fallimenti vitest noti su Windows e altri file NON riguardano questi due e non vanno considerati. Non lanciare altro. Chiudi eventuali processi vitest rimasti.

### 4. simulator/manifest.json

```powershell
git status --short simulator/manifest.json
```

Se risulta modificato:

```powershell
git checkout -- simulator/manifest.json
```

### 5. Cache PWA (SW_CACHE_BUILD_ID)

Il bump lo fa l’hook `.githooks/pre-commit`: esegue `node scripts/bump-pwa-cache-version.mjs`, cioè lo stesso script di `npm run bump:pwa-cache`, e poi `git add service-worker.js`. Controlla che l’hook sia attivo:

```powershell
git config --get core.hooksPath
```

- Se stampa `.githooks`, non fare nulla: al commit l’hook aggiorna e aggiunge `service-worker.js` da solo. NON lanciare anche `npm run bump:pwa-cache`.
- Se non stampa nulla, l’hook non è attivo. In questo caso, e solo in questo, esegui prima del commit:

```powershell
npm run bump:pwa-cache
git add service-worker.js
```

### 6. Commit (solo i file toccati, elencati)

```powershell
git add core/js/terreni-categorie-colture.js core/js/terreni-controller.js core/services/categorie-service.js tests/terreni-categorie-colture.test.js tests/moduli-identificatori-definiti.test.js
git commit -m "Fix form terreno: dedupe categorie coltura omonime (preferisci quella con colture) e messaggio chiaro sul fallback"
git show --stat HEAD
```

In `git show --stat` ti aspetti i 5 file sopra più `service-worker.js` (una riga, il bump dell’hook). Nient’altro.

### 7. Push e PR in BOZZA verso develop (nessun merge)

```powershell
git push -u origin fix/categorie-colture-duplicate
gh pr create --draft --base develop --head fix/categorie-colture-duplicate --title "Fix form terreno: categorie coltura duplicate (dedupe + ripopolo dopo seed)" --body "Su tenant nuovi il form Terreni mostrava Categoria Coltura duplicate (stesso nome, id Firestore diversi): la prima copia lasciava Coltura vuota («Nessuna coltura disponibile»), la seconda funzionava. Causa: seed omonimo + select senza dedupe + colture legate solo all’id seed riuscito; loadColture popolava le categorie prima delle colture. Fix: helper puro terreni-categorie-colture.js (dedupe per codice/nome, preferenza copia con colture), ripopolo select a fine loadColture e dopo seed, catch del fallback liste/personalizzate con messaggio chiaro (niente select categorie piene e mappa colture vuota), secondo tentativo di lettura grezza in initializeCategoriePredefinite se getAllCategorie torna []. Nessuna cancellazione Firestore, nessun tocco a tony/, gfv-tony-loader, functions, firestore.rules, moduli coltura. Test: tests/terreni-categorie-colture.test.js (11) e tests/moduli-identificatori-definiti.test.js (23), puri, senza emulatori."
```

NON fare merge. Riportami il link della PR.

### 8. Cosa riportarmi

- l’esito di `git apply --check`;
- l’output finale dei due `npx vitest run`;
- il `git show --stat HEAD`;
- se `simulator/manifest.json` è stato ripristinato;
- il valore di `core.hooksPath`;
- il link della PR in bozza.

## Dopo il merge su main

Il merge su develop e la promozione su main li decido io. Quando la modifica sarà su `main`, verifica in una COPIA SEPARATA del repo allineata a `main`. Non fare mai checkout di `main` nella cartella di lavoro. Dalla cartella del repo:

```powershell
git fetch origin
git worktree add ..\gfv-verifica-main origin/main
Set-Location ..\gfv-verifica-main
Select-String -Path core\js\terreni-controller.js -Pattern "popolaSelectCategorieColture","dedupeCategorieColture"
Select-String -Path core\services\categorie-service.js -Pattern "lettura grezza"
Test-Path core\js\terreni-categorie-colture.js
npm ci
npx vitest run tests/terreni-categorie-colture.test.js
Set-Location ..\gfv-platform
git worktree remove ..\gfv-verifica-main
```

Se la cartella del repo non si chiama `gfv-platform`, adatta l’ultimo `Set-Location`. Cosa ti aspetti:
- la prima ricerca trova almeno 2 righe (import/uso);
- la seconda trova il warn della lettura grezza;
- `Test-Path` stampa `True`;
- vitest dà 11 test superati.

Dopo il deploy, prova a mano su un tenant nuovo (o Cascina Conti) sul form Terreni:
- in **Categoria Coltura** ogni nome appare una sola volta;
- scegliendo quella categoria, **Coltura** elenca le colture (niente «Nessuna coltura disponibile» sulla copia buona).
