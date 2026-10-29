"use strict";

/**
 * Avvisi di spesa e spegnimento automatico di Tony sulla landing (passo 15).
 * tonyLandingAvvisiSpesa: ogni 15 minuti, email al 50/80/100% e enabled=false al 100%.
 * tonyLandingBudget: Pub/Sub del budget Google Cloud → enabled=false + email.
 * Non tocca aziende, utenti né il Tony dell'app.
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onMessagePublished } = require("firebase-functions/v2/pubsub");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const { FieldValue, Timestamp } = require("firebase-admin/firestore");
const { sendWithResend, RESEND_FROM } = require("./email-resend");
const {
  DESTINATARIO_AVVISI,
  SOGLIE_AVVISO,
  ARGOMENTO_BUDGET,
  SPENTO_DA,
  FREQUENZA_CONTROLLO,
  percentualeSpesa,
  sogliaDaAvvisare,
  avvisiValidi,
  meseBudget,
  dataMeseBudget,
  decisioneBudgetGoogle,
  testoEmailSpesa,
  testoEmailBudget,
  meseInParole,
  chiaviTempo,
  normalizzaConfig
} = require("./lib/tony-landing-avvisi");
const { scadenze } = require("./lib/tony-landing-limiti");

void RESEND_FROM;
void SOGLIE_AVVISO;

const resendApiKey = defineSecret("RESEND_API_KEY");

const COLLEZIONE_QUOTA = "tonyLandingQuota";
const DOC_CONFIG = "tonyLanding";

function marcaPrenotazione(adesso) {
  return { stato: "in-invio", il: Timestamp.fromDate(adesso) };
}

function marcaInviata(adesso) {
  return { stato: "inviata", il: Timestamp.fromDate(adesso) };
}

function codiceErroreBreve(err) {
  return String(
    (err && (err.code || err.codice || err.message)) || "sconosciuto"
  ).slice(0, 40);
}

/**
 * @param {{ db: FirebaseFirestore.Firestore, adesso?: Date, inviaEmail?: Function }} deps
 */
