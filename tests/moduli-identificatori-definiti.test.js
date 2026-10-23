/**
 * I moduli toccati dalla PR non devono riferire un nome che non è
 * importato, dichiarato o un globale noto. È il controllo che avrebbe
 * preso la rimozione di formatPosizioneRilevamentoCompactHtml.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MODULI = [
  'core/js/attivita-controller.js',
  'core/js/attivita-maps.js',
  'core/js/dashboard-briefing-helpers.js',
  'core/js/dashboard-counts-snapshot.js',
  'core/js/dashboard-data.js',
  'core/js/dashboard-deadlines.js',
  'core/js/dashboard-meteo.js',
  'core/js/dashboard-quick-bar.js',
  'core/js/lavoro-progresso-display.js',
  'core/admin/js/gestione-lavori-controller.js',
  'core/admin/js/gestione-lavori-maps.js',
  'core/services/zone-lavorate-area.js',
  'core/services/zone-lavorate-permessi.js',
  'modules/vendemmia-meccanica/js/vm-zone-mappa.js',
  'modules/vendemmia-meccanica/services/lavoro-piano-sync-service.js',
  'modules/vendemmia-meccanica/services/piano-stagione-service.js',
  'modules/vendemmia-meccanica/services/zone-escluse-service.js',
];

const PAGINE = [
  'core/admin/gestione-lavori-standalone.html',
  'core/admin/lavori-caposquadra-standalone.html',
  'core/attivita-standalone.html',
  'core/dashboard-standalone.html',
  'modules/vendemmia-meccanica/views/piano-stagione-standalone.html',
];

/**
 * Nomi già liberi su origin/develop, fuori da questa PR.
 * dashboard-data: loadLavoriOggiOperaio legge caposquadraId senza dichiararlo.
 * dashboard: deleteDoc è chiamato senza essere nell'import di firebase-service.
 */
const PREESISTENTI = {
  'core/js/dashboard-data.js': new Set(['caposquadraId']),
  'core/dashboard-standalone.html': new Set(['deleteDoc']),
};

const GLOBALI = new Set([
  'undefined', 'NaN', 'Infinity',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt',
  'Math', 'Date', 'JSON', 'RegExp', 'Error', 'TypeError', 'RangeError',
  'SyntaxError', 'ReferenceError', 'URIError', 'EvalError', 'AggregateError',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect',
  'Intl', 'ArrayBuffer', 'DataView',
  'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array',
  'Float32Array', 'Float64Array', 'TextEncoder', 'TextDecoder',
  'URL', 'URLSearchParams',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'atob', 'btoa', 'structuredClone', 'queueMicrotask',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback',
  'console', 'window', 'document', 'navigator', 'location', 'history',
  'localStorage', 'sessionStorage', 'fetch', 'alert', 'confirm', 'prompt',
  'performance', 'crypto', 'self', 'globalThis', 'top', 'parent',
  'CustomEvent', 'Event', 'KeyboardEvent', 'MouseEvent', 'PointerEvent',
  'FormData', 'Blob', 'File', 'FileReader', 'AbortController',
  'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
  'HTMLElement', 'Element', 'Node', 'NodeList', 'DOMParser',
  'Image', 'Option', 'Headers', 'Request', 'Response',
  'google', 'firebase', 'firebaseConfig', 'db', 'auth', 'storage',
  'currentTenantId', 'currentUser', 'currentUserData', 'Tony',
  'arguments',
]);

function parseModulo(sorgente) {
  return parse(sorgente, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    locations: true,
  });
}

function estraiScript(html) {
  const script = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    const modulo = /\btype\s*=\s*["']module["']/i.test(match[1]);
    const src = (match[2] || '').trim();
    if (!src) continue;
    script.push({ modulo, src });
  }
  return script;
}

function nomeAssegnatoSuWindow(node) {
  if (!node || node.type !== 'AssignmentExpression') return null;
  const left = node.left;
  if (!left || left.type !== 'MemberExpression' || left.computed) return null;
  if (!left.object || left.object.type !== 'Identifier' || left.object.name !== 'window') return null;
  if (!left.property || left.property.type !== 'Identifier') return null;
  return left.property.name;
}

