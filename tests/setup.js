/**
 * Setup file per test - Mock Firebase
 * Questo file viene eseguito prima di tutti i test
 */

import { vi } from 'vitest';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => {
  return {
    getFirestore: vi.fn(),
    collection: vi.fn(),
    doc: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    onSnapshot: vi.fn(),
    query: vi.fn(),
    orderBy: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    setDoc: vi.fn(),
    Timestamp: {
      now: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 })),
      fromDate: vi.fn((date) => ({ 
        seconds: Math.floor(date.getTime() / 1000), 
        nanoseconds: 0,
        toDate: () => date
      }))
    },
    serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000, nanoseconds: 0 }))
  };
});

// Mock Firebase Auth
vi.mock('firebase/auth', () => {
  return {
    getAuth: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    updatePassword: vi.fn(),
    updateProfile: vi.fn()
  };
});

// Mock Firebase App
vi.mock('firebase/app', () => {
  return {
    initializeApp: vi.fn(() => ({})),
    getApps: vi.fn(() => [])
  };
});

// Mock per firebase-service.js - Funzioni utility
vi.mock('../../core/services/firebase-service.js', async () => {
  const actual = await vi.importActual('../../core/services/firebase-service.js');
  return {
    ...actual,
    // Mock solo le funzioni che usano Firebase direttamente
    // Le funzioni utility (timestampToDate, dateToTimestamp) possono rimanere reali
    timestampToDate: (timestamp) => {
      if (!timestamp) return null;
      if (timestamp.toDate) {
        return timestamp.toDate();
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000);
      }
      return new Date(timestamp);
    },
    dateToTimestamp: (date) => {
      if (!date) return null;
      const d = date instanceof Date ? date : new Date(date);
      return {
        seconds: Math.floor(d.getTime() / 1000),
        nanoseconds: 0,
        toDate: () => d
      };
    }
  };
});





