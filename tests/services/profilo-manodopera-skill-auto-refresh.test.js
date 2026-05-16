/**
 * @vitest-environment node
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestSkillCalcolateRefresh } from '../../core/services/profilo-manodopera-skill-auto-refresh.js';

vi.mock('../../core/services/profilo-manodopera-skill-batch-service.js', () => ({
  recalculateSkillCalcolateForOperaio: vi.fn().mockResolvedValue({ oreProcessate: 2, skillCount: 1 })
}));

describe('profilo-manodopera-skill-auto-refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('debounce: una sola chiamata batch dopo validazioni ravvicinate', async () => {
    const { recalculateSkillCalcolateForOperaio } = await import(
      '../../core/services/profilo-manodopera-skill-batch-service.js'
    );

    requestSkillCalcolateRefresh('t1', 'u1', 'admin1');
    requestSkillCalcolateRefresh('t1', 'u1', 'admin1');
    requestSkillCalcolateRefresh('t1', 'u1', 'admin1');

    expect(recalculateSkillCalcolateForOperaio).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2600);

    expect(recalculateSkillCalcolateForOperaio).toHaveBeenCalledTimes(1);
    expect(recalculateSkillCalcolateForOperaio).toHaveBeenCalledWith({
      tenantId: 't1',
      operaioId: 'u1',
      aggiornatoDa: 'admin1'
    });
  });
});
