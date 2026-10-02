/**
 * Fase 10 — Lab trimestre: seminativo, piano vendemmia meccanica, assenze miste, carburante.
 * Gira solo se il template ha scenarioTrimestre. Non tocca i template CI.
 * @module simulator/phases/10-simulate-trimestre
 */

import { Timestamp } from 'firebase-admin/firestore';
import { generaGiorniLavorativi } from '../generators/date-calendario.js';
import { getEmulatorDb } from '../lib/emulator-context.js';
import { addTenantDocument, setTenantDocument } from '../lib/firestore-write.js';
import { isScenarioTrimestreTemplate } from '../lib/mese-aziende-calendar.js';
import { confermaAssenzaSim, segnalaAssenzaSim } from '../lib/manodopera-sim-actions.js';
import { runAsPersona } from '../lib/run-as-persona.js';
import { getSimProfile, requireSimTenantId, requireSimUserId } from '../lib/sim-context.js';

const CAMPAGNA_SCORSA = '2025/2026';
const CAMPAGNA_CORRENTE = '2026/2027';

const APPEZZAMENTI = [
  { nome: 'Campo del Grano', coltura: 'Grano', superficie: 4.2, tipoCampo: 'pianura' },
  { nome: 'Campo del Mais', coltura: 'Mais', superficie: 6.5, tipoCampo: 'pianura' },
  { nome: 'Appezzamento Girasole', coltura: 'Girasole', superficie: 3.1, tipoCampo: 'collina' },
  { nome: 'Valle della Soia', coltura: 'Soia', superficie: 2.8, tipoCampo: 'pianura' }
];

function pickInMonth(dates, month, index) {
  const list = dates.filter((d) => Number(String(d).slice(5, 7)) === month);
  const pool = list.length ? list : dates;
  return pool[Math.min(Math.max(index, 0), pool.length - 1)];
}

function euro(ore, tariffa) {
  return Math.round(ore * tariffa * 100) / 100;
}

/**
 * @param {{ trattori?: Array, attrezzi?: Array, prodotti?: Array }} assets
 * @param {{ terreniClienti?: Array } | null} contoTerzi
 */
export async function runSimulateTrimestre(assets = {}, contoTerzi = null) {
  const profile = getSimProfile();
  const template = profile?.template;
  if (!isScenarioTrimestreTemplate(template)) {
    return { counts: emptyCounts() };
  }

  const db = getEmulatorDb();
  const tenantId = requireSimTenantId();
  const userId = requireSimUserId();
  const dates = generaGiorniLavorativi(template?.quantities?.attivitaGiorniLavorativi || 66);
  const trattore = assets.trattori?.[0] || null;
  const attrezzo = assets.attrezzi?.[0] || null;

  const seminativo = await seedSeminativo(db, tenantId, {
    dates,
    trattore,
    attrezzo,
    prodotti: assets.prodotti || []
  });
  const carburante = await seedCarburante(db, tenantId, userId, dates, {
    trattori: assets.trattori || [],
    flotta: assets.flotta || []
  });
  const vm = await seedPianoVendemmia(db, tenantId, contoTerzi?.terreniClienti || []);
  const assenze = await seedAssenzeMiste(db, dates, template);

  return {
    counts: {
      ...seminativo,
      ...carburante,
      ...vm,
      ...assenze
    }
  };
}

function emptyCounts() {
  return {
    terreniSeminativo: 0,
    campagneSeminativo: 0,
    semineSeminativo: 0,
    attivitaSeminativo: 0,
    trattamentiSeminativo: 0,
    raccolteSeminativo: 0,
    movimentiCarburante: 0,
    carichiCisterna: 0,
    pieniMezzo: 0,
    terreniVmInPiano: 0,
    assenzeTrimestre: 0
  };
}

async function addAttivita(db, tenantId, payload) {
  return addTenantDocument(db, tenantId, 'attivita', payload);
}

