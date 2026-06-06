"use strict";

const { isTonyOperationalCreationIntent, normalizeItTony } = require("./tony-quick-replies");

/**
 * Parser entity-first crea lavoro (Fase 3b).
 * Estrae operaio, mezzi, terreno, tipo, data, durata dal messaggio + slice contesto T3.
 */

const LAVORO_VERB_MAP = [
  { re: /\berpicat\w*/i, keywords: ["erpicatur"], defaultSub: "Generale" },
  { re: /\btrinciat\w*/i, keywords: ["trinciatur"], defaultSub: "Generale" },
  { re: /\bpotat\w*/i, keywords: ["potatur"], defaultSub: "Tra le File" },
  { re: /\bvendemmi\w*/i, keywords: ["vendemm"], defaultSub: "Generale" },
  { re: /\barat\w*/i, keywords: ["aratur"], defaultSub: "Generale" },
  { re: /\bfresat\w*/i, keywords: ["fresatur"], defaultSub: "Generale" },
  { re: /\bdiserbat\w*/i, keywords: ["diserb"], defaultSub: "Generale" },
  { re: /\bsemin\w*/i, keywords: ["semin"], defaultSub: "Generale" },
];

const WEEKDAY_MAP = [
  { re: /\bdomenic/i, dow: 0 },
  { re: /\bluned/i, dow: 1 },
  { re: /\bmarted/i, dow: 2 },
  { re: /\bmercoled/i, dow: 3 },
  { re: /\bgioved/i, dow: 4 },
  { re: /\bvenerd/i, dow: 5 },
  { re: /\bsabato\b/i, dow: 6 },
];

const ASSIGN_STOP = new Set([
  "un", "una", "il", "lo", "la", "l", "domani", "oggi", "esempio", "favore", "conto", "giorno", "giorni",
]);

function normText(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function formatIsoDateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isTonyLavoroCreationIntent(message, ctx) {
  if (!message || !isTonyOperationalCreationIntent(message)) return false;
  const msg = normalizeItTony(message);
  if (/\bpreventiv\w*|offerta|quotazione\b/.test(msg)) return false;
  if (/\b(segna\s+le\s+ore|diario|attivit\s+giornalier)\b/.test(msg)) return false;
  const fid = ctx && ctx.form ? String(ctx.form.formId || ctx.form.modalId || "") : "";
  if (fid === "preventivo-form" || /preventivo/i.test(fid)) return false;
  if (/\blavoro\b/.test(msg)) return true;
  if (/\b(crea|nuovo|programma|pianifica|assegna|schedula)\s*(un?\s*)?(potatur|erpicatur|trinciatur|vendemmi|fresatur|aratur|diserb)/.test(msg)) {
    return true;
  }
  if (fid === "lavoro-form" || fid === "lavoro-modal") return true;
  return false;
}

function resolveWeekdayDate(message) {
  const m = String(message || "");
  for (const entry of WEEKDAY_MAP) {
    if (entry.re.test(m)) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      const today = d.getDay();
      let diff = (entry.dow - today + 7) % 7;
      if (diff === 0 && !/\boggi\b/i.test(m)) diff = 7;
      d.setDate(d.getDate() + diff);
      return formatIsoDateLocal(d);
    }
  }
  if (/\boggi\b/i.test(m)) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return formatIsoDateLocal(d);
  }
  if (/\bdomani\b/i.test(m)) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return formatIsoDateLocal(d);
  }
  return null;
}

