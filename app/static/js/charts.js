// ─── API Integration ────────────────────────────────────────────
const API_BASE = '/api';
let currentPair = 'USD/KZT';
let charts = {};

// Загрузка реальных данных из API
// Загрузка реальных данных из API (с дефисами вместо слэшей)
async function loadPairData(pair) {
    try {
      // Заменяем слэш на дефис для URL
      const pairUrl = pair.replace('/', '-');
      
      const [historyRes, indicatorsRes, currentRes] = await Promise.all([
        fetch(`${API_BASE}/history/${pairUrl}?days=90`),
        fetch(`${API_BASE}/indicators/${pairUrl}?days=90`),
        fetch(`${API_BASE}/current/${pairUrl}`)
      ]);
  
      const history = await historyRes.json();
      const indicators = await indicatorsRes.json();
      const current = await currentRes.json();
  
      return { history, indicators, current };
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      return null;
    }
  }

// Генерация прогноза (пока заглушка)
function generateForecast(lastPrice, days = 30) {
  const forecast = [];
  let price = lastPrice;
  
  for (let i = 0; i < days; i++) {
    // Простой прогноз с малым трендом вверх
    price = price * (1 + (Math.random() - 0.44) * 0.006 + 0.0005);
    const spread = price * 0.012 * (1 + i * 0.05);
    forecast.push({
      val: price,
      lo: price - spread,
      hi: price + spread
    });
  }
  
  return forecast;
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
  
  // Генерируем прогноз
  const forecast = generateForecast(lastPrice, 30);
  const fcDates = getFutureDates(new Date(), 30);

  // Уничтожаем старые графики
  Object.values(charts).forEach(c => c.destroy());
  charts = {};

  // MAIN CHART
  const mainLabels = [...histDates, ...fcDates];
  const histData = [...histPrices, ...Array(30).fill(null)];
  const fcData = [...Array(histPrices.length - 1).fill(null), lastPrice, ...forecast.map(f => f.val)];
  const fcLo = [...Array(histPrices.length - 1).fill(null), lastPrice, ...forecast.map(f => f.lo)];
  const fcHi = [...Array(histPrices.length - 1).fill(null), lastPrice, ...forecast.map(f => f.hi)];

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
          label: 'Прогноз',
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
  updateMetrics(data.current, forecast);
}

function buildTable(forecast, dates, lastHistVal) {
  const tbody = document.getElementById('forecastTable');
  tbody.innerHTML = '';
  let prev = lastHistVal;
  
  forecast.forEach((f, i) => {
    const chg = f.val - prev;
    const pct = (chg / prev * 100).toFixed(2);
    const up = chg >= 0;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="td-date">${dates[i]}</td>
      <td class="td-forecast">${f.val.toFixed(2)}</td>
      <td class="td-change ${up ? 'up' : 'down'}">${up ? '+' : ''}${chg.toFixed(2)}</td>
      <td class="td-change ${up ? 'up' : 'down'}">${up ? '+' : ''}${pct}%</td>
      <td class="td-interval">${f.lo.toFixed(2)}</td>
      <td class="td-interval">${f.hi.toFixed(2)}</td>
      <td>${up ? '▲' : '▼'}</td>
    `;
    tbody.appendChild(tr);
    prev = f.val;
  });
}

function updateMetrics(current, forecast) {
  // Текущий курс
  document.getElementById('m-rate').textContent = current.rate.toFixed(2);
  
  // Изменение за день
  const dayEl = document.getElementById('m-day-chg');
  dayEl.textContent = `${current.day_change >= 0 ? '+' : ''}${current.day_change.toFixed(2)} (${current.day_change_pct >= 0 ? '+' : ''}${current.day_change_pct.toFixed(2)}%)`;
  dayEl.className = `badge ${current.day_change >= 0 ? 'up' : 'down'}`;

  // Прогноз на 30 дней
  const fc30 = forecast[forecast.length - 1].val;
  const fcChg = fc30 - current.rate;
  const fcPct = (fcChg / current.rate * 100).toFixed(2);

  document.getElementById('m-forecast').textContent = fc30.toFixed(2);
  document.getElementById('m-forecast').className = `card-value ${fcChg >= 0 ? 'up' : 'down'}`;
  
  const fcEl = document.getElementById('m-fc-chg');
  fcEl.textContent = `${fcChg >= 0 ? '+' : ''}${fcChg.toFixed(2)} (${fcChg >= 0 ? '+' : ''}${fcPct}%)`;
  fcEl.className = `badge ${fcChg >= 0 ? 'up' : 'down'}`;
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