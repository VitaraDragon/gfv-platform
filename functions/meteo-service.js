/**
 * Meteo — proxy OpenWeather One Call 3.0 + cache Firestore.
 * Piano Free: bloccato. Piano Base+: meteo base sede. Modulo `meteo`: avanzato + terreni.
 */

const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const {
  DEFAULT_TONY_METEO_RULES,
  buildMeteoConsigli,
  evaluateMeteoOperativoGiorno,
  evaluateGiornoOperativoCompleto,
  isGiornoOperativoAccettabile,
  isGiornoOperativoIdeale,
  isGiornoOperativoRiserva,
  parseTipoCampoFromMessage,
  normalizeTipoCampo,
  labelMorfologia,
  mergeTonyMeteoRules,
} = require("./tony-meteo-rules");
const {
  isTonyOperationalCreationIntent,
  isTonyPreventivoFormFieldCorrection,
} = require("./tony-quick-replies");
const { localizeMeteoAlerts, translateMeteoAlertEvent } = require("./meteo-alert-i18n");
const { resolveEffectiveModules } = require("./module-trial");

const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_TERRENI_METEO = 30;
const OW_ONE_CALL_URL = "https://api.openweathermap.org/data/3.0/onecall";

function normalizeSubscriptionPlanId(raw) {
  if (raw == null || raw === "") return "base";
  const p = String(raw).trim().toLowerCase();
  if (p === "free" || p === "freemium") return "free";
  if (["starter", "professional", "enterprise", "base"].includes(p)) return "base";
  return "base";
}

function normalizeCoordinate(raw) {
  if (!raw || typeof raw !== "object") return null;
  const lat = typeof raw.lat === "number" ? raw.lat : parseFloat(raw.lat);
  const lng = typeof raw.lng === "number" ? raw.lng : parseFloat(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function windMsToKmh(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 3.6);
}

function tenantHasMeteoModule(tenantData) {
  return resolveEffectiveModules(tenantData || {}).includes("meteo");
}

/** Firestore tenant + moduli_attivi inviati dal client (Tony context). */
function resolveMeteoModuleActive(tenantData, moduliAttiviFromRequest) {
  if (tenantHasMeteoModule(tenantData || {})) return true;
  if (Array.isArray(moduliAttiviFromRequest)) {
    return moduliAttiviFromRequest.some((m) => String(m || "").toLowerCase() === "meteo");
  }
  return false;
}

/**
 * Verifica membership tenant attiva (tutti i ruoli — meteo visibile in dashboard).
 */
async function assertBelongsToTenant(db, uid, tenantId) {
  if (!tenantId || typeof tenantId !== "string") {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError("permission-denied", "Utente non trovato.");
  }
  const data = snap.data();
  const memberships = data.tenantMemberships || {};
  const m = memberships[tenantId];
  if (m && m.stato === "attivo") {
    return;
  }
  if (data.tenantId === tenantId) {
    return;
  }
  throw new HttpsError("permission-denied", "Accesso non autorizzato a questo tenant.");
}

async function loadTenantContext(db, tenantId) {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) {
    throw new HttpsError("not-found", "Tenant non trovato.");
  }
  const tenantData = tenantSnap.data() || {};
  const plan = normalizeSubscriptionPlanId(tenantData.plan || tenantData.piano);
  return { tenantData, plan };
}

function assertBasePlanOrThrow(plan) {
  if (plan === "free") {
    throw new HttpsError("permission-denied", "Il meteo non è incluso nel piano Free.");
  }
}

function assertMeteoModuleOrThrow(tenantData) {
  if (!tenantHasMeteoModule(tenantData)) {
    throw new HttpsError(
      "permission-denied",
      "Il modulo Meteo non è attivo per questa azienda."
    );
  }
}

function resolveTerrenoCoordinates(terrenoData) {
  const poly = terrenoData && terrenoData.polygonCoords;
  if (Array.isArray(poly) && poly.length >= 3) {
    let latSum = 0;
    let lngSum = 0;
    let count = 0;
    for (const c of poly) {
      const lat = typeof c.lat === "number" ? c.lat : parseFloat(c.lat);
      const lng = typeof c.lng === "number" ? c.lng : parseFloat(c.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      latSum += lat;
      lngSum += lng;
      count += 1;
    }
    if (count > 0) {
      return { lat: latSum / count, lng: lngSum / count };
    }
  }
  return normalizeCoordinate(terrenoData && terrenoData.coordinate);
}

function isoFromUnix(sec) {
  if (sec == null || !Number.isFinite(Number(sec))) return null;
  return new Date(Number(sec) * 1000).toISOString();
}

function parseRainMmFromOwValue(rain) {
  if (rain == null) return null;
  if (typeof rain === "number" && Number.isFinite(rain)) {
    const v = Math.round(rain * 100) / 100;
    return v > 0 ? v : null;
  }
  if (typeof rain === "object") {
    const oneH = rain["1h"];
    if (oneH != null && Number.isFinite(Number(oneH))) {
      const v = Math.round(Number(oneH) * 100) / 100;
      return v > 0 ? v : null;
    }
  }
  return null;
}

function sumHourlyRainMmForDate(hourly, dateStr) {
  if (!dateStr || !Array.isArray(hourly)) return null;
  let sum = 0;
  let has = false;
  for (const h of hourly) {
    if (!h || !h.dt) continue;
    if (String(h.dt).slice(0, 10) !== dateStr) continue;
    const mm = h.rainMm != null ? Number(h.rainMm) : null;
    if (mm == null || !Number.isFinite(mm) || mm <= 0) continue;
    sum += mm;
    has = true;
  }
  return has ? Math.round(sum * 100) / 100 : null;
}

function enrichDailyRainMm(dailyEntry, hourly, dateStr) {
  if (!dailyEntry || typeof dailyEntry !== "object") return dailyEntry;
  if (dailyEntry.rainMm != null) return dailyEntry;
  const fromHourly = sumHourlyRainMmForDate(hourly, dateStr);
  if (fromHourly == null) return dailyEntry;
  return Object.assign({}, dailyEntry, { rainMm: fromHourly });
}

function mapOpenWeatherAlerts(data) {
  return localizeMeteoAlerts(
    (Array.isArray(data.alerts) ? data.alerts : []).map((a) => ({
      sender: a.sender_name || "",
      event: a.event || "",
      start: isoFromUnix(a.start),
      end: isoFromUnix(a.end),
      description: a.description || "",
      tags: Array.isArray(a.tags) ? a.tags : [],
    }))
  );
}

function relocalizeMeteoPayload(meteo) {
  if (!meteo || typeof meteo !== "object") return meteo;
  const alerts = Array.isArray(meteo.alerts) ? meteo.alerts : [];
  if (!alerts.length) return meteo;
  return Object.assign({}, meteo, { alerts: localizeMeteoAlerts(alerts) });
}

function normalizeOpenWeatherBase(data, location) {
  const current = data.current || {};
  const daily = Array.isArray(data.daily) ? data.daily : [];
  const daily0 = daily[0] || {};
  const daily1 = daily[1] || {};
  const wCurrent = (current.weather && current.weather[0]) || {};
  const wTomorrow = (daily1.weather && daily1.weather[0]) || {};
  const wToday = (daily0.weather && daily0.weather[0]) || {};

  return {
    location,
    current: {
      temp: current.temp != null ? Math.round(current.temp * 10) / 10 : null,
      feelsLike: current.feels_like != null ? Math.round(current.feels_like * 10) / 10 : null,
      description: wCurrent.description || "",
      icon: wCurrent.icon || "",
      windSpeedKmh: windMsToKmh(current.wind_speed),
      windDeg: current.wind_deg != null ? current.wind_deg : null,
      humidity: current.humidity != null ? current.humidity : null,
    },
    today: {
      tempMin: daily0.temp && daily0.temp.min != null ? Math.round(daily0.temp.min) : null,
      tempMax: daily0.temp && daily0.temp.max != null ? Math.round(daily0.temp.max) : null,
      pop: daily0.pop != null ? Math.round(daily0.pop * 100) : null,
      rainMm: parseRainMmFromOwValue(daily0.rain),
      description: wToday.description || wCurrent.description || "",
      windSpeedKmh: windMsToKmh(daily0.wind_speed),
      humidity: daily0.humidity != null ? daily0.humidity : null,
    },
    tomorrow: {
      tempMin: daily1.temp && daily1.temp.min != null ? Math.round(daily1.temp.min) : null,
      tempMax: daily1.temp && daily1.temp.max != null ? Math.round(daily1.temp.max) : null,
      pop: daily1.pop != null ? Math.round(daily1.pop * 100) : null,
      rainMm: parseRainMmFromOwValue(daily1.rain),
      description: wTomorrow.description || "",
      windSpeedKmh: windMsToKmh(daily1.wind_speed),
      humidity: daily1.humidity != null ? daily1.humidity : null,
    },
    updatedAt: new Date().toISOString(),
    attribution: "OpenWeather",
    alerts: mapOpenWeatherAlerts(data),
  };
}

function normalizeOpenWeatherExtended(data, location) {
  const base = normalizeOpenWeatherBase(data, location);
  const hourly = (Array.isArray(data.hourly) ? data.hourly : []).slice(0, 48).map((h) => {
    const w = (h.weather && h.weather[0]) || {};
    return {
      dt: isoFromUnix(h.dt),
      temp: h.temp != null ? Math.round(h.temp) : null,
      pop: h.pop != null ? Math.round(h.pop * 100) : null,
      rainMm: parseRainMmFromOwValue(h.rain),
      description: w.description || "",
      icon: w.icon || "",
      windSpeedKmh: windMsToKmh(h.wind_speed),
    };
  });
  const dailyExtended = (Array.isArray(data.daily) ? data.daily : [])
    .slice(0, 8)
    .map((d) => {
      const w = (d.weather && d.weather[0]) || {};
      const dt = isoFromUnix(d.dt);
      const entry = {
        dt,
        tempMin: d.temp && d.temp.min != null ? Math.round(d.temp.min) : null,
        tempMax: d.temp && d.temp.max != null ? Math.round(d.temp.max) : null,
        pop: d.pop != null ? Math.round(d.pop * 100) : null,
        rainMm: parseRainMmFromOwValue(d.rain),
        description: w.description || "",
        icon: w.icon || "",
        windSpeedKmh: windMsToKmh(d.wind_speed),
        humidity: d.humidity != null ? d.humidity : null,
      };
      return enrichDailyRainMm(entry, hourly, dt ? String(dt).slice(0, 10) : null);
    });
  if (base.today && base.today.rainMm == null && dailyExtended[0] && dailyExtended[0].rainMm != null) {
    base.today = Object.assign({}, base.today, { rainMm: dailyExtended[0].rainMm });
  }
  if (base.tomorrow && base.tomorrow.rainMm == null && dailyExtended[1] && dailyExtended[1].rainMm != null) {
    base.tomorrow = Object.assign({}, base.tomorrow, { rainMm: dailyExtended[1].rainMm });
  }

  const minutely = (Array.isArray(data.minutely) ? data.minutely : []).slice(0, 60).map((m) => ({
    dt: isoFromUnix(m.dt),
    precipitation:
      m.precipitation != null ? Math.round(Number(m.precipitation) * 100) / 100 : 0,
  }));

  let maxMinutelyPrecip = 0;
  let minutesWithRain = 0;
  for (const m of minutely) {
    const p = m.precipitation || 0;
    if (p > maxMinutelyPrecip) maxMinutelyPrecip = p;
    if (p > 0) minutesWithRain += 1;
  }

  return Object.assign({}, base, {
    hourly,
    dailyExtended,
    alerts: base.alerts || [],
    minutely,
    minutelySummary: {
      maxPrecipitation: maxMinutelyPrecip,
      minutesWithRain,
      hasRainSoon: maxMinutelyPrecip > 0,
    },
  });
}

async function fetchOneCall(apiKey, lat, lng, exclude) {
  const url = new URL(OW_ONE_CALL_URL);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("units", "metric");
  url.searchParams.set("lang", "it");
  if (exclude) {
    url.searchParams.set("exclude", exclude);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenWeather HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  return res.json();
}

function cacheFetchedAtMs(cached) {
  if (!cached || !cached.fetchedAt) return 0;
  if (typeof cached.fetchedAt.toMillis === "function") {
    return cached.fetchedAt.toMillis();
  }
  return 0;
}

async function readCachedMeteo(cacheRef, coord, nowMs) {
  const cacheSnap = await cacheRef.get();
  if (!cacheSnap.exists) return null;
  const cached = cacheSnap.data() || {};
  const fetchedAtMs = cacheFetchedAtMs(cached);
  if (
    cached.normalized &&
    fetchedAtMs > 0 &&
    nowMs - fetchedAtMs < CACHE_TTL_MS &&
    cached.lat === coord.lat &&
    cached.lng === coord.lng
  ) {
    return { meteo: relocalizeMeteoPayload(cached.normalized), cached: true };
  }
  return null;
}

async function fetchAndCacheMeteo(cacheRef, apiKey, coord, location, exclude, normalizeFn) {
  const owData = await fetchOneCall(apiKey, coord.lat, coord.lng, exclude);
  const normalized = normalizeFn(owData, location);
  await cacheRef.set({
    lat: coord.lat,
    lng: coord.lng,
    normalized,
    fetchedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { meteo: normalized, cached: false };
}

function buildSedeLocation(tenantData, coord) {
  const labelParts = [tenantData.nome, tenantData.citta].filter(Boolean);
  return {
    lat: coord.lat,
    lng: coord.lng,
    label: labelParts.length ? labelParts.join(" — ") : "Sede aziendale",
  };
}

/**
 * Callable handler: meteo base sulla sede aziendale.
 */
async function handleGetMeteoSede(db, apiKey, request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  if (!apiKey || typeof apiKey !== "string") {
    throw new HttpsError("failed-precondition", "OPENWEATHER_API_KEY non configurata sul server.");
  }

  const data = request.data || {};
  const tenantId = typeof data.tenantId === "string" ? data.tenantId.trim() : "";
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }

  await assertBelongsToTenant(db, request.auth.uid, tenantId);
  const { tenantData, plan } = await loadTenantContext(db, tenantId);
  assertBasePlanOrThrow(plan);

  const coord = normalizeCoordinate(tenantData.sedeCoordinate);
  if (!coord) {
    return {
      ok: false,
      code: "SEDE_NOT_SET",
      message: "Imposta la sede aziendale in Impostazioni per visualizzare il meteo.",
    };
  }

  const location = buildSedeLocation(tenantData, coord);
  const cacheRef = db.collection("tenants").doc(tenantId).collection("meteoCache").doc("sede");
  const nowMs = Date.now();

  const hit = await readCachedMeteo(cacheRef, coord, nowMs);
  if (hit) {
    return { ok: true, cached: true, meteo: hit.meteo };
  }

  try {
    const result = await fetchAndCacheMeteo(
      cacheRef,
      apiKey,
      coord,
      location,
      "minutely,hourly,alerts",
      normalizeOpenWeatherBase
    );
    return { ok: true, cached: result.cached, meteo: result.meteo };
  } catch (err) {
    console.error("[getMeteoSede] OpenWeather:", err.message);
    throw new HttpsError(
      "unavailable",
      "Meteo temporaneamente non disponibile. Riprova tra qualche minuto."
    );
  }
}

/**
 * Callable handler: meteo avanzato sede (modulo meteo attivo).
 */
async function handleGetMeteoSedeAvanzato(db, apiKey, request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  if (!apiKey || typeof apiKey !== "string") {
    throw new HttpsError("failed-precondition", "OPENWEATHER_API_KEY non configurata sul server.");
  }

  const data = request.data || {};
  const tenantId = typeof data.tenantId === "string" ? data.tenantId.trim() : "";
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }

  await assertBelongsToTenant(db, request.auth.uid, tenantId);
  const { tenantData, plan } = await loadTenantContext(db, tenantId);
  assertBasePlanOrThrow(plan);
  assertMeteoModuleOrThrow(tenantData);

  const coord = normalizeCoordinate(tenantData.sedeCoordinate);
  if (!coord) {
    return {
      ok: false,
      code: "SEDE_NOT_SET",
      message: "Imposta la sede aziendale in Impostazioni per visualizzare il meteo.",
    };
  }

  const location = buildSedeLocation(tenantData, coord);
  const cacheRef = db
    .collection("tenants")
    .doc(tenantId)
    .collection("meteoCache")
    .doc("sedeAvanzato");
  const nowMs = Date.now();

  const hit = await readCachedMeteo(cacheRef, coord, nowMs);
  if (hit) {
    return { ok: true, cached: true, meteo: hit.meteo };
  }

  try {
    const result = await fetchAndCacheMeteo(
      cacheRef,
      apiKey,
      coord,
      location,
      null,
      normalizeOpenWeatherExtended
    );
    return { ok: true, cached: result.cached, meteo: result.meteo };
  } catch (err) {
    console.error("[getMeteoSedeAvanzato] OpenWeather:", err.message);
    throw new HttpsError(
      "unavailable",
      "Meteo temporaneamente non disponibile. Riprova tra qualche minuto."
    );
  }
}

async function fetchTerrenoMeteo(db, apiKey, tenantId, terrenoId, terrenoData, nowMs) {
  const coord = resolveTerrenoCoordinates(terrenoData);
  const nome = terrenoData.nome || "Terreno";
  const podere = terrenoData.podere || null;

  const tipoCampo = normalizeTipoCampo(terrenoData.tipoCampo);

  if (!coord) {
    return {
      terrenoId,
      nome,
      podere,
      tipoCampo,
      ok: false,
      code: "NO_COORDS",
      message: "Imposta il poligono o le coordinate del terreno sulla mappa.",
    };
  }

  const location = {
    lat: coord.lat,
    lng: coord.lng,
    label: podere ? `${nome} (${podere})` : nome,
  };

  const cacheRef = db
    .collection("tenants")
    .doc(tenantId)
    .collection("meteoCache")
    .doc(`terreno_${terrenoId}`);

  const hit = await readCachedMeteo(cacheRef, coord, nowMs);
  if (hit) {
    return { terrenoId, nome, podere, tipoCampo, ok: true, cached: true, meteo: hit.meteo };
  }

  try {
    const result = await fetchAndCacheMeteo(
      cacheRef,
      apiKey,
      coord,
      location,
      null,
      normalizeOpenWeatherExtended
    );
    return { terrenoId, nome, podere, tipoCampo, ok: true, cached: result.cached, meteo: result.meteo };
  } catch (err) {
    console.error(`[getMeteoTerreni] terreno ${terrenoId}:`, err.message);
    return {
      terrenoId,
      nome,
      podere,
      tipoCampo,
      ok: false,
      code: "FETCH_ERROR",
      message: "Meteo non disponibile per questo terreno.",
    };
  }
}

/**
 * Callable handler: meteo per terreni aziendali (modulo meteo attivo).
 */
async function handleGetMeteoTerreni(db, apiKey, request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Autenticazione richiesta.");
  }
  if (!apiKey || typeof apiKey !== "string") {
    throw new HttpsError("failed-precondition", "OPENWEATHER_API_KEY non configurata sul server.");
  }

  const data = request.data || {};
  const tenantId = typeof data.tenantId === "string" ? data.tenantId.trim() : "";
  if (!tenantId) {
    throw new HttpsError("invalid-argument", "tenantId obbligatorio.");
  }

  await assertBelongsToTenant(db, request.auth.uid, tenantId);
  const { tenantData, plan } = await loadTenantContext(db, tenantId);
  assertBasePlanOrThrow(plan);
  assertMeteoModuleOrThrow(tenantData);

  const nowMs = Date.now();
  let sedeResult = null;

  const coordSede = normalizeCoordinate(tenantData.sedeCoordinate);
  if (coordSede) {
    const location = buildSedeLocation(tenantData, coordSede);
    const cacheRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("meteoCache")
      .doc("sedeAvanzato");
    const hit = await readCachedMeteo(cacheRef, coordSede, nowMs);
    if (hit) {
      sedeResult = { ok: true, cached: true, meteo: hit.meteo };
    } else {
      try {
        const fetched = await fetchAndCacheMeteo(
          cacheRef,
          apiKey,
          coordSede,
          location,
          null,
          normalizeOpenWeatherExtended
        );
        sedeResult = { ok: true, cached: fetched.cached, meteo: fetched.meteo };
      } catch (err) {
        console.error("[getMeteoTerreni] sede:", err.message);
        sedeResult = {
          ok: false,
          code: "SEDE_FETCH_ERROR",
          message: "Meteo sede temporaneamente non disponibile.",
        };
      }
    }
  } else {
    sedeResult = {
      ok: false,
      code: "SEDE_NOT_SET",
      message: "Imposta la sede aziendale in Impostazioni.",
    };
  }

  const terreniSnap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("terreni")
    .get();

  const terreniDocs = terreniSnap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .filter((t) => !t.data.clienteId)
    .sort((a, b) => String(a.data.nome || "").localeCompare(String(b.data.nome || ""), "it"))
    .slice(0, MAX_TERRENI_METEO);

  const terreni = await mapWithConcurrency(terreniDocs, 8, (t) =>
    fetchTerrenoMeteo(db, apiKey, tenantId, t.id, t.data, nowMs)
  );

  const withoutCoords = terreniSnap.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .filter((t) => !t.data.clienteId && !resolveTerrenoCoordinates(t.data)).length;

  return {
    ok: true,
    sede: sedeResult,
    terreni,
    summary: {
      total: terreni.length,
      withMeteo: terreni.filter((r) => r.ok && r.meteo).length,
      withoutCoords,
      truncated: terreniSnap.docs.filter((d) => !(d.data() || {}).clienteId).length > MAX_TERRENI_METEO,
    },
  };
}

function compactDailyExtendedForContext(dailyExtended, opts = {}) {
  const slim = !!opts.slim;
  if (!Array.isArray(dailyExtended) || !dailyExtended.length) return [];
  return dailyExtended.map((d) => {
    const dtRaw = d && d.dt ? String(d.dt) : null;
    const dt = dtRaw ? dtRaw.slice(0, 10) : null;
    const base = {
      dt,
      tempMin: d && d.tempMin != null ? d.tempMin : null,
      tempMax: d && d.tempMax != null ? d.tempMax : null,
      pop: d && d.pop != null ? d.pop : null,
      rainMm: d && d.rainMm != null ? d.rainMm : null,
      windSpeedKmh: d && d.windSpeedKmh != null ? d.windSpeedKmh : null,
      humidity: d && d.humidity != null ? d.humidity : null,
    };
    if (slim) return base;
    return Object.assign({}, base, {
      description: d && d.description ? String(d.description) : "",
    });
  });
}

const GIORNI_SETTIMANA_IT = [
  "domenica",
  "lunedi",
  "martedi",
  "mercoledi",
  "giovedi",
  "venerdi",
  "sabato",
];

const MESI_IT = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function normalizeMeteoMsg(message) {
  return String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[,;]+/g, " ");
}

