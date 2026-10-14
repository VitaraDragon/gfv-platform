const { testo } = require("./etichetta-util");
const {
  FONTE,
  parsaCsvFitosanitari,
  dataLetturaDaNomeFile,
  dataVariazioneOpenData,
  controlloSettimanaleDovuto
} = require("./registro-opendata");
const {
  MESE_CONTROLLO_MS,
  eFitofarmaco,
  normalizzaNomeProdotto,
  trovaRegistrazioneUnica,
  avvisoRevocaOScadenza
} = require("./etichetta-anagrafica");
const { estraiRigheAffidabili } = require("./etichetta-regex");

function componiArchivioProdotto(input = {}) {
  const csv = input.csv || "";
  const trovata = csv
    ? trovaRegistrazioneUnica(parsaCsvFitosanitari(csv), input.nome, input.numero)
    : { esito: "scheda_non_letta", prodotto: null };
  const dataLettura = dataLetturaDaNomeFile(input.urlCsv) || input.dataLettura || null;
  const vuoto = {
    stato: "da_riprovare",
    motivo: trovata.esito === "unica" ? "estrazione_incerta" : (trovata.esito || "scheda_non_letta"),
    fonte: FONTE,
    dataLettura,
    numeroRegistrazione: null,
    principioAttivo: null,
    righe: [],
    revocatoOScaduto: false,
    dataRevocaOScadenza: "",
    testoRevoca: ""
  };
  if (trovata.esito !== "unica") return vuoto;
  const anag = {
    fonte: FONTE,
    dataLettura,
    numeroRegistrazione: trovata.prodotto.numeroRegistrazione || null,
    principioAttivo: trovata.prodotto.principioAttivo || null,
    statoAmministrativoScheda: testo(trovata.prodotto.stato),
    dataVariazioneScheda: dataVariazioneOpenData(trovata.prodotto),
    urlEtichetta: input.urlEtichetta || null,
    dataEtichetta: input.dataEtichetta || ""
  };
  const revoca = avvisoRevocaOScadenza(trovata.prodotto, input.oraMs);
  if (revoca.si) {
    return {
      ...vuoto,
      ...anag,
      stato: "da_verificare",
      motivo: "revocato",
      righe: [],
      revocatoOScaduto: true,
      dataRevocaOScadenza: revoca.data,
      testoRevoca: revoca.testo
    };
  }
  if (Array.isArray(input.righeLette)) {
    if (input.statoLettura === "da_riprovare") {
      return { ...vuoto, ...anag, stato: "da_riprovare", motivo: input.motivoLettura || "scheda_non_letta", righe: [] };
    }
    if (!input.righeLette.length) {
      return { ...vuoto, ...anag, stato: "da_verificare", motivo: input.motivoLettura || "estrazione_incerta", righe: [] };
    }
    return {
      ...anag,
      stato: "pronta",
      motivo: null,
      righe: input.righeLette,
      revocatoOScaduto: false,
      dataRevocaOScadenza: "",
      testoRevoca: ""
    };
  }
  const letta = estraiRigheAffidabili(input.testoEtichetta || "");
  if (!letta.righe.length) {
    return { ...vuoto, ...anag, stato: "da_verificare", motivo: letta.motivo || "estrazione_incerta", righe: [] };
  }
  return { ...anag, stato: "pronta", motivo: null, righe: letta.righe, revocatoOScaduto: false, dataRevocaOScadenza: "", testoRevoca: "" };
}

function richiedeLetturaScheda(before, after) {
  if (!after || !eFitofarmaco(after) || !testo(after.nome)) return false;
  if (!before || !eFitofarmaco(before)) return true;
  if (normalizzaNomeProdotto(before.nome) !== normalizzaNomeProdotto(after.nome)) return true;
  if (testo(before.numeroRegistrazione) === testo(after.numeroRegistrazione)) return false;
  return !(before.letturaSchedaStato === "in_corso" && after.letturaSchedaStato && after.letturaSchedaStato !== "in_corso");
}

function controlloMensileDovuto(iso, oraMs) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return true;
  return Number(oraMs) - t >= MESE_CONTROLLO_MS;
}

function scegliProdottoInPagina(prodotti, oraMs, attesaMs) {
  const fit = (prodotti || []).filter((p) => eFitofarmaco(p) && testo(p.nome) && p.letturaSchedaStato);
  const inCorso = fit.find((p) => p.letturaSchedaStato === "in_corso");
  if (inCorso) {
    inCorso.modoLettura = "completa";
    return inCorso;
  }
  const soglia = Number(oraMs) - Number(attesaMs);
  const daRiprovare = fit.find((p) => {
    if (p.letturaSchedaStato !== "da_riprovare") return false;
    const t = Date.parse(p.letturaSchedaAggiornataAt || "");
    return !Number.isFinite(t) || t <= soglia;
  });
  if (daRiprovare) {
    daRiprovare.modoLettura = "completa";
    return daRiprovare;
  }
  const giaLetto = fit.find((p) => {
    if (p.letturaSchedaStato !== "pronta" && p.letturaSchedaStato !== "da_verificare") return false;
    if (p.letturaSchedaMotivo === "sito_bloccato") return controlloMensileDovuto(p.controlloSchedaAt, oraMs);
    return controlloSettimanaleDovuto(p.controlloSchedaAt, oraMs);
  });
  if (!giaLetto) return null;
  const etichettaVecchia = controlloMensileDovuto(giaLetto.dataEtichettaLettaAt || giaLetto.letturaSchedaCompletaAt, oraMs);
  giaLetto.modoLettura = etichettaVecchia && giaLetto.letturaSchedaMotivo !== "revocato" ? "completa" : "leggera";
  return giaLetto;
}

module.exports = {
  componiArchivioProdotto,
  richiedeLetturaScheda,
  controlloMensileDovuto,
  scegliProdottoInPagina
};
