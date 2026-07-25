/**
 * Seed lab sostituzioni manodopera — scenari multi-azienda per prove manuali.
 * Attivato solo se template.manodopera.scenarioLab è valorizzato.
 *
 * @module simulator/lib/manodopera-sostituzioni-lab
 */

import { FieldValue } from 'firebase-admin/firestore';
import { addTenantDocument } from './firestore-write.js';
import { runAsPersona } from './run-as-persona.js';
import { requireSimTenantId } from './sim-context.js';
import {
  segnalaAssenzaSim,
  mettiLavoroStandbyAssenzaSim,
  assegnaSostitutoAssenzaSim
} from './manodopera-sim-actions.js';

/** Attrezzi speciali con minimo equipaggio (oltre i generici). */
export const ATTREZZI_SPECIALI_LAB = Object.freeze([
  {
    key: 'carro',
    nome: 'Carro raccolta frutta lab',
    marca: 'GFV Sim',
    codiceCategoria: 'raccolta',
    minPersoneEquipaggio: 4,
    skillTags: ['carro_raccolta'],
    tipoMacchina: 'attrezzo',
    stato: 'disponibile'
  },
  {
    key: 'trapiantatrice',
    nome: 'Trapiantatrice lab',
    marca: 'GFV Sim',
    codiceCategoria: 'lavorazione_terreno',
    minPersoneEquipaggio: 3,
    skillTags: ['trapianto'],
    tipoMacchina: 'attrezzo',
    stato: 'disponibile'
  }
]);

/**
 * @param {object} template
 * @returns {boolean}
 */
