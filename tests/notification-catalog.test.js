import { describe, it, expect } from 'vitest';
import {
    NOTIFICATION_EVENTS,
    NOTIFICATION_PREFS_DEFAULTS,
    NOTIFICATION_ICON_RELATIVE,
    getNotificationEvent,
    getNotificationEventIds,
    buildNotificationDeepLink,
    buildNotificationIconUrl,
    resolveNotificationWebOrigin,
    oreDaValidareCoalesceKey,
    formatNotificationTemplate,
} from '../core/config/notification-catalog.js';
import {
    parseHmToMinutes,
    mergeNotificationPrefs,
    isInPushWindow,
    usefulMinutesBetween,
    rolesOfUser,
    resolveNotificationRecipients,
    assegnatarioIdsForEvent,
    caposquadraIdForAssenza,
    shouldEscalateAssenzaWhatsApp,
    shouldEscalateConferme,
    nextSendAt,
    buildNotificationCopy,
    isManagerPushStato,
    validateNotificationPrefsForm,
    buildNotificationPrefsWrite,
    normalizeNotifyPhone,
    resolveNotificationDelivery,
    zonedGiornoKey,
    assenzaCoversGiorno,
} from '../core/services/notification-policy.js';
import {
    loadNotificationPrefsFromUser,
    saveUserNotificationPrefs,
} from '../core/services/notification-prefs-service.js';

describe('notification-catalog', () => {
    it('include i 6 eventi del ciclo lavoro più assenza turno, non gli stati manager rumorosi', () => {
        const ids = getNotificationEventIds();
        expect(ids).toEqual([
            'comunicazione_destinatario',
            'lavoro_assegnato',
            'conferme_in_ritardo',
            'ore_da_validare',
            'lavoro_completato_da_approvare',
            'lavoro_sospeso',
            'assenza_turno',
        ]);
        expect(ids).not.toContain('lavoro_completato');
        expect(ids).not.toContain('in_standby');
        expect(NOTIFICATION_EVENTS.every((e) => e.enabled)).toBe(true);
    });

    it('icona push usa il PNG in core/images con URL assoluto Pages', () => {
        expect(NOTIFICATION_ICON_RELATIVE).toBe('core/images/icon-192x192.png');
        expect(buildNotificationIconUrl()).toBe(
            'https://vitaradragon.github.io/gfv-platform/core/images/icon-192x192.png'
        );
        expect(resolveNotificationWebOrigin({
            origin: 'https://vitaradragon.github.io',
            pathname: '/gfv-platform/core/dashboard-standalone.html',
        })).toBe('https://vitaradragon.github.io/gfv-platform');
    });

    it('manager riceve chiusura, sospeso e assenza turno', () => {
        const managerEvents = NOTIFICATION_EVENTS.filter((e) => e.roles.includes('manager'));
        expect(managerEvents.map((e) => e.id)).toEqual([
            'lavoro_completato_da_approvare',
            'lavoro_sospeso',
            'assenza_turno',
        ]);
    });

    it('deep link riusa query già esistenti in app', () => {
        expect(buildNotificationDeepLink('comunicazione_destinatario', {
            comunicazioneId: 'c1',
        })).toBe('core/mobile/field-workspace-standalone.html?openSlide=comunicazioni&comunicazioneId=c1');

        expect(buildNotificationDeepLink('lavoro_assegnato', {
            lavoroId: 'L9',
        })).toBe('core/mobile/field-workspace-standalone.html?openSlide=lavoro&focusLavoroId=L9');

        expect(buildNotificationDeepLink('ore_da_validare')).toBe(
            'core/mobile/field-workspace-standalone.html?openSlide=valida-ore'
        );

        expect(buildNotificationDeepLink('lavoro_sospeso', {
            lavoroId: 'L9',
        })).toBe('core/admin/gestione-lavori-standalone.html?lavoroId=L9');

        expect(buildNotificationDeepLink('assenza_turno', {
            assenzaId: 'a1',
            data: '2026-08-28',
            lavoroId: 'L9',
        })).toBe('core/admin/gestione-lavori-standalone.html?lavoroId=L9&assenzaId=a1&data=2026-08-28');

        expect(buildNotificationDeepLink('assenza_turno', {
            assenzaId: 'a1',
            lavoroId: 'L9',
            variant: 'capo',
        })).toBe('core/mobile/field-workspace-standalone.html?openSlide=lavoro&focusLavoroId=L9&assenzaId=a1');
    });

    it('coalesce ore è per capo e giorno', () => {
        expect(oreDaValidareCoalesceKey('capo1', new Date(2026, 7, 25))).toBe(
            'ore_da_validare:capo1:2026-08-25'
        );
    });

    it('template sostituisce placeholder', () => {
        expect(formatNotificationTemplate('Ciao {nome}', { nome: 'Mario' })).toBe('Ciao Mario');
    });
});

