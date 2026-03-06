"""
API эндпоинты для получения данных
"""

from fastapi import APIRouter, HTTPException
import pandas as pd
from pathlib import Path
from typing import Dict, List
from app.models.predictor import CurrencyPredictor
from datetime import datetime, timedelta


router = APIRouter(prefix="/api", tags=["data"])

# Путь к обработанным данным
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data" / "processed"

# Доступные валютные пары
AVAILABLE_PAIRS = ['USD/KZT', 'EUR/KZT', 'RUB/KZT', 'CNY/KZT', 'GBP/KZT']

def load_pair_data(pair: str) -> pd.DataFrame:
    """Загружает данные валютной пары из CSV"""
    # Преобразуем дефис обратно в слэш для имени файла
    pair_with_slash = pair.replace('-', '/')
    filename = pair_with_slash.replace('/', '_') + '.csv'
    filepath = DATA_DIR / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"Данные для пары {pair} не найдены")
    
    data = pd.read_csv(filepath, index_col=0, parse_dates=True)
    return data

def normalize_pair(pair: str) -> str:
    """Преобразует USD-KZT в USD/KZT"""
    return pair.replace('-', '/')

@router.get("/pairs")
async def get_available_pairs():
    """Возвращает список доступных валютных пар"""
    return {"pairs": AVAILABLE_PAIRS}

@router.get("/history/{pair}")
async def get_history(pair: str, days: int = 90):
    """
    Получить историю курса
    
    Args:
        pair: Валютная пара (USD-KZT, EUR-KZT и т.д.)
        days: Количество дней истории (по умолчанию 90)
    """
    pair_normalized = normalize_pair(pair)
    if pair_normalized not in AVAILABLE_PAIRS:
        raise HTTPException(status_code=400, detail=f"Неизвестная пара: {pair}")
    
    data = load_pair_data(pair)
    
    # Берём последние N дней
    data = data.tail(days)
    
    # Формируем ответ
    history = []
    for date, row in data.iterrows():
        history.append({
            "date": date.strftime('%d.%m'),
            "open": round(row['open'], 2),
            "high": round(row['high'], 2),
            "low": round(row['low'], 2),
            "close": round(row['close'], 2),
            "volume": int(row['volume'])
        })
    
    return {
        "pair": pair_normalized,
        "data": history
    }

@router.get("/indicators/{pair}")
async def get_indicators(pair: str, days: int = 90):
    """
    Получить технические индикаторы
    
    Args:
        pair: Валютная пара
        days: Количество дней
    """
    pair_normalized = normalize_pair(pair)
    if pair_normalized not in AVAILABLE_PAIRS:
        raise HTTPException(status_code=400, detail=f"Неизвестная пара: {pair}")
    
    data = load_pair_data(pair)
    data = data.tail(days)
    
    indicators = {
        "dates": [date.strftime('%d.%m') for date in data.index],
        "rsi": [round(x, 2) if pd.notna(x) else None for x in data['rsi']],
        "macd": [round(x, 2) if pd.notna(x) else None for x in data['macd']],
        "macd_signal": [round(x, 2) if pd.notna(x) else None for x in data['macd_signal']],
        "macd_hist": [round(x, 2) if pd.notna(x) else None for x in data['macd_hist']],
        "bb_sma": [round(x, 2) if pd.notna(x) else None for x in data['bb_sma']],
        "bb_upper": [round(x, 2) if pd.notna(x) else None for x in data['bb_upper']],
        "bb_lower": [round(x, 2) if pd.notna(x) else None for x in data['bb_lower']],
        "sma_7": [round(x, 2) if pd.notna(x) else None for x in data['sma_7']],
        "sma_21": [round(x, 2) if pd.notna(x) else None for x in data['sma_21']],
        "sma_50": [round(x, 2) if pd.notna(x) else None for x in data['sma_50']],
    }
    
    return {
        "pair": pair_normalized,
        "indicators": indicators
    }

@router.get("/current/{pair}")
async def get_current_rate(pair: str):
    """
    Получить текущий курс и метрики
    
    Args:
        pair: Валютная пара
    """
    pair_normalized = normalize_pair(pair)
    if pair_normalized not in AVAILABLE_PAIRS:
        raise HTTPException(status_code=400, detail=f"Неизвестная пара: {pair}")
    
    data = load_pair_data(pair)
    
    # Берём последние две записи для расчёта изменения
    last_two = data.tail(2)
    current = last_two.iloc[-1]
    previous = last_two.iloc[-2]
    
    current_rate = round(current['close'], 2)
    day_change = round(current['close'] - previous['close'], 2)
    day_change_pct = round((day_change / previous['close']) * 100, 2)
    
    return {
        "pair": pair_normalized,
        "rate": current_rate,
        "day_change": day_change,
        "day_change_pct": day_change_pct,
        "date": current.name.strftime('%Y-%m-%d'),
        "rsi": round(current['rsi'], 2) if pd.notna(current['rsi']) else None,
        "volume": int(current['volume'])
    }

@router.get("/forecast/{pair}")
async def get_forecast(pair: str, days: int = 30):
    """
    Получить прогноз курса на N дней вперёд
    
    Args:
        pair: Валютная пара
        days: Количество дней для прогноза (по умолчанию 30)
    """
    pair_normalized = normalize_pair(pair)
    if pair_normalized not in AVAILABLE_PAIRS:
        raise HTTPException(status_code=400, detail=f"Неизвестная пара: {pair}")
    
    # Только для USD/KZT пока есть модель
    if pair_normalized != 'USD/KZT':
        raise HTTPException(
            status_code=501, 
            detail=f"Прогноз для {pair_normalized} пока не реализован. Доступно только для USD/KZT"
        )
    
    try:
        # Загружаем исторические данные
        data = load_pair_data(pair)
        historical_prices = data['close'].values
        
        # Создаём предсказатель и делаем прогноз
        predictor = CurrencyPredictor(pair_normalized)
        forecast_result = predictor.forecast(historical_prices, days=days)
        
        # Добавляем даты к прогнозу
        start_date = data.index[-1] + timedelta(days=1)
        for i, forecast_item in enumerate(forecast_result['forecasts']):
            forecast_date = start_date + timedelta(days=i)
            forecast_item['date'] = forecast_date.strftime('%Y-%m-%d')
        
        return forecast_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при создании прогноза: {str(e)}")