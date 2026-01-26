/**
 * Report Adapter - Vigneto (MVP)
 */

export const vignetoReportAdapter = {
  id: 'vigneto',
  name: 'Vigneto',
  icon: '🍇',

  /**
   * Filtri specifici vigneto per UI report.
   */
  async getFilters() {
    const { getAllVigneti } = await import('../../vigneto/services/vigneti-service.js');
    const vigneti = await getAllVigneti();

    const currentYear = new Date().getFullYear();
    const anni = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

    return {
      vigneti: Array.isArray(vigneti) ? vigneti : [],
      anni
    };
  },

  /**
   * Dati report: riepilogo + righe vendemmie + righe lavori.
   * @param {{ vignetoId?: string|null, anno?: number|null }} params
   */
  async getReportData(params = {}) {
    const vignetoId = params.vignetoId || null;
    const anno = params.anno || new Date().getFullYear();

    const {
      getStatisticheVigneto,
      getVendemmieRecenti,
      getLavoriVigneto
    } = await import('../../vigneto/services/vigneto-statistiche-service.js');

    const stats = await getStatisticheVigneto(vignetoId, anno);

    // Per MVP: vendemmie dell'anno (limit 200) e lavori completati (tutti)
    const vendemmie = await getVendemmieRecenti(vignetoId, anno, 200);
    const lavori = await getLavoriVigneto(vignetoId, anno, 'completato', null);

    return { stats, vendemmie, lavori, anno, vignetoId };
  }
};

