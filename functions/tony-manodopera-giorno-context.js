/**
 * Context Builder — snapshot manodopera del giorno (roster + shortlist materializzata).
 * Pure + fetch Firestore. Tony legge questo JSON; non ricalcola candidati.
 *
 * @module functions/tony-manodopera-giorno-context
 */

const LAVORO_STATI_VISTA = Object.freeze(["assegnato", "in_corso", "in_standby", "sospeso"]);

/**
 * @param {Date} [d]
 * @returns {string} YYYY-MM-DD locale
 */
function toGiornoKeyLocal(d = new Date()) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {*} dataInizio
 * @returns {Date|null}
 */
function parseDataInizio(dataInizio) {
  if (dataInizio == null) return null;
  if (typeof dataInizio.toDate === "function") {
    try {
      return dataInizio.toDate();
    } catch (_) {
      return null;
    }
  }
  const d = new Date(dataInizio);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * @param {Object} lavoro
 * @returns {Date|null}
 */
function getLavoroDataFine(lavoro) {
  const di = parseDataInizio(lavoro && lavoro.dataInizio);
  const dur = lavoro && lavoro.durataPrevista != null ? Number(lavoro.durataPrevista) : NaN;
  if (!di || !Number.isFinite(dur) || dur < 1) return null;
  const end = new Date(di);
  end.setDate(end.getDate() + dur - 1);
  end.setHours(23, 59, 59, 999);
  return end;
}

/**
 * @param {string} giornoKey
 * @param {Object} lavoro
 * @returns {boolean}
 */
function lavoroCopreGiornoKey(giornoKey, lavoro) {
  if (!giornoKey || !lavoro) return false;
  if (!LAVORO_STATI_VISTA.includes(lavoro.stato || "assegnato")) return false;

  const di = parseDataInizio(lavoro.dataInizio);
  if (!di) {
    return ["assegnato", "in_corso", "in_standby"].includes(lavoro.stato);
  }

  const start = new Date(di);
  start.setHours(0, 0, 0, 0);
  const startKey = toGiornoKeyLocal(start);
  const fine = getLavoroDataFine(lavoro);
  if (!fine) {
    if (lavoro.stato === "in_corso" || lavoro.stato === "in_standby") {
      return giornoKey >= startKey;
    }
    return giornoKey === startKey;
  }
  const endKey = toGiornoKeyLocal(fine);
  return giornoKey >= startKey && giornoKey <= endKey;
}

/**
 * @param {Object} lavoro
 * @param {string} giornoKey
 * @returns {Object}
 */
function getSlice(lavoro, giornoKey) {
  const empty = {
    assenti: [],
    sostituzioni: [],
    prestitiUscita: [],
    partecipazioni: [],
    shortlistCandidati: [],
  };
  if (!lavoro || !lavoro.equipaggioGiorno || !giornoKey) return empty;
  const s = lavoro.equipaggioGiorno[giornoKey] || {};
  return {
    assenti: [...(s.assenti || [])].filter(Boolean),
    sostituzioni: [...(s.sostituzioni || [])],
    prestitiUscita: [...(s.prestitiUscita || [])],
    partecipazioni: Array.isArray(s.partecipazioni) ? s.partecipazioni : [],
    shortlistCandidati: Array.isArray(s.shortlistCandidati) ? s.shortlistCandidati : [],
  };
}

/**
 * @param {Object} lavoro
 * @param {Array<Object>} squadre
 * @returns {string[]}
 */
function resolveAnagraficaPrevisti(lavoro, squadre) {
  if (!lavoro) return [];
  if (lavoro.operaioId) return [lavoro.operaioId];
  if (lavoro.caposquadraId) {
    const sq = (squadre || []).find((s) => s.caposquadraId === lavoro.caposquadraId);
    return [...((sq && sq.operai) || [])].filter(Boolean);
  }
  return [];
}

/**
 * @param {Object} slice
 * @param {Object} lavoro
 * @param {Array<Object>} squadre
 * @returns {{ previstiIds: string[], attiviIds: string[], assentiIds: string[], sostitutiIds: string[], rosterMaterializzato: boolean }}
 */
function resolveRosterIds(slice, lavoro, squadre) {
  const rosterMaterializzato = Array.isArray(slice.partecipazioni) && slice.partecipazioni.length > 0;
  if (rosterMaterializzato) {
    const previstiIds = [];
    const attiviIds = [];
    const assentiIds = [];
    const sostitutiIds = [];
    for (const p of slice.partecipazioni) {
      if (!p || !p.operaioId) continue;
      const st = p.stato;
      const orig = p.origine;
      if (
        st === "aggiunto" &&
        (orig === "sostituzione" || orig === "prestito_in")
      ) {
        sostitutiIds.push(p.operaioId);
        attiviIds.push(p.operaioId);
        continue;
      }
      if (orig === "sostituzione" || orig === "prestito_in") continue;
      previstiIds.push(p.operaioId);
      if (st === "previsto" || st === "aggiunto") attiviIds.push(p.operaioId);
      if (st === "assente" || st === "sostituito" || st === "prestato_out") {
        assentiIds.push(p.operaioId);
      }
    }
    return { previstiIds, attiviIds, assentiIds, sostitutiIds, rosterMaterializzato };
  }

  const previstiIds = resolveAnagraficaPrevisti(lavoro, squadre);
  const assentiIds = [
    ...new Set(
      [
        ...slice.assenti,
        lavoro.standbyOperaioId,
        lavoro.assenzaOperaioAssenteId,
      ].filter(Boolean)
    ),
  ];
  const sostitutiIds = [
    ...new Set(
      [
        ...slice.sostituzioni.map((x) => x && x.sostitutoOperaioId),
        lavoro.assenzaSostitutoOperaioId,
      ].filter(Boolean)
    ),
  ];
  const assentiSet = new Set(assentiIds);
  const attiviIds = [
    ...previstiIds.filter((id) => !assentiSet.has(id)),
    ...sostitutiIds,
  ];
  return { previstiIds, attiviIds, assentiIds, sostitutiIds, rosterMaterializzato: false };
}

/**
 * @param {string} giornoKey
 * @param {Object} assenza
 * @returns {boolean}
 */
function assenzaCopreGiorno(giornoKey, assenza) {
  if (!giornoKey || !assenza) return false;
  const da = assenza.dataInizioGiorno || assenza.dataInizio || "";
  const a = assenza.dataFineGiorno || assenza.dataFine || da;
  if (!da) return false;
  return giornoKey >= String(da).slice(0, 10) && giornoKey <= String(a).slice(0, 10);
}

/**
 * Costruisce lo snapshot leggero per ctx.azienda.manodoperaGiorno.
 *
 * @param {Object} input
 * @param {string} input.giornoKey
 * @param {Array<Object>} input.lavori
 * @param {Array<Object>} input.squadre
 * @param {Array<Object>} input.assenze
 * @param {Array<Object>} input.operai
 * @returns {Object}
 */
function buildManodoperaGiornoSnapshot(input = {}) {
  const {
    giornoKey = toGiornoKeyLocal(),
    lavori = [],
    squadre = [],
    assenze = [],
    operai = [],
  } = input;

  const operaiById = new Map();
  for (const op of operai || []) {
    const id = op.id || op.uid;
    if (id) operaiById.set(id, op);
  }
  const nomeOf = (id) => {
    const op = operaiById.get(id);
    if (!op) return id;
    return [op.nome, op.cognome].filter(Boolean).join(" ") || op.email || id;
  };

  const assenzeConf = (assenze || []).filter(
    (a) =>
      String(a.stato || "").toLowerCase() === "confermata" &&
      assenzaCopreGiorno(giornoKey, a)
  );
  const assentiSet = new Set(assenzeConf.map((a) => a.operaioId).filter(Boolean));

  const lavoriGiorno = (lavori || []).filter((l) => lavoroCopreGiornoKey(giornoKey, l));

  const perLavoro = [];
  const lavoriInStandbyAssenza = [];
  const impegnatiSet = new Set();
  const sostitutiSet = new Set();
  const prestatiSet = new Set();

  for (const lav of lavoriGiorno) {
    const slice = getSlice(lav, giornoKey);
    const ids = resolveRosterIds(slice, lav, squadre);
    for (const id of ids.attiviIds) impegnatiSet.add(id);
    for (const id of ids.sostitutiIds) sostitutiSet.add(id);
    for (const p of slice.prestitiUscita) {
      if (p && p.operaioId) prestatiSet.add(p.operaioId);
    }
    if (
      lav.manodoperaPrestata &&
      lav.manodoperaPrestata.operaioId &&
      (!lav.manodoperaPrestata.giornoKey || lav.manodoperaPrestata.giornoKey === giornoKey)
    ) {
      prestatiSet.add(lav.manodoperaPrestata.operaioId);
    }

    const row = {
      lavoroId: lav.id,
      lavoroNome: lav.nome || lav.tipoLavoro || lav.id,
      stato: lav.stato || "assegnato",
      isSquadra: Boolean(lav.caposquadraId && !lav.operaioId),
      rosterMaterializzato: ids.rosterMaterializzato,
      previstiIds: ids.previstiIds,
      previstiNomi: ids.previstiIds.map(nomeOf),
      attiviIds: ids.attiviIds,
      attiviNomi: ids.attiviIds.map(nomeOf),
      assentiIds: ids.assentiIds,
      assentiNomi: ids.assentiIds.map(nomeOf),
      sostitutiIds: ids.sostitutiIds,
      sostitutiNomi: ids.sostitutiIds.map(nomeOf),
    };
    perLavoro.push(row);

    const inStandbyAssenza =
      lav.stato === "in_standby" &&
      (lav.standbyCausa === "assenza_personale" || lav.standbyOperaioId);
    if (inStandbyAssenza) {
      const shortlist = (slice.shortlistCandidati || []).slice(0, 4).map((c) => ({
        operaioId: c.operaioId,
        nome: c.nome || nomeOf(c.operaioId),
        disponibilita: c.disponibilita || null,
        motivo: c.motivo || null,
        stelleDisplay: c.stelleDisplay || null,
        richiedeConfermaSpostamento: !!c.richiedeConfermaSpostamento,
        impegnoLavoroNome: c.impegnoLavoroNome || null,
      }));
      lavoriInStandbyAssenza.push({
        lavoroId: lav.id,
        lavoroNome: row.lavoroNome,
        assenteOperaioId: lav.standbyOperaioId || lav.assenzaOperaioAssenteId || null,
        assenteNome: nomeOf(lav.standbyOperaioId || lav.assenzaOperaioAssenteId || ""),
        giornoKey: lav.standbyGiornoKey || giornoKey,
        shortlistCandidati: shortlist,
        shortlistMaterializzata: shortlist.length > 0,
        attiviNomi: row.attiviNomi,
        previstiNomi: row.previstiNomi,
      });
    }
  }

  const perOperaio = [];
  for (const op of operai || []) {
    const id = op.id || op.uid;
    if (!id) continue;
    let stato = "libero";
    let nota = "Libero";
    let lavoroNome = null;
    if (assentiSet.has(id)) {
      stato = "assente";
      nota = "Assente confermato";
    } else if (prestatiSet.has(id)) {
      stato = "prestato";
      nota = "Prestato ad altro lavoro";
    } else if (sostitutiSet.has(id)) {
      stato = "sostituto";
      const hit = perLavoro.find((r) => (r.sostitutiIds || []).includes(id));
      lavoroNome = hit ? hit.lavoroNome : null;
      nota = lavoroNome ? `Sostituto su «${lavoroNome}»` : "Sostituto";
    } else if (impegnatiSet.has(id)) {
      stato = "impegnato";
      const hit = perLavoro.find((r) => (r.attiviIds || []).includes(id));
      lavoroNome = hit ? hit.lavoroNome : null;
      nota = lavoroNome ? `Impegnato su «${lavoroNome}»` : "Impegnato";
    }
    perOperaio.push({
      operaioId: id,
      nome: nomeOf(id),
      statoDisponibilita: stato,
      lavoroNome,
      nota,
    });
  }

  const kpi = {
    totaleOperai: perOperaio.length,
    liberi: perOperaio.filter((r) => r.statoDisponibilita === "libero").length,
    impegnati: perOperaio.filter((r) =>
      ["impegnato", "sostituto"].includes(r.statoDisponibilita)
    ).length,
    assenti: perOperaio.filter((r) => r.statoDisponibilita === "assente").length,
    prestati: perOperaio.filter((r) => r.statoDisponibilita === "prestato").length,
    lavoriGiorno: perLavoro.length,
    lavoriInStandbyAssenza: lavoriInStandbyAssenza.length,
    shortlistMaterializzate: lavoriInStandbyAssenza.filter((l) => l.shortlistMaterializzata)
      .length,
  };

  const summary =
    `Manodopera ${giornoKey}: ${kpi.liberi} liberi, ${kpi.impegnati} impegnati, ` +
    `${kpi.assenti} assenti, ${kpi.prestati} prestati, ${kpi.lavoriGiorno} lavori` +
    (kpi.lavoriInStandbyAssenza
      ? `, ${kpi.lavoriInStandbyAssenza} in standby per assenza` +
        (kpi.shortlistMaterializzate
          ? ` (${kpi.shortlistMaterializzate} con shortlist salvata)`
          : "")
      : "") +
    ".";

  return {
    giornoKey,
    summary,
    kpi,
    perLavoro: perLavoro.slice(0, 40),
    perOperaio: perOperaio.slice(0, 80),
    lavoriInStandbyAssenza: lavoriInStandbyAssenza.slice(0, 20),
  };
}

/**
 * Messaggio intenziona impegni/roster/shortlist manodopera del giorno?
 * @param {string} message
 * @returns {boolean}
 */
function isManodoperaGiornoQuestion(message) {
  const msg = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!msg) return false;
  if (
    /\b(chi\s+e\s+libero|chi\s+sono\s+i\s+liberi|operai\s+liberi|chi\s+lavor[ao]\s+oggi|impegni\s+(di\s+)?(oggi|giorno)|roster|chi\s+e\s+assente|assenze?\s+(di\s+)?oggi|chi\s+manca|equipaggio|sostitu(ti|zioni|to)|shortlist|candidati\s+sostitu)/.test(
      msg
    )
  ) {
    return true;
  }
  if (/\b(liberi|impegnati|assenti)\b/.test(msg) && /\b(oggi|giorno|manodopera|squadra)\b/.test(msg)) {
    return true;
  }
  return false;
}

