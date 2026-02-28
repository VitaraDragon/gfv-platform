/**
 * Tony Widget – UI: FAB, pannello chat, overlay conferma, appendMessage, showMessageInChat.
 * @module core/js/tony/ui
 */

/**
 * Crea e inietta il widget (FAB, pannello, overlay). Restituisce l'API per appendMessage, removeTyping, showMessageInChat e setSendHandler.
 * @param {string} scriptBase - URL base (import.meta.url del loader)
 * @returns {{ appendMessage: function, removeTyping: function, showMessageInChat: function, setSendHandler: function, setCloseHandler: function, getMessagesEl: function, getInputEl: function }}
 */
export function injectWidget(scriptBase) {
    if (document.getElementById('tony-fab')) {
        var m = document.getElementById('tony-messages');
        var i = document.getElementById('tony-input');
        function appendMessage(text, type) {
            type = type || 'tony';
            var div = document.createElement('div');
            div.className = 'tony-msg ' + type;
            div.textContent = text;
            if (m) { m.appendChild(div); m.scrollTop = m.scrollHeight; }
        }
        function removeTyping() {
            var typing = m ? m.querySelector('.tony-msg.typing') : null;
            if (typing) typing.remove();
        }
        function showMessageInChat(text, type) {
            type = type || 'tony';
            var el = document.getElementById('tony-messages');
            if (el) {
                var d = document.createElement('div');
                d.className = 'tony-msg ' + type;
                d.textContent = text;
                el.appendChild(d);
                el.scrollTop = el.scrollHeight;
            }
        }
        return {
            appendMessage,
            removeTyping,
            showMessageInChat,
            setSendHandler: function() {},
            setCloseHandler: function() {},
            getMessagesEl: function() { return m; },
            getInputEl: function() { return i; }
        };
    }

    var tonyIconUrl = scriptBase ? new URL('../images/tony-icon.png', scriptBase).href : '';
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'tony-widget-fab';
    fab.id = 'tony-fab';
    fab.title = 'Chiedi a Tony';
    fab.setAttribute('aria-label', 'Apri assistente Tony');
    if (tonyIconUrl) {
        var fabImg = document.createElement('img');
        fabImg.src = tonyIconUrl;
        fabImg.alt = 'Tony';
        fabImg.className = 'tony-fab-icon';
        fabImg.onerror = function() { fab.innerHTML = ''; fab.textContent = '\uD83E\uDD16'; };
        fab.appendChild(fabImg);
    } else {
        fab.textContent = '\uD83E\uDD16';
    }

    var panel = document.createElement('div');
    panel.className = 'tony-widget-panel';
    panel.id = 'tony-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Chat con Tony');
    var headerContent = tonyIconUrl
        ? '<img src="' + tonyIconUrl + '" alt="" class="tony-header-icon" onerror="this.style.display=\'none\'"> Tony – Assistente'
        : '\uD83E\uDD16 Tony – Assistente';
    panel.innerHTML = '<div class="tony-widget-header">' +
        '<h2>' + headerContent + '</h2>' +
        '<button type="button" class="tony-widget-close" id="tony-close" aria-label="Chiudi">×</button>' +
        '</div>' +
        '<div class="tony-widget-messages" id="tony-messages"></div>' +
        '<div class="tony-widget-voice-confirm" id="tony-voice-confirm" style="display:none">' +
        '<span class="tony-voice-confirm-text">Hai detto: «<em id="tony-voice-transcript"></em>»</span>' +
        '<div class="tony-voice-confirm-actions">' +
        '<button type="button" class="tony-voice-confirm-cancel" id="tony-voice-cancel">Annulla</button>' +
        '<button type="button" class="tony-voice-confirm-ok" id="tony-voice-ok">Invia</button>' +
        '</div></div>' +
        '<div class="tony-widget-input-row">' +
        '<button type="button" class="tony-widget-mic" id="tony-mic" title="Clicca per attivare dialogo continuo (mani libere)" aria-label="Microfono">🎤</button>' +
        '<input type="text" class="tony-widget-input" id="tony-input" placeholder="Scrivi un messaggio..." autocomplete="off" maxlength="2000">' +
        '<button type="button" class="tony-widget-send" id="tony-send">Invia</button>' +
        '</div>';

    var overlay = document.createElement('div');
    overlay.className = 'tony-confirm-overlay';
    overlay.id = 'tony-confirm-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-labelledby', 'tony-confirm-title');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.display = 'none';
    overlay.innerHTML = '<div class="tony-confirm-box">' +
        '<h3 class="tony-confirm-title" id="tony-confirm-title">Aprire pagina?</h3>' +
        '<p class="tony-confirm-message" id="tony-confirm-message"></p>' +
        '<div class="tony-confirm-actions">' +
        '<button type="button" class="tony-confirm-btn tony-confirm-cancel" id="tony-confirm-cancel">Annulla</button>' +
        '<button type="button" class="tony-confirm-btn tony-confirm-ok" id="tony-confirm-ok">Apri</button>' +
        '</div></div>';

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    document.body.appendChild(overlay);

    var messagesEl = document.getElementById('tony-messages');
    var inputEl = document.getElementById('tony-input');
    var sendBtn = document.getElementById('tony-send');
    var closeBtn = document.getElementById('tony-close');

    function appendMessage(text, type) {
        type = type || 'tony';
        var div = document.createElement('div');
        div.className = 'tony-msg ' + type;
        div.textContent = text;
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function removeTyping() {
        var typing = messagesEl.querySelector('.tony-msg.typing');
        if (typing) typing.remove();
    }

    function showMessageInChat(text, type) {
        type = type || 'tony';
        var el = document.getElementById('tony-messages');
        if (el) {
            var d = document.createElement('div');
            d.className = 'tony-msg ' + type;
            d.textContent = text;
            el.appendChild(d);
            el.scrollTop = el.scrollHeight;
        }
    }

    fab.addEventListener('click', function() { panel.classList.toggle('tony-widget-panel-open'); });
    closeBtn.addEventListener('click', function() { panel.classList.remove('tony-widget-panel-open'); });

    return {
        appendMessage,
        removeTyping,
        showMessageInChat,
        setSendHandler: function(fn) { if (sendBtn && fn) sendBtn.onclick = fn; },
        setCloseHandler: function(fn) { if (closeBtn && fn) closeBtn.onclick = fn; },
        getMessagesEl: function() { return messagesEl; },
        getInputEl: function() { return inputEl; }
    };
}