function extractDurationDays(message) {
  const m = String(message || "");
  const wordMap = { uno: 1, un: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10 };
  const numToken = "(\\d+|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)";
  if (/\bun(?:a)?\s+giornat(?:a|e)\b/i.test(m)) return 1;
  let match =
    m.match(new RegExp(`\\bdurata\\s+${numToken}\\s+giorn`, "i")) ||
    m.match(new RegExp(`\\b(?:per|di)\\s+${numToken}\\s+giorn`, "i")) ||
    m.match(/\b(\d+)\s+giorn/i) ||
    m.match(new RegExp(`\\bdurata\\s*(?:di|:)?\\s*${numToken}\\b(?![\\s\\S]*\\bdurata\\s)`, "i"));
  if (!match) return null;
  const raw = String(match[1]).toLowerCase();
  const n = wordMap[raw] != null ? wordMap[raw] : parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || n > 365) return null;
  return n;
}

function pickBestByNameInMessage(list, message, labelKey) {
  const msgN = normText(message);
  const arr = Array.isArray(list) ? list : [];
  const matches = arr.filter((item) => {
    const nome = normText(item[labelKey || "nome"] || item.label || item.id || "");
    if (!nome || nome.length < 2) return false;
    return msgN.includes(nome) || nome.split(/\s+/).some((w) => w.length >= 3 && msgN.includes(w));
  });
  if (matches.length === 1) {
    const it = matches[0];
    return {
      value: it.id || it.nome || it.label,
      label: it.nome || it.label || it.id,
      ambiguous: false,
      matches: [it],
    };
  }
  if (matches.length > 1) {
    return { value: null, ambiguous: true, matches };
  }
  return { value: null, ambiguous: false, matches: [] };
}

function resolveTerreno(message, terreni) {
  const list = Array.isArray(terreni) ? terreni : [];
  if (list.length === 0) return { value: null, ambiguous: false, matches: [] };
  const msgN = normText(message);
  const scored = list
    .map((t) => {
      const nome = normText(t.nome || t.label || "");
      if (!nome || nome.length < 3) return null;
      let score = 0;
      if (msgN.includes(nome)) score = 100;
      else {
        const words = nome.split(/\s+/).filter((w) => w.length >= 4);
        words.forEach((w) => {
          if (msgN.includes(w)) score = Math.max(score, 60 + w.length);
        });
      }
      return score > 0 ? { t, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { value: null, ambiguous: false, matches: [] };
  const top = scored[0];
  const tied = scored.filter((s) => s.score === top.score);
  if (tied.length > 1) {
    return { value: null, ambiguous: true, matches: tied.map((x) => x.t) };
  }
  return {
    value: top.t.id || top.t.nome,
    label: top.t.nome || top.t.label,
    ambiguous: false,
    matches: [top.t],
  };
}

function pickBestTipoLavoro(message, tipiLavoro) {
  const msgN = normText(message);
  const tipi = Array.isArray(tipiLavoro) ? tipiLavoro : [];
  for (const entry of LAVORO_VERB_MAP) {
    if (!entry.re.test(message)) continue;
    const candidates = tipi.filter((t) => {
      const n = normText(t.nome || t.label || t.id || "");
      return entry.keywords.some((kw) => n.includes(kw));
    });
    if (candidates.length === 0) {
      return { value: entry.keywords[0].replace(/ur$/, "atura"), ambiguous: false, matches: [], defaultSub: entry.defaultSub };
    }
    const mecc = candidates.filter((t) => /\bmeccanic/i.test(normText(t.nome || "")));
    const pool = mecc.length ? mecc : candidates;
    pool.sort((a, b) => (b.nome || "").length - (a.nome || "").length);
    const best = pool[0];
    return {
      value: best.nome || best.label,
      ambiguous: pool.length > 1 && mecc.length > 1,
      matches: pool.slice(0, 5),
      defaultSub: entry.defaultSub,
    };
  }
  return { value: null, ambiguous: false, matches: [] };
}

function extractAssigneeToken(message) {
  const m = String(message || "");
  let match = m.match(/\bassegn\w*\s+(?:a|ad|al|alla|allo)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-]{0,24})/i);
  if (match) return match[1].trim();
  match = m.match(/\bper\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-]{0,24}?)(?:\s*[.…,]|$|\s+(?:con|nel|nella|in|sul|erpic|trinc|potat|inizio|durata|assegna|domani|oggi|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica))/i);
  if (match) {
    const tok = normText(match[1]);
    if (!ASSIGN_STOP.has(tok)) return match[1].trim();
  }
  return null;
}

