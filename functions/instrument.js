/**
 * Inizializzazione Sentry per Cloud Functions (deve essere caricata prima di altri require).
 * DSN: progetto Sentry `node-gcpfunctions` (org `sabbie-gialle`). Imposta SENTRY_DSN su Cloud Run / secrets.
 *
 * Prima di uscire verso Sentry ogni evento viene filtrato. Le Cloud Functions trattano dati
 * personali (email, telefono, IP) e credenziali (password, token, chiavi, cookie, header di
 * autorizzazione): inviarli a un servizio esterno violerebbe la privacy e il GDPR e
 * esporrebbe segreti. Il filtro tiene solo ciò che serve a diagnosticare l'errore.
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/firebase/
 */
"use strict";

const Sentry = require("@sentry/node");

const MAX_SCRUB_DEPTH = 6;
const FILTERED = "[Filtered]";
const ALLOWED_HEADERS = new Set(["content-type", "user-agent", "x-cloud-trace-context"]);
const SENSITIVE_KEY_RE =
  /password|passwd|pwd|secret|token|idtoken|apikey|api_key|authorization|cookie|email|telefono|phone|iban/i;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const JWT_RE = /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const STRIPE_KEY_RE = /sk_(?:live|test)_[A-Za-z0-9]+/g;
const GOOGLE_KEY_RE = /AIza[0-9A-Za-z_-]{10,}/g;
const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"']+/gi;

function stripQueryFromUrl(raw) {
  if (typeof raw !== "string" || raw.length === 0) return raw;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      const parsed = new URL(raw);
      return parsed.origin + parsed.pathname;
    }
  } catch (_) {
    /* URL non parsabile: si taglia sotto. */
  }
  const cut = raw.search(/[?#]/);
  return cut === -1 ? raw : raw.slice(0, cut);
}

function replaceWith(re, text, replacement) {
  re.lastIndex = 0;
  return text.replace(re, replacement);
}

function scrubText(value) {
  if (typeof value !== "string" || value.length === 0) return value;
  let out = value;
  out = replaceWith(JWT_RE, out, FILTERED);
  out = replaceWith(STRIPE_KEY_RE, out, FILTERED);
  out = replaceWith(GOOGLE_KEY_RE, out, FILTERED);
  out = replaceWith(EMAIL_RE, out, "[email]");
  URL_IN_TEXT_RE.lastIndex = 0;
  out = out.replace(URL_IN_TEXT_RE, function (match) {
    let core = match;
    let suffix = "";
    while (core.length > 0 && /[),.;!?\]]/.test(core.charAt(core.length - 1))) {
      suffix = core.charAt(core.length - 1) + suffix;
      core = core.slice(0, -1);
    }
    return stripQueryFromUrl(core) + suffix;
  });
  return out;
}

function scrubTree(value, depth, seen) {
  if (value == null || typeof value !== "object") return value;
  if (depth > MAX_SCRUB_DEPTH) return value;
  if (seen.has(value)) return FILTERED;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map(function (item) {
      return scrubTree(item, depth + 1, seen);
    });
  }
  const out = {};
  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (SENSITIVE_KEY_RE.test(String(key))) {
      out[key] = FILTERED;
    } else {
      out[key] = scrubTree(value[key], depth + 1, seen);
    }
  }
  return out;
}

function scrubRequest(request) {
  if (request == null || typeof request !== "object") return request;
  if (typeof request.url === "string") {
    request.url = stripQueryFromUrl(request.url);
  }
  delete request.query_string;
  delete request.cookies;
  delete request.data;
  if (request.headers == null || typeof request.headers !== "object" || Array.isArray(request.headers)) {
    delete request.headers;
  } else {
    const kept = {};
    const names = Object.keys(request.headers);
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      if (ALLOWED_HEADERS.has(String(name).toLowerCase())) {
        kept[name] = request.headers[name];
      }
    }
    request.headers = kept;
  }
  return request;
}