async function handleAvvisiSpesa(deps) {
  const db = deps && deps.db;
  const adesso = deps && deps.adesso instanceof Date ? deps.adesso : new Date();
  const inviaEmail =
    typeof (deps && deps.inviaEmail) === "function"
      ? deps.inviaEmail
      : async ({ to, subject, html }) => {
          const key = process.env.RESEND_API_KEY || "";
          return sendWithResend(key, { to, subject, html });
        };

  try {
    const { mese } = chiaviTempo(adesso);
    const scad = scadenze(adesso);
    const refConfig = db.collection("config").doc(DOC_CONFIG);
    const refMese = db.collection(COLLEZIONE_QUOTA).doc("m_" + mese);
    const refAvvisi = db.collection(COLLEZIONE_QUOTA).doc("avvisi_" + mese);

    const [snapConfig, snapMese, snapAvvisi] = await Promise.all([
      refConfig.get(),
      refMese.get(),
      refAvvisi.get()
    ]);

    const config = normalizzaConfig(snapConfig.exists ? snapConfig.data() : null);
    const datiMese = snapMese.exists ? snapMese.data() || {} : {};
    const spesaMeseEur =
      typeof datiMese.costoEur === "number" ? datiMese.costoEur : 0;
    const domandeMese =
      typeof datiMese.domande === "number" ? datiMese.domande : 0;
    const gia = avvisiValidi(
      snapAvvisi.exists ? snapAvvisi.data() || {} : {},
      adesso
    );

    const percentuale = percentualeSpesa({
      spesaMeseEur,
      budgetEur: config.monthlyBudgetEur
    });
    const scelta = sogliaDaAvvisare({ percentuale, giaInviate: gia });
    if (!scelta) {
      console.info(
        "[tonyLandingAvvisi] mese=" + mese + " soglia=nessuna email=no spento=no"
      );
      return { ok: true, soglia: null };
    }

    const expireMe = Timestamp.fromDate(scad.mese);
    let spentoAdesso = false;
    let spentoDalTettoQuestoMese = false;
    let prenotato = false;
    /** @type {number[]} */
    let prenotate = [];

    await db.runTransaction(async (tx) => {
      const [sAvvisi, sConfig] = await Promise.all([
        tx.get(refAvvisi),
        tx.get(refConfig)
      ]);
      const avvisiOra = sAvvisi.exists ? sAvvisi.data() || {} : {};
      const ancora = sogliaDaAvvisare({
        percentuale,
        giaInviate: avvisiValidi(avvisiOra, adesso)
      });
      if (!ancora || ancora.soglia !== scelta.soglia) {
        prenotato = false;
        prenotate = [];
        return;
      }

      prenotate = ancora.daSegnare.slice();
      const patch = {
        expireAt: expireMe,
        aggiornatoIl: FieldValue.serverTimestamp()
      };
      for (let i = 0; i < prenotate.length; i += 1) {
        patch["p" + prenotate[i]] = marcaPrenotazione(adesso);
      }
      tx.set(refAvvisi, patch, { merge: true });
      prenotato = true;

      if (ancora.soglia === 100) {
        const raw = sConfig.exists ? sConfig.data() || {} : {};
        if (
          raw.spentoDa === SPENTO_DA.tetto &&
          raw.spentoMese === mese
        ) {
          spentoDalTettoQuestoMese = true;
        }
        if (raw.enabled === true) {
          tx.set(
            refConfig,
            {
              enabled: false,
              spentoDa: SPENTO_DA.tetto,
              spentoIl: FieldValue.serverTimestamp(),
              spentoMese: mese
            },
            { merge: true }
          );
          spentoAdesso = true;
          spentoDalTettoQuestoMese = true;
        }
      }
    });

    if (!prenotato) {
      console.info(
        "[tonyLandingAvvisi] mese=" +
          mese +
          " soglia=" +
          scelta.soglia +
          " email=gia spento=no"
      );
      return { ok: true, soglia: scelta.soglia, email: "gia" };
    }

    const emailSpentoAdesso =
      scelta.soglia === 100
        ? spentoAdesso || spentoDalTettoQuestoMese
        : undefined;

    const mail = testoEmailSpesa({
      soglia: scelta.soglia,
      spesaMeseEur,
      budgetEur: config.monthlyBudgetEur,
      domandeMese,
      mese: meseInParole(adesso),
      spentoAdesso: emailSpentoAdesso
    });

    try {
      await inviaEmail({
        to: DESTINATARIO_AVVISI,
        subject: mail.oggetto,
        html: mail.html
      });
    } catch {
      try {
        const togli = {};
        for (let i = 0; i < prenotate.length; i += 1) {
          togli["p" + prenotate[i]] = FieldValue.delete();
        }
        await refAvvisi.set(togli, { merge: true });
      } catch (errPulizia) {
        console.info(
          "[tonyLandingAvvisi] mese=" +
            mese +
            " soglia=" +
            scelta.soglia +
            " email=errore spento=" +
            (spentoAdesso ? "si" : "no") +
            " pulizia=errore codice=" +
            codiceErroreBreve(errPulizia)
        );
        return { ok: false, soglia: scelta.soglia, email: "errore", pulizia: "errore" };
      }
      console.info(
        "[tonyLandingAvvisi] mese=" +
          mese +
          " soglia=" +
          scelta.soglia +
          " email=errore spento=" +
          (spentoAdesso ? "si" : "no")
      );
      return { ok: false, soglia: scelta.soglia, email: "errore" };
    }

    try {
      const fatti = {};
      for (let i = 0; i < prenotate.length; i += 1) {
        fatti["p" + prenotate[i]] = marcaInviata(adesso);
      }
      await refAvvisi.set(fatti, { merge: true });
    } catch (errMark) {
      console.info(
        "[tonyLandingAvvisi] mese=" +
          mese +
          " soglia=" +
          scelta.soglia +
          " email=inviata spento=" +
          (spentoAdesso ? "si" : "no") +
          " marca=errore codice=" +
          codiceErroreBreve(errMark)
      );
    }

    console.info(
      "[tonyLandingAvvisi] mese=" +
        mese +
        " soglia=" +
        scelta.soglia +
        " email=inviata spento=" +
        (spentoAdesso ? "si" : "no")
    );
    return {
      ok: true,
      soglia: scelta.soglia,
      email: "inviata",
      spento: spentoAdesso
    };
  } catch (err) {
    const codice =
      (err && (err.code || err.codice || err.message)) || "sconosciuto";
    console.info(
      "[tonyLandingAvvisi] errore=" + String(codice).slice(0, 80)
    );
    return { ok: false, errore: String(codice).slice(0, 80) };
  }
}

/**
 * @param {unknown} dati
 * @param {{ db: FirebaseFirestore.Firestore, adesso?: Date, inviaEmail?: Function }} deps
 */
