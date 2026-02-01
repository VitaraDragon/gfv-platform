/**
 * Varietà Frutteto Service - Servizio centralizzato per gestione varietà frutteto
 * Gestisce varietà per specie con supporto multi-tenant e cache
 * 
 * @module core/services/varieta-frutteto-service
 */

import { getCurrentTenantId } from './tenant-service.js';
import { getAllColture } from './colture-service.js';
import { getAllCategorie } from './categorie-service.js';

// Cache globale per varietà caricate
let varietaCache = null;
let specieFruttetoCache = null;

/**
 * Mappatura specie italiane -> nomi inglesi per API esterne
 */
const MAPPA_SPECIE_API = {
    'Melo': 'apple',
    'Pesco': 'peach',
    'Pero': 'pear',
    'Albicocco': 'apricot',
    'Ciliegio': 'cherry',
    'Susino': 'plum',
    'Kiwi': 'kiwi',
    'Fico': 'fig',
    'Nocciolo': 'hazelnut',
    'Castagno': 'chestnut',
    'Mandorlo': 'almond',
    'Arancio': 'orange',
    'Limone': 'lemon',
    'Mandarino': 'mandarin',
    'Clementine': 'clementine'
};

/**
 * Liste complete varietà per specie (italiane e internazionali)
 * Basate su varietà comuni e commerciali
 */
