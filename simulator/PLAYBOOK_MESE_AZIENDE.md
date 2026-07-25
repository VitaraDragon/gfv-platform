# Playbook — Lab 1 mese / 5 aziende

Seed automatico di **5 aziende** con ~**22 giorni lavorativi** (≈1 mese), flussi multi-ruolo e magazzino collegato.

## Avvio

```bash
# Terminale 1
npm run sim:emulators

# Terminale 2 (opzionale UI)
npm start

# Terminale 3
npm run sim:run:mese-aziende
```

- Dev UI: `http://127.0.0.1:8000/core/dev/simulator-dev-standalone.html?emulator=1`
- Password tutti: `SimGFV2026!`
- Non è un gate CI (lab locale).

## Le 5 aziende

| # | Template | Focus |
|---|----------|--------|
| 01 | `lab-mese-01-solo-titolare` | Solo proprietario, **senza manodopera**; vigneto + macchine + magazzino + guasti |
| 02 | `lab-mese-02-viti-manodopera` | Capo/operai; lavori 1 giorno e multi-giorno; ore; comunicazioni; assenze/standby |
| 03 | `lab-mese-03-frutteto-ct` | Frutteto + conto terzi, **senza manodopera** |
| 04 | `lab-mese-04-mista-full` | Tutti i moduli seedabili (vigneto+frutteto+parco+magazzino+manodopera+CT) |
| 05 | `lab-mese-05-macchine-guasti` | Stress parco (≥5 guasti); mix lavori manuali / con macchina |

## Cosa viene seedato (mese)

- Diario attività con mix tipico (potatura, trattamento, erpicatura, concimazione, controllo)
- Trattamenti/concimazioni → **uscite** magazzino collegate
- **Carichi** acquisto (`magazzino.seedCarichiMese`)
- Guasti macchina (anche sul solo titolare)
- Manodopera (02/04/05): ore validate, comunicazioni confermate, assenza malattia + standby, lavori durata 1 e ≥3
- Conto terzi (03/04): clienti, tariffe, preventivi

## Prove UI suggerite

Dopo il seed, il runner stampa email/tenant. Percorsi tipici:

1. **Solo titolare (01)** — Diario → Movimenti (entrate+uscite) → Guasti → nessuna pagina squadre.
2. **Manodopera (02/05)** — Gestione lavori (1g vs multi-g, standby) → Capo comunica/valida → Operaio ore → Magazzino.
3. **CT (03)** — Clienti / preventivi + frutteto + magazzino.
4. **Full (04)** — Stesso flusso di 02 + terreni vigneto/frutteto + CT.

## Verify

Il comando fallisce (exit 1) se una delle 5 aziende non passa `verifyMeseAzienda` (attività, scarichi/carichi, guasti, ore/assenze/comunicazioni, CT dove previsto).
