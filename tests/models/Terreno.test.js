/**
 * Test per modello Terreno
 * Verifica validazione, conversione Firestore, metodi helper
 */

import { describe, test, expect } from 'vitest';
import { Terreno } from '../../core/models/Terreno.js';

describe('Terreno Model', () => {
  
  describe('Costruttore', () => {
    test('Crea terreno con dati minimi', () => {
      const terreno = new Terreno({
        nome: 'Terreno Test'
      });
      
      expect(terreno.nome).toBe('Terreno Test');
      expect(terreno.superficie).toBeNull();
      expect(terreno.coordinate).toBeNull();
      expect(terreno.polygonCoords).toBeNull();
      expect(terreno.note).toBe('');
    });
    
    test('Crea terreno con tutti i dati', () => {
      const terreno = new Terreno({
        nome: 'Terreno Completo',
        superficie: 2.5,
        coordinate: { lat: 44.5, lng: 11.3 },
        polygonCoords: [
          { lat: 44.5, lng: 11.3 },
          { lat: 44.6, lng: 11.3 }
        ],
        note: 'Note di test'
      });
      
      expect(terreno.nome).toBe('Terreno Completo');
      expect(terreno.superficie).toBe(2.5);
      expect(terreno.coordinate).toEqual({ lat: 44.5, lng: 11.3 });
      expect(terreno.polygonCoords).toHaveLength(2);
      expect(terreno.note).toBe('Note di test');
    });
    
    test('Converte superficie in numero', () => {
      const terreno = new Terreno({
        nome: 'Test',
        superficie: '2.5' // Stringa
      });
      
      expect(terreno.superficie).toBe(2.5);
      expect(typeof terreno.superficie).toBe('number');
    });
  });
  
  describe('Validazione', () => {
    test('Terreno valido passa validazione', () => {
      const terreno = new Terreno({
        nome: 'Terreno Valido',
        superficie: 2.5
      });
      
      const validation = terreno.validate();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    
    test('Terreno senza nome fallisce validazione', () => {
      const terreno = new Terreno({
        superficie: 2.5
      });
      
      const validation = terreno.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Nome terreno obbligatorio');
    });
    
    test('Terreno con nome vuoto fallisce validazione', () => {
      const terreno = new Terreno({
        nome: '   ' // Solo spazi
      });
      
      const validation = terreno.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Nome terreno obbligatorio');
    });
    
    test('Terreno con superficie negativa fallisce validazione', () => {
      const terreno = new Terreno({
        nome: 'Test',
        superficie: -1
      });
      
      const validation = terreno.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Superficie non può essere negativa');
    });
    
    test('Terreno con coordinate invalide fallisce validazione', () => {
      const terreno = new Terreno({
        nome: 'Test',
        coordinate: { lat: 'invalid', lng: 11.3 }
      });
      
      const validation = terreno.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Coordinate devono essere oggetti con lat e lng numerici');
    });
    
    test('Terreno con coordinate valide passa validazione', () => {
      const terreno = new Terreno({
        nome: 'Test',
        coordinate: { lat: 44.5, lng: 11.3 }
      });
      
      const validation = terreno.validate();
      expect(validation.valid).toBe(true);
    });
  });
  
  describe('Metodi Helper', () => {
    test('setSuperficieDaMappa aggiorna superficie', () => {
      const terreno = new Terreno({ nome: 'Test' });
      
      terreno.setSuperficieDaMappa(3.5);
      expect(terreno.superficie).toBe(3.5);
    });
    
    test('setSuperficieDaMappa ignora valori negativi', () => {
      const terreno = new Terreno({ nome: 'Test', superficie: 2.5 });
      
      terreno.setSuperficieDaMappa(-1);
      expect(terreno.superficie).toBe(2.5); // Non cambia
    });
    
    test('setPolygonCoords imposta coordinate poligono', () => {
      const terreno = new Terreno({ nome: 'Test' });
      const coords = [
        { lat: 44.5, lng: 11.3 },
        { lat: 44.6, lng: 11.3 },
        { lat: 44.6, lng: 11.4 }
      ];
      
      terreno.setPolygonCoords(coords);
      expect(terreno.polygonCoords).toEqual(coords);
    });
    
    test('setPolygonCoords ignora array vuoto', () => {
      const terreno = new Terreno({ nome: 'Test' });
      
      terreno.setPolygonCoords([]);
      expect(terreno.polygonCoords).toBeNull();
    });
    
    test('setCoordinate imposta coordinate punto centrale', () => {
      const terreno = new Terreno({ nome: 'Test' });
      
      terreno.setCoordinate(44.5, 11.3);
      expect(terreno.coordinate).toEqual({ lat: 44.5, lng: 11.3 });
    });
    
    test('hasMappa ritorna true se ha poligono', () => {
      const terreno = new Terreno({
        nome: 'Test',
        polygonCoords: [{ lat: 44.5, lng: 11.3 }]
      });
      
      expect(terreno.hasMappa()).toBe(true);
    });
    
    test('hasMappa ritorna false se non ha poligono', () => {
      const terreno = new Terreno({ nome: 'Test' });
      
      expect(terreno.hasMappa()).toBe(false);
    });
  });
  
  describe('fromData', () => {
    test('Crea terreno da oggetto dati', () => {
      const data = {
        id: 'test-123',
        nome: 'Terreno da Data',
        superficie: 2.5,
        note: 'Note test'
      };
      
      const terreno = Terreno.fromData(data);
      
      expect(terreno.id).toBe('test-123');
      expect(terreno.nome).toBe('Terreno da Data');
      expect(terreno.superficie).toBe(2.5);
      expect(terreno.note).toBe('Note test');
    });
  });
  
  describe('toFirestore', () => {
    test('Converte terreno in formato Firestore', () => {
      const terreno = new Terreno({
        id: 'test-123',
        nome: 'Terreno Test',
        superficie: 2.5,
        note: 'Note test'
      });
      
      const firestoreData = terreno.toFirestore();
      
      expect(firestoreData.nome).toBe('Terreno Test');
      expect(firestoreData.superficie).toBe(2.5);
      expect(firestoreData.note).toBe('Note test');
      expect(firestoreData.id).toBeUndefined(); // ID non va nel documento
    });
  });
});



