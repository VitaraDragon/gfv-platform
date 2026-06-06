#!/usr/bin/env node
/**
 * Review log [Tony Perf] da produzione (gcloud) + smoke test router locale.
 * Uso: node scripts/tony-perf-log-review.mjs [--days=7] [--limit=100]
 */

import { execSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { classifyTonyIntentShadow } = require("../functions/tony-intent-router.js");
const { isTonyMeteoQuestion } = require("../functions/meteo-service.js");
const { isTonyOperationalCreationIntent } = require("../functions/tony-quick-replies.js");
const { tryTonyNavQuickReply } = require("../functions/tony-nav-quick-reply.js");
const { tryTonyFilterTableQuickReply } = require("../functions/tony-filter-table-quick-reply.js");

const args = process.argv.slice(2);
const days = Number((args.find((a) => a.startsWith("--days=")) || "--days=7").split("=")[1]);
const limit = Number((args.find((a) => a.startsWith("--limit=")) || "--limit=100").split("=")[1]);
const project = process.env.GCLOUD_PROJECT || "gfv-platform";

const SCENARIOS = [
  { id: 1, msg: "quanto costa trinciatura in collina?", expect: { binario: "A", quickOrGemini: "quick" } },
  { id: 2, msg: "quante tariffe attive ho?", expect: { binario: "A", quickOrGemini: "quick" } },
  { id: 3, msg: "domani posso trinciare il pinot?", expect: { meteo: true, binario: "A" } },
  { id: 4, msg: "posso erpicare domani nel casetti?", expect: { meteo: true, binario: "A" } },
  { id: 5, msg: "portami alle tariffe", expect: { binario: "B" } },
  {
    id: 6,
    msg: "crea un lavoro di trinciatura per luca nel pinot inizio domani durata 3 gg usando agrifull e trincia",
    expect: { binario: "C", tier: "T4", notMeteoQuick: true },
  },
  { id: 7, msg: "RIASSUNTO", expect: { binario: "B" } },
  {
    id: 8,
    msg: "domani trattamento, ho scorte di concime basse e che meteo c'è?",
    expect: { ambiguous: true, tier: "T4" },
  },
];

const ctxManager = {
  moduli_attivi: ["tony", "contoTerzi", "magazzino", "parcoMacchine", "manodopera", "meteo"],
  dashboard: { moduli_attivi: ["tony", "contoTerzi", "magazzino", "parcoMacchine", "manodopera", "meteo"] },
};

function fetchLogs(serviceName = "tonyask") {
  const filter =
    `resource.type="cloud_run_revision" AND resource.labels.service_name="${serviceName}" AND textPayload:"Tony Perf"`;
  const cmd = `gcloud logging read ${JSON.stringify(filter)} --project=${project} --limit=${limit} --format=json --freshness=${days}d`;
  try {
    const out = execSync(cmd, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024, shell: true });
    return JSON.parse(out || "[]");
  } catch (e) {
    console.error(`Errore gcloud logging read (${serviceName}):`, e.message?.slice(0, 500));
    return [];
  }
}