const VARIETA_PREDEFINITE_PER_SPECIE = {
    'Melo': [
        // Varietà italiane
        'Annurca', 'Renetta', 'Morgenduft', 'Golden Delicious', 'Stark Delicious',
        'Granny Smith', 'Fuji', 'Gala', 'Red Delicious', 'Braeburn', 'Pink Lady',
        'Cripps Pink', 'Jonagold', 'Elstar', 'Royal Gala', 'Fuji Kiku',
        // Varietà internazionali
        'Honeycrisp', 'McIntosh', 'Cortland', 'Empire', 'Idared', 'Rome Beauty',
        'Winesap', 'Stayman', 'York', 'Northern Spy', 'Cox Orange', 'Belle de Boskoop',
        'Gravenstein', 'Jonathan', 'Rome', 'Mutsu', 'Crispin'
    ],
    'Pesco': [
        // Varietà italiane
        'Springcrest', 'Maycrest', 'Redhaven', 'Suncrest', 'Fayette', 'Big Top',
        'Romea', 'Stark Red Gold', 'Elegant Lady', 'O\'Henry', 'Rich Lady',
        // Varietà internazionali
        'Elberta', 'Redhaven', 'Contender', 'Reliance', 'Belle of Georgia',
        'Cresthaven', 'Glohaven', 'Redskin', 'J.H. Hale', 'Babcock'
    ],
    'Pero': [
        // Varietà italiane
        'Abate Fetel', 'Kaiser', 'Conference', 'Williams', 'Decana del Comizio',
        'Passacrassana', 'Coscia', 'Spadona', 'Butirra', 'Santa Maria',
        // Varietà internazionali
        'Bartlett', 'Anjou', 'Bosc', 'Comice', 'Seckel', 'Forelle', 'Concorde',
        'Packham', 'Beurre Hardy', 'Doyenné du Comice'
    ],
    'Albicocco': [
        // Varietà italiane
        'Boccuccia', 'Pellecchiella', 'San Castrese', 'Reale d\'Imola',
        'Tyrinthos', 'Pisana', 'Portici',
        // Varietà internazionali
        'Blenheim', 'Moorpark', 'Tilton', 'Goldcot', 'Harcot', 'Harglow',
        'Perfection', 'Royal', 'Early Golden'
    ],
    'Ciliegio': [
        // Varietà italiane
        'Ferrovia', 'Bigarreau', 'Duroni', 'Mora di Cazzano', 'Burlat',
        'Giorgia', 'Lapins', 'Sweetheart', 'Van', 'Stella',
        // Varietà internazionali
        'Bing', 'Rainier', 'Lambert', 'Royal Ann', 'Black Tartarian',
        'Chelan', 'Skeena', 'Sweetheart', 'Tieton'
    ],
    'Susino': [
        // Varietà italiane
        'Stanley', 'Angeleno', 'President', 'Shiro', 'Santa Rosa',
        'Regina Claudia', 'Mirabelle', 'Sugar',
        // Varietà internazionali
        'Italian Prune', 'Damson', 'Greengage', 'Methley', 'Satsuma',
        'Beauty', 'Friar', 'Black Amber'
    ],
    'Kiwi': [
        'Hayward', 'Bruno', 'Monty', 'Tomuri', 'Matua', 'Soreli',
        'Jintao', 'Hort16A', 'Zespri Gold'
    ],
    'Fico': [
        // Varietà italiane
        'Dottato', 'Petrelli', 'San Pietro', 'Brogiotto Nero', 'Lampo',
        'Melanzana', 'Bianco del Cilento', 'Nero di Cosenza',
        // Varietà internazionali
        'Brown Turkey', 'Celeste', 'Mission', 'Kadota', 'Calimyrna',
        'Black Mission', 'Adriatic', 'LSU Purple'
    ],
    'Nocciolo': [
        // Varietà italiane
        'Tonda Gentile', 'Tonda di Giffoni', 'Tonda Romana', 'Nocchione',
        'Mortarella', 'San Giovanni', 'Camponica',
        // Varietà internazionali
        'Barcelona', 'Butler', 'Ennis', 'Hall\'s Giant', 'Jefferson',
        'Lewis', 'Tonda di Giffoni'
    ],
    'Castagno': [
        // Varietà italiane
        'Marrone', 'Marrone di Castel del Rio', 'Marrone di Marradi',
        'Marrone di San Zeno', 'Castagna di Montella', 'Castagna di Cuneo',
        // Varietà internazionali
        'Colossal', 'Bouche de Betizac', 'Marigoule', 'Marsol'
    ],
    'Mandorlo': [
        // Varietà italiane
        'Filippo Ceo', 'Tuono', 'Genco', 'Supernova', 'Ferraduel',
        'Ferragnès', 'Texas', 'Nonpareil',
        // Varietà internazionali
        'Carmel', 'Monterey', 'Butte', 'Padre', 'Mission', 'Ne Plus Ultra'
    ],
    'Arancio': [
        // Varietà italiane
        'Tarocco', 'Moro', 'Sanguinello', 'Valencia', 'Navel', 'Ovale',
        'Biondo Comune', 'Washington Navel',
        // Varietà internazionali
        'Hamlin', 'Pineapple', 'Temple', 'Blood Orange', 'Cara Cara'
    ],
    'Limone': [
        // Varietà italiane
        'Femminello', 'Eureka', 'Lisbon', 'Monachello', 'Interdonato',
        'Verna', 'Lunario',
        // Varietà internazionali
        'Meyer', 'Ponderosa', 'Yen Ben', 'Villa Franca', 'Genoa'
    ],
    'Mandarino': [
        // Varietà italiane
        'Tardivo di Ciaculli', 'Avana', 'Comune', 'Satsuma', 'Clementine',
        'Tangelo', 'Mapo',
        // Varietà internazionali
        'Dancy', 'Fairchild', 'Kara', 'Kinnow', 'Murcott'
    ],
    'Clementine': [
        'Comune', 'Nules', 'Oroval', 'Hernandina', 'Marisol', 'Clemenules',
        'Clementine di Calabria', 'Mandared'
    ],
    'Kaki': [
        'Fuyu', 'Hachiya', 'Sharon', 'Rojo Brillante', 'Tipo', 'Vaniglia',
        'Mercatelli', 'Loto di Romagna', 'Kaki di Misilmeri'
    ],
    'Melograno': [
        'Wonderful', 'Hicaz', 'Mollar de Elche', 'Dente di Cavallo',
        'Ragana', 'Acco', 'Parfianka'
    ],
    'Fico d\'India': [
        'Gialla', 'Rossa', 'Bianca', 'Sulfarina', 'Muscaredda', 'Sanguigna'
    ],
    'Mora': [
        'Thornless Evergreen', 'Chester', 'Triple Crown', 'Black Satin',
        'Loch Ness', 'Apache', 'Arapaho'
    ],
    'Lampone': [
        'Heritage', 'Tulameen', 'Glen Ample', 'Autumn Bliss', 'Polka',
        'Joan J', 'Glen Lyon'
    ],
    'Mirtillo': [
        'Bluecrop', 'Duke', 'Chandler', 'Legacy', 'Elliott', 'Jersey',
        'Patriot', 'Blueray'
    ],
    'Ribes': [
        'Rovada', 'Jonkheer van Tets', 'Red Lake', 'White Grape', 'Blackcurrant',
        'Ben Sarek', 'Ben Lomond'
    ]
};

/**
 * Ottieni tutte le specie frutteto disponibili
 * @returns {Promise<Array<string>>} Array di nomi specie
 */
