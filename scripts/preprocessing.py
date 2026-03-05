"""
Скрипт для расчёта технических индикаторов
"""

import pandas as pd
import numpy as np
from pathlib import Path

# Настройка путей
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"
PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

def calculate_rsi(data, period=14):
    """Расчёт RSI (Relative Strength Index)"""
    delta = data['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(data, fast=12, slow=26, signal=9):
    """Расчёт MACD"""
    exp1 = data['close'].ewm(span=fast, adjust=False).mean()
    exp2 = data['close'].ewm(span=slow, adjust=False).mean()
    
    macd = exp1 - exp2
    signal_line = macd.ewm(span=signal, adjust=False).mean()
    histogram = macd - signal_line
    
    return macd, signal_line, histogram

def calculate_bollinger_bands(data, period=20, std_dev=2):
    """Расчёт полос Боллинджера"""
    sma = data['close'].rolling(window=period).mean()
    std = data['close'].rolling(window=period).std()
    
    upper_band = sma + (std * std_dev)
    lower_band = sma - (std * std_dev)
    
    return sma, upper_band, lower_band

def calculate_sma(data, periods=[7, 21, 50]):
    """Расчёт простых скользящих средних"""
    smas = {}
    for period in periods:
        smas[f'sma_{period}'] = data['close'].rolling(window=period).mean()
    return smas

def calculate_ema(data, period=12):
    """Расчёт экспоненциальной скользящей средней"""
    return data['close'].ewm(span=period, adjust=False).mean()

def calculate_volatility(data, period=20):
    """Расчёт волатильности"""
    returns = data['close'].pct_change()
    volatility = returns.rolling(window=period).std() * np.sqrt(252)  # Годовая волатильность
    return volatility

def process_pair(filename):
    """Обработка одной валютной пары"""
    pair_name = filename.stem.replace('_', '/')
    print(f"\nОбработка {pair_name}...")
    
    # Загружаем данные
    filepath = RAW_DIR / filename
    print(f"  Читаю: {filepath}")
    data = pd.read_csv(filepath, index_col=0, parse_dates=True)
    
    # Рассчитываем индикаторы
    print("  Расчёт RSI...")
    data['rsi'] = calculate_rsi(data)
    
    print("  Расчёт MACD...")
    data['macd'], data['macd_signal'], data['macd_hist'] = calculate_macd(data)
    
    print("  Расчёт полос Боллинджера...")
    data['bb_sma'], data['bb_upper'], data['bb_lower'] = calculate_bollinger_bands(data)
    
    print("  Расчёт SMA...")
    smas = calculate_sma(data)
    for name, values in smas.items():
        data[name] = values
    
    print("  Расчёт EMA...")
    data['ema_12'] = calculate_ema(data, 12)
    
    print("  Расчёт волатильности...")
    data['volatility'] = calculate_volatility(data)
    
    # Удаляем строки с NaN
    data = data.dropna()
    
    # ОТЛАДКА: показываем полный путь
    output_file = PROCESSED_DIR / filename
    print(f"  СОХРАНЯЮ В: {output_file.absolute()}")
    
    # Сохраняем
    data.to_csv(output_file)
    
    # ОТЛАДКА: проверяем что файл создался
    import os
    if os.path.exists(output_file):
        size = os.path.getsize(output_file)
        print(f"  ✓ ФАЙЛ СОЗДАН! Размер: {size} байт")
    else:
        print(f"  ✗ ФАЙЛ НЕ СОЗДАН!")
    
    print(f"  ✓ Сохранено {len(data)} записей с индикаторами")
    print(f"  Период: {data.index[0].date()} - {data.index[-1].date()}")
    print(f"  Средний курс: {data['close'].mean():.2f}")
    print(f"  Средний RSI: {data['rsi'].mean():.2f}")
    
    return data

def main():
    """Основная функция обработки"""
    print("=" * 60)
    print("РАСЧЁТ ТЕХНИЧЕСКИХ ИНДИКАТОРОВ")
    print("=" * 60)
    
    # Находим все CSV файлы
    csv_files = list(RAW_DIR.glob("*.csv"))
    
    if not csv_files:
        print("✗ Файлы данных не найдены!")
        print(f"  Убедитесь что выполнен скрипт download_data.py")
        print(f"  Ожидаемая папка: {RAW_DIR}")
        return
    
    print(f"Найдено файлов: {len(csv_files)}")
    
    # Обрабатываем каждый файл
    for csv_file in csv_files:
        try:
            process_pair(csv_file)
        except Exception as e:
            print(f"✗ Ошибка при обработке {csv_file.name}: {str(e)}")
    
    print("\n" + "=" * 60)
    print("ОБРАБОТКА ЗАВЕРШЕНА")
    print("=" * 60)
    print(f"Обработанные данные: {PROCESSED_DIR}")

if __name__ == "__main__":
    main()