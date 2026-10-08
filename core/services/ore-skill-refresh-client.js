/**
 * Chiede il ricalcolo delle stelline solo se chi agisce è manager o amministratore.
 * Il caposquadra non scrive profiliManodopera: le regole lo vietano.
 *
 * @module core/services/ore-skill-refresh-client
 */

import { deveRichiedereRefreshSkill } from './ore-operai-logic.js';

/**
 * @param {{ tenantId?: string, operaioId?: string, userId?: string, isManager?: boolean }} args
 * @returns {Promise<boolean>} true se la richiesta è partita
 */
export async function chiediRefreshSkillOreValidate(args) {
  const { tenantId, operaioId, userId, isManager } = args || {};
  if (!deveRichiedereRefreshSkill(isManager) || !operaioId || !tenantId || !userId) return false;
  const { requestSkillCalcolateRefresh } = await import('./profilo-manodopera-skill-auto-refresh.js');
  requestSkillCalcolateRefresh(tenantId, operaioId, userId);
  return true;
}
