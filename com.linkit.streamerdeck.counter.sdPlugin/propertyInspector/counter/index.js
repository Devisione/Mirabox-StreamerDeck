/// <reference path="../utils/common.js" />
/// <reference path="../utils/action.js" />

const $local = true, $back = false, $dom = {
    main: $('.sdpi-wrapper'),
    countInput: $('#countInput'),
    obsEnabled: $('#obsEnabled'),
    obsWebSocketUrl: $('#obsWebSocketUrl'),
    obsWebSocketPassword: $('#obsWebSocketPassword'),
    obsTextSourceName: $('#obsTextSourceName'),
    obsSettings: $('#obsSettings')
};

const $propEvent = {
    didReceiveGlobalSettings({ settings }) {
    },
    
    didReceiveSettings(data) {
        console.log('didReceiveSettings called:', data);
        const settings = data.settings || {};
        
        // Заполняем все поля значениями из настроек
        if ($dom.countInput) $dom.countInput.value = settings.count ?? 0;
        if ($dom.obsEnabled) $dom.obsEnabled.checked = settings.obsEnabled ?? false;
        if ($dom.obsWebSocketUrl) $dom.obsWebSocketUrl.value = settings.obsWebSocketUrl ?? 'ws://localhost:4455';
        if ($dom.obsWebSocketPassword) $dom.obsWebSocketPassword.value = settings.obsWebSocketPassword ?? '';
        if ($dom.obsTextSourceName) $dom.obsTextSourceName.value = settings.obsTextSourceName ?? 'CounterText';
        
        // Обновляем видимость полей OBS
        updateOBSSettingsVisibility();
    },
    
    sendToPropertyInspector(data) {
        console.log('sendToPropertyInspector received:', data);
        
        if (data && data.action === 'updateCount') {
            if ($dom.countInput) {
                $dom.countInput.value = data.count || 0;
            }
        }
    }
};

function updateOBSSettingsVisibility() {
    if (!$dom.obsSettings) return;
    
    const enabled = $dom.obsEnabled ? $dom.obsEnabled.checked : false;
    
    if (enabled) {
        $dom.obsSettings.style.display = 'block';
        if ($dom.obsWebSocketUrl) $dom.obsWebSocketUrl.disabled = false;
        if ($dom.obsWebSocketPassword) $dom.obsWebSocketPassword.disabled = false;
        if ($dom.obsTextSourceName) $dom.obsTextSourceName.disabled = false;
    } else {
        $dom.obsSettings.style.display = 'none';
        if ($dom.obsWebSocketUrl) $dom.obsWebSocketUrl.disabled = true;
        if ($dom.obsWebSocketPassword) $dom.obsWebSocketPassword.disabled = true;
        if ($dom.obsTextSourceName) $dom.obsTextSourceName.disabled = true;
    }
}

// Обработчики событий - используем $settings Proxy напрямую
if ($dom.countInput) {
    $dom.countInput.on('change', function() {
        if ($settings) {
            $settings.count = parseInt(this.value) || 0;
            
            // Отправляем обновление в плагин
            if ($websocket && $websocket.sendToPlugin) {
                $websocket.sendToPlugin({
                    action: 'updateCount',
                    count: $settings.count
                });
            }
        }
    });
}

if ($dom.obsEnabled) {
    $dom.obsEnabled.on('change', function() {
        updateOBSSettingsVisibility();
        if ($settings) {
            $settings.obsEnabled = this.checked;
        }
    });
}

if ($dom.obsWebSocketUrl) {
    $dom.obsWebSocketUrl.on('change', function() {
        if ($settings) {
            $settings.obsWebSocketUrl = this.value || 'ws://localhost:4455';
        }
    });
}

if ($dom.obsWebSocketPassword) {
    $dom.obsWebSocketPassword.on('change', function() {
        if ($settings) {
            $settings.obsWebSocketPassword = this.value || '';
        }
    });
}

if ($dom.obsTextSourceName) {
    $dom.obsTextSourceName.on('change', function() {
        if ($settings) {
            $settings.obsTextSourceName = this.value || 'CounterText';
        }
    });
}

// Исправляем локализацию после загрузки action.js
setTimeout(() => {
    updateOBSSettingsVisibility();
    
    // Исправляем undefined в локализации
    if ($lang) {
        const walker = document.createTreeWalker($dom.main, NodeFilter.SHOW_TEXT, (e) => {
            return e.data.trim() && NodeFilter.FILTER_ACCEPT;
        });
        
        while (walker.nextNode()) {
            const originalText = walker.currentNode.data.trim();
            // Если текст - это ключ локализации и он не был переведен (undefined)
            if (originalText.startsWith('counter.')) {
                const translated = $lang[originalText];
                if (translated && translated !== undefined && translated !== 'undefined') {
                    walker.currentNode.data = translated;
                }
            }
        }
    }
}, 300);
