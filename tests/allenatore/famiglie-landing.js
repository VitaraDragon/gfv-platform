/**
 * Varianti della landing, a famiglie. L'esito atteso si calcola dalle regole
 * già decise (catalogo, ettari, sede). Non si registra l'uscita di turno().
 */
import {
  nomeTerrenoVisibile,
  normalizzaColturaCatalogo,
  numeroEttariDetto,
} from '../../landing/src/lib/tony-aiuto-account.js';

const NOMI = ['Discesa', 'Collina', 'Ponte', 'Lago', 'Ronco', 'Pozzo'];
const COLTURE = [
  { detto: 'grano', fuori: false },
  { detto: 'mais', fuori: false },
  { detto: 'orzo', fuori: false },
  { detto: 'ciliegio', fuori: false },
  { detto: 'trebbiano', fuori: false },
  { detto: 'sangiovese', fuori: false },
  { detto: 'giuggole', fuori: true },
  { detto: 'zafferano', fuori: true },
];

function iniziale(s) {
  const t = String(s || '');
  if (!t) return t;
  return t.charAt(0).toLocaleUpperCase('it') + t.slice(1);
}

const VITIGNI_PAROLA = ['trebbiano', 'sangiovese'];

/**
 * Catalogo, oppure la parola del vitigno (un nome proprio la tiene),
 * oppure la coltura detta con l'iniziale. Il vitigno diventa Vite da Vino
 * solo nel caso esplicito in cui il nome è lui stesso una coltura.
 */
export function colturaAttesa(detto, nome) {
  const k = String(detto || '').toLowerCase();
  const nomeVis = nome ? nomeTerrenoVisibile(nome) : '';
  const nomeEAncheColtura =
    !!nomeVis &&
    (normalizzaColturaCatalogo(nomeVis) != null ||
      VITIGNI_PAROLA.indexOf(String(nomeVis).toLowerCase()) >= 0);
  if (VITIGNI_PAROLA.indexOf(k) >= 0 && nomeVis && !nomeEAncheColtura) {
    return { nome: iniziale(detto), fuori: false };
  }
  const canon = normalizzaColturaCatalogo(detto);
  if (canon) return { nome: canon, fuori: false };
  if (VITIGNI_PAROLA.indexOf(k) >= 0) return { nome: 'Vite da Vino', fuori: false };
  return { nome: iniziale(detto), fuori: true };
}

function statoSede() {
  return { passo: 'sede', dati: { sede: null, poderi: [], terreni: [] } };
}

function terreniNoti(n) {
  return [
    { nome: 'Castagno', superficie: 4, coltura: 'Orzo' },
    { nome: 'Pallina', superficie: 3, coltura: 'Vite da Vino' },
    { nome: 'Trebbiano', superficie: 6, coltura: 'Vite da Vino' },
    { nome: 'Chiesetta', superficie: 4, coltura: 'Giuggole' },
    { nome: 'Salamandra', superficie: 7, coltura: 'Noce' },
  ]
    .slice(0, n)
    .map((t) => ({ ...t }));
}

function statoTerreni(n, inPiu) {
  const terreni = terreniNoti(n);
  if (inPiu) terreni.push({ ...inPiu });
  return {
    passo: 'terreni',
    dati: {
      sede: { indirizzo: 'via pergola 85', citta: 'Faenza', provincia: 'RA' },
      poderi: [{ nome: 'Castaldo' }],
      terreni,
    },
  };
}

function modelloVuoto() {
  return { testo: '', terreni: [], fatto: false };
}

function modelloSedeCitta() {
  return {
    testo: 'Non ho capito bene. Riprova con via e comune.',
    sede: null,
    poderi: [],
    terreni: [{ nome: 'Casale', superficie: 12, coltura: 'Grano' }],
    fatto: true,
  };
}

