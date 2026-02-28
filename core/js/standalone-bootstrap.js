/**
 * Standalone Bootstrap - Motore di avvio unico per pagine standalone GFV
 * Carica config, inizializza Firebase, tenant e inietta Tony.
 * Le pagine includono questo script e usano await window.GFVStandaloneReady.
 *
 * Uso: <script type="module" src=".../standalone-bootstrap.js" data-config-base="../../../core"></script>
 * data-config-base: path relativo alla pagina verso core (vuoto in core/, '../' in admin/, '../../../core' in modules/).
 *
 * @see DOBBIAMO_ANCORA_FARE §1.4, PROPOSTA_SNELLIMENTO §2.1
 */

(function bootstrap() {
  const step = (name) => `[standalone-bootstrap] ${name}`;

  /** Legge data-config-base dal tag script che ha caricato questo modulo */
  function getConfigBaseFromScript() {
    let script = document.currentScript;
    if (!script && typeof document.querySelectorAll === 'function') {
      const selfHref = new URL(import.meta.url).href;
      const list = document.querySelectorAll('script[type="module"][src]');
      for (const s of list) {
        try {
          const srcHref = new URL(s.getAttribute('src'), document.baseURI || window.location.href).href;
          if (srcHref === selfHref) { script = s; break; }
        } catch (_) {}
      }
    }
    if (!script || !script.getAttribute) return undefined;
    const base = script.getAttribute('data-config-base');
    return base != null ? String(base).replace(/\/$/, '') : undefined;
  }

  /** Carica uno script classico e restituisce una Promise che si risolve al onload */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(step('failed to load script: ' + src)));
      document.head.appendChild(s);
    });
  }

  /**
   * Attende che i dati del tenant (azienda) siano disponibili dopo init.
   * Se l'utente non è loggato restituisce null subito; altrimenti fa polling fino a maxWaitMs.
   * @param {Object} tenantService - modulo tenant-service (getCurrentTenantId, getCurrentTenant)
   * @param {Object} firebaseService - modulo firebase-service (getAuthInstance)
   * @param {number} maxWaitMs - timeout in ms (default 8000)
   * @returns {Promise<Object|null>} Dati tenant (con .modules) o null
   */
  async function waitForTenantData(tenantService, firebaseService, maxWaitMs = 8000) {
    const auth = firebaseService.getAuthInstance();
    if (!auth || !auth.currentUser) return null;
    const interval = 150;
    const maxAttempts = Math.ceil(maxWaitMs / interval);
    for (let i = 0; i < maxAttempts; i++) {
      const tenantId = tenantService.getCurrentTenantId();
      if (tenantId) {
        const tenant = await tenantService.getCurrentTenant();
        if (tenant && typeof tenant === 'object') return tenant;
      }
      await new Promise((r) => setTimeout(r, interval));
    }
    return null;
  }

  /** Inietta Tony (CSS + script) usando percorsi risolti da import.meta.url */
  function injectTony() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../styles/tony-widget.css', import.meta.url).href;
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.type = 'module';
    script.src = new URL('tony-widget-standalone.js', import.meta.url).href;
    document.body.appendChild(script);
  }

  const promise = new Promise((resolve, reject) => {
    (async () => {
      try {
        // 1) Contesto: data-config-base → GFV_CONFIG_BASE (per config-loader)
        const dataBase = getConfigBaseFromScript();
        if (dataBase !== undefined) {
          window.GFV_CONFIG_BASE = dataBase;
        }
        // Se non c'è data-config-base, lascia invariato window.GFV_CONFIG_BASE (o '')

        // 2) Caricamento config-loader.js (path agnostico rispetto alla pagina)
        const configLoaderUrl = new URL('config-loader.js', import.meta.url).href;
        await loadScript(configLoaderUrl);

        if (typeof window.GFVConfigLoader === 'undefined') {
          throw new Error(step('GFVConfigLoader not defined after loading config-loader.js'));
        }

        // 3) Config + Google Maps
        await window.GFVConfigLoader.loadConfigAndMaps().catch((err) => {
          throw new Error(step('loadConfigAndMaps failed: ' + (err && err.message ? err.message : String(err))));
        });

        const firebaseConfig = await window.GFVConfigLoader.waitForConfig().catch((err) => {
          throw new Error(step('waitForConfig failed: ' + (err && err.message ? err.message : String(err))));
        });

        if (!firebaseConfig) {
          throw new Error(step('firebaseConfig is missing after waitForConfig'));
        }

        // 4) Firebase
        const firebaseService = await import('../services/firebase-service.js').catch((err) => {
          throw new Error(step('import firebase-service failed: ' + (err && err.message ? err.message : String(err))));
        });
        firebaseService.initializeFirebase(firebaseConfig);

        // 5) Tenant Service: init e attesa primo stato auth (così getCurrentTenantId/getCurrentTenant sono pronti)
        const tenantService = await import('../services/tenant-service.js').catch((err) => {
          throw new Error(step('import tenant-service failed: ' + (err && err.message ? err.message : String(err))));
        });
        const tenantInitPromise = tenantService.initializeTenantService();
        if (tenantInitPromise && typeof tenantInitPromise.then === 'function') {
          await tenantInitPromise;
        }

        // 6) Recupera dati azienda (tenant doc con modules) e rendili disponibili globalmente
        const tenantData = await waitForTenantData(tenantService, firebaseService);
        if (tenantData) {
          const moduli = Array.isArray(tenantData.modules) ? tenantData.modules : [];
          window.__gfvTenantData = tenantData;
          window.__gfvModuliAttivi = moduli;
          window.tenantConfig = { modules: moduli, moduli_attivi: moduli };
          window.tenant = window.tenant || { modules: moduli, moduli_attivi: moduli };
        }

        // 7) Iniezione Tony come ultimo passaggio (Firebase e tenant già pronti)
        injectTony();

        resolve();
      } catch (err) {
        const message = err && err.message ? err.message : String(err);
        console.error(step('bootstrap failed: ' + message), err);
        reject(err);
      }
    })();
  });

  window.GFVStandaloneReady = promise;
})();