async function seedSeminativo(db, tenantId, { dates, trattore, attrezzo, prodotti }) {
  const terreni = [];
  for (let i = 0; i < APPEZZAMENTI.length; i++) {
    const plot = APPEZZAMENTI[i];
    const lat = 45.52 + i * 0.012;
    const lng = 11.72 + i * 0.012;
    const delta = 0.0018;
    const id = await addTenantDocument(db, tenantId, 'terreni', {
      nome: plot.nome,
      superficie: plot.superficie,
      coltura: plot.coltura,
      colturaCategoria: 'seminativo',
      podere: 'Seminativo',
      tipoCampo: plot.tipoCampo,
      tipoPossesso: 'proprieta',
      clienteId: null,
      coordinate: { lat, lng },
      polygonCoords: [
        { lat: lat - delta, lng: lng - delta },
        { lat: lat - delta, lng: lng + delta },
        { lat: lat + delta, lng: lng + delta },
        { lat: lat + delta, lng: lng - delta }
      ]
    });
    terreni.push({ id, ...plot });
  }

  const byName = Object.fromEntries(terreni.map((t) => [t.nome, t]));
  const fitofarmaco = prodotti.find((p) => p.nome) || { id: null, nome: 'Rame ossicloruro' };
  const concime = prodotti[1] || fitofarmaco;

  const campagneSpec = [
    specCampagna('grano-scorsa', byName['Campo del Grano'], CAMPAGNA_SCORSA, 'Grano', 'Bologna', 'raccolto', 62, '2025-10-20', '2026-07-08'),
    specCampagna('mais-scorsa', byName['Campo del Mais'], CAMPAGNA_SCORSA, 'Mais', 'DKC6980', 'raccolto', 110, '2026-04-12', '2026-08-26'),
    specCampagna('girasole-scorsa', byName['Appezzamento Girasole'], CAMPAGNA_SCORSA, 'Girasole', 'SY Experto', 'raccolto', 28, '2026-04-02', '2026-08-18'),
    specCampagna('soia-scorsa', byName['Valle della Soia'], CAMPAGNA_SCORSA, 'Soia', 'Hiroko', 'raccolto', 32, '2026-05-08', '2026-08-28'),
    specCampagna('grano-corrente', byName['Campo del Grano'], CAMPAGNA_CORRENTE, 'Grano', 'Bologna', 'seminato', 60, '2026-10-01', '2027-07-05'),
    specCampagna('colza-corrente', byName['Appezzamento Girasole'], CAMPAGNA_CORRENTE, 'Colza', 'DK Exception', 'seminato', 35, '2026-09-16', '2027-06-20'),
    specCampagna('favino-corrente', byName['Campo del Mais'], CAMPAGNA_CORRENTE, 'Favino', 'Vesuvio', 'pianificato', 30, '2026-11-05', '2027-06-15'),
    specCampagna('orzo-corrente', byName['Valle della Soia'], CAMPAGNA_CORRENTE, 'Orzo', 'Cometa', 'pianificato', 55, '2026-10-20', '2027-06-25')
  ];

  const campagne = [];
  for (const spec of campagneSpec) {
    const id = await addTenantDocument(db, tenantId, 'seminativi', spec.payload);
    campagne.push({ id, ...spec.payload, key: spec.key });
  }
  const campagna = (key) => campagne.find((c) => c.key === key);

  const semineSpec = [
    { key: 'grano-scorsa', data: '2025-10-20', varieta: 'Bologna', dose: 180 },
    { key: 'mais-scorsa', data: '2026-04-12', varieta: 'DKC6980', dose: 22 },
    { key: 'girasole-scorsa', data: '2026-04-02', varieta: 'SY Experto', dose: 5 },
    { key: 'soia-scorsa', data: '2026-05-08', varieta: 'Hiroko', dose: 45 },
    { key: 'colza-corrente', data: pickInMonth(dates, 9, 8), varieta: 'DK Exception', dose: 4 },
    { key: 'grano-corrente', data: pickInMonth(dates, 10, 0), varieta: 'Bologna', dose: 180 }
  ];
  let semine = 0;
  for (const row of semineSpec) {
    const camp = campagna(row.key);
    if (!camp) continue;
    await addTenantDocument(db, tenantId, 'semineSeminativo', {
      campagnaId: camp.id,
      dataSemina: row.data,
      varieta: row.varieta,
      doseSeme: row.dose,
      unitaDose: 'kg/ha',
      note: `Semina simulata trimestre — ${camp.colturaNome}`,
      terrenoId: camp.terrenoId,
      campagna: camp.campagna,
      colturaId: null,
      colturaNome: camp.colturaNome
    });
    semine += 1;
  }

  const ore = 4;
  const diario = [
    diarioRow(byName['Campo del Grano'], pickInMonth(dates, 7, 2), 'Raccolta Meccanica', 'Grano'),
    diarioRow(byName['Campo del Mais'], pickInMonth(dates, 7, 6), 'Trattamento Meccanico', 'Mais'),
    diarioRow(byName['Valle della Soia'], pickInMonth(dates, 7, 10), 'Concimazione meccanica a pieno campo', 'Soia'),
    diarioRow(byName['Campo del Mais'], pickInMonth(dates, 8, 2), 'Trattamento Meccanico', 'Mais'),
    diarioRow(byName['Campo del Grano'], pickInMonth(dates, 8, 4), 'Erpicatura', 'Grano'),
    diarioRow(byName['Appezzamento Girasole'], pickInMonth(dates, 8, 8), 'Raccolta Meccanica', 'Girasole'),
    diarioRow(byName['Campo del Mais'], pickInMonth(dates, 8, 12), 'Raccolta Meccanica', 'Mais'),
    diarioRow(byName['Valle della Soia'], pickInMonth(dates, 8, 14), 'Raccolta Meccanica', 'Soia'),
    diarioRow(byName['Campo del Grano'], pickInMonth(dates, 9, 1), 'Aratura', 'Grano'),
    diarioRow(byName['Appezzamento Girasole'], pickInMonth(dates, 9, 4), 'Erpicatura', 'Colza'),
    diarioRow(byName['Appezzamento Girasole'], pickInMonth(dates, 9, 8), 'Semina Meccanica', 'Colza'),
    diarioRow(byName['Campo del Grano'], pickInMonth(dates, 9, 10), 'Concimazione meccanica a pieno campo', 'Grano'),
    diarioRow(byName['Campo del Grano'], pickInMonth(dates, 10, 0), 'Semina Meccanica', 'Grano')
  ];

  const attivitaIds = [];
  for (const row of diario) {
    const id = await addAttivita(db, tenantId, {
      data: row.data,
      terrenoId: row.terreno.id,
      terrenoNome: row.terreno.nome,
      tipoLavoro: row.tipoLavoro,
      coltura: row.coltura,
      orarioInizio: '07:30',
      orarioFine: '12:00',
      pauseMinuti: 30,
      oreNette: ore,
      note: `Seminativo trimestre — ${row.tipoLavoro}`,
      macchinaId: trattore?.id || null,
      attrezzoId: attrezzo?.id || null,
      oreMacchina: trattore ? ore : null,
      costoManodopera: euro(ore, 15),
      costoMacchine: trattore ? euro(ore, 35) : 0
    });
    attivitaIds.push({ id, ...row });
  }

  let trattamenti = 0;
  let raccolte = 0;
  for (const att of attivitaIds) {
    const camp = campagne.find((c) => (
      c.terrenoId === att.terreno.id && inCampagna(att.data, c.campagna)
    ));
    if (!camp) continue;

    if (att.tipoLavoro === 'Trattamento Meccanico' || att.tipoLavoro.startsWith('Concimazione')) {
      const prodotto = att.tipoLavoro.startsWith('Concimazione') ? concime : fitofarmaco;
      const costo = 86;
      await addTenantDocument(db, tenantId, 'trattamentiSeminativo', {
        campagnaId: camp.id,
        terrenoId: camp.terrenoId,
        lavoroId: null,
        attivitaId: att.id,
        data: att.data,
        tipoLavoro: att.tipoLavoro,
        tipoTrattamento: att.tipoLavoro.startsWith('Concimazione') ? 'fertilizzante' : 'fitosanitario',
        prodotto: prodotto.nome,
        dosaggio: 2.5,
        unitaDosaggio: 'l/ha',
        prodotti: [{
          prodottoId: prodotto.id || null,
          prodotto: prodotto.nome,
          dosaggio: 2.5,
          unitaDosaggio: 'l/ha',
          quantita: 3.5,
          costo
        }],
        superficieTrattata: att.terreno.superficie,
        superficieDaAnagrafeTerreno: true,
        giorniCarenza: att.tipoLavoro.startsWith('Concimazione') ? null : 14,
        costoProdotto: costo,
        costoManodopera: euro(ore, 15),
        costoMacchina: euro(ore, 35),
        costoTotale: costo + euro(ore, 15) + euro(ore, 35),
        note: `Completato in seed trimestre — ${att.tipoLavoro}`,
        condizioniMeteo: null,
        coperturaTerreno: 'completa',
        operatore: 'Titolare',
        magazzinoMovimentoIds: []
      });
      trattamenti += 1;
    }

    if (att.tipoLavoro === 'Raccolta Meccanica') {
      const qli = Math.round(att.terreno.superficie * (camp.resaPrevistaQliHa || 40));
      await addTenantDocument(db, tenantId, 'raccolteSeminativo', {
        campagnaId: camp.id,
        terrenoId: camp.terrenoId,
        lavoroId: null,
        attivitaId: att.id,
        data: att.data,
        tipoLavoro: att.tipoLavoro,
        varieta: camp.varieta || '',
        quantitaQli: qli,
        quantitaEttari: att.terreno.superficie,
        destinazione: camp.colturaNome === 'Grano' ? 'vendita' : 'stoccaggio',
        costoManodopera: euro(ore, 15),
        costoMacchina: euro(ore, 35),
        note: `Mietitura simulata trimestre — ${camp.colturaNome}`
      });
      raccolte += 1;
    }
  }

  return {
    terreniSeminativo: terreni.length,
    campagneSeminativo: campagne.length,
    semineSeminativo: semine,
    attivitaSeminativo: attivitaIds.length,
    trattamentiSeminativo: trattamenti,
    raccolteSeminativo: raccolte
  };
}