function modelloSedeGrezza(frase) {
  return {
    testo: 'Non ho capito bene. Riprova con via e comune.',
    sede: { indirizzo: frase, citta: null, cap: null, provincia: null },
    poderi: [{ nome: 'Fantasma' }],
    terreni: [{ nome: 'Fantasma', superficie: 1, coltura: 'Grano' }],
    fatto: true,
  };
}

function caso(partial) {
  return partial;
}

function famigliaNome() {
  const prefissi = [
    '',
    'si chiama ',
    'si piama ',
    'si kiama ',
    'si chama ',
    'che chiamiamo ',
    'chiamto ',
  ];
  const out = [];
  for (const prefisso of prefissi) {
    for (const nome of NOMI) {
      const detto = nome.toLowerCase();
      const domanda = prefisso + detto;
      const ripeteDomanda = /^si (chiama|piama|kiama|chama) /.test(domanda);
      out.push(
        caso({
          id: 'nome: ' + JSON.stringify(domanda),
          famiglia: 'nome',
          skip: ripeteDomanda
            ? 'nota, da decidere: il nome si salva, ma lo schermo resta «Come si chiama il terreno?»'
            : null,
          stato: () =>
            statoTerreni(1, {
              nome: null,
              superficie: 6,
              coltura: 'Vite da Vino',
              nomeChiesto: true,
            }),
          passi: [
            {
              domanda,
              modello: {
                testo: 'Come si chiama il terreno?',
                terreni: [{ nome: null, superficie: 6, coltura: 'Vite da Vino' }],
              },
            },
          ],
          atteso: {
            nTerreni: 2,
            terreni: [{ nome: nomeTerrenoVisibile(detto), superficie: 6, coltura: 'Vite da Vino' }],
            passo: 'terreni',
            testo: new RegExp(nome, 'i'),
            apriRiepilogo: false,
            voceUguale: true,
          },
        })
      );
    }
  }
  return out;
}

function famigliaEttari() {
  const cifre = ['7', '7,5', '7.5', '4', '10'];
  const unita = ['', ' ha', ' ettari', ' etari'];
  const prefissi = ['', 'sono ', 'ho '];
  const parole = ['sette', 'sei', 'tre', 'dieci', 'otto'];
  const frasi = [];
  for (const p of prefissi) {
    for (const c of cifre) {
      for (const u of unita) frasi.push(p + c + u);
    }
  }
  for (const p of ['', 'sono ']) {
    for (const parola of parole) {
      for (const u of ['', ' ettari', ' etari']) frasi.push(p + parola + u);
    }
  }
  frasi.push('mezzo ettaro');
  const out = [];
  for (const domanda of frasi) {
    const daHelper = numeroEttariDetto(domanda, { inAttesaEttari: true });
    const mezzo = /^mezzo ettaro$/i.test(domanda.trim());
    const superficie = mezzo ? 0.5 : daHelper;
    out.push(
      caso({
        id: 'ettari: ' + JSON.stringify(domanda),
        famiglia: 'ettari',
        skip: mezzo
          ? 'nota, da decidere: «mezzo ettaro» non entra in numeroEttariDetto, il terreno resta senza superficie'
          : null,
        stato: () =>
          statoTerreni(1, { nome: 'Melograno', superficie: null, coltura: 'Melograno' }),
        passi: [
          {
            domanda,
            modello: {
              testo: '',
              terreni: [{ nome: 'Melograno', superficie: null, coltura: 'Melograno' }],
            },
          },
        ],
        atteso: {
          nTerreni: 2,
          terreni: [{ nome: 'Melograno', superficie, coltura: 'Melograno' }],
          passo: 'terreni',
          testo: /Ne hai altri/i,
          testoAssente: /limite di cinque/i,
          apriRiepilogo: false,
        },
      })
    );
  }
  return out;
}

