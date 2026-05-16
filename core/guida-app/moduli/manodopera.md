# Modulo Manodopera

La guida utente aggiornata e il riferimento tecnico Tony sono in **`docs-sviluppo/GUIDA/MANODOPERA/`**: indice `utente/guida.md`, guide per ruolo `utente/guida-manager.md`, `guida-caposquadra.md`, `guida-operaio.md`, sintesi Tony `utente/guida-sintesi.md`, tecnico `tony/guida-tecnica.md`. In `core/services/tony-service.js` la guida lunga concatena **tutti** i file `utente` in ordine (intro + manager + caposquadra + operaio) poi la guida tecnica.

Anteprima HTML con scelta ruolo: `documentazione-utente/guida-manodopera-utente.html` (`?ruolo=manager|caposquadra|operaio`).