function specCampagna(key, terreno, campagna, colturaNome, varieta, stato, resa, semina, raccolta) {
  return {
    key,
    payload: {
      terrenoId: terreno.id,
      campagna,
      colturaId: null,
      colturaNome,
      varieta,
      superficieEttari: terreno.superficie,
      resaPrevistaQliHa: resa,
      dataSeminaPrevista: semina,
      dataRaccoltaPrevista: raccolta,
      stato,
      note: `Campagna seminativo seed trimestre ${campagna}`
    }
  };
}

function diarioRow(terreno, data, tipoLavoro, coltura) {
  return { terreno, data, tipoLavoro, coltura };
}

function inCampagna(dateIso, label) {
  const match = String(label || '').match(/(\d{4})\s*\/\s*(\d{4})/);
  if (!match) return false;
  const inizio = `${match[1]}-09-01`;
  const fine = `${match[2]}-08-31`;
  return dateIso >= inizio && dateIso <= fine;
}

async function seedCarburante(db, tenantId, userId, dates, mezzi) {
  const gasolioId = await addProdottoCarburante(db, tenantId, userId, {
    nome: 'Gasolio agricolo',
    scortaMinima: 200,
    prezzoUnitario: 1.45,
    note: 'Cisterna gasolio'
  });
  const benzinaId = await addProdottoCarburante(db, tenantId, userId, {
    nome: 'Benzina',
    scortaMinima: 40,
    prezzoUnitario: 1.72,
    note: 'Tanica benzina per la flotta leggera'
  });
  const adblueId = await addProdottoCarburante(db, tenantId, userId, {
    nome: 'AdBlue',
    scortaMinima: 50,
    prezzoUnitario: 0.65,
    note: 'Tanica AdBlue, giacenza tenuta sotto soglia'
  });

  const trattori = (mezzi.trattori || []).filter((m) => m.id);
  const flotta = (mezzi.flotta || []).filter((m) => m.id);
  const trattoreDi = (i) => trattori[i % Math.max(trattori.length, 1)] || null;
  const mezzoFlotta = (i) => flotta[i % Math.max(flotta.length, 1)] || trattoreDi(i);

  const carichi = [
    { prodottoId: gasolioId, data: dates[2] || dates[0], quantita: 900, prezzo: 1.45, note: 'Carico cisterna gasolio' },
    { prodottoId: gasolioId, data: pickInMonth(dates, 8, 1), quantita: 800, prezzo: 1.48, note: 'Carico cisterna gasolio' },
    { prodottoId: gasolioId, data: pickInMonth(dates, 9, 2), quantita: 750, prezzo: 1.42, note: 'Carico cisterna gasolio' },
    { prodottoId: benzinaId, data: pickInMonth(dates, 7, 4), quantita: 120, prezzo: 1.72, note: 'Carico benzina' },
    { prodottoId: benzinaId, data: pickInMonth(dates, 9, 6), quantita: 80, prezzo: 1.7, note: 'Carico benzina' },
    { prodottoId: adblueId, data: pickInMonth(dates, 7, 8), quantita: 90, prezzo: 0.65, note: 'Carico AdBlue' }
  ];

  const giacenza = new Map();
  let carichiCisterna = 0;
  for (const carico of carichi) {
    await addTenantDocument(db, tenantId, 'movimentiMagazzino', {
      prodottoId: carico.prodottoId,
      data: Timestamp.fromDate(new Date(`${carico.data}T09:00:00`)),
      tipo: 'entrata',
      quantita: carico.quantita,
      prezzoUnitario: carico.prezzo,
      origineCarburante: 'carico_cisterna',
      macchinaId: null,
      lavoroId: null,
      attivitaId: null,
      note: `${carico.note} — ${carico.data}`,
      userId
    });
    giacenza.set(carico.prodottoId, (giacenza.get(carico.prodottoId) || 0) + carico.quantita);
    carichiCisterna += 1;
  }

  let pieniMezzo = 0;
  for (let i = 0; i < dates.length; i += 4) {
    const mezzo = trattoreDi(i);
    if (!mezzo) break;
    const litri = 55 + (i % 5) * 8;
    await addPieno(db, tenantId, userId, {
      prodottoId: gasolioId,
      data: dates[i],
      quantita: litri,
      macchinaId: mezzo.id,
      note: `Pieno gasolio — ${mezzo.nome || 'trattore'}`
    });
    giacenza.set(gasolioId, (giacenza.get(gasolioId) || 0) - litri);
    pieniMezzo += 1;
  }

  for (let i = 2; i < dates.length; i += 10) {
    const mezzo = mezzoFlotta(i);
    if (!mezzo) break;
    const litri = 22 + (i % 3) * 4;
    await addPieno(db, tenantId, userId, {
      prodottoId: benzinaId,
      data: dates[i],
      quantita: litri,
      macchinaId: mezzo.id,
      note: `Pieno benzina — ${mezzo.nome || 'mezzo'}`
    });
    giacenza.set(benzinaId, (giacenza.get(benzinaId) || 0) - litri);
    pieniMezzo += 1;
  }

  for (let i = 6; i < dates.length; i += 8) {
    const mezzo = trattoreDi(i + 1);
    if (!mezzo) break;
    await addPieno(db, tenantId, userId, {
      prodottoId: adblueId,
      data: dates[i],
      quantita: 8,
      macchinaId: mezzo.id,
      note: `Rabbocco AdBlue — ${mezzo.nome || 'trattore'}`
    });
    giacenza.set(adblueId, (giacenza.get(adblueId) || 0) - 8);
    pieniMezzo += 1;
  }

  for (const [prodottoId, litri] of giacenza) {
    await setTenantDocument(db, tenantId, 'prodotti', prodottoId, {
      giacenza: Math.round(litri)
    }, { merge: true });
  }

  return {
    movimentiCarburante: carichiCisterna + pieniMezzo,
    carichiCisterna,
    pieniMezzo
  };
}

