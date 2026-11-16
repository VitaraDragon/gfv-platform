/**
 * Canone Tony per le pagine Orticole: currentTableData + merge page + table-data-ready.
 * @module modules/orticole/js/orticole-page-context
 */

export function publishOrticoleTableData(tableData) {
  const payload = tableData && typeof tableData === 'object'
    ? tableData
    : { pageType: 'orticole', summary: 'Caricamento dati in corso...', items: [] };

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
    pageType: pageType || 'orticole',
    summary: summary || 'Scheletro modulo: dati in arrivo nelle prossime fasi.',
    items: []
  };
}
