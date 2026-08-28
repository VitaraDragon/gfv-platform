#!/usr/bin/env node
/**
 * Canary ciclo lavoro push — stesso motore delle Cloud Functions, senza telefono.
 * Non invia FCM. Verifica destinatari, anti-auto-ping, stati rumore, coda/finestra.
 *
 *   node scripts/notification-ciclo-canary.mjs
 */
import {
  getNotificationEventIds,
  buildNotificationIconUrl,
  NOTIFICATION_ICON_RELATIVE,
} from '../core/config/notification-catalog.js';
import {
  resolveNotificationRecipients,
  shouldEscalateConferme,
  shouldEscalateAssenzaWhatsApp,
  isManagerPushStato,
} from '../core/services/notification-policy.js';
import {
  detectLavoroPushEvents,
  detectAssenzaLifecycle,
  buildNotificationEventDocs,
} from '../core/services/notification-dispatch-core.js';

const LUCA = 'luca';
const MARIO = 'mario';
const GIUSEPPE = 'giuseppe';
const ADMIN = 'admin1';

const tenantUsers = [
  { id: LUCA, ruoli: ['manager'] },
  { id: ADMIN, ruoli: ['amministratore'] },
  { id: MARIO, ruoli: ['caposquadra'] },
  { id: GIUSEPPE, ruoli: ['operaio'] },
];

const nowDay = new Date(Date.UTC(2026, 7, 25, 10, 0, 0));
const prefsUtc = { [LUCA]: { timezone: 'UTC' }, [ADMIN]: { timezone: 'UTC' }, [MARIO]: { timezone: 'UTC' }, [GIUSEPPE]: { timezone: 'UTC' } };