describe('notification-policy recipients', () => {
    it('comunicazione: solo destinatari, mai il mittente', () => {
        const ids = resolveNotificationRecipients('comunicazione_destinatario', {
            actorUserId: 'mario',
            destinatariIds: ['giuseppe', 'mario', 'anna', 'giuseppe'],
        });
        expect(ids).toEqual(['giuseppe', 'anna']);
    });

    it('lavoro assegnato: capo; autonomo: operaio', () => {
        expect(assegnatarioIdsForEvent({ caposquadraId: 'mario' }, 'lavoro_assegnato')).toEqual(['mario']);
        expect(assegnatarioIdsForEvent({ operaioId: 'giuseppe' }, 'lavoro_assegnato')).toEqual(['giuseppe']);
        expect(resolveNotificationRecipients('lavoro_assegnato', {
            actorUserId: 'luca',
            lavoro: { caposquadraId: 'mario' },
        })).toEqual(['mario']);
        expect(resolveNotificationRecipients('lavoro_assegnato', {
            actorUserId: 'luca',
            lavoro: { operaioId: 'giuseppe' },
        })).toEqual(['giuseppe']);
    });

    it('ore da validare: solo capo, mai manager su lavoro autonomo', () => {
        expect(resolveNotificationRecipients('ore_da_validare', {
            lavoro: { operaioId: 'giuseppe' },
        })).toEqual([]);
        expect(resolveNotificationRecipients('ore_da_validare', {
            actorUserId: 'giuseppe',
            lavoro: { caposquadraId: 'mario', operaioId: 'giuseppe' },
        })).toEqual(['mario']);
    });

    it('manager/admin del tenant, escluso chi ha cambiato stato', () => {
        const tenantUsers = [
            { id: 'luca', ruoli: ['manager'] },
            { id: 'admin1', tenantMemberships: { t1: { stato: 'attivo', ruoli: ['amministratore'] } } },
            { id: 'mario', ruoli: ['caposquadra'] },
            { id: 'ex', tenantMemberships: { t1: { stato: 'sospeso', ruoli: ['manager'] } } },
        ];
        expect(resolveNotificationRecipients('lavoro_completato_da_approvare', {
            actorUserId: 'mario',
            tenantId: 't1',
            tenantUsers,
        })).toEqual(['luca', 'admin1']);
        expect(resolveNotificationRecipients('lavoro_sospeso', {
            actorUserId: 'luca',
            tenantId: 't1',
            tenantUsers,
        })).toEqual(['admin1']);
    });

    it('conferme in ritardo: mittente capo', () => {
        expect(resolveNotificationRecipients('conferme_in_ritardo', {
            caposquadraId: 'mario',
        })).toEqual(['mario']);
    });

    it('assenza turno: capo della squadra/lavoro e manager, mai l\'attore', () => {
        const tenantUsers = [
            { id: 'luca', ruoli: ['manager'] },
            { id: 'admin1', ruoli: ['amministratore'] },
            { id: 'mario', ruoli: ['caposquadra'] },
        ];
        expect(caposquadraIdForAssenza({
            operaioId: 'giuseppe',
            squadre: [{ caposquadraId: 'mario', operai: ['giuseppe'] }],
        })).toBe('mario');
        expect(resolveNotificationRecipients('assenza_turno', {
            actorUserId: 'mario',
            tenantId: 't1',
            tenantUsers,
            lavoro: { caposquadraId: 'mario' },
            operaioId: 'giuseppe',
        })).toEqual(['luca', 'admin1']);
        expect(resolveNotificationRecipients('assenza_turno', {
            actorUserId: 'luca',
            tenantId: 't1',
            tenantUsers,
            caposquadraId: 'mario',
            operaioId: 'giuseppe',
        })).toEqual(['mario', 'admin1']);
    });

    it('stati manager: solo i due previsti', () => {
        expect(isManagerPushStato('lavoro_completato_da_approvare', 'completato_da_approvare')).toBe(true);
        expect(isManagerPushStato('lavoro_sospeso', 'sospeso')).toBe(true);
        expect(isManagerPushStato('lavoro_sospeso', 'in_standby')).toBe(false);
        expect(isManagerPushStato('lavoro_completato_da_approvare', 'completato')).toBe(false);
    });

    it('rolesOfUser preferisce membership attiva', () => {
        expect(rolesOfUser({
            ruoli: ['operaio'],
            tenantMemberships: { t1: { stato: 'attivo', ruoli: ['manager'] } },
        }, 't1')).toEqual(['manager']);
    });
});

