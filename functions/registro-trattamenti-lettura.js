/**
 * Lettura etichetta su richiesta. Open data per anagrafica e revoca.
 * Il PDF si scarica solo per il numero chiesto, dalla banca del Ministero.
 * Nessuna chiamata a sian.it.
 */
const tls = require("tls");
const admin = require("firebase-admin");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { csvFitosanitariCorrente } = require("./registro-trattamenti-scheda");
const { testoDaPdf } = require("./lib/etichetta-pdf");
const { leggiPagineEtichetta } = require("./lib/etichetta-gemini");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const {
  ATTESA_RIPROVA_MS,
  FONTE,
  URL_IODL,
  componiArchivioProdotto,
  controlloLeggeroScheda,
  eFitofarmaco,
  esitoRispostaMinistero,
  idDocumentoEtichetta,
  normalizzaNomeProdotto,
  parsaCsvFitosanitari,
  parsaElencoEtichetteMinistero,
  richiedeLetturaScheda,
  rigaEtichettaPerNumero,
  scegliProdottoInPagina,
  trovaRegistrazioneUnica
} = require("./lib/registro-trattamenti-scheda-core");

const HOST = "www.fitosanitari.salute.gov.it";
const BASE = "/fitosanitariws_new/FitosanitariServlet";
const UA = "GFV-Platform registro trattamenti (https://github.com/VitaraDragon/gfv-platform)";
const PAUSA_MS = 2000;
const TIMEOUT_MS = 20000;
const CACHE = "etichetteFitofarmaci";
const CURSORE = "sistema/registroSchedaCoda";
const REGION = "europe-west1";

function testo(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function pausa(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsaHttp(buffer) {
  const raw = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  const sep = raw.indexOf("\r\n\r\n");
  const head = (sep >= 0 ? raw.slice(0, sep) : raw).toString("latin1");
  const body = sep >= 0 ? raw.slice(sep + 4) : Buffer.alloc(0);
  const status = Number((head.match(/HTTP\/1\.\d (\d+)/) || [])[1] || 0);
  const tipo = ((head.match(/content-type:\s*([^\r\n]+)/i) || [])[1] || "").toLowerCase();
  const cookie = (head.match(/set-cookie:\s*([^;\r]+)/i) || [])[1] || "";
  return { status, tipo, cookie, body, testo: body.toString("latin1") };
}

function chiediMinistero(path, timeoutMs, opzioni) {
  if (/sian\.it/i.test(path) || /sian\.it/i.test((opzioni && opzioni.body) || "")) return Promise.reject(new Error("sian_vietato"));
  const metodo = opzioni && opzioni.body ? "POST" : "GET";
  const corpo = opzioni && opzioni.body ? opzioni.body : "";
  return new Promise((resolve, reject) => {
    const sock = tls.connect({
      host: HOST,
      port: 443,
      servername: HOST,
      rejectUnauthorized: true
    });
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error("timeout"));
    }, timeoutMs || TIMEOUT_MS);
    const chunks = [];
    sock.on("secureConnect", () => {
      const linee = [
        metodo + " " + path + " HTTP/1.1",
        "Host: " + HOST,
        "User-Agent: " + UA,
        "Accept: text/html,application/pdf,*/*",
        "Connection: close"
      ];
      if (opzioni && opzioni.cookie) linee.push("Cookie: " + opzioni.cookie);
      if (corpo) {
        linee.push("Content-Type: application/x-www-form-urlencoded");
        linee.push("Content-Length: " + Buffer.byteLength(corpo));
      }
      linee.push("", corpo);
      sock.write(linee.join("\r\n"));
    });
    sock.on("data", (chunk) => chunks.push(chunk));
    sock.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    sock.on("end", () => {
      clearTimeout(timer);
      resolve(parsaHttp(Buffer.concat(chunks)));
    });
  });
}

