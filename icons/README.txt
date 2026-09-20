Cartella icone PWA (manifest.json)

Master vettoriale: gfv-mark.svg
(marchio GFV — Recraft, 2026-09. Tony NON sta qui: core/images/tony-icon.png)

Generare le PNG dal master:

  python3 - <<'PY'
  import cairosvg
  from pathlib import Path
  svg = Path('icons/gfv-mark.svg').read_bytes()
  for s in [16,32,48,72,96,120,144,152,180,192,256,512]:
      Path(f'icons/icon-{s}x{s}.png').write_bytes(
          cairosvg.svg2png(bytestring=svg, output_width=s, output_height=s))
  PY

Poi copia le stesse PNG in core/images/ (notifiche, favicon pagine, coming-soon).
Non toccare tony-icon.png.

logoorizzontale.png resta il wordmark lungo (export). Non è l'icona app.
