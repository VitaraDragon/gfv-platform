/**
 * Visibilità del menu ⚙️ del workspace campo e ritorno della validazione ore.
 * Le pagine impostano solo hidden / href: la scelta sta qui.
 */

import { normalizzaRuoliGuasti, ritornoWorkspaceCampoDaGuasti } from '../../js/field-guasti-access.js';

const HREF_CAMPO = '../mobile/field-workspace-standalone.html';
const HREF_VALIDAZIONE_DASHBOARD = '../dashboard-standalone.html';

/** «Cambia azienda» solo con almeno due aziende. Conteggio ignoto = nascosta. */
export function voceCambiaAziendaVisibile(numeroAziende) {
    const n = Number(numeroAziende);
    return Number.isFinite(n) && n >= 2;
}

/**
 * Il menu ⚙️ del campo non apre più la validazione a schermo intero né la segnalazione guasti.
 * Quelle schermate restano nel workspace (schede), non nell’ingranaggio.
 * Ruoli e moduli non cambiano questa scelta: il menu è solo del profilo campo.
 * @param {{ ruoli?: string[], moduli?: string[], numeroAziende?: number }} input
 * @returns {{ validazioneOre: boolean, segnalaGuasto: boolean, cambiaAzienda: boolean }}
 */
export function vociMenuCampo({ numeroAziende } = {}) {
    return {
        validazioneOre: false,
        segnalaGuasto: false,
        cambiaAzienda: voceCambiaAziendaVisibile(numeroAziende)
    };
}

/**
 * Pulsante in alto della validazione ore.
 * Il profilo campo (operaio o caposquadra, senza manager) torna al workspace:
 * la dashboard lo rimanderebbe lì, e l’etichetta deve dire Campo.
 * Con from=field il ritorno è il workspace anche se manca l’indizio gfv_ingresso_ultimo.
 * Il manager, anche con il ruolo di capo e anche se arriva dal workspace,
 * torna alla dashboard vera. Il workspace lo rimanderebbe indietro.
 * @param {{ da?: string, ruoli?: string[], ruoloSingolo?: string }} input
 * @returns {{ etichetta: string, href: string }}
 */
export function ritornoValidazioneOre({ da, ruoli, ruoloSingolo } = {}) {
    const n = normalizzaRuoliGuasti(ruoli, ruoloSingolo);
    const manager = n.includes('manager') || n.includes('amministratore');
    const puro = ritornoWorkspaceCampoDaGuasti(ruoli, ruoloSingolo);
    const dalWorkspace = String(da || '').toLowerCase().trim() === 'field';
    if (!manager && (puro || dalWorkspace)) {
        return { etichetta: '← Campo', href: HREF_CAMPO };
    }
    return { etichetta: '← Dashboard', href: HREF_VALIDAZIONE_DASHBOARD };
}

/** true solo quando l'init del workspace ha finito ruoli, moduli e cambio azienda. */
export function menuCampoAbilitato(pronto) {
    return pronto === true;
}
