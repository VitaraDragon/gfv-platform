/**
 * Pagina Trattamenti frutteto.
 * L'HTML in views/ resta la struttura. La meccanica condivisa sta in
 * shared/js/trattamenti-coltura-page.js. Servizi e testi restano di questo modulo.
 * @module modules/frutteto/js/trattamenti-page
 */

import { mountTrattamentiColturaPage } from '../../../shared/js/trattamenti-coltura-page.js';

mountTrattamentiColturaPage({
    bootstrapTag: 'trattamenti-frutteto',
    logTag: '[TRATTAMENTI-FRUTTETO]',
    tonyLog: '[Frutteto Trattamenti]',
    servicePath: '../services/trattamenti-frutteto-service.js',
    anagraficaPath: '../services/frutteti-service.js',
    listExport: 'getAllFrutteti',
    perMethod: 'getLavoriAttivitaTrattamentiPerFrutteto',
    tuttiMethod: 'getLavoriAttivitaTrattamentiTuttiFrutteti',
    idKey: 'fruttetoId',
    nomeKey: 'fruttetoNome',
    filterId: 'filter-frutteto',
    selectId: 'trattamento-frutteto',
    hiddenId: 'trattamento-frutteto-id',
    filterAllLabel: 'Tutti i frutteti',
    selectPlaceholder: 'Seleziona frutteto',
    alertSelect: 'Seleziona un frutteto',
    alertNoTerreno: 'Frutteto senza terreno associato',
    alertMissing: 'Frutteto mancante',
    alertNotFound: 'Trattamento creato ma non trovato per questo frutteto',
    alertPrevNotFound: 'Trattamento precedente non trovato in questo frutteto.',
    emptyFiltered: '<p>Nessun lavoro o attività fitosanitaria (categoria Trattamenti) per questo frutteto/anno. Crea un lavoro o un\'attività (Gestione lavori o Diario) con categoria Trattamenti su un terreno con frutteto.</p>',
    emptyYear: '<p>Nessun lavoro o attività fitosanitaria (categoria Trattamenti) per l\'anno selezionato. Crea un lavoro o un\'attività (Gestione lavori o Diario) con categoria Trattamenti su un terreno con frutteto.</p>',
    waitForTenant: false,
    optionLabel: (record) => record.specie || record.varieta || record.nome || record.id
});
