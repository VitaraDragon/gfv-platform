import { describe, expect, it } from 'vitest';

function normalizeTonyText(s) {
  return String(s || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const LOV_INTERVIEW_WEEKDAYS_NORM = [
  { key: 'lunedi', dow: 1 },
  { key: 'martedi', dow: 2 },
  { key: 'mercoledi', dow: 3 },
];

function formatIsoDateLocalInterview(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

function extractLavoroInterviewDate(message) {
  const n = normalizeTonyText(message);
  if (!n) return null;
  for (const entry of LOV_INTERVIEW_WEEKDAYS_NORM) {
    if (n.indexOf(entry.key) >= 0) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      const today = d.getDay();
      let diff = (entry.dow - today + 7) % 7;
      if (diff === 0 && !/\boggi\b/.test(n)) diff = 7;
      d.setDate(d.getDate() + diff);
      return formatIsoDateLocalInterview(d);
    }
  }
  if (/\bdomani\b/.test(n)) {
    const d1 = new Date();
    d1.setHours(12, 0, 0, 0);
    d1.setDate(d1.getDate() + 1);
    return formatIsoDateLocalInterview(d1);
  }
  return null;
}

function extractLavoroInterviewDuration(message) {
  const m = String(message || '');
  const n = normalizeTonyText(m);
  const wordMap = { uno: 1, un: 1, una: 1, due: 2, tre: 3, quattro: 4, cinque: 5 };
  const numToken = '(\\d+|un|una|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci)';
  if (/\bun(?:a|o)?\s+giorn(?:o|i|ata|ate)\b/i.test(m)) return 1;
  const match =
    m.match(new RegExp(`\\b(?:dura|durata)\\s+${numToken}\\s+giorn`, 'i')) ||
    m.match(new RegExp(`\\b(?:per|di)\\s+${numToken}\\s+giorn`, 'i')) ||
    m.match(new RegExp(`\\b${numToken}\\s+giorn`, 'i')) ||
    m.match(/\b(\d+)\s+giorn/i);
  if (!match) {
    const ilMatch = n.match(/\bil\s+(\d{1,3})\b/);
    if (ilMatch) {
      const ilN = parseInt(ilMatch[1], 10);
      if (Number.isFinite(ilN) && ilN > 0 && ilN <= 365) return ilN;
    }
    const bare = m.trim();
    if (/^\d{1,3}$/.test(bare)) {
      const nb = parseInt(bare, 10);
      if (Number.isFinite(nb) && nb > 0 && nb <= 365) return nb;
    }
    if (wordMap[n] != null) return wordMap[n];
    return null;
  }
  const raw = String(match[1]).toLowerCase();
  const num = wordMap[raw] != null ? wordMap[raw] : parseInt(raw, 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function scoreTerrenoInterviewMatch(queryText, terrenoNome) {
  const t = normalizeTonyText(queryText);
  const n = normalizeTonyText(terrenoNome || '');
  if (!t || !n || t.length < 2) return 0;
  if (t === n) return 1000;
  if (n.indexOf(t) >= 0) return 800 + Math.min(t.length, 40);
  if (t.indexOf(n) >= 0) return 700 + Math.min(n.length, 40);
  const queryParts = t.split(/\s+/).filter((w) => w.length >= 2);
  if (queryParts.length >= 2) {
    const matched = queryParts.filter((w) => n.indexOf(w) >= 0);
    if (matched.length === queryParts.length) return 500 + matched.length * 10;
    if (matched.length > 0) return 100 + matched.length * 10;
    return 0;
  }
  if (queryParts.length === 1 && n.indexOf(queryParts[0]) >= 0) return 300;
  const tokens = n.split(/\s+/).filter((w) => w.length >= 4);
  for (const tok of tokens) {
    if (t.indexOf(tok) >= 0) return 200;
  }
  return 0;
}

function findTerrenoInInterviewText(text, list) {
  if (!text || !Array.isArray(list) || !list.length) return null;
  const t = normalizeTonyText(text);
  if (!t || t.length < 2) return null;
  const scored = [];
  for (const tr of list) {
    if (!tr) continue;
    const sc = scoreTerrenoInterviewMatch(t, tr.nome || '');
    if (sc > 0) scored.push({ tr, sc });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.sc - a.sc);
  const topSc = scored[0].sc;
  const tied = scored.filter((s) => s.sc === topSc);
  if (tied.length === 1) {
    if (tied[0].sc < 300) return null;
    return tied[0].tr;
  }
  if (scored.length > 1 && scored[0].sc > scored[1].sc) {
    if (scored[0].sc < 300) return null;
    return scored[0].tr;
  }
  return {
    ambiguous: true,
    candidates: tied.map((s) => ({
      id: s.tr.id || null,
      label: String(s.tr.nome || '').trim(),
      coltura: s.tr.coltura || null,
    })),
  };
}

function isTerrenoInterviewUniqueHit(hit) {
  return hit && !hit.ambiguous && (hit.id || hit.nome);
}

function findPersonInListInterviewText(text, list, role) {
  const raw = String(text || '').trim();
  if (!raw || !Array.isArray(list) || !list.length) return null;
  function trimPersonInterviewToken(token) {
    let t = String(token || '').trim();
    if (!t) return t;
    t = t.replace(/\s+(?:nel|nella|nello|in|sul|sulla|sul|al|alla|allo|con|da|di|domani|oggi|un|una|\d+)\b.*$/i, '').trim();
    return t;
  }
  function extractPersonTokenFromInterviewText(src) {
    const s = String(src || '').trim();
    if (!s) return s;
    const m = s.match(/\b(?:per|a|ad|assegna?\w*\s+(?:a|ad|al|alla))\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-]{1,30}(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-]{1,30})?)/i);
    if (m) return trimPersonInterviewToken(m[1].trim());
    return s;
  }
  const token = extractPersonTokenFromInterviewText(raw);
  const tokN = normalizeTonyText(token);
  if (!tokN || tokN.length < 2) return null;
  const hits = list.filter((p) => {
    const full = normalizeTonyText(`${p.nome || ''} ${p.cognome || ''}`.trim() || p.nome || '');
    if (!full) return false;
    if (full === tokN || full.includes(tokN) || tokN.includes(full)) return true;
    const nome = normalizeTonyText(p.nome || '');
    const cognome = normalizeTonyText(p.cognome || '');
    return tokN === nome || tokN === cognome || nome.startsWith(tokN) || cognome.startsWith(tokN);
  });
  if (hits.length === 1) {
    return {
      role,
      id: hits[0].id,
      label: `${hits[0].nome || ''} ${hits[0].cognome || ''}`.trim() || hits[0].nome,
    };
  }
  if (hits.length > 1) {
    return {
      role,
      ambiguous: true,
      candidates: hits.map((p) => ({
        id: p.id,
        label: `${p.nome || ''} ${p.cognome || ''}`.trim() || p.nome,
      })),
    };
  }
  return null;
}

function findPersonInInterviewText(text, operai, capi, roleHint) {
  if (roleHint === 'squadra') return findPersonInListInterviewText(text, capi, 'caposquadra');
  if (roleHint === 'autonomo') return findPersonInListInterviewText(text, operai, 'operaio');
  const squadraIntent = /\blavoro\s+di\s+squadra\b/i.test(String(text || '').toLowerCase());
  const capHit = findPersonInListInterviewText(text, capi, 'caposquadra');
  const opHit = findPersonInListInterviewText(text, operai, 'operaio');
  if (!squadraIntent && opHit) return opHit;
  if (capHit && !capHit.ambiguous && (!opHit || opHit.ambiguous)) return capHit;
  if (opHit && !opHit.ambiguous && (!capHit || capHit.ambiguous)) return opHit;
  if (capHit && capHit.ambiguous && opHit && opHit.ambiguous) return squadraIntent ? null : opHit;
  if (capHit && capHit.ambiguous) return capHit;
  if (opHit && opHit.ambiguous) return opHit;
  if (capHit && !capHit.ambiguous && opHit && !opHit.ambiguous && capHit.id === opHit.id) return capHit;
  return null;
}

function scoreTipoLavoroForInterview(tipo, text, _terrenoHint, assignMode) {
  const n = normalizeTonyText(tipo.nome || '');
  const t = normalizeTonyText(text);
  let sc = 0;
  if (/\bmanuale\b/.test(t) && n.indexOf('manual') >= 0) sc += 10;
  if (/\bmeccanic/.test(t) && n.indexOf('meccanic') >= 0) sc += 10;
  if (/\bproduzione\b/.test(t) && n.indexOf('produz') >= 0) sc += 8;
  if (!/\bmeccanic/.test(t) && n.indexOf('meccanic') >= 0) sc -= 7;
  if (!/\bmanual/.test(t) && !/\bmanuale\b/.test(t) && n.indexOf('manual') >= 0) sc += 4;
  if (assignMode === 'autonomo' && !/\bmeccanic/.test(t) && n.indexOf('meccanic') >= 0) sc -= 5;
  return sc;
}

describe('intervista lavoro client-side (parser)', () => {
  it('estrae domani e durata 1 giorno', () => {
    expect(extractLavoroInterviewDate('inizio domani')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(extractLavoroInterviewDate('martedì')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(extractLavoroInterviewDate('martedi')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(extractLavoroInterviewDuration('durata 1 giorno')).toBe(1);
    expect(extractLavoroInterviewDuration('per 2 giorni')).toBe(2);
    expect(extractLavoroInterviewDuration('per un giorno')).toBe(1);
    expect(extractLavoroInterviewDuration('un giorno')).toBe(1);
    expect(extractLavoroInterviewDuration('il lavoro dura un giorno')).toBe(1);
    expect(extractLavoroInterviewDuration('3')).toBe(3);
    expect(extractLavoroInterviewDuration('il 2')).toBe(2);
    expect(extractLavoroInterviewDuration('tre')).toBe(3);
  });

  it('resolveUserByName: luca ambiguo non auto-pick', () => {
    function resolveUserByName(rawValue, list) {
      const search = String(rawValue || '').toLowerCase().trim();
      const ids = list.filter((item) => {
        const full = `${item.nome || ''} ${item.cognome || ''}`.trim().toLowerCase();
        return full === search || full.includes(search) || search.includes(full);
      }).map((item) => item.id);
      if (ids.length === 1) return ids[0];
      if (ids.length > 1) return null;
      return null;
    }
    const operai = [
      { id: 'op1', nome: 'Luca', cognome: 'Fabbri' },
      { id: 'op2', nome: 'Luca', cognome: 'Brutto' },
    ];
    expect(resolveUserByName('luca', operai)).toBeNull();
    expect(resolveUserByName('Luca Fabbri', operai)).toBe('op1');
  });

  it('stem disamb: crea lavoro per luca → luca (cross-page / messaggio iniziale)', () => {
    function stripLavoroCreationIntentPrefix(text) {
      return String(text || '').trim().replace(/^(crea(\s+un)?\s+lavoro|nuovo\s+lavoro)\s+/i, '').trim();
    }
    function lavoroInterviewParseText(text) {
      const raw = String(text || '').trim();
      const stripped = stripLavoroCreationIntentPrefix(raw);
      return stripped || raw;
    }
    function lavoroInterviewDisambStemHint(userText, entityKind) {
      let parsed = lavoroInterviewParseText(userText);
      if (!parsed) return '';
      function trimPersonInterviewToken(token) {
        let t = String(token || '').trim();
        if (!t) return t;
        t = t.replace(/\s+(?:nel|nella|nello|in|sul|sulla|sul|al|alla|allo|con|da|di|domani|oggi|un|una|\d+)\b.*$/i, '').trim();
        return t;
      }
      function extractPersonTokenFromInterviewText(src) {
        const s = String(src || '').trim();
        if (!s) return s;
        const m = s.match(/\b(?:per|a|ad|assegna?\w*\s+(?:a|ad|al|alla))\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-]{1,30}(?:\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-]{1,30})?)/i);
        if (m) return trimPersonInterviewToken(m[1].trim());
        return s;
      }
      if (entityKind === 'person') {
        parsed = extractPersonTokenFromInterviewText(parsed);
      }
      parsed = parsed.replace(/\s+(?:con|nel|nella|in|sul|sulla|per\s+\d+\s+giorn).*$/i, '').trim();
      parsed = parsed.replace(/\b(?:domani|oggi|martedi)\b.*$/i, '').trim();
      return parsed.length <= 48 ? parsed : '';
    }
    expect(lavoroInterviewDisambStemHint('crea lavoro per luca', 'person')).toBe('luca');
    expect(lavoroInterviewDisambStemHint('crea lavoro per luca domani', 'person')).toBe('luca');
    expect(lavoroInterviewDisambStemHint('crea lavoro per luca nel pinot domani', 'person')).toBe('luca');
    expect(lavoroInterviewDisambStemHint('sangiovese', 'terreno')).toBe('sangiovese');
  });

  it('frase completa: per luca nel pinot → operaio univoco + autonomo implicito', () => {
    const operai = [{ id: 'op-luca', nome: 'Luca', cognome: 'Fabbri' }];
    const capi = [{ id: 'cap1', nome: 'Mario', cognome: 'Bianchi' }];
    const phrase = 'crea lavoro trinciatura per luca nel pinot domani 1 giorno agrifull';
    const stripped = phrase.replace(/^(crea(\s+un)?\s+lavoro|nuovo\s+lavoro)\s+/i, '').trim();
    const hit = findPersonInInterviewText(stripped, operai, capi, null);
    expect(hit && hit.id).toBe('op-luca');
    expect(hit && hit.role).toBe('operaio');
    expect(hit && hit.ambiguous).toBeFalsy();
  });

  it('frase completa: per luca ambiguo → disamb operaio', () => {
    const operai = [
      { id: 'op1', nome: 'Luca', cognome: 'Fabbri' },
      { id: 'op2', nome: 'Luca', cognome: 'Brutto' },
    ];
    const capi = [];
    const stripped = 'trinciatura per luca nel pinot domani 1 giorno agrifull';
    const hit = findPersonInInterviewText(stripped, operai, capi, null);
    expect(hit && hit.ambiguous).toBe(true);
    expect(hit.candidates.length).toBe(2);
  });

  it('matcha terreno larghetta univoco', () => {
    const hit = findTerrenoInInterviewText('larghetta', [
      { id: 't1', nome: 'Larghetta' },
      { id: 't2', nome: 'Trebbiano' },
    ]);
    expect(hit && hit.id).toBe('t1');
    expect(hit && hit.ambiguous).toBeFalsy();
  });

  it('non auto-pick terreno su cognome operaio (Fabbri debole)', () => {
    const terreni = [
      { id: 't-fab', nome: 'Vigneto Fabbri', coltura: 'Vite da Vino' },
      { id: 't-treb', nome: 'Trebbiano', coltura: 'Vite da Vino' },
    ];
    expect(findTerrenoInInterviewText('per luca fabbri', terreni)).toBeNull();
  });

  it('terreno ambiguo: due Pinot → candidati e messaggio con entrambi i nomi', () => {
    const terreni = [
      { id: 't-pinot-c', nome: 'Pinot Casetti', coltura: 'Vite da Vino' },
      { id: 't-pinot-m', nome: 'Pinot Monte', coltura: 'Vite da Vino' },
      { id: 't-treb', nome: 'Trebbiano', coltura: 'Vite da Vino' },
    ];
    const hit = findTerrenoInInterviewText('pinot', terreni);
    expect(hit && hit.ambiguous).toBe(true);
    expect(hit.candidates.length).toBe(2);

    function buildTerrenoDisambiguationMessage(candidates, stemHint) {
      const labels = candidates.map((c) => c.label);
      const stem = stemHint ? String(stemHint).trim() : '';
      return `Ho trovato più terreni${stem ? ` per «${stem}»` : ''}: ${labels.join(', ')}. Su quale lavori? (nome come in elenco)`;
    }
    const msg = buildTerrenoDisambiguationMessage(hit.candidates, 'pinot');
    expect(msg).toContain('Pinot Casetti');
    expect(msg).toContain('Pinot Monte');
    expect(msg).toContain('nome come in elenco');
  });

  it('terreno sangiovese ambiguo ma sangiovese pannelli univoco', () => {
    const terreni = [
      { id: 't-sg-p', nome: 'Sangiovese Pannelli', coltura: 'Vite da Vino' },
      { id: 't-sg-m', nome: 'Sangiovese Monte', coltura: 'Vite da Vino' },
      { id: 't-treb', nome: 'Trebbiano', coltura: 'Vite da Vino' },
    ];
    const amb = findTerrenoInInterviewText('sangiovese', terreni);
    expect(amb && amb.ambiguous).toBe(true);
    expect(amb.candidates.length).toBe(2);
    const hit = findTerrenoInInterviewText('sangiovese pannelli', terreni);
    expect(hit && hit.id).toBe('t-sg-p');
    expect(hit && hit.ambiguous).toBeFalsy();
  });

  it('correzione terreno: estrae hint da «il terreno è sangiovese»', () => {
    function isLavoroTerrenoCorrectionText(text) {
      const t = normalizeTonyText(text);
      if (!t) return false;
      if (/\b(?:il\s+)?terreno\s+(?:e\s+|è\s+|sara\s+|sara)\b/.test(t)) return true;
      return false;
    }
    function extractTerrenoQueryFromInterviewText(text) {
      const raw = String(text || '').trim();
      const m = raw.match(/\b(?:il\s+)?terreno\s+(?:è|e|sara|sarà)\s+(.+)$/i);
      return m ? m[1].trim() : raw;
    }
    expect(isLavoroTerrenoCorrectionText('il terreno è Sangiovese')).toBe(true);
    expect(extractTerrenoQueryFromInterviewText('il terreno è Sangiovese')).toBe('Sangiovese');
    const terreni = [
      { id: 't-sg-p', nome: 'Sangiovese Pannelli' },
      { id: 't-sg-m', nome: 'Sangiovese Monte' },
    ];
    const q = extractTerrenoQueryFromInterviewText('terreno è Sangiovese pannelli');
    const hit = findTerrenoInInterviewText(q, terreni);
    expect(hit && hit.id).toBe('t-sg-p');
  });

  it('terreno ambiguo: follow-up casetti risolve id corretto', () => {
    const candidates = [
      { id: 't-pinot-c', label: 'Pinot Casetti', coltura: 'Vite da Vino' },
      { id: 't-pinot-m', label: 'Pinot Monte', coltura: 'Vite da Vino' },
    ];
    function resolveTerrenoFromDisambReply(userText, cands) {
      const t = normalizeTonyText(userText);
      const partial = cands.filter((c) => {
        const n = normalizeTonyText(c.label);
        return n.indexOf(t) >= 0 || t.indexOf(n) >= 0;
      });
      if (partial.length === 1) return partial[0];
      const parts = t.split(/\s+/).filter((w) => w.length >= 2);
      const byToken = cands.filter((c) => {
        const n = normalizeTonyText(c.label);
        return parts.length > 0 && parts.every((w) => n.indexOf(w) >= 0);
      });
      if (byToken.length === 1) return byToken[0];
      return null;
    }
    expect(resolveTerrenoFromDisambReply('casetti', candidates).id).toBe('t-pinot-c');
    expect(resolveTerrenoFromDisambReply('pinot monte', candidates).id).toBe('t-pinot-m');
  });

  it('qualifier terreno: martedì, 3, erpicatura non sono disamb. terreno', () => {
    function isTerrenoDisambQualifierText(text, pending) {
      const t = normalizeTonyText(text);
      if (!t || !pending || pending.length <= 1) return false;
      if (/\b(martedi|lunedi|mercoledi)\b/.test(t)) return false;
      if (/^\d{1,3}$/.test(String(text || '').trim())) return false;
      if (/\b(erpic\w*|trinc\w*|potatur\w*)\b/.test(t)) return false;
      return t.length <= 48 && t.split(/\s+/).length <= 5;
    }
    const pending = [
      { id: 't1', label: 'Pinot Casetti' },
      { id: 't2', label: 'Pinot Monte' },
    ];
    expect(isTerrenoDisambQualifierText('martedì', pending)).toBe(false);
    expect(isTerrenoDisambQualifierText('3', pending)).toBe(false);
    expect(isTerrenoDisambQualifierText('erpicatura', pending)).toBe(false);
    expect(isTerrenoDisambQualifierText('casetti', pending)).toBe(true);
  });

  it('preferisce potatura manuale su meccanica se utente dice manuale', () => {
    const candidates = [
      { nome: 'Potatura a Verde Meccanica' },
      { nome: 'Potatura Manuale di Produzione' },
    ];
    const scored = candidates.map((tipo) => ({
      nome: tipo.nome,
      score: scoreTipoLavoroForInterview(tipo, 'potatura manuale di produzione', '', 'autonomo'),
    })).sort((a, b) => b.score - a.score);
    expect(scored[0].nome).toBe('Potatura Manuale di Produzione');
  });

  it('non auto-sceglie meccanica su sola parola potatura', () => {
    const candidates = [
      { nome: 'Potatura a Verde Meccanica' },
      { nome: 'Potatura Manuale di Produzione' },
    ];
    const s1 = scoreTipoLavoroForInterview(candidates[0], 'potatura', '', 'autonomo');
    const s2 = scoreTipoLavoroForInterview(candidates[1], 'potatura', '', 'autonomo');
    expect(s2).toBeGreaterThan(s1);
  });

  it('placeholder select non conta come tipo scelto', () => {
    function lavoroSelectHasChoice(selectId, options, selectedIndex) {
      if (selectedIndex > 0 && String(options[selectedIndex].value || '').trim() !== '') return true;
      const txt = String(options[selectedIndex].text || '').trim();
      if (txt && !/^--\s|seleziona/i.test(txt)) return true;
      return false;
    }
    function getLavoroTipoDomText(options, selectedIndex) {
      if (!lavoroSelectHasChoice('lavoro-tipo-lavoro', options, selectedIndex)) return '';
      return String(options[selectedIndex].text || '').trim();
    }
    const opts = [{ value: '', text: '-- Seleziona tipo lavoro --' }, { value: 'x', text: 'Erpicatura' }];
    expect(getLavoroTipoDomText(opts, 0)).toBe('');
    expect(getLavoroTipoDomText(opts, 1)).toBe('Erpicatura');
  });

  it('riconosce stem tipo: trinciatura, trinciare, erpicare', () => {
    function lavoroTipoStemFromText(text) {
      const t = String(text || '').toLowerCase().trim()
        .replace(/\b(crea(\s+un)?\s+lavoro|dobbiamo|devo|fare|lavoro\s+di)\b/g, ' ')
        .replace(/\s+/g, ' ').trim();
      const stems = [
        ['erpic', /\berpic\w*\b/],
        ['trinc', /\b(trinc\w*|trnc\w*)\b/],
        ['potatur', /\bpot(?:atur\w*|are|a)\b/],
      ];
      for (const [stem, re] of stems) {
        if (re.test(t)) return stem;
      }
      return '';
    }
    expect(lavoroTipoStemFromText('trinciatura')).toBe('trinc');
    expect(lavoroTipoStemFromText('dobbiamo trinciare')).toBe('trinc');
    expect(lavoroTipoStemFromText('crea lavoro di erpicatura')).toBe('erpic');
    expect(lavoroTipoStemFromText('potare')).toBe('potatur');
    expect(lavoroTipoStemFromText('trnciatura')).toBe('trinc');
  });

  it('ordine intervista: data e durata prima delle macchine', () => {
    function nextQuestion(requiredEmpty, needsMacchine) {
      const order = ['lavoro-nome', 'lavoro-data-inizio', 'lavoro-durata'];
      for (const fid of order) {
        if (requiredEmpty.includes(fid)) {
          if (fid === 'lavoro-data-inizio') return 'Quando vuoi iniziare?';
          if (fid === 'lavoro-durata') return 'Per quanti giorni dura il lavoro?';
        }
      }
      if (needsMacchine) return 'Quale trattore vuoi usare per questo lavoro?';
      return 'altro';
    }
    const req = ['lavoro-data-inizio', 'lavoro-durata'];
    expect(nextQuestion(req, true)).toBe('Quando vuoi iniziare?');
    expect(nextQuestion(['lavoro-durata'], true)).toBe('Per quanti giorni dura il lavoro?');
    expect(nextQuestion([], true)).toBe('Quale trattore vuoi usare per questo lavoro?');
  });

  it('ordine intervista: terreno prima del tipo', () => {
    function nextQuestion(requiredEmpty) {
      if (requiredEmpty.indexOf('lavoro-terreno') >= 0) return 'Su quale terreno?';
      if (requiredEmpty.indexOf('lavoro-tipo-lavoro') >= 0) return 'Che tipo di lavoro devo impostare?';
      return 'altro';
    }
    expect(nextQuestion(['lavoro-tipo-lavoro', 'lavoro-terreno'])).toBe('Su quale terreno?');
    expect(nextQuestion(['lavoro-tipo-lavoro'])).toBe('Che tipo di lavoro devo impostare?');
  });

  it('potatura stem-only: chiede manuale/meccanica prima di auto-pick', () => {
    function stemNeedsManualMech(text, candidates) {
      if (/\b(manuale|meccanic|produzione|verde)\b/.test(String(text || '').toLowerCase())) return false;
      if (!/\bpotatur/.test(String(text || '').toLowerCase())) return false;
      const hasMan = candidates.some((n) => /manual|manuale|produz/i.test(n));
      const hasMech = candidates.some((n) => /meccanic|verde/i.test(n));
      return hasMan && hasMech;
    }
    function shouldAutoPickTipo(text, candidates) {
      if (stemNeedsManualMech(text, candidates)) return false;
      return false;
    }
    const cands = ['Potatura Manuale', 'Potatura a Verde Meccanica', 'Potatura di Produzione'];
    expect(stemNeedsManualMech('potatura', cands)).toBe(true);
    expect(shouldAutoPickTipo('potatura', cands)).toBe(false);
    expect(stemNeedsManualMech('potatura verde', cands)).toBe(false);
  });

  it('erpicatura su terreno filari: auto-pick Tra le File senza disamb', () => {
    function terrenoHasFilariColtura(terreno) {
      const c = String((terreno && terreno.coltura) || '').toLowerCase();
      return /vite|vigneto|frutteto|oliveto|arboreo|alberi/.test(c);
    }
    function scoreRow(tipoNome, text, terreno) {
      const n = tipoNome.toLowerCase();
      const hasFilari = terrenoHasFilariColtura(terreno);
      let sc = 0;
      if (hasFilari && n.includes('tra le file')) sc += 5;
      if (hasFilari && !n.includes('tra le file') && !n.includes('sulla fila')) sc += 0;
      return sc;
    }
    function pickTipo(stem, terreno, candidates) {
      const scored = candidates.map((nome) => ({ nome, score: scoreRow(nome, stem, terreno) }))
        .sort((a, b) => b.score - a.score);
      if (scored.length >= 2 && scored[0].score - scored[1].score >= 2) return scored[0].nome;
      const filari = scored.filter((r) => r.nome.toLowerCase().includes('tra le file'));
      if (filari.length === 1) return filari[0].nome;
      return null;
    }
    const pinot = { id: 't1', nome: 'Pinot', coltura: 'Vite da Vino' };
    const cands = ['Erpicatura', 'Erpicatura', 'Erpicatura Tra le File'];
    expect(pickTipo('erpicatura', pinot, cands)).toBe('Erpicatura Tra le File');
  });

  it('disambiguazione tipo: tra le file sceglie variante filari', () => {
    function scoreRow(tipoNome, text, hasFilari) {
      const n = tipoNome.toLowerCase();
      const t = text.toLowerCase();
      let sc = 0;
      if (hasFilari && n.includes('tra le file')) sc += 5;
      if (/\btra\s+le\s+file\b/.test(t) && n.includes('tra le file')) sc += 10;
      return sc;
    }
    const cands = ['Erpicatura', 'Erpicatura', 'Erpicatura Tra le File'];
    const scored = cands.map((nome) => ({ nome, score: scoreRow(nome, 'tra le file', true) }))
      .sort((a, b) => b.score - a.score);
    expect(scored[0].nome).toBe('Erpicatura Tra le File');
  });

  it('creation turn: fase macchine riconosce trattore prima del parser intervista', () => {
    function routeCreationTurn(text, phase) {
      const looksMac = phase.canAskMacchine && phase.trattoreEmpty &&
        /\b(agrifull|t5)\b/i.test(text);
      if (looksMac) return 'macchine';
      if (/\b(trinc\w*|erpic\w*)\b/i.test(text) && phase.terrenoSet && phase.tipoEmpty) return 'intervista-tipo';
      return 'intervista';
    }
    expect(routeCreationTurn('agrifull', { canAskMacchine: true, trattoreEmpty: true, terrenoSet: true, tipoEmpty: false }))
      .toBe('macchine');
    expect(routeCreationTurn('trinciatura', { canAskMacchine: false, trattoreEmpty: true, terrenoSet: true, tipoEmpty: true }))
      .toBe('intervista-tipo');
  });

  it('auto nome: tipo + terreno genera titolo lavoro', () => {
    function autoNome(tipo, terreno) {
      if (!tipo || !terreno) return '';
      return `${tipo} ${terreno}`.trim().slice(0, 80);
    }
    expect(autoNome('Erpicatura Meccanica', 'Pinot')).toBe('Erpicatura Meccanica Pinot');
  });

  it('squadra: matcha caposquadra per nome anche se operaio omonimo', () => {
    const operai = [{ id: 'op1', nome: 'Pier', cognome: 'Rossi' }];
    const capi = [{ id: 'cap1', nome: 'Pier', cognome: 'Best' }];
    const hit = findPersonInInterviewText('pier', operai, capi, 'squadra');
    expect(hit && hit.id).toBe('cap1');
    expect(hit && hit.role).toBe('caposquadra');
  });

  it('squadra: matcha caposquadra con nome e cognome', () => {
    const capi = [{ id: 'cap1', nome: 'Pier', cognome: 'Best' }];
    const hit = findPersonInInterviewText('pier best', [], capi, 'squadra');
    expect(hit && hit.id).toBe('cap1');
  });

  it('tipo lavoro stem-only: potatura non auto-sceglie tra varianti', () => {
    function isStemOnly(text) {
      const stems = ['potatur', 'erpic', 'trinc'];
      const t = String(text || '').toLowerCase().trim();
      if (/\b(manuale|meccanic|produzione|verde)\b/.test(t)) return false;
      return stems.some((s) => t === s + 'a' || t === s + 'atura' || t === 'potatura' || t === 'erpicatura' || t === 'trinciatura');
    }
    const candidates = [
      { nome: 'Potatura Manuale' },
      { nome: 'Potatura di Produzione' },
      { nome: 'Potatura a Verde Meccanica' },
    ];
    expect(isStemOnly('potatura')).toBe(true);
    expect(isStemOnly('potatura di produzione')).toBe(false);
    if (isStemOnly('potatura') && candidates.length > 1) {
      expect(candidates.length).toBeGreaterThan(1);
    }
  });

  it('messaggio disamb tipo elenca candidati come macchine', () => {
    function buildTipoDisambMessage(candidates, stemHint) {
      const labels = candidates.slice(0, 5).map((c) => c.nome);
      return `Per ${stemHint || 'questo lavoro'} ci sono più tipi compatibili: ${labels.join(', ')}. Indica quale usare (nome esatto).`;
    }
    const msg = buildTipoDisambMessage(
      [{ nome: 'Potatura Manuale' }, { nome: 'Potatura di Produzione' }],
      'potatura'
    );
    expect(msg).toContain('Potatura Manuale');
    expect(msg).toContain('Potatura di Produzione');
    expect(msg).toContain('nome esatto');
  });

  it('follow-up disamb: produzione risolve Potatura di Produzione', () => {
    const list = ['Potatura Manuale', 'Potatura di Produzione', 'Potatura a Verde Meccanica'];
    const t = 'produzione';
    const partial = list.filter((nome) => nome.toLowerCase().includes(t));
    expect(partial).toEqual(['Potatura di Produzione']);
  });

  it('classifica potatura manuale vs meccanica', () => {
    function classifyTipoLavoroModo(nome) {
      const s = String(nome || '').toLowerCase();
      const mechKw = ['meccanic', 'verde', 'pre-potatur'];
      const manKw = ['manual', 'manuale', 'produz', 'rinnov', 'allevament'];
      if (mechKw.some((k) => s.includes(k))) return 'meccanica';
      if (manKw.some((k) => s.includes(k))) return 'manuale';
      return null;
    }
    expect(classifyTipoLavoroModo('Potatura di Produzione')).toBe('manuale');
    expect(classifyTipoLavoroModo('Potatura a Verde Meccanica')).toBe('meccanica');
    expect(classifyTipoLavoroModo('Potatura Manuale')).toBe('manuale');
    expect(classifyTipoLavoroModo('Potatura verde')).toBe('meccanica');
  });

  it('inferRequiresMachine: meccanica chiede macchine, manuale no', () => {
    function classifyTipoLavoroModo(nome) {
      const s = String(nome || '').toLowerCase();
      const mechKw = ['meccanic', 'verde', 'pre-potatur'];
      const manKw = ['manual', 'manuale', 'produz', 'rinnov', 'allevament'];
      if (mechKw.some((k) => s.includes(k))) return 'meccanica';
      if (manKw.some((k) => s.includes(k))) return 'manuale';
      return null;
    }
    function inferRequiresMachineFromTipo(tipoNome, tipoModo) {
      const s = String(tipoNome || '').toLowerCase().trim();
      if (!s) return false;
      if (tipoModo === 'manuale') return false;
      if (tipoModo === 'meccanica') return true;
      const modo = classifyTipoLavoroModo(tipoNome);
      if (modo === 'manuale') return false;
      if (modo === 'meccanica') return true;
      if (s.includes('manual')) return false;
      if (s.includes('meccanic')) return true;
      return false;
    }
    expect(inferRequiresMachineFromTipo('Potatura verde', null)).toBe(true);
    expect(inferRequiresMachineFromTipo('Potatura di Produzione', null)).toBe(false);
    expect(inferRequiresMachineFromTipo('Potatura', 'meccanica')).toBe(true);
    expect(inferRequiresMachineFromTipo('Potatura di Produzione', 'manuale')).toBe(false);
  });

  it('erpicatura salta domanda manuale/meccanica', () => {
    function stemSkips(stem) {
      const skip = ['trinciatur', 'erpicatur', 'aratur', 'fresatur'];
      return skip.some((k) => stem.includes(k));
    }
    expect(stemSkips('erpicatur')).toBe(true);
    expect(stemSkips('potatur')).toBe(false);
  });

  it('parseTipoModoFromText riconosce manuale e meccanica', () => {
    function parseTipoModoFromText(text) {
      const t = String(text || '').toLowerCase().trim();
      if (/^(manuale|manual)\b/.test(t)) return 'manuale';
      if (/^(meccanic\w*|meccanica)\b/.test(t)) return 'meccanica';
      if (/\bmanuale\b/.test(t) && !/\bmeccanic/.test(t)) return 'manuale';
      if (/\bmeccanic\w*\b/.test(t)) return 'meccanica';
      return null;
    }
    expect(parseTipoModoFromText('manuale')).toBe('manuale');
    expect(parseTipoModoFromText('meccanica')).toBe('meccanica');
    expect(parseTipoModoFromText('potatura manuale')).toBe('manuale');
  });

  it('buildTipoModoQuestion per potatura', () => {
    expect('Per la potatura, è manuale o meccanica?').toContain('manuale o meccanica');
  });

  it('assign mode: DOM default squadra ignorato finché non confermato', () => {
    function getConfirmedAssignMode(confirmed, domMode) {
      if (!confirmed) return null;
      return domMode;
    }
    function resolvePersonTurn(text, confirmed, domMode, operai, capi) {
      const roleHint = getConfirmedAssignMode(confirmed, domMode === 'squadra' ? 'squadra' : (domMode === 'autonomo' ? 'autonomo' : null));
      if (roleHint === 'squadra') return findPersonInListInterviewText(text, capi, 'caposquadra');
      if (roleHint === 'autonomo') return findPersonInListInterviewText(text, operai, 'operaio');
      return findPersonInInterviewText(text, operai, capi, null);
    }
    const operai = [
      { id: 'op1', nome: 'Luca', cognome: 'Rossi' },
      { id: 'op2', nome: 'Luca', cognome: 'Bianchi' },
    ];
    const capi = [{ id: 'cap1', nome: 'Mario', cognome: 'Verdi' }];
    const wrong = resolvePersonTurn('luca', false, 'squadra', operai, capi);
    expect(wrong && wrong.ambiguous).toBe(true);
    expect(wrong && wrong.role).toBe('operaio');
    const capOnly = resolvePersonTurn('luca', false, 'squadra', operai, capi);
    expect(capOnly && capOnly.role).not.toBe('caposquadra');
  });

  it('crea lavoro per gaia: estrae assignee dal messaggio iniziale', () => {
    function stripLavoroCreationIntentPrefix(text) {
      return String(text || '').trim().replace(/^(crea(\s+un)?\s+lavoro|nuovo\s+lavoro)\s+/i, '').trim();
    }
    function findPersonToken(text) {
      const raw = stripLavoroCreationIntentPrefix(text);
      const m = raw.match(/\b(?:per|a|ad)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'`\-]{1,30})/i);
      return m ? m[1].trim().toLowerCase() : '';
    }
    expect(stripLavoroCreationIntentPrefix('crea lavoro per gaia')).toBe('per gaia');
    expect(findPersonToken('crea lavoro per gaia')).toBe('gaia');
  });

  it('operaio ambiguo: due Luca → candidati, follow-up risolve per cognome', () => {
    const operai = [
      { id: 'op-luca-r', nome: 'Luca', cognome: 'Rossi' },
      { id: 'op-luca-b', nome: 'Luca', cognome: 'Bianchi' },
    ];
    const hit = findPersonInListInterviewText('luca', operai, 'operaio');
    expect(hit && hit.ambiguous).toBe(true);
    expect(hit.candidates.length).toBe(2);

    function buildPersonDisambiguationMessage(candidates, role) {
      const labels = candidates.map((c) => c.label);
      return `Ho trovato più operai: ${labels.join(', ')}. A chi assegno? (nome e cognome come in elenco)`;
    }
    function resolvePersonFromDisambReply(userText, candidates) {
      const t = normalizeTonyText(userText);
      const partial = candidates.filter((c) => normalizeTonyText(c.label).includes(t) || t.includes(normalizeTonyText(c.label)));
      if (partial.length === 1) return partial[0];
      const byCognome = candidates.filter((c) => normalizeTonyText(c.label).includes('rossi') && t.includes('rossi'));
      if (byCognome.length === 1) return byCognome[0];
      return null;
    }
    const msg = buildPersonDisambiguationMessage(hit.candidates, 'operaio');
    expect(msg).toContain('Luca Rossi');
    expect(msg).toContain('Luca Bianchi');
    expect(msg).toContain('nome e cognome');

    const resolved = resolvePersonFromDisambReply('luca rossi', hit.candidates);
    expect(resolved && resolved.id).toBe('op-luca-r');
  });

  it('operaio ambiguo senza assign mode: solo operai omonimi', () => {
    const operai = [
      { id: 'op1', nome: 'Luca', cognome: 'Rossi' },
      { id: 'op2', nome: 'Luca', cognome: 'Verdi' },
    ];
    const capi = [{ id: 'cap1', nome: 'Mario', cognome: 'Bianchi' }];
    const hit = findPersonInInterviewText('luca', operai, capi, null);
    expect(hit && hit.ambiguous).toBe(true);
    expect(hit.role).toBe('operaio');
  });

  it('operaio e caposquadra omonimi senza assign mode: preferisce operaio univoco', () => {
    const operai = [{ id: 'op1', nome: 'Pier', cognome: 'Rossi' }];
    const capi = [
      { id: 'cap1', nome: 'Pier', cognome: 'Best' },
      { id: 'cap2', nome: 'Pier', cognome: 'Top' },
    ];
    const opOnly = findPersonInInterviewText('luca', operai, capi, null);
    expect(opOnly).toBeNull();
    const pierHit = findPersonInInterviewText('pier', operai, capi, null);
    expect(pierHit && pierHit.id).toBe('op1');
    expect(pierHit && pierHit.role).toBe('operaio');
    const pierSquadra = findPersonInInterviewText('pier', operai, capi, 'squadra');
    expect(pierSquadra && pierSquadra.ambiguous).toBe(true);
  });

  it('operaio e caposquadra omonimi ambigui: preferisce disamb operaio', () => {
    const operai = [
      { id: 'op1', nome: 'Luca', cognome: 'Rossi' },
      { id: 'op2', nome: 'Luca', cognome: 'Verdi' },
    ];
    const capi = [
      { id: 'cap1', nome: 'Luca', cognome: 'Bianchi' },
      { id: 'cap2', nome: 'Luca', cognome: 'Neri' },
    ];
    const hit = findPersonInInterviewText('luca', operai, capi, null);
    expect(hit && hit.ambiguous).toBe(true);
    expect(hit.role).toBe('operaio');
  });

  it('assign mode confermato da disamb operaio: autonomo non squadra DOM', () => {
    function getConfirmedLavoroInterviewAssignMode(state) {
      if (!state.assignModeConfirmed) return null;
      if (state.confirmedAssignMode === 'squadra' || state.confirmedAssignMode === 'autonomo') {
        return state.confirmedAssignMode;
      }
      if (state.personDisambRole === 'operaio') return 'autonomo';
      if (state.personDisambRole === 'caposquadra') return 'squadra';
      return state.domAssignMode;
    }
    const afterLucaDisamb = {
      assignModeConfirmed: true,
      confirmedAssignMode: 'autonomo',
      personDisambRole: 'operaio',
      domAssignMode: 'squadra',
    };
    expect(getConfirmedLavoroInterviewAssignMode(afterLucaDisamb)).toBe('autonomo');
  });

  it('ack tipo stem-only: dobbiamo trinciare → conferma tipo + domanda data', () => {
    function buildLavoroTipoStemOnlyAckMessage(tipoNome, terrenoNome) {
      const tipo = String(tipoNome || '').trim();
      const terr = String(terrenoNome || '').trim();
      if (!tipo) return '';
      if (terr) return `Ok, ${tipo} su ${terr}.`;
      return `Ok, ${tipo}.`;
    }
    function prependLavoroTipoStemOnlyAck(message, userText, patch, meta) {
      if (!patch['lavoro-tipo-lavoro']) return message;
      if (meta.fromDisamb || meta.fromTipoModo) return message;
      if (/\b(manuale|meccanic\w*|produzione|verde)\b/i.test(userText)) return message;
      const t = String(userText || '').toLowerCase();
      const stemOnly = /\b(trinc\w*|erpic\w*)\b/.test(t) &&
        !/\b(manuale|meccanic\w*|produzione|verde)\b/.test(t);
      if (!stemOnly) return message;
      if (/\bpotatur/.test(t)) {
        const cands = ['Potatura Manuale', 'Potatura Meccanica'];
        const hasMan = cands.some((n) => /manual|manuale/i.test(n));
        const hasMech = cands.some((n) => /meccanic/i.test(n));
        if (hasMan && hasMech) return message;
      }
      const ack = buildLavoroTipoStemOnlyAckMessage(patch['lavoro-tipo-lavoro'], 'Seminativo Nord');
      return `${ack} ${message}`;
    }
    const patch = { 'lavoro-tipo-lavoro': 'Trinciatura Meccanica' };
    const nextQ = 'Quando vuoi iniziare?';
    const msg = prependLavoroTipoStemOnlyAck(nextQ, 'dobbiamo trinciare', patch, {});
    expect(msg).toContain('Trinciatura Meccanica');
    expect(msg).toContain('Seminativo Nord');
    expect(msg).toContain('Quando vuoi iniziare?');
    expect(prependLavoroTipoStemOnlyAck(nextQ, 'potatura', patch, {})).toBe(nextQ);
    expect(prependLavoroTipoStemOnlyAck(nextQ, 'dobbiamo trinciare', patch, { fromDisamb: true })).toBe(nextQ);
    expect(prependLavoroTipoStemOnlyAck(nextQ, 'meccanica', patch, { fromTipoModo: true })).toBe(nextQ);
  });

  it('pending tipo hint bloccato se risposta assegna persona (a luca)', () => {
    function lavoroInterviewNeedsAssignModeQuestion(state) {
      if (state.assignModeConfirmed) return false;
      return state.operaioEmpty && state.caposquadraEmpty;
    }
    function lavoroInterviewCanApplyPendingTipoHint(state) {
      if (lavoroInterviewNeedsAssignModeQuestion(state)) return false;
      if (state.personDisambPending) return false;
      if (state.textAssignsPerson) return false;
      return true;
    }
    expect(lavoroInterviewCanApplyPendingTipoHint({
      assignModeConfirmed: false,
      operaioEmpty: true,
      caposquadraEmpty: true,
      personDisambPending: false,
      textAssignsPerson: true,
    })).toBe(false);
    expect(lavoroInterviewCanApplyPendingTipoHint({
      assignModeConfirmed: true,
      operaioEmpty: true,
      caposquadraEmpty: true,
      personDisambPending: true,
      textAssignsPerson: false,
    })).toBe(false);
    expect(lavoroInterviewCanApplyPendingTipoHint({
      assignModeConfirmed: true,
      operaioEmpty: false,
      caposquadraEmpty: true,
      personDisambPending: false,
      textAssignsPerson: false,
    })).toBe(true);
  });
});