function corpoRicercaSostanza(nome) {
  const campi = {
    ACTION: "cercaProdotti",
    FROM: "0",
    TO: "49",
    PROVENIENZA: "RICERCA",
    NOME: "",
    NOME_SOSTANZA: nome,
    NUMERO_REGISTRAZIONE: "",
    ATTIVITA: "",
    INDICAZIONE_PERICOLO: "",
    STATO_AMMINISTRATIVO: "",
    DT_IN_REGISTRAZIONE: "",
    DT_FN_REGISTRAZIONE: "",
    DT_IN_SCADENZA: "",
    DT_FN_SCADENZA: "",
    PRODOTTO_IP: "",
    PRODOTTO_PPO: "",
    PRODOTTO_PFnPE: ""
  };
  return Object.entries(campi).map(([chiave, valore]) => chiave + "=" + encodeURIComponent(valore)).join("&");
}

async function cercaEtichettaPerSostanza(principio, numero, chiedi) {
  const nome = testo(principio).split(/[|;,]/)[0].trim();
  if (!nome) return { esito: "non_trovata" };
  let res;
  if (chiedi === chiediMinistero) {
    const home = await chiediMinistero(BASE);
    if (home.status === 403) return { esito: "bloccato" };
    await pausa(PAUSA_MS);
    res = await chiediMinistero(BASE, TIMEOUT_MS, { body: corpoRicercaSostanza(nome), cookie: home.cookie });
  } else {
    res = await chiedi(BASE + "?ACTION=cercaSostanza&FROM=0&TO=49&PROVENIENZA=RICERCA&NOME_SOSTANZA=" + encodeURIComponent(nome));
  }
  const esitoPagina = esitoRispostaMinistero(res.status, res.testo);
  if (esitoPagina !== "ok") return { esito: esitoPagina };
  const riga = rigaEtichettaPerNumero(parsaElencoEtichetteMinistero(res.testo), numero);
  return riga ? { esito: "trovata", riga } : { esito: "non_trovata" };
}

async function scaricaPdf(url, chiedi) {
  const path = String(url || "").replace("https://" + HOST, "");
  if (!path.startsWith("/fitosanitariws_new/EtichettaServlet")) return { esito: "non_pdf" };
  const res = await chiedi(path);
  const esitoPagina = esitoRispostaMinistero(res.status, res.testo);
  if (esitoPagina !== "ok") return { esito: esitoPagina };
  if (!/pdf/.test(res.tipo)) return { esito: "non_pdf" };
  const testoPdf = await testoDaPdf(res.body);
  return { esito: "ok", testo: testoPdf, pdf: res.body };
}

async function chiediGeminiEtichetta(prompt, pdfBuffer) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("manca_chiave");
    throw err;
  }
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inlineData: { mimeType: "application/pdf", data: Buffer.from(pdfBuffer).toString("base64") } }
        ]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: "application/json"
      }
    })
  });
  if (!res.ok) throw new Error("gemini_" + res.status);
  const data = await res.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
  return Array.isArray(parts) ? parts.map((part) => part.text || "").join("") : "";
}

function refDiTenant(ref) {
  const parts = String(ref.path || "").split("/");
  return parts.length === 4 && parts[0] === "tenants" && parts[2] === "prodotti";
}

