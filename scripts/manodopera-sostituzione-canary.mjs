#!/usr/bin/env node
/**
 * Canary flusso sostituzione manodopera completo (capo + manager + operaio sostituto).
 *
 * Copre:
 *  1) Capo (field-workspace): segnala assenza
 *  2) Manager (Gestione lavori): conferma + standby
 *  3) Manager: shortlist (assenti esclusi) + assegna sostituto
 *  4) Operaio sostituto: segna ore sul lavoro
 *  5) Capo: valida ore + zona + invia completato_da_approvare
 *  6) Manager: approva → stato completato
 *
 * Prerequisiti:
 *   npm run sim:emulators   # terminale 1
 *   npm start               # terminale 2 (http://127.0.0.1:8000)
 *   npm run sim:run -- --template=viticola-conto-terzi-manodopera
 *
 * Uso:
 *   node scripts/manodopera-sostituzione-canary.mjs
 *   npm run manodopera:sostituzione-canary
 *   --keep  lascia lo stato senza cleanup finale
 */
import { chromium } from 'playwright-core';
import {
  loginAsCapoFromDevPage,
  loginAsManagerManodopera,
  pickManifestEntry,
  waitForFieldWorkspaceLoaded,
  FIELD_WORKSPACE_PATH,
  SIM_DEV_PATH
} from '../tests/e2e/sim/helpers/sim-login.js';

const LOGIN_OPTS = {
  templateIncludes: 'manodopera',
  preferTemplateId: 'viticola-conto-terzi-manodopera',
  preferSeedComplete: true,
  excludeRegimeMax: true,
  requirePersonas: true
};

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BASE = process.env.GFV_E2E_BASE_URL || 'http://127.0.0.1:8000';
const MARKER = `CANARY-SOST-${Date.now()}`;
const KEEP = process.argv.includes('--keep');

const results = [];
function pass(id, detail) {
  results.push({ id, ok: true, detail });
  console.log(`  PASS  ${id}: ${detail}`);
}
function fail(id, detail) {
  results.push({ id, ok: false, detail });
  console.log(`  FAIL  ${id}: ${detail}`);
}
function info(msg) {
  console.log(`  INFO  ${msg}`);
}

async function withBrowser(fn) {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    return await fn(browser);
  } finally {
    await browser.close();
  }
}

async function newEmulatorPage(browser) {
  const context = await browser.newContext({ baseURL: BASE });
  await context.addInitScript(() => {
    try {
      localStorage.setItem('gfv_firebase_emulator', '1');
    } catch (_) {
      /* ignore */
    }
  });
  return context.newPage();
}

/**
 * Capo: UI segnala assenza su un operaio della squadra + lavoro selezionato.
 */
