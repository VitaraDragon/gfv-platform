/**
 * Un solo elemento audio per tutta la chat di Tony (passo 12b).
 * Senza Vue: il chiamante gestisce gli eventi.
 */

/**
 * @param {{ AudioCtor?: typeof Audio, createObjectURL?: Function, revokeObjectURL?: Function }} [deps]
 */
export function creaPlayerVoce(deps = {}) {
  const AudioCtor = deps.AudioCtor || (typeof Audio !== 'undefined' ? Audio : null);
  const createObjectURL =
    deps.createObjectURL ||
    (typeof URL !== 'undefined' && URL.createObjectURL
      ? URL.createObjectURL.bind(URL)
      : null);
  const revokeObjectURL =
    deps.revokeObjectURL ||
    (typeof URL !== 'undefined' && URL.revokeObjectURL
      ? URL.revokeObjectURL.bind(URL)
      : null);

  const audio = AudioCtor ? new AudioCtor() : null;
  if (audio) {
    try {
      audio.preload = 'auto';
    } catch {
      /* ignore */
    }
  }

  let urlCorrente = null;
  let onFineCorrente = null;
  let risolviCorrente = null;
  let timerAttesa = 0;
  let playingArrivato = false;

  function revoca() {
    if (urlCorrente && revokeObjectURL) {
      try {
        revokeObjectURL(urlCorrente);
      } catch {
        /* ignore */
      }
    }
    urlCorrente = null;
  }

  function pulisciListener() {
    if (!audio) return;
    audio.onplaying = null;
    audio.onended = null;
    audio.onerror = null;
  }

  function termina(esito) {
    if (timerAttesa) {
      clearTimeout(timerAttesa);
      timerAttesa = 0;
    }
    const fine = onFineCorrente;
    const risolvi = risolviCorrente;
    onFineCorrente = null;
    risolviCorrente = null;
    pulisciListener();
    if (typeof fine === 'function') {
      try {
        fine(esito);
      } catch {
        /* ignore */
      }
    }
    if (typeof risolvi === 'function') risolvi(esito);
  }

  return {
    sblocca() {
      if (!audio) return;
      try {
        const p = audio.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            try {
              audio.pause();
            } catch {
              /* ignore */
            }
          }).catch(() => {});
        } else {
          try {
            audio.pause();
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
    },

    /**
     * @param {Blob} blob
     * @param {{ onInizio?: Function, onFine?: (esito: string) => void, attesaMaxMs?: number }} [opts]
     * @returns {Promise<'finita' | 'fallita' | 'interrotta'>}
     */
    suona(blob, opts = {}) {
      if (!audio || !createObjectURL || !blob) {
        return Promise.resolve('fallita');
      }
      this.ferma();
      revoca();
      playingArrivato = false;
      const onInizio = opts.onInizio;
      onFineCorrente = opts.onFine || null;
      const attesaMaxMs =
        typeof opts.attesaMaxMs === 'number' ? opts.attesaMaxMs : 4000;

      return new Promise((resolve) => {
        risolviCorrente = resolve;
        try {
          urlCorrente = createObjectURL(blob);
          audio.src = urlCorrente;
        } catch {
          termina('fallita');
          return;
        }

        audio.onplaying = () => {
          playingArrivato = true;
          if (timerAttesa) {
            clearTimeout(timerAttesa);
            timerAttesa = 0;
          }
          if (typeof onInizio === 'function') {
            try {
              onInizio();
            } catch {
              /* ignore */
            }
          }
        };
        audio.onended = () => {
          revoca();
          termina('finita');
        };
        audio.onerror = () => {
          revoca();
          termina('fallita');
        };

        timerAttesa = setTimeout(() => {
          timerAttesa = 0;
          if (!playingArrivato) {
            try {
              audio.pause();
            } catch {
              /* ignore */
            }
            revoca();
            termina('fallita');
          }
        }, attesaMaxMs);

        let playResult;
        try {
          playResult = audio.play();
        } catch {
          revoca();
          termina('fallita');
          return;
        }
        if (playResult && typeof playResult.then === 'function') {
          playResult.catch(() => {
            revoca();
            termina('fallita');
          });
        }
      });
    },

    ferma() {
      if (!audio) return;
      try {
        audio.pause();
      } catch {
        /* ignore */
      }
      if (risolviCorrente) {
        termina('interrotta');
      }
    },

    libera() {
      this.ferma();
      if (audio) {
        try {
          audio.removeAttribute('src');
          audio.load();
        } catch {
          /* ignore */
        }
      }
      revoca();
    },
  };
}
