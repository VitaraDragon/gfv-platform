/**
 * Tenant Selection Service - Gestione selezione tenant
 * Gestisce UI per selezione tenant quando utente ha più tenant disponibili
 * 
 * @module core/services/tenant-selection-service
 */

import { switchTenant, getUserTenants } from './tenant-service.js';
import { getCurrentUserData } from './auth-service.js';

/**
 * Mostra modal selettore tenant
 * @param {Array<Object>} tenants - Array di tenant disponibili { tenantId, ruoli, stato, ... }
 * @param {Function} onSelect - Callback quando tenant viene selezionato (tenantId) => void
 * @returns {Promise<string|null>} ID tenant selezionato o null se annullato
 */
export function showTenantSelector(tenants, onSelect = null) {
  return new Promise((resolve) => {
    if (!tenants || tenants.length === 0) {
      console.warn('Nessun tenant disponibile per la selezione');
      resolve(null);
      return;
    }
    
    // Se un solo tenant, seleziona automaticamente
    if (tenants.length === 1) {
      const tenantId = tenants[0].tenantId;
      if (onSelect) {
        onSelect(tenantId);
      }
      resolve(tenantId);
      return;
    }
    
    // Crea modal HTML
    const modal = createTenantSelectorModal(tenants, (selectedTenantId) => {
      if (onSelect) {
        onSelect(selectedTenantId);
      }
      resolve(selectedTenantId);
      closeModal();
    }, () => {
      resolve(null);
      closeModal();
    });
    
    // Aggiungi al DOM
    document.body.appendChild(modal);
    
    // Mostra modal
    setTimeout(() => {
      modal.classList.add('active');
    }, 10);
    
    function closeModal() {
      modal.classList.remove('active');
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
    }
  });
}

/**
 * Crea elemento modal per selettore tenant
 * @param {Array<Object>} tenants - Array di tenant disponibili
 * @param {Function} onSelect - Callback selezione
 * @param {Function} onCancel - Callback annullamento
 * @returns {HTMLElement} Elemento modal
 */
function createTenantSelectorModal(tenants, onSelect, onCancel) {
  const modal = document.createElement('div');
  modal.className = 'tenant-selector-modal';
  modal.innerHTML = `
    <div class="tenant-selector-overlay"></div>
    <div class="tenant-selector-content">
      <div class="tenant-selector-header">
        <h2>Seleziona Azienda</h2>
        <p>Hai accesso a più aziende. Scegli quale vuoi utilizzare:</p>
      </div>
      <div class="tenant-selector-list">
        ${tenants.map(tenant => `
          <div class="tenant-selector-item" data-tenant-id="${tenant.tenantId}">
            <div class="tenant-selector-item-header">
              <h3>${getTenantName(tenant.tenantId, tenant)}</h3>
              ${tenant.tenantIdPredefinito ? '<span class="tenant-badge">Predefinito</span>' : ''}
            </div>
            <div class="tenant-selector-item-details">
              <div class="tenant-roles">
                <strong>Ruoli:</strong> ${tenant.ruoli && tenant.ruoli.length > 0 ? tenant.ruoli.join(', ') : 'Nessun ruolo'}
              </div>
              <div class="tenant-status">
                <strong>Stato:</strong> <span class="status-${tenant.stato || 'attivo'}">${tenant.stato || 'attivo'}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="tenant-selector-footer">
        <button class="tenant-selector-cancel">Annulla</button>
      </div>
    </div>
  `;
  
  // Aggiungi stili
  addTenantSelectorStyles(modal);
  
  // Aggiungi event listeners
  const items = modal.querySelectorAll('.tenant-selector-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      const tenantId = item.dataset.tenantId;
      onSelect(tenantId);
    });
  });
  
  const cancelButton = modal.querySelector('.tenant-selector-cancel');
  cancelButton.addEventListener('click', onCancel);
  
  const overlay = modal.querySelector('.tenant-selector-overlay');
  overlay.addEventListener('click', onCancel);
  
  return modal;
}

/**
 * Ottieni nome tenant (carica da Firestore o usa ID)
 * @param {string} tenantId - ID tenant
 * @param {Object} tenantData - Dati tenant (opzionale, se disponibile)
 * @returns {string} Nome tenant
 */
function getTenantName(tenantId, tenantData = null) {
  // Se abbiamo dati tenant con nome, usalo
  if (tenantData && tenantData.nome) {
    return tenantData.nome;
  }
  
  // Altrimenti formatta l'ID
  return tenantId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Aggiungi stili CSS al modal
 * @param {HTMLElement} modal - Elemento modal
 */
function addTenantSelectorStyles(modal) {
  const style = document.createElement('style');
  style.textContent = `
    .tenant-selector-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    
    .tenant-selector-modal.active {
      opacity: 1;
      pointer-events: all;
    }
    
    .tenant-selector-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }
    
    .tenant-selector-content {
      position: relative;
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      max-width: 600px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      transform: scale(0.9);
      transition: transform 0.3s ease;
    }
    
    .tenant-selector-modal.active .tenant-selector-content {
      transform: scale(1);
    }
    
    .tenant-selector-header {
      padding: 24px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .tenant-selector-header h2 {
      margin: 0 0 8px 0;
      color: #2E8B57;
      font-size: 24px;
    }
    
    .tenant-selector-header p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }
    
    .tenant-selector-list {
      padding: 16px;
    }
    
    .tenant-selector-item {
      padding: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .tenant-selector-item:hover {
      border-color: #2E8B57;
      background: #f0f8f4;
    }
    
    .tenant-selector-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .tenant-selector-item-header h3 {
      margin: 0;
      color: #333;
      font-size: 18px;
    }
    
    .tenant-badge {
      background: #2E8B57;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
    }
    
    .tenant-selector-item-details {
      font-size: 14px;
      color: #666;
    }
    
    .tenant-roles {
      margin-bottom: 4px;
    }
    
    .tenant-status {
      margin-top: 4px;
    }
    
    .status-attivo {
      color: #2E8B57;
      font-weight: 600;
    }
    
    .status-disattivato {
      color: #dc3545;
      font-weight: 600;
    }
    
    .tenant-selector-footer {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      text-align: right;
    }
    
    .tenant-selector-cancel {
      padding: 10px 20px;
      background: #f5f5f5;
      color: #333;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: background 0.2s ease;
    }
    
    .tenant-selector-cancel:hover {
      background: #e0e0e0;
    }
  `;
  
  document.head.appendChild(style);
}

/**
 * Gestisce selezione tenant
 * @param {string} tenantId - ID tenant selezionato
 * @returns {Promise<boolean>} true se selezione riuscita
 */
export async function handleTenantSelection(tenantId) {
  try {
    await switchTenant(tenantId);
    return true;
  } catch (error) {
    console.error('Errore selezione tenant:', error);
    throw error;
  }
}

/**
 * Verifica accesso utente a un tenant
 * @param {string} userId - ID utente
 * @param {string} tenantId - ID tenant
 * @returns {Promise<boolean>} true se ha accesso
 */
export async function validateTenantAccess(userId, tenantId) {
  const tenants = await getUserTenants(userId);
  return tenants.some(t => t.tenantId === tenantId && t.stato === 'attivo');
}

// Export default
export default {
  showTenantSelector,
  handleTenantSelection,
  validateTenantAccess
};