async function runCapoSegnalaAssenza(browser) {
  const page = await newEmulatorPage(browser);
  try {
    await loginAsCapoFromDevPage(page, LOGIN_OPTS);

    await page.goto(`${FIELD_WORKSPACE_PATH}`);
    await page.waitForSelector('#inline-segnala-assenza-section:not([hidden])', {
      timeout: 60_000
    });
    pass('capo:ui-assenza', 'Sezione «Segnala assenza» visibile');

    const prep = await page.evaluate(async () => {
      const workSel = document.getElementById('selected-work');
      const opSel = document.getElementById('assenza-segnala-operaio');
      if (!workSel || !opSel) {
        return { ok: false, reason: 'select mancanti' };
      }

      // Attendi popolamento squadra / lavori
      for (let i = 0; i < 40; i++) {
        const workOpts = Array.from(workSel.options).filter((o) => o.value);
        const opOpts = Array.from(opSel.options).filter((o) => o.value);
        if (workOpts.length && opOpts.length) {
          workSel.value = workOpts[0].value;
          workSel.dispatchEvent(new Event('change', { bubbles: true }));
          return {
            ok: true,
            lavoroId: workOpts[0].value,
            lavoroLabel: workOpts[0].textContent?.trim() || '',
            operaioId: opOpts[0].value,
            operaioLabel: opOpts[0].textContent?.trim() || '',
            operaiCount: opOpts.length
          };
        }
        await new Promise((r) => setTimeout(r, 250));
      }
      return {
        ok: false,
        reason: 'timeout popolamento',
        works: Array.from(workSel.options).filter((o) => o.value).length,
        operai: Array.from(opSel.options).filter((o) => o.value).length
      };
    });

    if (!prep.ok) {
      fail('capo:prep', JSON.stringify(prep));
      return null;
    }
    info(
      `capo target lavoro=${prep.lavoroId} (${prep.lavoroLabel}) operaio=${prep.operaioId} (${prep.operaioLabel})`
    );

    await page.selectOption('#assenza-segnala-operaio', prep.operaioId);
    await page.selectOption('#assenza-segnala-tipo', 'malattia');
    await page.fill('#assenza-segnala-nota', MARKER);
    // giorno già default oggi
    await page.click('#segnala-assenza-form button[type="submit"]');

    await page.waitForFunction(
      () => {
        const s = document.getElementById('assenza-segnala-status');
        return s && /inviata|Errore|errore/i.test(s.textContent || '');
      },
      { timeout: 30_000 }
    );

    const status = ((await page.locator('#assenza-segnala-status').textContent()) || '').trim();
    if (/inviata/i.test(status)) {
      pass('capo:segnala', status);
    } else {
      fail('capo:segnala', status || 'nessun feedback');
      return null;
    }

    return {
      lavoroId: prep.lavoroId,
      operaioId: prep.operaioId,
      marker: MARKER
    };
  } finally {
    await page.context().close();
  }
}

/**
 * Manager: conferma standby + shortlist + assegna (servizi in-page, stessa auth manager).
 */
