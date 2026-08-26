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
  if (!prefs.pushEnabled) {
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

const processNotificationQueue = onSchedule(
  { schedule: "every 15 minutes", region: REGION, timeZone: "Europe/Rome" },
  async () => {
    const db = admin.firestore();
    await processQueued(db);
    await processConfermeInRitardo(db);
  }
);

module.exports = {
  onComunicazioneCreated,
  onLavoroWritten,
  onOreOperaiCreated,
  processNotificationQueue,
};
