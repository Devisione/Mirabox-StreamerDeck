const { Plugins, Actions, log, EventEmitter } = require('./utils/plugin');
const WebSocket = require('ws');
const crypto = require('crypto');

const plugin = new Plugins('counter');

log.info('Plugin initialized');
log.info('Plugin process PID:', process.pid);
log.info('Plugin will keep running in background');

let counterContexts = {};
let longPressTimers = {};
let currentContexts = {};
let settingsCache = {};

// OBS WebSocket соединения для каждого контекста
let obsConnections = {}; // { context: { ws, textSourceName, connected, enabled, authenticated, url } }
let connectionCheckInterval = null; // Интервал для периодической проверки подключений

// Обновление всех контекстов с одинаковым OBS URL при успешном подключении
function updateAllContextsWithSameURL(url) {
    Object.keys(settingsCache).forEach(context => {
        const settings = settingsCache[context];
        if (settings && settings.obsEnabled && settings.obsWebSocketUrl === url) {
            updateButtonDisplay(context);
        }
    });
}

// Подключение к OBS WebSocket 5.x с правильной аутентификацией
function connectToOBS(context, url, password, textSourceName) {
    log.info(`[${context}] Starting OBS connection to ${url}`);
    
    // Закрываем старое соединение если есть
    if (obsConnections[context] && obsConnections[context].ws) {
        if (obsConnections[context].ws.readyState === WebSocket.OPEN) {
            log.info(`[${context}] Closing existing OBS connection`);
            obsConnections[context].ws.close();
        }
        delete obsConnections[context];
    }

    obsConnections[context] = {
        textSourceName: textSourceName,
        connected: false,
        authenticated: false,
        enabled: true,
        ws: null,
        password: password || '',
        url: url
    };
    
    try {
        log.info(`[${context}] Creating WebSocket connection to OBS: ${url}`);
        const ws = new WebSocket(url);
        obsConnections[context].ws = ws;

        ws.on('open', () => {
            log.info(`[${context}] OBS WebSocket opened successfully`);
            log.info(`[${context}] Active OBS connections count: ${Object.keys(obsConnections).length}`);
        });

        ws.on('error', (error) => {
            log.error(`[${context}] OBS WebSocket error:`, error);
            obsConnections[context].connected = false;
            obsConnections[context].authenticated = false;
            // Обновляем отображение для всех контекстов с тем же OBS URL
            updateAllContextsWithSameURL(url);
        });

        ws.on('close', () => {
            log.info(`[${context}] OBS WebSocket closed`);
            obsConnections[context].connected = false;
            obsConnections[context].authenticated = false;
            // Обновляем отображение для всех контекстов с тем же OBS URL
            updateAllContextsWithSameURL(url);
        });
        
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                log.info(`[${context}] OBS WebSocket message:`, JSON.stringify(message));
                
                // OBS WebSocket 5.x протокол
                if (message.op === 0) {
                    // Hello - начальное сообщение
                    log.info(`[${context}] Received Hello from OBS`);
                    
                    const helloData = message.d;
                    const authenticationRequired = helloData.authentication;
                    
                    if (authenticationRequired && password) {
                        // Нужна аутентификация
                        const authSalt = helloData.authentication.salt;
                        const authChallenge = helloData.authentication.challenge;
                        
                        // Генерируем auth response согласно OBS WebSocket 5.x протоколу
                        const authSecret = crypto
                            .createHash('sha256')
                            .update(password + authSalt)
                            .digest('base64');
                        
                        const authResponse = crypto
                            .createHash('sha256')
                            .update(authSecret + authChallenge)
                            .digest('base64');
                        
                        // Отправляем Identify
                        const identify = {
                            op: 1,
                            d: {
                                rpcVersion: helloData.rpcVersion,
                                authentication: authResponse,
                                eventSubscriptions: 0
                            }
                        };
                        
                        log.info(`[${context}] Sending Identify with authentication`);
                        ws.send(JSON.stringify(identify));
                    } else {
                        // Аутентификация не требуется
                        const identify = {
                            op: 1,
                            d: {
                                rpcVersion: helloData.rpcVersion,
                                eventSubscriptions: 0
                            }
                        };
                        
                        log.info(`[${context}] Sending Identify without authentication`);
                        ws.send(JSON.stringify(identify));
                    }
                } else if (message.op === 2) {
                    // Identified - успешная аутентификация
                    log.info(`[${context}] Successfully authenticated with OBS`);
                    obsConnections[context].connected = true;
                    obsConnections[context].authenticated = true;
                    // Обновляем отображение для всех контекстов с тем же OBS URL
                    if (obsConnections[context] && obsConnections[context].url) {
                        updateAllContextsWithSameURL(obsConnections[context].url);
                    }
                } else if (message.op === 8) {
                    // Event - события от OBS
                    log.info(`[${context}] OBS Event:`, message.d);
                } else if (message.op === 9) {
                    // RequestResponse - ответ на запрос
                    log.info(`[${context}] OBS RequestResponse:`, message.d);
                }
            } catch (err) {
                log.error(`[${context}] Error parsing OBS message:`, err);
            }
        });
    } catch (error) {
        log.error(`[${context}] Error creating OBS WebSocket:`, error);
        log.error(`[${context}] Error stack:`, error.stack);
        obsConnections[context].connected = false;
        obsConnections[context].authenticated = false;
        // Обновляем отображение для всех контекстов с тем же OBS URL
        updateAllContextsWithSameURL(url);
    }
}

