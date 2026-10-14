/**
 * Scarica il PDF dell'etichetta dal Ministero, un prodotto alla volta.
 * Nessuna chiamata a sian.it.
 */
const tls = require("tls");
const { testoDaPdf } = require("./etichetta-pdf");
const {
  esitoRispostaMinistero,
  parsaElencoEtichetteMinistero,
  rigaEtichettaPerNumero
} = require("./etichetta-anagrafica");

const HOST = "www.fitosanitari.salute.gov.it";
const BASE = "/fitosanitariws_new/FitosanitariServlet";
const UA = "GFV-Platform registro trattamenti (https://github.com/VitaraDragon/gfv-platform)";
const PAUSA_MS = 2000;
const TIMEOUT_MS = 20000;

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

module.exports = {
  PAUSA_MS,
  chiediMinistero,
  cercaEtichettaPerSostanza,
  scaricaPdf
};
