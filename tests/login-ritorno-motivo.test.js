import { describe, expect, it } from 'vitest';
import {
  messaggioMotivoLogin,
  deveMostrareSceltaSessione,
  MESSAGGI_MOTIVO_LOGIN,
} from '../core/js/login-motivo-helpers.js';

describe('messaggioMotivoLogin', () => {
  it('restituisce il testo per i motivi noti', () => {
    expect(messaggioMotivoLogin('sessione-persa')).toBe(
      MESSAGGI_MOTIVO_LOGIN['sessione-persa']
    );
    expect(messaggioMotivoLogin('utente-cambiato')).toBe(
      MESSAGGI_MOTIVO_LOGIN['utente-cambiato']
    );
    expect(messaggioMotivoLogin('profilo-mancante')).toBe(
      MESSAGGI_MOTIVO_LOGIN['profilo-mancante']
    );
  });

  it('restituisce stringa vuota se motivo assente o sconosciuto', () => {
    expect(messaggioMotivoLogin('')).toBe('');
    expect(messaggioMotivoLogin(null)).toBe('');
    expect(messaggioMotivoLogin('altro')).toBe('');
  });
});

describe('deveMostrareSceltaSessione', () => {
  it('solo con registered + primo evento e senza accesso manuale', () => {
    expect(
      deveMostrareSceltaSessione({
        registered: true,
        primoEvento: true,
        accessoManualeInCorso: false,
      })
    ).toBe(true);
  });

  it('non mostra durante login manuale o eventi successivi', () => {
    expect(
      deveMostrareSceltaSessione({
        registered: true,
        primoEvento: true,
        accessoManualeInCorso: true,
      })
    ).toBe(false);
    expect(
      deveMostrareSceltaSessione({
        registered: true,
        primoEvento: false,
        accessoManualeInCorso: false,
      })
    ).toBe(false);
    expect(
      deveMostrareSceltaSessione({
        registered: false,
        primoEvento: true,
        accessoManualeInCorso: false,
      })
    ).toBe(false);
  });
});