async function runManagerFlusso(browser, capoPayload) {
  const page = await newEmulatorPage(browser);
  try {
    await loginAsManagerManodopera(page, LOGIN_OPTS);

    await page.goto('/core/admin/gestione-lavori-standalone.html?emulator=1');
    await page.waitForFunction(() => {
      const c = document.getElementById('lavori-container');
      return c && !c.querySelector('.loading') && window.lavoriState?.lavoriList;
    }, { timeout: 90_000 });

    const report = await page.evaluate(async ({ lavoroId, operaioId, marker, keep }) => {
      const out = {
        steps: [],
        assenzaId: null,
        shortlistLen: 0,
        shortlistAssentiLeak: false,
        assegnato: false,
        lavoroFinale: null,
        cleanup: null,
        error: null
      };

      try {
        const {
          listAssenzeSegnalate,
          getAssenza
        } = await import('/core/services/manodopera-assenze-service.js');
        const { confermaSegnalazioneEStandby } =
          await import('/core/services/lavoro-standby-assenza-service.js');
        const { buildShortlistSostitutiPerLavoroStandby } =
          await import('/core/services/manodopera-sostituti-shortlist-service.js');
        const { assegnaSostitutoDaStandby } =
          await import('/core/services/lavoro-sostituzione-assenza-service.js');
        const { getLavoro } = await import('/core/services/lavori-service.js');
        const { saveProfiloManodoperaSkillDichiarate } =
          await import('/core/services/profilo-manodopera-service.js');
        const { resolveRequiredSkillsForLavoro } =
          await import('/core/config/manodopera-skills-config.js');
        const { getAuthInstance } = await import('/core/services/firebase-service.js');

        const managerId = getAuthInstance()?.currentUser?.uid;
        if (!managerId) throw new Error('managerId assente (auth)');

        const segnalate = await listAssenzeSegnalate();
        const hit =
          segnalate.find(
            (a) =>
              a.operaioId === operaioId &&
              (a.nota || '').includes(marker) &&
              (!a.lavoroId || a.lavoroId === lavoroId)
          ) ||
          segnalate.find((a) => (a.nota || '').includes(marker)) ||
          segnalate.find((a) => a.operaioId === operaioId && a.lavoroId === lavoroId);

        if (!hit) {
          throw new Error(
            `Assenza segnalata non trovata (marker=${marker}, operaio=${operaioId}, lavoro=${lavoroId}). Trovate=${segnalate.length}`
          );
        }
        out.assenzaId = hit.id;
        out.steps.push(`assenza_segnalata:${hit.id}`);

        // Banner UI
        const banner = document.getElementById('assenze-segnalate-banner');
        out.bannerVisible = banner && !banner.hidden;

        let lavoro = await getLavoro(lavoroId);
        if (!lavoro) throw new Error(`Lavoro ${lavoroId} non trovato`);

        // Se già standby da run precedente, ripristina leggero
        if (lavoro.stato === 'in_standby' && lavoro.standbyAssenzaId !== hit.id) {
          out.steps.push(`lavoro_gia_standby:${lavoro.stato}`);
        }

        if (lavoro.stato !== 'in_standby') {
          await confermaSegnalazioneEStandby({
            assenzaId: hit.id,
            lavoroId,
            managerId
          });
          out.steps.push('standby_ok');
        } else {
          out.steps.push('standby_gia_presente');
        }

        lavoro = await getLavoro(lavoroId);
        if (lavoro.stato !== 'in_standby') {
          throw new Error(`Atteso in_standby, got ${lavoro.stato}`);
        }
        out.steps.push(`standby_verificato:${lavoro.standbyOperaioId}`);

        const operaiList = window.lavoriState?.operaiList || [];
        const squadreList = window.lavoriState?.squadreList || [];
        const attrezziList = window.lavoriState?.attrezziList || [];

        let shortlistResult = await buildShortlistSostitutiPerLavoroStandby({
          lavoroId,
          operaiList,
          squadreList,
          attrezziList
        });
        out.shortlistLen = shortlistResult.shortlist?.length || 0;
        out.tuttiQualificati = shortlistResult.tuttiQualificati;
        out.equipaggioCheck = shortlistResult.equipaggioCheck || null;
        out.steps.push(`shortlist:${out.shortlistLen}/${out.tuttiQualificati}`);

        // Leak check: nessuno della shortlist deve essere l'assente
        if (shortlistResult.shortlist?.some((c) => c.operaioId === operaioId)) {
          out.shortlistAssentiLeak = true;
          throw new Error('Assente presente in shortlist');
        }

        // Se nessuno qualificato, boost skill minime su un operaio libero (non assente)
        if (!shortlistResult.shortlist?.length) {
          const req = resolveRequiredSkillsForLavoro({
            tipoLavoroNome: lavoro.tipoLavoro,
            sottocategoriaCodice: lavoro.sottocategoriaCodice,
            categoriaCodice: lavoro.categoriaCodice,
            attrezzo:
              attrezziList.find((a) => a.id === lavoro.attrezzoId) || lavoro.attrezzo || null,
            macchinaId: lavoro.macchinaId
          });
          const skillIds = req.skillIds?.length ? req.skillIds : ['altro'];
          const candidate = operaiList.find((o) => {
            const id = o.id || o.uid;
            return id && id !== operaioId;
          });
          if (!candidate) throw new Error('Nessun operaio candidato per boost skill');
          const cid = candidate.id || candidate.uid;
          await saveProfiloManodoperaSkillDichiarate(cid, {
            skillDichiarate: skillIds,
            notaProfilo: marker,
            aggiornatoDa: managerId
          });
          out.steps.push(`boost_skill:${cid}:${skillIds.join(',')}`);
          shortlistResult = await buildShortlistSostitutiPerLavoroStandby({
            lavoroId,
            operaiList,
            squadreList,
            attrezziList
          });
          out.shortlistLen = shortlistResult.shortlist?.length || 0;
          out.steps.push(`shortlist_after_boost:${out.shortlistLen}`);
        }

        if (!shortlistResult.shortlist?.length) {
          throw new Error('Shortlist vuota anche dopo boost skill');
        }

        // Preferisci libero, poi spostabile
        const pick =
          shortlistResult.shortlist.find((c) => c.disponibilita === 'libero') ||
          shortlistResult.shortlist.find((c) => c.disponibilita === 'spostabile') ||
          shortlistResult.shortlist[0];

        out.pick = {
          operaioId: pick.operaioId,
          nome: pick.nome,
          disponibilita: pick.disponibilita,
          impegnoLavoroId: pick.impegnoLavoroId || null
        };

        const assignRes = await assegnaSostitutoDaStandby({
          lavoroId,
          sostitutoOperaioId: pick.operaioId,
          managerId,
          confermaSpostamento: Boolean(pick.impegnoLavoroId),
          impegnoLavoroId: pick.impegnoLavoroId || null
        });
        out.assegnato = true;
        out.assignRes = assignRes;
        out.steps.push(
          `assegnato:${pick.operaioId}:doppio=${assignRes.doppioMovimento}:squadra=${assignRes.isLavoroSquadra}`
        );

        const finale = await getLavoro(lavoroId);
        out.lavoroFinale = {
          stato: finale.stato,
          operaioId: finale.operaioId || null,
          assenzaSostitutoOperaioId: finale.assenzaSostitutoOperaioId || null,
          assenzaOperaioAssenteId: finale.assenzaOperaioAssenteId || null,
          hasEquipaggioGiorno: Boolean(
            finale.equipaggioGiorno && Object.keys(finale.equipaggioGiorno).length
          )
        };

        if (finale.stato === 'in_standby') {
          throw new Error('Lavoro ancora in_standby dopo assegnazione');
        }
        if (finale.assenzaSostitutoOperaioId !== pick.operaioId) {
          throw new Error('assenzaSostitutoOperaioId non allineato');
        }

        const assenzaAfter = await getAssenza(hit.id);
        out.assenzaSostitutoSuDoc = assenzaAfter?.sostitutoOperaioId || null;

        // Cleanup rinviato a fine ciclo completo (ore → chiusura → approvazione)
        out.cleanup = keep ? 'kept' : 'deferred_full_cycle';
      } catch (e) {
        out.error = e.message || String(e);
      }
      return out;
    }, { ...capoPayload, keep: KEEP });

    if (report.error) {
      fail('manager:flow', report.error);
      info(`steps=${JSON.stringify(report.steps)}`);
      return report;
    }

    if (report.bannerVisible) pass('manager:banner', 'Banner assenze segnalate visibile');
    else info('manager:banner non visibile (refresh opzionale)');

    pass('manager:standby', report.steps.filter((s) => s.startsWith('standby')).join(',') || 'ok');
    pass(
      'manager:shortlist',
      `${report.shortlistLen} candidati (qualificati=${report.tuttiQualificati})`
    );
    if (report.shortlistAssentiLeak) fail('manager:no-assente', 'leak assente in shortlist');
    else pass('manager:no-assente', 'assente escluso dalla shortlist');

    if (report.assegnato) {
      pass(
        'manager:assegna',
        `${report.pick?.nome || report.pick?.operaioId} (${report.pick?.disponibilita}) → stato=${report.lavoroFinale?.stato}`
      );
    } else {
      fail('manager:assegna', 'non assegnato');
    }

    if (report.lavoroFinale?.hasEquipaggioGiorno) {
      pass('manager:equipaggioGiorno', 'slice giornaliero scritto');
    } else {
      fail('manager:equipaggioGiorno', 'equipaggioGiorno non persistito (modello Lavoro?)');
    }

    info(`finale=${JSON.stringify(report.lavoroFinale)}`);
    info(`cleanup=${report.cleanup}`);
    return report;
  } finally {
    await page.context().close();
  }
}

