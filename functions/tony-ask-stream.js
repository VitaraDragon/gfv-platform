"use strict";

const { onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

const sentryDsn = defineSecret("SENTRY_DSN");
const openWeatherApiKey = defineSecret("OPENWEATHER_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === "function") res.flush();
}

/** Body JSON per onRequest (Buffer / string / oggetto già parsato). */
async function readJsonBody(req) {
  let body = req.body;
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString("utf8"));
    } catch (_) {
      return {};
    }
  }
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (_) {
      return {};
    }
  }
  if (body && typeof body === "object") {
    return body;
  }
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (_) {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

let handleTonyAskRequestRef = null;
function getHandleTonyAskRequest() {
  if (typeof handleTonyAskRequestRef === "function") return handleTonyAskRequestRef;
  const mod = require("./index");
  handleTonyAskRequestRef = mod.handleTonyAskRequest;
  if (typeof handleTonyAskRequestRef !== "function") {
    throw new Error("handleTonyAskRequest non disponibile");
  }
  return handleTonyAskRequestRef;
}

/**
 * SSE streaming endpoint per Tony (Fase 3).
 * Auth: Authorization: Bearer <Firebase ID token>
 * Body JSON: { message, context?, history? }
 */
exports.tonyAskStream = onRequest(
  {
    region: "europe-west1",
    secrets: [sentryDsn, openWeatherApiKey],
    timeoutSeconds: 120,
    memory: "512MiB",
    cors: false,
    invoker: "public",
  },
  async (req, res) => {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const authHeader = req.headers.authorization || req.headers.Authorization || "";
    const token = String(authHeader).replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      res.status(401).json({ error: "Missing Authorization Bearer token" });
      return;
    }

    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (authErr) {
      console.warn("[tonyAskStream] verifyIdToken:", authErr.message);
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    let reqData;
    try {
      reqData = await readJsonBody(req);
    } catch (_) {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    reqData = reqData && typeof reqData === "object" ? reqData : {};

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") res.flushHeaders();
    // Commento SSE + padding: evita buffering proxy su risposte piccole (solo evento done).
    res.write(`: tony-stream-open ${" ".repeat(2048)}\n\n`);
    if (typeof res.flush === "function") res.flush();

    const fakeRequest = {
      auth: { uid: decoded.uid, token: decoded },
      data: reqData,
    };

    try {
      const handleTonyAskRequest = getHandleTonyAskRequest();
      const result = await handleTonyAskRequest(fakeRequest, {
        stream: true,
        onChunk(delta) {
          if (delta) writeSse(res, "chunk", { delta: String(delta) });
        },
      });
      writeSse(res, "done", {
        text: result && result.text != null ? result.text : "",
        command: result && result.command ? result.command : null,
      });
      if (typeof res.flush === "function") res.flush();
      res.end();
    } catch (err) {
      console.error("[tonyAskStream]", err);
      const code = err instanceof HttpsError ? err.code : "internal";
      const message = err instanceof HttpsError ? err.message : err.message || "Errore interno";
      if (!res.headersSent) {
        res.status(code === "unauthenticated" ? 401 : code === "permission-denied" ? 403 : 500);
        res.json({ error: message, code });
        return;
      }
      writeSse(res, "error", { code, message });
      res.end();
    }
  }
);
