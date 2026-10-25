"use strict";

/**
 * Estrazione tollerante di text/command dalle risposte Tony (JSON anche malformato).
 * Evita di mostrare in chat residui tipo text": "… o l'intero envelope grezzo.
 */

const { TONY_MAX_TOKENS_NOTICE } = require("./tony-gemini-api");

function stripJsonFences(s) {
  return String(s || "")
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, "$1")
    .trim();
}

function unescapeTonyJsonString(s) {
  return String(s || "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function splitMaxTokensNotice(raw) {
  const full = String(raw || "");
  const notice = TONY_MAX_TOKENS_NOTICE;
  const idx = full.indexOf(notice);
  if (idx < 0) return { body: full.trim(), noticeSuffix: "" };
  return {
    body: full.slice(0, idx).trim(),
    noticeSuffix: "\n\n" + notice,
  };
}

function looksLikeTonyJsonEnvelope(s) {
  const t = String(s || "").trim();
  if (!t) return false;
  if (/^\s*\{\s*"text"\s*:/i.test(t)) return true;
  if (/^\s*text"\s*:\s*"/i.test(t)) return true;
  if (/^\s*"text"\s*:\s*"/i.test(t)) return true;
  return false;
}

/**
 * Oggetto bilanciato a partire da `{` (rispetta stringhe ed escape).
 * @param {string} str
 * @param {number} startIdx indice di `{`
 * @returns {string|null}
 */
function extractBalancedObject(str, startIdx) {
  if (!str || startIdx < 0 || str[startIdx] !== "{") return null;
  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (esc) {
        esc = false;
        continue;
      }
      if (ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return str.slice(startIdx, i + 1);
    }
  }
  return null;
}

/**
 * Valore di "text": "..." anche con virgolette interne non escapate:
 * prende fino all'ULTIMA " seguita da \s*,\s*"(command|action|params)" oppure \s*}.
 * @param {string} s
 * @returns {string|null}
 */
function extractTextValueLoose(s) {
  const m = String(s || "").match(/"text"\s*:\s*"/);
  if (!m || m.index == null) return null;
  const start = m.index + m[0].length;
  const after = s.slice(start);
  let lastGood = -1;
  for (let i = 0; i < after.length; i++) {
    const ch = after[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch !== '"') continue;
    const rest = after.slice(i + 1);
    if (
      /^\s*,\s*"(?:command|action|params)"/.test(rest) ||
      /^\s*\}/.test(rest)
    ) {
      lastGood = i;
    }
  }
  if (lastGood >= 0) {
    return unescapeTonyJsonString(after.slice(0, lastGood));
  }
  // Troncato: niente chiusura riconosciuta
  let t = after.replace(/\s*[}\]]+\s*$/g, "").trim();
  t = t.replace(/\s*,\s*"(?:command|action|params)"[\s\S]*$/i, "").trim();
  return unescapeTonyJsonString(t) || null;
}

/**
 * "command": { … } completo via conteggio graffe + JSON.parse.
 * Fallimento → null (mai comandi parziali).
 * @param {string} s
 * @returns {object|null}
 */
function extractCommandLoose(s) {
  const src = String(s || "");
  const m = src.match(/"command"\s*:\s*/);
  if (!m || m.index == null) return null;
  let i = m.index + m[0].length;
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src.slice(i, i + 4) === "null") return null;
  if (src[i] !== "{") return null;
  const objStr = extractBalancedObject(src, i);
  if (!objStr) return null;
  try {
    const cmd = JSON.parse(objStr);
    if (cmd && typeof cmd === "object" && !Array.isArray(cmd)) {
      if (cmd.type && String(cmd.type).trim()) return cmd;
      if (cmd.action && String(cmd.action).trim()) return cmd;
    }
  } catch (_) {
    /* mai comando parziale */
  }
  return null;
}