describe('notification-policy windows and conferme', () => {
    it('parse orari e default prefs', () => {
        expect(parseHmToMinutes('05:00')).toBe(300);
        expect(parseHmToMinutes('21:00')).toBe(1260);
        expect(mergeNotificationPrefs({ pushEnabled: false }).pushEnabled).toBe(false);
        expect(mergeNotificationPrefs({}).pushWindowStart).toBe(NOTIFICATION_PREFS_DEFAULTS.pushWindowStart);
        expect(mergeNotificationPrefs({ pushWindowStart: '6:30' }).pushWindowStart).toBe('06:30');
    });

    it('finestra 05–21, fuori orario va in coda al mattino', () => {
        const inside = new Date(Date.UTC(2026, 7, 25, 10, 0, 0));
        const evening = new Date(Date.UTC(2026, 7, 25, 22, 30, 0));
        expect(isInPushWindow(inside, '05:00', '21:00', 'UTC')).toBe(true);
        expect(isInPushWindow(evening, '05:00', '21:00', 'UTC')).toBe(false);
        const next = nextSendAt(evening, '05:00', '21:00', 'UTC');
        expect(next.getUTCDate()).toBe(26);
        expect(next.getUTCHours()).toBe(5);
        expect(next.getUTCMinutes()).toBe(0);
    });

    it('6 ore utili non contano la notte', () => {
        const tzPrefs = { timezone: 'UTC' };
        const sent = new Date(Date.UTC(2026, 7, 25, 20, 0, 0));
        const sameNight = new Date(Date.UTC(2026, 7, 26, 2, 0, 0));
        const nextMorning = new Date(Date.UTC(2026, 7, 26, 10, 0, 0));
        expect(usefulMinutesBetween(sent, sameNight, '05:00', '21:00', 'UTC')).toBe(60);
        expect(usefulMinutesBetween(sent, nextMorning, '05:00', '21:00', 'UTC')).toBe(60 + 5 * 60);
        expect(shouldEscalateConferme({
            createdAt: sent,
            now: sameNight,
            destCount: 2,
            confermeCount: 0,
            prefs: tzPrefs,
        })).toBe(false);
        expect(shouldEscalateConferme({
            createdAt: sent,
            now: nextMorning,
            destCount: 2,
            confermeCount: 0,
            prefs: tzPrefs,
        })).toBe(true);
    });

    it('niente reminder se tutti hanno confermato o già inviato', () => {
        const sent = new Date(Date.UTC(2026, 7, 25, 8, 0, 0));
        const later = new Date(Date.UTC(2026, 7, 25, 16, 0, 0));
        const tzPrefs = { timezone: 'UTC' };
        expect(shouldEscalateConferme({
            createdAt: sent,
            now: later,
            destCount: 2,
            confermeCount: 2,
            prefs: tzPrefs,
        })).toBe(false);
        expect(shouldEscalateConferme({
            createdAt: sent,
            now: later,
            destCount: 2,
            confermeCount: 0,
            alreadyEscalated: true,
            prefs: tzPrefs,
        })).toBe(false);
    });

    it('WhatsApp assenza dopo 10 minuti utili; seen o acted stoppano', () => {
        const tzPrefs = { timezone: 'UTC', whatsappEnabled: true, whatsappWindowStart: '06:00', whatsappWindowEnd: '20:00' };
        const sent = new Date(Date.UTC(2026, 7, 25, 8, 0, 0));
        const nineMin = new Date(Date.UTC(2026, 7, 25, 8, 9, 0));
        const tenMin = new Date(Date.UTC(2026, 7, 25, 8, 10, 0));
        expect(shouldEscalateAssenzaWhatsApp({
            sentAt: sent, now: nineMin, prefs: tzPrefs,
        })).toBe(false);
        expect(shouldEscalateAssenzaWhatsApp({
            sentAt: sent, now: tenMin, prefs: tzPrefs,
        })).toBe(true);
        expect(shouldEscalateAssenzaWhatsApp({
            sentAt: sent, now: tenMin, prefs: tzPrefs, groupSeen: true,
        })).toBe(false);
        expect(normalizeNotifyPhone('3331234567')).toBe('+393331234567');
        expect(zonedGiornoKey(new Date(Date.UTC(2026, 7, 25, 22, 0, 0)), 'UTC')).toBe('2026-08-25');
        expect(assenzaCoversGiorno('2026-08-28', '2026-08-28', '2026-08-30')).toBe(true);
        expect(assenzaCoversGiorno('2026-08-27', '2026-08-28', '2026-08-30')).toBe(false);
    });
});

