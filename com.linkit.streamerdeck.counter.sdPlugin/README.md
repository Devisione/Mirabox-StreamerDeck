# Counter Plugin for StreamDock / Плагин Counter для StreamDock

[English](#english) | [Русский](#русский)

---

<a name="english"></a>
# Counter Plugin for StreamDock

A simple and convenient counter plugin with OBS Studio integration for StreamDock.

## What does this plugin do?

The Counter plugin allows you to create counters directly on your StreamDock panel. Perfect for tracking:
- Viewer count milestones
- Game scores or kills
- Donation goals
- Stream statistics
- Any other numerical values you want to track

The counter value is displayed on the button and can be automatically updated in OBS Studio via WebSocket connection, making it perfect for live streaming.

## Features

- ✅ **Simple control**: Click to increment (+1), long press (3 seconds) to reset to 0
- ✅ **OBS integration**: Automatically updates text source in OBS Studio
- ✅ **Manual value setting**: Set counter value manually via settings
- ✅ **Independent counters**: Each plugin instance has its own counter
- ✅ **State persistence**: Counter value persists between StreamDock restarts
- ✅ **Visual feedback**: Value displays directly on the button

## Installation

1. Copy the `com.linkit.streamerdeck.counter.sdPlugin` folder to your StreamDock plugins directory
2. Restart StreamDock
3. The plugin will appear in the available plugins list

## How to Use

### Basic Usage

1. **Add the plugin**: Drag the Counter action to your StreamDock panel
2. **Increment counter**: Click the button - counter increases by +1
3. **Reset counter**: Hold the button for 3 seconds - counter resets to 0
4. **View value**: The current count is displayed on the button

### Manual Value Setting

1. Open button settings (click the gear icon or right-click → Settings)
2. Enter desired value in "Current Counter Value" field
3. Value updates automatically

## OBS Studio Integration Setup

### Step 1: Enable OBS WebSocket Server

1. Open OBS Studio
2. Go to `Settings` → `WebSocket Server`
3. Enable "Enable WebSocket Server"
4. Note the port (default: 4455) and password (if set)

### Step 2: Configure Plugin Settings

1. Open Counter button settings
2. Enable "Enable OBS Integration" checkbox
3. Set WebSocket URL:
   - Default: `ws://localhost:4455`
   - If OBS uses a different port, update accordingly
4. Enter password (if OBS WebSocket has password protection)
5. Set Text Source Name (e.g., `CounterText`)

### Step 3: Create Text Source in OBS

1. In OBS Studio, add a new text source:
   - Right-click in Sources → Add → Text (GDI+)
   - Or: Sources → Add → Text (GDI+)
2. Name it exactly as specified in plugin settings (e.g., `CounterText`)
3. The text source will automatically update when counter changes

### Step 4: Test Integration

1. Click the counter button to increment
2. Check that the text in OBS updates automatically
3. Use debug interface (`http://localhost:23519/`) to verify connection status

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Current Counter Value | Manual value setting | 0 |
| Enable OBS Integration | Enable/disable OBS updates | false |
| OBS WebSocket URL | WebSocket connection URL | ws://localhost:4455 |
| OBS WebSocket Password | Password for OBS WebSocket | (empty) |
| OBS Text Source Name | Name of text source in OBS | CounterText |

## Troubleshooting

### Counter not incrementing
- Check that StreamDock is running
- Verify button is properly configured
- Use debug interface to check for errors

### OBS text not updating
1. Verify OBS WebSocket Server is enabled
2. Check WebSocket URL matches OBS settings
3. Ensure text source name in plugin matches exactly (case-sensitive)
4. Verify password is correct (if set)
5. Use debug interface (`http://localhost:23519/`) to check connection status
6. Check OBS logs for errors

### Connection issues
- Ensure OBS Studio is running before enabling integration
- Check firewall settings if using non-localhost URL
- Verify port number matches OBS WebSocket Server port

## Debug Interface

For debugging, use the web interface at:

```
http://localhost:23519/
```

This allows you to:
- View plugin logs in real-time
- Monitor WebSocket connections
- Check counter values
- Track plugin events

## Requirements

- **StreamDock**: version 3.10.188.226 or higher
- **Node.js**: version 20
- **OBS Studio**: version with WebSocket Server support (OBS 28+)
- **OS**: Windows 7+ or macOS 10.11+

## Technical Details

### OBS WebSocket Protocol

The plugin uses OBS WebSocket 5.x protocol:
- Supports password authentication (SHA-256)
- Automatic reconnection on settings change
- Updates text sources via `SetInputSettings` request

### Button Actions

- **Click**: Increments counter by +1
- **Long Press (3 seconds)**: Resets counter to 0

## License

ISC

## Author

LinkIT / Mirabox

---

<a name="русский"></a>
# Плагин Counter для StreamDock

Простой и удобный плагин-счётчик с интеграцией OBS Studio для StreamDock.

## Что делает этот плагин?

Плагин Counter позволяет создавать счётчики прямо на вашей StreamDock панели. Идеально подходит для отслеживания:
- Вех по количеству зрителей
- Игровых очков или убийств
- Целей по донатам
- Статистики стрима
- Любых других числовых значений, которые вы хотите отслеживать

Значение счётчика отображается на кнопке и может автоматически обновляться в OBS Studio через WebSocket соединение, что делает его идеальным для прямой трансляции.

## Возможности

- ✅ **Простое управление**: Нажмите для увеличения (+1), зажмите (3 секунды) для сброса до 0
- ✅ **Интеграция с OBS**: Автоматически обновляет текстовый источник в OBS Studio
- ✅ **Ручная установка значения**: Установите значение счётчика вручную через настройки
- ✅ **Независимые счётчики**: Каждый экземпляр плагина имеет свой собственный счётчик
- ✅ **Сохранение состояния**: Значение счётчика сохраняется между перезапусками StreamDock
- ✅ **Визуальная обратная связь**: Значение отображается прямо на кнопке

## Установка

1. Скопируйте папку `com.linkit.streamerdeck.counter.sdPlugin` в директорию плагинов StreamDock
2. Перезапустите StreamDock
3. Плагин появится в списке доступных плагинов

## Как использовать

### Базовое использование

1. **Добавьте плагин**: Перетащите действие Counter на вашу StreamDock панель
2. **Увеличьте счётчик**: Нажмите на кнопку - счётчик увеличится на +1
3. **Сбросьте счётчик**: Зажмите кнопку на 3 секунды - счётчик сбросится до 0
4. **Просмотрите значение**: Текущий счёт отображается на кнопке

### Ручная установка значения

1. Откройте настройки кнопки (нажмите на иконку шестерёнки или ПКМ → Настройки)
2. Введите желаемое значение в поле "Текущее значение счётчика"
3. Значение обновится автоматически

## Настройка интеграции с OBS Studio

### Шаг 1: Включите OBS WebSocket Server

1. Откройте OBS Studio
2. Перейдите в `Настройки` → `WebSocket Server`
3. Включите "Включить WebSocket Server"
4. Запомните порт (по умолчанию: 4455) и пароль (если установлен)

### Шаг 2: Настройте параметры плагина

1. Откройте настройки кнопки Counter
2. Включите чекбокс "Включить отправку в OBS"
3. Установите URL WebSocket:
   - По умолчанию: `ws://localhost:4455`
   - Если OBS использует другой порт, обновите соответственно
4. Введите пароль (если OBS WebSocket защищён паролем)
5. Установите Название текстового источника (например, `CounterText`)

### Шаг 3: Создайте текстовый источник в OBS

1. В OBS Studio добавьте новый текстовый источник:
   - ПКМ в Источниках → Добавить → Текст (GDI+)
   - Или: Источники → Добавить → Текст (GDI+)
2. Назовите его точно так же, как указано в настройках плагина (например, `CounterText`)
3. Текстовый источник будет автоматически обновляться при изменении счётчика

### Шаг 4: Проверьте интеграцию

1. Нажмите на кнопку счётчика для увеличения
2. Проверьте, что текст в OBS обновляется автоматически
3. Используйте отладочный интерфейс (`http://localhost:23519/`) для проверки статуса соединения

## Настройки

| Настройка | Описание | По умолчанию |
|-----------|----------|--------------|
| Текущее значение счётчика | Ручная установка значения | 0 |
| Включить отправку в OBS | Включить/выключить обновления OBS | false |
| OBS WebSocket URL | URL для подключения WebSocket | ws://localhost:4455 |
| OBS WebSocket Password | Пароль для OBS WebSocket | (пусто) |
| Название текстового источника в OBS | Имя текстового источника в OBS | CounterText |

## Устранение неполадок

### Счётчик не увеличивается
- Проверьте, что StreamDock запущен
- Убедитесь, что кнопка правильно настроена
- Используйте отладочный интерфейс для проверки ошибок

### Текст в OBS не обновляется
1. Убедитесь, что OBS WebSocket Server включён
2. Проверьте, что URL WebSocket совпадает с настройками OBS
3. Убедитесь, что название текстового источника в плагине совпадает точно (с учётом регистра)
4. Проверьте правильность пароля (если установлен)
5. Используйте отладочный интерфейс (`http://localhost:23519/`) для проверки статуса соединения
6. Проверьте логи OBS на наличие ошибок

### Проблемы с подключением
- Убедитесь, что OBS Studio запущен до включения интеграции
- Проверьте настройки firewall, если используется не-localhost URL
- Проверьте номер порта совпадает с портом OBS WebSocket Server

## Интерфейс отладки

Для отладки используйте веб-интерфейс по адресу:

```
http://localhost:23519/
```

Это позволяет:
- Просматривать логи плагина в реальном времени
- Мониторить WebSocket соединения
- Проверять значения счётчиков
- Отслеживать события плагина

## Требования

- **StreamDock**: версия 3.10.188.226 или выше
- **Node.js**: версия 20
- **OBS Studio**: версия с поддержкой WebSocket Server (OBS 28+)
- **ОС**: Windows 7+ или macOS 10.11+

## Технические детали

### Протокол OBS WebSocket

Плагин использует протокол OBS WebSocket 5.x:
- Поддерживает аутентификацию по паролю (SHA-256)
- Автоматическое переподключение при изменении настроек
- Обновление текстовых источников через запрос `SetInputSettings`

### Действия кнопки

- **Нажатие**: Увеличивает счётчик на +1
- **Длительное нажатие (3 секунды)**: Сбрасывает счётчик до 0

## Лицензия

ISC

## Автор

LinkIT / Mirabox