export function isSostituzioniLabTemplate(template) {
  return Boolean(template?.manodopera?.scenarioLab);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {string} userId
 * @param {Map<string, string>} categorieMap
 * @returns {Promise<Array<{ id: string, nome: string, key: string, minPersoneEquipaggio?: number }>>}
 */
export async function seedAttrezziSpecialiLab(db, tenantId, userId, categorieMap = {}) {
  const out = [];
  for (const spec of ATTREZZI_SPECIALI_LAB) {
    const categoriaId =
      categorieMap[spec.codiceCategoria] ||
      categorieMap.lavorazione_terreno ||
      null;
    const id = await addTenantDocument(db, tenantId, 'macchine', {
      nome: spec.nome,
      tipoMacchina: 'attrezzo',
      marca: spec.marca,
      cavalliMinimiRichiesti: 60,
      categoriaId,
      categoriaFunzione: categoriaId,
      stato: spec.stato,
      minPersoneEquipaggio: spec.minPersoneEquipaggio,
      skillTags: spec.skillTags,
      creatoDa: userId,
      source: 'gfv_farm_simulator_lab'
    });
    out.push({
      id,
      nome: spec.nome,
      key: spec.key,
      minPersoneEquipaggio: spec.minPersoneEquipaggio
    });
  }
  return out;
}

/**
 * Skills dichiarate per shortlist facile/difficile.
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} tenantId
 * @param {object} personasFull
 * @param {'facile'|'difficile'|'mista'} mode
 */
export async function seedProfiliSkillLab(db, tenantId, personasFull, mode = 'mista') {
  const operai = personasFull?.operai || [];
  if (!operai.length) return { profili: 0 };

  let written = 0;
  for (let i = 0; i < operai.length; i++) {
    const op = operai[i];
    let skillDichiarate = [];
    if (mode === 'facile') {
      skillDichiarate = [
        'potatura_manuale',
        'raccolta_meccanica',
        'raccolta_manuale',
        'semina_piantagione_meccanico',
        'guida_trattore'
      ];
    } else if (mode === 'difficile') {
      // Solo 1–2 operai qualificati per carro/trapianto
      if (i === 0) skillDichiarate = ['raccolta_meccanica', 'potatura_manuale'];
      else if (i === 1) skillDichiarate = ['semina_piantagione_meccanico'];
      else skillDichiarate = ['potatura_manuale'];
    } else {
      if (i % 3 === 0) {
        skillDichiarate = ['raccolta_meccanica', 'potatura_manuale', 'guida_trattore'];
      } else if (i % 3 === 1) {
        skillDichiarate = ['potatura_manuale', 'semina_piantagione_meccanico'];
      } else {
        skillDichiarate = ['potatura_manuale'];
      }
    }

    await db.doc(`tenants/${tenantId}/profiliManodopera/${op.id}`).set(
      {
        userId: op.id,
        skillDichiarate,
        skillCalcolate: skillDichiarate.map((skillId) => ({
          skillId,
          stelle: i === 0 ? 4 : 2,
          fonte: 'sim_lab'
        })),
        aggiornatoIl: FieldValue.serverTimestamp(),
        source: 'gfv_farm_simulator_lab'
      },
      { merge: true }
    );
    written += 1;
  }
  return { profili: written };
}

/**
 * Patch lavori esistenti / crea lavori speciali lab.
 *
 * @param {object} options
 * @param {import('firebase-admin/firestore').Firestore} options.db
 * @param {string} options.tenantId
 * @param {string} options.managerId
 * @param {object} options.template
 * @param {object} options.personasFull
 * @param {Array} options.squadre
 * @param {Array} options.lavoriSquadra
 * @param {Array} options.terreni
 * @param {Array} options.trattori
 * @param {Array} options.attrezziSpeciali
 */
export async function enrichLavoriSostituzioniLab(options = {}) {
  const {
    db,
    tenantId,
    managerId,
    template,
    personasFull,
    squadre = [],
    lavoriSquadra = [],
    terreni = [],
    trattori = [],
    attrezziSpeciali = []
  } = options;

  const lab = template?.manodopera?.lab || {};
  const scenario = template?.manodopera?.scenarioLab;
  if (!scenario || !squadre.length || !terreni.length) {
    return { lavoriSpeciali: [], tags: {} };
  }

  const carro = attrezziSpeciali.find((a) => a.key === 'carro');
  const trapianto = attrezziSpeciali.find((a) => a.key === 'trapiantatrice');
  const squadra0 = squadre[0];
  const squadra1 = squadre[1] || squadra0;
  const dataInizio = new Date();
  dataInizio.setHours(8, 0, 0, 0);
  const tags = {};
  const lavoriSpeciali = [];

  const createLavoro = async (payload, tag) => {
    const id = await addTenantDocument(db, tenantId, 'lavori', {
      ...payload,
      creatoDa: managerId,
      superficieTotaleLavorata: 0,
      percentualeCompletamento: 0,
      giorniEffettivi: 0,
      source: 'gfv_farm_simulator_lab'
    });
    const row = {
      id,
      ...payload,
      squadra: squadre.find((s) => s.caposquadraId === payload.caposquadraId) || squadra0,
      labTag: tag
    };
    lavoriSpeciali.push(row);
    tags[tag] = id;
    return row;
  };

  // Soft: potatura variabile (no min equipaggio)
  if (lab.lavoriSpeciali?.includes('potatura_variabile') || scenario.includes('facile') || scenario.includes('potatura')) {
    await createLavoro(
      {
        nome: 'Potatura manuale lab (equipaggio variabile)',
        terrenoId: terreni[0].id,
        caposquadraId: squadra0.caposquadraId,
        tipoLavoro: 'Potatura',
        dataInizio,
        durataPrevista: 5,
        stato: 'assegnato',
        prioritaOperativa: 'normale',
        note: 'Lab: numero operai flessibile',
        macchinaId: trattori[0]?.id || null,
        attrezzoId: null
      },
      'potatura_variabile'
    );
  }

  // Carro raccolta min 4
  if (lab.lavoriSpeciali?.includes('carro_raccolta') || scenario.includes('carro')) {
    if (carro) {
      await createLavoro(
        {
          nome: 'Raccolta carro lab (min 4)',
          terrenoId: terreni[0].id,
          caposquadraId: squadra0.caposquadraId,
          tipoLavoro: 'Raccolta',
          dataInizio,
          durataPrevista: 3,
          stato: 'assegnato',
          prioritaOperativa: 'critico',
          note: 'Lab: equipaggio minimo 4 — carro',
          macchinaId: trattori[0]?.id || null,
          attrezzoId: carro.id
        },
        'carro_raccolta'
      );
    }
  }

  // Trapiantatrice min 3
  if (lab.lavoriSpeciali?.includes('trapiantatrice') || scenario.includes('trapianto')) {
    if (trapianto) {
      await createLavoro(
        {
          nome: 'Trapianto lab (min 3)',
          terrenoId: terreni[Math.min(1, terreni.length - 1)].id,
          caposquadraId: squadra0.caposquadraId,
          tipoLavoro: 'Semina e piantagione',
          dataInizio,
          durataPrevista: 2,
          stato: 'assegnato',
          prioritaOperativa: 'normale',
          note: 'Lab: equipaggio minimo 3 — trapiantatrice',
          macchinaId: trattori[0]?.id || null,
          attrezzoId: trapianto.id
        },
        'trapiantatrice'
      );
    }
  }

  // Secondo lavoro "scalabile" per prestito (altra squadra se esiste)
  if (lab.lavoriSpeciali?.includes('lavoro_scalabile') || scenario.includes('prestito')) {
    await createLavoro(
      {
        nome: 'Erpicatura scalabile lab (prestito)',
        terrenoId: terreni[Math.min(1, terreni.length - 1)].id,
        caposquadraId: squadra1.caposquadraId,
        tipoLavoro: 'Erpicatura',
        dataInizio,
        durataPrevista: 4,
        stato: 'in_corso',
        prioritaOperativa: 'scalabile',
        sospendibile: true,
        note: 'Lab: priorità bassa — candidato spostabile',
        macchinaId: trattori[0]?.id || null,
        attrezzoId: null
      },
      'lavoro_scalabile'
    );
  }

  // Marca lavori potatura esistenti come soft
  for (const lav of lavoriSquadra) {
    if ((lav.tipoLavoro || '').toLowerCase().includes('potatur')) {
      await db.doc(`tenants/${tenantId}/lavori/${lav.id}`).update({
        prioritaOperativa: lav.prioritaOperativa || 'normale',
        note: `${lav.note || ''} | lab soft equipaggio`.trim()
      });
    }
  }

  void personasFull;
  return { lavoriSpeciali, tags };
}

/**
 * Matrice assenze + standby + eventuali sostituzioni seed.
 *
 * @param {object} ctx — createSimContext state + extras
 * @param {object} manodopera — result fase 07 (+ lab)
 * @param {object} manodoperaCfg
 */
export async function runSostituzioniLabSeed(ctx, manodopera, manodoperaCfg) {
  const lab = manodoperaCfg.lab || {};
  const scenario = manodoperaCfg.scenarioLab;
  if (!scenario) return { counts: {} };

  const db = ctx.db;
  const tenantId = requireSimTenantId();
  const lavoriAll = [
    ...(manodopera.lavoriSquadra || []),
    ...(manodopera.lavoriSpeciali || []),
    ...(manodopera.lavoriCatena || [])
  ];
  const tags = manodopera.labTags || {};
  const giornoKey = ctx.giorni[0];
  const counts = {
    assenzeSegnalate: 0,
    assenzeConfermateStandby: 0,
    assenzeSoloSegnalate: 0,
    sostituzioniCompletate: 0,
    standbyApertiPerManuale: 0
  };

  const findLavoro = (tagOrPred) => {
    if (typeof tagOrPred === 'string' && tags[tagOrPred]) {
      return lavoriAll.find((l) => l.id === tags[tagOrPred]) || null;
    }
    if (typeof tagOrPred === 'function') return lavoriAll.find(tagOrPred) || null;
    return null;
  };

  const segnalaEStandby = async (lavoro, operaio, tipo, nota, { standby = true } = {}) => {
    const capo = lavoro.squadra?.capo;
    if (!capo || !operaio) return null;
    const assenzaId = await runAsPersona(capo, () =>
      segnalaAssenzaSim(db, {
        operaioId: operaio.id,
        tipo,
        dataGiorno: giornoKey,
        nota,
        lavoroId: lavoro.id
      })
    );
    counts.assenzeSegnalate += 1;
    if (!standby) {
      counts.assenzeSoloSegnalate += 1;
      return { assenzaId, standby: false };
    }
    await runAsPersona(ctx.manager, () =>
      mettiLavoroStandbyAssenzaSim(db, lavoro.id, assenzaId, operaio.id, giornoKey)
    );
    counts.assenzeConfermateStandby += 1;
    if (ctx.lavoriStandbyIds) ctx.lavoriStandbyIds.add(lavoro.id);
    return { assenzaId, standby: true, lavoroId: lavoro.id, operaioId: operaio.id };
  };

  // --- Scenario-specific flows ---
  if (scenario === '01-facile-potatura') {
    const lav =
      findLavoro('potatura_variabile') ||
      lavoriAll.find((l) => (l.tipoLavoro || '').includes('Potatura')) ||
      lavoriAll[0];
    const operai = lav?.squadra?.operai || [];
    if (lav && operai[1]) {
      await segnalaEStandby(
        lav,
        operai[1],
        'malattia',
        'Lab 01: malattia — shortlist facile (molti qualificati)',
        { standby: true }
      );
      counts.standbyApertiPerManuale += 1;
      ctx.lavoroStandbyId = lav.id;
    }
  }

  if (scenario === '02-carro-hard') {
    const lav = findLavoro('carro_raccolta') || lavoriAll.find((l) => (l.nome || '').includes('carro'));
    const operai = lav?.squadra?.operai || [];
    if (lav && operai[1]) {
      await segnalaEStandby(
        lav,
        operai[1],
        'infortunio',
        'Lab 02: infortunio su carro min4 — shortlist difficile',
        { standby: true }
      );
      counts.standbyApertiPerManuale += 1;
      ctx.lavoroStandbyId = lav.id;
    }
  }

  if (scenario === '03-prestito-occupati') {
    const dest =
      findLavoro('potatura_variabile') ||
      findLavoro('carro_raccolta') ||
      lavoriAll[0];
    const origine = findLavoro('lavoro_scalabile');
    const operaiDest = dest?.squadra?.operai || [];
    const operaiOrig = origine?.squadra?.operai || [];
    const assente = operaiDest[1] || operaiDest[0];
    const sostituto = operaiOrig.find((o) => o.id !== assente?.id) || operaiOrig[0];

    if (dest && assente) {
      await segnalaEStandby(
        dest,
        assente,
        'permesso',
        'Lab 03: permesso — poi prestito da lavoro scalabile',
        { standby: true }
      );
      if (sostituto && origine && lab.autoSostituzioneSpostabile !== false) {
        await runAsPersona(ctx.manager, () =>
          assegnaSostitutoAssenzaSim(db, {
            lavoroId: dest.id,
            sostitutoOperaioId: sostituto.id,
            confermaSpostamento: true,
            impegnoLavoroId: origine.id
          })
        );
        counts.sostituzioniCompletate += 1;
      } else {
        counts.standbyApertiPerManuale += 1;
        ctx.lavoroStandbyId = dest.id;
      }
    }
  }

  if (scenario === '04-assenze-miste') {
    const tipi = [
      { tipo: 'malattia', standby: true },
      { tipo: 'ferie', standby: true },
      { tipo: 'permesso', standby: false },
      { tipo: 'ingiustificata', standby: true },
      { tipo: 'non_presenza', standby: false }
    ];
    let li = 0;
    for (const row of tipi) {
      const lav = lavoriAll[li % lavoriAll.length];
      const operai = lav?.squadra?.operai || [];
      const op = operai[(li + 1) % Math.max(operai.length, 1)];
      if (!lav || !op) continue;
      const r = await segnalaEStandby(
        lav,
        op,
        row.tipo,
        `Lab 04: assenza ${row.tipo}`,
        { standby: row.standby }
      );
      if (r?.standby) {
        if (row.tipo === 'malattia' && lab.autoSostituzioneLibera) {
          const libero = operai.find((o) => o.id !== op.id);
          if (libero) {
            await runAsPersona(ctx.manager, () =>
              assegnaSostitutoAssenzaSim(db, {
                lavoroId: lav.id,
                sostitutoOperaioId: libero.id,
                confermaSpostamento: false
              })
            );
            counts.sostituzioniCompletate += 1;
          }
        } else if (row.tipo === 'ingiustificata') {
          counts.standbyApertiPerManuale += 1;
          ctx.lavoroStandbyId = lav.id;
        }
      }
      li += 1;
    }
  }

  if (scenario === '05-trapianto-e-soft') {
    const trap = findLavoro('trapiantatrice');
    const pot =
      findLavoro('potatura_variabile') ||
      lavoriAll.find((l) => (l.tipoLavoro || '').includes('Potatura'));
    const operaiT = trap?.squadra?.operai || [];
    const operaiP = pot?.squadra?.operai || [];

    if (trap && operaiT[1]) {
      await segnalaEStandby(
        trap,
        operaiT[1],
        'ferie',
        'Lab 05: ferie su trapiantatrice min3 — shortlist stretta',
        { standby: true }
      );
      counts.standbyApertiPerManuale += 1;
      ctx.lavoroStandbyId = trap.id;
    }
    if (pot && operaiP[2] && operaiP[0]) {
      await segnalaEStandby(
        pot,
        operaiP[2],
        'malattia',
        'Lab 05: malattia su potatura — sostituzione già fatta (fluida)',
        { standby: true }
      );
      await runAsPersona(ctx.manager, () =>
        assegnaSostitutoAssenzaSim(db, {
          lavoroId: pot.id,
          sostitutoOperaioId: operaiP[0].id,
          confermaSpostamento: false
        })
      );
      counts.sostituzioniCompletate += 1;
    }
  }

  void tenantId;
  return { counts, giornoKey };
}
