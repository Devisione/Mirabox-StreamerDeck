const { Plugins, Actions, log, EventEmitter } = require('./utils/plugin');
const WebSocket = require('ws');
const crypto = require('crypto');

const plugin = new Plugins('counter');

log.info('Plugin initialized');

let counterContexts = {};
let longPressTimers = {};
let currentContexts = {};
let settingsCache = {};

// OBS WebSocket соединения для каждого контекста
let obsConnections = {}; // { context: { ws, textSourceName, connected, enabled, authenticated } }

// Подключение к OBS WebSocket 5.x с правильной аутентификацией
function connectToOBS(context, url, password, textSourceName) {
    // Закрываем старое соединение если есть
    if (obsConnections[context] && obsConnections[context].ws) {
        if (obsConnections[context].ws.readyState === WebSocket.OPEN) {
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
        password: password || ''
    };
    
    try {
        const ws = new WebSocket(url);
        obsConnections[context].ws = ws;

        ws.on('open', () => {
            log.info(`[${context}] OBS WebSocket opened`);
        });

        ws.on('error', (error) => {
            log.error(`[${context}] OBS WebSocket error:`, error);
            obsConnections[context].connected = false;
            obsConnections[context].authenticated = false;
        });

        ws.on('close', () => {
            log.info(`[${context}] OBS WebSocket closed`);
            obsConnections[context].connected = false;
            obsConnections[context].authenticated = false;
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
        obsConnections[context].connected = false;
        obsConnections[context].authenticated = false;
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

function updateButtonDisplay(context) {
    if (!context) {
        log.error('updateButtonDisplay called without context');
        return;
    }
    
    const count = counterContexts[context] || 0;
    
    log.info(`[${context}] Updating display, count: ${count}`);
    
    try {
        plugin.setTitle(context, count.toString());
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
        
        if (settingsCache[context].obsEnabled && settingsCache[context].obsWebSocketUrl && settingsCache[context].obsTextSourceName) {
            log.info(`[${context}] Connecting to OBS:`, settingsCache[context].obsWebSocketUrl);
            connectToOBS(
                context,
                settingsCache[context].obsWebSocketUrl,
                settingsCache[context].obsWebSocketPassword || '',
                settingsCache[context].obsTextSourceName
            );
        }
        
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
                (obsConnections[context].ws && obsConnections[context].ws.url !== settingsCache[context].obsWebSocketUrl);
            
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

process.on('SIGINT', () => {
    Object.values(obsConnections).forEach(conn => {
        if (conn.ws) conn.ws.close();
    });
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
    log.error('Unhandled Rejection:', reason);
});