function resolvePerson(message, operaiList, caposquadraList) {
  const token = extractAssigneeToken(message);
  if (!token) return { value: null, role: null, ambiguous: false, matches: [] };
  const tokN = normText(token);
  const operai = Array.isArray(operaiList) ? operaiList : [];
  const capi = Array.isArray(caposquadraList) ? caposquadraList : [];
  const opMatches = operai.filter((o) => {
    const n = normText(`${o.nome || ""} ${o.cognome || ""}`.trim() || o.nome || "");
    return n.includes(tokN) || tokN.includes(n.split(/\s+/)[0]);
  });
  const capMatches = capi.filter((c) => {
    const n = normText(`${c.nome || ""} ${c.cognome || ""}`.trim() || c.nome || "");
    return n.includes(tokN) || tokN.includes(n.split(/\s+/)[0]);
  });
  const all = [
    ...opMatches.map((o) => ({ ...o, _role: "operaio" })),
    ...capMatches.map((c) => ({ ...c, _role: "caposquadra" })),
  ];
  if (all.length === 1) {
    const p = all[0];
    const label = `${p.nome || ""} ${p.cognome || ""}`.trim() || p.nome || token;
    return { value: p.id || label, label, role: p._role, ambiguous: false, matches: [p] };
  }
  if (all.length > 1) {
    return { value: null, role: null, ambiguous: true, matches: all };
  }
  if (token.length >= 2) {
    return { value: token, label: token, role: "operaio", ambiguous: false, matches: [], inferred: true };
  }
  return { value: null, role: null, ambiguous: false, matches: [] };
}

