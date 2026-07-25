/**
 * Config lab “1 mese / 5 aziende” (shared runner + playbook).
 * @module simulator/lib/mese-aziende-lab
 */

export const MESE_AZIENDE_RUNS = [
  {
    label: '01 Solo titolare (senza manodopera)',
    templateId: 'lab-mese-01-solo-titolare',
    seed: 920001,
    prove: [
      'Login manager: Diario attività ~22 gg con mix potatura/trattamento/concimazione/meccanico',
      'Magazzino: uscite da trattamenti + carichi acquisto lab mese',
      'Parco macchine: guasti aperti; scadenze flotta',
      'Nessuna voce manodopera / squadre'
    ]
  },
  {
    label: '02 Viti + manodopera (1g / multi-g, assenze, comunicazioni)',
    templateId: 'lab-mese-02-viti-manodopera',
    seed: 920002,
    prove: [
      'Manager: lavori squadra durata 1 giorno e ≥3 giorni; standby assenza',
      'Capo: comunicazioni squadra + validazione ore operai',
      'Operaio: segna ore; assenza malattia già gestita in seed',
      'Magazzino: scarichi trattamenti + carichi'
    ]
  },
  {
    label: '03 Frutteto + conto terzi (senza manodopera)',
    templateId: 'lab-mese-03-frutteto-ct',
    seed: 920003,
    prove: [
      'Login manager: frutteto (trattamenti/potature) + magazzino',
      'Conto terzi: clienti, tariffe, preventivi',
      'Nessuna manodopera; lavori via diario titolare'
    ]
  },
  {
    label: '04 Mista full (tutti i moduli seedabili)',
    templateId: 'lab-mese-04-mista-full',
    seed: 920004,
    prove: [
      'Vigneto + frutteto sullo stesso tenant',
      'Manodopera multi-squadra: ore, comunicazioni, assenze, standby',
      'Conto terzi attivo; magazzino carichi+scarichi; guasti',
      'Lavori manuali (potatura) e con macchina'
    ]
  },
  {
    label: '05 Macchine + guasti (stress parco)',
    templateId: 'lab-mese-05-macchine-guasti',
    seed: 920005,
    prove: [
      'Parco: più trattori/attrezzi + 5 guasti seed',
      'Lavori con macchina vs potatura manuale',
      'Flusso ore/assenze/comunicazioni come 02, focus mezzi'
    ]
  }
];