/**
 * Login operaio specifico (sostituto) dalla card personas del manifest.
 */
async function loginAsOperaioByUserId(page, userId) {
  await page.goto(SIM_DEV_PATH);
  const entry = await pickManifestEntry(page, LOGIN_OPTS);
  const persona = (entry.personas || []).find(
    (p) =>
      p.userId === userId &&
      Array.isArray(p.ruoli) &&
      p.ruoli.includes('operaio')
  );
  if (!persona) {
    throw new Error(`Persona operaio ${userId} non in manifest (${entry.tenantId})`);
  }
  const card = page.locator('.card').filter({ hasText: entry.tenantId });
  const label = persona.displayName || persona.email || '';
  const btn = card.getByRole('button', {
    name: new RegExp(`Operaio \\(mobile\\).*${escapeRegExp(label)}`, 'i')
  });
  if ((await btn.count()) === 0) {
    // fallback: match solo cognome/prima parola
    const token = String(label).trim().split(/\s+/)[0];
    const btn2 = card.getByRole('button', {
      name: new RegExp(`Operaio \\(mobile\\).*${escapeRegExp(token)}`, 'i')
    });
    await Promise.all([
      page.waitForURL(/field-workspace-standalone\.html/, { timeout: 90_000 }),
      btn2.first().click()
    ]);
  } else {
    await Promise.all([
      page.waitForURL(/field-workspace-standalone\.html/, { timeout: 90_000 }),
      btn.first().click()
    ]);
  }
  await waitForFieldWorkspaceLoaded(page);
  return { entry, persona };
}