function extractConMezziClause(message) {
  const m = String(message || "");
  const match = m.match(/\bcon\s+(.+?)(?:\s+inizio|\s+durata|\s*$|\s*[.…])/i);
  if (!match) return [];
  return match[1]
    .split(/\s+e\s+|,/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveTrattoreAttrezzoFromMessage(message, trattori, attrezzi, tipoLavoroNome) {
  const trList = Array.isArray(trattori) ? trattori : [];
  const atList = Array.isArray(attrezzi) ? attrezzi : [];
  const clauses = extractConMezziClause(message);
  const msgN = normText(message);
  let trattore = null;
  let attrezzo = null;
  const trAmb = [];
  const atAmb = [];

  function matchInList(clause, list) {
    const cN = normText(clause);
    return list.filter((item) => {
      const nome = normText(item.nome || item.label || "");
      return nome && (cN.includes(nome) || nome.includes(cN) || cN.split(/\s+/).some((w) => w.length >= 4 && nome.includes(w)));
    });
  }

  for (const clause of clauses) {
    const trHits = matchInList(clause, trList);
    const atHits = matchInList(clause, atList);
    if (trHits.length === 1 && !trattore) trattore = trHits[0];
    else if (trHits.length > 1) trAmb.push(...trHits);
    if (atHits.length === 1 && !attrezzo) attrezzo = atHits[0];
    else if (atHits.length > 1) atAmb.push(...atHits);
  }

  if (!trattore) {
    const trHits = trList.filter((t) => {
      const n = normText(t.nome || "");
      return n.length >= 3 && msgN.includes(n);
    });
    if (trHits.length === 1) trattore = trHits[0];
    else if (trHits.length > 1) trAmb.push(...trHits);
  }
  if (!attrezzo) {
    const atExplicit = atList.filter((a) => {
      const n = normText(a.nome || "");
      return n.length >= 3 && msgN.includes(n);
    });
    if (atExplicit.length === 1) attrezzo = atExplicit[0];
    else if (atExplicit.length > 1) atAmb.push(...atExplicit);
    const tipoLow = normText(tipoLavoroNome || "");
    const kw = tipoLow.includes("erpic") ? "erpice" : tipoLow.includes("trinc") ? "trincia" : null;
    if (!attrezzo && kw && (msgN.includes(kw) || /\battrezz/.test(msgN))) {
      const atHits = atList.filter((a) => normText(a.nome || "").includes(kw));
      if (atHits.length === 1) attrezzo = atHits[0];
      else if (atHits.length > 1) atAmb.push(...atHits);
    }
  }

  return {
    trattore: trattore ? { value: trattore.id || trattore.nome, label: trattore.nome, ambiguous: false } : trAmb.length > 1 ? { value: null, ambiguous: true, matches: trAmb } : { value: null, ambiguous: false },
    attrezzo: attrezzo ? { value: attrezzo.id || attrezzo.nome, label: attrezzo.nome, ambiguous: false } : atAmb.length > 1 ? { value: null, ambiguous: true, matches: atAmb } : { value: null, ambiguous: false },
  };
}

function findAttrezzoRecord(raw, attrezzi) {
  const list = Array.isArray(attrezzi) ? attrezzi : [];
  if (raw == null || String(raw).trim() === "") return null;
  const v = String(raw).trim();
  const byId = list.find((a) => (a.id || "") === v);
  if (byId) return byId;
  const low = normText(v);
  const matches = list.filter((a) => {
    const n = normText(a.nome || "");
    return n && (n === low || n.includes(low) || low.includes(n));
  });
  return matches.length === 1 ? matches[0] : null;
}

function trattoriCompatibiliCvParser(trattori, attrezzo) {
  const active = (trattori || []).filter((t) => t && (t.stato || "") !== "dismesso");
  if (!attrezzo) return active;
  const min = Number(attrezzo.cavalliMinimiRichiesti);
  if (!Number.isFinite(min) || min <= 0) return active;
  return active.filter((t) => Number(t.cavalli) >= min);
}

function userMentionedTrattoreInMessage(message, trattori) {
  const msgN = normText(message || "");
  if (!msgN) return false;
  if (/\btrattr/i.test(msgN)) return true;
  for (const tr of trattori || []) {
    const nome = normText(tr.nome || "");
    if (nome.length >= 4 && msgN.includes(nome)) return true;
    for (const tok of nome.split(/\s+/).filter((w) => w.length >= 4)) {
      if (msgN.includes(tok)) return true;
    }
  }
  return false;
}

/** Rimuove trattore dedotto da Gemini se l'utente non l'ha nominato e ci sono 2+ compatibili. */
function sanitizeUndeclaredLavoroTrattoreInFormData(fd, message, lists) {
  if (!fd || typeof fd !== "object" || !fd["lavoro-trattore"]) return fd;
  if (userMentionedTrattoreInMessage(message, lists.trattori)) return fd;
  const attRec = findAttrezzoRecord(fd["lavoro-attrezzo"], lists.attrezzi);
  let attKnown = attRec;
  if (!attKnown && fd["lavoro-tipo-lavoro"]) {
    const tl = normText(fd["lavoro-tipo-lavoro"]);
    const kw = tl.includes("erpic") ? "erpice" : tl.includes("trinc") ? "trincia" : null;
    if (kw) {
      const hits = (lists.attrezzi || []).filter((a) => normText(a.nome || "").includes(kw));
      if (hits.length === 1) attKnown = hits[0];
    }
  }
  const candidati = attKnown
    ? trattoriCompatibiliCvParser(lists.trattori, attKnown)
    : (lists.trattori || []).filter((t) => t && (t.stato || "") !== "dismesso");
  if (candidati.length > 1) {
    delete fd["lavoro-trattore"];
  } else if (candidati.length === 1) {
    const only = candidati[0];
    const want = String(only.nome || only.id || "").trim();
    const cur = normText(fd["lavoro-trattore"]);
    const wantN = normText(want);
    if (wantN && cur && wantN !== cur && !wantN.includes(cur) && !cur.includes(wantN)) {
      fd["lavoro-trattore"] = want;
    }
  }
  return fd;
}

function getLavoroListsFromCtx(ctx) {
  const azi = (ctx && ctx.azienda) || {};
  const lav = (ctx && ctx.lavori) || {};
  return {
    terreni: azi.terreni || lav.terreni || ctx.attivita?.terreni || [],
    tipiLavoro: azi.tipiLavoro || lav.tipi_lavoro || [],
    trattori: azi.trattori || lav.trattoriList || [],
    attrezzi: azi.attrezzi || lav.attrezziList || [],
    operaiList: lav.operaiList || [],
    caposquadraList: lav.caposquadraList || [],
  };
}

function buildLavoroNome(tipoLabel, terrenoLabel) {
  const t = String(tipoLabel || "Lavoro").trim();
  const tr = String(terrenoLabel || "").trim();
  if (t && tr) return `${t} ${tr}`.slice(0, 80);
  return t || tr || "Nuovo lavoro";
}

function countCoreFields(fd) {
  const keys = [
    "lavoro-nome", "lavoro-terreno", "lavoro-tipo-lavoro", "lavoro-data-inizio", "lavoro-durata",
    "tipo-assegnazione", "lavoro-operaio", "lavoro-caposquadra", "lavoro-stato",
    "lavoro-trattore", "lavoro-attrezzo",
  ];
  return keys.filter((k) => fd[k] != null && String(fd[k]).trim() !== "").length;
}

function buildAmbiguityQuestion(ambiguities) {
  if (!ambiguities.length) return null;
  const a = ambiguities[0];
  if (a.field === "trattore") {
    const names = (a.matches || []).slice(0, 6).map((t) => t.nome || t.label).filter(Boolean);
    return `Quale trattore vuoi usare? ${names.join(", ")}?`;
  }
  if (a.field === "attrezzo") {
    const names = (a.matches || []).slice(0, 6).map((t) => t.nome || t.label).filter(Boolean);
    return `Quale attrezzo vuoi usare? ${names.join(", ")}?`;
  }
  if (a.field === "operaio") {
    const names = (a.matches || []).slice(0, 6).map((p) => `${p.nome || ""} ${p.cognome || ""}`.trim()).filter(Boolean);
    return `A chi lo assegno? ${names.join(" o ")}?`;
  }
  if (a.field === "terreno") {
    const names = (a.matches || []).slice(0, 6).map((t) => t.nome).filter(Boolean);
    return `Su quale terreno? ${names.join(", ")}?`;
  }
  return null;
}

/**
 * @param {{ message: string, history?: object[], ctx: object }} input
 * @returns {{ id: string, text: string, command: object|null, earlyReturn: boolean, formData?: object, ambiguities?: object[], fieldsCount?: number } | null}
 */
function tryTonyLavoroEntityParse(input) {
  const message = input && input.message ? String(input.message) : "";
  const ctx = (input && input.ctx) || {};
  if (!message.trim() || !isTonyLavoroCreationIntent(message, ctx)) return null;

  const lists = getLavoroListsFromCtx(ctx);
  const ambiguities = [];
  const fd = {};

  const tipo = pickBestTipoLavoro(message, lists.tipiLavoro);
  if (tipo.ambiguous) ambiguities.push({ field: "tipo-lavoro", matches: tipo.matches });
  if (tipo.value) fd["lavoro-tipo-lavoro"] = tipo.value;

  const terreno = resolveTerreno(message, lists.terreni);
  if (terreno.ambiguous) ambiguities.push({ field: "terreno", matches: terreno.matches });
  if (terreno.value) fd["lavoro-terreno"] = terreno.value;

  const person = resolvePerson(message, lists.operaiList, lists.caposquadraList);
  if (person.ambiguous) ambiguities.push({ field: "operaio", matches: person.matches });
  if (person.value) {
    if (person.role === "caposquadra") {
      fd["tipo-assegnazione"] = "squadra";
      fd["lavoro-caposquadra"] = person.label || person.value;
    } else {
      fd["tipo-assegnazione"] = "autonomo";
      fd["lavoro-operaio"] = person.label || person.value;
      if (fd["lavoro-trattore"]) fd["lavoro-operatore-macchina"] = person.label || person.value;
    }
    fd["lavoro-stato"] = "assegnato";
  }

  const dataIso = resolveWeekdayDate(message);
  if (dataIso) fd["lavoro-data-inizio"] = dataIso;
  const dur = extractDurationDays(message);
  if (dur != null) fd["lavoro-durata"] = String(dur);

  const mezzi = resolveTrattoreAttrezzoFromMessage(message, lists.trattori, lists.attrezzi, fd["lavoro-tipo-lavoro"]);
  if (mezzi.trattore.ambiguous) ambiguities.push({ field: "trattore", matches: mezzi.trattore.matches });
  else if (mezzi.trattore.value) fd["lavoro-trattore"] = mezzi.trattore.label || mezzi.trattore.value;
  if (mezzi.attrezzo.ambiguous) ambiguities.push({ field: "attrezzo", matches: mezzi.attrezzo.matches });
  else if (mezzi.attrezzo.value) fd["lavoro-attrezzo"] = mezzi.attrezzo.label || mezzi.attrezzo.value;

  if (fd["lavoro-attrezzo"] && !userMentionedTrattoreInMessage(message, lists.trattori)) {
    const attRec = findAttrezzoRecord(fd["lavoro-attrezzo"], lists.attrezzi);
    if (attRec) {
      const compat = trattoriCompatibiliCvParser(lists.trattori, attRec);
      if (compat.length > 1) {
        if (fd["lavoro-trattore"]) delete fd["lavoro-trattore"];
        if (!ambiguities.some((a) => a.field === "trattore")) {
          ambiguities.push({ field: "trattore", matches: compat });
        }
      }
    }
  }

  if (tipo.defaultSub && !fd["lavoro-sottocategoria"]) {
    fd["lavoro-sottocategoria"] = tipo.defaultSub;
  }

  if (fd["lavoro-tipo-lavoro"] && !fd["lavoro-categoria-principale"]) {
    const tlN = normText(fd["lavoro-tipo-lavoro"]);
    if (/erpic|trinc|aratur|fres|diserb|semin|vang|ripunt|sfalci/.test(tlN)) {
      fd["lavoro-categoria-principale"] = "Lavorazione del Terreno";
    } else if (/potatur|pre-potatur/.test(tlN)) {
      fd["lavoro-categoria-principale"] = "Potatura";
    } else if (/vendemm/.test(tlN)) {
      fd["lavoro-categoria-principale"] = "Vendemmia";
    }
  }

  if (fd["lavoro-operaio"] && fd["lavoro-trattore"] && !fd["lavoro-operatore-macchina"]) {
    fd["lavoro-operatore-macchina"] = fd["lavoro-operaio"];
  }

  fd["lavoro-nome"] = buildLavoroNome(fd["lavoro-tipo-lavoro"], terreno.label || fd["lavoro-terreno"]);
  if (!fd["lavoro-stato"]) fd["lavoro-stato"] = "da_pianificare";

  const fieldsCount = Object.keys(fd).length;
  const coreCount = countCoreFields(fd);
  if (coreCount < 4 && ambiguities.length === 0) return null;

  const isFormOpen =
    ctx.form && (ctx.form.formId === "lavoro-form" || ctx.form.modalId === "lavoro-modal");
  const deferredMacchineFields = new Set(["trattore", "attrezzo"]);
  const activeAmbiguities = isFormOpen
    ? ambiguities
    : ambiguities.filter((a) => !deferredMacchineFields.has(a.field));
  const question = activeAmbiguities.length === 1 ? buildAmbiguityQuestion(activeAmbiguities) : null;
  const textBase = isFormOpen
    ? "Compilo il lavoro con i dati indicati."
    : "Ti porto a gestione lavori.";
  const text = question
    ? `${textBase} ${question}`
    : isFormOpen
      ? `${textBase} Controlla il form e dimmi se manca qualcosa.`
      : textBase;

  const command = isFormOpen
    ? { type: "INJECT_FORM_DATA", formId: "lavoro-form", formData: fd }
    : { type: "OPEN_MODAL", id: "lavoro-modal", fields: fd };

  const earlyReturn = coreCount >= 8 && ambiguities.length <= 1;

  return {
    id: "lavoro_entity_parse",
    text,
    command,
    earlyReturn,
    formData: fd,
    ambiguities,
    fieldsCount,
    coreCount,
  };
}

/**
 * Merge deterministico su formData Gemini / Treasure Map.
 */
function enrichLavoroCommandFormData(formData, message, ctx, history) {
  const parsed = tryTonyLavoroEntityParse({ message, history, ctx });
  const lists = getLavoroListsFromCtx(ctx);
  if (!parsed || !parsed.formData) {
    const fd0 = formData && typeof formData === "object" ? { ...formData } : {};
    return sanitizeUndeclaredLavoroTrattoreInFormData(fd0, message, lists);
  }
  const fd = formData && typeof formData === "object" ? { ...formData } : {};
  const inferred = parsed.formData;
  Object.keys(inferred).forEach((k) => {
    const cur = fd[k];
    const inc = inferred[k];
    if (inc == null || String(inc).trim() === "") return;
    if (cur == null || String(cur).trim() === "") {
      fd[k] = inc;
      return;
    }
    if (k === "lavoro-tipo-lavoro" && normText(String(inc)).length > normText(String(cur)).length) {
      fd[k] = inc;
    }
  });
  if (inferred["lavoro-operaio"] && !fd["tipo-assegnazione"]) {
    fd["tipo-assegnazione"] = "autonomo";
    fd["lavoro-stato"] = fd["lavoro-stato"] || "assegnato";
  }
  if (inferred["lavoro-caposquadra"] && !fd["tipo-assegnazione"]) {
    fd["tipo-assegnazione"] = "squadra";
    fd["lavoro-stato"] = fd["lavoro-stato"] || "assegnato";
  }
  if (!fd["lavoro-nome"] && inferred["lavoro-nome"]) fd["lavoro-nome"] = inferred["lavoro-nome"];
  sanitizeUndeclaredLavoroTrattoreInFormData(fd, message, lists);
  return fd;
}

function slimContextForLavoroFormFollowUp(ctxFinal) {
  if (!ctxFinal || typeof ctxFinal !== "object") return ctxFinal;
  const fid = ctxFinal.form && (ctxFinal.form.formId || ctxFinal.form.modalId);
  if (fid !== "lavoro-form" && fid !== "lavoro-modal") return ctxFinal;
  const out = { ...ctxFinal };
  if (out.page && out.page.currentTableData && out.page.currentTableData.pageType === "lavori") {
    out.page = { ...out.page };
    out.page.currentTableData = {
      pageType: "lavori",
      summary: out.page.currentTableData.summary || "Form lavoro aperto — elenco lavori omesso nel follow-up.",
      items: [],
      _slimFollowUp: true,
    };
  }
  return out;
}

module.exports = {
  tryTonyLavoroEntityParse,
  enrichLavoroCommandFormData,
  slimContextForLavoroFormFollowUp,
  sanitizeUndeclaredLavoroTrattoreInFormData,
  isTonyLavoroCreationIntent,
  normText,
  resolveWeekdayDate,
  extractDurationDays,
  resolveTerreno,
  resolvePerson,
  pickBestTipoLavoro,
};