export async function getSpecieFrutteto() {
    try {
        if (specieFruttetoCache) {
            return specieFruttetoCache;
        }

        const categorie = await getAllCategorie({ 
            applicabileA: 'colture',
            orderBy: 'ordine'
        });
        const categoriaFrutteto = categorie.find(c => c.codice === 'frutteto');
        
        if (!categoriaFrutteto) {
            console.warn('[VARIETA-FRUTTETO] Categoria frutteto non trovata');
            return [];
        }

        const tutteColture = await getAllColture({ 
            orderBy: 'nome',
            orderDirection: 'asc'
        });
        const coltureFrutteto = tutteColture.filter(c => c.categoriaId === categoriaFrutteto.id);
        
        specieFruttetoCache = coltureFrutteto.map(c => c.nome).filter(Boolean).sort();
        return specieFruttetoCache;
    } catch (error) {
        console.error('[VARIETA-FRUTTETO] Errore recupero specie:', error);
        return [];
    }
}

/**
 * Mappatura alias specie -> nome standard
 * Gestisce varianti comuni dei nomi delle specie (plurale/singolare)
 */
const ALIAS_SPECIE = {
    'Prugne': 'Susino',
    'Prugna': 'Susino',
    'Albicocche': 'Albicocco',
    'Albicocca': 'Albicocco',
    'Ciliege': 'Ciliegio',
    'Ciliegia': 'Ciliegio',
    'Mele': 'Melo',
    'Mela': 'Melo',
    'Pere': 'Pero',
    'Pera': 'Pero',
    'Pesche': 'Pesco',
    'Pesca': 'Pesco',
    'Fichi': 'Fico',
    'Fico d\'india': 'Fico d\'India',
    'Fichi d\'india': 'Fico d\'India',
    'Fichi d\'India': 'Fico d\'India'
};

/**
 * Normalizza il nome della specie gestendo alias e varianti
 * @param {string} specie - Nome della specie
 * @returns {string} Nome normalizzato
 */
function normalizzaSpecie(specie) {
    if (!specie) return '';
    
    // Rimuovi spazi extra e normalizza maiuscole/minuscole
    const specieTrim = specie.trim();
    const specieNormalizzata = specieTrim.charAt(0).toUpperCase() + specieTrim.slice(1).toLowerCase();
    
    // Verifica se c'è un alias
    if (ALIAS_SPECIE[specieNormalizzata]) {
        return ALIAS_SPECIE[specieNormalizzata];
    }
    
    return specieNormalizzata;
}

/**
 * Ottieni varietà per una specie specifica
 * @param {string} specie - Nome della specie (es. "Melo", "Pesco", "Prugne")
 * @returns {Promise<Array<string>>} Array di varietà ordinate alfabeticamente
 */
export async function getVarietaPerSpecie(specie) {
    if (!specie) return [];
    
    try {
        // Normalizza nome specie gestendo alias
        const specieNormalizzata = normalizzaSpecie(specie);
        
        console.log(`[VARIETA-FRUTTETO] Ricerca varietà per specie: "${specie}" -> normalizzata: "${specieNormalizzata}"`);
        
        // Ottieni varietà predefinite
        const varietaPredefinite = VARIETA_PREDEFINITE_PER_SPECIE[specieNormalizzata] || [];
        
        console.log(`[VARIETA-FRUTTETO] Varietà trovate: ${varietaPredefinite.length} per "${specieNormalizzata}"`);
        
        // Se non ci sono varietà predefinite, prova a cercare senza normalizzazione
        if (varietaPredefinite.length === 0) {
            // Prova anche con il nome originale (potrebbe essere già corretto)
            const varietaOriginale = VARIETA_PREDEFINITE_PER_SPECIE[specie.trim()] || [];
            if (varietaOriginale.length > 0) {
                console.log(`[VARIETA-FRUTTETO] Trovate varietà con nome originale: ${varietaOriginale.length}`);
                const tutteVarieta = [...new Set([...varietaOriginale, 'Altro'])].sort();
                return tutteVarieta;
            }
        }
        
        // Ottieni varietà personalizzate dal tenant (se implementato in futuro)
        // Per ora restituiamo solo quelle predefinite
        
        // Combina e ordina
        const tutteVarieta = [...new Set([...varietaPredefinite, 'Altro'])].sort();
        
        return tutteVarieta;
    } catch (error) {
        console.error(`[VARIETA-FRUTTETO] Errore recupero varietà per ${specie}:`, error);
        return ['Altro'];
    }
}

/**
 * Aggiungi una varietà personalizzata per una specie
 * @param {string} specie - Nome della specie
 * @param {string} varieta - Nome della varietà da aggiungere
 * @returns {Promise<boolean>} true se aggiunta con successo
 */
