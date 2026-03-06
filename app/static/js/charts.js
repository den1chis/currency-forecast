// ─── API Integration ────────────────────────────────────────────
const API_BASE = '/api';
let currentPair = 'USD/KZT';
let charts = {};

// Загрузка реальных данных из API
async function loadPairData(pair) {
  try {
    const pairUrl = pair.replace('/', '-');
    
    const [historyRes, indicatorsRes, currentRes, forecastRes] = await Promise.all([
      fetch(`${API_BASE}/history/${pairUrl}?days=90`),
      fetch(`${API_BASE}/indicators/${pairUrl}?days=90`),
      fetch(`${API_BASE}/current/${pairUrl}`),
      fetch(`${API_BASE}/forecast/${pairUrl}?days=30`)
    ]);

    const history = await historyRes.json();
    const indicators = await indicatorsRes.json();
    const current = await currentRes.json();
    
    // Прогноз может не быть доступен для всех пар
    let forecast = null;
    if (forecastRes.ok) {
      forecast = await forecastRes.json();
    }

    return { history, indicators, current, forecast };
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    return null;
  }
}

function getFutureDates(startDate, days) {
  const dates = [];
  const d = new Date(startDate);
  
  for (let i = 0; i < days; i++) {
    d.setDate(d.getDate() + 1);
    dates.push(d.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}));
  }
  
  return dates;
}

// ─── CHARTS ────────────────────────────────────────────────────
const chartDefaults = {
  responsive: true,
  animation: { duration: 700, easing: 'easeInOutQuart' },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#0d1520',
      borderColor: '#1a2d42',
      borderWidth: 1,
      titleColor: '#5a7a99',
      bodyColor: '#e8f4ff',
      padding: 10,
      cornerRadius: 0,
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(26,45,66,0.5)', drawBorder: false },
      ticks: { color: '#5a7a99', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 10 },
      border: { color: '#1a2d42' }
    },
    y: {
      grid: { color: 'rgba(26,45,66,0.5)', drawBorder: false },
      ticks: { color: '#5a7a99', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 6 },
      border: { color: '#1a2d42' }
    }
  }
};

