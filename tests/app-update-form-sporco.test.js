/**
 * @vitest-environment jsdom
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import {
    ATTRIBUTO_SENZA_AVVISO,
    EVENTO_FORM_SALVATO,
    formContaComeSporco,
    segnaFormSalvato,
    segnaFormSporco
} from '../core/js/app-update.js';

function formConInput(id, senzaAvviso) {
    const form = document.createElement('form');
    form.id = id;
    if (senzaAvviso) form.setAttribute(ATTRIBUTO_SENZA_AVVISO, '');
    const input = document.createElement('input');
    input.type = 'text';
    form.appendChild(input);
    document.body.appendChild(form);
    return form;
}

describe('form sporco della barra di aggiornamento', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        segnaFormSalvato();
        window.__gfvFormSporco = false;
    });

    it('il login non conta come dati non salvati', () => {
        const form = formConInput('login-form', true);
        expect(formContaComeSporco(form)).toBe(false);
        segnaFormSporco(form);
        expect(window.__gfvFormSporco).toBe(false);
    });

    it('un form normale diventa sporco', () => {
        const form = formConInput('terreno-form');
        expect(formContaComeSporco(form)).toBe(true);
        segnaFormSporco(form);
        expect(window.__gfvFormSporco).toBe(true);
    });

    it('l\'evento dopo il salvataggio spegne il form', () => {
        const form = formConInput('terreno-form');
        segnaFormSporco(form);
        document.dispatchEvent(new CustomEvent(EVENTO_FORM_SALVATO, { detail: { form } }));
        expect(window.__gfvFormSporco).toBe(false);
    });

    it('l\'evento senza form spegne tutto', () => {
        const primo = formConInput('azienda-form');
        const secondo = formConInput('account-form');
        segnaFormSporco(primo);
        segnaFormSporco(secondo);
        document.dispatchEvent(new CustomEvent(EVENTO_FORM_SALVATO));
        expect(window.__gfvFormSporco).toBe(false);
    });

    it('salvare un form non cancella un altro form sporco', () => {
        const primo = formConInput('azienda-form');
        const secondo = formConInput('notifiche-form');
        segnaFormSporco(primo);
        segnaFormSporco(secondo);
        document.dispatchEvent(new CustomEvent(EVENTO_FORM_SALVATO, { detail: { form: primo } }));
        expect(window.__gfvFormSporco).toBe(true);
        document.dispatchEvent(new CustomEvent(EVENTO_FORM_SALVATO, { detail: { form: secondo } }));
        expect(window.__gfvFormSporco).toBe(false);
    });

    it('form.reset() spegne quel form', () => {
        const form = formConInput('diario-form');
        segnaFormSporco(form);
        form.reset();
        expect(window.__gfvFormSporco).toBe(false);
    });

    it('un segno spento a mano non resuscita i form di prima', () => {
        const vecchio = formConInput('ore-form');
        const altro = formConInput('altro-form');
        segnaFormSporco(vecchio);
        window.__gfvFormSporco = false;
        document.dispatchEvent(new CustomEvent(EVENTO_FORM_SALVATO, { detail: { form: altro } }));
        expect(window.__gfvFormSporco).toBe(false);
    });

    it('un input lanciato da script non segna il form', () => {
        const form = formConInput('script-form');
        form.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));
        expect(window.__gfvFormSporco).toBe(false);
    });

    it('Terreni, Diario e Impostazioni lanciano l\'evento e il login ha l\'attributo', () => {
        const terreni = readFileSync('core/js/terreni-events.js', 'utf8');
        const diario = readFileSync('core/js/attivita-events.js', 'utf8');
        const impostazioni = readFileSync('core/admin/impostazioni-standalone.html', 'utf8');
        const login = readFileSync('core/auth/login-standalone.html', 'utf8');

        const eventoTerreno = terreni.indexOf("new CustomEvent('gfv:form-salvato'");
        const chiudiTerreno = terreni.indexOf('closeTerrenoModal(state, updateState)', eventoTerreno);
        expect(eventoTerreno).toBeGreaterThan(0);
        expect(chiudiTerreno).toBeGreaterThan(eventoTerreno);

        expect(diario).toContain('function segnaAttivitaSalvata()');
        expect(diario).toContain("new CustomEvent('gfv:form-salvato'");
        expect(diario.split('segnaAttivitaSalvata()').length - 1).toBeGreaterThanOrEqual(2);

        expect(impostazioni).toContain("function segnaFormSalvato(form)");
        expect(impostazioni).toContain("segnaFormSalvato(document.getElementById('azienda-form'))");
        expect(impostazioni).toContain("segnaFormSalvato(document.getElementById('account-form'))");
        expect(impostazioni).toContain("segnaFormSalvato(document.getElementById('notifiche-form'))");
        expect(impostazioni).toContain("segnaFormSalvato(document.getElementById('coefficienti-morfologia-form'))");
        expect(impostazioni).toContain('segnaFormSalvato(nomeInput && nomeInput.form)');

        expect(login).toContain('<form id="login-form"');
        expect(login).toContain(ATTRIBUTO_SENZA_AVVISO);
    });
});