function capitalizeIt(s) {
  const t = String(s || "");
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}

/**
 * Aggiunge giornoSettimana / giornoMese / mese alle previsioni per Tony (lookup "sabato", "27").
 * @param {Array<object>|null|undefined} previsioni
 * @returns {Array<object>}
 */
function enrichPrevisioniGiornaliereForTony(previsioni) {
  if (!Array.isArray(previsioni) || !previsioni.length) return [];
  return previsioni.map((p) => {
    if (!p || !p.dt) return p;
    const d = new Date(String(p.dt).slice(0, 10) + "T12:00:00");
    if (Number.isNaN(d.getTime())) return p;
    return Object.assign({}, p, {
      giornoSettimana: GIORNI_SETTIMANA_IT[d.getDay()],
      giornoMese: d.getDate(),
      mese: d.getMonth() + 1,
    });
  });
}

function formatGiornoItaliano(entry) {
  if (!entry || entry.giornoMese == null || entry.mese == null) return entry && entry.dt ? entry.dt : "quel giorno";
  const nomeGiorno = entry.giornoSettimana ? capitalizeIt(entry.giornoSettimana) : "";
  const meseLabel = MESI_IT[entry.mese - 1] || "";
  return `${nomeGiorno} ${entry.giornoMese} ${meseLabel}`.trim();
}

function formatProbabilitaPioggia(pop) {
  return `probabilità del ${pop}%`;
}

function formatPioggiaMm(rainMm) {
  const v = Math.round(Number(rainMm) * 10) / 10;
  return v === 1 ? "circa 1 mm previsto in giornata" : `circa ${v} mm previsti in giornata`;
}

function isTonyMeteoMmFocusedQuestion(message) {
  const m = normalizeMeteoMsg(message);
  if (/\b(mm|millimetri)\b/.test(m)) return true;
  return /\b(quanto|quanti)\b/.test(m) && /\b(pioggia|piover|precipitaz)\b/.test(m);
}

function describePioggiaGiorno(entry, opts = {}) {
  const mmOnly = !!opts.mmOnly;
  const rainMm = entry && entry.rainMm != null ? Number(entry.rainMm) : null;
  const hasMm = rainMm != null && Number.isFinite(rainMm) && rainMm > 0;
  const mmTxt = hasMm ? formatPioggiaMm(rainMm) : null;
  const pop = entry && entry.pop != null ? Number(entry.pop) : null;

  if (mmOnly) {
    if (mmTxt) return mmTxt.charAt(0).toUpperCase() + mmTxt.slice(1);
    if (pop != null && Number.isFinite(pop)) {
      return `non ho i millimetri precisi per quel giorno; ${formatProbabilitaPioggia(pop)} in giornata`;
    }
    return "non ho dati sui millimetri di pioggia previsti per quel giorno";
  }

  if (pop == null || !Number.isFinite(pop)) {
    if (mmTxt) return `è prevista pioggia (${mmTxt})`;
    return "non ho la probabilità di pioggia per quel giorno";
  }
  const probTxt = formatProbabilitaPioggia(pop);
  let base;
  if (pop >= 50) base = `è prevista pioggia (${probTxt} in giornata)`;
  else if (pop >= 20) base = `possibile pioggia (${probTxt} in giornata)`;
  else base = `non è prevista pioggia significativa (${probTxt} in giornata)`;
  if (mmTxt) base += `, ${mmTxt}`;
  return base;
}

function isTonyMeteoRainFocusedQuestion(message) {
  const m = normalizeMeteoMsg(message);
  if (/\b(vento|venti|ventoso|raffica|temperatur|gradi|umidit|gelat)\b/.test(m)) {
    return false;
  }
  if (isTonyMeteoOperationalQuestion(message)) return false;
  if (/\b(piove|piovera|pioggia|precipitaz|rovesci|temporal|piover|mm|millimetri)\b/.test(m)) {
    return true;
  }
  if (/\b(quanto|quanti)\b/.test(m) && /\b(pioggia|piover|precipitaz)\b/.test(m)) return true;
  if (/\b(prossima|quando)\b/.test(m) && /\b(pioggia|piove|piovera)\b/.test(m)) return true;
  const query = parseMeteoDayQuery(message);
  if (!query) return false;
  if (query.type === "prossima_pioggia") return true;
  if (query.type === "day" || query.type === "oggi" || query.type === "domani") {
    return /\b(piover|pioggia|piove)\b/.test(m);
  }
  return false;
}

