/**
 * Test per modello Attivita
 * Verifica calcolo ore, validazione, conversione Firestore
 */

import { describe, test, expect } from 'vitest';
import { Attivita } from '../../core/models/Attivita.js';

describe('Attivita Model', () => {
  
  describe('Costruttore', () => {
    test('Crea attività con dati minimi', () => {
      const attivita = new Attivita({
        data: '2025-01-10',
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      expect(attivita.data).toBe('2025-01-10');
      expect(attivita.terrenoId).toBe('terreno-123');
      expect(attivita.tipoLavoro).toBe('Potatura');
      expect(attivita.coltura).toBe('Vite');
      expect(attivita.orarioInizio).toBe('08:00');
      expect(attivita.orarioFine).toBe('17:00');
      expect(attivita.pauseMinuti).toBe(60);
    });
  });
  
  describe('Calcolo Ore Nette', () => {
    test('Calcola ore nette correttamente (8 ore - 1 ora pausa = 8 ore)', () => {
      const attivita = new Attivita({
        data: '2025-01-10',
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      // 17:00 - 08:00 = 9 ore = 540 minuti
      // 540 - 60 (pausa) = 480 minuti = 8 ore
      expect(attivita.oreNette).toBe(8);
    });
    
    test('Calcola ore nette con pause multiple', () => {
      const attivita = new Attivita({
        data: '2025-01-10',
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '12:00',
        pauseMinuti: 30
      });
      
      // 12:00 - 08:00 = 4 ore = 240 minuti
      // 240 - 30 (pausa) = 210 minuti = 3.5 ore
      expect(attivita.oreNette).toBe(3.5);
    });
    
    test('Calcola ore nette senza pause', () => {
      const attivita = new Attivita({
        data: '2025-01-10',
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 0
      });
      
      // 17:00 - 08:00 = 9 ore
      expect(attivita.oreNette).toBe(9);
    });
    
    test('Ritorna 0 se pause >= tempo lavoro', () => {
      const attivita = new Attivita({
        data: '2025-01-10',
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '09:00',
        pauseMinuti: 60 // Pausa uguale al tempo lavoro
      });
      
      expect(attivita.oreNette).toBe(0);
    });
    
    test('Ritorna 0 se orario fine < orario inizio', () => {
      const attivita = new Attivita({
        data: '2025-01-10',
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '17:00',
        orarioFine: '08:00', // Fine prima di inizio
        pauseMinuti: 0
      });
      
      expect(attivita.oreNette).toBe(0);
    });
    
    test('updateOrari ricalcola ore nette', () => {
      const attivita = new Attivita({
        data: '2025-01-10',
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      expect(attivita.oreNette).toBe(8);
      
      // Aggiorna orari
      attivita.updateOrari('09:00', '18:00', 30);
      
      expect(attivita.orarioInizio).toBe('09:00');
      expect(attivita.orarioFine).toBe('18:00');
      expect(attivita.pauseMinuti).toBe(30);
      // 18:00 - 09:00 = 9 ore = 540 minuti - 30 = 510 minuti = 8.5 ore
      expect(attivita.oreNette).toBe(8.5);
    });
  });
  
  describe('Validazione', () => {
    test('Attività valida passa validazione', () => {
      const oggi = new Date();
      const dataIeri = new Date(oggi);
      dataIeri.setDate(dataIeri.getDate() - 1);
      const dataString = dataIeri.toISOString().split('T')[0];
      
      const attivita = new Attivita({
        data: dataString,
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      const validation = attivita.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    
    test('Attività senza data fallisce validazione', () => {
      const attivita = new Attivita({
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      const validation = attivita.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Data attività obbligatoria');
    });
    
    test('Attività con data futura fallisce validazione', () => {
      const domani = new Date();
      domani.setDate(domani.getDate() + 1);
      const dataString = domani.toISOString().split('T')[0];
      
      const attivita = new Attivita({
        data: dataString,
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      const validation = attivita.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Data attività non può essere futura');
    });
    
    test('Attività senza terreno fallisce validazione', () => {
      const oggi = new Date();
      const dataString = oggi.toISOString().split('T')[0];
      
      const attivita = new Attivita({
        data: dataString,
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      const validation = attivita.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Terreno obbligatorio');
    });
    
    test('Attività senza tipo lavoro fallisce validazione', () => {
      const oggi = new Date();
      const dataString = oggi.toISOString().split('T')[0];
      
      const attivita = new Attivita({
        data: dataString,
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      const validation = attivita.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Tipo lavoro obbligatorio');
    });
    
    test('Attività con orario fine <= inizio fallisce validazione', () => {
      const oggi = new Date();
      const dataString = oggi.toISOString().split('T')[0];
      
      const attivita = new Attivita({
        data: dataString,
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '17:00',
        orarioFine: '08:00', // Fine prima di inizio
        pauseMinuti: 0
      });
      
      const validation = attivita.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Orario fine deve essere maggiore di orario inizio');
    });
    
    test('Attività con pause >= tempo lavoro fallisce validazione', () => {
      const oggi = new Date();
      const dataString = oggi.toISOString().split('T')[0];
      
      const attivita = new Attivita({
        data: dataString,
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '09:00', // 1 ora
        pauseMinuti: 60 // 1 ora di pausa
      });
      
      const validation = attivita.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Pause non possono essere maggiori o uguali al tempo di lavoro');
    });
    
    test('Attività con pause negative fallisce validazione', () => {
      const oggi = new Date();
      const dataString = oggi.toISOString().split('T')[0];
      
      const attivita = new Attivita({
        data: dataString,
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: -10
      });
      
      const validation = attivita.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Pause non possono essere negative');
    });
    
    test('Attività con formato orario invalido fallisce validazione', () => {
      const oggi = new Date();
      const dataString = oggi.toISOString().split('T')[0];
      
      const attivita = new Attivita({
        data: dataString,
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '25:00', // Ora invalida
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      const validation = attivita.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('formato non valido'))).toBe(true);
    });
  });
  
  describe('fromData', () => {
    test('Crea attività da oggetto dati', () => {
      const data = {
        id: 'attivita-123',
        data: '2025-01-10',
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60,
        note: 'Note test'
      };
      
      const attivita = Attivita.fromData(data);
      
      expect(attivita.id).toBe('attivita-123');
      expect(attivita.data).toBe('2025-01-10');
      expect(attivita.tipoLavoro).toBe('Potatura');
      expect(attivita.note).toBe('Note test');
      // Verifica che ore nette siano calcolate
      expect(attivita.oreNette).toBe(8);
    });
  });
  
  describe('toFirestore', () => {
    test('Converte attività in formato Firestore con ore nette ricalcolate', () => {
      const attivita = new Attivita({
        id: 'attivita-123',
        data: '2025-01-10',
        terrenoId: 'terreno-123',
        terrenoNome: 'Terreno Test',
        tipoLavoro: 'Potatura',
        coltura: 'Vite',
        orarioInizio: '08:00',
        orarioFine: '17:00',
        pauseMinuti: 60
      });
      
      const firestoreData = attivita.toFirestore();
      
      expect(firestoreData.data).toBe('2025-01-10');
      expect(firestoreData.oreNette).toBe(8);
      expect(firestoreData.id).toBeUndefined(); // ID non va nel documento
    });
  });
});

