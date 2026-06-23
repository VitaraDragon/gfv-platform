/**
 * Kill-switch: il simulatore deve girare SOLO su Firebase Emulator locale.
 * @module simulator/lib/guard-production
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const emulatorConfig = JSON.parse(
  readFileSync(join(__dirname, '../config/emulator.json'), 'utf-8')
);

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '0.0.0.0']);

function parseHostPort(value) {
  if (!value || typeof value !== 'string') return null;
  const [host, portStr] = value.split(':');
  const port = Number(portStr);
  if (!host || !Number.isFinite(port)) return null;
  return { host, port };
}

function isLocalEmulatorHost(value) {
  const parsed = parseHostPort(value);
  if (!parsed) return false;
  return LOCAL_HOSTS.has(parsed.host.toLowerCase());
}

/**
 * Imposta env emulator se mancanti (solo host locali da config).
 * @param {{ autoConfigure?: boolean }} [options]
 */
export function ensureEmulatorEnv(options = {}) {
  const { autoConfigure = true } = options;

  if (!process.env.FIRESTORE_EMULATOR_HOST && autoConfigure) {
    process.env.FIRESTORE_EMULATOR_HOST = emulatorConfig.firestoreHost;
  }
  if (!process.env.FIREBASE_AUTH_EMULATOR_HOST && autoConfigure) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = emulatorConfig.authHost;
  }

  const fsHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (!fsHost || !authHost) {
    throw new Error(
      'GFV Farm Simulator: FIRESTORE_EMULATOR_HOST e FIREBASE_AUTH_EMULATOR_HOST devono essere impostati. ' +
        'Avvia prima: npm run sim:emulators'
    );
  }

  if (!isLocalEmulatorHost(fsHost) || !isLocalEmulatorHost(authHost)) {
    throw new Error(
      `GFV Farm Simulator: host emulator non locale (fs=${fsHost}, auth=${authHost}). ` +
        'Operazione bloccata per evitare scritture su produzione.'
    );
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.SIMULATOR_ALLOW_CREDENTIALS) {
    throw new Error(
      'GFV Farm Simulator: GOOGLE_APPLICATION_CREDENTIALS impostato senza emulator locale. ' +
        'Rimuovi le credenziali o imposta SIMULATOR_ALLOW_CREDENTIALS=1 solo in dev controllato.'
    );
  }

  return {
    firestoreHost: fsHost,
    authHost,
    projectId: emulatorConfig.projectId
  };
}

export function assertSimulatorSafeToRun() {
  return ensureEmulatorEnv({ autoConfigure: true });
}