function famigliaColtura() {
  const modelliFrase = [
    (nome, ha, coltura) => ha + ' ha di ' + coltura + ' che si chiama ' + nome,
    (nome, ha, coltura) => nome + ' ' + ha + ' ha di ' + coltura,
    (nome, ha, coltura) => nome + ' sono ' + ha + ' ha di ' + coltura,
  ];
  const nomi = ['discesa', 'chiesetta'];
  const ettari = [3, 4];
  const out = [];
  for (const fraseDi of modelliFrase) {
    for (const nome of nomi) {
      for (const ha of ettari) {
        for (const c of COLTURE) {
          const domanda = fraseDi(nome, ha, c.detto);
          const col = colturaAttesa(c.detto, nome);
          out.push(
            caso({
              id: 'coltura: ' + domanda,
              famiglia: 'coltura',
              stato: () => statoTerreni(1),
              passi: [{ domanda, modello: modelloVuoto() }],
              atteso: {
                nTerreni: 2,
                terreni: [
                  {
                    nome: nomeTerrenoVisibile(nome),
                    superficie: ha,
                    coltura: col.nome,
                  },
                ],
                passo: 'terreni',
                testo: new RegExp(nomeTerrenoVisibile(nome), 'i'),
                testoAssente: /ecco la tua azienda/i,
                apriRiepilogo: false,
                colturaNonTrovata: col.fuori,
              },
            })
          );
        }
      }
    }
  }
  out.push(
    caso({
      id: 'coltura: nome uguale, si salva la coltura detta',
      famiglia: 'coltura',
      stato: () => statoTerreni(1),
      passi: [
        {
          domanda: 'ciliegio sono 7 ha di trebbiano',
          modello: {
            testo: '',
            terreni: [{ nome: 'Ciliegio', superficie: 7, coltura: 'Ciliegio' }],
          },
        },
      ],
      atteso: {
        nTerreni: 2,
        terreni: [{ nome: 'Ciliegio', superficie: 7, coltura: 'Vite da Vino' }],
        passo: 'terreni',
        apriRiepilogo: false,
        voceUguale: true,
        colturaNonTrovata: false,
      },
    })
  );
  return out;
}