function describeVento(windKmh) {
  if (windKmh == null || !Number.isFinite(Number(windKmh))) {
    return "non ho dati sul vento per quel giorno";
  }
  const w = Number(windKmh);
  if (w >= 35) return `è previsto vento forte (${w} km/h)`;
  if (w >= 20) return `è previsto vento moderato (${w} km/h)`;
  if (w >= 10) return `vento leggero (${w} km/h)`;
  return `vento debole (${w} km/h)`;
}

function findTerrenoRowInMessage(meteoCtx, message, terreniNames) {
  const m = normalizeMeteoMsg(message);
  const rows = Array.isArray(meteoCtx.terreni) ? meteoCtx.terreni : [];
  for (const row of rows) {
    if (!row || !row.ok) continue;
    const n = normalizeMeteoMsg(row.nome || "");
    if (n.length >= 3 && m.includes(n)) return row;
    const tokens = n.split(/[\s\-–—]+/).filter((t) => t.length >= 3);
    for (const t of tokens) {
      if (m.includes(t)) return row;
    }
  }
  if (Array.isArray(terreniNames)) {
    for (const name of terreniNames) {
      const n = normalizeMeteoMsg(name);
      if (n.length < 3 || !m.includes(n)) {
        const tokens = n.split(/[\s\-–—]+/).filter((t) => t.length >= 3);
        if (!tokens.some((t) => m.includes(t))) continue;
      }
      const row = rows.find((r) => normalizeMeteoMsg(r.nome || "") === n);
      if (row && row.ok) return row;
    }
  }
  return null;
}

function resolveMinDtForDayQuery(source, histCtx) {
  if (!histCtx) return null;
  if (histCtx.afterQuery) {
    const dt = resolvePrevisioneDt(source, histCtx.afterQuery);
    if (dt) return dt;
  }
  if (histCtx.avoidQuery) {
    const dt = resolvePrevisioneDt(source, histCtx.avoidQuery);
    if (dt) return dt;
  }
  return null;
}

function getMeteoDaySnapshot(source, query, opts = {}) {
  const sede = source.sede || {};
  const row = source.terrenoRow;
  const previsioni = source.previsioni || [];
  let day = null;
  let when = null;

  if (query.type === "oggi") {
    day = (row && row.oggi) || sede.today || null;
    when = "Oggi";
    if (!day && previsioni[0]) {
      day = compactGiornoMeteo(previsioni[0]);
    }
    if (day && day.windSpeedKmh == null && sede.windSpeedKmh != null) {
      day = Object.assign({}, day, { windSpeedKmh: sede.windSpeedKmh });
    }
    if (day && previsioni[0]) {
      day = mergeGiornoMeteoExtras(day, { previsioneEntry: previsioni[0] }) || day;
    }
  } else if (query.type === "domani") {
    day = (row && row.domani) || sede.tomorrow || null;
    when = "Domani";
    if (!day && previsioni[1]) {
      day = compactGiornoMeteo(previsioni[1]);
    }
    if (day && previsioni[1]) {
      day = mergeGiornoMeteoExtras(day, { previsioneEntry: previsioni[1] }) || day;
    }
  } else {
    const entry = findPrevisioneEntry(previsioni, query, { minDt: opts.minDt || null });
    day = entry;
    when = entry ? formatGiornoItaliano(entry) : null;
  }

  if (day && day.windSpeedKmh == null && previsioni.length) {
    const idx = query.type === "oggi" ? 0 : query.type === "domani" ? 1 : -1;
    if (idx >= 0 && previsioni[idx] && previsioni[idx].windSpeedKmh != null) {
      day = Object.assign({}, day, { windSpeedKmh: previsioni[idx].windSpeedKmh });
    }
  }

  return { when, day };
}

function mentionsTerrenoInMessage(message, terreniNames) {
  const m = normalizeMeteoMsg(message);
  if (!Array.isArray(terreniNames)) return false;
  for (const name of terreniNames) {
    const n = normalizeMeteoMsg(name);
    if (n.length >= 3 && m.includes(n)) return true;
    const tokens = n.split(/[\s\-–—]+/).filter((t) => t.length >= 3);
    for (const t of tokens) {
      if (m.includes(t)) return true;
    }
  }
  return false;
}

function isTonyMeteoOperationalQuestion(message, ctx) {
  if (isTonyOperationalCreationIntent(message)) return false;
  try {
    const { isTonyPreventivoFormFieldCorrection } = require("./tony-quick-replies");
    if (isTonyPreventivoFormFieldCorrection(message, ctx)) return false;
  } catch (_) { /* ignore */ }
  const m = fixWeekdayTyposInMsg(normalizeMeteoMsg(message));
  if (isTonyMeteoConsigliaDataQuestion(message) || isTonyMeteoSchedulaGiornoQuestion(message)) return true;
  if (/\b(praticabil|passare con il trattore|passaggio del trattore|terreno bagnato|impraticabil)\b/.test(m)) {
    return true;
  }
  if (/\b(quindi|allora)\b/.test(m) && /\btratt/.test(m) && /\b(non\s+posso|non\s+conviene|giusto)\b/.test(m)) {
    return true;
  }
  if (/\b(trattare|trattamento)\b/.test(m) && /\b\d{1,2}\b/.test(m) && /\b(o|oppure|e)\b/.test(m)) {
    return true;
  }
  const hasDayOrWeather =
    /\b(oggi|domani|dopodomani|meteo|pioggia|vento|tempo)\b/.test(m) ||
    /\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(m) ||
    /\b\d{1,2}[\/.-]\d{1,2}/.test(m);
  if (
    hasDayOrWeather &&
    /\b(lavorare|trattare|concimare|potare|seminare|irrigare|trattamento|concimazione|lavoro|programmare|pianificare|erpic|erpicare|sfalci|sfalciare|raccolt|aratur|arare|fresat|fresare|rippat|scarific|lavorazion|trinciare|trinciatura)\b/.test(
      m
    )
  ) {
    return true;
  }
  if (
    /\b(posso|conviene|meglio|potremmo)\b/.test(m) &&
    /\b(tratt|lavor|concim|potar|semin|irrig|erpic|erpicare|sfalci|aratur|arare|fresat|fresare|trinciare|trinciatura)\b/.test(m)
  ) {
    return true;
  }
  return false;
}

function parseMeteoOperativoActivity(message) {
  const m = normalizeMeteoMsg(message);
  if (/\b(trattament|trattare|irror|fitofarm|fungicid|insetticid|pacciam)\b/.test(m)) {
    return "trattamento";
  }
  if (/\b(concim|fertilizz)\b/.test(m)) return "trattamento";
  if (
    /\b(lavorazion[ei]\s+(del\s+)?terreno|lavoro\s+in\s+campo|erpic|erpicare|aratur|arare|fresat|fresare|rippat|scarific|potatur|potare|semin|seminare|sfalci|sfalciare|diserb|trinciare|trinciatura|lavorare\s+il\s+terreno)\b/.test(
      m
    )
  ) {
    return "lavoroCampo";
  }
  if (/\b(lavorare|potare|seminare|irrigare|erpic|erpicare|sfalci|sfalciare|raccolt|trinciare|trinciatura)\b/.test(m)) {
    return "lavoroCampo";
  }
  if (isTonyMeteoSchedulaGiornoQuestion(message) && !/\b(lavor|erpic|potar|semin|irrig|raccolt|aratur|lavorazion)\b/.test(m)) {
    return "trattamento";
  }
  if (isTonyMeteoConsigliaDataQuestion(message) && !/\b(lavor|erpic|potar|semin|irrig|raccolt|aratur|lavorazion)\b/.test(m)) {
    return "trattamento";
  }
  return "lavoroCampo";
}

function resolveActivityKindFromThread(message, history) {
  let kind = parseMeteoOperativoActivity(message);
  if (kind === "trattamento" && isTonyMeteoConsigliaDataQuestion(message)) {
    const prior = findOperationalUserMessage(history);
    if (prior) {
      const priorKind = parseMeteoOperativoActivity(prior);
      if (priorKind === "lavoroCampo") kind = "lavoroCampo";
    }
  }
  return kind;
}

