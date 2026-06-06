import { describe, expect, it } from 'vitest';

const ATTREZZI = [
  { id: 'id-erpice-200', nome: 'Erpice 200 cm' },
  { id: 'id-erpice-denti', nome: 'Erpice a denti' }
];

function normalizeTonyText(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function dedupeAttrezziRecords(list) {
  const seen = {};
  return (list || []).filter((at) => {
    if (!at) return false;
    const id = String(at.id || at.nome || '');
    if (seen[id]) return false;
    seen[id] = 1;
    return true;
  });
}

function findAttrezzoInUserText(userText, atList) {
  if (!userText || !Array.isArray(atList) || !atList.length) return null;
  const t = normalizeTonyText(userText);
  if (!t) return null;
  let matches = [];
  for (let i = 0; i < atList.length; i++) {
    const at = atList[i];
    if (!at) continue;
    const nome = normalizeTonyText(at.nome || '');
    if (nome.length >= 3 && t.indexOf(nome) >= 0) {
      matches.push(at);
      continue;
    }
    const tokens = nome.split(/\s+/).filter((w) => w.length >= 2);
    for (let j = 0; j < tokens.length; j++) {
      if (t.indexOf(tokens[j]) >= 0) {
        matches.push(at);
        break;
      }
    }
  }
  matches = dedupeAttrezziRecords(matches);
  if (matches.length === 1) return matches[0];

  if (t.length >= 2 && t.length <= 24) {
    const shortMatches = [];
    const tCompact = t.replace(/\s+/g, '');
    for (let k = 0; k < atList.length; k++) {
      const at2 = atList[k];
      if (!at2) continue;
      const n2 = normalizeTonyText(at2.nome || '');
      if (!n2) continue;
      if (n2.indexOf(t) >= 0) {
        shortMatches.push(at2);
        continue;
      }
      const nCompact = n2.replace(/\s+/g, '');
      if (tCompact && nCompact.indexOf(tCompact) >= 0) shortMatches.push(at2);
    }
    const deduped = dedupeAttrezziRecords(shortMatches);
    if (deduped.length === 1) return deduped[0];
    if (deduped.length > 1) matches = matches.concat(deduped);
  }

  matches = dedupeAttrezziRecords(matches);
  if (matches.length === 1) return matches[0];

  const userNums = (t.match(/\d+/g) || []).filter((d) => d.length >= 2);
  if (userNums.length >= 1) {
    let numPool = matches.length > 1 ? matches : atList;
    for (let ni = 0; ni < userNums.length; ni++) {
      const numHits = numPool.filter((at) => normalizeTonyText(at.nome || '').indexOf(userNums[ni]) >= 0);
      const deduped = dedupeAttrezziRecords(numHits);
      if (deduped.length === 1) return deduped[0];
      if (deduped.length > 0) numPool = deduped;
    }
  }

  const userTokens = t.split(/\s+/).filter((w) => w.length >= 2 || /^\d+$/.test(w));
  if (userTokens.length >= 2) {
    const tokenPool = matches.length > 1 ? dedupeAttrezziRecords(matches) : atList;
    const tokenHits = tokenPool.filter((at) => {
      const nome = normalizeTonyText(at.nome || '');
      return userTokens.every((w) => nome.indexOf(w) >= 0);
    });
    const dedupedTok = dedupeAttrezziRecords(tokenHits);
    if (dedupedTok.length === 1) return dedupedTok[0];
  }

  const exact = matches.filter((at) => {
    const n = normalizeTonyText(at.nome || '');
    return t === n || (n.length >= 4 && t.indexOf(n) >= 0);
  });
  return exact.length === 1 ? exact[0] : null;
}

describe('findAttrezzoInUserText (disambiguazione lavoro)', () => {
  it('matcha alias erpice 200 su Erpice 200 cm', () => {
    const hit = findAttrezzoInUserText('erpice 200', ATTREZZI);
    expect(hit && hit.nome).toBe('Erpice 200 cm');
  });

  it('matcha alias corto 200 su Erpice 200 cm', () => {
    const hit = findAttrezzoInUserText('200', ATTREZZI);
    expect(hit && hit.nome).toBe('Erpice 200 cm');
  });

  it('matcha erpice a denti', () => {
    const hit = findAttrezzoInUserText('denti', ATTREZZI);
    expect(hit && hit.nome).toBe('Erpice a denti');
  });

  it('non matcha testo ambiguo erpice tra più attrezzi', () => {
    const hit = findAttrezzoInUserText('erpice', ATTREZZI);
    expect(hit).toBeNull();
  });

  it('matcha erpice 200 su erpice rotante 200 vs 350', () => {
    const rotanti = [
      { id: 'at-200', nome: 'erpice rotante 200' },
      { id: 'at-350', nome: 'erpice rotante 350' },
    ];
    expect(findAttrezzoInUserText('erpice 200', rotanti)?.id).toBe('at-200');
    expect(findAttrezzoInUserText('Erpice 200', rotanti)?.id).toBe('at-200');
    expect(findAttrezzoInUserText('200', rotanti)?.id).toBe('at-200');
  });
});

describe('attrezziCompatibiliConTrattoreCv (filtro CV inverso)', () => {
  function attrezziCompatibiliConTrattoreCv(trattore, attrezziList) {
    if (!Array.isArray(attrezziList)) return [];
    if (!trattore) return attrezziList.slice();
    const cv = Number(trattore.cavalli);
    if (!Number.isFinite(cv) || cv <= 0) return attrezziList.slice();
    return attrezziList.filter((a) => {
      if (!a) return false;
      const min = Number(a.cavalliMinimiRichiesti);
      if (!Number.isFinite(min) || min <= 0) return true;
      return cv >= min;
    });
  }

  const attrezzi = [
    { id: 'at-200', nome: 'erpice rotante 200', cavalliMinimiRichiesti: 40 },
    { id: 'at-350', nome: 'erpice rotante 350', cavalliMinimiRichiesti: 100 },
  ];

  it('Agrifull 80 CV → solo erpice 200', () => {
    const hit = attrezziCompatibiliConTrattoreCv({ nome: 'Agrifull', cavalli: 80 }, attrezzi);
    expect(hit.map((a) => a.id)).toEqual(['at-200']);
  });

  it('Nuovo T5 100 CV → entrambi gli erpici', () => {
    const hit = attrezziCompatibiliConTrattoreCv({ nome: 'Nuovo T5', cavalli: 100 }, attrezzi);
    expect(hit.length).toBe(2);
  });
});

function shouldAskAttrezzoDisambigFromTipo(inferredCount, hasAtHint, formData) {
  if (inferredCount <= 1) return false;
  if (hasAtHint) return true;
  const trInForm = !!(formData && formData['lavoro-trattore'] && String(formData['lavoro-trattore']).trim());
  return trInForm;
}

describe('shouldAskAttrezzoDisambigFromTipo (ordine trattore → attrezzo)', () => {
  it('non chiede attrezzo da tipo se trattore assente e utente non ha detto attrezzo', () => {
    expect(shouldAskAttrezzoDisambigFromTipo(2, false, {})).toBe(false);
  });

  it('chiede attrezzo da tipo se trattore già in formData', () => {
    expect(shouldAskAttrezzoDisambigFromTipo(2, false, { 'lavoro-trattore': 'Nuovo T5' })).toBe(true);
  });

  it('chiede attrezzo se utente ha indicato attrezzo nel messaggio (hasAtHint)', () => {
    expect(shouldAskAttrezzoDisambigFromTipo(2, true, {})).toBe(true);
  });
});