function famigliaSede() {
  const vie = ['via Roma', 'viale Carducci', 'corso Mazzini'];
  const comuni = ['Faenza', 'Brisighella'];
  const out = [];
  for (const via of vie) {
    for (const comune of comuni) {
      for (const sep of [', ', ' a ']) {
        for (const civico of ['', '12']) {
          const frase = civico ? via + ' ' + civico + sep + comune : via + sep + comune;
          const indirizzo = civico ? via + ' ' + civico : via;
          out.push(
            caso({
              id: 'sede: ' + frase,
              famiglia: 'sede',
              stato: statoSede,
              passi: [{ domanda: frase, modello: modelloSedeGrezza(frase) }],
              atteso: {
                nTerreni: 0,
                nPoderi: 0,
                sede: { indirizzo, citta: comune },
                passo: civico ? 'poderi' : 'sede',
                testo: civico ? /poder/i : /numero civico/i,
                testoAssente: civico ? /numero civico/i : null,
                apriRiepilogo: false,
                voceUguale: true,
              },
            })
          );
          if (!civico) {
            out.push(
              caso({
                id: 'sede: ' + frase + ' + 12',
                famiglia: 'sede',
                stato: statoSede,
                passi: [
                  { domanda: frase, modello: modelloSedeGrezza(frase) },
                  {
                    domanda: '12',
                    modello: {
                      testo: 'Ok.',
                      sede: { indirizzo: '12', citta: null },
                      terreni: [{ nome: 'Dodici', superficie: 12, coltura: 'Grano' }],
                    },
                  },
                ],
                atteso: {
                  nTerreni: 0,
                  sede: { indirizzo: via + ' 12', citta: comune },
                  passo: 'poderi',
                  testo: /poder/i,
                  testoAssente: /numero civico/i,
                  apriRiepilogo: false,
                  voceUguale: true,
                },
              })
            );
          }
        }
      }
    }
  }
  const senzaVia = [
    {
      frase: 'località Casale 12',
      sede: { indirizzo: 'località Casale 12' },
      passo: 'poderi',
      civico: false,
    },
    {
      frase: 'strada Granarolo 5',
      sede: { indirizzo: 'strada Granarolo 5' },
      passo: 'poderi',
      civico: false,
    },
    {
      frase: 'podere Sasso, Brisighella',
      sede: { indirizzo: 'podere Sasso', citta: 'Brisighella' },
      passo: 'sede',
      civico: true,
    },
    {
      frase: 'Faenza',
      sede: { citta: 'Faenza', indirizzo: null },
      passo: 'sede',
      civico: true,
    },
    {
      frase: 'Brisighella',
      sede: { citta: 'Brisighella', indirizzo: null },
      passo: 'sede',
      civico: true,
    },
    {
      frase: 'Faenza, RA',
      sede: { citta: 'Faenza', provincia: 'RA', indirizzo: null },
      passo: 'sede',
      civico: true,
    },
    {
      frase: 'Faenza RA',
      sede: { citta: 'Faenza', provincia: 'RA', indirizzo: null },
      passo: 'sede',
      civico: true,
    },
  ];
  for (const r of senzaVia) {
    out.push(
      caso({
        id: 'sede senza via: ' + r.frase,
        famiglia: 'sede',
        stato: statoSede,
        passi: [{ domanda: r.frase, modello: modelloSedeCitta() }],
        atteso: {
          nTerreni: 0,
          nPoderi: 0,
          sede: r.sede,
          passo: r.passo,
          testo: r.civico ? /numero civico/i : /poder/i,
          apriRiepilogo: false,
          voceUguale: true,
        },
      })
    );
    if (r.civico && (r.sede.indirizzo == null || !/\d/.test(String(r.sede.indirizzo || '')))) {
      const via = r.sede.indirizzo;
      out.push(
        caso({
          id: 'sede senza via: ' + r.frase + ' + 12',
          famiglia: 'sede',
          stato: statoSede,
          passi: [
            { domanda: r.frase, modello: modelloSedeCitta() },
            {
              domanda: '12',
              modello: { testo: '', sede: { indirizzo: '12' }, terreni: [] },
            },
          ],
          atteso: {
            nTerreni: 0,
            sede: {
              indirizzo: via ? via + ' 12' : '12',
              citta: r.sede.citta,
              provincia: r.sede.provincia || null,
            },
            passo: 'poderi',
            testo: /poder/i,
            testoAssente: /numero civico/i,
            voceUguale: true,
          },
        })
      );
    }
  }
  out.push(
    caso({
      id: 'sede: dopo il civico, boh non lo richiede',
      famiglia: 'sede',
      stato: statoSede,
      passi: [
        { domanda: 'via Roma, Faenza', modello: modelloSedeGrezza('via Roma, Faenza') },
        {
          domanda: 'boh',
          modello: { testo: "Il numero civico, se ce l'hai, dimmelo pure.", terreni: [] },
        },
      ],
      atteso: {
        nTerreni: 0,
        sede: { indirizzo: 'via Roma', citta: 'Faenza' },
        passo: 'poderi',
        testo: /poder/i,
        testoAssente: /numero civico/i,
        voceUguale: true,
      },
    })
  );
  return out;
}

function famigliaPiuTerreni() {
  const nomi = ['discesa', 'collina', 'ponte', 'lago'];
  const colture = ['grano', 'mais', 'orzo'];
  const ettari = [3, 4];
  const out = [];
  for (let i = 0; i < nomi.length; i++) {
    for (let j = i + 1; j < nomi.length; j++) {
      for (let c = 0; c < colture.length; c++) {
        for (const ha of ettari) {
          const n1 = nomi[i];
          const n2 = nomi[j];
          const c1 = colture[c];
          const c2 = colture[(c + 1) % colture.length];
          const ha2 = ha === 3 ? 6 : 5;
          const domanda =
            n1 + ' ' + ha + ' ha di ' + c1 + ' e ' + n2 + ' ' + ha2 + ' ha di ' + c2;
          out.push(
            caso({
              id: 'piu: ' + domanda,
              famiglia: 'piuTerreni',
              stato: () => statoTerreni(1),
              passi: [{ domanda, modello: modelloVuoto() }],
              atteso: {
                nTerreni: 3,
                terreni: [
                  {
                    nome: nomeTerrenoVisibile(n1),
                    superficie: ha,
                    coltura: colturaAttesa(c1).nome,
                  },
                  {
                    nome: nomeTerrenoVisibile(n2),
                    superficie: ha2,
                    coltura: colturaAttesa(c2).nome,
                  },
                ],
                passo: 'terreni',
                testo: /Ne hai altri/i,
                apriRiepilogo: false,
                testoAssente: /limite di cinque/i,
              },
            })
          );
        }
      }
    }
  }
  return out;
}