const results = [];
function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}: ${detail}`);
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`  FAIL  ${id}: ${detail}`);
}
function eqIds(actual, expected) {
  return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

function recipientsOf(eventId, ctx) {
  return resolveNotificationRecipients(eventId, ctx);
}

console.log('\n=== Push ciclo lavoro canary (motore Functions, no telefono) ===\n');

const ids = getNotificationEventIds();
if (ids.length === 7 && ids.includes('assenza_turno') && !ids.includes('lavoro_completato') && !ids.includes('in_standby')) {
  pass('catalogo', ids.join(', '));
} else {
  fail('catalogo', String(ids));
}

const icon = buildNotificationIconUrl();
if (icon.startsWith('https://') && icon.endsWith(NOTIFICATION_ICON_RELATIVE) && !icon.includes('/icons/')) {
  pass('icona-url', icon);
} else {
  fail('icona-url', icon);
}

const comm = recipientsOf('comunicazione_destinatario', {
  actorUserId: MARIO,
  destinatariIds: [GIUSEPPE, MARIO],
});
if (eqIds(comm, [GIUSEPPE])) pass('comunicazione', 'solo operaio destinatario; capo mittente escluso');
else fail('comunicazione', String(comm));

const assegnato = recipientsOf('lavoro_assegnato', {
  actorUserId: LUCA,
  lavoro: { caposquadraId: MARIO },
});
if (eqIds(assegnato, [MARIO])) pass('lavoro-assegnato', 'Luca crea → push a Mario, non a Luca');
else fail('lavoro-assegnato', String(assegnato));

const autonomo = recipientsOf('lavoro_assegnato', {
  actorUserId: LUCA,
  lavoro: { operaioId: GIUSEPPE },
});
if (eqIds(autonomo, [GIUSEPPE])) pass('lavoro-autonomo', 'senza capo → operaio');
else fail('lavoro-autonomo', String(autonomo));

const conferme = recipientsOf('conferme_in_ritardo', { caposquadraId: MARIO });
if (eqIds(conferme, [MARIO])) pass('conferme-dest', 'reminder al mittente (capo)');
else fail('conferme-dest', String(conferme));

const sent = new Date(Date.UTC(2026, 7, 25, 8, 0, 0));
const later = new Date(Date.UTC(2026, 7, 25, 16, 0, 0));
const escalate = shouldEscalateConferme({
  createdAt: sent,
  now: later,
  destCount: 1,
  confermeCount: 0,
  prefs: { timezone: 'UTC' },
});
const noEscalate = shouldEscalateConferme({
  createdAt: sent,
  now: later,
  destCount: 1,
  confermeCount: 1,
  prefs: { timezone: 'UTC' },
});
if (escalate && !noEscalate) pass('conferme-6h', 'scatta dopo 6h utili; stop se tutti hanno confermato');
else fail('conferme-6h', `escalate=${escalate} noEscalate=${noEscalate}`);

const ore = recipientsOf('ore_da_validare', {
  actorUserId: GIUSEPPE,
  lavoro: { caposquadraId: MARIO, operaioId: GIUSEPPE },
});
if (eqIds(ore, [MARIO])) pass('ore-da-validare', 'Giuseppe segna → Mario; manager escluso');
else fail('ore-da-validare', String(ore));

const oreNoCapo = recipientsOf('ore_da_validare', {
  actorUserId: GIUSEPPE,
  lavoro: { operaioId: GIUSEPPE },
});
if (eqIds(oreNoCapo, [])) pass('ore-autonomo', 'lavoro autonomo: niente push ore al manager');
else fail('ore-autonomo', String(oreNoCapo));

const chiusura = recipientsOf('lavoro_completato_da_approvare', {
  actorUserId: MARIO,
  tenantUsers,
});
if (eqIds(chiusura, [LUCA, ADMIN])) pass('completato-da-approvare', 'Mario chiude → Luca+admin, non Mario');
else fail('completato-da-approvare', String(chiusura));

const chiusuraSelf = recipientsOf('lavoro_completato_da_approvare', {
  actorUserId: LUCA,
  tenantUsers,
});
if (eqIds(chiusuraSelf, [ADMIN])) pass('anti-auto-ping-manager', 'Luca non riceve la push se è lui l’attore');
else fail('anti-auto-ping-manager', String(chiusuraSelf));

const sospeso = recipientsOf('lavoro_sospeso', {
  actorUserId: MARIO,
  tenantUsers,
});
if (eqIds(sospeso, [LUCA, ADMIN])) pass('sospeso', 'Mario sospende → Luca+admin');
else fail('sospeso', String(sospeso));

const detect = [
  ['create-assegnato', detectLavoroPushEvents(null, { caposquadraId: MARIO }), ['lavoro_assegnato']],
  ['chiusura', detectLavoroPushEvents({ stato: 'in_corso', caposquadraId: MARIO }, { stato: 'completato_da_approvare', caposquadraId: MARIO }), ['lavoro_completato_da_approvare']],
  ['sospeso-detect', detectLavoroPushEvents({ stato: 'in_corso', caposquadraId: MARIO }, { stato: 'sospeso', caposquadraId: MARIO }), ['lavoro_sospeso']],
  ['approvato-silenzio', detectLavoroPushEvents({ stato: 'completato_da_approvare' }, { stato: 'completato' }), []],
  ['percentuale-silenzio', detectLavoroPushEvents({ stato: 'in_corso', avanzamento: 40, caposquadraId: MARIO }, { stato: 'in_corso', avanzamento: 70, caposquadraId: MARIO }), []],
];
for (const [id, actual, expected] of detect) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass(`detect:${id}`, expected.length ? expected.join(',') : 'nessun evento');
  else fail(`detect:${id}`, String(actual));
}

if (
  !isManagerPushStato('lavoro_completato_da_approvare', 'in_corso')
  && isManagerPushStato('lavoro_completato_da_approvare', 'completato_da_approvare')
  && isManagerPushStato('lavoro_sospeso', 'sospeso')
) {
  pass('stati-manager', 'solo chiusura da approvare e sospeso');
} else {
  fail('stati-manager', 'filtro stati manager errato');
}

const oreDocs = buildNotificationEventDocs({
  eventId: 'ore_da_validare',
  tenantId: 'sim',
  sourceCollection: 'oreOperai',
  sourceId: 'o1',
  actorUserId: GIUSEPPE,
  lavoro: { caposquadraId: MARIO, nome: 'Potatura' },
  now: nowDay,
  prefsByUser: prefsUtc,
});
if (oreDocs.length === 1 && oreDocs[0].recipientUserId === MARIO && oreDocs[0].status === 'queued' && oreDocs[0].coalesceKey) {
  pass('digest-ore', 'coda 15 min + chiave coalesce capo×giorno');
} else {
  fail('digest-ore', JSON.stringify(oreDocs.map((d) => ({ r: d.recipientUserId, s: d.status, k: d.coalesceKey }))));
}

const assenzaRecipients = recipientsOf('assenza_turno', {
  actorUserId: MARIO,
  tenantId: 'sim',
  tenantUsers,
  lavoro: { caposquadraId: MARIO },
  operaioId: GIUSEPPE,
});
if (eqIds(assenzaRecipients, [LUCA, ADMIN])) pass('assenza-destinatari', 'capo attore escluso; manager+admin');
else fail('assenza-destinatari', String(assenzaRecipients));

const todayKey = '2026-08-25';
const lifeToday = detectAssenzaLifecycle(null, {
  stato: 'segnalata',
  dataInizioGiorno: todayKey,
  dataFineGiorno: todayKey,
}, nowDay);
const lifeFuture = detectAssenzaLifecycle(null, {
  stato: 'confermata',
  dataInizioGiorno: '2026-09-10',
  dataFineGiorno: '2026-09-20',
}, nowDay);
if (lifeToday.notify && !lifeFuture.notify) pass('assenza-oggi', 'push solo se copre oggi');
else fail('assenza-oggi', JSON.stringify({ lifeToday, lifeFuture }));

const waOn = shouldEscalateAssenzaWhatsApp({
  sentAt: new Date(Date.UTC(2026, 7, 25, 8, 0, 0)),
  now: new Date(Date.UTC(2026, 7, 25, 8, 10, 0)),
  prefs: { timezone: 'UTC', whatsappEnabled: true },
});
const waSeen = shouldEscalateAssenzaWhatsApp({
  sentAt: new Date(Date.UTC(2026, 7, 25, 8, 0, 0)),
  now: new Date(Date.UTC(2026, 7, 25, 8, 10, 0)),
  prefs: { timezone: 'UTC', whatsappEnabled: true },
  groupSeen: true,
});
if (waOn && !waSeen) pass('assenza-wa', '10 min utili; seen ferma WA');
else fail('assenza-wa', JSON.stringify({ waOn, waSeen }));

const failed = results.filter((r) => !r.ok);
console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===\n`);
if (failed.length) {
  failed.forEach((f) => console.log(`  still failing: ${f.id} — ${f.detail}`));
  process.exit(1);
}
