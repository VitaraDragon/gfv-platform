/**
 * Path condivisi per view standalone.
 * Wrapper di `core/services/path-resolver.js`: le pagine importano da qui
 * e non ridefiniscono getBasePath / resolvePath.
 *
 * @see docs-sviluppo/da-fare/snellimento/PROPOSTA_SNELLIMENTO_E_OTTIMIZZAZIONE_CODICE.md §2.3
 * @module core/js/gfv-path
 */

import {
    getBasePath,
    resolvePath as resolveFsPath,
    resolveImportPath,
    dynamicImport
} from '../services/path-resolver.js';

export { getBasePath, resolveFsPath, resolveImportPath, dynamicImport };

/** Alias usato dalle view (import dinamici verso core / moduli). */
export const resolvePath = resolveImportPath;