export async function addVarietaPersonalizzata(specie, varieta) {
    if (!specie || !varieta) return false;
    
    try {
        const tenantId = getCurrentTenantId();
        if (!tenantId) {
            throw new Error('Nessun tenant corrente disponibile');
        }
        
        // TODO: Implementare salvataggio in Firestore o localStorage
        // Per ora usiamo localStorage come fallback
        const key = `frutteto_varieta_${specie.toLowerCase().replace(/\s+/g, '_')}`;
        const varietaEsistenti = JSON.parse(localStorage.getItem(key) || '[]');
        
        if (!varietaEsistenti.includes(varieta)) {
            varietaEsistenti.push(varieta);
            localStorage.setItem(key, JSON.stringify(varietaEsistenti));
        }
        
        // Invalida cache
        varietaCache = null;
        
        return true;
    } catch (error) {
        console.error(`[VARIETA-FRUTTETO] Errore aggiunta varietà personalizzata:`, error);
        return false;
    }
}

/**
 * Ottieni varietà personalizzate per una specie (da localStorage)
 * @param {string} specie - Nome della specie (può essere originale o normalizzato)
 * @returns {Array<string>} Array di varietà personalizzate
 */
function getVarietaPersonalizzate(specie) {
    if (!specie) return [];
    
    try {
        // Normalizza specie per cercare in localStorage
        const specieNormalizzata = normalizzaSpecie(specie);
        
        // Prova prima con specie normalizzata, poi con originale
        const keys = [
            `frutteto_varieta_${specieNormalizzata.toLowerCase().replace(/\s+/g, '_')}`,
            `frutteto_varieta_${specie.toLowerCase().replace(/\s+/g, '_')}`
        ];
        
        for (const key of keys) {
            const varieta = JSON.parse(localStorage.getItem(key) || '[]');
            if (varieta.length > 0) {
                return varieta;
            }
        }
        
        return [];
    } catch (error) {
        console.warn(`[VARIETA-FRUTTETO] Errore lettura varietà personalizzate:`, error);
        return [];
    }
}

/**
 * Popola dropdown varietà per una specie
 * @param {string} selectId - ID del select element
 * @param {string} specie - Nome della specie
 */
export async function populateVarietaDropdown(selectId, specie) {
    try {
        const select = document.getElementById(selectId);
        if (!select) {
            console.warn(`[VARIETA-FRUTTETO] Select ${selectId} non trovato`);
            return;
        }
        
        if (!specie) {
            // Se nessuna specie selezionata, svuota dropdown
            select.innerHTML = '<option value="">Seleziona varietà</option>';
            return;
        }
        
        console.log(`[VARIETA-FRUTTETO] Popolamento dropdown varietà per specie: "${specie}"`);
        
        // Ottieni varietà predefinite e personalizzate
        const varietaPredefinite = await getVarietaPerSpecie(specie);
        const varietaPersonalizzate = getVarietaPersonalizzate(specie);
        
        console.log(`[VARIETA-FRUTTETO] Varietà predefinite: ${varietaPredefinite.length}, personalizzate: ${varietaPersonalizzate.length}`);
        
        // Combina e rimuovi duplicati
        const tutteVarieta = [...new Set([...varietaPredefinite, ...varietaPersonalizzate])].sort();
        
        console.log(`[VARIETA-FRUTTETO] Totale varietà da mostrare: ${tutteVarieta.length}`);
        
        // Salva il valore corrente se presente
        const valoreCorrente = select.value;
        
        // Svuota e ricrea dropdown
        select.innerHTML = '<option value="">Seleziona varietà</option>';
        
        // Aggiungi varietà
        tutteVarieta.forEach(varieta => {
            const option = document.createElement('option');
            option.value = varieta;
            option.textContent = varieta;
            select.appendChild(option);
        });
        
        // Ripristina il valore precedente se ancora valido
        if (valoreCorrente && tutteVarieta.includes(valoreCorrente)) {
            select.value = valoreCorrente;
        }
        
        console.log(`[VARIETA-FRUTTETO] Dropdown popolato con ${tutteVarieta.length} varietà`);
    } catch (error) {
        console.error(`[VARIETA-FRUTTETO] Errore popolamento dropdown:`, error);
        console.error(`[VARIETA-FRUTTETO] Stack:`, error.stack);
        // Fallback: almeno mostra "Altro"
        const select = document.getElementById(selectId);
        if (select) {
            select.innerHTML = '<option value="">Seleziona varietà</option><option value="Altro">Altro</option>';
        }
    }
}

/**
 * Invalida cache (utile dopo aggiunta/modifica varietà)
 */
export function invalidateCache() {
    varietaCache = null;
    specieFruttetoCache = null;
}