async function addProdottoCarburante(db, tenantId, userId, prodotto) {
  return addTenantDocument(db, tenantId, 'prodotti', {
    nome: prodotto.nome,
    categoria: 'carburante',
    unitaMisura: 'L',
    scortaMinima: prodotto.scortaMinima,
    prezzoUnitario: prodotto.prezzoUnitario,
    giacenza: 0,
    attivo: true,
    creatoDa: userId,
    note: prodotto.note
  });
}

async function addPieno(db, tenantId, userId, pieno) {
  await addTenantDocument(db, tenantId, 'movimentiMagazzino', {
    prodottoId: pieno.prodottoId,
    data: Timestamp.fromDate(new Date(`${pieno.data}T16:30:00`)),
    tipo: 'uscita',
    quantita: pieno.quantita,
    prezzoUnitario: null,
    origineCarburante: 'pieno',
    macchinaId: pieno.macchinaId,
    lavoroId: null,
    attivitaId: null,
    note: pieno.note,
    userId
  });
}

async function seedPianoVendemmia(db, tenantId, terreniClienti) {
  const vite = (terreniClienti || []).filter((t) => /vite/i.test(String(t.coltura || '')));
  const target = (vite.length ? vite : terreniClienti).slice(0, 6);
  let inPiano = 0;
  for (let i = 0; i < target.length; i++) {
    const vendemmiato = i % 3 === 0;
    await setTenantDocument(db, tenantId, 'terreni', target[i].id, {
      tipoPalo: i % 2 === 0 ? 'cemento' : 'ferro',
      sestoImpianto: { distanzaFile: 2.5, distanzaCeppo: i % 2 === 0 ? 0.9 : 1.1 },
      vendemmiaMeccanica: {
        2026: {
          inPiano: true,
          vendemmiato,
          dataVendemmia: vendemmiato ? '2026-09-18' : null,
          ettariEsclusi: vendemmiato ? 0.15 : 0,
          lavoroId: null,
          preventivoId: null
        }
      }
    }, { merge: true });
    inPiano += 1;
  }
  return { terreniVmInPiano: inPiano };
}