function scrubUser(user) {
  if (user == null || typeof user !== "object" || Array.isArray(user)) return user;
  const next = {};
  if (Object.prototype.hasOwnProperty.call(user, "id")) next.id = user.id;
  return next;
}

function scrubExceptionValues(exception) {
  if (exception == null || typeof exception !== "object" || !Array.isArray(exception.values)) return;
  for (let i = 0; i < exception.values.length; i++) {
    const entry = exception.values[i];
    if (entry && typeof entry === "object" && typeof entry.value === "string") {
      entry.value = scrubText(entry.value);
    }
  }
}

function dropUnsafeFields(event) {
  if (event == null || typeof event !== "object") return event;
  try {
    delete event.request;
    delete event.user;
    delete event.extra;
  } catch (_) {
    /* L'evento resta comunque utilizzabile senza quei campi. */
  }
  return event;
}

function scrubEvent(event) {
  try {
    if (event == null || typeof event !== "object") return event;
    if (event.request != null) event.request = scrubRequest(event.request);
    if (event.user != null) event.user = scrubUser(event.user);
    if (event.extra != null && typeof event.extra === "object") {
      event.extra = scrubTree(event.extra, 0, new WeakSet());
    }
    if (event.contexts != null && typeof event.contexts === "object") {
      event.contexts = scrubTree(event.contexts, 0, new WeakSet());
    }
    if (event.tags != null && typeof event.tags === "object") {
      event.tags = scrubTree(event.tags, 0, new WeakSet());
    }
    if (typeof event.message === "string") event.message = scrubText(event.message);
    if (typeof event.transaction === "string") event.transaction = scrubText(event.transaction);
    scrubExceptionValues(event.exception);
    return event;
  } catch (_) {
    return dropUnsafeFields(event);
  }
}

function breadcrumbBlob(breadcrumb) {
  const parts = [];
  if (typeof breadcrumb.message === "string") parts.push(breadcrumb.message);
  if (breadcrumb.data != null) {
    try {
      parts.push(typeof breadcrumb.data === "string" ? breadcrumb.data : JSON.stringify(breadcrumb.data));
    } catch (_) {
      parts.push("");
    }
  }
  return parts.join(" ").toLowerCase();
}

function beforeBreadcrumb(breadcrumb) {
  try {
    if (breadcrumb == null || typeof breadcrumb !== "object") return breadcrumb;
    const category = String(breadcrumb.category || "").toLowerCase();
    const type = String(breadcrumb.type || "").toLowerCase();
    if (category === "console" || type === "console") {
      const blob = breadcrumbBlob(breadcrumb);
      if (blob.indexOf("password") !== -1 || blob.indexOf("token") !== -1) return null;
    }
    if (
      category === "http" ||
      category === "fetch" ||
      type === "http" ||
      type === "fetch"
    ) {
      if (
        breadcrumb.data &&
        typeof breadcrumb.data === "object" &&
        typeof breadcrumb.data.url === "string"
      ) {
        breadcrumb.data.url = stripQueryFromUrl(breadcrumb.data.url);
      }
    }
    if (typeof breadcrumb.message === "string") {
      breadcrumb.message = scrubText(breadcrumb.message);
    }
    return breadcrumb;
  } catch (_) {
    return null;
  }
}

module.exports.scrubEvent = scrubEvent;

const dsn = process.env.SENTRY_DSN;
if (dsn && String(dsn).trim() !== "") {
  const traces =
    process.env.SENTRY_TRACES_SAMPLE_RATE !== undefined
      ? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
      : 0.2;
  Sentry.init({
    dsn: String(dsn).trim(),
    environment:
      process.env.SENTRY_ENVIRONMENT ||
      process.env.GCLOUD_PROJECT ||
      "production",
    sendDefaultPii: false,
    tracesSampleRate: Number.isFinite(traces) ? Math.min(1, Math.max(0, traces)) : 0.2,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: beforeBreadcrumb,
  });
} else {
  console.warn("[Sentry] SENTRY_DSN non impostato: monitoring disattivato.");
}