/**
 * @param {string} pagePath
 * @returns {boolean}
 */
function isManodoperaPagePath(pagePath) {
  return /manodopera|gestione-lavori|impegni-giornalieri|gestione-operai|gestione-squadre|validazione-ore|segnatura-ore/i.test(
    String(pagePath || "")
  );
}

/**
 * Fetch + build per Context Builder.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} tenantId
 * @param {Object} [options]
 * @param {string} [options.giornoKey]
 * @returns {Promise<Object|null>}
 */
async function fetchManodoperaGiornoContext(db, tenantId, options = {}) {
  if (!db || !tenantId) return null;
  const giornoKey = options.giornoKey || toGiornoKeyLocal();

  const tenantRef = db.collection("tenants").doc(tenantId);
  const [lavoriSnap, squadreSnap, assenzeSnap, usersSnap] = await Promise.all([
    tenantRef.collection("lavori").limit(200).get(),
    tenantRef.collection("squadre").limit(50).get(),
    tenantRef.collection("assenzeOperai").where("stato", "==", "confermata").limit(100).get(),
    db
      .collection("users")
      .where("tenantId", "==", tenantId)
      .where("ruoli", "array-contains", "operaio")
      .limit(100)
      .get(),
  ]);

  const lavori = lavoriSnap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      nome: data.nome,
      tipoLavoro: data.tipoLavoro,
      stato: data.stato,
      dataInizio: data.dataInizio,
      durataPrevista: data.durataPrevista,
      operaioId: data.operaioId,
      caposquadraId: data.caposquadraId,
      equipaggioGiorno: data.equipaggioGiorno || null,
      standbyCausa: data.standbyCausa,
      standbyOperaioId: data.standbyOperaioId,
      standbyGiornoKey: data.standbyGiornoKey,
      assenzaOperaioAssenteId: data.assenzaOperaioAssenteId,
      assenzaSostitutoOperaioId: data.assenzaSostitutoOperaioId,
      manodoperaPrestata: data.manodoperaPrestata || null,
    };
  });

  const squadre = squadreSnap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      caposquadraId: data.caposquadraId,
      operai: data.operai || [],
    };
  });

  const assenze = assenzeSnap.docs.map((d) => {
    const data = d.data() || {};
    return {
      id: d.id,
      operaioId: data.operaioId,
      stato: data.stato,
      dataInizioGiorno: data.dataInizioGiorno || data.dataInizio,
      dataFineGiorno: data.dataFineGiorno || data.dataFine,
      tipo: data.tipo,
    };
  });

  const operai = usersSnap.docs
    .map((d) => {
      const data = d.data() || {};
      if (data.stato && String(data.stato).toLowerCase() !== "attivo") return null;
      return {
        id: d.id,
        nome: data.nome,
        cognome: data.cognome,
        email: data.email,
      };
    })
    .filter(Boolean);

  return buildManodoperaGiornoSnapshot({
    giornoKey,
    lavori,
    squadre,
    assenze,
    operai,
  });
}