// Обновление текстового источника в OBS
function updateOBSTextSource(context) {
    const conn = obsConnections[context];
    
    if (!conn || !conn.enabled) {
        return;
    }
    
    if (!conn.authenticated || !conn.ws || conn.ws.readyState !== WebSocket.OPEN) {
        if (!conn.authenticated) {
            log.warn(`[${context}] OBS not authenticated yet, skipping update`);
        }
        return;
    }

    if (!conn.textSourceName) {
        return;
    }

    const count = counterContexts[context] || 0;
    
    try {
        // OBS WebSocket 5.x Request format
        const request = {
            op: 6,
            d: {
                requestType: 'SetInputSettings',
                requestId: Date.now().toString(),
                requestData: {
                    inputName: conn.textSourceName,
                    inputSettings: {
                        text: count.toString()
                    }
                }
            }
        };
        
        log.info(`[${context}] Sending OBS update:`, JSON.stringify(request));
        conn.ws.send(JSON.stringify(request));
    } catch (error) {
        log.error(`[${context}] Error updating OBS text source:`, error);
    }
}

// Проверка подключения для конкретного контекста
function checkConnectionForContext(context) {
    const settings = settingsCache[context];
    if (!settings || !settings.obsEnabled) {
        return; // OBS не включен для этого контекста
    }
    
    const conn = obsConnections[context];
    
    // Если соединения нет или оно не аутентифицировано, пытаемся подключиться
    if (!conn || !conn.authenticated) {
        if (settings.obsWebSocketUrl && settings.obsTextSourceName) {
            log.info(`[${context}] Reconnecting to OBS (periodic check)`);
            connectToOBS(
                context,
                settings.obsWebSocketUrl,
                settings.obsWebSocketPassword || '',
                settings.obsTextSourceName
            );
        }
    } else if (conn && conn.ws) {
        // Проверяем состояние соединения
        if (conn.ws.readyState !== WebSocket.OPEN) {
            log.info(`[${context}] Connection is not open (state: ${conn.ws.readyState}), reconnecting`);
            conn.connected = false;
            conn.authenticated = false;
            if (settings.obsWebSocketUrl && settings.obsTextSourceName) {
                connectToOBS(
                    context,
                    settings.obsWebSocketUrl,
                    settings.obsWebSocketPassword || '',
                    settings.obsTextSourceName
                );
            }
        }
    }
}