describe('notification copy', () => {
    it('accordo italiano sul digest ore', () => {
        expect(buildNotificationCopy('ore_da_validare', { count: 1 }).body).toBe(
            '1 operaio ha segnato le ore — da validare.'
        );
        expect(buildNotificationCopy('ore_da_validare', { count: 3 }).body).toBe(
            '3 operai hanno segnato le ore — da validare.'
        );
    });

    it('getNotificationEvent sconosciuto è null', () => {
        expect(getNotificationEvent('nope')).toBeNull();
        expect(resolveNotificationRecipients('nope', { destinatariIds: ['x'] })).toEqual([]);
    });
});

describe('notification prefs form', () => {
    it('rifiuta finestra invertita e timeout fuori range', () => {
        expect(validateNotificationPrefsForm({
            pushWindowStart: '21:00',
            pushWindowEnd: '05:00',
        }).ok).toBe(false);
        expect(validateNotificationPrefsForm({
            confermaTimeoutHours: 0,
        }).ok).toBe(false);
        expect(validateNotificationPrefsForm({
            confermaTimeoutHours: 48,
        }).ok).toBe(false);
        expect(validateNotificationPrefsForm({
            pushWindowStart: '05:00',
            pushWindowEnd: '21:00',
            confermaTimeoutHours: 6,
        }).ok).toBe(true);
        expect(validateNotificationPrefsForm({
            whatsappEnabled: true,
            telefono: '',
            pushWindowStart: '05:00',
            pushWindowEnd: '21:00',
        }).ok).toBe(false);
        expect(validateNotificationPrefsForm({
            whatsappEnabled: true,
            telefono: '3331234567',
            pushWindowStart: '05:00',
            pushWindowEnd: '21:00',
        }).ok).toBe(true);
    });

    it('normalizza orari e non cancella i token FCM esistenti', () => {
        const built = buildNotificationPrefsWrite(
            { pushEnabled: false, pushWindowStart: '6:00', pushWindowEnd: '20:00', confermaTimeoutHours: 4 },
            { fcmTokens: [{ token: 'abc' }] }
        );
        expect(built.ok).toBe(true);
        expect(built.prefs.pushEnabled).toBe(false);
        expect(built.prefs.pushWindowStart).toBe('06:00');
        expect(built.prefs.fcmTokens).toEqual([{ token: 'abc' }]);
    });

    it('load da user e save su users/{uid}', async () => {
        expect(loadNotificationPrefsFromUser({ notificationPrefs: { pushEnabled: false } }).pushEnabled).toBe(false);
        const calls = [];
        const result = await saveUserNotificationPrefs({
            updateDoc: async (ref, data) => { calls.push({ ref, data }); },
            doc: (db, col, id) => ({ db, col, id }),
            db: {},
            uid: 'u1',
            formValues: { pushEnabled: true, pushWindowStart: '05:00', pushWindowEnd: '21:00', confermaTimeoutHours: 6 },
            existingPrefs: { fcmTokens: [{ token: 't' }] },
        });
        expect(result.ok).toBe(true);
        expect(calls[0].ref).toEqual({ db: {}, col: 'users', id: 'u1' });
        expect(calls[0].data.notificationPrefs.fcmTokens).toEqual([{ token: 't' }]);
    });
});