function famigliaCorrezioni() {
  const base = () => ({
    passo: 'terreni',
    dati: {
      sede: { indirizzo: 'via pergola 85', citta: 'Faenza', provincia: 'RA' },
      poderi: [{ nome: 'Castaldo' }],
      terreni: [{ nome: 'Discesa', superficie: 3, coltura: 'Grano' }],
    },
  });
  return [
    caso({
      id: 'correzione: no, è 8 ettari',
      famiglia: 'correzioni',
      skip: 'nota, da decidere: «no, è 8 ettari» aggiunge un terreno «No» invece di aggiornare Discesa',
      stato: base,
      passi: [
        {
          domanda: 'no, è 8 ettari',
          modello: {
            testo: '',
            terreni: [{ nome: 'Discesa', superficie: 8, coltura: 'Grano' }],
          },
        },
      ],
      atteso: {
        nTerreni: 1,
        terreni: [{ nome: 'Discesa', superficie: 8, coltura: 'Grano' }],
        passo: 'terreni',
        apriRiepilogo: false,
        voceUguale: true,
      },
    }),
    caso({
      id: 'correzione: no, sono 7,5 ha',
      famiglia: 'correzioni',
      skip: 'nota, da decidere: «no, sono 7,5 ha» aggiunge un terreno invece di aggiornare Discesa',
      stato: base,
      passi: [
        {
          domanda: 'no, sono 7,5 ha',
          modello: { testo: '', terreni: [{ nome: null, superficie: 7.5, coltura: null }] },
        },
      ],
      atteso: {
        nTerreni: 1,
        terreni: [{ nome: 'Discesa', superficie: 7.5, coltura: 'Grano' }],
        passo: 'terreni',
        apriRiepilogo: false,
      },
    }),
    caso({
      id: 'correzione: si chiama Collina, non Discesa',
      famiglia: 'correzioni',
      skip: 'nota, da decidere: «si chiama Collina, non Discesa» non rinomina il terreno già raccolto',
      stato: base,
      passi: [
        {
          domanda: 'si chiama Collina, non Discesa',
          modello: {
            testo: '',
            terreni: [{ nome: 'Collina', superficie: 3, coltura: 'Grano' }],
          },
        },
      ],
      atteso: {
        nTerreni: 1,
        terreni: [{ nome: 'Collina', superficie: 3, coltura: 'Grano' }],
        nomiAssenti: ['Discesa'],
        passo: 'terreni',
        apriRiepilogo: false,
        voceUguale: true,
      },
    }),
  ];
}

