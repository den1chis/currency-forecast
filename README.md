# Currency Forecast System

Система прогнозирования валютных курсов с использованием LSTM нейросети.

## Запуск локально

1. Установите зависимости:
```bash
pip install -r requirements.txt
```

2. Запустите сервер:
```bash
uvicorn app.main:app --reload
```

3. Откройте браузер: http://localhost:8000

## Структура проекта

- `app/` - основное приложение FastAPI
- `scripts/` - скрипты для обучения моделей
- `data/` - исходные и обработанные данные

## Валютные пары

- USD/KZT
- EUR/KZT
- RUB/KZT
- EUR/USD
- GBP/USD
```

### **4. Создайте `Procfile` (для Render/Railway):**
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT