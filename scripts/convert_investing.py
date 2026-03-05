"""
Конвертация данных из формата Investing.com для всех валютных пар
"""

import pandas as pd
from pathlib import Path

# Пути
BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"

# Валютные пары для конвертации
PAIRS = ['USD_KZT', 'EUR_KZT', 'RUB_KZT', 'CNY_KZT', 'GBP_KZT']

def convert_investing_csv(input_file, output_name):
    """
    Конвертирует CSV с investing.com в нужный формат
    """
    print(f"\nКонвертирую {output_name}...")
    
    # Читаем файл
    data = pd.read_csv(input_file)
    
    # Преобразуем колонки (данные уже числовые)
    data_converted = pd.DataFrame({
        'open': pd.to_numeric(data['Open'], errors='coerce'),
        'high': pd.to_numeric(data['High'], errors='coerce'),
        'low': pd.to_numeric(data['Low'], errors='coerce'),
        'close': pd.to_numeric(data['Price'], errors='coerce'),
        'volume': 1000000  # Заглушка
    })
    
    # Конвертируем даты (формат MM/DD/YYYY)
    data_converted.index = pd.to_datetime(data['Date'], format='%m/%d/%Y')
    
    # Сортируем по возрастанию
    data_converted = data_converted.sort_index()
    
    # Удаляем строки с NaN
    data_converted = data_converted.dropna()
    
    print(f"  ✓ {len(data_converted)} записей")
    print(f"  Период: {data_converted.index[0].date()} - {data_converted.index[-1].date()}")
    print(f"  Средний курс: {data_converted['close'].mean():.2f}")
    
    # Сохраняем
    output_file = RAW_DIR / f"{output_name}.csv"
    data_converted.to_csv(output_file)
    print(f"  Сохранено: {output_file.name}")
    
    return data_converted

def main():
    """Основная функция"""
    print("=" * 60)
    print("КОНВЕРТАЦИЯ ДАННЫХ ВСЕХ ВАЛЮТНЫХ ПАР")
    print("=" * 60)
    
    results = {}
    
    for pair in PAIRS:
        # Ищем файл с суффиксом _investing
        input_file = RAW_DIR / f"{pair}_investing.csv"
        
        if not input_file.exists():
            print(f"\n✗ {pair}: файл не найден ({input_file.name})")
            continue
        
        try:
            data = convert_investing_csv(input_file, pair)
            results[pair] = data
        except Exception as e:
            print(f"\n✗ Ошибка при обработке {pair}: {str(e)}")
    
    print("\n" + "=" * 60)
    print("ИТОГИ КОНВЕРТАЦИИ")
    print("=" * 60)
    
    for pair, data in results.items():
        print(f"✓ {pair.replace('_', '/')}: {len(data)} дней")
    
    missing = set(PAIRS) - set(results.keys())
    if missing:
        print("\n⚠ Не хватает данных для:")
        for pair in missing:
            print(f"  - {pair.replace('_', '/')}")
    
    print("\n✓ ГОТОВО! Теперь запустите:")
    print("  python scripts/preprocessing.py")

if __name__ == "__main__":
    main()