# Meteo — sintesi per Tony

Linguaggio allineato alla guida utente. Distinguere sempre **Meteo sede** (piano **Base**, widget dashboard) vs **modulo Meteo** (abbonamento modulo, pagina mappa).

## In sintesi

- **Piano Free:** nessun meteo in dashboard né pagina modulo.
- **Piano Base, senza modulo Meteo:** riga dashboard **Meteo sede** (sotto **Moduli**); previsioni per **indirizzo sede** in **Impostazioni**; titolo icona sole; niente pagina mappa per terreni.
- **Modulo Meteo attivo (+ Base):** widget dashboard **Meteo** espanso (alert, ore, link **Modulo Meteo →**); **Moduli** → **Meteo** → mappa satellitare campi (stessi confini **Mappa aziendale** / **Terreni**); click perimetro/punto → pannello dettaglio (alert, 48h, 8 giorni); blocco **Sede aziendale** in pagina; **← Dashboard**; max ~30 campi possibile.
- **Ingresso:** **Moduli** → **Meteo**; link da widget; **I miei accessi**; riquadro fondo dashboard solo **senza** Manodopera.
- **Terreni:** per meteo per campo servono coordinate/perimetro; senza → messaggio e link **Terreni**.
- **Manodopera:** pannello laterale widget dashboard può mostrare **Operatività oggi** (programmati, in corso, ore da validare).
- **Tony pagina meteo:** `pageType` **meteo_dashboard**; `currentTableData` con items per terreno (pop oggi/domani, alert, pioggia imminente); sede in contesto; leggere summary/items per domande sui campi visibili.
- **Tony briefing:** meteo in riassunto dashboard con Tony Avanzato; voce desktop dove consentito; mobile → chat.
- **Alert:** vento/pioggia/praticabilità — consigli operativi, non sostituto agronomo.

Senza **Base** o senza modulo **Meteo** attivo **non** descrivere la pagina mappa come disponibile; per solo sede usare **Meteo sede** dashboard.
