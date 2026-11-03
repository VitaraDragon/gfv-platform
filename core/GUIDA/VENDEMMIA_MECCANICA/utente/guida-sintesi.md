# Vendemmia meccanica — sintesi per Tony

Modulo **`vendemmiaMeccanica`**. **Richiede Conto terzi** attivo (`requiresModules`). Disattivando CT → disattivazione cascata VM (stop fatturazione VM). Riattivazione: prima CT, poi VM. Tipico uso **conto terzi** (clienti con vigneti).

## Hub
**Moduli** → **Vendemmia meccanica** → `vm-home`: KPI (clienti in piano, terreni, ettari, bilancio) + azioni.

## Azioni tipiche
- **Piano stagione** — pianifica vigneti/clienti da vendemmiare.
- **Calcolatore** / **Calcoli salvati** — compenso e storicizzazione.
- **Tariffe VM** — listino servizio.
- **Bilancio servizio** — riepilogo economico servizio.
- Scorciatoie CT: clienti, terreni clienti, preventivi, lavori (se Conto terzi attivo).

**← Dashboard** dalle pagine interne; **← Dashboard Principale** dall’hub. Senza modulo (o senza CT dove richiesto) non inventare flussi.
