/**
 * Lettura della scheda in anagrafica, dopo il salvataggio.
 * Un fitofarmaco alla volta. Non copia l'archivio del Ministero: solo le righe di quel prodotto.
 */
const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { csvFitosanitariCorrente } = require("./registro-trattamenti-scheda");
const {
  ATTESA_RIPROVA_MS,
  SETTIMANA_CONTROLLO_MS,
  FONTE,
  componiArchivioProdotto,
  controlloLeggeroScheda,
  idRigaScheda,
  normalizzaNomeProdotto,
  parsaCsvFitosanitari,
  parsaElencoAvversita,
  parsaPaginaImpieghiSian,
  richiedeLetturaScheda,
  schedaOltreSeiMesi,
  scegliProdottoInPagina,
  trovaRegistrazioneUnica,
  eFitofarmaco
} = require("./lib/registro-trattamenti-scheda-core");

const SIAN = "https://www.sian.it/mimfFitoPub";
const CURSORE = "sistema/registroSchedaCoda";
const REGION = "europe-west1";
const MAX_PAGINE = 15;

function testo(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function creaJar() {
  const map = new Map();
  return {
    header() {
      return Array.from(map.entries()).map(([k, v]) => k + "=" + v).join("; ");
    },
    leggi(res) {
      const liste = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      liste.forEach((line) => {
        const part = String(line).split(";")[0];
        const i = part.indexOf("=");
        if (i > 0) map.set(part.slice(0, i).trim(), part.slice(i + 1).trim());
      });
    }
  };
}

function testoDaPdf(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer.toString("latin1") : "";
  const pezzi = [];
  const re = /\((?:\\\)|[^\\)]){3,}\)/g;
  let match = re.exec(raw);
  while (match) {
    const inner = match[0].slice(1, -1).replace(/\\n/g, " ").replace(/\\([()\\])/g, "$1");
    if (/[A-Za-zÀ-ÿ]/.test(inner)) pezzi.push(inner);
    match = re.exec(raw);
  }
  return pezzi.join(" ").replace(/\s+/g, " ").trim();
}

async function chiedi(fetchImpl, jar, url, opts = {}) {
  const headers = Object.assign({
    "User-Agent": "GFV-Platform registro trattamenti",
    Accept: "text/html,application/pdf,*/*"
  }, opts.headers || {});
  const cookie = jar.header();
  if (cookie) headers.Cookie = cookie;
  const res = await fetchImpl(url, {
    method: opts.method || "GET",
    headers,
    body: opts.body || undefined,
    redirect: "follow"
  });
  jar.leggi(res);
  const tipo = String(res.headers.get("content-type") || "").toLowerCase();
  if (tipo.includes("pdf") || opts.binario) {
    const buf = Buffer.from(await res.arrayBuffer());
    return { ok: res.ok, tipo, buf, testo: tipo.includes("pdf") ? testoDaPdf(buf) : "" };
  }
  return { ok: res.ok, tipo, testo: await res.text(), buf: null };
}

function postForm(body) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  };
}

