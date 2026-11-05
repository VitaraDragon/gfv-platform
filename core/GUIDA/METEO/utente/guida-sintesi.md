# Meteo — sintesi per Tony

Linguaggio allineato alla guida utente. Distinguere sempre **Meteo sede** (piano **Base**, widget dashboard) vs **modulo Meteo** (abbonamento modulo, pagina mappa).

## In sintesi

- **Piano Free:** riga dashboard con «Meteo sede disponibile con il piano Base» e **Vai ad Abbonamento →**; nessuna previsione né pagina modulo.
- **Piano Base, senza modulo Meteo:** riga dashboard **Meteo sede** (sotto l’intestazione); previsioni per il **pin della sede** in **Impostazioni** (senza pin: «Imposta il pin della sede in Impostazioni per vedere il meteo.»; con indirizzo e città già scritti l’app propone il punto «Controlla il pin e salva» in Impostazioni e, al primo accesso alla dashboard, prova a salvarlo da sola se trova l’indirizzo in quel comune (altrimenti avviso «Non trovo la sede a …» con **Apri Impostazioni**); servizio lento: «Meteo non disponibile al momento. Riprova più tardi.»); titolo icona sole; niente pagina mappa per terreni. I terreni archiviati non ricevono avvisi.
- **Modulo Meteo attivo (+ Base):** widget dashboard **Meteo** espanso (alert, ore, link **Modulo Meteo →**); **pulsante moduli** → **Meteo** → mappa satellitare campi (stessi confini **Mappa aziendale** / **Terreni**); click perimetro/punto → pannello dettaglio (alert, 48h, 8 giorni); blocco **Sede aziendale** in pagina; **← Dashboard Principale**; max ~30 campi possibile.
- **Ingresso:** **pulsante moduli** → **Meteo**; link da widget; riquadro fondo dashboard solo **senza** Manodopera.
- **Terreni:** per meteo per campo servono coordinate/perimetro; senza → messaggio e link **Terreni**.
- **Manodopera:** pannello laterale widget dashboard può mostrare **Operatività oggi** (programmati, in corso, ore da validare).
- **Tony pagina meteo:** `pageType` **meteo_dashboard**; `currentTableData` con items per terreno (pop oggi/domani, alert, pioggia imminente); sede in contesto; leggere summary/items per domande sui campi visibili.
- **Tony briefing:** meteo in riassunto dashboard con Tony Avanzato; voce desktop dove consentito; mobile → chat.
- **Alert:** vento/pioggia/praticabilità — consigli operativi, non sostituto agronomo.

Senza **Base** o senza modulo **Meteo** attivo **non** descrivere la pagina mappa come disponibile; per solo sede usare **Meteo sede** dashboard.

**Pin sede automatico:** al primo accesso l'app mette il pin da sola se trova l'indirizzo; se trova il comune ma non il civico, lo mette al centro del comune con «Ho messo il pin al centro di …: spostalo sulla sede in Impostazioni»; se non trova il comune, avviso «Non trovo la sede a …: metti il pin a mano in Impostazioni».
