# Workspace Higgsfield — spot adv (progetto aperto)

Output generati in locale. **Non** vanno in git (`workspace/output/` è in `.gitignore`).

Copioni e direzione stanno in `docs-sviluppo/`:

| Linea | Documento | Stato |
|-------|-----------|--------|
| **A** brand | `COPIONE_PRIMO_SPOT_SOCIAL.md` | decisioni chiuse |
| **B** feature | `COPIONE_SPOT_FLUSSI_APP.md` | ep. 1 guasto in produzione; ep. 2 zona lavorata copione chiuso |
| Direzione | `PIANO_VIDEO_PRESENTAZIONE_PROF_E_RIUSO_COMMERCIALE.md` | invariata |
| Storyboard / clip | `VIDEO_STORYBOARD_SCRIPT_E_CLIP.md` | lista operativa |
| Personaggi Linea A | `VIDEO_BRIEF_GEMINI_PERSONAGGI.md` | **non** usare per Linea B |

Linea A e Linea B non si mescolano (stile, Soul, UI).

## Cartelle output (solo questa macchina)

```
workspace/output/
  hf-guasto-plates/     Linea B ep. 1 — segnalazione guasto (Giuseppe / Luca)
  linea-b-early/        Take precedenti Linea B (clip1 + still)
```

### `hf-guasto-plates/` — inventario

| File | Cosa |
|------|------|
| `01-trattore.png` … `03-frutteto.png` | Ambienti / mezzi di sfondo |
| `04-giuseppe-lock.png` `05-giuseppe-salopette.png` | Giuseppe lock / salopette |
| `06-clip1-lavoro.mp4` | Clip 1 lavoro |
| `07-clip2-fumo.mp4` | Clip 2 fumo |
| `08`–`10` still clip 3 | Controllo / facelock |
| `11-clip3-controllo.mp4` `13-clip3-colori.mp4` | Clip 3 |
| `14`–`16` clip 4 | Telefono + OTS dolly |
| `17`–`25` ripara / sorride | Still e clip riparazione |
| `26`–`28` Luca OTS | Notifica a Luca |
| `29`–`34` risolto OTS | Giuseppe / Luca — guasto risolto |
| `giuseppe-soul-thumb.png` | Thumb Soul Giuseppe |

Nuove generate: stessa cartella, nome progressivo, aggiornare questa tabella.

## Regole di lavoro

- UI **sempre reale** (mai generata). Soul = unici attori da replicare.
- Mezzi e attrezzi sono sfondo: non inseguire la consistenza marca/forma.
- I file qui restano sul PC. I prompt e le decisioni restano nei markdown in `docs-sviluppo/`.