/**
 * Operaio sostituto: segna ore sul lavoro (stesso payload del field-workspace).
 */
async function runOperaioSegnaOre(browser, ctx) {
  const page = await newEmulatorPage(browser);
  try {
    await loginAsOperaioByUserId(page, ctx.sostitutoOperaioId);
    // già su field-workspace dopo login — attendi auth/tenant pronti
    await page.waitForFunction(() => {
      try {
        return !!(window.firebaseAuth?.currentUser?.uid || window.currentUser?.uid);
      } catch (_) {
        return false;
      }
    }, { timeout: 60_000 }).catch(() => null);

    const report = await page.evaluate(
      async ({ lavoroId, marker, expectedUid }) => {
        const out = { oraId: null, uid: null, error: null };
        try {
          const {
            getAuthInstance,
            getDb,
            collection,
            addDoc,
            Timestamp,
            serverTimestamp
          } = await import('/core/services/firebase-service.js');
          const { getCurrentTenantId } = await import('/core/services/tenant-service.js');

          let uid = null;
          for (let i = 0; i < 50; i++) {
            uid = getAuthInstance()?.currentUser?.uid || window.currentUser?.uid || null;
            if (uid) break;
            await new Promise((r) => setTimeout(r, 200));
          }
          out.uid = uid;
          if (!uid) throw new Error('auth operaio assente');
          if (expectedUid && uid !== expectedUid) {
            throw new Error(`login operaio errato: ${uid} ≠ ${expectedUid}`);
          }

          let tenantId = getCurrentTenantId();
          for (let i = 0; i < 30 && !tenantId; i++) {
            await new Promise((r) => setTimeout(r, 200));
            tenantId = getCurrentTenantId();
          }
          if (!tenantId) throw new Error('tenant operaio assente');

          const today = new Date();
          today.setHours(12, 0, 0, 0);
          const oraData = {
            operaioId: uid,
            lavoroId,
            terrenoId: null,
            data: Timestamp.fromDate(today),
            orarioInizio: '07:30',
            orarioFine: '12:00',
            pauseMinuti: 30,
            oreNette: 4,
            note: marker,
            stato: 'da_validare',
            creatoIl: serverTimestamp(),
            source: 'canary_sostituzione'
          };
          const ref = await addDoc(
            collection(getDb(), `tenants/${tenantId}/lavori/${lavoroId}/oreOperai`),
            oraData
          );
          out.oraId = ref.id;
        } catch (e) {
          out.error = e.message || String(e);
        }
        return out;
      },
      {
        lavoroId: ctx.lavoroId,
        marker: ctx.marker,
        expectedUid: ctx.sostitutoOperaioId
      }
    );

    if (report.error) {
      fail('operaio:segna-ore', report.error);
      return null;
    }
    pass('operaio:segna-ore', `oraId=${report.oraId} uid=${report.uid}`);
    return { ...ctx, oraId: report.oraId };
  } finally {
    await page.context().close();
  }
}

/**
 * Capo: valida ore sostituto, scrive zona minima, invia completato_da_approvare.
 */
