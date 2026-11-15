/**
 * I test non chiamano la produzione.
 * Cloud Functions: 503 subito. esm.sh (firebase/ai): stub che fa usare il fallback già previsto,
 * senza scaricare l'albero di dipendenze.
 * @param {import('playwright-core').BrowserContext} context
 * @param {{ blockCloudFunctions?: boolean }} [opts]
 */
export async function blockExternalTestNetwork(context, opts = {}) {
  const blockCloudFunctions = opts.blockCloudFunctions !== false;
  if (blockCloudFunctions) {
    await context.route(/https:\/\/[^/]*cloudfunctions\.net\//i, (route) => route.fulfill({
      status: 503,
      contentType: 'text/plain',
      body: 'e2e: cloud functions bloccate',
    }));
  }
  await context.route(/https:\/\/esm\.sh\//i, (route) => route.fulfill({
    status: 200,
    contentType: 'application/javascript; charset=utf-8',
    body: [
      'export function getAI(){ throw new Error("Service AI is not available"); }',
      'export function getGenerativeModel(){ return null; }',
      'export class GoogleAIBackend {}',
      '',
    ].join('\n'),
  }));
}