function isTonyMeteoConsigliaDataQuestion(message) {
  const m = normalizeMeteoMsg(message);
  if (/\b(consigli|consigliami|suggerisci|indicami|proponi)\b/.test(m) && /\b(data|giorno|alternativ|posticip|quando)\b/.test(m)) {
    return true;
  }
  if (/\b(altra\s+data|data\s+alternativ|giorno\s+migliore|quale\s+giorno|che\s+giorno)\b/.test(m)) {
    return true;
  }
  if (/\b(trova|cercami|cerca|dammi|indicami)\b/.test(m) && /\b(alternativ|altra|data|giorno)\b/.test(m)) {
    return true;
  }
  if (/\b(dovrei|devo)\b/.test(m) && /\btratt/.test(m) && /\b(che giorno|quando|consigli)\b/.test(m)) return true;
  if (/\b(prima|prossim[ao])\b/.test(m) && /\b(data|giorno)\b/.test(m) && /\b(utile|adatt|buon|conveniente|miglior)\b/.test(m)) {
    return true;
  }
  if (
    /\b(dopo|successiv|seguent|oltre)\b/.test(m) &&
    /\b(\d{1,2}|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(m) &&
    /\b(data|giorno|tratt|utile|alternativ)\b/.test(m)
  ) {
    return true;
  }
  if (/\bquindi\b/.test(m) && /\b(che\s+giorno|quando|data|consigli)\b/.test(m)) return true;
  return false;
}

/** Follow-up «sì» / «cerca un'altra data» dopo proposta Tony di cercare alternativa. */
function isTonyMeteoConsigliaDataFollowUp(message, history) {
  const last = getLastAssistantText(history);
  if (
    !/vuoi che cerchi un.altra data|cerchi un.altra data adatt|un.altra data adatt|rimandiamo l.erpicatura|posticipare l.erpicatura|posticipare la lavorazione/i.test(
      last
    )
  ) {
    return false;
  }
  const m = normalizeMeteoMsg(message);
  if (isTonyMeteoConsigliaDataQuestion(message)) return true;
  if (m.length <= 60 && /\b(sì|si|ok|certo|vai|procedi)\b/.test(m) && !/\b(no|non)\b/.test(m)) return true;
  return false;
}

function isTonyMeteoSchedulaGiornoQuestion(message) {
  const m = normalizeMeteoMsg(message);
  if (!/\b(facciamo|andiamo|spostiamo|proviamo|facciamo|ok\s+per)\b/.test(m)) return false;
  return !!parseMeteoDayQuery(message);
}

/** Follow-up breve su un giorno nel filo operativo: «e sabato?», «e il 28?». */
function isTonyMeteoDayFollowUpQuestion(message) {
  if (!parseMeteoDayQuery(message)) return false;
  if (isTonyMeteoConsigliaDataQuestion(message) || isTonyMeteoSchedulaGiornoQuestion(message)) return false;
  const m = fixWeekdayTyposInMsg(normalizeMeteoMsg(message)).trim();
  if (isTonyMeteoOperationalQuestion(message)) return false;
  if (/^(e|ed|anche)\s+/.test(m)) return true;
  if (/^(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)(\s+\d{1,2})?\s*\??$/.test(m)) return true;
  if (/^il\s+\d{1,2}\s*\??$/.test(m)) return true;
  return false;
}

function operativoDayScore(ev) {
  if (!ev || ev.esito === "sconsigliato" || ev.esito === "chiedi_trattore" || ev.esito === "morfologia_mancante") {
    return 9999;
  }
  let score = ev.esito === "attenzione" ? 50 : 0;
  const meteo = ev.meteo || ev;
  const activityKind = ev.activityKind || meteo.activityKind || "trattamento";
  score += meteo.pop != null ? Number(meteo.pop) : 0;
  if (activityKind === "trattamento" && meteo.wind != null) score += Number(meteo.wind) * 2;
  score += meteo.rainMm != null ? Number(meteo.rainMm) * 10 : 0;
  if (ev.lookbackMm != null) score += Number(ev.lookbackMm) * 5;
  return score;
}

function resolvePrevisioneDt(source, query) {
  const previsioni = (source && source.previsioni) || [];
  if (!query) return null;
  if (query.type === "oggi") return previsioni[0] && previsioni[0].dt ? previsioni[0].dt : null;
  if (query.type === "domani") return previsioni[1] && previsioni[1].dt ? previsioni[1].dt : null;
  if (query.type === "dopodomani") return previsioni[2] && previsioni[2].dt ? previsioni[2].dt : null;
  const matchedEntry = findPrevisioneEntry(previsioni, query);
  return matchedEntry && matchedEntry.dt ? matchedEntry.dt : null;
}

function findBestGiornoOperativoOk(previsioni, activityKind, rules, opts = {}) {
  const skipDts = new Set(
    [].concat(opts.skipDts || [], opts.skipDt ? [opts.skipDt] : []).filter(Boolean)
  );
  const afterDt = opts.afterDt || null;
  const tipoCampo = opts.tipoCampo || null;
  const mergedRules = mergeTonyMeteoRules(rules);
  const list = enrichPrevisioniGiornaliereForTony(previsioni || []);
  const todayStr = new Date().toISOString().slice(0, 10);

  function scan(onlyAfter, acceptFn) {
    let best = null;
    let bestScore = Infinity;
    for (const p of list) {
      if (!p.dt || p.dt < todayStr) continue;
      if (skipDts.has(p.dt)) continue;
      if (onlyAfter && afterDt && p.dt <= afterDt) continue;
      const ev = tipoCampo
        ? evaluateGiornoOperativoCompleto(p, list, p.dt, tipoCampo, activityKind, mergedRules)
        : evaluateMeteoOperativoGiorno(p, activityKind, mergedRules);
      if (!acceptFn(ev)) continue;
      const score = operativoDayScore(ev);
      if (score < bestScore) {
        bestScore = score;
        best = { day: p, evaluation: ev };
      }
    }
    return best;
  }

  const onlyAfter = !!afterDt;
  let best = scan(onlyAfter, (ev) => isGiornoOperativoIdeale(ev));
  if (!best) {
    best = scan(onlyAfter, (ev) => isGiornoOperativoRiserva(ev, activityKind, mergedRules));
  }
  return best;
}

function evaluateDayForOperativoScan(p, list, tipoCampo, activityKind, rules) {
  return tipoCampo
    ? evaluateGiornoOperativoCompleto(p, list, p.dt, tipoCampo, activityKind, rules)
    : evaluateMeteoOperativoGiorno(p, activityKind, rules);
}

/** Prima data utile subito prima o subito dopo pivotDt (più vicina al giorno scartato). */
function findFirstGiornoOperativoOkNear(previsioni, pivotDt, direction, activityKind, rules, opts = {}) {
  if (!pivotDt || (direction !== "before" && direction !== "after")) return null;
  const mergedRules = mergeTonyMeteoRules(rules);
  const list = enrichPrevisioniGiornaliereForTony(previsioni || []);
  const todayStr = new Date().toISOString().slice(0, 10);
  const tipoCampo = opts.tipoCampo || null;
  const skipDts = new Set([].concat(opts.skipDts || []).filter(Boolean));
  if (pivotDt) skipDts.add(pivotDt);

  let candidates = list.filter((p) => p.dt && p.dt >= todayStr && !skipDts.has(p.dt));
  if (direction === "before") {
    candidates = candidates.filter((p) => p.dt < pivotDt).sort((a, b) => b.dt.localeCompare(a.dt));
  } else {
    candidates = candidates.filter((p) => p.dt > pivotDt).sort((a, b) => a.dt.localeCompare(b.dt));
  }

  function pick(acceptFn) {
    for (const p of candidates) {
      const ev = evaluateDayForOperativoScan(p, list, tipoCampo, activityKind, mergedRules);
      if (acceptFn(ev)) return { day: p, evaluation: ev };
    }
    return null;
  }

  return (
    pick((ev) => isGiornoOperativoIdeale(ev)) ||
    pick((ev) => isGiornoOperativoRiserva(ev, activityKind, mergedRules))
  );
}

function findDualAlternativeDays(previsioni, pivotDt, activityKind, rules, opts = {}) {
  if (!pivotDt) return { before: null, after: null };
  const skipList = [].concat(opts.skipDts || [], pivotDt).filter(Boolean);
  const base = { tipoCampo: opts.tipoCampo, skipDts: skipList };
  return {
    before: findFirstGiornoOperativoOkNear(previsioni, pivotDt, "before", activityKind, rules, base),
    after: findFirstGiornoOperativoOkNear(previsioni, pivotDt, "after", activityKind, rules, base),
  };
}

function resolvePivotDtFromContext(source, histCtx, message, history) {
  const previsioni = (source && source.previsioni) || [];
  const minDt = resolveMinDtForDayQuery(source, histCtx);
  if (histCtx && histCtx.avoidQuery) {
    const entry = findPrevisioneEntry(previsioni, histCtx.avoidQuery, { minDt });
    if (entry && entry.dt) return entry.dt;
  }
  const q = parseMeteoDayQuery(message);
  if (q && q.type !== "prossima_pioggia") {
    const entry = findPrevisioneEntry(previsioni, q, { minDt });
    if (entry && entry.dt) return entry.dt;
  }
  if (Array.isArray(history)) {
    for (let i = history.length - 1; i >= 0; i--) {
      const role = String(history[i].role || history[i].author || "").toLowerCase();
      if (role !== "assistant" && role !== "model" && role !== "tony") continue;
      const text = extractHistoryText(history[i]);
      const hq = parseMeteoDayQuery(text);
      if (hq && hq.type !== "prossima_pioggia") {
        const entry = findPrevisioneEntry(previsioni, hq, { minDt });
        if (entry && entry.dt) return entry.dt;
      }
    }
  }
  return null;
}

function formatDualAlternativaLines(dual, activityKind) {
  const parts = [];
  if (dual.before) {
    const lbl = formatGiornoItaliano(dual.before.day);
    const cond = dual.before.evaluation.motivi.join(", ");
    parts.push(
      `${lbl} (prima della pioggia, tempo ancora favorevole): ${cond}`
    );
  }
  if (dual.after) {
    const lbl = formatGiornoItaliano(dual.after.day);
    const cond = dual.after.evaluation.motivi.join(", ");
    const dopoHint =
      activityKind === "lavoroCampo"
        ? "dopo la pioggia, con tempo di asciugatura del terreno"
        : "dopo la pioggia, con condizioni migliori";
    parts.push(`${lbl} (${dopoHint}): ${cond}`);
  }
  return parts;
}

function buildDualAlternativaOperativaReply(source, pivotDt, activityKind, where, opts = {}) {
  const previsioni = source.previsioni || [];
  const tipoCampo = opts.tipoCampo || source.tipoCampo || null;
  const terrenoNome = source.terrenoNome || null;
  const act = actOperativoPhrase(activityKind);

  if (!tipoCampo && (terrenoNome || activityKind === "lavoroCampo")) {
    const whereHint = terrenoNome ? ` su ${terrenoNome}` : "";
    return (
      `Per proporti date alternative${whereHint} mi serve la morfologia del terreno: ` +
      "è in pianura, collina o montagna? Rispondi con una delle tre opzioni" +
      (terrenoNome ? " e la salvo sull'anagrafica terreno." : ".")
    );
  }

  const avoidEntry = previsioni.find((p) => p && p.dt === pivotDt);
  const avoidLabel = avoidEntry ? formatGiornoItaliano(avoidEntry) : "quel giorno";
  const excluded = collectExcludedDtsFromHistory(opts.history, source, opts.avoidQueryFromHistory);
  excluded.add(pivotDt);
  const dual = findDualAlternativeDays(previsioni, pivotDt, activityKind, DEFAULT_TONY_METEO_RULES, {
    tipoCampo,
    skipDts: [...excluded],
  });
  const lines = formatDualAlternativaLines(dual, activityKind);

  if (!lines.length) {
    return (
      `Ok, ${avoidLabel}${where} non è adatto per ${act}. ` +
      "Nei prossimi ~8 giorni non trovo date utili né prima né dopo: ricontrolla tra qualche giorno."
    );
  }

  const intro =
    lines.length === 2
      ? `Ok, ${avoidLabel}${where} non conviene per ${act}. Ti propongo due alternative: `
      : `Ok, ${avoidLabel}${where} non conviene per ${act}. Ti propongo questa alternativa: `;
  return `${intro}${lines.join("; ")}. Quale preferisci?`;
}

function findNextGiornoOperativoOk(previsioni, activityKind, rules, afterDt, opts = {}) {
  const best = findFirstGiornoOperativoOkNear(previsioni, afterDt, "after", activityKind, rules, {
    tipoCampo: opts.tipoCampo,
    skipDts: afterDt ? [afterDt] : [],
  });
  return best ? best.day : null;
}

function buildConsigliaDataOperativaReply(source, activityKind, message, where, opts = {}) {
  const previsioni = source.previsioni || [];
  const act = actOperativoPhrase(activityKind);
  const actAl = actOperativoAl(activityKind);
  const ventoMax =
    activityKind === "trattamento" ? DEFAULT_TONY_METEO_RULES.trattamento.ventoMaxKmh : null;
  const tipoCampo = opts.tipoCampo || source.tipoCampo || null;
  const terrenoNome = source.terrenoNome || null;
  const afterQuery = parseMeteoAfterDayQuery(message);
  const avoidQuery =
    parseMeteoDayQuery(message) ||
    opts.avoidQueryFromHistory ||
    null;
  const skipDt =
    avoidQuery && avoidQuery.type !== "prossima_pioggia" && !afterQuery
      ? resolvePrevisioneDt(source, avoidQuery)
      : null;
  const afterDt = afterQuery ? resolvePrevisioneDt(source, afterQuery) : null;
  const skipDts = collectExcludedDtsFromHistory(opts.history, source, avoidQuery);
  if (skipDt) skipDts.add(skipDt);
  if (opts.trattorePraticabile === false && avoidQuery) {
    const dt = resolvePrevisioneDt(source, avoidQuery);
    if (dt) skipDts.add(dt);
  }

  if (!tipoCampo && (terrenoNome || activityKind === "lavoroCampo")) {
    const whereHint = terrenoNome ? ` su ${terrenoNome}` : "";
    return (
      `Per consigliarti una data operativa${whereHint} mi serve la morfologia del terreno: ` +
      "è in pianura, collina o montagna? Rispondi con una delle tre opzioni" +
      (terrenoNome ? " e la salvo sull'anagrafica terreno." : ".")
    );
  }

  const findOpts = {
    skipDts: [...skipDts],
    afterDt,
    tipoCampo,
    trattorePraticabile: opts.trattorePraticabile,
  };
  let best = findBestGiornoOperativoOk(previsioni, activityKind, DEFAULT_TONY_METEO_RULES, findOpts);

  const praticExtra =
    tipoCampo && tipoCampo !== "pianura" ? " e praticabilità terreno per la morfologia" : "";

  if (!best) {
    const afterHint = afterDt
      ? ` dopo il ${formatGiornoItaliano((previsioni || []).find((p) => p && p.dt === afterDt) || { dt: afterDt })}`
      : "";
    const criteri =
      activityKind === "trattamento"
        ? `(pioggia sotto soglia, vento entro ${ventoMax} km/h${praticExtra})`
        : `(pioggia sotto soglia${praticExtra}; per la lavorazione il vento non è un criterio)`;
    return (
      `Nei prossimi ~8 giorni${where} non trovo un giorno adatto ${actAl}${afterHint} ${criteri}. ` +
      "Valuta oltre l'orizzonte delle previsioni o ricontrolla tra qualche giorno."
    );
  }

  const dayLabel = formatGiornoItaliano(best.day);
  const ev = best.evaluation;
  const cond = ev.motivi.join(", ");
  let intro = "";
  if (afterDt) {
    const afterEntry = (previsioni || []).find((p) => p && p.dt === afterDt);
    const afterLabel = afterEntry ? formatGiornoItaliano(afterEntry) : `il giorno ${afterDt}`;
    intro = `Per la prima data utile dopo ${afterLabel}, `;
  } else if (skipDt) {
    const avoidEntry = (previsioni || []).find((p) => p && p.dt === skipDt);
    const avoidLabel = avoidEntry ? formatGiornoItaliano(avoidEntry) : "la data che avevi in mente";
    intro = `Visto che ${avoidLabel} non è adatto, `;
  } else if (skipDts.size > 0) {
    intro = "Escludendo le date che hai indicato come non utilizzabili, ";
  }

  const prioritaIdeale =
    activityKind === "trattamento"
      ? `(Priorità: niente pioggia significativa, vento entro ${ventoMax} km/h${praticExtra ? ", terreno praticabile" : ""}.)`
      : `(Priorità: niente pioggia significativa${praticExtra ? ", terreno praticabile (mm recenti per morfologia)" : ""}; il vento non conta per la lavorazione.)`;

  if (isGiornoOperativoIdeale(ev)) {
    return `${intro}ti consiglio ${dayLabel}${where} per ${act}: ${cond}. ${prioritaIdeale}`;
  }

  if (ev.esito === "attenzione") {
    const riservaHint =
      activityKind === "trattamento"
        ? `Preferire un giorno senza pioggia e vento sotto ${ventoMax} km/h${praticExtra};`
        : `Preferire un giorno asciutto${praticExtra};`;
    return (
      `${intro}nei prossimi ~8 giorni${where} non c'è un giorno perfetto per ${act}. ` +
      `La data meno rischiosa resta ${dayLabel}: ${cond}. ${riservaHint} valuta la mattina stessa.`
    );
  }

  const criteriFail =
    activityKind === "trattamento"
      ? `(pioggia sotto soglia, vento entro ${ventoMax} km/h${praticExtra})`
      : `(pioggia sotto soglia${praticExtra})`;
  return (
    `${intro}nei prossimi ~8 giorni${where} non c'è un giorno adatto ${actAl} ${criteriFail}. ` +
    "Meglio attendere giornate più asciutte o estendere l'orizzonte delle previsioni."
  );
}

function buildMeteoOperativoQuickReplyText({
  when,
  where,
  activityKind,
  evaluation,
  alternativeDay,
  formatAltDay,
  tipoCampo,
  previsioni,
  pivotDt,
}) {
  const act = actOperativoPhrase(activityKind);
  const actAl = actOperativoAl(activityKind);
  const loc = where || "";
  const cond = evaluation.motivi.join(", ");

  if (evaluation.esito === "morfologia_mancante") {
    const nome = evaluation.terrenoNome || "quel terreno";
    return (
      `Per valutare meteo e praticabilità su ${nome}${loc} mi serve la morfologia del terreno: ` +
      "è in pianura, collina o montagna? Rispondi con una delle tre opzioni e la salvo sull'anagrafica terreno."
    );
  }

  if (evaluation.esito === "chiedi_trattore") {
    const morf = tipoCampo ? labelMorfologia(tipoCampo) : "";
    const mm =
      evaluation.lookbackMm != null ? `circa ${evaluation.lookbackMm} mm previsti nella finestra pioggia recente` : "";
    const domanda =
      activityKind === "lavoroCampo"
        ? "Riesci a lavorare il terreno quel giorno (macchina o attrezzi)? Rispondi sì o no."
        : "Riesci a passare con il trattore quel giorno? Rispondi sì o no.";
    return (
      `${when}${loc} ${act} potrebbe essere possibile dal meteo, ma ${morf}${mm ? ` (${mm})` : ""}: ${domanda}`
    );
  }

  if (evaluation.esito === "sconsigliato") {
    let text =
      `Sconsiglio di programmare ${act} ${when}${loc}: ${cond}. ` +
      "Meglio anticipare prima della pioggia o posticipare a giorni più asciutti";
    if (activityKind === "trattamento") {
      text += ", con vento contenuto (idealmente sotto 15 km/h)";
    }
    text += ".";
    if (pivotDt && previsioni) {
      const dual = findDualAlternativeDays(
        previsioni,
        pivotDt,
        activityKind,
        DEFAULT_TONY_METEO_RULES,
        { tipoCampo: tipoCampo || undefined }
      );
      const lines = formatDualAlternativaLines(dual, activityKind);
      if (lines.length) {
        text +=
          lines.length === 2
            ? ` Ti propongo due alternative: ${lines.join("; ")}. Quale preferisci?`
            : ` Ti propongo questa alternativa: ${lines[0]}.`;
      }
    } else if (alternativeDay && formatAltDay) {
      const altEv = tipoCampo
        ? evaluateGiornoOperativoCompleto(
            alternativeDay,
            previsioni || [],
            alternativeDay.dt,
            tipoCampo,
            activityKind,
            DEFAULT_TONY_METEO_RULES
          )
        : evaluateMeteoOperativoGiorno(alternativeDay, activityKind, DEFAULT_TONY_METEO_RULES);
      if (isGiornoOperativoAccettabile(altEv)) {
        text += ` Come alternativa, ${formatAltDay(alternativeDay)} sembra più adatto (${altEv.motivi.join(", ")}).`;
      }
    }
    return text;
  }
  if (evaluation.esito === "attenzione") {
    return (
      `Per ${when}${loc} ${act} è possibile ma con riserva: ${cond}. ` +
      "Valuta se posticipare o controllare il meteo la mattina stessa."
    );
  }
  return `Sì, ${when}${loc} sembra adatto per ${act}: ${cond}.`;
}

function getPreventivoFormFieldValue(ctx, fieldId) {
  const form = ctx && ctx.form;
  if (!form || !fieldId) return "";
  const key = String(fieldId);
  if (form.fields && typeof form.fields === "object" && !Array.isArray(form.fields)) {
    return String(form.fields[key] || "").trim();
  }
  if (Array.isArray(form.fields)) {
    const hit = form.fields.find((f) => String(f.id || f.name || "") === key);
    if (hit && hit.value != null && String(hit.value).trim() !== "") return String(hit.value).trim();
  }
  const summary = String(form.formSummary || "");
  if (summary) {
    const re = new RegExp(`[-–]\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^:]*:\\s*([^\\n✓]+)`, "i");
    const m = summary.match(re);
    if (m && m[1] && !/\\(vuoto\\)/i.test(m[1])) return m[1].replace(/✓.*/, "").trim();
  }
  return "";
}

function userMessageIsPreventivoDateOnly(message) {
  const m = fixWeekdayTyposInMsg(normalizeMeteoMsg(message)).trim();
  if (!m || m.length > 80) return false;
  if (/\b(salva|bozza|conferm|ok\s+salva|cliente|preventivo|trinciatur|sottocategor|tra\s+le\s+file)\b/.test(m)) {
    return false;
  }
  const hasDate =
    /\b(oggi|domani|dopodomani)\b/.test(m) ||
    /\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(m) ||
    /\b(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b/.test(m) ||
    /\b\d{1,2}[\/.-]\d{1,2}([\/.-]\d{2,4})?\b/.test(m) ||
    /\b\d{4}-\d{2}-\d{2}\b/.test(m) ||
    (/\b\d{1,2}\b/.test(m) && m.split(/\s+/).length <= 3);
  if (!hasDate) return false;
  if (/^(il\s+)?(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)(\s+\d{1,2})?\s*[?.!]?$/.test(m)) {
    return true;
  }
  if (/^(il\s+)?\d{1,2}([/.-]\d{1,2})?(\s+\d{4})?\s*[?.!]?$/.test(m)) return true;
  if (/\b(data|prevista|giorno)\b/.test(m) && hasDate) return true;
  if (/\b(posso|conviene|si\s+poss|possiamo)\b/.test(m) && !/\b(facciamo|imposta|procediamo)\b/.test(m)) {
    return false;
  }
  if (/\b(ok|si|sì|va bene|perfetto|procediamo|imposta|facciamo)\b/.test(m) && hasDate) {
    return m.split(/\s+/).filter(Boolean).length <= 8;
  }
  return hasDate && m.split(/\s+/).filter(Boolean).length <= 4;
}

function isTonyPreventivoDateMeteoEval(message, ctx) {
  if (!message || !ctx || !ctx.form) return false;
  const fid = String(ctx.form.formId || ctx.form.modalId || "");
  if (fid !== "preventivo-form") return false;
  if (isTonyPreventivoFormFieldCorrection(message, ctx)) return false;
  if (!userMessageIsPreventivoDateOnly(message)) return false;
  const tipoLavoro = getPreventivoFormFieldValue(ctx, "tipo-lavoro");
  return !!tipoLavoro;
}

function buildPreventivoMeteoEvalVerb(tipoLavoro) {
  const m = normalizeMeteoMsg(tipoLavoro);
  if (/trinciatur|trinciare/.test(m)) return "trinciare";
  if (/erpicatur|erpicare/.test(m)) return "erpicare";
  if (/aratur|arare/.test(m)) return "arare";
  if (/fresatur|fresare/.test(m)) return "fresare";
  if (/potatur|potare/.test(m)) return "potare";
  if (/semin|seminare/.test(m)) return "seminare";
  if (/diserb|diserbare/.test(m)) return "diserbare";
  if (/sfalci|sfalciare/.test(m)) return "sfalciare";
  if (/trattament|trattare|irror|fitofarm|concim|fertilizz/.test(m)) return "trattare";
  return null;
}

function buildPreventivoDateMeteoEval(message, ctx) {
  if (!isTonyPreventivoDateMeteoEval(message, ctx)) return null;
  const tipoLavoro = getPreventivoFormFieldValue(ctx, "tipo-lavoro");
  const verb = buildPreventivoMeteoEvalVerb(tipoLavoro);
  const dayPhrase = String(message).trim().replace(/[?.!]+$/, "");
  const evalMessage = verb
    ? `posso ${verb} ${dayPhrase}?`
    : `conviene ${normalizeMeteoMsg(tipoLavoro)} ${normalizeMeteoMsg(dayPhrase)}?`;
  const tipoCampoRaw = getPreventivoFormFieldValue(ctx, "tipo-campo");
  return {
    evalMessage,
    terrenoId: getPreventivoFormFieldValue(ctx, "terreno-id"),
    tipoCampo: tipoCampoRaw ? normalizeTipoCampo(tipoCampoRaw) : null,
  };
}

function shouldBlockPreventivoDateOnMeteoReply(replyText) {
  if (!replyText || typeof replyText !== "string") return false;
  return (
    /^Sconsiglio/i.test(replyText) ||
    /^Per .* è possibile ma con riserva/i.test(replyText) ||
    /^Ok, .* non conviene/i.test(replyText)
  );
}

/**
 * Valuta meteo quando l'utente indica solo la data prevista nel form preventivo (es. «mercoledì»).
 * Usa tipo-lavoro e terreno già nel form; blocca l'iniezione data se il giorno è sconsigliato.
 */
async function tryMeteoPreventivoDateQuickReply(message, meteoCtx, opts = {}) {
  if (!meteoCtx || !meteoCtx.disponibile || !meteoCtx.moduloMeteoAttivo) return null;
  const built = buildPreventivoDateMeteoEval(message, opts.tonyContext);
  if (!built) return null;

  if (!built.tipoCampo && built.terrenoId && Array.isArray(meteoCtx.terreni)) {
    const trRow = meteoCtx.terreni.find(
      (t) => String(t.terrenoId || t.id || "") === String(built.terrenoId)
    );
    if (trRow && trRow.tipoCampo) {
      built.tipoCampo = normalizeTipoCampo(trRow.tipoCampo);
    }
  }

  const evalOpts = {
    ...opts,
    _preventivoDateEval: true,
    selectedTerrenoId: built.terrenoId || opts.selectedTerrenoId || null,
    tipoCampoOverride: built.tipoCampo || opts.tipoCampoOverride || null,
  };
  const reply = await tryMeteoOperativoQuickReply(built.evalMessage, meteoCtx, evalOpts);
  if (!reply || !shouldBlockPreventivoDateOnMeteoReply(reply)) return null;
  return reply;
}

/**
 * Risposta deterministica per domande operative: "posso trattare mercoledì?", "conviene lavorare domani?".
 * Asse B (praticabilità morfologia) quando il terreno è noto; intervista morfologia/trattore senza Gemini.
 */
async function tryMeteoOperativoQuickReply(message, meteoCtx, opts = {}) {
  if (!meteoCtx || !meteoCtx.disponibile || !meteoCtx.moduloMeteoAttivo) return null;
  if (isTonyOperationalCreationIntent(message)) return null;

  const history = opts.history || [];
  const terrenoCtx = resolveTerrenoOperativo(meteoCtx, message, opts);
  let tipoCampo = opts.tipoCampoOverride || terrenoCtx.tipoCampo;
  const terrenoNome = terrenoCtx.terrenoNome;
  const terrenoId = terrenoCtx.terrenoId;
  const needsTerrenoForPraticabilita = !!(terrenoNome || terrenoId);

  const morphAnswer =
    !opts._fromTrattoreFollowUp && message.length <= 60 ? parseTipoCampoFromMessage(message) : null;
  if (morphAnswer && (isMorfologiaMeteoFollowUp(history) || !isTonyMeteoOperationalQuestion(message))) {
    if (terrenoId && opts.db && opts.tenantId) {
      await persistTipoCampoTerreno(opts.db, opts.tenantId, terrenoId, morphAnswer);
      if (terrenoCtx.terrenoRow) terrenoCtx.terrenoRow.tipoCampo = morphAnswer;
    }
    tipoCampo = morphAnswer;
    const prior = findOperationalUserMessage(history);
    if (prior) {
      return await tryMeteoOperativoQuickReply(prior, meteoCtx, {
        ...opts,
        history,
        tipoCampoOverride: morphAnswer,
        terreniCatalog: (opts.terreniCatalog || []).map((t) =>
          t.id === terrenoId ? { ...t, tipoCampo: morphAnswer } : t
        ),
      });
    }
    const savedOn = terrenoNome ? ` per ${terrenoNome}` : "";
    return (
      `Ho registrato la morfologia «${morphAnswer}»${savedOn}. ` +
      "Puoi ripetere la domanda (es. «posso erpicare venerdì?» o «posso trattare venerdì?»)."
    );
  }

  const histCtx = findOperationalContextInHistory(history);
  const consigliaDataFollowUp = isTonyMeteoConsigliaDataFollowUp(message, history);
  const trattoreAnswer = parseTrattorePraticabileAnswer(message);
  const threadActive = isMeteoOperativeThreadActive(history);

  if (
    !opts._fromTrattoreFollowUp &&
    trattoreAnswer !== null &&
    !consigliaDataFollowUp &&
    (isTrattorePraticabileFollowUp(history) || threadActive)
  ) {
    const evalMessage = buildEvalContextFromHistory(history, message);
    if (!isTonyMeteoOperationalQuestion(evalMessage) && !isTonyMeteoSchedulaGiornoQuestion(evalMessage)) {
      return null;
    }
    if (trattoreAnswer === false) {
      const activityKind = resolveActivityKindFromThread(evalMessage, history);
      const source = pickMeteoPrevisioniSource(meteoCtx, evalMessage, opts);
      if (terrenoCtx.terrenoRow) {
        const row = terrenoCtx.terrenoRow;
        source.label = row.nome;
        source.previsioni = row.previsioniGiornaliere || [];
        source.terrenoRow = row;
        source.terrenoNome = terrenoCtx.terrenoNome || row.nome;
        source.tipoCampo = opts.tipoCampoOverride || terrenoCtx.tipoCampo || row.tipoCampo || null;
      } else {
        source.tipoCampo = opts.tipoCampoOverride || tipoCampo || source.tipoCampo;
        source.terrenoNome = terrenoNome || source.terrenoNome;
      }
      const where = formatMeteoLocationSuffix(source);
      const pivotDt = resolvePivotDtFromContext(source, histCtx, evalMessage, history);
      if (pivotDt) {
        return buildDualAlternativaOperativaReply(source, pivotDt, activityKind, where, {
          tipoCampo: opts.tipoCampoOverride || tipoCampo || source.tipoCampo,
          terrenoNome: source.terrenoNome,
          history,
          avoidQueryFromHistory: histCtx.avoidQuery,
        });
      }
    }
    return await tryMeteoOperativoQuickReply(evalMessage, meteoCtx, {
      ...opts,
      trattorePraticabile: trattoreAnswer,
      history,
      _fromTrattoreFollowUp: true,
    });
  }

  const consigliaData = isTonyMeteoConsigliaDataQuestion(message) || consigliaDataFollowUp;
  const schedulaGiorno = isTonyMeteoSchedulaGiornoQuestion(message);
  const dayFollowUp = isTonyMeteoDayFollowUpQuestion(message) && threadActive;
  if (!isTonyMeteoOperationalQuestion(message) && !consigliaData && !schedulaGiorno && !dayFollowUp) {
    return null;
  }

  let activityKind = resolveActivityKindFromThread(message, history);
  if (dayFollowUp) {
    const prior = findOperationalUserMessage(history);
    if (prior) activityKind = parseMeteoOperativoActivity(prior);
  }
  const source = pickMeteoPrevisioniSource(meteoCtx, message, opts);
  if (terrenoCtx.terrenoRow && (!source.terrenoRow || source.terrenoRow.terrenoId !== terrenoCtx.terrenoId)) {
    const row = terrenoCtx.terrenoRow;
    source.label = row.nome;
    source.previsioni = row.previsioniGiornaliere || [];
    source.terrenoRow = row;
    source.terrenoNome = terrenoCtx.terrenoNome || row.nome;
    source.tipoCampo = terrenoCtx.tipoCampo || row.tipoCampo || null;
  } else {
    source.tipoCampo = tipoCampo || source.tipoCampo;
    source.terrenoNome = terrenoNome || source.terrenoNome;
  }
  const where = formatMeteoLocationSuffix(source);
  const trattorePraticabile = resolveTrattorePraticabileForEval(opts, histCtx, message);

  const multiNums = parseMeteoMultiDayNumbers(message);
  if (multiNums.length >= 2) {
    const multiReply = buildMeteoOperativoMultiDayReply(message, source, activityKind, {
      tipoCampo: tipoCampo || source.tipoCampo,
      histCtx,
      trattorePraticabile,
    });
    if (multiReply) return multiReply;
  }

  if (consigliaData) {
    const consigliaOpts = {
      tipoCampo,
      terrenoNome,
      avoidQueryFromHistory: histCtx.avoidQuery,
      history,
      trattorePraticabile:
        opts.trattorePraticabile !== undefined ? opts.trattorePraticabile : histCtx.trattorePraticabile,
    };
    if ((needsTerrenoForPraticabilita || activityKind === "lavoroCampo") && !tipoCampo) {
      return buildConsigliaDataOperativaReply(source, activityKind, message, where, {
        tipoCampo: null,
        terrenoNome,
        avoidQueryFromHistory: histCtx.avoidQuery,
        history,
      });
    }
    if (!parseMeteoAfterDayQuery(message)) {
      const pivotDt = resolvePivotDtFromContext(source, histCtx, message, history);
      if (pivotDt) {
        return buildDualAlternativaOperativaReply(source, pivotDt, activityKind, where, consigliaOpts);
      }
    }
    return buildConsigliaDataOperativaReply(source, activityKind, message, where, consigliaOpts);
  }

  let query = parseMeteoDayQuery(message);
  if (!query || query.type === "prossima_pioggia") {
    if (histCtx.avoidQuery) query = histCtx.avoidQuery;
    else {
      const prior = findOperationalUserMessage(history);
      if (prior) query = parseMeteoDayQuery(prior);
    }
  }
  if (!query || query.type === "prossima_pioggia") return null;

  const minDt = resolveMinDtForDayQuery(source, histCtx);
  const snap = getMeteoDaySnapshot(source, query, { minDt });
  if (!snap.day) return null;

  const targetDt =
    snap.day.dt ||
    resolvePrevisioneDt(source, query) ||
    (source.previsioni || []).find((p) => p && p.pop === snap.day.pop && p.windSpeedKmh === snap.day.windSpeedKmh)?.dt;

  const usePraticabilita = needsTerrenoForPraticabilita || activityKind === "lavoroCampo";

  let evaluation;
  if (usePraticabilita) {
    if (!tipoCampo) {
      evaluation = { esito: "morfologia_mancante", motivi: [], terrenoNome: terrenoNome || source.label };
    } else {
      evaluation = evaluateGiornoOperativoCompleto(
        snap.day,
        source.previsioni || [],
        targetDt,
        tipoCampo,
        activityKind,
        DEFAULT_TONY_METEO_RULES,
        { trattorePraticabile }
      );
    }
  } else {
    evaluation = evaluateMeteoOperativoGiorno(snap.day, activityKind, DEFAULT_TONY_METEO_RULES);
  }

  const afterDt = resolvePrevisioneDt(source, query);
  const alternativeDay =
    evaluation.esito === "sconsigliato"
      ? findNextGiornoOperativoOk(source.previsioni, activityKind, DEFAULT_TONY_METEO_RULES, afterDt, {
          tipoCampo: tipoCampo || undefined,
        })
      : null;

  return buildMeteoOperativoQuickReplyText({
    when: snap.when,
    where,
    activityKind,
    evaluation,
    alternativeDay,
    formatAltDay: formatGiornoItaliano,
    tipoCampo,
    previsioni: source.previsioni,
    pivotDt: targetDt,
  });
}

function isTonyMeteoDateOnlyQuestion(message, terreniNames) {
  if (!isTonyMeteoQuestion(message)) return false;
  const m = normalizeMeteoMsg(message);
  const hasDayRef =
    /\b(oggi|domani|dopodomani)\b/.test(m) ||
    /\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(m) ||
    /\b\d{1,2}\b/.test(m);
  const hasRainOrTime =
    /\b(piove|piovera|pioggia|tempo|meteo|nuvol|sole|vento|temperatur|mm|millimetri)\b/.test(m) ||
    (/\b(prossima|quando)\b/.test(m) && /\b(pioggia|piove|piovera)\b/.test(m));
  if (!hasDayRef || !hasRainOrTime) return false;
  if (isTonyMeteoOperationalQuestion(message)) return false;
  if (mentionsTerrenoInMessage(message, terreniNames || [])) return false;
  return true;
}

function fixWeekdayTyposInMsg(m) {
  return m
    .replace(/\bmercold[iì]?\b/g, "mercoledi")
    .replace(/\blund[iì]?\b/g, "lunedi")
    .replace(/\bmartedi?\b/g, "martedi")
    .replace(/\bgioved[iì]?\b/g, "giovedi")
    .replace(/\bvenerdi?\b/g, "venerdi")
    .replace(/\bsabat[o]?\b/g, "sabato")
    .replace(/\bdomenic[a]?\b/g, "domenica");
}

function parseMeteoAfterDayQuery(message) {
  const m = fixWeekdayTyposInMsg(normalizeMeteoMsg(message));
  if (!/\b(dopo|successiv|seguent|oltre|post)\b/.test(m)) return null;
  const numMatch = m.match(/\bdopo\s+(?:il\s+)?(\d{1,2})\b/);
  if (numMatch) return { type: "day", dayNum: parseInt(numMatch[1], 10), weekday: null };
  for (const g of GIORNI_SETTIMANA_IT) {
    if (new RegExp(`\\bdopo\\s+(?:il\\s+)?${g}\\b`).test(m)) return { type: "day", weekday: g, dayNum: null };
  }
  return null;
}

function isUserExcludingDayMessage(message) {
  const m = normalizeMeteoMsg(message);
  return /\b(non\s+posso|non\s+riesco|neanche|esclud|non\s+va|non\s+mi\s+va|impossibile|non\s+conviene|non\s+adatt)\b/.test(
    m
  );
}

function collectExcludedDtsFromHistory(history, source, avoidQueryHint) {
  const excluded = new Set();
  if (!Array.isArray(history) || !source) return excluded;
  for (const h of history) {
    const role = String(h.role || h.author || "").toLowerCase();
    if (role !== "user") continue;
    const text = extractHistoryText(h);
    if (!text || !isUserExcludingDayMessage(text)) continue;
    let q = parseMeteoDayQuery(text);
    if ((!q || q.type === "prossima_pioggia") && avoidQueryHint) {
      q = avoidQueryHint;
    }
    if (q && q.type !== "prossima_pioggia") {
      const dt = resolvePrevisioneDt(source, q);
      if (dt) excluded.add(dt);
    }
    const m = fixWeekdayTyposInMsg(normalizeMeteoMsg(text));
    for (const g of GIORNI_SETTIMANA_IT) {
      if (new RegExp(`\\b(?:neanche|non\\s+posso|esclud|non\\s+riesco).{0,40}\\b${g}\\b`).test(m)) {
        const dt = resolvePrevisioneDt(source, { type: "day", weekday: g, dayNum: null });
        if (dt) excluded.add(dt);
      }
      if (new RegExp(`\\b${g}\\b.{0,20}\\b(?:non\\s+posso|non\\s+riesco|neanche)\\b`).test(m)) {
        const dt = resolvePrevisioneDt(source, { type: "day", weekday: g, dayNum: null });
        if (dt) excluded.add(dt);
      }
    }
  }
  return excluded;
}

function parseMeteoDayQuery(message) {
  const m = fixWeekdayTyposInMsg(normalizeMeteoMsg(message));
  if (/\b(prossima|quando)\b/.test(m) && /\b(pioggia|piove|piovera)\b/.test(m)) {
    return { type: "prossima_pioggia" };
  }
  if (/\boggi\b/.test(m)) return { type: "oggi" };
  if (/\bdomani\b/.test(m)) return { type: "domani" };
  if (/\bdopodomani\b/.test(m)) return { type: "dopodomani" };

  let weekday = null;
  for (const g of GIORNI_SETTIMANA_IT) {
    if (new RegExp(`\\b${g}\\b`).test(m)) {
      weekday = g;
      break;
    }
  }

  let dayNum = null;
  if (weekday) {
    const after = m.match(new RegExp(`\\b${weekday}\\b\\s+(\\d{1,2})\\b`));
    const before = m.match(new RegExp(`\\b(\\d{1,2})\\b\\s+${weekday}\\b`));
    if (after) dayNum = parseInt(after[1], 10);
    else if (before) dayNum = parseInt(before[1], 10);
  }
  if (dayNum == null) {
    const alone = m.match(/\b(\d{1,2})\b/);
    if (alone) dayNum = parseInt(alone[1], 10);
  }

  if (weekday || dayNum != null) return { type: "day", weekday, dayNum };
  return null;
}

function findPrevisioneEntry(previsioni, query, opts = {}) {
  const list = enrichPrevisioniGiornaliereForTony(previsioni);
  if (!list.length || !query) return null;

  if (query.type === "prossima_pioggia") {
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const p of list) {
      if (!p.dt || p.dt < todayStr) continue;
      const pop = p.pop != null ? Number(p.pop) : 0;
      if (pop >= 20) return p;
    }
    return null;
  }

  if (query.type === "day") {
    let matches = list;
    if (query.weekday) {
      matches = matches.filter((p) => p.giornoSettimana === query.weekday);
    }
    if (query.dayNum != null) {
      matches = matches.filter((p) => p.giornoMese === query.dayNum);
    }
    if (query.weekday && query.dayNum == null) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const minDt = opts.minDt && opts.minDt > todayStr ? opts.minDt : todayStr;
      const future = matches.filter((p) => p.dt && p.dt > minDt);
      if (future.length) matches = future;
      else matches = matches.filter((p) => p.dt && p.dt >= minDt);
    }
    return matches[0] || null;
  }

  return null;
}