function corpoSenzaBottoni(html, bottone) {
  const params = new URLSearchParams();
  for (const match of String(html || "").matchAll(/<input([^>]*)>/gi)) {
    const tag = match[1];
    const name = (tag.match(/name="([^"]*)"/) || [])[1];
    const type = ((tag.match(/type="([^"]*)"/) || [])[1] || "").toLowerCase();
    if (!name || type === "submit") continue;
    params.append(name, (tag.match(/value="([^"]*)"/) || [])[1] || "");
  }
  params.append(bottone, "1");
  return params.toString();
}

function indiciAvversita(html) {
  const trovati = new Set();
  for (const match of String(html || "").matchAll(/name="avversita(\d+)"/gi)) {
    trovati.add(Number(match[1]));
  }
  return Array.from(trovati).sort((a, b) => a - b);
}

function pagineBottone(html) {
  return Array.from(String(html || "").matchAll(/name="butPagina"[^>]*value="\s*(\d+)\s*"/gi))
    .map((match) => Number(match[1]))
    .filter((n) => Number.isFinite(n));
}

async function avversitaDellaPagina(html, fetchImpl, jar) {
  const colture = parsaPaginaImpieghiSian(html).colture;
  const indici = indiciAvversita(html);
  const mappa = {};
  for (let i = 0; i < colture.length; i += 1) {
    const nome = colture[i].colturaScheda;
    const indice = indici[i];
    if (indice == null) {
      mappa[nome] = [];
      continue;
    }
    const out = await chiedi(fetchImpl, jar, SIAN + "/gestioneImpieghi.do", postForm(
      corpoSenzaBottoni(html, "avversita" + indice)
    ));
    const nomi = parsaElencoAvversita(out.testo);
    const altre = pagineBottone(out.testo).filter((p) => p > 1).slice(0, 5);
    for (let p = 0; p < altre.length; p += 1) {
      const pagina = await chiedi(fetchImpl, jar, SIAN + "/gestioneAvversita.do", postForm("butPagina=" + altre[p]));
      parsaElencoAvversita(pagina.testo).forEach((voce) => nomi.push(voce));
    }
    mappa[nome] = Array.from(new Set(nomi));
    const torno = await chiedi(fetchImpl, jar, SIAN + "/impieghi.get");
    if (!/Impiego\s*-\s*Coltura/i.test(torno.testo || "")) break;
  }
  return mappa;
}

async function leggiBancaSian(numero, fetchImpl) {
  const jar = creaJar();
  const n = encodeURIComponent(testo(numero));
  if (!n) return { pagineImpieghi: [], testoEtichetta: "", avversitaPerColtura: {} };
  await chiedi(fetchImpl, jar, SIAN + "/ricercaProdottoFito.get");
  const cerca = await chiedi(fetchImpl, jar, SIAN + "/gestioneRicercaProdottiFito.do", postForm(
    "ricerca.tipoRicerca=1&ricerca.descTipologia=Prodotti+Registrati&ricerca.numRegistro=" + n + "&ricercPerProdotto=Cerca"
  ));
  if (!cerca.testo || !/name="dettaglio0"|name="nreg"/.test(cerca.testo)) {
    return { pagineImpieghi: [], testoEtichetta: "", avversitaPerColtura: {} };
  }
  await chiedi(fetchImpl, jar, SIAN + "/gestioneRicercaProdottiFito.do", postForm(
    "ricerca.tipoRicerca=1&ricerca.numRegistro=" + n + "&nreg=" + n + "&dettaglio0="
  ));
  const prima = await chiedi(fetchImpl, jar, SIAN + "/impieghi.get");
  const pagineImpieghi = [];
  const avversitaPerColtura = {};
  if (prima.testo && /Impiego\s*-\s*Coltura/i.test(prima.testo)) {
    pagineImpieghi.push(prima.testo);
    Object.assign(avversitaPerColtura, await avversitaDellaPagina(prima.testo, fetchImpl, jar));
  }
  const altre = parsaPaginaImpieghiSian(prima.testo).pagine.filter((p) => p > 1).slice(0, MAX_PAGINE - 1);
  for (let i = 0; i < altre.length; i += 1) {
    const pagina = await chiedi(fetchImpl, jar, SIAN + "/gestioneImpieghi.do", postForm("butPagina=" + altre[i]));
    if (pagina.testo && /Impiego\s*-\s*Coltura/i.test(pagina.testo)) {
      pagineImpieghi.push(pagina.testo);
      Object.assign(avversitaPerColtura, await avversitaDellaPagina(pagina.testo, fetchImpl, jar));
    }
  }
  let testoEtichetta = "";
  try {
    await chiedi(fetchImpl, jar, SIAN + "/storicoEtichette.get");
    const file = await chiedi(fetchImpl, jar, SIAN + "/gestioneEtichette.do", postForm("scaricaEtichettaStorico=0"));
    testoEtichetta = file.testo || "";
  } catch (err) {
    testoEtichetta = "";
  }
  return { pagineImpieghi, testoEtichetta, avversitaPerColtura };
}

async function leggiArchivioPubblico(input, dipendenze) {
  const fetchImpl = dipendenze.fetch;
  const scaricato = await dipendenze.csv();
  if (!scaricato || !scaricato.csv) {
    return componiArchivioProdotto({ nome: input.nome, numero: input.numero, csv: "" });
  }
  const bozza = componiArchivioProdotto({
    nome: input.nome,
    numero: input.numero,
    csv: scaricato.csv,
    urlCsv: scaricato.url
  });
  if (!bozza.numeroRegistrazione) return bozza;
  const banca = await leggiBancaSian(bozza.numeroRegistrazione, fetchImpl);
  return componiArchivioProdotto({
    nome: input.nome,
    numero: bozza.numeroRegistrazione,
    csv: scaricato.csv,
    urlCsv: scaricato.url,
    pagineImpieghi: banca.pagineImpieghi,
    testoEtichetta: banca.testoEtichetta,
    avversitaPerColtura: banca.avversitaPerColtura
  });
}

function refDiTenant(ref) {
  const parts = String(ref.path || "").split("/");
  return parts.length === 4 && parts[0] === "tenants" && parts[2] === "prodotti";
}

async function scriviEsito(ref, esito) {
  const patch = {
    letturaSchedaStato: esito.stato,
    letturaSchedaMotivo: esito.motivo || null,
    letturaSchedaAggiornataAt: new Date().toISOString(),
    fonteScheda: esito.fonte || FONTE
  };
  if (esito.numeroRegistrazione) patch.numeroRegistrazione = esito.numeroRegistrazione;
  if (esito.principioAttivo) patch.principioAttivo = esito.principioAttivo;
  if (esito.dataLettura) patch.dataLetturaScheda = esito.dataLettura;
  if (esito.stato === "pronta") {
    const ora = patch.letturaSchedaAggiornataAt;
    patch.letturaSchedaCompletaAt = ora;
    patch.controlloSchedaAt = ora;
    patch.statoAmministrativoScheda = esito.statoAmministrativoScheda || null;
    patch.dataVariazioneScheda = esito.dataVariazioneScheda || "";
  }
  await ref.set(patch, { merge: true });
  if (esito.stato !== "pronta") return;
  const col = ref.collection("schedaImpieghi");
  const esistenti = await col.get();
  let batch = ref.firestore.batch();
  let n = 0;
  const scarica = async () => {
    if (!n) return;
    await batch.commit();
    batch = ref.firestore.batch();
    n = 0;
  };
  for (let i = 0; i < esistenti.docs.length; i += 1) {
    batch.delete(esistenti.docs[i].ref);
    n += 1;
    if (n >= 400) await scarica();
  }
  for (let i = 0; i < esito.righe.length; i += 1) {
    const riga = esito.righe[i];
    batch.set(col.doc(idRigaScheda(riga, i)), Object.assign({}, riga, {
      fonte: esito.fonte || FONTE,
      dataLettura: esito.dataLettura || null
    }));
    n += 1;
    if (n >= 400) await scarica();
  }
  await scarica();
}

async function tieniSchedaInvariata(ref, impronta) {
  const patch = { controlloSchedaAt: new Date().toISOString() };
  if (impronta) {
    patch.statoAmministrativoScheda = impronta.statoAmministrativoScheda || null;
    patch.dataVariazioneScheda = impronta.dataVariazioneScheda || "";
    if (impronta.numeroRegistrazione) patch.numeroRegistrazione = impronta.numeroRegistrazione;
  }
  await ref.set(patch, { merge: true });
}

async function leggiControlloLeggero(data, dipendenze) {
  const scaricato = await dipendenze.csv();
  if (!scaricato || !scaricato.csv) return { azione: "riprova" };
  const righe = parsaCsvFitosanitari(scaricato.csv);
  const trovata = trovaRegistrazioneUnica(righe, data.nome, data.numeroRegistrazione);
  const riga = trovata.esito === "unica" ? trovata.prodotto : null;
  const controllo = controlloLeggeroScheda(data, riga);
  if (controllo.esito === "non_trovato" || controllo.esito === "cambiato") return { azione: "completa" };
  if (schedaOltreSeiMesi(data.letturaSchedaCompletaAt, Date.now())) return { azione: "completa" };
  return { azione: "tieni", impronta: controllo.impronta };
}

async function elaboraProdotto(ref, dipendenze, modo) {
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data() || {};
  if (!eFitofarmaco(data) || !testo(data.nome)) return;
  if (modo === "leggera") {
    try {
      const leggero = await leggiControlloLeggero(data, dipendenze);
      if (leggero.azione === "tieni") {
        await tieniSchedaInvariata(ref, leggero.impronta);
        return;
      }
      if (leggero.azione === "riprova") {
        const riprovaAlle = Date.now() - (SETTIMANA_CONTROLLO_MS - ATTESA_RIPROVA_MS);
        await ref.set({ controlloSchedaAt: new Date(riprovaAlle).toISOString() }, { merge: true });
        return;
      }
    } catch (err) {
      return;
    }
  }
  await ref.set({
    letturaSchedaStato: "in_corso",
    letturaSchedaMotivo: null
  }, { merge: true });
  try {
    const esito = await leggiArchivioPubblico({
      nome: data.nome,
      numero: data.numeroRegistrazione
    }, dipendenze);
    await scriviEsito(ref, esito);
  } catch (err) {
    await ref.set({
      letturaSchedaStato: "da_riprovare",
      letturaSchedaMotivo: "scheda_non_letta",
      letturaSchedaAggiornataAt: new Date().toISOString()
    }, { merge: true });
  }
}

async function svuotaRighe(ref) {
  const righe = await ref.collection("schedaImpieghi").get();
  if (righe.empty) return;
  let batch = ref.firestore.batch();
  let n = 0;
  for (let i = 0; i < righe.docs.length; i += 1) {
    batch.delete(righe.docs[i].ref);
    n += 1;
    if (n >= 400) {
      await batch.commit();
      batch = ref.firestore.batch();
      n = 0;
    }
  }
  if (n) await batch.commit();
}

async function handleProdottoSchedaScritto(event) {
  if (!event.data.after.exists) {
    if (event.data.before.exists) await svuotaRighe(event.data.before.ref);
    return;
  }
  const prima = event.data.before.exists ? event.data.before.data() : null;
  const dopo = event.data.after.exists ? event.data.after.data() : null;
  if (!richiedeLetturaScheda(prima, dopo)) return;
  const ref = event.data.after.ref;
  const patch = {
    letturaSchedaStato: "in_corso",
    letturaSchedaMotivo: null,
    letturaSchedaRichiestaAt: new Date().toISOString()
  };
  const nomeCambiato = prima && normalizzaNomeProdotto(prima.nome) !== normalizzaNomeProdotto(dopo.nome);
  if (nomeCambiato) {
    patch.numeroRegistrazione = null;
    patch.principioAttivo = null;
    patch.fonteScheda = null;
    patch.dataLetturaScheda = null;
  }
  if (nomeCambiato) await svuotaRighe(ref);
  await ref.set(patch, { merge: true });
}

async function prossimoDaLeggere(db) {
  const inCorso = await db.collectionGroup("prodotti")
    .where("categoria", "==", "fitofarmaci")
    .where("letturaSchedaStato", "==", "in_corso")
    .limit(8)
    .get();
  const pronto = inCorso.docs.find((doc) => refDiTenant(doc.ref) && testo(doc.get("nome")));
  if (pronto) return { ref: pronto.ref, modo: "completa" };

  const statoRef = db.doc(CURSORE);
  const stato = await statoRef.get();
  const dopo = stato.exists ? stato.get("dopo") : null;
  let q = db.collectionGroup("prodotti")
    .where("categoria", "==", "fitofarmaci")
    .orderBy(admin.firestore.FieldPath.documentId())
    .limit(25);
  if (dopo) q = q.startAfter(dopo);
  let pagina = await q.get();
  if (pagina.empty && dopo) {
    await statoRef.set({ dopo: null });
    pagina = await db.collectionGroup("prodotti")
      .where("categoria", "==", "fitofarmaci")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(25)
      .get();
  }
  if (pagina.empty) return null;
  const scelto = scegliProdottoInPagina(pagina.docs.map((doc) => Object.assign({
    id: doc.id,
    ref: doc.ref
  }, doc.data())), Date.now(), ATTESA_RIPROVA_MS);
  if (!scelto || !refDiTenant(scelto.ref)) {
    await statoRef.set({ dopo: pagina.docs[pagina.docs.length - 1].ref.path });
    return null;
  }
  return { ref: scelto.ref, modo: scelto.modoLettura || "completa" };
}

async function handleLeggiSchedeRegistroInCoda() {
  const db = admin.firestore();
  const prossimo = await prossimoDaLeggere(db);
  if (!prossimo || !prossimo.ref) return;
  await elaboraProdotto(prossimo.ref, {
    fetch,
    csv: csvFitosanitariCorrente
  }, prossimo.modo);
}

const onProdottoSchedaScritto = onDocumentWritten(
  { document: "tenants/{tenantId}/prodotti/{prodottoId}", region: REGION },
  handleProdottoSchedaScritto
);

const leggiSchedeRegistroInCoda = onSchedule(
  {
    schedule: "every 5 minutes",
    region: REGION,
    timeZone: "Europe/Rome",
    timeoutSeconds: 300,
    memory: "512MiB",
    maxInstances: 1
  },
  handleLeggiSchedeRegistroInCoda
);

module.exports = {
  onProdottoSchedaScritto,
  leggiSchedeRegistroInCoda,
  leggiBancaSian,
  leggiArchivioPubblico,
  handleProdottoSchedaScritto,
  testoDaPdf
};
