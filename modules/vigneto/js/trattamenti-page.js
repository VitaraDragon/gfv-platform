/**
 * Pagina Trattamenti vigneto.
 * L'HTML in views/ resta la struttura. La meccanica condivisa sta in
 * shared/js/trattamenti-coltura-page.js. Servizi e testi restano di questo modulo.
 * @module modules/vigneto/js/trattamenti-page
 */

import { mountTrattamentiColturaPage } from '../../../shared/js/trattamenti-coltura-page.js';

mountTrattamentiColturaPage({
    bootstrapTag: 'trattamenti',
    logTag: '[TRATTAMENTI-VIGNETO]',
    tonyLog: '[Vigneto Trattamenti]',
    servicePath: '../services/trattamenti-vigneto-service.js',
    anagraficaPath: '../services/vigneti-service.js',
    listExport: 'getAllVigneti',
    perMethod: 'getLavoriAttivitaTrattamentiPerVigneto',
    tuttiMethod: 'getLavoriAttivitaTrattamentiTuttiVigneti',
    idKey: 'vignetoId',
    nomeKey: 'vignetoNome',
    filterId: 'filter-vigneto',
    selectId: 'trattamento-vigneto',
    hiddenId: 'trattamento-vigneto-id',
    filterAllLabel: 'Tutti i vigneti',
    selectPlaceholder: 'Seleziona vigneto',
    alertSelect: 'Seleziona un vigneto',
    alertNoTerreno: 'Vigneto senza terreno associato',
    alertMissing: 'Vigneto mancante',
    alertNotFound: 'Trattamento creato ma non trovato per questo vigneto',
    alertPrevNotFound: 'Trattamento precedente non trovato in questo vigneto.',
    emptyFiltered: '<p>Nessun lavoro o attività fitosanitaria (categoria Trattamenti) per questo vigneto/anno. Crea un lavoro o un\'attività (Gestione lavori o Diario) con categoria Trattamenti su un terreno con vigneto.</p>',
    emptyYear: '<p>Nessun lavoro o attività fitosanitaria (categoria Trattamenti) per l\'anno selezionato. Crea un lavoro o un\'attività (Gestione lavori o Diario) con categoria Trattamenti su un terreno con vigneto.</p>',
    waitForTenant: true,
    optionLabel: (record) => record.varieta || record.nome || record.id
});