describe('notification-dispatch-core', () => {
    it('rileva assegnazione, chiusura da approvare e sospeso', async () => {
        const { detectLavoroPushEvents, buildNotificationEventDocs } = await import(
            '../core/services/notification-dispatch-core.js'
        );
        expect(detectLavoroPushEvents(null, { caposquadraId: 'mario', nome: 'Potatura' }))
            .toEqual(['lavoro_assegnato']);
        expect(detectLavoroPushEvents(
            { stato: 'in_corso', caposquadraId: 'mario' },
            { stato: 'completato_da_approvare', caposquadraId: 'mario' }
        )).toEqual(['lavoro_completato_da_approvare']);
        expect(detectLavoroPushEvents(
            { stato: 'in_corso', caposquadraId: 'mario' },
            { stato: 'sospeso', caposquadraId: 'mario' }
        )).toEqual(['lavoro_sospeso']);
        expect(detectLavoroPushEvents(
            { stato: 'completato_da_approvare' },
            { stato: 'completato' }
        )).toEqual([]);

        const docs = buildNotificationEventDocs({
            eventId: 'comunicazione_destinatario',
            tenantId: 't1',
            sourceCollection: 'comunicazioni',
            sourceId: 'c1',
            actorUserId: 'mario',
            destinatariIds: ['giuseppe'],
            vars: { lavoroNome: 'Monte Olivo', mittenteNome: 'Mario', messaggio: 'Domani alle 7' },
            now: new Date(Date.UTC(2026, 7, 25, 10, 0, 0)),
            prefsByUser: { giuseppe: { timezone: 'UTC' } },
        });
        expect(docs).toHaveLength(1);
        expect(docs[0].recipientUserId).toBe('giuseppe');
        expect(docs[0].status).toBe('pending');
        expect(docs[0].deepLink).toContain('openSlide=comunicazioni');
    });

    it('manager escluso se è lui ad approvare; ore in coda con debounce', async () => {
        const { buildNotificationEventDocs } = await import('../core/services/notification-dispatch-core.js');
        const managerDocs = buildNotificationEventDocs({
            eventId: 'lavoro_completato_da_approvare',
            tenantId: 't1',
            sourceCollection: 'lavori',
            sourceId: 'L1',
            actorUserId: 'luca',
            lavoroId: 'L1',
            lavoro: { nome: 'Potatura' },
            tenantUsers: [
                { id: 'luca', ruoli: ['manager'] },
                { id: 'admin1', ruoli: ['amministratore'] },
            ],
            now: new Date(Date.UTC(2026, 7, 25, 10, 0, 0)),
            prefsByUser: { admin1: { timezone: 'UTC' } },
        });
        expect(managerDocs.map((d) => d.recipientUserId)).toEqual(['admin1']);

        const oreDocs = buildNotificationEventDocs({
            eventId: 'ore_da_validare',
            tenantId: 't1',
            sourceCollection: 'oreOperai',
            sourceId: 'o1',
            actorUserId: 'giuseppe',
            lavoro: { caposquadraId: 'mario', nome: 'Potatura' },
            now: new Date(Date.UTC(2026, 7, 25, 10, 0, 0)),
            prefsByUser: { mario: { timezone: 'UTC' } },
        });
        expect(oreDocs).toHaveLength(1);
        expect(oreDocs[0].status).toBe('queued');
        expect(oreDocs[0].coalesceKey).toContain('ore_da_validare:mario:');
    });

    it('assenza oggi crea eventi capo+manager; ferie future no; WA-only skip FCM', async () => {
        const { detectAssenzaLifecycle, shouldNotifyAssenzaTurno, buildNotificationEventDocs } = await import(
            '../core/services/notification-dispatch-core.js'
        );
        const today = new Date(Date.UTC(2026, 7, 28, 10, 0, 0));
        expect(shouldNotifyAssenzaTurno({
            stato: 'segnalata',
            dataInizioGiorno: '2026-08-28',
            dataFineGiorno: '2026-08-28',
        }, today, 'UTC')).toBe(true);
        expect(shouldNotifyAssenzaTurno({
            stato: 'confermata',
            dataInizioGiorno: '2026-09-10',
            dataFineGiorno: '2026-09-20',
        }, today, 'UTC')).toBe(false);
        expect(detectAssenzaLifecycle(null, {
            stato: 'segnalata',
            dataInizioGiorno: '2026-08-28',
            dataFineGiorno: '2026-08-28',
        }, today).notify).toBe(true);
        expect(detectAssenzaLifecycle(null, {
            stato: 'confermata',
            dataInizioGiorno: '2026-09-10',
            dataFineGiorno: '2026-09-20',
        }, today).notify).toBe(false);
        expect(detectAssenzaLifecycle(
            { stato: 'segnalata' },
            { stato: 'segnalata', sostitutoOperaioId: 'x' },
            today
        ).closeStatus).toBe('acted');

        const docs = buildNotificationEventDocs({
            eventId: 'assenza_turno',
            tenantId: 't1',
            sourceCollection: 'assenzeOperai',
            sourceId: 'a1',
            actorUserId: 'mario',
            lavoro: { caposquadraId: 'mario', nome: 'Potatura' },
            operaioId: 'giuseppe',
            tenantUsers: [
                { id: 'luca', ruoli: ['manager'] },
                { id: 'mario', ruoli: ['caposquadra'] },
            ],
            vars: { lavoroNome: 'Potatura', operaioNome: 'Giuseppe', dataGiorno: '2026-08-28' },
            now: today,
            prefsByUser: {
                luca: { timezone: 'UTC', assenzaPushEnabled: false, whatsappEnabled: true },
            },
        });
        expect(docs.map((d) => d.recipientUserId)).toEqual(['luca']);
        expect(docs[0].skipFcm).toBe(true);
        expect(docs[0].waStatus).toBe('pending');
        expect(docs[0].title).toContain('Assenza oggi');
        expect(docs[0].deepLink).toContain('assenzaId=a1');
        expect(resolveNotificationDelivery('assenza_turno', {
            assenzaPushEnabled: false,
            whatsappEnabled: false,
        }, today).status).toBe('suppressed');
    });
});
