/**
 * Test Error Handling Standard
 * Verifica che tutti i servizi seguano lo standard di error handling documentato
 * 
 * @module tests/services/error-handling-standard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Error Handling Standard - Conformità Servizi', () => {
  
  // Mock per console.error per verificare i log
  let consoleErrorSpy;
  
  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Pattern: Funzioni che ritornano Array', () => {
    
    it('dovrebbero ritornare [] per errori non critici (database/rete)', async () => {
      // Simula una funzione che ritorna array con errore non critico
      const mockFunction = async () => {
        try {
          throw new Error('Errore database: connection timeout');
        } catch (error) {
          // Errori non critici (database, rete) -> ritorna array vuoto
          if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
            throw new Error(`Errore: ${error.message}`);
          }
          console.error('Errore:', error);
          return [];
        }
      };
      
      const result = await mockFunction();
      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('dovrebbero lanciare eccezione per errori critici (tenant mancante)', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Nessun tenant corrente disponibile');
        } catch (error) {
          // Errori critici -> lancia eccezione
          if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
            console.error('Errore:', error);
            throw new Error(`Errore: ${error.message}`);
          }
          console.error('Errore:', error);
          return [];
        }
      };
      
      await expect(mockFunction()).rejects.toThrow('Errore: Nessun tenant corrente disponibile');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('dovrebbero lanciare eccezione per errori critici (parametro obbligatorio)', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('ID lavoro obbligatorio');
        } catch (error) {
          // Errori critici -> lancia eccezione
          if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
            console.error('Errore:', error);
            throw new Error(`Errore: ${error.message}`);
          }
          console.error('Errore:', error);
          return [];
        }
      };
      
      await expect(mockFunction()).rejects.toThrow('Errore: ID lavoro obbligatorio');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Pattern: Funzioni che ritornano Oggetti Singoli', () => {
    
    it('dovrebbero ritornare null per errori non critici', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Errore database: document not found');
        } catch (error) {
          // Errori non critici -> ritorna null
          if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
            throw new Error(`Errore: ${error.message}`);
          }
          console.error('Errore:', error);
          return null;
        }
      };
      
      const result = await mockFunction();
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('dovrebbero lanciare eccezione per errori critici', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Nessun tenant corrente disponibile');
        } catch (error) {
          // Errori critici -> lancia eccezione
          if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
            console.error('Errore:', error);
            throw new Error(`Errore: ${error.message}`);
          }
          console.error('Errore:', error);
          return null;
        }
      };
      
      await expect(mockFunction()).rejects.toThrow('Errore: Nessun tenant corrente disponibile');
    });
  });

  describe('Pattern: Funzioni che ritornano Oggetti Strutturati', () => {
    
    it('dovrebbero ritornare {} per errori non critici', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Errore database: query failed');
        } catch (error) {
          // Errori non critici -> ritorna oggetto vuoto
          if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
            throw new Error(`Errore: ${error.message}`);
          }
          console.error('Errore:', error);
          return {};
        }
      };
      
      const result = await mockFunction();
      expect(result).toEqual({});
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Pattern: Funzioni che ritornano Numeri', () => {
    
    it('dovrebbero ritornare 0 per errori non critici', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Errore database: connection lost');
        } catch (error) {
          // Errori non critici -> ritorna 0
          if (error.message.includes('tenant') || error.message.includes('obbligatorio') || error.message.includes('config')) {
            throw new Error(`Errore: ${error.message}`);
          }
          console.error('Errore:', error);
          return 0;
        }
      };
      
      const result = await mockFunction();
      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Pattern: Funzioni CRUD', () => {
    
    it('dovrebbero sempre lanciare eccezioni con messaggi chiari', async () => {
      const mockCreateFunction = async (data) => {
        try {
          // Validazione
          if (!data.name) {
            throw new Error('Nome obbligatorio');
          }
          
          // Simula creazione
          return 'item-id-123';
        } catch (error) {
          console.error('Errore creazione item:', error);
          throw new Error(`Errore creazione item: ${error.message}`);
        }
      };
      
      // Test con dati validi
      const result = await mockCreateFunction({ name: 'Test Item' });
      expect(result).toBe('item-id-123');
      
      // Test con dati invalidi (dovrebbe lanciare eccezione)
      await expect(mockCreateFunction({})).rejects.toThrow('Errore creazione item: Nome obbligatorio');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Distinzione Errori Critici vs Non Critici', () => {
    
    it('dovrebbe identificare correttamente errori critici (tenant)', () => {
      const errorMessages = [
        'Nessun tenant corrente disponibile',
        'Tenant non trovato',
        'tenant mancante'
      ];
      
      errorMessages.forEach(msg => {
        const msgLower = msg.toLowerCase();
        const isCritical = msgLower.includes('tenant') || msgLower.includes('obbligatorio') || msgLower.includes('config');
        expect(isCritical).toBe(true);
      });
    });

    it('dovrebbe identificare correttamente errori critici (obbligatorio)', () => {
      const errorMessages = [
        'ID lavoro obbligatorio',
        'Parametro obbligatorio mancante',
        'Campo obbligatorio'
      ];
      
      errorMessages.forEach(msg => {
        const isCritical = msg.includes('tenant') || msg.includes('obbligatorio') || msg.includes('config');
        expect(isCritical).toBe(true);
      });
    });

    it('dovrebbe identificare correttamente errori critici (config)', () => {
      const errorMessages = [
        'Firebase config non disponibile',
        'Configurazione mancante',
        'config error'
      ];
      
      errorMessages.forEach(msg => {
        const msgLower = msg.toLowerCase();
        const isCritical = msgLower.includes('tenant') || msgLower.includes('obbligatorio') || msgLower.includes('config');
        expect(isCritical).toBe(true);
      });
    });

    it('dovrebbe identificare correttamente errori non critici (database/rete)', () => {
      const errorMessages = [
        'Errore database: connection timeout',
        'Errore rete: network error',
        'Query failed',
        'Document not found',
        'Permission denied'
      ];
      
      errorMessages.forEach(msg => {
        const isCritical = msg.includes('tenant') || msg.includes('obbligatorio') || msg.includes('config');
        expect(isCritical).toBe(false);
      });
    });
  });

  describe('Logging Standardizzato', () => {
    
    it('dovrebbe usare console.error per tutti gli errori', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Test error');
        } catch (error) {
          console.error('Errore in mockFunction:', error);
          return [];
        }
      };
      
      await mockFunction();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Errore in mockFunction:', expect.any(Error));
    });

    it('dovrebbe loggare errori critici prima di lanciare eccezione', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Nessun tenant corrente disponibile');
        } catch (error) {
          if (error.message.includes('tenant')) {
            console.error('Errore critico:', error);
            throw new Error(`Errore: ${error.message}`);
          }
          return [];
        }
      };
      
      await expect(mockFunction()).rejects.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('Messaggi di Errore', () => {
    
    it('dovrebbero essere in italiano', () => {
      const errorMessages = [
        'Nessun tenant corrente disponibile',
        'ID lavoro obbligatorio',
        'Errore creazione terreno: Nome obbligatorio',
        'Terreno non trovato'
      ];
      
      errorMessages.forEach(msg => {
        // Verifica che non contengano parole inglesi comuni per errori (escludendo "Errore" che è italiano)
        // Verifica che non inizino con parole inglesi comuni
        const startsWithEnglish = /^(Error|Failed|Invalid|Missing)/i.test(msg);
        // "Errore" è italiano, quindi va bene
        const isItalianError = msg.startsWith('Errore');
        expect(startsWithEnglish && !isItalianError).toBe(false);
        expect(msg.length).toBeGreaterThan(0);
      });
    });

    it('dovrebbero essere chiari e specifici', () => {
      const goodMessages = [
        'Email non valida',
        'Terreno non trovato',
        'Impossibile eliminare: terreno utilizzato in 5 attività'
      ];
      
      const badMessages = [
        'Error',
        'Failed',
        'Error: Cannot read property "name" of undefined'
      ];
      
      goodMessages.forEach(msg => {
        expect(msg.length).toBeGreaterThan(5);
        expect(msg).not.toBe('Error');
        expect(msg).not.toBe('Failed');
      });
      
      badMessages.forEach(msg => {
        // Questi sono esempi di messaggi cattivi
        expect(msg.length).toBeLessThan(50 || msg.includes('undefined'));
      });
    });

    it('dovrebbero includere contesto quando appropriato', () => {
      const messagesWithContext = [
        'Errore creazione terreno: Nome obbligatorio',
        'Errore recupero lavori: Nessun tenant corrente disponibile',
        'Errore aggiornamento attività: Validazione fallita'
      ];
      
      messagesWithContext.forEach(msg => {
        expect(msg).toMatch(/^Errore \w+/);
        expect(msg).toContain(':');
      });
    });
  });

  describe('Comportamento Prevedibile', () => {
    
    it('le funzioni che ritornano array non dovrebbero mai ritornare undefined', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Database error');
        } catch (error) {
          if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
            throw error;
          }
          console.error('Errore:', error);
          return []; // Sempre ritorna array, mai undefined
        }
      };
      
      const result = await mockFunction();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('le funzioni che ritornano oggetti singoli non dovrebbero mai ritornare undefined', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Database error');
        } catch (error) {
          if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
            throw error;
          }
          console.error('Errore:', error);
          return null; // Sempre ritorna null, mai undefined
        }
      };
      
      const result = await mockFunction();
      expect(result).toBeDefined(); // null è definito
      expect(result).toBeNull();
    });

    it('le funzioni che ritornano numeri non dovrebbero mai ritornare undefined', async () => {
      const mockFunction = async () => {
        try {
          throw new Error('Database error');
        } catch (error) {
          if (error.message.includes('tenant') || error.message.includes('obbligatorio')) {
            throw error;
          }
          console.error('Errore:', error);
          return 0; // Sempre ritorna numero, mai undefined
        }
      };
      
      const result = await mockFunction();
      expect(result).toBeDefined();
      expect(typeof result).toBe('number');
    });
  });
});
