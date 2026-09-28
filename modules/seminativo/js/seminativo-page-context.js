/**
 * Canone Tony per le pagine Seminativo: currentTableData + merge page + table-data-ready.
 * @module modules/seminativo/js/seminativo-page-context
 */

export function publishSeminativoTableData(tableData) {
  const payload = tableData && typeof tableData === 'object'
    ? tableData
    : { pageType: 'seminativo', summary: 'Caricamento dati in corso...', items: [] };

  window.currentTableData = payload;

  const page = (window.Tony && window.Tony.context && window.Tony.context.page) || {};
  if (window.Tony && typeof window.Tony.setContext === 'function') {
    window.Tony.setContext('page', Object.assign({}, page, {
      tableDataSummary: payload.summary,
      currentTableData: payload
    }));
  }

  window.dispatchEvent(new CustomEvent('table-data-ready', {
    detail: { currentTableData: payload }
  }));
}

export function placeholderTableData(pageType, summary) {
  return {
    pageType: pageType || 'seminativo',
    summary: summary || 'Scheletro modulo: dati in arrivo nelle prossime fasi.',
    items: []
  };
}
