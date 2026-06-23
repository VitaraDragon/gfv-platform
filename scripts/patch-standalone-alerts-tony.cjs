const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const tonyBlockRe = /<!-- Tony widget[^>]* -->[\s\S]*?<script>\s*\(function\(\)\s*\{[\s\S]*?tony-widget-standalone\.js[\s\S]*?\}\)\(\);\s*<\/script>/g;

const shellLoader = `<!-- GFV standalone shell: alert toast + Tony gated -->
    <script>
    (function() {
      var path = (window.location.pathname || '').replace(/\\\\/g, '/');
      var isGH = path.indexOf('/gfv-platform/') >= 0;
      var base = isGH ? (window.location.origin + '/gfv-platform/core') : (path.indexOf('/core/admin/') >= 0 ? '../' : (path.indexOf('/modules/') >= 0 ? '../../../core/' : ''));
      var sep = (base && !base.endsWith('/')) ? '/' : '';
      var s = document.createElement('script');
      s.src = (base ? base + sep : '') + 'js/gfv-standalone-shell.js';
      document.body.appendChild(s);
    })();
    </script>`;

const showAlertRes = [
  [
    /function showAlert\(message, type = 'success'\) \{[\s\S]*?getElementById\('alert-container'\)[\s\S]*?\n        \}/g,
    "function showAlert(message, type = 'success') {\n            if (typeof window.gfvShowAlert === 'function') { window.gfvShowAlert(message, type); return; }\n            console.warn('[showAlert] gfvShowAlert non disponibile:', message);\n        }"
  ],
  [
    /function showAlert\(message, type = 'info'\) \{[\s\S]*?getElementById\('alert-container'\)[\s\S]*?\n        \}/g,
    "function showAlert(message, type = 'info') {\n            if (typeof window.gfvShowAlert === 'function') { window.gfvShowAlert(message, type); return; }\n            console.warn('[showAlert] gfvShowAlert non disponibile:', message);\n        }"
  ],
  [
    /function showAlert\(message, type\) \{[\s\S]*?getElementById\('alert-container'\)[\s\S]*?\n        \}/g,
    "function showAlert(message, type) {\n            if (typeof window.gfvShowAlert === 'function') { window.gfvShowAlert(message, type || 'info'); return; }\n            console.warn('[showAlert] gfvShowAlert non disponibile:', message);\n        }"
  ],
  [
    /function showAlert\(msg, type\) \{[\s\S]*?getElementById\('alert-container'\)[\s\S]*?\n            \}/g,
    "function showAlert(msg, type) {\n                if (typeof window.gfvShowAlert === 'function') { window.gfvShowAlert(msg, type || 'info'); return; }\n                console.warn('[showAlert] gfvShowAlert non disponibile:', msg);\n            }"
  ]
];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walk(p, out);
    } else if (ent.name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

let tonyCount = 0;
let alertCount = 0;
const changedFiles = [];

for (const file of walk(root)) {
  let src = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (tonyBlockRe.test(src)) {
    src = src.replace(tonyBlockRe, shellLoader);
    tonyCount += 1;
    changed = true;
  }

  for (const [re, rep] of showAlertRes) {
    const before = src;
    src = src.replace(re, rep);
    if (src !== before) {
      alertCount += 1;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, src, 'utf8');
    changedFiles.push(path.relative(root, file));
  }
}

console.log('Tony blocks replaced:', tonyCount);
console.log('showAlert patterns replaced:', alertCount);
console.log('Files changed:', changedFiles.length);
