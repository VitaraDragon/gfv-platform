/**
 * Role Service — DISABILITATO (sicurezza parte 1).
 * assignRole / removeRole / setRoles scrivevano `ruoli` sul doc users dal client.
 * Nessun import attivo nel codebase; la gestione ruoli torna in PARTE 2 (callable / Gestisci Utenti).
 *
 * @module core/services/role-service
 */

function disabled(op) {
  throw new Error(
    `${op} non è più supportato dal client: i ruoli non si assegnano più scrivendo users/{uid}.`
  );
}

export async function assignRole() {
  disabled('assignRole');
}

export async function removeRole() {
  disabled('removeRole');
}

export async function assignRoles() {
  disabled('assignRoles');
}

export async function setRoles() {
  disabled('setRoles');
}

export default {
  assignRole,
  removeRole,
  assignRoles,
  setRoles,
};
