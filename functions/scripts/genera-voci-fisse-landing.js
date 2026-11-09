#!/usr/bin/env node
"use strict";

/**
 * Genera mp3 statici per le frasi fisse dell'aiuto account (landing).
 * Chiave API SOLO da process.env.ELEVENLABS_API_KEY (mai su file / commit / log).
 *
 * Uso (PowerShell):
 *   $env:ELEVENLABS_API_KEY = (npx firebase functions:secrets:access ELEVENLABS_API_KEY --project gfv-platform)
 *   node functions/scripts/genera-voci-fisse-landing.js
 *   Remove-Item Env:ELEVENLABS_API_KEY
 */

const fs = require("node:fs");
const path = require("node:path");
const {
  COSTANTI_VOCE,
  preparaTestoVoce,
  corpoElevenLabs,
  urlElevenLabs
} = require("../lib/tony-landing-voce");

const ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(ROOT, "landing/public/tony-live/voci");

/** Testi allineati a testi-landing.js / tony-aiuto-account.js (voce senza N). */
const FRASI = Object.freeze({
  invito:
    "Vuoi che ti aiuti a preparare l'azienda? Ti faccio tre domande: sede legale, poderi e terreni. Puoi saltarne una con \"Dopo\".",
  domandaSede: "Dov'è la sede legale della tua azienda? Mi bastano via e comune.",
  domandaPoderi: "Hai uno o più poderi? Dimmi come li chiami.",
  domandaTerreni:
    "Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi? Con l'account gratuito ne puoi inserire fino a 5.",
  schedaIntro:
    "Ecco la tua azienda. Controlla e conferma: se qualcosa non va, correggilo qui.",
  cinqueTerreni:
    "Con l'account gratuito arrivi a 5 terreni. Gli altri li aggiungi passando al Base, quando vuoi.",
  limiteCinqueRaggiunto:
    "Hai raggiunto il limite di cinque terreni. Controlliamo il riepilogo.",
  passaggioSede: "Andiamo avanti: hai dei poderi?",
  passaggioPoderi:
    "Ok, passiamo ai terreni. Dimmi il primo terreno: come si chiama, quanti ettari e cosa ci coltivi?",
  passaggioTerreni: "Facciamo così: controlla il riepilogo e completa lì.",
  tornaDalRiepilogo:
    "Ok, continuiamo. Dimmi pure un altro terreno oppure riapri il riepilogo quando vuoi."
});

async function sintetizza(testo, chiave) {
  const testoVoce = preparaTestoVoce(testo);
  const res = await fetch(urlElevenLabs(), {
    method: "POST",
    headers: {
      "xi-api-key": chiave,
      "Content-Type": "application/json",
      Accept: "audio/mpeg"
    },
    body: JSON.stringify(corpoElevenLabs(testoVoce))
  });
  if (!res.ok) {
    const dettaglio = await res.text().catch(() => "");
    throw new Error(
      "ElevenLabs " + res.status + (dettaglio ? ": " + dettaglio.slice(0, 200) : "")
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function main() {
  const chiave = process.env.ELEVENLABS_API_KEY;
  if (!chiave || !String(chiave).trim()) {
    console.error(
      "ELEVENLABS_API_KEY assente: salto la generazione degli mp3 fissi."
    );
    process.exitCode = 2;
    return;
  }
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
  const richieste = process.argv.slice(2).filter(Boolean);
  const tutte = Object.keys(FRASI);
  let chiavi = tutte;
  if (richieste.length) {
    chiavi = [];
    for (let i = 0; i < richieste.length; i++) {
      const k = richieste[i];
      if (!Object.prototype.hasOwnProperty.call(FRASI, k)) {
        console.error("Chiave sconosciuta: " + k + " (valide: " + tutte.join(", ") + ")");
        process.exitCode = 1;
        return;
      }
      chiavi.push(k);
    }
  }
  for (let i = 0; i < chiavi.length; i++) {
    const k = chiavi[i];
    const out = path.join(OUT_DIR, "tony-aiuto-" + k + ".mp3");
    process.stdout.write("Genero " + k + "… ");
    const buf = await sintetizza(FRASI[k], String(chiave).trim());
    fs.writeFileSync(out, buf);
    console.log("ok (" + buf.length + " byte) → " + path.relative(ROOT, out));
  }
  console.log("Fatto: " + chiavi.length + " file in " + path.relative(ROOT, OUT_DIR));
}

main().catch((e) => {
  console.error("Errore generazione voci fisse:", e && e.message ? e.message : e);
  process.exitCode = 1;
});