function patternNomi(nodo, out) {
  if (!nodo) return;
  if (nodo.type === 'Identifier') out.push(nodo.name);
  else if (nodo.type === 'ObjectPattern') {
    nodo.properties.forEach((p) => patternNomi(p.type === 'RestElement' ? p.argument : p.value, out));
  } else if (nodo.type === 'ArrayPattern') nodo.elements.forEach((el) => patternNomi(el, out));
  else if (nodo.type === 'RestElement') patternNomi(nodo.argument, out);
  else if (nodo.type === 'AssignmentPattern') patternNomi(nodo.left, out);
}

function istruzioneUtile(stmt) {
  if (!stmt) return null;
  if ((stmt.type === 'ExportNamedDeclaration' || stmt.type === 'ExportDefaultDeclaration') && stmt.declaration) {
    return stmt.declaration;
  }
  return stmt;
}

/** Binding del blocco, visibili in tutto il blocco (anche alle closure dichiarate prima). */
function bindingDelBlocco(body) {
  const nomi = [];
  const lista = Array.isArray(body) ? body : [];
  lista.forEach((stmt) => {
    const inner = istruzioneUtile(stmt);
    if (!inner) return;
    if ((inner.type === 'FunctionDeclaration' || inner.type === 'ClassDeclaration') && inner.id) {
      nomi.push(inner.id.name);
    }
    if (inner.type === 'VariableDeclaration') {
      inner.declarations.forEach((d) => patternNomi(d.id, nomi));
    }
  });
  return nomi;
}

function identificatoriLiberi(sorgente, extraGlobali) {
  const ast = parseModulo(sorgente);
  const scopeStack = [new Set(extraGlobali || [])];
  const liberi = new Map();

  function dichiara(nome) {
    if (nome) scopeStack[scopeStack.length - 1].add(nome);
  }
  function risolto(nome) {
    if (GLOBALI.has(nome)) return true;
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      if (scopeStack[i].has(nome)) return true;
    }
    return false;
  }
  function segna(node) {
    if (!risolto(node.name) && !liberi.has(node.name)) {
      liberi.set(node.name, node.loc.start.line);
    }
  }

  ast.body.forEach((stmt) => {
    if (stmt.type !== 'ImportDeclaration') return;
    stmt.specifiers.forEach((s) => scopeStack[0].add(s.local.name));
  });
  bindingDelBlocco(ast.body).forEach((nome) => scopeStack[0].add(nome));

  const skipKeys = new Set(['type', 'start', 'end', 'loc', 'range', 'sourceType']);

  function walk(node, parent) {
    if (!node || typeof node.type !== 'string') return;

    const apreBlocco = node.type === 'BlockStatement' || node.type === 'StaticBlock' || node.type === 'SwitchStatement';
    const apreFunzione = node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression';
    const apreFor = node.type === 'ForStatement' || node.type === 'ForInStatement' || node.type === 'ForOfStatement';
    const apre = apreBlocco || apreFunzione || apreFor || node.type === 'CatchClause' || node.type === 'ClassExpression';
    if (apre) scopeStack.push(new Set());

    if (apreFunzione) {
      const params = [];
      (node.params || []).forEach((p) => patternNomi(p, params));
      params.forEach(dichiara);
      if (node.id && node.type !== 'FunctionDeclaration') dichiara(node.id.name);
    }
    if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id) dichiara(node.id.name);
    if (node.type === 'CatchClause' && node.param) {
      const nomi = [];
      patternNomi(node.param, nomi);
      nomi.forEach(dichiara);
    }
    if (apreFor && node.left && node.left.type === 'VariableDeclaration') {
      const nomi = [];
      node.left.declarations.forEach((d) => patternNomi(d.id, nomi));
      nomi.forEach(dichiara);
    }
    if (node.type === 'BlockStatement' || node.type === 'StaticBlock') {
      bindingDelBlocco(node.body).forEach(dichiara);
    }
    if (node.type === 'VariableDeclaration') {
      const nomi = [];
      node.declarations.forEach((d) => patternNomi(d.id, nomi));
      nomi.forEach(dichiara);
    }
    const daWindow = nomeAssegnatoSuWindow(node);
    if (daWindow) scopeStack[0].add(daWindow);

    if (node.type === 'Identifier' && eUso(node, parent)) segna(node);

    for (const key of Object.keys(node)) {
      if (skipKeys.has(key) || chiaveDaSaltare(node, key)) continue;
      const child = node[key];
      if (Array.isArray(child)) child.forEach((c) => walk(c, node));
      else if (child && typeof child.type === 'string') walk(child, node);
    }

    if (apre) scopeStack.pop();
  }

  walk(ast, null);
  return liberi;
}

