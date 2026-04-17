/**
 * Banner opzionale "Installa PWA" per pagine auth (login, registrazione invito).
 * Chrome/Edge: usa l'evento beforeinstallprompt.
 * iOS Safari: mostra solo istruzioni (nessuna API programmatica).
 */
(function () {
    function isStandalone() {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches ||
            window.navigator.standalone === true
        );
    }

    function isLikelyIOS() {
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    var banner = document.getElementById('pwa-install-banner');
    var btn = document.getElementById('pwa-install-btn');
    var iosHint = document.getElementById('pwa-ios-hint');
    var dismiss = document.getElementById('pwa-install-dismiss');

    if (!banner || isStandalone()) {
        return;
    }

    var deferredPrompt = null;

    if (isLikelyIOS()) {
        banner.style.display = 'block';
        if (iosHint) iosHint.style.display = 'block';
    } else {
        window.addEventListener('beforeinstallprompt', function (e) {
            e.preventDefault();
            deferredPrompt = e;
            banner.style.display = 'block';
            if (iosHint) iosHint.style.display = 'none';
            if (btn) btn.style.display = 'inline-block';
        });
    }

    if (btn) {
        btn.addEventListener('click', function () {
            if (!deferredPrompt) {
                return;
            }
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function () {
                deferredPrompt = null;
                banner.style.display = 'none';
            });
        });
    }

    if (dismiss) {
        dismiss.addEventListener('click', function () {
            banner.style.display = 'none';
        });
    }
})();