function stripJsonResidueFallback(s) {
  let t = String(s || "").trim();
  t = t.replace(/^\s*\{\s*"text"\s*:\s*"/i, "");
  t = t.replace(/^\s*"text"\s*:\s*"/i, "");
  t = t.replace(/^\s*text"\s*:\s*"/i, "");
  t = t.replace(/"\s*,\s*"(?:command|action|params)"\s*:[\s\S]*$/i, "");
  t = t.replace(/"\s*\}\s*$/g, "");
  t = t.replace(/^\s*\{\s*/g, "").replace(/\s*\}\s*$/g, "");
  t = unescapeTonyJsonString(t).trim();
  if (looksLikeTonyJsonEnvelope(t)) {
    const again = extractTextValueLoose('{"text": "' + t);
    if (again) t = again;
  }
  return t;
}

/**
 * @param {string} raw
 * @returns {{ text: string, command: object|null }}
 */
function extractTonyTextLoose(raw) {
  const { body, noticeSuffix } = splitMaxTokensNotice(raw);
  let s = stripJsonFences(body);
  if (!s) {
    return { text: (noticeSuffix || "").trim() || "", command: null };
  }

  // JSON valido
  const tryStrict = (candidate) => {
    try {
      const p = JSON.parse(candidate);
      if (p && typeof p === "object" && typeof p.text === "string") {
        let cmd = null;
        if (p.command && typeof p.command === "object" && !Array.isArray(p.command)) {
          if (p.command.type || p.command.action) cmd = p.command;
        }
        const text = (String(p.text).trim() + noticeSuffix).trim();
        return { text: text || String(p.text), command: cmd };
      }
    } catch (_) {}
    return null;
  };

  let strict = tryStrict(s);
  if (strict) return strict;

  const jsonStart = s.search(/\{\s*"text"\s*:/);
  if (jsonStart >= 0) {
    strict = tryStrict(s.slice(jsonStart));
    if (strict) return strict;
  }

  const textVal = extractTextValueLoose(s);
  const command = extractCommandLoose(s);

  if (textVal != null && String(textVal).trim()) {
    return {
      text: (String(textVal).trim() + noticeSuffix).trim(),
      command,
    };
  }

  let cleaned = stripJsonResidueFallback(s);
  if (!cleaned || looksLikeTonyJsonEnvelope(cleaned)) {
    cleaned = cleaned && !looksLikeTonyJsonEnvelope(cleaned) ? cleaned : "";
  }
  if (!cleaned) cleaned = noticeSuffix ? "" : String(body).trim();
  cleaned = stripJsonResidueFallback(cleaned);
  if (looksLikeTonyJsonEnvelope(cleaned) || /^\s*\{/.test(cleaned)) {
    cleaned = "";
  }
  const text = (cleaned + noticeSuffix).trim();
  return { text: text || "Ok.", command: null };
}

/**
 * Post-process risposta non strutturata: mai lasciare JSON grezzo in text.
 * @param {string} rawText
 * @param {{ isTonyAdvancedActive?: boolean, parsed?: { text?: string, command?: object|null, action?: object } }} [opts]
 * @returns {{ text: string, command?: object, action?: object }}
 */
function postProcessTonyUnstructuredResponse(rawText, opts) {
  const options = opts || {};
  const isAdvanced = !!options.isTonyAdvancedActive;
  const parsed = options.parsed || null;
  const loose = extractTonyTextLoose(rawText);

  if (!isAdvanced) {
    return { text: loose.text || "Ok." };
  }

  if (parsed && typeof parsed === "object") {
    const currentText = String(parsed.text || "");
    const needsLoose =
      looksLikeTonyJsonEnvelope(currentText) ||
      /^\s*text"\s*:/i.test(currentText) ||
      (currentText.indexOf('"text"') >= 0 && currentText.trim().charAt(0) === "{");

    if (needsLoose) {
      const out = {
        text: loose.text || "Ok.",
      };
      if (parsed.command && typeof parsed.command === "object") {
        out.command = parsed.command;
      } else if (loose.command) {
        out.command = loose.command;
      }
      if (parsed.action) out.action = parsed.action;
      return out;
    }

    const out = {
      text: currentText.trim() || loose.text || "Ok.",
    };
    if (parsed.command) out.command = parsed.command;
    else if (loose.command) out.command = loose.command;
    if (parsed.action) out.action = parsed.action;
    return out;
  }

  return {
    text: loose.text || "Ok.",
    ...(loose.command ? { command: loose.command } : {}),
  };
}

module.exports = {
  extractTonyTextLoose,
  postProcessTonyUnstructuredResponse,
  looksLikeTonyJsonEnvelope,
  stripJsonFences,
  TONY_MAX_TOKENS_NOTICE,
};
