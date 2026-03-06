"""
Класс для загрузки модели и создания прогнозов
"""

import numpy as np
import pandas as pd
import pickle
from pathlib import Path
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Bidirectional, Dense, Dropout

class CurrencyPredictor:
    """Предсказатель курсов валют на основе LSTM модели"""
    
    def __init__(self, pair: str):
        """
        Args:
            pair: Валютная пара (USD/KZT, EUR/KZT и т.д.)
        """
        self.pair = pair
        self.seq_length = 60
        
        # Пути к файлам
        BASE_DIR = Path(__file__).resolve().parent.parent.parent
        MODELS_DIR = BASE_DIR / "app" / "models" / "saved"
        
        # Создаём архитектуру модели заново
        self.model = Sequential([
            Bidirectional(LSTM(128, return_sequences=True), input_shape=(self.seq_length, 1)),
            Dropout(0.2),
            
            Bidirectional(LSTM(128, return_sequences=True)),
            Dropout(0.2),
            
            Bidirectional(LSTM(64, return_sequences=False)),
            Dropout(0.2),
            
            Dense(32, activation='relu'),
            Dense(1)
        ])
        
        # Компилируем
        self.model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.0005),
            loss='mse',
            metrics=['mae']
        )
        
        # Загружаем веса
        weights_file = MODELS_DIR / "model_weights.weights.h5"
        self.model.load_weights(str(weights_file))
        
        # Загружаем scaler
        scaler_file = MODELS_DIR / "scaler.pkl"
        with open(scaler_file, 'rb') as f:
            self.scaler = pickle.load(f)
        
        # Загружаем метрики
        metrics_file = MODELS_DIR / "metrics.json"
        import json
        with open(metrics_file, 'r') as f:
            self.metrics = json.load(f)
    
    def prepare_data(self, prices):
        """
        Подготавливает данные для модели
        
        Args:
            prices: Массив цен (numpy array или list)
        
        Returns:
            Нормализованные данные
        """
        prices = np.array(prices).reshape(-1, 1)
        scaled = self.scaler.transform(prices)
        return scaled
    
    def forecast(self, historical_prices, days=30):
        """
        Делает прогноз на N дней вперёд
        
        Args:
            historical_prices: История цен (минимум 60 последних дней)
            days: Количество дней для прогноза
        
        Returns:
            dict с прогнозом и доверительными интервалами
        """
        # Берём последние 60 дней
        last_sequence = historical_prices[-self.seq_length:]
        
        # Нормализуем
        last_sequence_scaled = self.prepare_data(last_sequence)
        
        # Прогнозируем
        predictions_scaled = []
        current_seq = last_sequence_scaled.flatten()
        
        for _ in range(days):
            # Предсказываем следующий день
            pred = self.model.predict(
                current_seq.reshape(1, self.seq_length, 1), 
                verbose=0
            )
            predictions_scaled.append(pred[0, 0])
            
            # Обновляем последовательность
            current_seq = np.append(current_seq[1:], pred[0, 0])
        
        # Денормализуем обратно в реальные цены
        predictions_scaled = np.array(predictions_scaled).reshape(-1, 1)
        predictions = self.scaler.inverse_transform(predictions_scaled)
        
        # Рассчитываем доверительные интервалы (±MAE)
        mae = self.metrics['mae']
        forecast_data = []
        
        for i, pred in enumerate(predictions):
            forecast_data.append({
                'day': i + 1,
                'forecast': float(pred[0]),
                'lower': float(pred[0] - mae * (1 + i * 0.05)),
                'upper': float(pred[0] + mae * (1 + i * 0.05))
            })
        
        return {
            'pair': self.pair,
            'forecasts': forecast_data,
            'metrics': self.metrics
        }
    
    def get_metrics(self):
        """Возвращает метрики модели"""
        return self.metrics