async function seedAssenzeMiste(db, dates, template) {
  if (template?.manodopera?.assenzeTrimestre === false) return { assenzeTrimestre: 0 };
  const personas = getSimProfile()?.personasFull;
  const capo = personas?.caposquadra?.[0];
  const operai = personas?.operai || [];
  if (!capo || operai.length < 3) return { assenzeTrimestre: 0 };

  const piano = [
    { tipo: 'ferie', index: 12, confirm: true, nota: 'Ferie concordate a agosto' },
    { tipo: 'permesso', index: 20, confirm: true, nota: 'Permesso per visita' },
    { tipo: 'infortunio', index: 28, confirm: true, nota: 'Distorsione lieve in campo' },
    { tipo: 'non_presenza', index: 36, confirm: true, nota: 'Giustificato in sede' },
    { tipo: 'ingiustificata', index: 44, confirm: false, nota: 'Non presentato al ritrovo' },
    { tipo: 'altro', index: 52, confirm: false, nota: 'Da chiarire con il capo' }
  ];

  let count = 0;
  for (let i = 0; i < piano.length; i++) {
    const row = piano[i];
    const operaio = operai[(i + 2) % operai.length];
    const giorno = dates[Math.min(row.index, dates.length - 1)];
    const assenzaId = await runAsPersona(capo, () => segnalaAssenzaSim(db, {
      operaioId: operaio.id,
      tipo: row.tipo,
      dataGiorno: giorno,
      nota: row.nota,
      lavoroId: null
    }));
    if (row.confirm && personas.manager) {
      await runAsPersona(personas.manager, () => confermaAssenzaSim(db, assenzaId));
    }
    count += 1;
  }
  return { assenzeTrimestre: count };
}
