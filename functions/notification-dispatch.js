/**
 * Cloud Functions — crea notificationEvents e invia FCM (catalogo in core/).
 * I moduli ESM sono copiati in lib/ da scripts/sync-notification-modules.cjs.
 */
"use strict";

const { onDocumentCreated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

const REGION = "europe-west1";
let enginePromise = null;

function getEngine() {
  if (!enginePromise) {
    enginePromise = Promise.all([
      import("./lib/notification-policy.js"),
      import("./lib/notification-dispatch-core.js"),
      import("./lib/notification-catalog.js"),
    ]).then(([policy, core, catalog]) => ({ policy, core, catalog }));
  }
  return enginePromise;
}

function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function destinatariIds(data) {
  const raw = data && Array.isArray(data.destinatari) ? data.destinatari : [];
  const ids = [];
  raw.forEach((entry) => {
    if (entry == null || entry === "") return;
    if (typeof entry === "string") {
      if (entry.trim()) ids.push(entry.trim());
      return;
    }
    const id = entry.id || entry.uid || entry.operaioId || entry.userId;
    if (id) ids.push(String(id).trim());
  });
  return ids;
}

function confermeCount(data) {
  return Array.isArray(data && data.conferme) ? data.conferme.length : 0;
}

function tokensFromUser(data) {
  const arr = data && data.notificationPrefs && Array.isArray(data.notificationPrefs.fcmTokens)
    ? data.notificationPrefs.fcmTokens
    : [];
  return arr.map((t) => (t && t.token ? String(t.token) : "")).filter(Boolean);
}

function prefsMapFromUsers(users) {
  const map = {};
  (users || []).forEach((u) => {
    if (u && u.id) map[u.id] = u.notificationPrefs || {};
    if (u && u.uid) map[String(u.uid)] = u.notificationPrefs || {};
  });
  return map;
}

async function loadTenantUsers(db, tenantId) {
  const snap = await db.collection("users").where("tenantId", "==", tenantId).get();
  return snap.docs.map((d) => ({ id: d.id, uid: d.id, ...d.data() }));
}

function serializeEvent(doc) {
  const sendAfter = doc.sendAfter instanceof Date
    ? admin.firestore.Timestamp.fromDate(doc.sendAfter)
    : admin.firestore.Timestamp.now();
  const createdAt = doc.createdAt instanceof Date
    ? admin.firestore.Timestamp.fromDate(doc.createdAt)
    : admin.firestore.Timestamp.now();
  return {
    type: doc.type,
    tenantId: doc.tenantId,
    sourceCollection: doc.sourceCollection,
    sourceId: doc.sourceId,
    lavoroId: doc.lavoroId || null,
    lavoroNome: doc.lavoroNome || "",
    actorUserId: doc.actorUserId || null,
    recipientUserId: doc.recipientUserId,
    recipientUserIds: doc.recipientUserIds || [doc.recipientUserId],
    title: doc.title,
    body: doc.body,
    deepLink: doc.deepLink,
    status: doc.status,
    coalesceKey: doc.coalesceKey || null,
    sendAfter,
    createdAt,
    count: doc.count || 1,
    skipFcm: Boolean(doc.skipFcm),
    waStatus: doc.waStatus || null,
    operaioNome: doc.operaioNome || null,
  };
}

async function removeInvalidTokens(db, userId, invalidTokens) {
  if (!invalidTokens.length) return;
  const ref = db.collection("users").doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const data = snap.data() || {};
  const prefs = data.notificationPrefs || {};
  const tokens = Array.isArray(prefs.fcmTokens) ? prefs.fcmTokens : [];
  const invalid = new Set(invalidTokens);
  await ref.update({
    notificationPrefs: {
      ...prefs,
      fcmTokens: tokens.filter((t) => t && t.token && !invalid.has(String(t.token))),
    },
  });
}

async function deliverEvent(db, eventRef, eventData) {
  const userId = eventData.recipientUserId;
  if (!userId) {
    await eventRef.update({ status: "suppressed", reason: "no-recipient" });
    return;
  }
  const userSnap = await db.collection("users").doc(userId).get();
  if (!userSnap.exists) {
    await eventRef.update({ status: "suppressed", reason: "no-user" });
    return;
  }
  const { policy, catalog } = await getEngine();
  const prefs = policy.mergeNotificationPrefs(userSnap.data().notificationPrefs);
  if (eventData.type === "assenza_turno" && (eventData.skipFcm || !prefs.assenzaPushEnabled)) {
    await eventRef.update({
      status: "sent",
      reason: "push-off",
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }
  if (eventData.type !== "assenza_turno" && !prefs.pushEnabled) {
    await eventRef.update({ status: "suppressed", reason: "prefs-off" });
    return;
  }
  const now = new Date();
  if (!policy.isInPushWindow(now, prefs.pushWindowStart, prefs.pushWindowEnd, prefs.timezone)) {
    await eventRef.update({
      status: "queued",
      sendAfter: admin.firestore.Timestamp.fromDate(
        policy.nextSendAt(now, prefs.pushWindowStart, prefs.pushWindowEnd, prefs.timezone)
      ),
    });
    return;
  }
  const tokens = tokensFromUser(userSnap.data());
  if (!tokens.length) {
    await eventRef.update({ status: "pending", reason: "no-token" });
    return;
  }
  const payload = {
    tokens,
    data: {
      title: String(eventData.title || "GFV"),
      body: String(eventData.body || ""),
      url: String(eventData.deepLink || ""),
      type: String(eventData.type || ""),
      eventId: String(eventRef.id || ""),
      sourceId: String(eventData.sourceId || ""),
    },
    webpush: {
      notification: {
        title: String(eventData.title || "GFV"),
        body: String(eventData.body || ""),
        icon: catalog.buildNotificationIconUrl(),
      },
    },
  };
  const resp = await admin.messaging().sendEachForMulticast(payload);
  const invalid = [];
  resp.responses.forEach((r, i) => {
    if (r.success) return;
    const code = r.error && r.error.code;
    if (code && String(code).includes("registration-token-not-registered")) {
      invalid.push(tokens[i]);
    }
  });
  await removeInvalidTokens(db, userId, invalid);
  await eventRef.update({
    status: "sent",
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    fcmSuccess: resp.successCount || 0,
    fcmFailure: resp.failureCount || 0,
  });
}

async function persistAndSend(db, docs) {
  const col = (tenantId) => db.collection(`tenants/${tenantId}/notificationEvents`);
  for (const doc of docs) {
    if (!doc.tenantId || !doc.recipientUserId) continue;
    if (doc.coalesceKey) {
      const existing = await col(doc.tenantId).where("coalesceKey", "==", doc.coalesceKey).limit(1).get();
      if (!existing.empty) {
        if (doc.type === "assenza_turno") continue;
        const prevRef = existing.docs[0].ref;
        const prev = existing.docs[0].data() || {};
        const nextCount = (Number(prev.count) || 1) + 1;
        const { policy } = await getEngine();
        const copy = policy.buildNotificationCopy(doc.type, { count: nextCount, lavoroNome: doc.lavoroNome });
        await prevRef.update({
          count: nextCount,
          body: copy.body,
          title: copy.title,
        });
        continue;
      }
    }
    const ref = await col(doc.tenantId).add(serializeEvent(doc));
    if (doc.status === "pending") {
      await deliverEvent(db, ref, { ...doc, recipientUserId: doc.recipientUserId });
    }
  }
}

async function handleComunicazioneCreated(event) {
  const tenantId = event.params.tenantId;
  const sourceId = event.params.comunicazioneId;
  const data = event.data && event.data.data ? event.data.data() : null;
  if (!data) return;
  const { core } = await getEngine();
  const db = admin.firestore();
  const dest = destinatariIds(data);
  const docs = core.buildNotificationEventDocs({
    eventId: "comunicazione_destinatario",
    tenantId,
    sourceCollection: "comunicazioni",
    sourceId,
    actorUserId: data.caposquadraId || data.creatoDa || null,
    destinatariIds: dest,
    lavoroId: data.lavoroId || null,
    vars: {
      lavoroNome: data.lavoroNome || core.truncatePreview(data.podere || data.terreno || "Comunicazione", 80),
      mittenteNome: data.caposquadraNome || "Caposquadra",
      messaggio: core.truncatePreview(data.messaggio || data.note || "Nuova comunicazione"),
    },
    prefsByUser: {},
  });
  const users = await Promise.all(
    docs.map(async (d) => {
      const snap = await db.collection("users").doc(d.recipientUserId).get();
      return snap.exists ? { id: snap.id, notificationPrefs: snap.data().notificationPrefs } : null;
    })
  );
  const prefsByUser = prefsMapFromUsers(users.filter(Boolean));
  const rebuilt = core.buildNotificationEventDocs({
    eventId: "comunicazione_destinatario",
    tenantId,
    sourceCollection: "comunicazioni",
    sourceId,
    actorUserId: data.caposquadraId || data.creatoDa || null,
    destinatariIds: dest,
    lavoroId: data.lavoroId || null,
    vars: {
      lavoroNome: data.lavoroNome || core.truncatePreview(data.podere || data.terreno || "Comunicazione", 80),
      mittenteNome: data.caposquadraNome || "Caposquadra",
      messaggio: core.truncatePreview(data.messaggio || data.note || "Nuova comunicazione"),
    },
    prefsByUser,
  });
  await persistAndSend(db, rebuilt);
}

async function handleLavoroWritten(event) {
  const tenantId = event.params.tenantId;
  const lavoroId = event.params.lavoroId;
  const before = event.data && event.data.before && event.data.before.exists
    ? event.data.before.data()
    : null;
  const after = event.data && event.data.after && event.data.after.exists
    ? event.data.after.data()
    : null;
  if (!after) return;
  const { core } = await getEngine();
  const types = core.detectLavoroPushEvents(before, after);
  if (!types.length) return;
  const db = admin.firestore();
  const tenantUsers = types.some((t) => t.startsWith("lavoro_completato") || t === "lavoro_sospeso")
    ? await loadTenantUsers(db, tenantId)
    : [];
  const prefsByUser = prefsMapFromUsers(tenantUsers);
  const actor = after.completatoDa || after.creatoDa || after.sospesoDa || after.aggiornatoDa || null;
  for (const eventId of types) {
    if (!prefsByUser || Object.keys(prefsByUser).length === 0) {
      const recipientsGuess = eventId === "lavoro_assegnato"
        ? [after.caposquadraId || after.operaioId].filter(Boolean)
        : tenantUsers.map((u) => u.id);
      for (const id of recipientsGuess) {
        const snap = await db.collection("users").doc(String(id)).get();
        if (snap.exists) prefsByUser[snap.id] = snap.data().notificationPrefs;
      }
    }
    const docs = core.buildNotificationEventDocs({
      eventId,
      tenantId,
      sourceCollection: "lavori",
      sourceId: lavoroId,
      lavoroId,
      actorUserId: actor,
      lavoro: after,
      tenantUsers,
      vars: {
        lavoroNome: after.nome || "Lavoro",
        dataInizio: core.formatLavoroDataInizio(after.dataInizio),
      },
      prefsByUser,
    });
    await persistAndSend(db, docs);
  }
}

async function handleOreCreated(event) {
  const tenantId = event.params.tenantId;
  const lavoroId = event.params.lavoroId;
  const oraId = event.params.oraId;
  const data = event.data && event.data.data ? event.data.data() : null;
  if (!data || data.stato !== "da_validare") return;
  const db = admin.firestore();
  const lavoroSnap = await db.doc(`tenants/${tenantId}/lavori/${lavoroId}`).get();
  if (!lavoroSnap.exists) return;
  const lavoro = lavoroSnap.data();
  const { core } = await getEngine();
  const capoId = lavoro.caposquadraId ? String(lavoro.caposquadraId) : "";
  const prefsByUser = {};
  if (capoId) {
    const capoSnap = await db.collection("users").doc(capoId).get();
    if (capoSnap.exists) prefsByUser[capoId] = capoSnap.data().notificationPrefs;
  }
  const docs = core.buildNotificationEventDocs({
    eventId: "ore_da_validare",
    tenantId,
    sourceCollection: "oreOperai",
    sourceId: oraId,
    lavoroId,
    actorUserId: data.operaioId || data.userId || null,
    lavoro,
    vars: { count: 1, lavoroNome: lavoro.nome || "Lavoro" },
    prefsByUser,
  });
  await persistAndSend(db, docs);
}

async function processQueued(db) {
  const now = admin.firestore.Timestamp.now();
  const snap = await db.collectionGroup("notificationEvents")
    .where("status", "==", "queued")
    .where("sendAfter", "<=", now)
    .limit(100)
    .get();
  for (const docSnap of snap.docs) {
    await deliverEvent(db, docSnap.ref, docSnap.data());
  }
}

async function processConfermeInRitardo(db) {
  const { policy, core } = await getEngine();
  const now = new Date();
  const snap = await db.collectionGroup("comunicazioni")
    .where("stato", "==", "attiva")
    .limit(200)
    .get();
  for (const docSnap of snap.docs) {
    const data = docSnap.data() || {};
    if (data.confermeReminderSentAt) continue;
    const dest = destinatariIds(data);
    const conf = confermeCount(data);
    if (!dest.length || conf >= dest.length) continue;
    const path = docSnap.ref.path;
    const tenantId = path.split("/")[1];
    const capoId = data.caposquadraId ? String(data.caposquadraId) : "";
    if (!capoId) continue;
    const capoSnap = await db.collection("users").doc(capoId).get();
    const capoPrefs = capoSnap.exists ? capoSnap.data().notificationPrefs : {};
    const createdAt = toJsDate(data.createdAt) || toJsDate(data.data) || now;
    if (!policy.shouldEscalateConferme({
      createdAt,
      now,
      destCount: dest.length,
      confermeCount: conf,
      prefs: capoPrefs,
    })) continue;
    const docs = core.buildNotificationEventDocs({
      eventId: "conferme_in_ritardo",
      tenantId,
      sourceCollection: "comunicazioni",
      sourceId: docSnap.id,
      caposquadraId: capoId,
      lavoroId: data.lavoroId || null,
      vars: {
        lavoroNome: data.lavoroNome || "Comunicazione",
        pendenti: dest.length - conf,
      },
      prefsByUser: { [capoId]: capoPrefs },
    });
    await persistAndSend(db, docs);
    await docSnap.ref.update({
      confermeReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function loadSquadre(db, tenantId) {
  const snap = await db.collection(`tenants/${tenantId}/squadre`).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function displayNameFromUserSnap(snap) {
  if (!snap || !snap.exists) return "";
  const d = snap.data() || {};
  return [d.nome, d.cognome].filter(Boolean).join(" ").trim() || d.email || snap.id;
}

async function closeAssenzaNotificationEvents(db, tenantId, assenzaId, status) {
  const snap = await db.collection(`tenants/${tenantId}/notificationEvents`)
    .where("type", "==", "assenza_turno")
    .where("sourceId", "==", String(assenzaId))
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => {
    const cur = d.data() || {};
    if (cur.status === "acted" || cur.status === "resolved") return;
    batch.update(d.ref, {
      status,
      waStatus: "skipped",
      closedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
}

async function handleAssenzaWritten(event) {
  const tenantId = event.params.tenantId;
  const assenzaId = event.params.assenzaId;
  const before = event.data && event.data.before && event.data.before.exists
    ? event.data.before.data()
    : null;
  const after = event.data && event.data.after && event.data.after.exists
    ? event.data.after.data()
    : null;
  const { core } = await getEngine();
  const db = admin.firestore();
  const now = new Date();
  const life = core.detectAssenzaLifecycle(before, after, now);
  if (life.closeStatus) {
    await closeAssenzaNotificationEvents(db, tenantId, assenzaId, life.closeStatus);
  }
  if (!life.notify || !after) return;

  const tenantUsers = await loadTenantUsers(db, tenantId);
  const squadre = await loadSquadre(db, tenantId);
  let lavoro = null;
  if (after.lavoroId) {
    const lavoroSnap = await db.doc(`tenants/${tenantId}/lavori/${after.lavoroId}`).get();
    if (lavoroSnap.exists) lavoro = { id: lavoroSnap.id, ...lavoroSnap.data() };
  }
  const operaioId = after.operaioId ? String(after.operaioId) : "";
  let operaioNome = "Operaio";
  if (operaioId) {
    const opSnap = await db.collection("users").doc(operaioId).get();
    operaioNome = (await displayNameFromUserSnap(opSnap)) || "Operaio";
  }
  const squad = squadre.find((s) => Array.isArray(s.operai) && s.operai.map(String).includes(operaioId));
  const lavoroNome = (lavoro && lavoro.nome)
    || (squad && squad.nome)
    || "turno";
  const prefsByUser = prefsMapFromUsers(tenantUsers);
  const actor = after.segnalatoDa || after.confermatoDa || after.creatoDa || null;
  const giorno = after.dataInizioGiorno || "";
  const docs = core.buildNotificationEventDocs({
    eventId: "assenza_turno",
    tenantId,
    sourceCollection: "assenzeOperai",
    sourceId: assenzaId,
    lavoroId: after.lavoroId || (lavoro && lavoro.id) || null,
    actorUserId: actor,
    lavoro: lavoro || {},
    operaioId,
    squadre,
    tenantUsers,
    vars: {
      lavoroNome,
      operaioNome,
      dataGiorno: giorno,
    },
    prefsByUser,
    now,
  });
  await persistAndSend(db, docs);
}

function whatsappConfig() {
  const token = String(process.env.WHATSAPP_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const templateName = String(process.env.WHATSAPP_TEMPLATE_NAME || "").trim();
  return { token, phoneNumberId, templateName };
}

async function sendWhatsAppMessage({ to, body, operaioNome, lavoroNome }) {
  const cfg = whatsappConfig();
  if (!cfg.token || !cfg.phoneNumberId) {
    return { ok: false, reason: "whatsapp-not-configured" };
  }
  const toDigits = String(to || "").replace(/^\+/, "");
  if (!toDigits) return { ok: false, reason: "no-phone" };
  const url = `https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`;
  const payload = cfg.templateName
    ? {
      messaging_product: "whatsapp",
      to: toDigits,
      type: "template",
      template: {
        name: cfg.templateName,
        language: { code: "it" },
        components: [{
          type: "body",
          parameters: [
            { type: "text", text: String(operaioNome || "Operaio").slice(0, 60) },
            { type: "text", text: String(lavoroNome || "turno").slice(0, 60) },
          ],
        }],
      },
    }
    : {
      messaging_product: "whatsapp",
      to: toDigits,
      type: "text",
      text: { body: String(body || "").slice(0, 1000) },
    };
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    console.warn("[whatsapp] send failed", resp.status, errText.slice(0, 300));
    return { ok: false, reason: `whatsapp-http-${resp.status}` };
  }
  return { ok: true };
}

async function processAssenzaWhatsApp(db) {
  const { policy } = await getEngine();
  const now = new Date();
  let snap;
  try {
    snap = await db.collectionGroup("notificationEvents")
      .where("waStatus", "==", "pending")
      .limit(80)
      .get();
  } catch (err) {
    console.warn("[whatsapp] query waStatus:", err && err.message);
    return;
  }
  const cfg = whatsappConfig();
  const grouped = new Map();
  snap.docs.forEach((d) => {
    const data = d.data() || {};
    if (data.type !== "assenza_turno") return;
    const key = `${data.tenantId}:${data.sourceId}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push({ ref: d.ref, data, id: d.id });
  });

  for (const [key, pendingEvents] of grouped) {
    const tenantId = pendingEvents[0].data.tenantId;
    const sourceId = pendingEvents[0].data.sourceId;
    let siblings;
    try {
      siblings = await db.collection(`tenants/${tenantId}/notificationEvents`)
        .where("type", "==", "assenza_turno")
        .where("sourceId", "==", String(sourceId))
        .get();
    } catch (err) {
      console.warn("[whatsapp] siblings", key, err && err.message);
      continue;
    }
    const sibData = siblings.docs.map((d) => d.data() || {});
    const anyClosed = sibData.some((d) => {
      const st = String(d.status || "");
      return st === "seen" || st === "acted" || st === "resolved" || st === "dismissed";
    });
    const alreadyEscalated = sibData.some((d) => d.waStatus === "sent" || String(d.status) === "escalated");
    if (anyClosed || alreadyEscalated) {
      await Promise.all(pendingEvents.map((e) => e.ref.update({
        waStatus: anyClosed ? "blocked-seen" : "skipped",
      })));
      continue;
    }

    for (const ev of pendingEvents) {
      const userSnap = await db.collection("users").doc(String(ev.data.recipientUserId)).get();
      const userData = userSnap.exists ? userSnap.data() : {};
      const prefs = policy.mergeNotificationPrefs(userData && userData.notificationPrefs);
      const sentAt = toJsDate(ev.data.sentAt) || toJsDate(ev.data.createdAt) || now;
      if (!policy.shouldEscalateAssenzaWhatsApp({
        createdAt: toJsDate(ev.data.createdAt),
        sentAt,
        now,
        prefs,
        groupSeen: false,
        groupActed: false,
        alreadyEscalated: false,
      })) continue;

      if (!cfg.token || !cfg.phoneNumberId) {
        await ev.ref.update({ waStatus: "skipped", waReason: "whatsapp-not-configured" });
        continue;
      }
      const phone = policy.normalizeNotifyPhone(userData && userData.telefono);
      if (!phone) {
        await ev.ref.update({ waStatus: "skipped", waReason: "no-phone" });
        continue;
      }
      const waBody = `${ev.data.title || "Assenza oggi"}: ${ev.data.body || ""}`.trim();
      const result = await sendWhatsAppMessage({
        to: phone,
        body: waBody,
        operaioNome: ev.data.operaioNome || "Operaio",
        lavoroNome: ev.data.lavoroNome || "turno",
      });
      if (!result.ok) {
        await ev.ref.update({ waStatus: "pending", waReason: result.reason || "send-failed" });
        continue;
      }
      await ev.ref.update({
        waStatus: "sent",
        status: "escalated",
        waSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}

const onComunicazioneCreated = onDocumentCreated(
  { document: "tenants/{tenantId}/comunicazioni/{comunicazioneId}", region: REGION },
  handleComunicazioneCreated
);

const onLavoroWritten = onDocumentWritten(
  { document: "tenants/{tenantId}/lavori/{lavoroId}", region: REGION },
  handleLavoroWritten
);

const onOreOperaiCreated = onDocumentCreated(
  { document: "tenants/{tenantId}/lavori/{lavoroId}/oreOperai/{oraId}", region: REGION },
  handleOreCreated
);

const onAssenzaWritten = onDocumentWritten(
  { document: "tenants/{tenantId}/assenzeOperai/{assenzaId}", region: REGION },
  handleAssenzaWritten
);

const processNotificationQueue = onSchedule(
  { schedule: "every 5 minutes", region: REGION, timeZone: "Europe/Rome" },
  async () => {
    const db = admin.firestore();
    await processQueued(db);
    await processConfermeInRitardo(db);
    await processAssenzaWhatsApp(db);
  }
);

module.exports = {
  onComunicazioneCreated,
  onLavoroWritten,
  onOreOperaiCreated,
  onAssenzaWritten,
  processNotificationQueue,
};