function pickMeteoPrevisioniSource(meteoCtx, message, opts = {}) {
  const sede = meteoCtx.sede || {};
  const rows = Array.isArray(meteoCtx.terreni) ? meteoCtx.terreni : [];
  const selectedTerrenoId = opts.selectedTerrenoId || null;

  if (selectedTerrenoId) {
    const row = rows.find((r) => r && r.terrenoId === selectedTerrenoId && r.ok);
    if (row) {
      return {
        label: row.nome,
        previsioni: row.previsioniGiornaliere || [],
        sede,
        terrenoRow: row,
        tipoCampo: row.tipoCampo || null,
        terrenoNome: row.nome,
      };
    }
  }

  const terrenoRow = findTerrenoRowInMessage(meteoCtx, message, opts.terreniNames || []);
  if (terrenoRow) {
    return {
      label: terrenoRow.nome,
      previsioni: terrenoRow.previsioniGiornaliere || [],
      sede,
      terrenoRow,
      tipoCampo: terrenoRow.tipoCampo || null,
      terrenoNome: terrenoRow.nome,
    };
  }
  return {
    label: sede.label || "Sede aziendale",
    previsioni: sede.previsioniGiornaliere || [],
    sede,
    terrenoRow: null,
    tipoCampo: null,
    terrenoNome: null,
  };
}