// Функция для логирования состояния всех соединений
function logConnectionStatus() {
    const contexts = Object.keys(settingsCache);
    const connections = Object.keys(obsConnections);
    
    log.info('=== Connection Status ===');
    log.info(`Active contexts: ${contexts.length}`);
    log.info(`Active OBS connections: ${connections.length}`);
    
    contexts.forEach(context => {
        const settings = settingsCache[context];
        const conn = obsConnections[context];
        
        log.info(`Context ${context}:`);
        log.info(`  - OBS enabled: ${settings?.obsEnabled}`);
        log.info(`  - OBS URL: ${settings?.obsWebSocketUrl}`);
        log.info(`  - Connection exists: ${!!conn}`);
        
        if (conn) {
            const wsState = conn.ws ? conn.ws.readyState : 'N/A';
            const wsStateNames = {
                0: 'CONNECTING',
                1: 'OPEN',
                2: 'CLOSING',
                3: 'CLOSED'
            };
            log.info(`  - WebSocket state: ${wsStateNames[wsState] || wsState}`);
            log.info(`  - Authenticated: ${conn.authenticated}`);
            log.info(`  - Connected: ${conn.connected}`);
        }
    });
    log.info('=== End Connection Status ===');
}

// Периодическая проверка всех подключений
function startConnectionCheckInterval() {
    if (connectionCheckInterval) {
        log.info('Connection check interval already running');
        return; // Интервал уже запущен
    }
    
    log.info('Starting periodic OBS connection check interval (every 12 seconds)');
    logConnectionStatus();
    
    connectionCheckInterval = setInterval(() => {
        const activeContexts = Object.keys(settingsCache).length;
        const activeConnections = Object.keys(obsConnections).length;
        log.info(`Periodic OBS connection check - Contexts: ${activeContexts}, Connections: ${activeConnections}`);
        
        Object.keys(settingsCache).forEach(context => {
            checkConnectionForContext(context);
        });
        
        // Логируем статус каждые 5 проверок (примерно раз в минуту)
        if (Math.random() < 0.2) {
            logConnectionStatus();
        }
    }, 12000); // Проверка каждые 12 секунд
    
    log.info('Started periodic OBS connection check interval');
}

function stopConnectionCheckInterval() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
        log.info('Stopped periodic OBS connection check interval');
    }
}

function updateButtonDisplay(context) {
    if (!context) {
        log.error('updateButtonDisplay called without context');
        return;
    }
    
    const count = counterContexts[context] || 0;
    
    log.info(`[${context}] Updating display, count: ${count}`);
    
    try {
        // Проверяем, нужно ли показывать "???"
        const settings = settingsCache[context];
        let displayText = count.toString();
        
        if (settings && settings.obsEnabled) {
            // Если OBS включен, проверяем подключение
            // Проверяем все соединения с тем же URL, так как они могут использовать одно соединение
            const conn = obsConnections[context];
            if (!conn || !conn.authenticated) {
                // OBS включен, но не подключен - показываем "???"
                displayText = '???';
            }
        }
        
        plugin.setTitle(context, displayText);
        updateOBSTextSource(context);
        
        if (currentContexts[context]) {
            plugin.sendToPropertyInspector({
                action: 'updateCount',
                count: count
            });
        }
    } catch (error) {
        log.error(`[${context}] Error updating button display:`, error);
    }
}