/**
 * Testo quick reply da snapshot (no Gemini).
 * @param {Object} manodoperaGiorno
 * @param {string} message
 * @returns {string|null}
 */
function formatManodoperaGiornoQuickReply(manodoperaGiorno, message) {
  if (!manodoperaGiorno || !manodoperaGiorno.summary) return null;
  const msg = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const kpi = manodoperaGiorno.kpi || {};
  const perOp = manodoperaGiorno.perOperaio || [];
  const standby = manodoperaGiorno.lavoriInStandbyAssenza || [];

  if (/\bshortlist|candidati\s+sostitu|chi\s+posso\s+mettere|sostitu(ti|to)\b/.test(msg)) {
    if (!standby.length) {
      return `${manodoperaGiorno.summary} Nessun lavoro in standby per assenza oggi; non c'è shortlist da leggere. Apri Gestione lavori se serve assegnare un sostituto.`;
    }
    const lines = standby.map((l) => {
      if (l.shortlistMaterializzata && l.shortlistCandidati.length) {
        const cards = l.shortlistCandidati
          .map(
            (c) =>
              `${c.nome} (${c.disponibilita || "?"}${c.motivo ? `: ${c.motivo}` : ""})`
          )
          .join("; ");
        return `«${l.lavoroNome}» (assente ${l.assenteNome || "?"}): ${cards}`;
      }
      return `«${l.lavoroNome}» (assente ${l.assenteNome || "?"}): shortlist non ancora salvata — apri la shortlist in Gestione lavori.`;
    });
    return `Standby assenza oggi: ${lines.join(" | ")}`;
  }

  if (/\bliber/.test(msg)) {
    const liberi = perOp.filter((r) => r.statoDisponibilita === "libero").slice(0, 12);
    const names = liberi.map((r) => r.nome).join(", ");
    return names
      ? `${kpi.liberi || liberi.length} operai liberi oggi (${manodoperaGiorno.giornoKey}): ${names}${kpi.liberi > 12 ? "…" : ""}.`
      : `Nessun operaio libero oggi (${manodoperaGiorno.giornoKey}). ${manodoperaGiorno.summary}`;
  }

  if (/\bassent/.test(msg)) {
    const assenti = perOp.filter((r) => r.statoDisponibilita === "assente").slice(0, 12);
    const names = assenti.map((r) => r.nome).join(", ");
    return names
      ? `${kpi.assenti || assenti.length} assenti oggi: ${names}.`
      : `Nessun assente confermato oggi. ${manodoperaGiorno.summary}`;
  }

  return manodoperaGiorno.summary;
}

module.exports = {
  toGiornoKeyLocal,
  lavoroCopreGiornoKey,
  buildManodoperaGiornoSnapshot,
  fetchManodoperaGiornoContext,
  isManodoperaGiornoQuestion,
  isManodoperaPagePath,
  formatManodoperaGiornoQuickReply,
};