function extractHistoryText(entry) {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  if (entry.parts && entry.parts[0] && entry.parts[0].text != null) {
    return String(entry.parts[0].text);
  }
  return entry.content || entry.text || entry.message || "";
}

function getLastAssistantText(history) {
  if (!Array.isArray(history)) return "";
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const role = String(h.role || h.author || "").toLowerCase();
    if (role === "assistant" || role === "model" || role === "tony") {
      return extractHistoryText(h);
    }
  }
  return "";
}

function parseTrattorePraticabileAnswer(message) {
  const m = normalizeMeteoMsg(message);
  if (/\b(cerca|cercami|trova|alternativ|altra\s+data|consigliami|consigli)\b/.test(m)) {
    return null;
  }
  if (
    /\b(non\s+e\s+praticabil|impraticabil|terreno\s+non\s+praticabil|non\s+riesco|non\s+passo)\b/.test(
      m
    )
  ) {
    return false;
  }
  if (m.length > 80) return null;
  if (m.length <= 50 && /\b(no|nope)\b/.test(m)) return false;
  if (m.length <= 50 && /\b(si|sì|certo|ok|riesco|passo|praticabile)\b/.test(m) && !/\bno\b/.test(m)) {
    return true;
  }
  return null;
}

function resolveTrattorePraticabileForEval(opts, histCtx, message) {
  if (opts.trattorePraticabile === true || opts.trattorePraticabile === false) {
    return opts.trattorePraticabile;
  }
  if (histCtx.trattorePraticabile === undefined) return undefined;
  const qMsg = parseMeteoDayQuery(message);
  if (!qMsg || qMsg.type === "prossima_pioggia") return histCtx.trattorePraticabile;
  if (!histCtx.avoidQuery) return histCtx.trattorePraticabile;
  if (qMsg.type === histCtx.avoidQuery.type) {
    if (qMsg.type === "day") {
      if (qMsg.weekday && histCtx.avoidQuery.weekday && qMsg.weekday !== histCtx.avoidQuery.weekday) {
        return undefined;
      }
      if (qMsg.dayNum != null && histCtx.avoidQuery.dayNum != null && qMsg.dayNum !== histCtx.avoidQuery.dayNum) {
        return undefined;
      }
    }
    return histCtx.trattorePraticabile;
  }
  return undefined;
}