async function handleBudgetGoogle(dati, deps) {
  const db = deps && deps.db;
  const adesso = deps && deps.adesso instanceof Date ? deps.adesso : new Date();
  const inviaEmail =
    typeof (deps && deps.inviaEmail) === "function"
      ? deps.inviaEmail
      : async ({ to, subject, html }) => {
          const key = process.env.RESEND_API_KEY || "";
          return sendWithResend(key, { to, subject, html });
        };

  try {
    const decisione = decisioneBudgetGoogle(dati);
    if (!decisione.superato) {
      const motivo = decisione.motivo || "sotto";
      console.info(
        "[tonyLandingBudget] budget=" +
          (motivo === "messaggio-non-valido"
            ? "messaggio-non-valido"
            : "sotto")
      );
      return { ok: true, superato: false };
    }

    const mese = meseBudget(dati, adesso);
    const dataRif = dataMeseBudget(dati, adesso);
    const scad = scadenze(adesso);
    const refConfig = db.collection("config").doc(DOC_CONFIG);
    const refAvvisi = db.collection(COLLEZIONE_QUOTA).doc("avvisi_" + mese);
    const expireMe = Timestamp.fromDate(scad.mese);

    let mandaEmail = false;
    let spento = false;
    let prenotatoBudget = false;

    await db.runTransaction(async (tx) => {
      const [sAvvisi, sConfig] = await Promise.all([
        tx.get(refAvvisi),
        tx.get(refConfig)
      ]);
      const avvisiOra = sAvvisi.exists ? sAvvisi.data() || {} : {};
      const giaBudget = !!avvisiValidi(avvisiOra, adesso).budgetGoogle;
      const raw = sConfig.exists ? sConfig.data() || {} : {};

      if (!giaBudget) {
        tx.set(
          refAvvisi,
          {
            budgetGoogle: marcaPrenotazione(adesso),
            expireAt: expireMe,
            aggiornatoIl: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
        mandaEmail = true;
        prenotatoBudget = true;
      }

      if (raw.enabled === true) {
        tx.set(
          refConfig,
          {
            enabled: false,
            spentoDa: SPENTO_DA.budget,
            spentoIl: FieldValue.serverTimestamp(),
            spentoMese: mese
          },
          { merge: true }
        );
        spento = true;
      }
    });

    if (mandaEmail) {
      const mail = testoEmailBudget({
        costo: Number(dati && dati.costAmount),
        budget: Number(dati && dati.budgetAmount),
        valuta: decisione.valuta || "EUR",
        mese: meseInParole(dataRif),
        eraGiaSpento: !spento
      });
      try {
        await inviaEmail({
          to: DESTINATARIO_AVVISI,
          subject: mail.oggetto,
          html: mail.html
        });
      } catch {
        try {
          if (prenotatoBudget) {
            await refAvvisi.set(
              { budgetGoogle: FieldValue.delete() },
              { merge: true }
            );
          }
        } catch (errPulizia) {
          console.info(
            "[tonyLandingBudget] budget=superato spento=" +
              (spento ? "si" : "no") +
              " email=errore pulizia=errore codice=" +
              codiceErroreBreve(errPulizia)
          );
          return { ok: false, email: "errore", spento, pulizia: "errore" };
        }
        console.info(
          "[tonyLandingBudget] budget=superato spento=" +
            (spento ? "si" : "no") +
            " email=errore"
        );
        return { ok: false, email: "errore", spento };
      }
      try {
        await refAvvisi.set(
          { budgetGoogle: marcaInviata(adesso) },
          { merge: true }
        );
      } catch (errMark) {
        console.info(
          "[tonyLandingBudget] budget=superato spento=" +
            (spento ? "si" : "no") +
            " email=inviata marca=errore codice=" +
            codiceErroreBreve(errMark)
        );
      }
      console.info(
        "[tonyLandingBudget] budget=superato spento=" +
          (spento ? "si" : "no") +
          " email=inviata"
      );
      return { ok: true, email: "inviata", spento };
    }

    console.info(
      "[tonyLandingBudget] budget=superato spento=" +
        (spento ? "si" : "no") +
        " email=gia"
    );
    return { ok: true, email: "gia", spento };
  } catch (err) {
    const codice =
      (err && (err.code || err.codice || err.message)) || "sconosciuto";
    console.info(
      "[tonyLandingBudget] errore=" + String(codice).slice(0, 80)
    );
    return { ok: false, errore: String(codice).slice(0, 80) };
  }
}

const tonyLandingAvvisiSpesa = onSchedule(
  {
    schedule: FREQUENZA_CONTROLLO,
    region: "europe-west1",
    timeZone: "Europe/Rome",
    secrets: [resendApiKey],
    retryCount: 0
  },
  async () => {
    await handleAvvisiSpesa({
      db: admin.firestore(),
      adesso: new Date(),
      inviaEmail: async ({ to, subject, html }) =>
        sendWithResend(resendApiKey.value(), { to, subject, html })
    });
  }
);

const tonyLandingBudget = onMessagePublished(
  {
    topic: ARGOMENTO_BUDGET,
    region: "europe-west1",
    secrets: [resendApiKey],
    retry: false
  },
  async (event) => {
    let dati = null;
    try {
      dati =
        (event &&
          event.data &&
          event.data.message &&
          event.data.message.json) ||
        null;
    } catch {
      dati = null;
    }
    await handleBudgetGoogle(dati, {
      db: admin.firestore(),
      adesso: new Date(),
      inviaEmail: async ({ to, subject, html }) =>
        sendWithResend(resendApiKey.value(), { to, subject, html })
    });
  }
);

module.exports = {
  tonyLandingAvvisiSpesa,
  tonyLandingBudget,
  handleAvvisiSpesa,
  handleBudgetGoogle
};