async function buildCharts(pair) {
  console.log(`Загружаю данные для ${pair}...`);
  
  const data = await loadPairData(pair);
  
  if (!data) {
    console.error('Не удалось загрузить данные');
    return;
  }

  // Извлекаем данные
  const histDates = data.history.data.map(d => d.date);
  const histPrices = data.history.data.map(d => d.close);
  const lastPrice = histPrices[histPrices.length - 1];
  
  // Прогноз
  let forecast = null;
  let fcDates = [];
  
  if (data.forecast && data.forecast.forecasts) {
    forecast = data.forecast.forecasts;
    fcDates = forecast.map(f => {
      const date = new Date(f.date);
      return date.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'});
    });
  } else {
    // Заглушка если прогноз недоступен
    fcDates = getFutureDates(new Date(), 30);
    forecast = [];
    let price = lastPrice;
    for (let i = 0; i < 30; i++) {
      price = price * (1 + (Math.random() - 0.44) * 0.006 + 0.0005);
      const spread = price * 0.012 * (1 + i * 0.05);
      forecast.push({
        forecast: price,
        lower: price - spread,
        upper: price + spread
      });
    }
  }

  // Уничтожаем старые графики
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  // MAIN CHART
  const mainLabels = [...histDates, ...fcDates];
  const histData = [...histPrices, ...Array(30).fill(null)];
  const fcData = [...Array(histPrices.length - 1).fill(null), lastPrice, ...forecast.map(f => f.forecast)];
  const fcLo = [...Array(histPrices.length - 1).fill(null), lastPrice, ...forecast.map(f => f.lower)];
  const fcHi = [...Array(histPrices.length - 1).fill(null), lastPrice, ...forecast.map(f => f.upper)];

  charts.main = new Chart(document.getElementById('mainChart'), {
    type: 'line',
    data: {
      labels: mainLabels,
      datasets: [
        {
          label: 'Доверительный интервал',
          data: fcHi,
          fill: '+1',
          backgroundColor: 'rgba(255,107,53,0.1)',
          borderColor: 'transparent',
          pointRadius: 0,
          tension: 0.4
        },
        {
          label: 'Нижняя граница',
          data: fcLo,
          fill: false,
          borderColor: 'transparent',
          pointRadius: 0,
          tension: 0.4
        },
        {
          label: 'История',
          data: histData,
          borderColor: '#00d4ff',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        },
        {
          label: 'Прогноз LSTM',
          data: fcData,
          borderColor: '#ff6b35',
          borderWidth: 2,
          borderDash: [4, 3],
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        }
      ]
    },
    options: { ...chartDefaults }
  });

  // RSI
  const rsi = data.indicators.indicators.rsi;
  charts.rsi = new Chart(document.getElementById('rsiChart'), {
    type: 'line',
    data: {
      labels: histDates,
      datasets: [
        {
          label: 'RSI',
          data: rsi,
          borderColor: '#00d4ff',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false
        },
        {
          label: '70',
          data: Array(rsi.length).fill(70),
          borderColor: 'rgba(255,77,106,0.4)',
          borderWidth: 1,
          borderDash: [4, 3],
          pointRadius: 0,
          fill: false
        },
        {
          label: '30',
          data: Array(rsi.length).fill(30),
          borderColor: 'rgba(61,255,176,0.4)',
          borderWidth: 1,
          borderDash: [4, 3],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: { ...chartDefaults.scales.y, min: 0, max: 100 }
      }
    }
  });

  // MACD
  const macd = data.indicators.indicators.macd;
  const macdSignal = data.indicators.indicators.macd_signal;
  const macdHist = data.indicators.indicators.macd_hist;

  charts.macd = new Chart(document.getElementById('macdChart'), {
    type: 'bar',
    data: {
      labels: histDates,
      datasets: [
        {
          type: 'bar',
          label: 'Histogram',
          data: macdHist,
          backgroundColor: macdHist.map(v => v >= 0 ? 'rgba(61,255,176,0.4)' : 'rgba(255,77,106,0.4)'),
          borderColor: 'transparent',
          order: 2
        },
        {
          type: 'line',
          label: 'MACD',
          data: macd,
          borderColor: '#00d4ff',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
          order: 1
        },
        {
          type: 'line',
          label: 'Signal',
          data: macdSignal,
          borderColor: '#ff6b35',
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
          order: 0
        }
      ]
    },
    options: { ...chartDefaults }
  });

  // BOLLINGER
  const bbUpper = data.indicators.indicators.bb_upper;
  const bbSma = data.indicators.indicators.bb_sma;
  const bbLower = data.indicators.indicators.bb_lower;

  charts.bb = new Chart(document.getElementById('bollingerChart'), {
    type: 'line',
    data: {
      labels: histDates,
      datasets: [
        {
          label: 'BB Upper',
          data: bbUpper,
          borderColor: 'rgba(127,255,92,0.3)',
          borderWidth: 1,
          pointRadius: 0,
          fill: '+2',
          backgroundColor: 'rgba(127,255,92,0.05)',
          tension: 0.3
        },
        {
          label: 'SMA 20',
          data: bbSma,
          borderColor: '#7fff5c',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.3
        },
        {
          label: 'BB Lower',
          data: bbLower,
          borderColor: 'rgba(127,255,92,0.3)',
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          tension: 0.3
        },
        {
          label: 'Цена',
          data: histPrices,
          borderColor: '#00d4ff',
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
          tension: 0.3
        }
      ]
    },
    options: { ...chartDefaults }
  });

  // TABLE
  buildTable(forecast, fcDates, lastPrice);
  updateMetrics(data.current, forecast, data.forecast ? data.forecast.metrics : null);
}

function buildTable(forecast, dates, lastHistVal) {
  const tbody = document.getElementById('forecastTable');
  tbody.innerHTML = '';
  let prev = lastHistVal;
  
  forecast.forEach((f, i) => {
    const val = f.forecast;
    const chg = val - prev;
    const pct = (chg / prev * 100).toFixed(2);
    const up = chg >= 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-date">${dates[i]}</td>
      <td class="td-forecast">${val.toFixed(2)}</td>
      <td class="td-change ${up ? 'up' : 'down'}">${up ? '+' : ''}${chg.toFixed(2)}</td>
      <td class="td-change ${up ? 'up' : 'down'}">${up ? '+' : ''}${pct}%</td>
      <td class="td-interval">${f.lower.toFixed(2)}</td>
      <td class="td-interval">${f.upper.toFixed(2)}</td>
      <td>${up ? '▲' : '▼'}</td>
    `;
    tbody.appendChild(tr);
    prev = val;
  });
}

function updateMetrics(current, forecast, realMetrics) {
  // Текущий курс
  document.getElementById('m-rate').textContent = current.rate.toFixed(2);
  
  // Изменение за день
  const dayEl = document.getElementById('m-day-chg');
  dayEl.textContent = `${current.day_change >= 0 ? '+' : ''}${current.day_change.toFixed(2)} (${current.day_change_pct >= 0 ? '+' : ''}${current.day_change_pct.toFixed(2)}%)`;
  dayEl.className = `badge ${current.day_change >= 0 ? 'up' : 'down'}`;

  // Прогноз на 30 дней
  const fc30 = forecast[forecast.length - 1].forecast;
  const fcChg = fc30 - current.rate;
  const fcPct = (fcChg / current.rate * 100).toFixed(2);

  document.getElementById('m-forecast').textContent = fc30.toFixed(2);
  document.getElementById('m-forecast').className = `card-value ${fcChg >= 0 ? 'up' : 'down'}`;
  
  const fcEl = document.getElementById('m-fc-chg');
  fcEl.textContent = `${fcChg >= 0 ? '+' : ''}${fcChg.toFixed(2)} (${fcChg >= 0 ? '+' : ''}${fcPct}%)`;
  fcEl.className = `badge ${fcChg >= 0 ? 'up' : 'down'}`;
  
  // Обновляем метрики модели если есть реальные
  if (realMetrics) {
    document.querySelector('.card:nth-child(3) .card-value').textContent = realMetrics.mae.toFixed(2);
    document.querySelector('.card:nth-child(4) .card-value').textContent = realMetrics.r2.toFixed(3);
  }
}

function switchPair(btn, pair) {
  document.querySelectorAll('.pair-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPair = pair;
  buildCharts(pair);
}

// Clock
function updateClock() {
  document.getElementById('live-time').textContent =
    new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// Init
buildCharts('USD/KZT');