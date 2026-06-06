/**
 * Parser SSE Tony (eventi chunk / done / error).
 * @param {string} raw
 * @param {{ onChunk?: (delta: string) => void, onDone?: (payload: object) => void, onError?: (err: Error) => void }} handlers
 * @returns {{ done: object|null, hadEvents: boolean }}
 */
export function parseTonySseStream(raw, handlers = {}) {
  const onChunk = typeof handlers.onChunk === 'function' ? handlers.onChunk : null;
  const onDone = typeof handlers.onDone === 'function' ? handlers.onDone : null;
  const onError = typeof handlers.onError === 'function' ? handlers.onError : null;

  let donePayload = null;
  let hadEvents = false;
  const text = String(raw || '');
  if (!text.trim()) {
    return { done: null, hadEvents: false };
  }

  const blocks = text.split(/\n\n/);
  for (const block of blocks) {
    if (!block || !block.trim() || block.trim().startsWith(':')) continue;

    const lines = block.split('\n');
    let eventName = 'message';
    let dataLine = '';
    for (const line of lines) {
      const normalized = line.replace(/\r$/, '');
      if (normalized.startsWith('event:')) eventName = normalized.slice(6).trim();
      else if (normalized.startsWith('data:')) dataLine += normalized.slice(5).trim();
    }
    if (!dataLine) continue;
    hadEvents = true;

    let parsed;
    try {
      parsed = JSON.parse(dataLine);
    } catch (parseErr) {
      if (eventName === 'error' || eventName === 'done') {
        const err = new Error('SSE Tony: payload JSON non valido');
        if (onError) onError(err);
        else throw err;
      }
      continue;
    }

    if (eventName === 'chunk' && parsed.delta != null && onChunk) {
      onChunk(String(parsed.delta));
    } else if (eventName === 'done') {
      donePayload = parsed;
      if (onDone) onDone(parsed);
    } else if (eventName === 'error') {
      const err = new Error(parsed.message || 'Errore stream Tony');
      if (onError) onError(err);
      else throw err;
    }
  }

  return { done: donePayload, hadEvents };
}
