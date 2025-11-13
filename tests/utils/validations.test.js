/**
 * Test per funzioni di validazione utility
 */

import { describe, test, expect } from 'vitest';

/**
 * Valida formato email
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Valida formato data (YYYY-MM-DD)
 */
function isValidDate(dateString) {
  if (!dateString || typeof dateString !== 'string') return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * Valida formato orario (HH:MM) - richiede sempre 2 cifre per ore e minuti
 */
function isValidTime(timeString) {
  if (!timeString || typeof timeString !== 'string') return false;
  const timeRegex = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(timeString);
}

/**
 * Verifica se una data è nel passato o presente (non futura)
 */
function isDateNotFuture(dateString) {
  if (!isValidDate(dateString)) return false;
  
  const date = new Date(dateString);
  const oggi = new Date();
  oggi.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  return date <= oggi;
}

describe('Validazioni Utility', () => {
  
  describe('isValidEmail', () => {
    test('Email valida passa validazione', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('admin@gfv-platform.com')).toBe(true);
    });
    
    test('Email non valida fallisce validazione', () => {
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test.example.com')).toBe(false);
      expect(isValidEmail('test @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });
    
    test('Email con spazi viene trimmata', () => {
      expect(isValidEmail('  test@example.com  ')).toBe(true);
    });
  });
  
  describe('isValidDate', () => {
    test('Data valida passa validazione', () => {
      expect(isValidDate('2025-01-10')).toBe(true);
      expect(isValidDate('2024-12-31')).toBe(true);
      expect(isValidDate('2025-02-29')).toBe(true); // Anno bisestile
    });
    
    test('Data non valida fallisce validazione', () => {
      expect(isValidDate('2025-13-01')).toBe(false); // Mese invalido
      expect(isValidDate('2025-01-32')).toBe(false); // Giorno invalido
      expect(isValidDate('25-01-10')).toBe(false); // Formato errato
      expect(isValidDate('2025/01/10')).toBe(false); // Separatore errato
      expect(isValidDate('')).toBe(false);
      expect(isValidDate(null)).toBe(false);
    });
  });
  
  describe('isValidTime', () => {
    test('Orario valido passa validazione', () => {
      expect(isValidTime('08:00')).toBe(true);
      expect(isValidTime('17:30')).toBe(true);
      expect(isValidTime('23:59')).toBe(true);
      expect(isValidTime('00:00')).toBe(true);
      expect(isValidTime('09:15')).toBe(true);
    });
    
    test('Orario non valido fallisce validazione', () => {
      expect(isValidTime('25:00')).toBe(false); // Ora > 23
      expect(isValidTime('08:60')).toBe(false); // Minuti > 59
      expect(isValidTime('8:00')).toBe(false); // Formato senza zero (richiede 08:00)
      expect(isValidTime('08:0')).toBe(false); // Minuti senza zero (richiede 08:00)
      expect(isValidTime('8:30')).toBe(false); // Formato senza zero
      expect(isValidTime('24:00')).toBe(false); // Ora = 24 (max è 23)
      expect(isValidTime('')).toBe(false);
      expect(isValidTime(null)).toBe(false);
    });
  });
  
  describe('isDateNotFuture', () => {
    test('Data passata passa validazione', () => {
      const ieri = new Date();
      ieri.setDate(ieri.getDate() - 1);
      const dataIeri = ieri.toISOString().split('T')[0];
      
      expect(isDateNotFuture(dataIeri)).toBe(true);
    });
    
    test('Data odierna passa validazione', () => {
      const oggi = new Date();
      const dataOggi = oggi.toISOString().split('T')[0];
      
      expect(isDateNotFuture(dataOggi)).toBe(true);
    });
    
    test('Data futura fallisce validazione', () => {
      const domani = new Date();
      domani.setDate(domani.getDate() + 1);
      const dataDomani = domani.toISOString().split('T')[0];
      
      expect(isDateNotFuture(dataDomani)).toBe(false);
    });
    
    test('Data non valida fallisce validazione', () => {
      expect(isDateNotFuture('invalid-date')).toBe(false);
      expect(isDateNotFuture('')).toBe(false);
      expect(isDateNotFuture(null)).toBe(false);
    });
  });
});

