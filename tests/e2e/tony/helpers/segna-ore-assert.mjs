/**
 * Se Tony dice «Tutto pronto», nel testo ci deve essere il nome del lavoro.
 * @param {import('@playwright/test').Expect} expect
 * @param {string} reply
 * @param {string} nomeAtteso
 */
export function assertSeTuttoProntoHaNome(expect, reply, nomeAtteso) {
  const testo = String(reply || '');
  if (!/Tutto pronto/i.test(testo)) return;
  expect(testo).toContain(nomeAtteso);
}
