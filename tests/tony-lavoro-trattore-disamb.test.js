import { describe, expect, it } from 'vitest';

const TRATTORI = [
  { id: 'id-agrifull', nome: 'Agrifull' },
  { id: 'id-nuovo-t5', nome: 'Nuovo T5' }
];

function normalizeTonyText(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function dedupeTrattoriRecords(list) {
  const seen = {};
  return (list || []).filter((tr) => {
    if (!tr) return false;
    const id = String(tr.id || tr.nome || '');
    if (seen[id]) return false;
    seen[id] = 1;
    return true;
  });
}

function findTrattoreInUserText(userText, trList) {
  if (!userText || !Array.isArray(trList) || !trList.length) return null;
  const t = normalizeTonyText(userText);
  if (!t) return null;
  let matches = [];
  for (let i = 0; i < trList.length; i++) {
    const tr = trList[i];
    if (!tr) continue;
    const nome = normalizeTonyText(tr.nome || '');
    if (nome.length >= 3 && t.indexOf(nome) >= 0) {
      matches.push(tr);
      continue;
    }
    const tokens = nome.split(/\s+/).filter((w) => w.length >= 3);
    for (let j = 0; j < tokens.length; j++) {
      if (t.indexOf(tokens[j]) >= 0) {
        matches.push(tr);
        break;
      }
    }
  }
  matches = dedupeTrattoriRecords(matches);
  if (matches.length === 1) return matches[0];

  if (t.length >= 2 && t.length <= 16) {
    const shortMatches = [];
    const tCompact = t.replace(/\s+/g, '');
    for (let k = 0; k < trList.length; k++) {
      const tr2 = trList[k];
      if (!tr2) continue;
      const n2 = normalizeTonyText(tr2.nome || '');
      if (!n2) continue;
      if (n2.indexOf(t) >= 0) {
        shortMatches.push(tr2);
        continue;
      }
      const nCompact = n2.replace(/\s+/g, '');
      if (tCompact && nCompact.indexOf(tCompact) >= 0) shortMatches.push(tr2);
    }
    const deduped = dedupeTrattoriRecords(shortMatches);
    if (deduped.length === 1) return deduped[0];
    if (deduped.length > 1) matches = matches.concat(deduped);
  }

  matches = dedupeTrattoriRecords(matches);
  if (matches.length === 1) return matches[0];
  const exact = matches.filter((tr) => {
    const n = normalizeTonyText(tr.nome || '');
    return t === n || (n.length >= 4 && t.indexOf(n) >= 0);
  });
  return exact.length === 1 ? exact[0] : null;
}

describe('findTrattoreInUserText (disambiguazione lavoro)', () => {
  it('matcha alias corto t5 su Nuovo T5', () => {
    const hit = findTrattoreInUserText('t5', TRATTORI);
    expect(hit && hit.nome).toBe('Nuovo T5');
  });

  it('matcha nome parziale agrifull', () => {
    const hit = findTrattoreInUserText('agrifull', TRATTORI);
    expect(hit && hit.nome).toBe('Agrifull');
  });

  it('non matcha testo ambiguo tra più trattori', () => {
    const hit = findTrattoreInUserText('trattore', TRATTORI);
    expect(hit).toBeNull();
  });
});
