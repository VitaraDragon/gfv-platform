/**
 * @vitest-environment node
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('../../core/services/profilo-manodopera-skill-auto-refresh.js', () => ({
  requestSkillCalcolateRefresh: vi.fn()
}));

import { chiediRefreshSkillOreValidate } from '../../core/services/ore-skill-refresh-client.js';
import { requestSkillCalcolateRefresh } from '../../core/services/profilo-manodopera-skill-auto-refresh.js';

describe('chiediRefreshSkillOreValidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('il caposquadra non chiede il ricalcolo', async () => {
    const partito = await chiediRefreshSkillOreValidate({
      tenantId: 't1',
      operaioId: 'op1',
      userId: 'capo1',
      isManager: false
    });
    expect(partito).toBe(false);
    expect(requestSkillCalcolateRefresh).not.toHaveBeenCalled();
  });

  test('il manager chiede il ricalcolo', async () => {
    const partito = await chiediRefreshSkillOreValidate({
      tenantId: 't1',
      operaioId: 'op1',
      userId: 'mgr1',
      isManager: true
    });
    expect(partito).toBe(true);
    expect(requestSkillCalcolateRefresh).toHaveBeenCalledWith('t1', 'op1', 'mgr1');
  });
});