function chiaveDaSaltare(node, key) {
  if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    return key === 'id' || key === 'params';
  }
  if (node.type === 'VariableDeclarator') return key === 'id';
  if (node.type === 'CatchClause') return key === 'param';
  if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') return key === 'id';
  if (node.type === 'ImportDeclaration' || node.type === 'ImportSpecifier' || node.type === 'ImportDefaultSpecifier' || node.type === 'ImportNamespaceSpecifier') return true;
  if (node.type === 'ExportSpecifier') return key === 'exported' || key === 'local';
  if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration' || node.type === 'ExportAllDeclaration') {
    return key === 'specifiers';
  }
  if ((node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') && key === 'property' && !node.computed) return true;
  if (node.type === 'Property' && key === 'key' && !node.computed) return true;
  if ((node.type === 'MethodDefinition' || node.type === 'PropertyDefinition') && key === 'key' && !node.computed) return true;
  if (node.type === 'MetaProperty') return true;
  if (node.type === 'BreakStatement' || node.type === 'ContinueStatement') return key === 'label';
  if (node.type === 'LabeledStatement') return key === 'label';
  if ((node.type === 'ForInStatement' || node.type === 'ForOfStatement') && key === 'left' && node.left && node.left.type === 'VariableDeclaration') return true;
  if (node.type === 'ForStatement' && key === 'init' && node.init && node.init.type === 'VariableDeclaration') {
    return false;
  }
  return false;
}

function eUso(node, parent) {
  if (!parent) return true;
  if (parent.type === 'ExportSpecifier') return false;
  return true;
}

function globaliDiPagina(script) {
  const nomi = new Set();
  script.forEach(({ modulo, src }) => {
    let ast;
    try {
      ast = parse(src, { ecmaVersion: 'latest', sourceType: modulo ? 'module' : 'script' });
    } catch {
      return;
    }
    const stack = [ast];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node.type !== 'string') continue;
      const daWindow = nomeAssegnatoSuWindow(node);
      if (daWindow) nomi.add(daWindow);
      if (!modulo && node.type === 'FunctionDeclaration' && node.id) nomi.add(node.id.name);
      if (!modulo && node.type === 'VariableDeclaration' && node.kind === 'var') {
        const raccolti = [];
        (node.declarations || []).forEach((d) => patternNomi(d.id, raccolti));
        raccolti.forEach((n) => nomi.add(n));
      }
      for (const key of Object.keys(node)) {
        const child = node[key];
        if (Array.isArray(child)) child.forEach((c) => c && c.type && stack.push(c));
        else if (child && child.type) stack.push(child);
      }
    }
  });
  return nomi;
}

function controlla(rel, sorgente, extra, consentiti) {
  const liberi = identificatoriLiberi(sorgente, extra);
  const rimasti = [...liberi.entries()]
    .filter(([nome]) => !consentiti || !consentiti.has(nome))
    .map(([nome, riga]) => `${nome}:${riga}`);
  expect(rimasti, rel).toEqual([]);
}

describe('identificatori definiti nei moduli della PR', () => {
  it('segnala un nome usato senza import', () => {
    const src = 'export function render() { return formatPosizioneRilevamentoCompactHtml(null); }\n';
    const liberi = identificatoriLiberi(src, null);
    expect([...liberi.keys()]).toContain('formatPosizioneRilevamentoCompactHtml');
  });

  it.each(MODULI)('%s non usa nomi privi di import o dichiarazione', (rel) => {
    controlla(rel, readFileSync(path.join(root, rel), 'utf8'), null, PREESISTENTI[rel]);
  });

  it.each(PAGINE)('%s: gli script module non usano nomi privi di import', (rel) => {
    const html = readFileSync(path.join(root, rel), 'utf8');
    const script = estraiScript(html);
    const moduli = script.filter((s) => s.modulo);
    expect(moduli.length, rel).toBeGreaterThan(0);
    const extra = globaliDiPagina(script);
    moduli.forEach((s, i) => controlla(`${rel}#module${i + 1}`, s.src, extra, PREESISTENTI[rel]));
  });
});