function buildEvalContextFromHistory(history, message) {
  const priorUser = findOperationalUserMessage(history) || "";
  const lastAssistant = getLastAssistantText(history);
  return `${priorUser} ${lastAssistant} ${message}`.trim();
}

function parseMeteoMultiDayNumbers(message) {
  const m = normalizeMeteoMsg(message);
  if (!/\b(o|oppure|e)\b/.test(m) || !/\btratt/.test(m)) return [];
  const nums = [];
  const re = /\b(\d{1,2})\b/g;
  let match;
  while ((match = re.exec(m))) {
    const n = parseInt(match[1], 10);
    if (n >= 1 && n <= 31 && !nums.includes(n)) nums.push(n);
  }
  return nums;
}

function buildMeteoOperativoMultiDayReply(message, source, activityKind, opts = {}) {
  const dayNums = parseMeteoMultiDayNumbers(message);
  if (dayNums.length < 2) return null;

  const tipoCampo = opts.tipoCampo || source.tipoCampo || null;
  const previsioni = source.previsioni || [];
  const parts = [];

  for (const dayNum of dayNums) {
    const query = { type: "day", dayNum, weekday: null };
    const snap = getMeteoDaySnapshot(source, query);
    if (!snap.day) continue;
    const targetDt =
      snap.day.dt ||
      resolvePrevisioneDt(source, query) ||
      previsioni.find((p) => p && p.giornoMese === dayNum)?.dt;
    const trattorePraticabile = resolveTrattorePraticabileForEval(
      { trattorePraticabile: opts.trattorePraticabile },
      opts.histCtx || {},
      message
    );
    const evaluation = tipoCampo
      ? evaluateGiornoOperativoCompleto(
          snap.day,
          previsioni,
          targetDt,
          tipoCampo,
          activityKind,
          DEFAULT_TONY_METEO_RULES,
          { trattorePraticabile }
        )
      : evaluateMeteoOperativoGiorno(snap.day, activityKind, DEFAULT_TONY_METEO_RULES);

    let verdict = "da valutare";
    if (evaluation.esito === "ok") verdict = "adatto";
    else if (evaluation.esito === "sconsigliato" || evaluation.esito === "chiedi_trattore") {
      verdict = "sconsigliato";
    } else if (evaluation.esito === "attenzione") verdict = "con riserva";

    const label = formatGiornoItaliano(snap.day) || `giorno ${dayNum}`;
    parts.push(`${label}: ${verdict} (${evaluation.motivi.join(", ")})`);
  }

  if (!parts.length) return null;
  const loc = formatMeteoLocationSuffix(source);
  return `Per il trattamento${loc}, confronto i giorni che hai citato: ${parts.join(". ")}.`;
}

function isMeteoOperativeThreadActive(history) {
  if (!Array.isArray(history) || !history.length) return false;
  if (isTrattorePraticabileFollowUp(history) || isMorfologiaMeteoFollowUp(history)) return true;
  return !!findOperationalUserMessage(history);
}

function mergeOperationalDayQuery(current, candidate) {
  if (!candidate || candidate.type === "prossima_pioggia") return current;
  if (!current) return candidate;
  if (candidate.dayNum != null && current.dayNum == null) return candidate;
  if (candidate.dayNum != null && current.dayNum != null) return candidate;
  return current;
}

function findOperationalContextInHistory(history) {
  const out = { avoidQuery: null, afterQuery: null, trattorePraticabile: undefined };
  if (!Array.isArray(history)) return out;

  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const role = String(h.role || h.author || "").toLowerCase();
    const text = extractHistoryText(h);
    if (!text) continue;
    if (role === "user") {
      const prat = parseTrattorePraticabileAnswer(text);
      if (prat !== null) out.trattorePraticabile = prat;
      const afterQ = parseMeteoAfterDayQuery(text);
      if (afterQ && !out.afterQuery) out.afterQuery = afterQ;
      const q = parseMeteoDayQuery(text);
      out.avoidQuery = mergeOperationalDayQuery(out.avoidQuery, q);
    }
    if (role === "assistant" || role === "model" || role === "tony") {
      const q = parseMeteoDayQuery(text);
      out.avoidQuery = mergeOperationalDayQuery(out.avoidQuery, q);
    }
  }
  return out;
}

function isTrattorePraticabileFollowUp(history) {
  return /riesci a passare con il trattore|riesci a lavorare il terreno/i.test(getLastAssistantText(history));
}

function isMorfologiaMeteoFollowUp(history) {
  return /morfologia del terreno|in pianura, collina o montagna/i.test(getLastAssistantText(history));
}

function findOperationalUserMessage(history) {
  if (!Array.isArray(history)) return null;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const role = String(h.role || "").toLowerCase();
    if (role !== "user") continue;
    const text = extractHistoryText(h);
    if (isTonyMeteoOperationalQuestion(text) && !parseTipoCampoFromMessage(text)) {
      return text;
    }
  }
  return null;
}

function matchTerrenoInText(meteoCtx, text, catalog, terreniNames) {
  const m = normalizeMeteoMsg(text);
  let row = findTerrenoRowInMessage(meteoCtx, text, terreniNames || []);
  let terrenoId = row && row.terrenoId;
  let terrenoNome = row && row.nome;
  let tipoCampo = (row && row.tipoCampo) || null;

  for (const t of catalog) {
    const n = normalizeMeteoMsg(t.nome || "");
    if (n.length < 3) continue;
    if (!m.includes(n)) {
      const tokens = n.split(/[\s\-–—]+/).filter((tok) => tok.length >= 3);
      if (!tokens.some((tok) => m.includes(tok))) continue;
    }
    terrenoId = t.id;
    terrenoNome = t.nome;
    if (!tipoCampo) tipoCampo = normalizeTipoCampo(t.tipoCampo);
    if (!row) {
      row = (meteoCtx.terreni || []).find((r) => r.terrenoId === terrenoId) || null;
    }
    return { terrenoId, terrenoNome, tipoCampo, terrenoRow: row };
  }
  return { terrenoId, terrenoNome, tipoCampo, terrenoRow: row };
}

function resolveTerrenoOperativo(meteoCtx, message, opts = {}) {
  const catalog = Array.isArray(opts.terreniCatalog) ? opts.terreniCatalog : [];
  const terreniNames = opts.terreniNames || [];
  const selectedTerrenoId = opts.selectedTerrenoId || null;
  let row = null;

  if (selectedTerrenoId) {
    row = (meteoCtx.terreni || []).find((r) => r && r.terrenoId === selectedTerrenoId) || null;
  }
  if (!row) {
    row = findTerrenoRowInMessage(meteoCtx, message, terreniNames);
  }

  let terrenoId = row && row.terrenoId;
  let terrenoNome = row && row.nome;
  let tipoCampo = (row && row.tipoCampo) || null;

  if (!tipoCampo && terrenoId) {
    const cat = catalog.find((t) => t.id === terrenoId);
    if (cat) tipoCampo = normalizeTipoCampo(cat.tipoCampo);
  }

  let matched = matchTerrenoInText(meteoCtx, message, catalog, terreniNames);
  if (!matched.terrenoNome && Array.isArray(opts.history)) {
    for (let i = opts.history.length - 1; i >= 0; i--) {
      const text = extractHistoryText(opts.history[i]);
      if (!text) continue;
      matched = matchTerrenoInText(meteoCtx, text, catalog, terreniNames);
      if (matched.terrenoNome) break;
    }
  }

  return matched;
}