function famigliaLimite() {
  const nomi = ['salamandra', 'pozzo', 'lago'];
  const colture = ['grano', 'mais', 'orzo'];
  const out = [];
  for (const nome of nomi) {
    for (const coltura of colture) {
      const col = colturaAttesa(coltura);
      out.push(
        caso({
          id: 'limite quinto: ' + nome + ' 6 ha di ' + coltura,
          famiglia: 'limite',
          stato: () => statoTerreni(4),
          passi: [
            {
              domanda: nome + ' 6 ha di ' + coltura,
              modello: {
                testo: '',
                terreni: [{ nome: iniziale(nome), superficie: 6, coltura: col.nome }],
                fatto: true,
              },
            },
          ],
          atteso: {
            nTerreni: 5,
            terreni: [{ nome: nomeTerrenoVisibile(nome), superficie: 6, coltura: col.nome }],
            passo: 'terreni',
            testo: /limite di cinque/i,
            testoAssente: /Ne hai altri/i,
            apriRiepilogo: true,
            voceUguale: true,
          },
        })
      );
      const sesto = 'prato' + nome.slice(0, 3);
      out.push(
        caso({
          id: 'limite sesto: dopo cinque, ' + sesto + ' non entra',
          famiglia: 'limite',
          stato: () => statoTerreni(5),
          passi: [
            {
              domanda: sesto + ' 2 ha di ' + coltura,
              modello: {
                testo: 'Ne hai altri?',
                terreni: [{ nome: iniziale(sesto), superficie: 2, coltura: col.nome }],
              },
            },
          ],
          atteso: {
            nTerreni: 5,
            nomiAssenti: [nomeTerrenoVisibile(sesto)],
            passo: 'terreni',
            apriRiepilogo: false,
          },
        })
      );
    }
  }
  return out;
}

function famigliaOrdine() {
  const nomi = ['discesa', 'collina', 'ponte'];
  const colture = ['grano', 'mais', 'orzo'];
  const ettari = [3, 7];
  const parole = { 3: 'tre', 7: 'sette' };
  const modelli = [
    {
      frase: (nome, ha, coltura) => ha + ' ha di ' + coltura + ' che si chiama ' + nome,
      skip: null,
    },
    {
      frase: (nome, ha, coltura) => nome + ' ' + ha + ' ha di ' + coltura,
      skip: null,
    },
    {
      frase: (nome, ha, coltura) => nome + ' sono ' + ha + ' ha di ' + coltura,
      skip: null,
    },
    {
      frase: (nome, ha, coltura) => nome + ' ' + coltura + ' ' + ha + ' ha',
      skip: null,
    },
    {
      frase: (nome, ha, coltura) => coltura + ', ' + nome + ', ' + parole[ha] + ' ettari',
      skip: 'nota, da decidere: l’ordine «coltura, nome, ettari in parole» non viene letto come terreno',
    },
  ];
  const out = [];
  for (const modelloFrase of modelli) {
    for (const nome of nomi) {
      for (const coltura of colture) {
        for (const ha of ettari) {
          const domanda = modelloFrase.frase(nome, ha, coltura);
          const col = colturaAttesa(coltura);
          out.push(
            caso({
              id: 'ordine: ' + domanda,
              famiglia: 'ordine',
              skip: modelloFrase.skip,
              stato: () => statoTerreni(1),
              passi: [{ domanda, modello: modelloVuoto() }],
              atteso: {
                nTerreni: 2,
                terreni: [
                  {
                    nome: nomeTerrenoVisibile(nome),
                    superficie: ha,
                    coltura: col.nome,
                  },
                ],
                passo: 'terreni',
                testo: new RegExp(nomeTerrenoVisibile(nome), 'i'),
                apriRiepilogo: false,
              },
            })
          );
        }
      }
    }
  }
  return out;
}

export function casiFamiglie() {
  return [
    ...famigliaNome(),
    ...famigliaEttari(),
    ...famigliaColtura(),
    ...famigliaSede(),
    ...famigliaPiuTerreni(),
    ...famigliaCorrezioni(),
    ...famigliaLimite(),
    ...famigliaOrdine(),
  ];
}

export function riepilogoFamiglie(casi) {
  const lista = casi || casiFamiglie();
  const per = {};
  for (const c of lista) {
    if (!per[c.famiglia]) per[c.famiglia] = { varianti: 0, skip: 0, motivi: [] };
    per[c.famiglia].varianti += 1;
    if (c.skip) {
      per[c.famiglia].skip += 1;
      per[c.famiglia].motivi.push(c.id + ' — ' + c.skip);
    }
  }
  return per;
}