function parsePerfEntries(entries) {
  return entries
    .map((e) => {
      const raw = e.textPayload || "";
      const m = raw.match(/\[Tony Perf\]\s*(\{[\s\S]*\})/);
      if (!m) return null;
      try {
        const p = JSON.parse(m[1]);
        return { ...p, timestamp: e.timestamp };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function pct(arr, fn) {
  if (!arr.length) return "n/a";
  return `${Math.round((arr.filter(fn).length / arr.length) * 100)}%`;
}

function median(nums) {
  const s = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function runBinarioBQuickSmoke() {
  console.log("\n=== Smoke quick reply binario B (nav / filter / riassunto) ===\n");
  const ctxB = {
    moduli_attivi: ctxManager.moduli_attivi,
    dashboard: ctxManager.dashboard,
    page: {
      tableDataSummary: "Ci sono 8 tariffe. 6 attive.",
      currentTableData: { pageType: "tariffe", summary: "Ci sono 8 tariffe. 6 attive.", items: [] },
    },
  };
  const checks = [
    {
      label: "portami alle tariffe",
      hit: tryTonyNavQuickReply({ message: "portami alle tariffe", ctx: ctxManager }),
      expectId: "nav",
      expectCmd: "APRI_PAGINA",
    },
    {
      label: "RIASSUNTO da tariffe",
      hit: tryTonyNavQuickReply({ message: "RIASSUNTO", ctx: ctxB }),
      expectId: "riassunto_tabella",
      expectCmd: "RIASSUNTO",
    },
    {
      label: "solo attivi prodotti",
      hit: tryTonyFilterTableQuickReply({
        message: "solo attivi",
        ctx: {
          page: { currentTableData: { pageType: "prodotti", items: [] } },
        },
      }),
      expectId: "filter_table_prodotti_attivo",
      expectCmd: "FILTER_TABLE",
    },
  ];
  let ok = 0;
  for (const c of checks) {
    const pass =
      c.hit &&
      c.hit.id === c.expectId &&
      (!c.expectCmd || (c.hit.command && c.hit.command.type === c.expectCmd));
    if (pass) ok++;
    console.log(`${pass ? "✓" : "✗"} ${c.label} → id=${c.hit?.id || "null"} cmd=${c.hit?.command?.type || "-"}`);
  }
  console.log(`\nBinario B quick: ${ok}/${checks.length} OK (usedGemini=false atteso in CF)\n`);
  return ok === checks.length;
}

function runLocalRouterSmoke() {
  console.log("\n=== Smoke test router locale (8 scenari) ===\n");
  let ok = 0;
  for (const s of SCENARIOS) {
    const r = classifyTonyIntentShadow({ message: s.msg, ctx: ctxManager });
    const meteoQ = isTonyMeteoQuestion(s.msg);
    const creation = isTonyOperationalCreationIntent(s.msg);
    const checks = [];
    if (s.expect.binario && r.binario !== s.expect.binario) checks.push(`binario atteso ${s.expect.binario}, got ${r.binario}`);
    if (s.expect.shadowBinario && r.binario !== s.expect.shadowBinario) checks.push(`shadowBinario atteso ${s.expect.shadowBinario}, got ${r.binario}`);
    if (s.expect.tier && r.tierCalculated !== s.expect.tier) checks.push(`tier atteso ${s.expect.tier}, got ${r.tierCalculated}`);
    if (s.expect.ambiguous && !r.ambiguous) checks.push("ambiguous atteso true");
    if (s.expect.meteo && !meteoQ) checks.push("isTonyMeteoQuestion false");
    if (s.expect.notMeteoQuick && meteoQ && creation) checks.push("creazione+meteo conflitto");
    if (s.expect.notMeteoQuick && creation !== true) checks.push("isTonyOperationalCreationIntent false");
    const pass = checks.length === 0;
    if (pass) ok++;
    console.log(`${pass ? "✓" : "✗"} #${s.id} ${s.msg.slice(0, 50)}${s.msg.length > 50 ? "…" : ""}`);
    console.log(`   router: binario=${r.binario} tierCalc=${r.tierCalculated} tierUsed=${r.tierUsed} ambiguous=${r.ambiguous} meteoQ=${meteoQ} crea=${creation}`);
    if (checks.length) checks.forEach((c) => console.log(`   ⚠ ${c}`));
  }
  console.log(`\nLocale: ${ok}/${SCENARIOS.length} scenari OK\n`);
  return ok === SCENARIOS.length;
}

function summarizeLogs(perfs, label = "tonyask") {
  console.log(`=== Log produzione [Tony Perf] — ${label} (ultimi ${days}g, max ${limit} righe) ===\n`);
  console.log(`Righe parse: ${perfs.length}`);
  if (!perfs.length) {
    console.log("Nessun log — verifica gcloud auth e deploy tonyAsk.\n");
    return;
  }

  const withRouter = perfs.filter((p) => p.routerBinario);
  const withoutRouter = perfs.length - withRouter.length;
  if (withoutRouter) console.log(`⚠ ${withoutRouter} log senza campi router (revisione vecchia)\n`);

  const binario = { A: 0, B: 0, C: 0 };
  withRouter.forEach((p) => {
    if (binario[p.routerBinario] != null) binario[p.routerBinario]++;
  });
  console.log("Distribuzione routerBinario:", binario);

  const quickHits = {};
  perfs.forEach((p) => {
    const k = p.quickReplyHit || "(none)";
    quickHits[k] = (quickHits[k] || 0) + 1;
  });
  console.log("quickReplyHit:", quickHits);
  const lavoroEntityHits = perfs.filter((p) => p.lavoroEntityParseHit === true);
  if (lavoroEntityHits.length) {
    const injCounts = lavoroEntityHits.map((p) => p.lavoroInjectFieldsCount).filter((n) => Number.isFinite(n));
    console.log(`lavoroEntityParseHit: ${lavoroEntityHits.length}/${perfs.length}`);
    console.log(`lavoroInjectFieldsCount mediana: ${median(injCounts) ?? "n/a"}`);
  }
  console.log(`usedGemini false: ${pct(perfs, (p) => !p.usedGemini)}`);
  console.log(`cacheHit true: ${pct(perfs, (p) => p.cacheHit)}`);
  const streamUsed = perfs.filter((p) => p.streamUsed === true);
  const ttfc = streamUsed.map((p) => p.timeToFirstChunkMs).filter((n) => Number.isFinite(n));
  const gemStream = streamUsed.map((p) => p.geminiStreamMs).filter((n) => Number.isFinite(n));
  console.log(`streamUsed true: ${streamUsed.length}/${perfs.length} (${pct(perfs, (p) => p.streamUsed === true)})`);
  if (streamUsed.length) {
    console.log(`timeToFirstChunkMs mediana (streamUsed): ${median(ttfc) ?? "n/a"} ms`);
    console.log(`geminiStreamMs mediana (streamUsed): ${median(gemStream) ?? "n/a"} ms`);
  } else {
    console.log("timeToFirstChunkMs / geminiStreamMs: n/a (nessun streamUsed=true — quick-reply SSE o fallback tonyAsk)");
  }
  const tierUsed = { T0: 0, T1: 0, T2: 0, T3: 0, T4: 0, T4_full: 0, other: 0 };
  withRouter.forEach((p) => {
    const t = p.routerTierUsed || "?";
    if (tierUsed[t] != null) tierUsed[t]++;
    else tierUsed.other++;
  });
  console.log("routerTierUsed:", tierUsed);
  const post2b = withRouter.filter((p) => p.routerTierUsed && p.routerTierUsed !== "T4_full");
  if (post2b.length) {
    console.log(`routerTierUsed post-2b (≠ T4_full): ${post2b.length}/${withRouter.length} log con router`);
  }

  const geminiMs = perfs.filter((p) => p.usedGemini && p.geminiMs > 0).map((p) => p.geminiMs);
  const quickPaths = perfs.filter((p) => !p.usedGemini);
  console.log(`geminiMs mediana (solo usedGemini): ${median(geminiMs) ?? "n/a"} ms`);
  console.log(`buildContextAziendaMs mediana: ${median(perfs.map((p) => p.buildContextAziendaMs)) ?? "n/a"} ms`);

  const meteoQuick = perfs.filter((p) => p.quickReplyHit === "meteo");
  const tariffQuick = perfs.filter((p) => p.quickReplyHit === "query_tariffa_costo");

  console.log("\n--- Campioni utili ---");
  if (tariffQuick[0]) printSample("Tariffa quick", tariffQuick[0]);
  if (meteoQuick[0]) printSample("Meteo quick", meteoQuick[0]);
  const creaLavoro = withRouter.filter((p) => p.routerBinario === "C" && p.geminiMs > 5000);
  if (creaLavoro[0]) printSample("Crea lavoro (Gemini)", creaLavoro[0]);

  const anomalies = withRouter.filter(
    (p) =>
      p.quickReplyHit === "meteo" &&
      p.messageLen > 80
  );
  if (anomalies.length) {
    console.log(`\n⚠ ${anomalies.length} hit meteo su messaggi lunghi (>=80 char) — verificare crea lavoro`);
  }

  const navWithGemini = withRouter.filter((p) => p.routerBinario === "B" && p.usedGemini);
  const navQuick = withRouter.filter(
    (p) => p.routerBinario === "B" && !p.usedGemini && /^(nav|riassunto|filter_table|sum_column)/.test(p.quickReplyHit || "")
  );
  if (navQuick.length) {
    console.log(`\n✓ ${navQuick.length} richieste B servite da quick reply Fase 4 (nav/filter/riassunto)`);
  }
  if (navWithGemini.length) {
    console.log(`\nℹ ${navWithGemini.length} navigazioni (B) passano ancora da Gemini — verificare messaggi non in mappa`);
  }

  console.log("\n--- Ultimi 5 log (timestamp desc) ---");
  perfs
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5)
    .forEach((p) => {
      const streamInfo =
        p.streamUsed === true
          ? ` stream ttfc=${p.timeToFirstChunkMs ?? "?"}ms`
          : p.streamUsed === false && p.usedGemini
            ? " stream=no"
            : "";
      console.log(
        `${p.timestamp} | bin=${p.routerBinario || "?"} tierUsed=${p.routerTierUsed || "?"} tierCalc=${p.routerTierCalculated || "?"} quick=${p.quickReplyHit || "-"} gemini=${p.usedGemini ? p.geminiMs + "ms" : "no"} cache=${p.cacheHit}${streamInfo}${p.lavoroEntityParseHit ? " lavoro3b=" + (p.lavoroInjectFieldsCount ?? "?") + "fld" : ""}`
      );
    });
  console.log("");
}

function printSample(label, p) {
  console.log(`${label}: binario=${p.routerBinario} tier=${p.tierCalculated} quick=${p.quickReplyHit} geminiMs=${p.geminiMs} msgLen=${p.messageLen}`);
}

const routerOk = runLocalRouterSmoke();
const binarioBOk = runBinarioBQuickSmoke();
const localOk = routerOk && binarioBOk;
const entriesAsk = fetchLogs("tonyask");
const entriesStream = fetchLogs("tonyaskstream");
const perfsAsk = parsePerfEntries(entriesAsk);
const perfsStream = parsePerfEntries(entriesStream);
const perfsAll = [...perfsAsk, ...perfsStream].sort(
  (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
);
summarizeLogs(perfsAsk, "tonyask");
summarizeLogs(perfsStream, "tonyaskstream");
if (perfsAll.length) {
  const streamAll = perfsAll.filter((p) => p.streamUsed === true);
  console.log(
    `=== Aggregato stream (tonyask + tonyaskstream): streamUsed=${streamAll.length}/${perfsAll.length} ===\n`
  );
}

console.log("=== Cosa resta manuale (post-deploy 2b) ===");
console.log("- Canary browser (~5 min): crea lavoro, preventivo, meteo operativo, tariffe/scorte, consiglio multi-modulo");
console.log("- Genera traffico binario A (tariffe/scorte/scadenze) per vedere tierUsed T1/T2 nei log");
console.log("- Riesegui: npm run tony:perf-review -- --days=1 --limit=50 dopo i test");
console.log("  Opzionale: npm run tony:perf-review -- --days=7 --limit=150\n");

process.exit(localOk ? 0 : 1);