plugin.counter = new Actions({
    default: {
        count: 0,
        obsEnabled: false,
        obsWebSocketUrl: 'ws://localhost:4455',
        obsWebSocketPassword: '',
        obsTextSourceName: 'CounterText'
    },
    
    _propertyInspectorDidAppear({ context }) {
        currentContexts[context] = true;
        log.info(`[${context}] Property Inspector appeared`);
        
        const count = counterContexts[context] || 0;
        plugin.sendToPropertyInspector({
            action: 'updateCount',
            count: count
        });
    },
    
    async _willAppear({ context, payload }) {
        log.info(`[${context}] _willAppear called`, JSON.stringify(payload));
        log.info(`[${context}] Plugin process PID: ${process.pid}`);
        log.info(`[${context}] This plugin instance will work in background`);
        
        const settings = payload.settings || {};
        
        settingsCache[context] = {
            count: settings.count || 0,
            obsEnabled: settings.obsEnabled || false,
            obsWebSocketUrl: settings.obsWebSocketUrl || 'ws://localhost:4455',
            obsWebSocketPassword: settings.obsWebSocketPassword || '',
            obsTextSourceName: settings.obsTextSourceName || 'CounterText'
        };
        
        counterContexts[context] = settingsCache[context].count;
        currentContexts[context] = true;
        
        log.info(`[${context}] Settings loaded - OBS enabled: ${settingsCache[context].obsEnabled}`);
        
        if (settingsCache[context].obsEnabled && settingsCache[context].obsWebSocketUrl && settingsCache[context].obsTextSourceName) {
            log.info(`[${context}] OBS is enabled, connecting to: ${settingsCache[context].obsWebSocketUrl}`);
            connectToOBS(
                context,
                settingsCache[context].obsWebSocketUrl,
                settingsCache[context].obsWebSocketPassword || '',
                settingsCache[context].obsTextSourceName
            );
        } else {
            log.info(`[${context}] OBS is not enabled or settings incomplete`);
        }
        
        // Запускаем периодическую проверку подключений, если еще не запущена
        startConnectionCheckInterval();
        
        updateButtonDisplay(context);
    },
    
    _willDisappear({ context }) {
        log.info(`[${context}] _willDisappear called`);
        
        if (longPressTimers[context]) {
            clearTimeout(longPressTimers[context]);
            delete longPressTimers[context];
        }
        
        if (obsConnections[context] && obsConnections[context].ws) {
            obsConnections[context].ws.close();
            delete obsConnections[context];
        }
        
        delete counterContexts[context];
        delete currentContexts[context];
        delete settingsCache[context];
        
        // Если больше нет активных контекстов, останавливаем периодическую проверку
        if (Object.keys(settingsCache).length === 0) {
            stopConnectionCheckInterval();
        }
    },
    
    _didReceiveSettings({ context, payload }) {
        log.info(`[${context}] _didReceiveSettings called`, JSON.stringify(payload));
        
        const settings = payload.settings || {};
        
        settingsCache[context] = {
            count: settings.count !== undefined ? settings.count : (settingsCache[context]?.count || 0),
            obsEnabled: settings.obsEnabled !== undefined ? settings.obsEnabled : (settingsCache[context]?.obsEnabled || false),
            obsWebSocketUrl: settings.obsWebSocketUrl || settingsCache[context]?.obsWebSocketUrl || 'ws://localhost:4455',
            obsWebSocketPassword: settings.obsWebSocketPassword !== undefined ? settings.obsWebSocketPassword : (settingsCache[context]?.obsWebSocketPassword || ''),
            obsTextSourceName: settings.obsTextSourceName || settingsCache[context]?.obsTextSourceName || 'CounterText'
        };
        
        counterContexts[context] = settingsCache[context].count;
        
        const wasObsEnabled = obsConnections[context]?.enabled || false;
        const nowObsEnabled = settingsCache[context].obsEnabled;
        
        if (nowObsEnabled && settingsCache[context].obsWebSocketUrl && settingsCache[context].obsTextSourceName) {
            const urlChanged = !obsConnections[context] || obsConnections[context].textSourceName !== settingsCache[context].obsTextSourceName ||
                (obsConnections[context].url && obsConnections[context].url !== settingsCache[context].obsWebSocketUrl);
            
            if (!wasObsEnabled || !obsConnections[context] || !obsConnections[context].authenticated || urlChanged) {
                log.info(`[${context}] Connecting to OBS:`, settingsCache[context].obsWebSocketUrl);
                connectToOBS(
                    context,
                    settingsCache[context].obsWebSocketUrl,
                    settingsCache[context].obsWebSocketPassword || '',
                    settingsCache[context].obsTextSourceName
                );
            }
        } else if (!nowObsEnabled && obsConnections[context] && obsConnections[context].ws) {
            log.info(`[${context}] Disconnecting from OBS`);
            obsConnections[context].ws.close();
            delete obsConnections[context];
        }
        
        // Запускаем периодическую проверку подключений, если еще не запущена
        startConnectionCheckInterval();
        
        updateButtonDisplay(context);
    },
    
    keyDown({ context, payload }) {
        log.info(`[${context}] keyDown called`);
        
        longPressTimers[context] = setTimeout(() => {
            counterContexts[context] = 0;
            
            const allSettings = {
                ...settingsCache[context],
                count: 0
            };
            plugin.setSettings(context, allSettings);
            settingsCache[context] = allSettings;
            
            plugin.showOk(context);
            log.info(`[${context}] Long press - resetting counter`);
            
            updateButtonDisplay(context);
            delete longPressTimers[context];
        }, 3000); // 3 секунды для длительного нажатия
    },
    
    keyUp({ context, payload }) {
        log.info(`[${context}] keyUp called`);
        
        if (longPressTimers[context]) {
            clearTimeout(longPressTimers[context]);
            delete longPressTimers[context];
            
            // Проверяем, нужно ли делать повторное подключение к OBS
            const settings = settingsCache[context];
            if (settings && settings.obsEnabled) {
                const conn = obsConnections[context];
                if (!conn || !conn.authenticated) {
                    // OBS включен, но не подключен - делаем повторное подключение
                    log.info(`[${context}] Reconnecting to OBS on button press`);
                    if (settings.obsWebSocketUrl && settings.obsTextSourceName) {
                        connectToOBS(
                            context,
                            settings.obsWebSocketUrl,
                            settings.obsWebSocketPassword || '',
                            settings.obsTextSourceName
                        );
                        // Отображение обновится автоматически при успешной аутентификации
                    }
                    return;
                }
            }
            
            counterContexts[context] = (counterContexts[context] || 0) + 1;
            
            const allSettings = {
                ...settingsCache[context],
                count: counterContexts[context]
            };
            plugin.setSettings(context, allSettings);
            settingsCache[context] = allSettings;
            
            log.info(`[${context}] Counter incremented to ${counterContexts[context]}`);
            updateButtonDisplay(context);
        }
    },
    
    sendToPlugin({ payload, context }) {
        log.info(`[${context}] sendToPlugin called`, JSON.stringify(payload));
        
        if (payload.action === 'updateCount') {
            const newCount = parseInt(payload.count) || 0;
            counterContexts[context] = newCount;
            
            const allSettings = {
                ...settingsCache[context],
                count: newCount
            };
            plugin.setSettings(context, allSettings);
            settingsCache[context] = allSettings;
            
            log.info(`[${context}] Count updated from Property Inspector: ${newCount}`);
            updateButtonDisplay(context);
        }
    }
});

// Обработка завершения процесса
process.on('SIGINT', () => {
    log.info('SIGINT received, closing OBS connections and exiting');
    stopConnectionCheckInterval();
    Object.values(obsConnections).forEach(conn => {
        if (conn.ws) conn.ws.close();
    });
    process.exit(0);
});

process.on('SIGTERM', () => {
    log.info('SIGTERM received, closing OBS connections and exiting');
    stopConnectionCheckInterval();
    Object.values(obsConnections).forEach(conn => {
        if (conn.ws) conn.ws.close();
    });
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error);
    log.error('Stack:', error.stack);
});

process.on('unhandledRejection', (reason) => {
    log.error('Unhandled Rejection:', reason);
});

// Предотвращаем завершение процесса, если нет активных соединений
// Плагин должен работать в фоне пока есть активные контексты
log.info('Plugin process will keep running in background');
log.info('Process will exit only when StreamDock closes the connection');