async function runCapoValidaEChiudi(browser, ctx) {
  const page = await newEmulatorPage(browser);
  try {
    await loginAsCapoFromDevPage(page, LOGIN_OPTS);
    // Resta sul field-workspace (auth già pronta) — stessi service/rules del flusso reale
    await page.waitForFunction(() => {
      try {
        return !!(window.firebaseAuth?.currentUser?.uid || window.currentUser?.uid);
      } catch (_) {
        return false;
      }
    }, { timeout: 60_000 }).catch(() => null);

    const report = await page.evaluate(
      async ({ lavoroId, oraId, marker }) => {
        const out = { steps: [], error: null, stato: null, uid: null };
        try {
          const {
            getAuthInstance,
            getDb,
            collection,
            addDoc,
            doc,
            getDoc,
            updateDoc,
            serverTimestamp
          } = await import('/core/services/firebase-service.js');
          const { getCurrentTenantId } = await import('/core/services/tenant-service.js');

          let uid = null;
          for (let i = 0; i < 50; i++) {
            uid = getAuthInstance()?.currentUser?.uid || window.currentUser?.uid || null;
            if (uid) break;
            await new Promise((r) => setTimeout(r, 200));
          }
          out.uid = uid;
          let tenantId = getCurrentTenantId();
          for (let i = 0; i < 30 && !tenantId; i++) {
            await new Promise((r) => setTimeout(r, 200));
            tenantId = getCurrentTenantId();
          }
          if (!uid || !tenantId) throw new Error('auth/tenant capo assente');

          const db = getDb();
          const lavoroRef = doc(db, 'tenants', tenantId, 'lavori', lavoroId);
          const lavoroSnap = await getDoc(lavoroRef);
          if (!lavoroSnap.exists()) throw new Error('lavoro non trovato');
          const lavoro = lavoroSnap.data();
          if (lavoro.caposquadraId !== uid) {
            throw new Error(`capo non assegnato a questo lavoro (${lavoro.caposquadraId}≠${uid})`);
          }

          // Validazione ora (stesso update di ore-service.validaOra; evita getCurrentUserData del service)
          const oraRef = doc(db, 'tenants', tenantId, 'lavori', lavoroId, 'oreOperai', oraId);
          const oraSnap = await getDoc(oraRef);
          if (!oraSnap.exists()) throw new Error('ora non trovata');
          if (oraSnap.data().stato !== 'da_validare') {
            throw new Error(`ora stato=${oraSnap.data().stato}, atteso da_validare`);
          }
          await updateDoc(oraRef, {
            stato: 'validate',
            validatoDa: uid,
            validatoIl: serverTimestamp(),
            rifiutatoDa: null,
            motivoRifiuto: null
          });
          out.steps.push('ora_validata');

          await addDoc(collection(db, 'tenants', tenantId, 'lavori', lavoroId, 'zoneLavorate'), {
            tipo: 'poligono',
            coordinate: [
              { lat: 45.0, lng: 9.0 },
              { lat: 45.0001, lng: 9.0 },
              { lat: 45.0001, lng: 9.0001 },
              { lat: 45.0, lng: 9.0001 }
            ],
            superficieHa: 0.5,
            isChiuso: true,
            note: marker,
            caposquadraId: uid,
            creatoIl: serverTimestamp(),
            source: 'canary_sostituzione'
          });
          out.steps.push('zona_creata');

          await updateDoc(lavoroRef, {
            stato: 'completato_da_approvare',
            percentualeCompletamentoTracciata: 100,
            percentualeCompletamento: 100,
            superficieTotaleLavorata: 0.5,
            completatoDa: uid,
            completatoIl: serverTimestamp(),
            aggiornatoIl: serverTimestamp()
          });
          out.steps.push('completato_da_approvare');
          out.stato = 'completato_da_approvare';
        } catch (e) {
          out.error = e.message || String(e);
        }
        return out;
      },
      { lavoroId: ctx.lavoroId, oraId: ctx.oraId, marker: ctx.marker }
    );

    if (report.error) {
      fail('capo:valida-chiudi', report.error);
      info(`steps=${JSON.stringify(report.steps)}`);
      return null;
    }
    pass('capo:valida-ore', report.steps.includes('ora_validata') ? 'ok' : 'missing');
    pass('capo:zona', report.steps.includes('zona_creata') ? 'ok' : 'missing');
    pass('capo:chiudi', `stato=${report.stato}`);
    return { ...ctx, statoDopoCapo: report.stato };
  } finally {
    await page.context().close();
  }
}

