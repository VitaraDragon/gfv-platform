/**
 * Caricamento Google Maps API per pagine VM
 * @module modules/vendemmia-meccanica/js/vm-maps-loader
 */

let loadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Script load failed')));
      if (existing.dataset.loaded === '1') resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      script.dataset.loaded = '1';
      resolve();
    };
    script.onerror = () => reject(new Error('Script load failed: ' + src));
    document.head.appendChild(script);
  });
}

function resolveApiKey() {
  if (window.googleMapsConfig?.apiKey) return window.googleMapsConfig.apiKey;
  if (window.GOOGLE_MAPS_API_KEY) return window.GOOGLE_MAPS_API_KEY;
  return null;
}

/**
 * @returns {Promise<boolean>} true se google.maps è disponibile
 */
export async function loadVmGoogleMaps() {
  if (typeof google !== 'undefined' && google.maps && google.maps.geometry) {
    window.googleMapsReady = true;
    return true;
  }
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      if (!window.GOOGLE_MAPS_API_KEY && !window.googleMapsConfig) {
        try {
          await loadScript('../../../core/config/google-maps-config.js');
        } catch (e) {
          /* fallback opzionale */
        }
      }

      const apiKey = resolveApiKey();
      if (!apiKey) {
        console.warn('Google Maps API key non configurata');
        return false;
      }

      await new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          window.googleMapsReady = true;
          resolve(true);
        };
        const cbName = 'initVmGoogleMapsCallback';
        window[cbName] = done;
        const url = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) +
          '&libraries=geometry&loading=async&callback=' + cbName;
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.defer = true;
        script.onerror = () => done();
        document.head.appendChild(script);
        setTimeout(() => {
          if (typeof google !== 'undefined' && google.maps) done();
        }, 15000);
      });

      return typeof google !== 'undefined' && !!google.maps;
    } catch (err) {
      console.warn('loadVmGoogleMaps:', err);
      return false;
    }
  })();

  return loadPromise;
}

export default { loadVmGoogleMaps };
