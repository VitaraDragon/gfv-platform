/**
 * Se Tony dice «Tutto pronto», nel testo ci sono il nome del lavoro e la data.
 * @param {import('@playwright/test').Expect} expect
 * @param {string} reply
 * @param {string} nomeAtteso
 */
export function assertSeTuttoProntoHaNome(expect, reply, nomeAtteso) {
  const testo = String(reply || '');
  if (!/Tutto pronto/i.test(testo)) return;
  expect(testo).toContain(nomeAtteso);
  expect(testo).toMatch(/\b(?:oggi|ieri)\s+\d{1,2}\/\d{1,2}\b|\bil\s+\d{1,2}\/\d{1,2}\b/);
}