/**
 * Manager: approva lavoro → completato.
 */
async function runManagerApprova(browser, ctx) {
  const page = await newEmulatorPage(browser);
  try {
    await loginAsManagerManodopera(page, LOGIN_OPTS);
    await page.goto('/core/admin/gestione-lavori-standalone.html?emulator=1');
    await page.waitForFunction(() => {
      const c = document.getElementById('lavori-container');
      return c && !c.querySelector('.loading') && window.lavoriState?.lavoriList;
    }, { timeout: 90_000 });

    const report = await page.evaluate(async ({ lavoroId }) => {
      const out = { stato: null, error: null };
      try {
        const { getLavoro } = await import('/core/services/lavori-service.js');
        const { getAuthInstance, getDb, doc, updateDoc, serverTimestamp } =
          await import('/core/services/firebase-service.js');
        const { getCurrentTenantId } = await import('/core/services/tenant-service.js');
        const managerId = getAuthInstance()?.currentUser?.uid;
        const tenantId = getCurrentTenantId();
        if (!managerId || !tenantId) throw new Error('manager/tenant assente');

        const lav = await getLavoro(lavoroId);
        if (!lav) throw new Error('lavoro non trovato');
        if (lav.stato !== 'completato_da_approvare') {
          throw new Error(`Atteso completato_da_approvare, got ${lav.stato}`);
        }

        // Stesso contratto di approvaLavoro (updateDoc diretto)
        await updateDoc(doc(getDb(), 'tenants', tenantId, 'lavori', lavoroId), {
          stato: 'completato',
          percentualeCompletamento: 100,
          superficieRimanente: 0,
          completamentoParziale: false,
          approvatoDa: managerId,
          approvatoIl: serverTimestamp(),
          aggiornatoIl: serverTimestamp()
        });

        const finale = await getLavoro(lavoroId);
        out.stato = finale.stato;
        if (finale.stato !== 'completato') {
          throw new Error(`Atteso completato, got ${finale.stato}`);
        }
      } catch (e) {
        out.error = e.message || String(e);
      }
      return out;
    }, { lavoroId: ctx.lavoroId });

    if (report.error) {
      fail('manager:approva', report.error);
      return null;
    }
    pass('manager:approva', `stato=${report.stato}`);
    return { ...ctx, statoFinale: report.stato };
  } finally {
    await page.context().close();
  }
}

async function main() {
  console.log('\n=== Manodopera sostituzione canary (flusso completo) ===');
  console.log(`Base: ${BASE}`);
  console.log(`Marker: ${MARKER}${KEEP ? ' (--keep)' : ''}\n`);

  // Sanity HTTP
  try {
    const res = await fetch(`${BASE}/core/dev/simulator-dev-standalone.html?emulator=1`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pass('http:server', `${BASE} raggiungibile`);
  } catch (e) {
    fail('http:server', `${e.message} — avvia npm start + sim:emulators + sim:run`);
    console.log(`\n=== FAIL (${results.filter((r) => !r.ok).length} errori) ===\n`);
    process.exit(1);
  }

  await withBrowser(async (browser) => {
    const capoPayload = await runCapoSegnalaAssenza(browser);
    if (!capoPayload) return;

    const managerReport = await runManagerFlusso(browser, capoPayload);
    if (!managerReport?.assegnato || !managerReport.pick?.operaioId) return;

    const cycleCtx = {
      lavoroId: capoPayload.lavoroId,
      operaioAssenteId: capoPayload.operaioId,
      sostitutoOperaioId: managerReport.pick.operaioId,
      marker: capoPayload.marker
    };

    const afterOre = await runOperaioSegnaOre(browser, cycleCtx);
    if (!afterOre?.oraId) return;

    const afterCapo = await runCapoValidaEChiudi(browser, afterOre);
    if (!afterCapo) return;

    await runManagerApprova(browser, afterCapo);
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== ${failed.length ? 'FAIL' : 'OK'} (${results.length} check, ${failed.length} fail) ===\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