async function persistTipoCampoTerreno(db, tenantId, terrenoId, tipoCampo) {
  if (!db || !tenantId || !terrenoId || !tipoCampo) return false;
  try {
    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("terreni")
      .doc(terrenoId)
      .update({
        tipoCampo,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    return true;
  } catch (err) {
    console.warn("[meteo] persist tipoCampo:", err.message);
    return false;
  }
}

function compactGiornoMeteo(day) {
  if (!day || typeof day !== "object") return null;
  return {
    tempMin: day.tempMin != null ? day.tempMin : null,
    tempMax: day.tempMax != null ? day.tempMax : null,
    pop: day.pop != null ? day.pop : null,
    rainMm: day.rainMm != null ? day.rainMm : null,
    windSpeedKmh: day.windSpeedKmh != null ? day.windSpeedKmh : null,
    humidity: day.humidity != null ? day.humidity : null,
    description: day.description || "",
  };
}

function maxWindFromHourlyForDate(hourly, dateStr) {
  if (!dateStr || !Array.isArray(hourly)) return null;
  let max = null;
  for (const h of hourly) {
    if (!h || !h.dt) continue;
    if (String(h.dt).slice(0, 10) !== dateStr) continue;
    const w = h.windSpeedKmh != null ? Number(h.windSpeedKmh) : null;
    if (w == null || !Number.isFinite(w)) continue;
    max = max == null ? w : Math.max(max, w);
  }
  return max;
}

function mergeGiornoMeteoExtras(day, opts = {}) {
  const out = day && typeof day === "object" ? Object.assign({}, day) : {};
  const prev = opts.previsioneEntry;
  if (out.windSpeedKmh == null && prev && prev.windSpeedKmh != null) {
    out.windSpeedKmh = prev.windSpeedKmh;
  }
  if (out.windSpeedKmh == null && opts.dateStr) {
    const hw = maxWindFromHourlyForDate(opts.hourly, opts.dateStr);
    if (hw != null) out.windSpeedKmh = hw;
  }
  if (out.windSpeedKmh == null && opts.currentWindKmh != null) {
    out.windSpeedKmh = opts.currentWindKmh;
  }
  if (out.humidity == null && prev && prev.humidity != null) out.humidity = prev.humidity;
  if (out.tempMin == null && prev && prev.tempMin != null) out.tempMin = prev.tempMin;
  if (out.tempMax == null && prev && prev.tempMax != null) out.tempMax = prev.tempMax;
  if (out.pop == null && prev && prev.pop != null) out.pop = prev.pop;
  if (out.rainMm == null && prev && prev.rainMm != null) out.rainMm = prev.rainMm;
  return Object.keys(out).length ? out : null;
}

function buildGiorniMeteoCompatti(meteo) {
  const previsioniRaw = compactDailyExtendedForContext(meteo.dailyExtended, { slim: true });
  const hourly = meteo.hourly;
  const todayStr = (previsioniRaw[0] && previsioniRaw[0].dt) || new Date().toISOString().slice(0, 10);
  const tomorrowStr = previsioniRaw[1] ? previsioniRaw[1].dt : null;
  const currentWind = meteo.current && meteo.current.windSpeedKmh != null ? meteo.current.windSpeedKmh : null;
  return {
    today: mergeGiornoMeteoExtras(compactGiornoMeteo(meteo.today || {}), {
      previsioneEntry: previsioniRaw[0],
      hourly,
      dateStr: todayStr,
      currentWindKmh: currentWind,
    }),
    tomorrow: mergeGiornoMeteoExtras(compactGiornoMeteo(meteo.tomorrow || {}), {
      previsioneEntry: previsioniRaw[1],
      hourly,
      dateStr: tomorrowStr,
    }),
    previsioniRaw,
  };
}

function formatMeteoLocationSuffix(source) {
  return source && source.terrenoRow ? ` per ${source.label}` : "";
}

/**
 * Risposta deterministica per domande pioggia: "sabato pioverà?", "mercoledì 27", "quando pioverà?".
 */
function tryMeteoGiornoQuickReply(message, meteoCtx, opts = {}) {
  if (!meteoCtx || !meteoCtx.disponibile || !meteoCtx.moduloMeteoAttivo) return null;
  if (!isTonyMeteoRainFocusedQuestion(message)) return null;

  const query = parseMeteoDayQuery(message);
  if (!query) return null;

  const source = pickMeteoPrevisioniSource(meteoCtx, message, opts);
  const snap = getMeteoDaySnapshot(source, query);
  const mmOnly = isTonyMeteoMmFocusedQuestion(message);

  if (query.type === "prossima_pioggia") {
    const entry = findPrevisioneEntry(source.previsioni, query);
    if (!entry) {
      return `Nei prossimi ~8 giorni per ${source.label} non risultano giornate con probabilità di pioggia significativa (≥20%).`;
    }
    return `La prossima pioggia prevista per ${source.label} è ${formatGiornoItaliano(entry)}: ${describePioggiaGiorno(entry, { mmOnly })}.`;
  }

  if (!snap.day) {
    const hint = query.weekday ? capitalizeIt(query.weekday) : "quel giorno";
    return `Non ho previsioni meteo in archivio per ${hint} nell'intervallo di ~8 giorni (${source.label}). Apri il modulo Meteo per il dettaglio.`;
  }

  const where = formatMeteoLocationSuffix(source);
  return `${snap.when}${where}: ${describePioggiaGiorno(snap.day, { mmOnly })}.`;
}

/**
 * Risposta deterministica per vento, temperatura, umidità su un giorno.
 */
function tryMeteoCondizioniQuickReply(message, meteoCtx, opts = {}) {
  if (!meteoCtx || !meteoCtx.disponibile || !meteoCtx.moduloMeteoAttivo) return null;
  if (isTonyMeteoOperationalQuestion(message)) return null;

  const m = normalizeMeteoMsg(message);
  const asksVento = /\b(vento|venti|ventoso|raffica)\b/.test(m);
  const asksTemp = /\b(temperatur|gradi|freddo|caldo|gelat)\b/.test(m);
  const asksUmid = /\b(umidit)\b/.test(m);
  if (!asksVento && !asksTemp && !asksUmid) return null;

  const query = parseMeteoDayQuery(message);
  if (!query || query.type === "prossima_pioggia") return null;

  const source = pickMeteoPrevisioniSource(meteoCtx, message, opts);
  const snap = getMeteoDaySnapshot(source, query);
  if (!snap.day) return null;

  const where = formatMeteoLocationSuffix(source);
  const parts = [];
  if (asksVento) parts.push(describeVento(snap.day.windSpeedKmh));
  if (asksTemp) {
    if (snap.day.tempMin != null && snap.day.tempMax != null) {
      parts.push(`temperature previste ${snap.day.tempMin}–${snap.day.tempMax}°C`);
    } else {
      parts.push("non ho dati sulle temperature per quel giorno");
    }
  }
  if (asksUmid) {
    if (snap.day.humidity != null) {
      parts.push(`umidità prevista ${snap.day.humidity}%`);
    } else {
      parts.push("non ho dati sull'umidità per quel giorno");
    }
  }

  return `${snap.when}${where}: ${parts.join("; ")}.`;
}

async function mapWithConcurrency(items, limit, fn) {
  const list = Array.isArray(items) ? items : [];
  const cap = limit > 0 ? limit : 1;
  const out = [];
  for (let i = 0; i < list.length; i += cap) {
    const batch = list.slice(i, i + cap);
    const batchOut = await Promise.all(batch.map(fn));
    out.push(...batchOut);
  }
  return out;
}

function compactSedeMeteoForContext(meteo, { extended = false } = {}) {
  if (!meteo) return null;
  const c = meteo.current || {};
  const giorni = buildGiorniMeteoCompatti(meteo);
  const out = {
    label: (meteo.location && meteo.location.label) || "Sede aziendale",
    temp: c.temp != null ? c.temp : null,
    description: c.description || "",
    windSpeedKmh: c.windSpeedKmh != null ? c.windSpeedKmh : null,
    humidity: c.humidity != null ? c.humidity : null,
    today: giorni.today,
    tomorrow: giorni.tomorrow,
    updatedAt: meteo.updatedAt || null,
  };
  if (extended) {
    const alerts = Array.isArray(meteo.alerts) ? meteo.alerts : [];
    out.alertsCount = alerts.length;
    out.alertBreve = alerts[0]
      ? translateMeteoAlertEvent(alerts[0].event, alerts[0].tags)
      : null;
    const ms = meteo.minutelySummary || {};
    out.hasRainSoon = !!ms.hasRainSoon;
    out.pioggiaProssimaOra = ms.hasRainSoon
      ? `max ${ms.maxPrecipitation != null ? ms.maxPrecipitation : "?"} mm/h`
      : null;
    out.previsioniGiornaliere = enrichPrevisioniGiornaliereForTony(giorni.previsioniRaw);
  }
  return out;
}

function compactTerrenoMeteoRow(row, opts = {}) {
  if (!row) return null;
  const includePrevisioniGiornaliere = opts.includePrevisioniGiornaliere !== false;
  const m = row.meteo || {};
  const c = m.current || {};
  const giorni = buildGiorniMeteoCompatti(m);
  const alerts = Array.isArray(m.alerts) ? m.alerts : [];
  const ms = m.minutelySummary || {};
  const out = {
    terrenoId: row.terrenoId,
    nome: row.nome,
    podere: row.podere || null,
    tipoCampo: normalizeTipoCampo(row.tipoCampo) || null,
    ok: !!row.ok,
    temp: c.temp != null ? c.temp : null,
    description: c.description || "",
    windSpeedKmh: c.windSpeedKmh != null ? c.windSpeedKmh : null,
    popOggi: giorni.today && giorni.today.pop != null ? giorni.today.pop : null,
    popDomani: giorni.domani && giorni.domani.pop != null ? giorni.domani.pop : null,
    oggi: giorni.today,
    domani: giorni.domani,
    alertsCount: alerts.length,
    hasRainSoon: !!ms.hasRainSoon,
  };
  if (includePrevisioniGiornaliere) {
    out.previsioniGiornaliere = enrichPrevisioniGiornaliereForTony(giorni.previsioniRaw);
  }
  return out;
}

function buildSummaryMeteoText(sede, terreniRows, consigli, { moduloMeteoAttivo = false } = {}) {
  const parts = [];
  if (sede && sede.temp != null) {
    parts.push(
      `Sede ${sede.label}: ${Math.round(sede.temp)}°C ${sede.description || ""}`.trim()
    );
    if (sede.today && sede.today.tempMin != null && sede.today.tempMax != null) {
      parts.push(`oggi ${sede.today.tempMin}–${sede.today.tempMax}°C`);
    }
    if (sede.alertsCount > 0) {
      parts.push(`${sede.alertsCount} alert attivo/i`);
    }
  } else {
    parts.push("Meteo sede non disponibile");
  }
  if (moduloMeteoAttivo && Array.isArray(terreniRows)) {
    const withMeteo = terreniRows.filter((t) => t.ok);
    const rainSoon = withMeteo.filter((t) => t.hasRainSoon).length;
    if (withMeteo.length) {
      parts.push(`${withMeteo.length} campi con meteo`);
    }
    if (rainSoon) {
      parts.push(`${rainSoon} con pioggia entro circa un'ora`);
    }
  }
  if (Array.isArray(consigli) && consigli.length) {
    parts.push(`${consigli.length} avvisi operativi meteo`);
  }
  return parts.join(" · ");
}

function actOperativoPhrase(activityKind) {
  return activityKind === "trattamento" ? "il trattamento" : "la lavorazione in campo";
}

function actOperativoAl(activityKind) {
  return activityKind === "trattamento" ? "al trattamento" : "alla lavorazione in campo";
}

function isTonyMeteoQuestion(message) {
  if (isTonyOperationalCreationIntent(message)) return false;
  if (isTonyMeteoOperationalQuestion(message)) return true;
  if (isTonyMeteoConsigliaDataQuestion(message)) return true;
  if (isTonyMeteoDayFollowUpQuestion(message)) return true;
  const m = String(message || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    /\b(meteo|tempo|pioggia|piove|previsioni?|vento|temperatur|umidit|gelata|grandine|nuvol|sole|cielo|temporale|allerta meteo)\b/.test(
      m
    )
  ) {
    return true;
  }
  if (
    /\b(posso|conviene|riesco)\b/.test(m) &&
    /\b(lavorare|trattare|concimare|potare|seminare|irrigare|erpic|erpicare|sfalci|sfalciare|arare|fresare|trinciare|trinciatura)\b/.test(
      m
    ) &&
    (/\b(domani|oggi|stasera|meteo|pioggia|vento|tempo)\b/.test(m) ||
      /\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(m) ||
      /\b\d{1,2}\b/.test(m))
  ) {
    return true;
  }
  if (
    /\b(trattamento|trattare|concimazione|lavorare|lavoro|programmare|pianificare|erpic|erpicare|lavorazion|trinciare|trinciatura)\b/.test(
      m
    ) &&
    (/\b(domani|oggi|meteo|pioggia|vento)\b/.test(m) ||
      /\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(m) ||
      /\b\d{1,2}\b/.test(m))
  ) {
    return true;
  }
  if (
    /\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(m) &&
    /\b(meteo|tempo|pioggia|piove|piovera|vento|temperatur|previsioni?)\b/.test(m)
  ) {
    return true;
  }
  if (
    /\b(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)\b/.test(m) &&
    /\b\d{1,2}\b/.test(m)
  ) {
    return true;
  }
  if (/\b(consigli|consigliami|suggerisci)\b/.test(m) && /\b(data|giorno|alternativ)\b/.test(m)) {
    return true;
  }
  if (/\b(altra data|che giorno mi consigli|quale giorno)\b/.test(m)) return true;
  return false;
}

/**
 * Carica meteo per terreni nel Context Builder solo per campo citato, pagina meteo con selezione, o domande operative.
 * @param {string} message
 * @param {string|null|undefined} pageType
 * @param {{ terreniNames?: string[], selectedTerrenoId?: string|null }} [opts]
 * @returns {boolean}
 */
function shouldBuildTerreniMeteoContext(message, pageType, opts = {}) {
  const terreniNames = opts.terreniNames || [];
  const selectedTerrenoId = opts.selectedTerrenoId;

  if (String(pageType || "") === "meteo_dashboard") {
    if (selectedTerrenoId) return true;
    if (mentionsTerrenoInMessage(message, terreniNames)) return true;
    if (isTonyMeteoDateOnlyQuestion(message, terreniNames)) return false;
    return isTonyMeteoOperationalQuestion(message);
  }

  if (!isTonyMeteoQuestion(message)) return false;
  if (mentionsTerrenoInMessage(message, terreniNames)) return true;
  if (isTonyMeteoOperationalQuestion(message)) return true;
  if (/\b(vento|venti|temperatur|gradi|umidit)\b/.test(normalizeMeteoMsg(message))) {
    return mentionsTerrenoInMessage(message, terreniNames);
  }
  if (isTonyMeteoDateOnlyQuestion(message, terreniNames)) return false;
  return false;
}

async function fetchSedeMeteoForContext(db, apiKey, tenantId, tenantData, nowMs, extended) {
  const coord = normalizeCoordinate(tenantData.sedeCoordinate);
  if (!coord) {
    return { ok: false, code: "SEDE_NOT_SET", message: "Sede non impostata in Impostazioni." };
  }
  const location = buildSedeLocation(tenantData, coord);
  const cacheDoc = extended ? "sedeAvanzato" : "sede";
  const cacheRef = db.collection("tenants").doc(tenantId).collection("meteoCache").doc(cacheDoc);
  const hit = await readCachedMeteo(cacheRef, coord, nowMs);
  if (hit) {
    return { ok: true, cached: true, meteo: hit.meteo };
  }
  if (!apiKey) {
    return { ok: false, code: "NO_API_KEY", message: "Meteo temporaneamente non disponibile." };
  }
  try {
    const result = await fetchAndCacheMeteo(
      cacheRef,
      apiKey,
      coord,
      location,
      extended ? null : "minutely,hourly,alerts",
      extended ? normalizeOpenWeatherExtended : normalizeOpenWeatherBase
    );
    return { ok: true, cached: result.cached, meteo: result.meteo };
  } catch (err) {
    console.error("[buildContextMeteo] sede:", err.message);
    return { ok: false, code: "FETCH_ERROR", message: "Meteo sede temporaneamente non disponibile." };
  }
}

/**
 * Context Builder meteo per Tony Avanzato (cache 15 min).
 * @param {FirebaseFirestore.Firestore} db
 * @param {string|null} apiKey
 * @param {string} tenantId
 * @param {object} tenantData
 * @param {string} plan
 * @param {{ tonyAvanzato?: boolean, meteoModule?: boolean, lavori?: Array<object>, includeTerreni?: boolean }} opts
 */
async function buildContextMeteo(db, apiKey, tenantId, tenantData, plan, opts = {}) {
  const tonyAvanzato = !!opts.tonyAvanzato;
  const meteoModule = !!opts.meteoModule;
  const includeTerreni = !!opts.includeTerreni;
  const lavori = includeTerreni && Array.isArray(opts.lavori) ? opts.lavori : [];

  if (!tonyAvanzato || plan === "free") {
    return { meteoChatDisponibile: false };
  }

  const nowMs = Date.now();
  const baseOut = {
    meteoChatDisponibile: true,
    moduloMeteoAttivo: meteoModule,
    consigliOperativi: meteoModule,
    attribution: "OpenWeather",
  };

  const sedeFetch = await fetchSedeMeteoForContext(
    db,
    apiKey,
    tenantId,
    tenantData,
    nowMs,
    meteoModule
  );

  if (!sedeFetch.ok) {
    return Object.assign({}, baseOut, {
      disponibile: false,
      code: sedeFetch.code,
      summaryMeteo: sedeFetch.message || "Meteo non disponibile.",
    });
  }

  const sede = compactSedeMeteoForContext(sedeFetch.meteo, { extended: meteoModule });
  let terreniRows = [];
  let consigli = [];

  if (meteoModule && apiKey && includeTerreni) {
    const terreniSnap = await db
      .collection("tenants")
      .doc(tenantId)
      .collection("terreni")
      .get();
    const terreniDocs = terreniSnap.docs
      .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
      .filter((t) => !t.data.clienteId)
      .sort((a, b) => String(a.data.nome || "").localeCompare(String(b.data.nome || ""), "it"))
      .slice(0, MAX_TERRENI_METEO);

    const rows = await mapWithConcurrency(terreniDocs, 8, (t) =>
      fetchTerrenoMeteo(db, apiKey, tenantId, t.id, t.data, nowMs)
    );
    for (const row of rows) {
      const compact = compactTerrenoMeteoRow(row, { includePrevisioniGiornaliere: true });
      if (compact) terreniRows.push(compact);
    }

    try {
      consigli = buildMeteoConsigli(DEFAULT_TONY_METEO_RULES, terreniRows, lavori, sede);
    } catch (rulesErr) {
      console.warn("[buildContextMeteo] consigli:", rulesErr.message);
    }
  }

  const summaryMeteo = buildSummaryMeteoText(sede, terreniRows, consigli, {
    moduloMeteoAttivo: meteoModule,
  });

  return Object.assign({}, baseOut, {
    disponibile: true,
    sede,
    terreni: terreniRows,
    consigli,
    summaryMeteo,
    cached: !!sedeFetch.cached,
  });
}

module.exports = {
  handleGetMeteoSede,
  handleGetMeteoSedeAvanzato,
  handleGetMeteoTerreni,
  normalizeOpenWeatherBase,
  normalizeOpenWeatherExtended,
  tenantHasMeteoModule,
  resolveMeteoModuleActive,
  buildContextMeteo,
  isTonyMeteoQuestion,
  isTonyMeteoConsigliaDataQuestion,
  isTonyMeteoConsigliaDataFollowUp,
  shouldBuildTerreniMeteoContext,
  tryMeteoOperativoQuickReply,
  tryMeteoPreventivoDateQuickReply,
  isTonyPreventivoDateMeteoEval,
  tryMeteoGiornoQuickReply,
  tryMeteoCondizioniQuickReply,
  enrichPrevisioniGiornaliereForTony,
};