async function svuotaSchedaImpieghi(ref) {
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

function patchDaEsito(esito) {
  const ora = new Date().toISOString();
  const patch = {
    letturaSchedaStato: esito.stato,
    letturaSchedaMotivo: esito.motivo || null,
    letturaSchedaAggiornataAt: ora,
    fonteScheda: esito.fonte || FONTE,
    revocatoOScaduto: esito.revocatoOScaduto === true,
    dataRevocaOScadenza: esito.dataRevocaOScadenza || "",
    urlEtichetta: esito.urlEtichetta || null,
    dataEtichetta: esito.dataEtichetta || ""
  };
  if (esito.numeroRegistrazione) patch.numeroRegistrazione = esito.numeroRegistrazione;
  if (esito.principioAttivo) patch.principioAttivo = esito.principioAttivo;
  if (esito.dataLettura) patch.dataLetturaScheda = esito.dataLettura;
  if (esito.statoAmministrativoScheda) patch.statoAmministrativoScheda = esito.statoAmministrativoScheda;
  if (esito.dataVariazioneScheda) patch.dataVariazioneScheda = esito.dataVariazioneScheda;
  if (esito.stato === "pronta" || esito.motivo === "revocato") {
    patch.letturaSchedaCompletaAt = ora;
    patch.controlloSchedaAt = ora;
    patch.dataEtichettaLettaAt = ora;
  }
  if (esito.motivo === "sito_bloccato") patch.controlloSchedaAt = ora;
  return patch;
}

async function scriviCache(db, esito) {
  const id = idDocumentoEtichetta(esito.numeroRegistrazione);
  if (!id) return;
  await db.collection(CACHE).doc(id).set({
    numeroRegistrazione: esito.numeroRegistrazione,
    denominazione: esito.denominazione || null,
    principioAttivo: esito.principioAttivo || null,
    statoAmministrativo: esito.statoAmministrativoScheda || null,
    dataEtichetta: esito.dataEtichetta || "",
    urlEtichetta: esito.urlEtichetta || null,
    righe: esito.revocatoOScaduto ? [] : (esito.righe || []),
    statoLettura: esito.stato,
    motivo: esito.motivo || null,
    revocatoOScaduto: esito.revocatoOScaduto === true,
    dataRevocaOScadenza: esito.dataRevocaOScadenza || "",
    testoRevoca: esito.testoRevoca || "",
    fonteEtichetta: "etichetta autorizzata – Ministero della Salute",
    fonteOpenData: FONTE,
    urlIodl: URL_IODL,
    lettaAt: new Date().toISOString()
  });
}

async function cacheFresca(db, numero) {
  const id = idDocumentoEtichetta(numero);
  if (!id) return null;
  const snap = await db.collection(CACHE).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  const t = Date.parse(data.lettaAt || "");
  if (!Number.isFinite(t) || Date.now() - t >= 30 * 24 * 60 * 60 * 1000) return null;
  return data;
}

async function leggiArchivioPubblico(input, dipendenze) {
  const chiedi = dipendenze.chiedi || chiediMinistero;
  const scaricato = await dipendenze.csv();
  if (!scaricato || !scaricato.csv) {
    return componiArchivioProdotto({ nome: input.nome, numero: input.numero, csv: "" });
  }
  const bozza = componiArchivioProdotto({
    nome: input.nome,
    numero: input.numero,
    csv: scaricato.csv,
    urlCsv: scaricato.url,
    oraMs: Date.now()
  });
  if (!bozza.numeroRegistrazione || bozza.motivo === "nome_non_univoco" || bozza.motivo === "non_trovato") return bozza;
  if (bozza.revocatoOScaduto) return bozza;
  const gia = dipendenze.cache ? await dipendenze.cache(bozza.numeroRegistrazione) : null;
  if (gia && Array.isArray(gia.righe)) {
    return Object.assign({}, bozza, {
      stato: gia.statoLettura || "da_verificare",
      motivo: gia.motivo || null,
      righe: gia.righe || [],
      urlEtichetta: gia.urlEtichetta || null,
      dataEtichetta: gia.dataEtichetta || ""
    });
  }
  const principio = bozza.principioAttivo;
  const trovata = await cercaEtichettaPerSostanza(principio, bozza.numeroRegistrazione, chiedi);
  if (trovata.esito === "errore") {
    return Object.assign({}, bozza, { stato: "da_riprovare", motivo: "scheda_non_letta", righe: [] });
  }
  if (trovata.esito === "bloccato") {
    return Object.assign({}, bozza, { stato: "da_verificare", motivo: "sito_bloccato", righe: [] });
  }
  if (trovata.esito !== "trovata") {
    return Object.assign({}, bozza, { stato: "da_verificare", motivo: "etichetta_non_trovata", righe: [] });
  }
  await pausa(dipendenze.pausaMs == null ? PAUSA_MS : dipendenze.pausaMs);
  const file = await scaricaPdf(trovata.riga.urlEtichetta, chiedi);
  if (file.esito === "errore") {
    return Object.assign({}, bozza, {
      stato: "da_riprovare",
      motivo: "scheda_non_letta",
      righe: [],
      urlEtichetta: trovata.riga.urlEtichetta,
      dataEtichetta: trovata.riga.dataEtichetta
    });
  }
  if (file.esito === "bloccato") {
    return Object.assign({}, bozza, {
      stato: "da_verificare",
      motivo: "sito_bloccato",
      righe: [],
      urlEtichetta: trovata.riga.urlEtichetta,
      dataEtichetta: trovata.riga.dataEtichetta
    });
  }
  if (file.esito !== "ok") {
    return Object.assign({}, bozza, {
      stato: "da_verificare",
      motivo: "testo_non_leggibile",
      righe: [],
      urlEtichetta: trovata.riga.urlEtichetta,
      dataEtichetta: trovata.riga.dataEtichetta
    });
  }
  const leggi = dipendenze.leggiPdf || ((pdf) => leggiPagineEtichetta(pdf, chiediGeminiEtichetta));
  const letta = await leggi(file.pdf);
  return componiArchivioProdotto({
    nome: input.nome,
    numero: bozza.numeroRegistrazione,
    csv: scaricato.csv,
    urlCsv: scaricato.url,
    righeLette: letta.righe || [],
    statoLettura: letta.stato,
    motivoLettura: letta.motivo,
    urlEtichetta: trovata.riga.urlEtichetta,
    dataEtichetta: trovata.riga.dataEtichetta,
    oraMs: Date.now()
  });
}

async function elaboraProdotto(ref, dipendenze, modo) {
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data() || {};
  if (!eFitofarmaco(data) || !testo(data.nome)) return;
  if (modo === "leggera") {
    try {
      const scaricato = await dipendenze.csv();
      const righe = scaricato && scaricato.csv ? parsaCsvFitosanitari(scaricato.csv) : [];
      const trovata = trovaRegistrazioneUnica(righe, data.nome, data.numeroRegistrazione);
      const riga = trovata.esito === "unica" ? trovata.prodotto : null;
      const controllo = controlloLeggeroScheda(data, riga);
      if (controllo.esito === "invariato") {
        await ref.set({ controlloSchedaAt: new Date().toISOString() }, { merge: true });
        return;
      }
    } catch (err) {
      return;
    }
  }
  await ref.set({ letturaSchedaStato: "in_corso", letturaSchedaMotivo: null }, { merge: true });
  try {
    const esito = await leggiArchivioPubblico({
      nome: data.nome,
      numero: data.numeroRegistrazione
    }, dipendenze);
    await ref.set(patchDaEsito(esito), { merge: true });
    if (esito.numeroRegistrazione && dipendenze.db && esito.stato !== "da_riprovare") await scriviCache(dipendenze.db, esito);
    await svuotaSchedaImpieghi(ref);
  } catch (err) {
    await ref.set({
      letturaSchedaStato: "da_riprovare",
      letturaSchedaMotivo: "scheda_non_letta",
      letturaSchedaAggiornataAt: new Date().toISOString()
    }, { merge: true });
  }
}

async function handleProdottoSchedaScritto(event) {
  if (!event.data.after.exists) {
    if (event.data.before.exists) await svuotaSchedaImpieghi(event.data.before.ref);
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
  const numeroCambiato = prima && testo(prima.numeroRegistrazione) !== testo(dopo.numeroRegistrazione);
  if (nomeCambiato || numeroCambiato) {
    patch.principioAttivo = null;
    patch.fonteScheda = null;
    patch.dataLetturaScheda = null;
    patch.urlEtichetta = null;
    patch.dataEtichetta = "";
    patch.revocatoOScaduto = false;
    patch.dataRevocaOScadenza = "";
  }
  if (nomeCambiato) patch.numeroRegistrazione = null;
  if (nomeCambiato || numeroCambiato) await svuotaSchedaImpieghi(ref);
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
  return { ref: scelto.ref, modo: scelto.modoLettura || "leggera" };
}

async function handleLeggiSchedeRegistroInCoda() {
  const db = admin.firestore();
  const prossimo = await prossimoDaLeggere(db);
  if (!prossimo || !prossimo.ref) return;
  await elaboraProdotto(prossimo.ref, {
    csv: csvFitosanitariCorrente,
    cache: (numero) => cacheFresca(db, numero),
    db
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
    memory: "1GiB",
    maxInstances: 1,
    secrets: [geminiApiKey]
  },
  handleLeggiSchedeRegistroInCoda
);

module.exports = {
  onProdottoSchedaScritto,
  leggiSchedeRegistroInCoda,
  handleProdottoSchedaScritto,
  leggiArchivioPubblico,
  chiediMinistero,
  testoDaPdf
};
