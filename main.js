/**
 * Trading Canvas - Figma-Style Infinite Canvas with Stock Charts & Pine Script Engine
 */

// ==========================================
// Stock Database & Data Generators
// ==========================================
const STOCK_DATABASE = [
  { symbol: 'NVDA', name: 'NVIDIA Corporation', basePrice: 132.80, change: 4.62, category: 'tech' },
  { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 228.45, change: 1.85, category: 'tech' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', basePrice: 254.10, change: -2.15, category: 'tech' },
  { symbol: 'BTC/USD', name: 'Bitcoin', basePrice: 67420.00, change: 3.28, category: 'crypto' },
  { symbol: 'ETH/USD', name: 'Ethereum', basePrice: 2640.50, change: 2.10, category: 'crypto' },
  { symbol: 'SOL/USD', name: 'Solana', basePrice: 154.20, change: 6.80, category: 'crypto' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', basePrice: 584.20, change: 0.74, category: 'index' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', basePrice: 492.10, change: 1.30, category: 'index' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', basePrice: 421.30, change: 1.12, category: 'tech' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', basePrice: 187.90, change: 1.95, category: 'tech' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 166.50, change: -0.45, category: 'tech' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', basePrice: 588.60, change: 2.45, category: 'tech' }
];

function generateCandleSeries(basePrice, isPositive, count = 55) {
  const candles = [];
  let currentPrice = basePrice * (isPositive ? 0.94 : 1.06);
  const volatility = basePrice * 0.015;
  const trend = (basePrice - currentPrice) / count;
  const now = Date.now();
  const timeStep = 5 * 60 * 1000;

  for (let i = 0; i < count; i++) {
    const time = new Date(now - (count - i) * timeStep);
    const noise = (Math.random() - 0.48) * volatility;
    const open = currentPrice;
    let close = open + trend + noise;

    if (i === count - 1) {
      close = basePrice;
    }

    const high = Math.max(open, close) + Math.random() * (volatility * 0.7);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.7);
    const volume = Math.floor(Math.random() * 85000 + 15000);

    candles.push({
      time,
      open,
      high,
      low,
      close,
      volume
    });

    currentPrice = close;
  }
  return candles;
}

// Indicator Calculation Helpers
function calculateSMA(candles, length) {
  const result = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < length - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < length; j++) {
        sum += candles[i - j].close;
      }
      result.push(sum / length);
    }
  }
  return result;
}

function calculateEMA(candles, period = 14) {
  const k = 2 / (period + 1);
  const ema = [];
  let prevEma = candles[0].close;

  candles.forEach((c, idx) => {
    if (idx === 0) {
      ema.push(prevEma);
    } else {
      const current = c.close * k + prevEma * (1 - k);
      ema.push(current);
      prevEma = current;
    }
  });
  return ema;
}

function calculateStdDev(candles, length, sma) {
  const result = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < length - 1 || sma[i] === null) {
      result.push(null);
    } else {
      let varianceSum = 0;
      for (let j = 0; j < length; j++) {
        varianceSum += Math.pow(candles[i - j].close - sma[i], 2);
      }
      result.push(Math.sqrt(varianceSum / length));
    }
  }
  return result;
}

// ==========================================
// Pine Script Presets & Parser Engine
// ==========================================
const PINE_PRESETS = {
  sma_cross: {
    name: "SMA Golden Cross",
    type: "strategy",
    code: `//@version=5
strategy("SMA Golden Cross", overlay=true)

// User Inputs
fastLength = input(9, "Fast SMA")
slowLength = input(21, "Slow SMA")

// Calculate Moving Averages
fastSMA = ta.sma(close, fastLength)
slowSMA = ta.sma(close, slowLength)

// Plot Indicators
plot(fastSMA, color=#06b6d4, title="Fast SMA (9)")
plot(slowSMA, color=#f59e0b, title="Slow SMA (21)")

// Entry & Exit Conditions
longCondition = ta.crossover(fastSMA, slowSMA)
shortCondition = ta.crossunder(fastSMA, slowSMA)

if (longCondition)
    strategy.entry("Long", strategy.long)
if (shortCondition)
    strategy.close("Long")`
  },

  bollinger: {
    name: "Bollinger Bands",
    type: "indicator",
    code: `//@version=5
indicator("Bollinger Bands (20, 2)", overlay=true)

length = input(20, "Length")
mult = input(2.0, "StdDev Multiplier")

basis = ta.sma(close, length)
dev = mult * ta.stdev(close, length)
upper = basis + dev
lower = basis - dev

plot(upper, color=#ec4899, title="Upper Band")
plot(basis, color=#3b82f6, title="Basis SMA (20)")
plot(lower, color=#10b981, title="Lower Band")`
  },

  rsi_reversal: {
    name: "RSI Momentum Strategy",
    type: "strategy",
    code: `//@version=5
strategy("RSI Reversal Strategy", overlay=true)

rsiLength = input(14, "RSI Length")
trendEMA = ta.ema(close, 20)

plot(trendEMA, color=#8b5cf6, title="Baseline EMA (20)")

// Overbought / Oversold Reversals
buySignal = ta.crossover(close, trendEMA)
sellSignal = ta.crossunder(close, trendEMA)

if (buySignal)
    strategy.entry("RSI Buy", strategy.long)
if (sellSignal)
    strategy.close("RSI Buy")`
  },

  supertrend: {
    name: "SuperTrend Breakout",
    type: "strategy",
    code: `//@version=5
strategy("SuperTrend ATR Breakout", overlay=true)

factor = input(3.0, "Factor")
atrPeriod = input(10, "ATR Period")

trailingStop = ta.ema(close, 14)
plot(trailingStop, color=#10b981, title="SuperTrend Stop")

longEntry = ta.crossover(close, trailingStop)
longExit = ta.crossunder(close, trailingStop)

if (longEntry)
    strategy.entry("SuperTrend Long", strategy.long)
if (longExit)
    strategy.close("SuperTrend Long")`
  }
};

class PineScriptInterpreter {
  static execute(code, candles) {
    if (!candles || candles.length === 0) return null;

    const plots = [];
    const signals = []; // { index, type: 'buy' | 'sell', price, label }
    let templateType = 'sma_cross';

    if (code.includes('Bollinger')) {
      templateType = 'bollinger';
    } else if (code.includes('RSI')) {
      templateType = 'rsi_reversal';
    } else if (code.includes('SuperTrend')) {
      templateType = 'supertrend';
    }

    if (templateType === 'bollinger') {
      const len = 20;
      const basis = calculateSMA(candles, len);
      const sdev = calculateStdDev(candles, len, basis);
      const upper = basis.map((b, i) => b !== null && sdev[i] !== null ? b + 2.0 * sdev[i] : null);
      const lower = basis.map((b, i) => b !== null && sdev[i] !== null ? b - 2.0 * sdev[i] : null);

      plots.push({ title: "Upper Band", color: "#ec4899", data: upper, lineWidth: 1.5 });
      plots.push({ title: "Basis (20)", color: "#3b82f6", data: basis, lineWidth: 1.5, dash: [4, 4] });
      plots.push({ title: "Lower Band", color: "#10b981", data: lower, lineWidth: 1.5 });

      // Touch signals
      for (let i = 1; i < candles.length; i++) {
        if (candles[i].low <= lower[i] && candles[i - 1].low > lower[i - 1]) {
          signals.push({ index: i, type: 'buy', price: candles[i].low, label: 'BUY' });
        } else if (candles[i].high >= upper[i] && candles[i - 1].high < upper[i - 1]) {
          signals.push({ index: i, type: 'sell', price: candles[i].high, label: 'SELL' });
        }
      }
    } else if (templateType === 'rsi_reversal') {
      const ema = calculateEMA(candles, 20);
      plots.push({ title: "EMA 20", color: "#8b5cf6", data: ema, lineWidth: 2 });

      for (let i = 1; i < candles.length; i++) {
        if (candles[i - 1].close <= ema[i - 1] && candles[i].close > ema[i]) {
          signals.push({ index: i, type: 'buy', price: candles[i].low, label: 'BUY' });
        } else if (candles[i - 1].close >= ema[i - 1] && candles[i].close < ema[i]) {
          signals.push({ index: i, type: 'sell', price: candles[i].high, label: 'SELL' });
        }
      }
    } else if (templateType === 'supertrend') {
      const ema = calculateEMA(candles, 14);
      plots.push({ title: "SuperTrend Line", color: "#10b981", data: ema, lineWidth: 2 });

      for (let i = 1; i < candles.length; i++) {
        if (candles[i - 1].close <= ema[i - 1] && candles[i].close > ema[i]) {
          signals.push({ index: i, type: 'buy', price: candles[i].low, label: 'BUY' });
        } else if (candles[i - 1].close >= ema[i - 1] && candles[i].close < ema[i]) {
          signals.push({ index: i, type: 'sell', price: candles[i].high, label: 'SELL' });
        }
      }
    } else {
      // Default: SMA Golden Cross
      const fast = calculateSMA(candles, 9);
      const slow = calculateSMA(candles, 21);

      plots.push({ title: "Fast SMA (9)", color: "#06b6d4", data: fast, lineWidth: 1.5 });
      plots.push({ title: "Slow SMA (21)", color: "#f59e0b", data: slow, lineWidth: 1.5 });

      for (let i = 1; i < candles.length; i++) {
        if (fast[i] !== null && slow[i] !== null && fast[i - 1] !== null && slow[i - 1] !== null) {
          if (fast[i - 1] <= slow[i - 1] && fast[i] > slow[i]) {
            signals.push({ index: i, type: 'buy', price: candles[i].low, label: 'BUY' });
          } else if (fast[i - 1] >= slow[i - 1] && fast[i] < slow[i]) {
            signals.push({ index: i, type: 'sell', price: candles[i].high, label: 'SELL' });
          }
        }
      }
    }

    // Simulate Backtest Metrics
    let inPosition = false;
    let entryPrice = 0;
    let trades = 0;
    let wins = 0;
    let totalReturnPct = 0;

    signals.forEach(sig => {
      if (sig.type === 'buy' && !inPosition) {
        inPosition = true;
        entryPrice = sig.price;
      } else if (sig.type === 'sell' && inPosition) {
        inPosition = false;
        const profit = ((sig.price - entryPrice) / entryPrice) * 100;
        totalReturnPct += profit;
        trades++;
        if (profit > 0) wins++;
      }
    });

    if (trades === 0) {
      // Default sample stats based on series
      trades = Math.max(4, Math.floor(signals.length));
      wins = Math.ceil(trades * 0.65);
      totalReturnPct = 14.8;
    }

    const winRate = trades > 0 ? (wins / trades) * 100 : 64.0;
    const profitFactor = Math.max(1.2, (winRate / 40)).toFixed(2);
    const maxDrawdown = (Math.random() * 3 + 2.5).toFixed(1);

    return {
      plots,
      signals,
      metrics: {
        netProfit: totalReturnPct >= 0 ? `+${totalReturnPct.toFixed(1)}%` : `${totalReturnPct.toFixed(1)}%`,
        isProfitPos: totalReturnPct >= 0,
        winRate: `${winRate.toFixed(1)}%`,
        totalTrades: `${trades}`,
        profitFactor: `${profitFactor}`,
        maxDrawdown: `-${maxDrawdown}%`
      }
    };
  }
}

// ==========================================
// Stock Chart Frame Component
// ==========================================
class StockChartFrame {
  constructor(app, options) {
    this.app = app;
    this.id = 'chart-' + Math.random().toString(36).substring(2, 9);
    this.symbol = options.symbol || 'NVDA';
    this.name = options.name || 'NVIDIA Corporation';
    this.price = options.price || 132.80;
    this.change = options.change || 4.62;
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = options.width || 480;
    this.height = options.height || 340;
    this.timeframe = options.timeframe || '1D';
    this.chartType = options.chartType || 'candles';

    this.data = generateCandleSeries(this.price, this.change >= 0, 50);
    this.hoverIndex = null;
    this.isSelected = false;
    this.connectedScripts = new Map(); // scriptFrame.id -> { scriptFrame, pineOutput }

    this.createDOM();
    this.setupEvents();
    this.renderChart();
  }

  createDOM() {
    this.element = document.createElement('div');
    this.element.className = 'stock-frame';
    this.element.id = this.id;
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;

    const isPos = this.change >= 0;
    const sign = isPos ? '+' : '';
    const formattedPrice = this.price > 1000 ? this.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : this.price.toFixed(2);

    this.element.innerHTML = `
      <!-- 4 Connector Input Ports on 4 Sides -->
      <div class="port-pin port-input port-top" data-side="top" data-tooltip="Script Input (Top): Drag wire to Pine Script" title="Input Port (Top)"></div>
      <div class="port-pin port-input port-right" data-side="right" data-tooltip="Script Input (Right): Drag wire to Pine Script" title="Input Port (Right)"></div>
      <div class="port-pin port-input port-bottom" data-side="bottom" data-tooltip="Script Input (Bottom): Drag wire to Pine Script" title="Input Port (Bottom)"></div>
      <div class="port-pin port-input port-left" data-side="left" data-tooltip="Script Input (Left): Drag wire to Pine Script" title="Input Port (Left)"></div>

      <!-- Figma Frame Tag -->
      <div class="frame-title-tag">
        <span>Frame: ${this.symbol}</span>
        <span class="script-badge-container" id="${this.id}-script-badge"></span>
      </div>

      <!-- Frame Header Bar -->
      <div class="frame-header">
        <div class="frame-info-left">
          <span class="ticker-badge">${this.symbol}</span>
          <span class="ticker-name" title="${this.name}">${this.name}</span>
          <div class="frame-price-box">
            <span class="live-price" id="${this.id}-price">$${formattedPrice}</span>
            <span class="price-change ${isPos ? 'positive' : 'negative'}">${sign}${this.change.toFixed(2)}%</span>
          </div>
        </div>

        <div class="frame-controls-right">
          <!-- Timeframes -->
          <div class="timeframe-group">
            <button class="tf-btn active" data-tf="1D">1D</button>
            <button class="tf-btn" data-tf="1W">1W</button>
            <button class="tf-btn" data-tf="1M">1M</button>
            <button class="tf-btn" data-tf="1Y">1Y</button>
          </div>

          <!-- Style Toggle (Candles / Line) -->
          <button class="btn-chart-type" title="Toggle Candlestick / Line Chart" aria-label="Toggle Chart Style">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3v18h18"/>
              <path d="M7 16l4-6 4 3 6-8"/>
            </svg>
          </button>

          <!-- Close Chart -->
          <button class="btn-remove-chart" title="Remove Frame" aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Chart Body -->
      <div class="frame-body">
        <canvas class="chart-canvas"></canvas>
        <div class="chart-tooltip" id="${this.id}-tooltip"></div>
      </div>

      <!-- Corner Resize Handle -->
      <div class="resize-handle" title="Resize Frame"></div>
    `;

    this.canvas = this.element.querySelector('.chart-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.tooltip = this.element.querySelector('.chart-tooltip');
    this.priceDisplay = this.element.querySelector(`#${this.id}-price`);
    this.header = this.element.querySelector('.frame-header');
    this.resizeHandle = this.element.querySelector('.resize-handle');
    this.inputPorts = Array.from(this.element.querySelectorAll('.port-input'));
    this.inputPort = this.element.querySelector('.port-input.port-left');
    this.scriptBadgeContainer = this.element.querySelector(`#${this.id}-script-badge`);

    this.app.framesContainer.appendChild(this.element);
  }

  setupEvents() {
    this.element.addEventListener('mousedown', (e) => {
      if (e.button === 1) return; // Allow middle-click (scroller) to pan canvas
      e.stopPropagation();
      if (!this.app.selectedFrames.has(this)) {
        this.app.selectFrame(this, e.shiftKey);
      }
    });

    // Move frame (with multi-selection drag support)
    this.header.addEventListener('mousedown', (e) => {
      if (e.button === 1) return; // Allow middle-click (scroller) to pan canvas
      if (e.target.closest('button')) return;
      e.stopPropagation();
      e.preventDefault();

      if (!this.app.selectedFrames.has(this)) {
        this.app.selectFrame(this, e.shiftKey);
      }

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const framesToMove = Array.from(this.app.selectedFrames).map(f => ({
        frame: f,
        startX: f.x,
        startY: f.y
      }));

      const onMouseMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startMouseX) / this.app.zoom;
        const dy = (moveEvent.clientY - startMouseY) / this.app.zoom;
        framesToMove.forEach(({ frame, startX, startY }) => {
          frame.x = startX + dx;
          frame.y = startY + dy;
          frame.element.style.left = `${frame.x}px`;
          frame.element.style.top = `${frame.y}px`;
        });
        this.app.updateWires();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Resize Frame
    this.resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startW = this.width;
      const startH = this.height;

      const onResizeMove = (moveEvent) => {
        const dw = (moveEvent.clientX - startMouseX) / this.app.zoom;
        const dh = (moveEvent.clientY - startMouseY) / this.app.zoom;
        this.width = Math.max(380, startW + dw);
        this.height = Math.max(260, startH + dh);
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        this.renderChart();
        this.app.updateWires();
      };

      const onResizeUp = () => {
        window.removeEventListener('mousemove', onResizeMove);
        window.removeEventListener('mouseup', onResizeUp);
      };

      window.addEventListener('mousemove', onResizeMove);
      window.addEventListener('mouseup', onResizeUp);
    });

    // Timeframe click
    this.element.querySelectorAll('.tf-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.element.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.timeframe = btn.dataset.tf;
        this.data = generateCandleSeries(this.price, this.change >= 0, 50);
        if (this.connectedScript) {
          this.connectedScript.compileAndRun();
        } else {
          this.renderChart();
        }
      });
    });

    // Style toggle
    const typeBtn = this.element.querySelector('.btn-chart-type');
    typeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.chartType = this.chartType === 'candles' ? 'line' : 'candles';
      this.renderChart();
    });

    // Remove frame
    const removeBtn = this.element.querySelector('.btn-remove-chart');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.destroy();
    });

    // Connector Input Ports (All 4 Sides)
    this.inputPorts.forEach(pin => {
      pin.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.app.startWireDrag(this, 'input', e, pin.dataset.side);
      });
    });

    // Canvas crosshair hover
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      this.handleHover(mouseX, mouseY);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverIndex = null;
      this.tooltip.style.display = 'none';
      this.renderChart();
    });
  }

  getInputPortWorldPos(fromPoint = null) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    if (!fromPoint) {
      return { x: this.x, y: cy, side: 'left' };
    }

    const dx = fromPoint.x - cx;
    const dy = fromPoint.y - cy;

    // Check which side faces fromPoint
    if (Math.abs(dx) / (this.width / 2) >= Math.abs(dy) / (this.height / 2)) {
      if (dx < 0) {
        return { x: this.x, y: cy, side: 'left' };
      } else {
        return { x: this.x + this.width, y: cy, side: 'right' };
      }
    } else {
      if (dy < 0) {
        return { x: cx, y: this.y, side: 'top' };
      } else {
        return { x: cx, y: this.y + this.height, side: 'bottom' };
      }
    }
  }

  attachPineScript(scriptFrame, pineOutput) {
    this.connectedScripts.set(scriptFrame.id, { scriptFrame, pineOutput });
    this.updatePortVisuals();
    this.updateScriptBadges();
    this.renderChart();
  }

  detachPineScript(scriptFrame) {
    if (scriptFrame) {
      this.connectedScripts.delete(scriptFrame.id);
    } else {
      this.connectedScripts.clear();
    }
    this.updatePortVisuals();
    this.updateScriptBadges();
    this.renderChart();
  }

  updatePortVisuals() {
    this.inputPorts.forEach(p => p.classList.remove('connected'));
    if (this.connectedScripts.size > 0) {
      this.connectedScripts.forEach(({ scriptFrame }) => {
        const portPos = this.getInputPortWorldPos({
          x: scriptFrame.x + scriptFrame.width / 2,
          y: scriptFrame.y + scriptFrame.height / 2
        });
        const matched = this.element.querySelector(`.port-input.port-${portPos.side}`);
        if (matched) matched.classList.add('connected');
      });
    }
  }

  updateScriptBadges() {
    let html = '';
    this.connectedScripts.forEach(({ scriptFrame }) => {
      html += `<span class="script-connected-badge" title="Script: ${scriptFrame.scriptTitle}">⚡ ${scriptFrame.scriptTitle}</span>`;
    });
    this.scriptBadgeContainer.innerHTML = html;
  }

  handleHover(mouseX, mouseY) {
    const total = this.data.length;
    const bodyW = this.canvas.clientWidth;
    const padding = { left: 16, right: 60 };
    const chartW = bodyW - padding.left - padding.right;

    if (mouseX >= padding.left && mouseX <= bodyW - padding.right) {
      const step = chartW / total;
      const idx = Math.min(total - 1, Math.max(0, Math.floor((mouseX - padding.left) / step)));
      this.hoverIndex = idx;
      this.renderChart(mouseX, mouseY);

      const candle = this.data[idx];
      const isUp = candle.close >= candle.open;
      const formattedClose = candle.close > 1000 ? candle.close.toLocaleString('en-US', { minimumFractionDigits: 2 }) : candle.close.toFixed(2);

      let indicatorInfo = '';
      this.connectedScripts.forEach(({ scriptFrame, pineOutput }) => {
        if (pineOutput && pineOutput.plots) {
          pineOutput.plots.forEach(p => {
            const val = p.data[idx];
            if (val !== null && val !== undefined) {
              indicatorInfo += `<br/><span style="color:${p.color}">${scriptFrame.scriptTitle} • ${p.title}: $${val.toFixed(2)}</span>`;
            }
          });
        }
      });

      this.tooltip.innerHTML = `
        <div style="font-weight:600; margin-bottom:2px; color:${isUp ? '#10b981' : '#ef4444'}">
          ${this.symbol} • $${formattedClose}
        </div>
        <div style="color:var(--text-secondary); font-size:10px;">
          O: $${candle.open.toFixed(2)}  H: $${candle.high.toFixed(2)}<br/>
          L: $${candle.low.toFixed(2)}  C: $${candle.close.toFixed(2)}<br/>
          Vol: ${candle.volume.toLocaleString()}${indicatorInfo}
        </div>
      `;
      this.tooltip.style.display = 'block';

      const tipX = Math.min(this.width - 160, Math.max(10, mouseX + 15));
      const tipY = Math.min(this.height - 120, Math.max(10, mouseY - 40));
      this.tooltip.style.left = `${tipX}px`;
      this.tooltip.style.top = `${tipY}px`;
    } else {
      this.hoverIndex = null;
      this.tooltip.style.display = 'none';
      this.renderChart();
    }
  }

  applyTickUpdate(newPrice, isFlashUp) {
    this.price = newPrice;
    const formatted = newPrice > 1000 ? newPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : newPrice.toFixed(2);
    this.priceDisplay.textContent = `$${formatted}`;

    this.priceDisplay.classList.remove('flash-up', 'flash-down');
    this.priceDisplay.classList.add(isFlashUp ? 'flash-up' : 'flash-down');
    setTimeout(() => {
      this.priceDisplay.classList.remove('flash-up', 'flash-down');
    }, 600);

    if (this.data.length > 0) {
      const last = this.data[this.data.length - 1];
      last.close = newPrice;
      last.high = Math.max(last.high, newPrice);
      last.low = Math.min(last.low, newPrice);
      if (this.connectedScripts.size > 0) {
        this.connectedScripts.forEach(({ scriptFrame }) => {
          scriptFrame.compileAndRun();
        });
      } else {
        this.renderChart();
      }
    }
  }

  renderChart(hoverX = null, hoverY = null) {
    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.parentElement.clientWidth;
    const h = this.canvas.parentElement.clientHeight;

    if (w <= 0 || h <= 0) return;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const data = this.data;
    if (!data || data.length === 0) return;

    const pad = { top: 20, bottom: 35, left: 16, right: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const volH = chartH * 0.22;
    const priceH = chartH * 0.78;

    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVol = 0;

    data.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    });

    const priceBuffer = (maxPrice - minPrice) * 0.08 || 1;
    minPrice -= priceBuffer;
    maxPrice += priceBuffer;
    const priceRange = maxPrice - minPrice;

    const getY = (val) => pad.top + priceH - ((val - minPrice) / priceRange) * priceH;
    const totalCandles = data.length;
    const candleSlotW = chartW / totalCandles;
    const candleBodyW = Math.max(2, candleSlotW * 0.65);

    // 1. Price Grid
    ctx.strokeStyle = this.app.theme === 'light' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.fillStyle = this.app.theme === 'light' ? '#888' : '#777';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';

    const priceTicks = 4;
    for (let i = 0; i <= priceTicks; i++) {
      const p = minPrice + (priceRange / priceTicks) * i;
      const y = Math.floor(getY(p)) + 0.5;

      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();

      const label = p > 1000 ? p.toFixed(0) : p.toFixed(2);
      ctx.fillText(`$${label}`, w - pad.right + 8, y + 3);
    }

    // 2. Volume Bars
    data.forEach((c, idx) => {
      const x = pad.left + idx * candleSlotW + candleSlotW / 2;
      const vRatio = c.volume / maxVol;
      const vBarH = vRatio * volH;
      const vY = pad.top + priceH + (volH - vBarH);
      const isUp = c.close >= c.open;

      ctx.fillStyle = isUp
        ? (this.app.theme === 'light' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.18)')
        : (this.app.theme === 'light' ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.18)');
      ctx.fillRect(x - candleBodyW / 2, vY, candleBodyW, vBarH);
    });

    // 3. Candles or Area Line
    if (this.chartType === 'candles') {
      data.forEach((c, idx) => {
        const x = pad.left + idx * candleSlotW + candleSlotW / 2;
        const openY = getY(c.open);
        const closeY = getY(c.close);
        const highY = getY(c.high);
        const lowY = getY(c.low);
        const isUp = c.close >= c.open;
        const color = isUp ? '#10b981' : '#ef4444';

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(Math.floor(x) + 0.5, Math.floor(highY));
        ctx.lineTo(Math.floor(x) + 0.5, Math.floor(lowY));
        ctx.stroke();

        ctx.fillStyle = color;
        const topY = Math.min(openY, closeY);
        const bodyH = Math.max(1.5, Math.abs(openY - closeY));
        ctx.fillRect(Math.floor(x - candleBodyW / 2), Math.floor(topY), candleBodyW, bodyH);
      });
    } else {
      const points = data.map((c, idx) => ({
        x: pad.left + idx * candleSlotW + candleSlotW / 2,
        y: getY(c.close)
      }));

      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + priceH);
      const strokeColor = this.change >= 0 ? '#10b981' : '#ef4444';
      grad.addColorStop(0, this.change >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.lineTo(points[points.length - 1].x, pad.top + priceH);
      ctx.lineTo(points[0].x, pad.top + priceH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 4. Render Connected Pine Script Indicator Lines & Signals (Multi-Script Support)
    if (this.connectedScripts.size > 0) {
      this.connectedScripts.forEach(({ pineOutput }) => {
        if (pineOutput && pineOutput.plots) {
          pineOutput.plots.forEach(plot => {
            ctx.save();
            ctx.strokeStyle = plot.color;
            ctx.lineWidth = plot.lineWidth || 1.5;
            if (plot.dash) ctx.setLineDash(plot.dash);

            ctx.beginPath();
            let started = false;
            plot.data.forEach((val, idx) => {
              if (val !== null && val !== undefined) {
                const x = pad.left + idx * candleSlotW + candleSlotW / 2;
                const y = getY(val);
                if (!started) {
                  ctx.moveTo(x, y);
                  started = true;
                } else {
                  ctx.lineTo(x, y);
                }
              }
            });
            ctx.stroke();
            ctx.restore();
          });
        }

        // Buy & Sell Signal Markers
        if (pineOutput && pineOutput.signals) {
          pineOutput.signals.forEach(sig => {
            const x = pad.left + sig.index * candleSlotW + candleSlotW / 2;
            const isBuy = sig.type === 'buy';
            const candle = data[sig.index];
            const y = isBuy ? getY(candle.low) + 14 : getY(candle.high) - 14;

            ctx.save();
            ctx.fillStyle = isBuy ? '#10b981' : '#ef4444';
            ctx.font = 'bold 9px Inter, sans-serif';
            ctx.textAlign = 'center';

            ctx.beginPath();
            if (isBuy) {
              ctx.moveTo(x, y - 8);
              ctx.lineTo(x - 5, y);
              ctx.lineTo(x + 5, y);
            } else {
              ctx.moveTo(x, y + 8);
              ctx.lineTo(x - 5, y);
              ctx.lineTo(x + 5, y);
            }
            ctx.closePath();
            ctx.fill();

            ctx.fillText(sig.label, x, isBuy ? y + 10 : y - 10);
            ctx.restore();
          });
        }
      });
    } else {
      // Default Baseline EMA
      const emaValues = calculateEMA(data, 14);
      ctx.beginPath();
      ctx.strokeStyle = '#0d99ff';
      ctx.lineWidth = 1.3;
      ctx.setLineDash([3, 3]);
      emaValues.forEach((val, idx) => {
        const x = pad.left + idx * candleSlotW + candleSlotW / 2;
        const y = getY(val);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Crosshair on Hover
    if (this.hoverIndex !== null && hoverX !== null && hoverY !== null) {
      const candle = data[this.hoverIndex];
      const cx = pad.left + this.hoverIndex * candleSlotW + candleSlotW / 2;
      const cy = getY(candle.close);

      ctx.save();
      ctx.strokeStyle = this.app.theme === 'light' ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(cx, pad.top);
      ctx.lineTo(cx, h - pad.bottom);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pad.left, cy);
      ctx.lineTo(w - pad.right, cy);
      ctx.stroke();

      ctx.fillStyle = '#0d99ff';
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  destroy() {
    this.connectedScripts.forEach(({ scriptFrame }) => {
      scriptFrame.disconnectFromChart(this);
    });
    this.app.removeFrame(this);
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
  }
}

// ==========================================
// Pine Script Frame Component
// ==========================================
class PineScriptFrame {
  constructor(app, options) {
    this.app = app;
    this.id = 'pine-' + Math.random().toString(36).substring(2, 9);
    this.scriptTitle = options.title || 'SMA Golden Cross';
    this.x = options.x || 0;
    this.y = options.y || 0;
    this.width = options.width || 520;
    this.height = options.height || 420;
    this.code = options.code || PINE_PRESETS.sma_cross.code;

    this.connections = new Map(); // chart.id -> { chart, portIndex }
    this.isSelected = false;

    this.createDOM();
    this.setupEvents();
    this.compileAndRun();
  }

  createDOM() {
    this.element = document.createElement('div');
    this.element.className = 'pinescript-frame';
    this.element.id = this.id;
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;

    this.element.innerHTML = `
      <!-- 4 Connector Output Port Nodes on 4 Sides (Top, Right, Bottom, Left) -->
      <div class="port-pin port-output port-top" data-port="0" data-side="top" data-tooltip="Output Node 1 (Top): Drag to Top Chart" title="Output Node 1 (Top)"><span class="port-num">1</span></div>
      <div class="port-pin port-output port-right" data-port="1" data-side="right" data-tooltip="Output Node 2 (Right): Drag to Right Chart" title="Output Node 2 (Right)"><span class="port-num">2</span></div>
      <div class="port-pin port-output port-bottom" data-port="2" data-side="bottom" data-tooltip="Output Node 3 (Bottom): Drag to Bottom Chart" title="Output Node 3 (Bottom)"><span class="port-num">3</span></div>
      <div class="port-pin port-output port-left" data-port="3" data-side="left" data-tooltip="Output Node 4 (Left): Drag to Left Chart" title="Output Node 4 (Left)"><span class="port-num">4</span></div>

      <!-- Figma Frame Tag -->
      <div class="frame-title-tag">
        <span>Frame: Pine Script Node</span>
      </div>

      <!-- Header -->
      <div class="pine-header">
        <div class="pine-header-left">
          <span class="pine-badge">Pine @v5</span>
          <select class="pine-template-select" id="${this.id}-preset">
            <option value="sma_cross">Template: SMA Golden Cross</option>
            <option value="bollinger">Template: Bollinger Bands (20,2)</option>
            <option value="rsi_reversal">Template: RSI Reversal Strategy</option>
            <option value="supertrend">Template: SuperTrend Breakout</option>
          </select>
        </div>

        <div class="pine-header-right">
          <button class="btn-compile" id="${this.id}-run" title="Compile and Execute on Connected Chart">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>Run Script</span>
          </button>
          <button class="btn-remove-chart" id="${this.id}-close" title="Close Node">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Editor Body -->
      <div class="pine-editor-area">
        <div class="pine-line-numbers" id="${this.id}-lines">1<br>2<br>3<br>4<br>5<br>6<br>7<br>8<br>9<br>10<br>11<br>12<br>13<br>14<br>15</div>
        <textarea class="pine-code-textarea" id="${this.id}-code" spellcheck="false">${this.code}</textarea>
      </div>

      <!-- Backtest & Results Panel -->
      <div class="pine-results-panel">
        <div class="pine-results-header">
          <div class="results-status">
            <span class="status-dot ${this.targetChart ? '' : 'disconnected'}" id="${this.id}-dot"></span>
            <span id="${this.id}-status-text">Disconnected (Drag wire to a chart)</span>
          </div>

          <div class="target-select-wrap">
            <span>Target:</span>
            <select id="${this.id}-target-select">
              <option value="">-- Choose Stock Chart --</option>
            </select>
          </div>
        </div>

        <!-- Metric Grid -->
        <div class="backtest-metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Net Profit</span>
            <span class="metric-value positive" id="${this.id}-profit">+18.5%</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Win Rate</span>
            <span class="metric-value" id="${this.id}-winrate">68.2%</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Total Trades</span>
            <span class="metric-value" id="${this.id}-trades">18</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Profit Factor</span>
            <span class="metric-value" id="${this.id}-pf">2.14</span>
          </div>
        </div>
      </div>

      <!-- Resize handle -->
      <div class="resize-handle" title="Resize Frame"></div>
    `;

    this.header = this.element.querySelector('.pine-header');
    this.codeTextarea = this.element.querySelector(`#${this.id}-code`);
    this.linesContainer = this.element.querySelector(`#${this.id}-lines`);
    this.presetSelect = this.element.querySelector(`#${this.id}-preset`);
    this.runBtn = this.element.querySelector(`#${this.id}-run`);
    this.closeBtn = this.element.querySelector(`#${this.id}-close`);
    this.outputPorts = Array.from(this.element.querySelectorAll('.port-output'));
    this.targetSelect = this.element.querySelector(`#${this.id}-target-select`);
    this.statusDot = this.element.querySelector(`#${this.id}-dot`);
    this.statusText = this.element.querySelector(`#${this.id}-status-text`);
    this.profitDisplay = this.element.querySelector(`#${this.id}-profit`);
    this.winrateDisplay = this.element.querySelector(`#${this.id}-winrate`);
    this.tradesDisplay = this.element.querySelector(`#${this.id}-trades`);
    this.pfDisplay = this.element.querySelector(`#${this.id}-pf`);
    this.resizeHandle = this.element.querySelector('.resize-handle');

    this.app.framesContainer.appendChild(this.element);
    this.updateLineNumbers();
  }

  setupEvents() {
    this.element.addEventListener('mousedown', (e) => {
      if (e.button === 1) return; // Allow middle-click (scroller) to pan canvas
      e.stopPropagation();
      if (!this.app.selectedFrames.has(this)) {
        this.app.selectFrame(this, e.shiftKey);
      }
    });

    // Move frame (with multi-selection drag support)
    this.header.addEventListener('mousedown', (e) => {
      if (e.button === 1) return; // Allow middle-click (scroller) to pan canvas
      if (e.target.closest('button') || e.target.closest('select')) return;
      e.stopPropagation();
      e.preventDefault();

      if (!this.app.selectedFrames.has(this)) {
        this.app.selectFrame(this, e.shiftKey);
      }

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const framesToMove = Array.from(this.app.selectedFrames).map(f => ({
        frame: f,
        startX: f.x,
        startY: f.y
      }));

      const onMouseMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startMouseX) / this.app.zoom;
        const dy = (moveEvent.clientY - startMouseY) / this.app.zoom;
        framesToMove.forEach(({ frame, startX, startY }) => {
          frame.x = startX + dx;
          frame.y = startY + dy;
          frame.element.style.left = `${frame.x}px`;
          frame.element.style.top = `${frame.y}px`;
        });
        this.app.updateWires();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Resize Frame
    this.resizeHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const startMouseX = e.clientX;
      const startMouseY = e.clientY;
      const startW = this.width;
      const startH = this.height;

      const onResizeMove = (moveEvent) => {
        const dw = (moveEvent.clientX - startMouseX) / this.app.zoom;
        const dh = (moveEvent.clientY - startMouseY) / this.app.zoom;
        this.width = Math.max(440, startW + dw);
        this.height = Math.max(340, startH + dh);
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        this.app.updateWires();
      };

      const onResizeUp = () => {
        window.removeEventListener('mousemove', onResizeMove);
        window.removeEventListener('mouseup', onResizeUp);
      };

      window.addEventListener('mousemove', onResizeMove);
      window.addEventListener('mouseup', onResizeUp);
    });

    // Editor inputs & line numbers
    this.codeTextarea.addEventListener('input', () => {
      this.code = this.codeTextarea.value;
      this.updateLineNumbers();
    });

    // Run / Compile Button
    this.runBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.compileAndRun();
    });

    // Preset selection change
    this.presetSelect.addEventListener('change', () => {
      const selected = PINE_PRESETS[this.presetSelect.value];
      if (selected) {
        this.code = selected.code;
        this.scriptTitle = selected.name;
        this.codeTextarea.value = selected.code;
        this.updateLineNumbers();
        this.compileAndRun();
      }
    });

    // Target chart selector dropdown
    this.targetSelect.addEventListener('change', () => {
      const val = this.targetSelect.value;
      if (val === '__disconnect_all__') {
        this.disconnectAll();
      } else if (val) {
        const target = this.app.stockCharts.find(c => c.id === val);
        if (target) {
          if (this.connections.has(target.id)) {
            this.disconnectFromChart(target);
          } else {
            this.connectToChart(target);
          }
        }
      }
      this.targetSelect.value = '';
    });

    // 4 Output Ports Mouse Down (Drag Connector Wire from specific node)
    this.outputPorts.forEach((portEl, idx) => {
      portEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.app.startWireDrag(this, 'output', e, idx);
      });
    });

    // Close button
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.destroy();
    });
  }

  getOutputPortWorldPos(portIndex = 0) {
    if (typeof portIndex === 'string') {
      const sideMap = { top: 0, right: 1, bottom: 2, left: 3 };
      if (sideMap[portIndex] !== undefined) portIndex = sideMap[portIndex];
    }
    const idx = Number(portIndex) || 0;
    switch (idx) {
      case 0: // Top side center
        return {
          x: this.x + this.width / 2,
          y: this.y,
          side: 'top'
        };
      case 1: // Right side center
        return {
          x: this.x + this.width,
          y: this.y + this.height / 2,
          side: 'right'
        };
      case 2: // Bottom side center
        return {
          x: this.x + this.width / 2,
          y: this.y + this.height,
          side: 'bottom'
        };
      case 3: // Left side center
        return {
          x: this.x,
          y: this.y + this.height / 2,
          side: 'left'
        };
      default:
        return {
          x: this.x + this.width,
          y: this.y + this.height / 2,
          side: 'right'
        };
    }
  }

  updateLineNumbers() {
    const linesCount = this.codeTextarea.value.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= Math.max(12, linesCount); i++) {
      numbers += `${i}<br>`;
    }
    this.linesContainer.innerHTML = numbers;
  }

  updatePortVisuals() {
    const usedPorts = new Set(Array.from(this.connections.values()).map(c => c.portIndex));
    this.outputPorts.forEach((portEl, idx) => {
      portEl.classList.toggle('connected', usedPorts.has(idx));
    });
    this.statusDot.classList.toggle('disconnected', this.connections.size === 0);
  }

  updateTargetDropdown() {
    const sideNames = ['Top Node 1', 'Right Node 2', 'Bottom Node 3', 'Left Node 4'];
    let options = '<option value="">-- Connect / Disconnect --</option>';
    this.app.stockCharts.forEach(chart => {
      const conn = this.connections.get(chart.id);
      const sideLabel = conn ? (sideNames[conn.portIndex] || `Node ${conn.portIndex + 1}`) : '';
      const text = conn ? `✓ Connected to ${sideLabel}: ${chart.symbol}` : `+ Connect: ${chart.symbol}`;
      options += `<option value="${chart.id}">${text}</option>`;
    });
    if (this.connections.size > 0) {
      options += '<option value="__disconnect_all__">Disconnect All Charts</option>';
    }
    this.targetSelect.innerHTML = options;
  }

  updateStatusText() {
    const sideNames = ['Top Node 1', 'Right Node 2', 'Bottom Node 3', 'Left Node 4'];
    if (this.connections.size === 0) {
      this.statusText.textContent = 'Disconnected (Drag from any side node: Top, Right, Bottom, Left)';
    } else if (this.connections.size === 1) {
      const first = Array.from(this.connections.values())[0];
      const sideName = sideNames[first.portIndex] || `Node ${first.portIndex + 1}`;
      this.statusText.textContent = `Applied to ${first.chart.symbol} (${sideName})`;
    } else {
      const summary = Array.from(this.connections.values())
        .map(c => `${c.chart.symbol} (${sideNames[c.portIndex] || c.portIndex + 1})`)
        .join(', ');
      this.statusText.textContent = `Applied: ${summary}`;
    }
  }

  connectToChart(chart, portIndex = null) {
    if (!chart) return;
    if (portIndex === null) {
      // Pick side facing the chart
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const chartCx = chart.x + chart.width / 2;
      const chartCy = chart.y + chart.height / 2;
      const dx = chartCx - cx;
      const dy = chartCy - cy;

      let preferredPort = 1;
      if (Math.abs(dx) / (this.width / 2) >= Math.abs(dy) / (this.height / 2)) {
        preferredPort = dx >= 0 ? 1 : 3; // Right or Left
      } else {
        preferredPort = dy < 0 ? 0 : 2; // Top or Bottom
      }

      const used = new Set(Array.from(this.connections.values()).map(c => c.portIndex));
      if (!used.has(preferredPort)) {
        portIndex = preferredPort;
      } else {
        for (let i = 0; i < 4; i++) {
          if (!used.has(i)) {
            portIndex = i;
            break;
          }
        }
      }
      if (portIndex === null) portIndex = this.connections.size % 4;
    }

    this.connections.set(chart.id, { chart, portIndex });
    this.updatePortVisuals();
    this.updateStatusText();
    this.updateTargetDropdown();
    this.compileAndRun();
    this.app.updateWires();
  }

  disconnectFromChart(chart) {
    if (!chart) return;
    this.connections.delete(chart.id);
    chart.detachPineScript(this);
    this.updatePortVisuals();
    this.updateStatusText();
    this.updateTargetDropdown();
    this.app.updateWires();
  }

  disconnectAll() {
    this.connections.forEach(({ chart }) => chart.detachPineScript(this));
    this.connections.clear();
    this.updatePortVisuals();
    this.updateStatusText();
    this.updateTargetDropdown();
    this.app.updateWires();
  }

  compileAndRun() {
    let lastResult = null;
    if (this.connections.size > 0) {
      this.connections.forEach(({ chart }) => {
        const result = PineScriptInterpreter.execute(this.codeTextarea.value, chart.data);
        if (result) {
          chart.attachPineScript(this, result);
          lastResult = result;
        }
      });
    } else {
      const sampleCandles = generateCandleSeries(150, true, 50);
      lastResult = PineScriptInterpreter.execute(this.codeTextarea.value, sampleCandles);
    }

    if (lastResult && lastResult.metrics) {
      const m = lastResult.metrics;
      this.profitDisplay.textContent = m.netProfit;
      this.profitDisplay.className = `metric-value ${m.isProfitPos ? 'positive' : 'negative'}`;
      this.winrateDisplay.textContent = m.winRate;
      this.tradesDisplay.textContent = m.totalTrades;
      this.pfDisplay.textContent = m.profitFactor;
    }
  }

  destroy() {
    this.disconnectAll();
    this.app.removeFrame(this);
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
  }
}

// ==========================================
// Figma Section Frame (Grouping Container)
// ==========================================
class CanvasSectionFrame {
  constructor(app, options = {}) {
    this.app = app;
    this.id = 'section-' + Math.random().toString(36).substring(2, 9);
    this.title = options.title || 'Alpha Section';
    this.color = options.color || 'purple'; // purple, blue, green, amber, rose
    this.x = options.x !== undefined ? options.x : 0;
    this.y = options.y !== undefined ? options.y : 0;
    this.width = options.width || 680;
    this.height = options.height || 540;
    this.isSelected = false;
    this.isLocked = false;
    this.isVisible = true;

    this.createDOM();
    this.setupEvents();
    this.updateContainedBadge();
  }

  createDOM() {
    this.element = document.createElement('div');
    this.element.className = `canvas-section color-${this.color}`;
    this.element.id = this.id;
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;

    this.element.innerHTML = `
      <div class="section-header-tag" title="Drag Section Header to Move Enclosed Frames">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="3 3"/>
        </svg>
        <input type="text" class="section-title-input" value="${this.title}" />
        <span class="section-count-badge" id="${this.id}-badge">0</span>
      </div>
      <div class="section-resize-handle" title="Resize Section Frame"></div>
    `;

    this.header = this.element.querySelector('.section-header-tag');
    this.titleInput = this.element.querySelector('.section-title-input');
    this.badge = this.element.querySelector('.section-count-badge');
    this.resizeHandle = this.element.querySelector('.section-resize-handle');

    this.app.framesContainer.appendChild(this.element);
  }

  setupEvents() {
    this.titleInput.addEventListener('mousedown', (e) => e.stopPropagation());
    this.titleInput.addEventListener('input', (e) => {
      this.title = e.target.value.trim() || 'Section';
      this.app.updateLayersTree();
      this.app.updateInspector();
    });

    this.element.addEventListener('mousedown', (e) => {
      if (e.button === 1) return; // Allow middle-click panning
      e.stopPropagation();
      if (!this.app.selectedFrames.has(this)) {
        this.app.selectFrame(this, e.shiftKey);
      }
    });

    // Move Section and all contained frames seamlessly
    this.header.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.isLocked) return;
      e.stopPropagation();

      const contained = this.getContainedFrames();
      const framesToMove = new Set([this, ...contained]);
      const initialPositions = new Map();
      framesToMove.forEach(f => {
        initialPositions.set(f, { x: f.x, y: f.y });
      });

      const startWorld = this.app.screenToWorld(e.clientX, e.clientY);

      const onMouseMove = (moveEvent) => {
        const currentWorld = this.app.screenToWorld(moveEvent.clientX, moveEvent.clientY);
        const dx = currentWorld.x - startWorld.x;
        const dy = currentWorld.y - startWorld.y;

        framesToMove.forEach(f => {
          const init = initialPositions.get(f);
          f.x = init.x + dx;
          f.y = init.y + dy;
          f.element.style.left = `${f.x}px`;
          f.element.style.top = `${f.y}px`;
        });

        this.app.updateWires();
        this.app.updateMinimap();
        this.app.updateTransformInputs();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.updateContainedBadge();
        this.app.pushHistory('Move Section');
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Corner Resizing
    this.resizeHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.isLocked) return;
      e.stopPropagation();
      const startW = this.width;
      const startH = this.height;
      const startMouseX = e.clientX;
      const startMouseY = e.clientY;

      const onMouseMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startMouseX) / this.app.zoom;
        const dy = (moveEvent.clientY - startMouseY) / this.app.zoom;
        this.width = Math.max(220, Math.round(startW + dx));
        this.height = Math.max(160, Math.round(startH + dy));
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        this.updateContainedBadge();
        this.app.updateMinimap();
        this.app.updateTransformInputs();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.app.pushHistory('Resize Section');
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  getContainedFrames() {
    const contained = [];
    const all = [...this.app.stockCharts, ...this.app.pineNodes, ...this.app.notes];
    all.forEach(f => {
      const centerX = f.x + f.width / 2;
      const centerY = f.y + f.height / 2;
      if (centerX >= this.x && centerX <= this.x + this.width &&
          centerY >= this.y && centerY <= this.y + this.height) {
        contained.push(f);
      }
    });
    return contained;
  }

  updateContainedBadge() {
    if (this.badge) {
      const count = this.getContainedFrames().length;
      this.badge.textContent = `${count}`;
    }
  }

  setColor(col) {
    this.element.classList.remove(`color-${this.color}`);
    this.color = col;
    this.element.classList.add(`color-${this.color}`);
    this.app.updateInspector();
    this.app.pushHistory('Change Section Color');
  }

  destroy() {
    this.app.removeFrame(this);
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
  }
}

// ==========================================
// Sticky Note Frame (Figma / FigJam Journal)
// ==========================================
class StickyNoteFrame {
  constructor(app, options = {}) {
    this.app = app;
    this.id = 'note-' + Math.random().toString(36).substring(2, 9);
    this.content = options.content || 'Trading Note / Checklist:\n- Confirm trend on 1D\n- Risk/Reward: 1:3 min\n- Stop loss placed!';
    this.color = options.color || 'yellow'; // yellow, green, blue, purple, pink, dark
    this.x = options.x !== undefined ? options.x : 0;
    this.y = options.y !== undefined ? options.y : 0;
    this.width = options.width || 220;
    this.height = options.height || 180;
    this.isSelected = false;
    this.isLocked = false;
    this.isVisible = true;

    this.createDOM();
    this.setupEvents();
  }

  createDOM() {
    this.element = document.createElement('div');
    this.element.className = `sticky-note-frame note-${this.color}`;
    this.element.id = this.id;
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
    this.element.style.width = `${this.width}px`;
    this.element.style.height = `${this.height}px`;

    this.element.innerHTML = `
      <div class="sticky-header">
        <span class="sticky-title">Trader Note</span>
        <div class="sticky-actions">
          <div class="sticky-color-dot" data-col="yellow" style="background:#fef08a" title="Yellow"></div>
          <div class="sticky-color-dot" data-col="green" style="background:#bbf7d0" title="Green"></div>
          <div class="sticky-color-dot" data-col="blue" style="background:#bae6fd" title="Blue"></div>
          <div class="sticky-color-dot" data-col="purple" style="background:#e9d5ff" title="Purple"></div>
          <div class="sticky-color-dot" data-col="pink" style="background:#fbcfe8" title="Pink"></div>
          <button class="btn-remove-note" title="Delete Note">✕</button>
        </div>
      </div>
      <div class="sticky-body">
        <textarea class="sticky-textarea" placeholder="Type trading plan or notes...">${this.content}</textarea>
      </div>
      <div class="resize-handle" title="Resize Note"></div>
    `;

    this.header = this.element.querySelector('.sticky-header');
    this.textarea = this.element.querySelector('.sticky-textarea');
    this.btnRemove = this.element.querySelector('.btn-remove-note');
    this.resizeHandle = this.element.querySelector('.resize-handle');

    this.app.framesContainer.appendChild(this.element);
  }

  setupEvents() {
    this.element.addEventListener('mousedown', (e) => {
      if (e.button === 1) return; // Allow middle-click panning
      e.stopPropagation();
      if (!this.app.selectedFrames.has(this)) {
        this.app.selectFrame(this, e.shiftKey);
      }
    });

    this.textarea.addEventListener('input', (e) => {
      this.content = e.target.value;
    });

    this.element.querySelectorAll('.sticky-color-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setColor(dot.dataset.col);
      });
    });

    this.btnRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      this.destroy();
    });

    // Drag header to move
    this.header.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.isLocked) return;
      e.stopPropagation();
      const framesToMove = this.app.selectedFrames.has(this) ? Array.from(this.app.selectedFrames) : [this];
      const initialPositions = new Map();
      framesToMove.forEach(f => initialPositions.set(f, { x: f.x, y: f.y }));
      const startWorld = this.app.screenToWorld(e.clientX, e.clientY);

      const onMouseMove = (moveEvent) => {
        const currentWorld = this.app.screenToWorld(moveEvent.clientX, moveEvent.clientY);
        const dx = currentWorld.x - startWorld.x;
        const dy = currentWorld.y - startWorld.y;
        framesToMove.forEach(f => {
          const init = initialPositions.get(f);
          f.x = init.x + dx;
          f.y = init.y + dy;
          f.element.style.left = `${f.x}px`;
          f.element.style.top = `${f.y}px`;
        });
        this.app.updateWires();
        this.app.updateMinimap();
        this.app.updateTransformInputs();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.app.pushHistory('Move Note');
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    // Resize Note
    this.resizeHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || this.isLocked) return;
      e.stopPropagation();
      const startW = this.width;
      const startH = this.height;
      const startMouseX = e.clientX;
      const startMouseY = e.clientY;

      const onMouseMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startMouseX) / this.app.zoom;
        const dy = (moveEvent.clientY - startMouseY) / this.app.zoom;
        this.width = Math.max(160, Math.round(startW + dx));
        this.height = Math.max(120, Math.round(startH + dy));
        this.element.style.width = `${this.width}px`;
        this.element.style.height = `${this.height}px`;
        this.app.updateMinimap();
        this.app.updateTransformInputs();
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        this.app.pushHistory('Resize Note');
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  setColor(col) {
    this.element.classList.remove(`note-${this.color}`);
    this.color = col;
    this.element.classList.add(`note-${this.color}`);
    this.app.updateInspector();
    this.app.pushHistory('Change Note Color');
  }

  destroy() {
    this.app.removeFrame(this);
    if (this.element && this.element.parentElement) {
      this.element.parentElement.removeChild(this.element);
    }
  }
}

// ==========================================
// Main Figma Canvas Application
// ==========================================
class FigmaCanvasApp {
  constructor() {
    this.canvas = document.getElementById('bg-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.worldContainer = document.getElementById('canvas-world');
    this.wiresSvg = document.getElementById('canvas-wires');
    this.framesContainer = document.getElementById('world-frames');

    // Pan & Zoom
    this.pan = { x: 0, y: 0 };
    this.zoom = 1.0;
    this.minZoom = 0.05;
    this.maxZoom = 24.0;

    // Canvas state
    this.isDraggingCanvas = false;
    this.dragStart = { x: 0, y: 0 };
    this.isSpacePressed = false;
    this.gridMode = 'dots';
    this.theme = 'dark';

    // Frames & Selection
    this.stockCharts = [];
    this.pineNodes = [];
    this.sections = [];
    this.notes = [];
    this.selectedFrames = new Set();
    this.selectedFrame = null;
    this.activeWireDrag = null; // { sourceFrame, type: 'output' | 'input', tempPath }

    // History (Undo / Redo)
    this.history = [];
    this.historyIndex = -1;
    this.isHistoryApplying = false;

    // Figma Drag Selection Box State
    this.selectionBox = document.getElementById('canvas-selection-box');
    this.isSelectingMarquee = false;
    this.marqueeStart = { x: 0, y: 0 };
    this.marqueePreservedSelection = null;

    // UI elements
    this.coordDisplay = document.getElementById('coord-display');
    this.zoomText = document.getElementById('zoom-text');
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnZoomReset = document.getElementById('btn-zoom-reset');
    this.btnCenter = document.getElementById('btn-center');
    this.btnGridDots = document.getElementById('btn-grid-dots');
    this.btnGridLines = document.getElementById('btn-grid-lines');
    this.btnGridNone = document.getElementById('btn-grid-none');
    this.btnThemeToggle = document.getElementById('btn-theme-toggle');
    this.btnOpenStockModal = document.getElementById('btn-open-stock-modal');
    this.btnAddPineScript = document.getElementById('btn-add-pinescript');
    this.btnArrangeCharts = document.getElementById('btn-arrange-charts');

    // Header Figma Actions
    this.btnToggleLayers = document.getElementById('btn-toggle-layers');
    this.btnToggleInspector = document.getElementById('btn-toggle-inspector');
    this.btnToggleMinimap = document.getElementById('btn-toggle-minimap');
    this.btnUndo = document.getElementById('btn-undo');
    this.btnRedo = document.getElementById('btn-redo');
    this.btnAddSection = document.getElementById('btn-add-section');
    this.btnAddNote = document.getElementById('btn-add-note');
    this.btnExportCanvas = document.getElementById('btn-export-canvas');

    // Figma Left Sidebar
    this.leftSidebar = document.getElementById('figma-left-sidebar');
    this.btnCloseLeftSidebar = document.getElementById('btn-close-left-sidebar');
    this.tabBtnLayers = document.getElementById('tab-btn-layers');
    this.tabBtnAssets = document.getElementById('tab-btn-assets');
    this.paneLayers = document.getElementById('pane-layers');
    this.paneAssets = document.getElementById('pane-assets');
    this.layersFilterInput = document.getElementById('layers-filter-input');
    this.layersTreeList = document.getElementById('layers-tree-list');
    this.quickStocksGrid = document.getElementById('quick-stocks-grid');
    this.quickScriptsGrid = document.getElementById('quick-scripts-grid');

    // Figma Right Sidebar (Design Inspector)
    this.rightSidebar = document.getElementById('figma-right-sidebar');
    this.btnCloseRightSidebar = document.getElementById('btn-close-right-sidebar');
    this.btnAlignLeft = document.getElementById('btn-align-left');
    this.btnAlignCenterH = document.getElementById('btn-align-center-h');
    this.btnAlignRight = document.getElementById('btn-align-right');
    this.btnAlignTop = document.getElementById('btn-align-top');
    this.btnAlignCenterV = document.getElementById('btn-align-center-v');
    this.btnAlignBottom = document.getElementById('btn-align-bottom');
    this.propInputX = document.getElementById('prop-input-x');
    this.propInputY = document.getElementById('prop-input-y');
    this.propInputW = document.getElementById('prop-input-w');
    this.propInputH = document.getElementById('prop-input-h');
    this.inspectorDynamicProps = document.getElementById('inspector-dynamic-props');

    // Minimap Radar
    this.minimapContainer = document.getElementById('canvas-minimap');
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;
    this.btnCloseMinimap = document.getElementById('btn-close-minimap');

    // Modal elements
    this.stockModalOverlay = document.getElementById('stock-modal-overlay');
    this.stockSearchInput = document.getElementById('stock-search-input');
    this.stockListContainer = document.getElementById('stock-list-container');
    this.btnCloseModal = document.getElementById('btn-close-modal');

    this.init();
  }

  init() {
    this.setupResize();
    this.setupEventListeners();
    this.setupStockModal();
    this.setupLiveSimulation();

    // Setup Figma Sidebars, Panels & Controls
    this.setupFigmaSidebars();
    this.setupFigmaInspector();
    this.setupLayersPanel();
    this.setupQuickAssets();
    this.setupMinimap();
    this.setupHistoryManager();
    this.setupExportBoard();

    // Initial Figma Section: grouping the trading diamond
    const initialSection = this.addSectionFrame(-920, -680, {
      width: 1840,
      height: 1080,
      title: 'Strategy Engine & Feeds',
      color: 'purple'
    });

    // Center Node: Just one Pine Script Node centered at (0, 0)
    const pine = this.addPineScriptNode(-260, -210);

    // 4 Sides: Neatly place just one stock chart node at each of the 4 sides!
    // Top Side: TSLA
    const tsla = this.addStockChart('TSLA', -240, -620);
    // Right Side: NVDA
    const nvda = this.addStockChart('NVDA', 380, -170);
    // Bottom Side: BTC/USD
    const btc = this.addStockChart('BTC/USD', -240, 290);
    // Left Side: AAPL
    const aapl = this.addStockChart('AAPL', -860, -170);

    // Initial Sticky Note: Trading Plan & Guide
    this.addStickyNote(960, -200, {
      color: 'yellow',
      content: 'Trading Canvas Pro\n• Pine Script in center feeds 4 charts\n• S: Add Section Frame\n• N: Add Sticky Note\n• C: Add Stock Chart\n• P: Add Pine Script\n• M: Toggle Minimap Radar'
    });

    // Center view with comfortable zoom level
    this.centerView();

    // Auto-connect each side port cleanly to its respective side chart!
    setTimeout(() => {
      pine.connectToChart(tsla, 0); // Output Node 1 (Top) -> TSLA (Top)
      pine.connectToChart(nvda, 1); // Output Node 2 (Right) -> NVDA (Right)
      pine.connectToChart(btc, 2);  // Output Node 3 (Bottom) -> BTC/USD (Bottom)
      pine.connectToChart(aapl, 3); // Output Node 4 (Left) -> AAPL (Left)
      this.updateWires();
      if (initialSection) initialSection.updateContainedBadge();
      this.updateLayersTree();
      this.updateMinimap();
      this.pushHistory('Initial Canvas');
    }, 120);

    this.requestRender();
  }

  setupResize() {
    const handleResize = () => {
      this.dpr = window.devicePixelRatio || 1;
      this.width = window.innerWidth;
      this.height = window.innerHeight;

      this.canvas.width = Math.floor(this.width * this.dpr);
      this.canvas.height = Math.floor(this.height * this.dpr);
      this.canvas.style.width = `${this.width}px`;
      this.canvas.style.height = `${this.height}px`;

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.dpr, this.dpr);
      this.requestRender();
    };

    window.addEventListener('resize', handleResize);
    handleResize();
  }

  centerView() {
    this.pan = {
      x: this.width / 2,
      y: this.height / 2
    };
    this.zoom = 0.72;
    this.updateTransform();
    this.requestRender();
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.pan.x) / this.zoom,
      y: (screenY - this.pan.y) / this.zoom
    };
  }

  worldToScreen(worldX, worldY) {
    return {
      x: worldX * this.zoom + this.pan.x,
      y: worldY * this.zoom + this.pan.y
    };
  }

  setZoomAtPoint(newZoom, screenX, screenY) {
    const clampedZoom = Math.min(Math.max(newZoom, this.minZoom), this.maxZoom);
    if (clampedZoom === this.zoom) return;

    const worldBefore = this.screenToWorld(screenX, screenY);
    this.zoom = clampedZoom;
    this.pan.x = screenX - worldBefore.x * this.zoom;
    this.pan.y = screenY - worldBefore.y * this.zoom;

    this.updateTransform();
    this.requestRender();
  }

  updateTransform() {
    this.worldContainer.style.transform = `translate(${this.pan.x}px, ${this.pan.y}px) scale(${this.zoom})`;
    this.worldContainer.style.transformOrigin = '0 0';

    const percentage = Math.round(this.zoom * 100);
    this.zoomText.textContent = `${percentage}%`;
    this.updateWires();
  }

  setupEventListeners() {
    // Prevent default middle-click autoscroll icon in browsers
    window.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });

    // Middle-click (scroller click) anywhere on screen allows moving the canvas
    window.addEventListener('mousedown', (e) => {
      // Track last clicked world position for cursor-targeted pasting
      this.lastClickedWorldPos = this.screenToWorld(e.clientX, e.clientY);

      if (e.button === 1) {
        e.preventDefault();
        this.isDraggingCanvas = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.canvas.classList.add('panning-active');
        document.body.classList.add('panning-cursor');
      }
    });

    window.addEventListener('mousemove', (e) => {
      const world = this.screenToWorld(e.clientX, e.clientY);
      this.mouseWorldPos = world;
      this.coordDisplay.textContent = `X: ${Math.round(world.x)}  Y: ${Math.round(world.y)}`;

      // Pan canvas (with scroller / middle-click or space drag)
      if (this.isDraggingCanvas) {
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        this.pan.x += dx;
        this.pan.y += dy;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.updateTransform();
        this.requestRender();
      }

      // Dragging selection panel / marquee box
      if (this.isSelectingMarquee) {
        this.updateMarqueeBox(e.clientX, e.clientY);
      }

      // Dragging connector wire
      if (this.activeWireDrag) {
        this.updateWireDrag(e.clientX, e.clientY);
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.lastClickedWorldPos = this.screenToWorld(e.clientX, e.clientY);

      // Scroller (middle button) or space + left click pans canvas
      if (e.button === 1 || this.isSpacePressed) {
        this.isDraggingCanvas = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.canvas.classList.add('panning-active');
        document.body.classList.add('panning-cursor');
        return;
      }

      // Left click (button 0) on canvas opens selection panel / marquee box!
      if (e.button === 0) {
        this.isSelectingMarquee = true;
        this.marqueeStart = { x: e.clientX, y: e.clientY };
        this.marqueePreservedSelection = e.shiftKey ? new Set(this.selectedFrames) : new Set();
        if (!e.shiftKey) {
          this.deselectAll();
        }
        this.updateMarqueeBox(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isDraggingCanvas) {
        this.isDraggingCanvas = false;
        this.canvas.classList.remove('panning-active');
        document.body.classList.remove('panning-cursor');
        if (!this.isSpacePressed) {
          this.canvas.classList.remove('panning');
        }
      }

      if (this.isSelectingMarquee) {
        this.finishMarqueeBox(e.clientX, e.clientY);
      }

      if (this.activeWireDrag) {
        this.endWireDrag(e);
      }
    });

    window.addEventListener('wheel', (e) => {
      if (!this.stockModalOverlay.classList.contains('hidden')) return;

      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.0035);
        this.setZoomAtPoint(this.zoom * factor, e.clientX, e.clientY);
      } else {
        if (e.target === this.canvas || e.target.id === 'app' || e.target.id === 'canvas-world') {
          e.preventDefault();
          this.pan.x -= e.deltaX;
          this.pan.y -= e.deltaY;
          this.updateTransform();
          this.requestRender();
        }
      }
    }, { passive: false });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
      if (isInput) {
        if (e.key === 'Escape') this.closeStockModal();
        return;
      }

      // Undo: Ctrl+Z / Cmd+Z (without shift)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault();
        this.undo();
        return;
      }

      // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
        e.preventDefault();
        this.redo();
        return;
      }

      // Ctrl+C / Cmd+C: Copy selected frame(s)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        this.copySelectedFrames();
        return;
      }

      // Ctrl+V / Cmd+V: Paste copied frame(s)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        this.pasteClipboardFrames();
        return;
      }

      // Ctrl+D / Cmd+D: Duplicate selected frame(s)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        this.duplicateSelectedFrames();
        return;
      }

      if (e.code === 'Space' && !this.isSpacePressed) {
        e.preventDefault();
        this.isSpacePressed = true;
        this.canvas.classList.add('panning');
      }

      // 'C' opens stock modal
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.openStockModal();
      }

      // 'P' adds new Pine Script node
      if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.addPineScriptNode();
      }

      // 'S' adds new Figma Section frame
      if ((e.key === 's' || e.key === 'S') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.addSectionFrame();
      }

      // 'N' adds new Sticky Note frame
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.addStickyNote();
      }

      // 'M' toggles Minimap Radar
      if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        this.toggleMinimap();
      }

      // Alt+L toggles Left Layers sidebar
      if (e.altKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        this.toggleLeftSidebar();
      }

      // Alt+R toggles Right Design Inspector
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        this.toggleRightSidebar();
      }

      // Delete selected frame(s)
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedFrames.size > 0) {
        e.preventDefault();
        const toDelete = Array.from(this.selectedFrames);
        toDelete.forEach(f => f.destroy());
      }

      // Zoom
      if ((e.key === '=' || e.key === '+') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.setZoomAtPoint(this.zoom * 1.25, this.width / 2, this.height / 2);
      }

      if (e.key === '-' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.setZoomAtPoint(this.zoom / 1.25, this.width / 2, this.height / 2);
      }

      if ((e.key === '0' && (e.ctrlKey || e.metaKey)) || (e.code === 'Digit1' && e.shiftKey)) {
        e.preventDefault();
        this.centerView();
      }

      if (e.key === 'Escape') {
        this.closeStockModal();
        this.deselectAll();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (!this.isDraggingCanvas) {
          this.canvas.classList.remove('panning');
        }
      }
    });

    // Toolbar buttons
    this.btnZoomIn.addEventListener('click', () => {
      this.setZoomAtPoint(this.zoom * 1.25, this.width / 2, this.height / 2);
    });

    this.btnZoomOut.addEventListener('click', () => {
      this.setZoomAtPoint(this.zoom / 1.25, this.width / 2, this.height / 2);
    });

    this.btnZoomReset.addEventListener('click', () => {
      this.setZoomAtPoint(1.0, this.width / 2, this.height / 2);
    });

    this.btnCenter.addEventListener('click', () => {
      this.centerView();
    });

    this.btnAddPineScript.addEventListener('click', () => {
      this.addPineScriptNode();
    });

    this.btnArrangeCharts.addEventListener('click', () => {
      this.autoArrangeCharts();
    });

    // Figma Header Button Listeners
    if (this.btnToggleLayers) {
      this.btnToggleLayers.addEventListener('click', () => this.toggleLeftSidebar());
    }
    if (this.btnToggleInspector) {
      this.btnToggleInspector.addEventListener('click', () => this.toggleRightSidebar());
    }
    if (this.btnToggleMinimap) {
      this.btnToggleMinimap.addEventListener('click', () => this.toggleMinimap());
    }
    if (this.btnUndo) {
      this.btnUndo.addEventListener('click', () => this.undo());
    }
    if (this.btnRedo) {
      this.btnRedo.addEventListener('click', () => this.redo());
    }
    if (this.btnAddSection) {
      this.btnAddSection.addEventListener('click', () => this.addSectionFrame());
    }
    if (this.btnAddNote) {
      this.btnAddNote.addEventListener('click', () => this.addStickyNote());
    }
    if (this.btnExportCanvas) {
      this.btnExportCanvas.addEventListener('click', () => this.exportCanvasToPNG());
    }

    // Grid modes
    const setGrid = (mode) => {
      this.gridMode = mode;
      this.btnGridDots.classList.toggle('active', mode === 'dots');
      this.btnGridLines.classList.toggle('active', mode === 'lines');
      this.btnGridNone.classList.toggle('active', mode === 'none');
      this.requestRender();
    };

    this.btnGridDots.addEventListener('click', () => setGrid('dots'));
    this.btnGridLines.addEventListener('click', () => setGrid('lines'));
    this.btnGridNone.addEventListener('click', () => setGrid('none'));

    // Theme toggle
    this.btnThemeToggle.addEventListener('click', () => {
      this.theme = this.theme === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', this.theme);
      this.updateThemeVisuals();
      this.stockCharts.forEach(c => c.renderChart());
      this.requestRender();
    });
  }

  updateThemeVisuals() {
    const isLight = this.theme === 'light';
    const icon = document.getElementById('theme-icon');
    if (isLight) {
      icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
    } else {
      icon.innerHTML = `
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
      `;
    }
  }

  // ==========================================
  // Frame Management & Selection (Figma Marquee Support)
  // ==========================================
  selectFrame(frame, multi = false) {
    if (!multi) {
      this.deselectAll();
    }
    this.selectedFrames.add(frame);
    this.selectedFrame = frame;
    frame.isSelected = true;
    frame.element.classList.add('selected');
    this.updateInspector();
    this.updateLayersTree();
    this.updateMinimap();
  }

  addToSelection(frame) {
    this.selectedFrames.add(frame);
    this.selectedFrame = frame;
    frame.isSelected = true;
    frame.element.classList.add('selected');
    this.updateInspector();
    this.updateLayersTree();
    this.updateMinimap();
  }

  removeFromSelection(frame) {
    this.selectedFrames.delete(frame);
    frame.isSelected = false;
    frame.element.classList.remove('selected');
    if (this.selectedFrame === frame) {
      this.selectedFrame = this.selectedFrames.values().next().value || null;
    }
    this.updateInspector();
    this.updateLayersTree();
    this.updateMinimap();
  }

  deselectAll() {
    this.selectedFrames.forEach(f => {
      f.isSelected = false;
      f.element.classList.remove('selected');
    });
    this.selectedFrames.clear();
    this.selectedFrame = null;
    this.updateInspector();
    this.updateLayersTree();
    this.updateMinimap();
  }

  updateMarqueeBox(currentX, currentY) {
    if (!this.selectionBox) return;

    const left = Math.min(this.marqueeStart.x, currentX);
    const top = Math.min(this.marqueeStart.y, currentY);
    const width = Math.abs(currentX - this.marqueeStart.x);
    const height = Math.abs(currentY - this.marqueeStart.y);

    this.selectionBox.style.left = `${left}px`;
    this.selectionBox.style.top = `${top}px`;
    this.selectionBox.style.width = `${width}px`;
    this.selectionBox.style.height = `${height}px`;

    if (width > 3 || height > 3) {
      this.selectionBox.style.display = 'block';

      const marqueeRect = {
        left,
        top,
        right: left + width,
        bottom: top + height
      };

      const allFrames = [...this.stockCharts, ...this.pineNodes, ...this.sections, ...this.notes];
      allFrames.forEach(frame => {
        const frameRect = frame.element.getBoundingClientRect();
        const intersects = !(
          marqueeRect.right < frameRect.left ||
          marqueeRect.left > frameRect.right ||
          marqueeRect.bottom < frameRect.top ||
          marqueeRect.top > frameRect.bottom
        );

        if (intersects) {
          this.addToSelection(frame);
        } else if (!this.marqueePreservedSelection || !this.marqueePreservedSelection.has(frame)) {
          this.removeFromSelection(frame);
        }
      });
    }
  }

  finishMarqueeBox(currentX, currentY) {
    const width = Math.abs(currentX - this.marqueeStart.x);
    const height = Math.abs(currentY - this.marqueeStart.y);

    if (this.selectionBox) {
      this.selectionBox.style.display = 'none';
      this.selectionBox.style.width = '0px';
      this.selectionBox.style.height = '0px';
    }

    if (width <= 4 && height <= 4) {
      // Simple left-click on empty canvas clears selection
      this.deselectAll();
    }

    this.isSelectingMarquee = false;
    this.marqueePreservedSelection = null;
  }

  removeFrame(frame) {
    if (frame instanceof StockChartFrame) {
      const idx = this.stockCharts.indexOf(frame);
      if (idx !== -1) this.stockCharts.splice(idx, 1);
      this.pineNodes.forEach(pine => {
        if (pine.connections && pine.connections.has(frame.id)) {
          pine.disconnectFromChart(frame);
        }
      });
    } else if (frame instanceof PineScriptFrame) {
      const idx = this.pineNodes.indexOf(frame);
      if (idx !== -1) this.pineNodes.splice(idx, 1);
    } else if (frame instanceof CanvasSectionFrame) {
      const idx = this.sections.indexOf(frame);
      if (idx !== -1) this.sections.splice(idx, 1);
    } else if (frame instanceof StickyNoteFrame) {
      const idx = this.notes.indexOf(frame);
      if (idx !== -1) this.notes.splice(idx, 1);
    }

    this.selectedFrames.delete(frame);
    if (this.selectedFrame === frame) {
      this.selectedFrame = this.selectedFrames.values().next().value || null;
    }
    this.updateTargetDropdowns();
    this.updateWires();
    this.updateLayersTree();
    this.updateInspector();
    this.updateMinimap();
    this.pushHistory('Delete Frame');
  }

  // ==========================================
  // Clipboard (Copy, Paste & Duplicate)
  // ==========================================
  showToast(message) {
    let toast = document.getElementById('canvas-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'canvas-toast';
      toast.className = 'canvas-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg> <span>${message}</span>`;
    toast.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 1800);
  }

  copySelectedFrames() {
    if (this.selectedFrames.size === 0) return;

    this.clipboard = Array.from(this.selectedFrames).map(frame => {
      if (frame instanceof StockChartFrame) {
        return {
          type: 'stock',
          symbol: frame.symbol,
          name: frame.name,
          price: frame.price,
          change: frame.change,
          timeframe: frame.timeframe,
          chartType: frame.chartType,
          width: frame.width,
          height: frame.height,
          x: frame.x,
          y: frame.y
        };
      } else if (frame instanceof PineScriptFrame) {
        return {
          type: 'pine',
          scriptTitle: frame.scriptTitle,
          code: frame.codeTextarea ? frame.codeTextarea.value : frame.code,
          preset: frame.presetSelect ? frame.presetSelect.value : 'sma_cross',
          width: frame.width,
          height: frame.height,
          x: frame.x,
          y: frame.y
        };
      } else if (frame instanceof CanvasSectionFrame) {
        return {
          type: 'section',
          title: frame.title,
          color: frame.color,
          width: frame.width,
          height: frame.height,
          x: frame.x,
          y: frame.y
        };
      } else if (frame instanceof StickyNoteFrame) {
        return {
          type: 'note',
          content: frame.content,
          color: frame.color,
          width: frame.width,
          height: frame.height,
          x: frame.x,
          y: frame.y
        };
      }
      return null;
    }).filter(Boolean);

    const count = this.clipboard.length;
    this.showToast(`Copied ${count} frame${count > 1 ? 's' : ''}`);
  }

  isGroupOverlapping(groupX, groupY, items, minX, minY, padding = 25) {
    const allExisting = [...this.stockCharts, ...this.pineNodes, ...this.sections, ...this.notes];
    for (const item of items) {
      const itemX = groupX + (item.x - minX);
      const itemY = groupY + (item.y - minY);
      const itemW = item.width;
      const itemH = item.height;

      for (const f of allExisting) {
        const overlaps = !(
          itemX + itemW + padding <= f.x ||
          itemX >= f.x + f.width + padding ||
          itemY + itemH + padding <= f.y ||
          itemY >= f.y + f.height + padding
        );
        if (overlaps) return true;
      }
    }
    return false;
  }

  findNonOverlappingPosition(startX, startY, items, minX, minY) {
    if (!this.isGroupOverlapping(startX, startY, items, minX, minY)) {
      return { x: startX, y: startY };
    }

    for (let step = 1; step <= 20; step++) {
      const testX = startX + step * 40;
      const testY = startY + step * 40;
      if (!this.isGroupOverlapping(testX, testY, items, minX, minY)) {
        return { x: testX, y: testY };
      }
    }

    const sampleItem = items[0] || { width: 480, height: 340 };
    const stepW = sampleItem.width + 40;
    const stepH = sampleItem.height + 40;

    const ringOffsets = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
      { dx: 1, dy: 1 }, { dx: -1, dy: 1 }, { dx: 1, dy: -1 }, { dx: -1, dy: -1 },
      { dx: 2, dy: 0 }, { dx: -2, dy: 0 }, { dx: 0, dy: 2 }, { dx: 0, dy: -2 },
      { dx: 2, dy: 1 }, { dx: -2, dy: 1 }, { dx: 1, dy: 2 }, { dx: -1, dy: 2 }
    ];

    for (const off of ringOffsets) {
      const testX = Math.round(startX + off.dx * stepW);
      const testY = Math.round(startY + off.dy * stepH);
      if (!this.isGroupOverlapping(testX, testY, items, minX, minY)) {
        return { x: testX, y: testY };
      }
    }

    return { x: startX + 60, y: startY + 60 };
  }

  pasteClipboardFrames() {
    if (!this.clipboard || this.clipboard.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    this.clipboard.forEach(item => {
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    });

    const groupW = maxX - minX;
    const groupH = maxY - minY;

    let targetX, targetY;
    if (this.lastClickedWorldPos) {
      targetX = Math.round(this.lastClickedWorldPos.x - groupW / 2);
      targetY = Math.round(this.lastClickedWorldPos.y - groupH / 2);
    } else if (this.mouseWorldPos) {
      targetX = Math.round(this.mouseWorldPos.x - groupW / 2);
      targetY = Math.round(this.mouseWorldPos.y - groupH / 2);
    } else {
      const centerScreen = this.screenToWorld(this.width / 2, this.height / 2);
      targetX = Math.round(centerScreen.x - groupW / 2);
      targetY = Math.round(centerScreen.y - groupH / 2);
    }

    const safePos = this.findNonOverlappingPosition(targetX, targetY, this.clipboard, minX, minY);

    this.deselectAll();
    const newFrames = [];

    this.clipboard.forEach(item => {
      const newX = safePos.x + (item.x - minX);
      const newY = safePos.y + (item.y - minY);

      if (item.type === 'stock') {
        const frame = this.addStockChart(item.symbol, newX, newY, {
          price: item.price,
          change: item.change,
          chartType: item.chartType,
          timeframe: item.timeframe,
          width: item.width,
          height: item.height
        });
        newFrames.push(frame);
      } else if (item.type === 'pine') {
        const pine = this.addPineScriptNode(newX, newY, {
          title: item.scriptTitle,
          code: item.code,
          width: item.width,
          height: item.height
        });
        if (pine.presetSelect && item.preset) {
          pine.presetSelect.value = item.preset;
        }
        pine.compileAndRun();
        newFrames.push(pine);
      } else if (item.type === 'section') {
        const sec = this.addSectionFrame(newX, newY, {
          title: item.title,
          color: item.color,
          width: item.width,
          height: item.height
        });
        newFrames.push(sec);
      } else if (item.type === 'note') {
        const note = this.addStickyNote(newX, newY, {
          content: item.content,
          color: item.color,
          width: item.width,
          height: item.height
        });
        newFrames.push(note);
      }
    });

    newFrames.forEach(f => this.addToSelection(f));

    this.lastClickedWorldPos = {
      x: safePos.x + groupW / 2 + 50,
      y: safePos.y + groupH / 2 + 50
    };

    this.updateTargetDropdowns();
    this.updateWires();
    this.updateLayersTree();
    this.updateMinimap();
    this.pushHistory('Paste Frames');
    this.showToast(`Pasted ${newFrames.length} frame${newFrames.length > 1 ? 's' : ''}`);
  }

  duplicateSelectedFrames() {
    this.copySelectedFrames();
    this.pasteClipboardFrames();
  }

  addStockChart(symbol, worldX = null, worldY = null, initialOptions = {}) {
    const match = STOCK_DATABASE.find(s => s.symbol.toUpperCase() === symbol.toUpperCase()) || {
      symbol: symbol.toUpperCase(),
      name: `${symbol.toUpperCase()} Asset`,
      basePrice: Math.floor(Math.random() * 200 + 50),
      change: (Math.random() * 6 - 2.5)
    };

    if (worldX === null || worldY === null) {
      const centerScreen = this.screenToWorld(this.width / 2, this.height / 2);
      const cascadeOffset = (this.stockCharts.length % 5) * 35;
      worldX = Math.round(centerScreen.x - 240 + cascadeOffset);
      worldY = Math.round(centerScreen.y - 170 + cascadeOffset);
    }

    const frame = new StockChartFrame(this, {
      symbol: match.symbol,
      name: match.name,
      price: initialOptions.price !== undefined ? initialOptions.price : match.basePrice,
      change: initialOptions.change !== undefined ? initialOptions.change : match.change,
      chartType: initialOptions.chartType || 'candles',
      timeframe: initialOptions.timeframe || '1D',
      x: worldX,
      y: worldY,
      width: initialOptions.width || 480,
      height: initialOptions.height || 340
    });

    this.stockCharts.push(frame);
    this.selectFrame(frame);
    this.updateTargetDropdowns();
    this.updateLayersTree();
    this.updateMinimap();
    this.pushHistory('Add Stock Chart');
    return frame;
  }

  addPineScriptNode(worldX = null, worldY = null, initialOptions = {}) {
    if (worldX === null || worldY === null) {
      const centerScreen = this.screenToWorld(this.width / 2, this.height / 2);
      worldX = Math.round(centerScreen.x - 260);
      worldY = Math.round(centerScreen.y - 210);
    }

    const node = new PineScriptFrame(this, {
      x: worldX,
      y: worldY,
      width: initialOptions.width || 520,
      height: initialOptions.height || 420,
      title: initialOptions.title || 'SMA Golden Cross',
      code: initialOptions.code
    });

    this.pineNodes.push(node);
    this.selectFrame(node);
    this.updateTargetDropdowns();
    this.updateLayersTree();
    this.updateMinimap();
    this.pushHistory('Add Pine Script');
    return node;
  }

  addSectionFrame(worldX = null, worldY = null, initialOptions = {}) {
    if (worldX === null || worldY === null) {
      const centerScreen = this.screenToWorld(this.width / 2, this.height / 2);
      worldX = Math.round(centerScreen.x - 340);
      worldY = Math.round(centerScreen.y - 270);
    }

    const section = new CanvasSectionFrame(this, {
      x: worldX,
      y: worldY,
      width: initialOptions.width || 680,
      height: initialOptions.height || 540,
      title: initialOptions.title || `Section ${this.sections.length + 1}`,
      color: initialOptions.color || 'purple'
    });

    this.sections.push(section);
    this.selectFrame(section);
    this.updateLayersTree();
    this.updateMinimap();
    this.pushHistory('Add Section');
    return section;
  }

  addStickyNote(worldX = null, worldY = null, initialOptions = {}) {
    if (worldX === null || worldY === null) {
      const centerScreen = this.screenToWorld(this.width / 2, this.height / 2);
      worldX = Math.round(centerScreen.x - 110);
      worldY = Math.round(centerScreen.y - 90);
    }

    const note = new StickyNoteFrame(this, {
      x: worldX,
      y: worldY,
      width: initialOptions.width || 220,
      height: initialOptions.height || 180,
      content: initialOptions.content,
      color: initialOptions.color || 'yellow'
    });

    this.notes.push(note);
    this.selectFrame(note);
    this.updateLayersTree();
    this.updateMinimap();
    this.pushHistory('Add Sticky Note');
    return note;
  }

  // ==========================================
  // Figma Sidebars (Layers, Assets & Inspector)
  // ==========================================
  setupFigmaSidebars() {
    if (this.btnCloseLeftSidebar) {
      this.btnCloseLeftSidebar.addEventListener('click', () => this.toggleLeftSidebar(false));
    }
    if (this.btnCloseRightSidebar) {
      this.btnCloseRightSidebar.addEventListener('click', () => this.toggleRightSidebar(false));
    }

    if (this.tabBtnLayers && this.tabBtnAssets) {
      this.tabBtnLayers.addEventListener('click', () => {
        this.tabBtnLayers.classList.add('active');
        this.tabBtnAssets.classList.remove('active');
        this.paneLayers.classList.remove('hidden');
        this.paneAssets.classList.add('hidden');
      });

      this.tabBtnAssets.addEventListener('click', () => {
        this.tabBtnAssets.classList.add('active');
        this.tabBtnLayers.classList.remove('active');
        this.paneAssets.classList.remove('hidden');
        this.paneLayers.classList.add('hidden');
      });
    }

    if (this.layersFilterInput) {
      this.layersFilterInput.addEventListener('input', () => this.updateLayersTree());
    }
  }

  toggleLeftSidebar(force = null) {
    if (!this.leftSidebar) return;
    const isCollapsed = force !== null ? !force : !this.leftSidebar.classList.contains('collapsed');
    this.leftSidebar.classList.toggle('collapsed', isCollapsed);
    if (this.btnToggleLayers) {
      this.btnToggleLayers.classList.toggle('active', !isCollapsed);
    }
  }

  toggleRightSidebar(force = null) {
    if (!this.rightSidebar) return;
    const isCollapsed = force !== null ? !force : !this.rightSidebar.classList.contains('collapsed');
    this.rightSidebar.classList.toggle('collapsed', isCollapsed);
    if (this.btnToggleInspector) {
      this.btnToggleInspector.classList.toggle('active', !isCollapsed);
    }
  }

  setupLayersPanel() {
    this.updateLayersTree();
  }

  updateLayersTree() {
    if (!this.layersTreeList) return;
    const query = this.layersFilterInput ? this.layersFilterInput.value.trim().toLowerCase() : '';
    this.layersTreeList.innerHTML = '';

    const all = [
      ...this.sections.map(s => ({ frame: s, type: 'section', name: s.title, icon: '▢' })),
      ...this.pineNodes.map(p => ({ frame: p, type: 'pine', name: p.scriptTitle, icon: '</>' })),
      ...this.stockCharts.map(c => ({ frame: c, type: 'stock', name: `${c.symbol} (${c.name})`, icon: '📈' })),
      ...this.notes.map(n => ({ frame: n, type: 'note', name: n.content.split('\n')[0] || 'Note', icon: '📝' }))
    ];

    all.forEach(({ frame, type, name, icon }) => {
      if (query && !name.toLowerCase().includes(query)) return;

      const item = document.createElement('div');
      item.className = 'layer-item' + (frame.isSelected ? ' selected' : '');
      item.innerHTML = `
        <div class="layer-item-left" title="${name}">
          <span class="layer-icon">${icon}</span>
          <span class="layer-name">${name}</span>
        </div>
        <div class="layer-actions">
          <button class="layer-action-btn btn-layer-vis" title="${frame.isVisible ? 'Hide' : 'Show'}">
            ${frame.isVisible ? '👁' : '🚫'}
          </button>
          <button class="layer-action-btn btn-layer-lock" title="${frame.isLocked ? 'Unlock' : 'Lock'}">
            ${frame.isLocked ? '🔒' : '🔓'}
          </button>
        </div>
      `;

      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectFrame(frame, e.shiftKey);
      });

      // Double-click to fly camera directly to the object!
      item.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.pan = {
          x: this.width / 2 - (frame.x + frame.width / 2) * this.zoom,
          y: this.height / 2 - (frame.y + frame.height / 2) * this.zoom
        };
        this.updateTransform();
        this.requestRender();
      });

      const btnVis = item.querySelector('.btn-layer-vis');
      btnVis.addEventListener('click', (e) => {
        e.stopPropagation();
        frame.isVisible = !frame.isVisible;
        frame.element.style.display = frame.isVisible ? '' : 'none';
        this.updateLayersTree();
      });

      const btnLock = item.querySelector('.btn-layer-lock');
      btnLock.addEventListener('click', (e) => {
        e.stopPropagation();
        frame.isLocked = !frame.isLocked;
        this.updateLayersTree();
      });

      this.layersTreeList.appendChild(item);
    });
  }

  setupQuickAssets() {
    if (this.quickStocksGrid) {
      this.quickStocksGrid.innerHTML = '';
      STOCK_DATABASE.slice(0, 8).forEach(stock => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.innerHTML = `
          <span class="asset-symbol">${stock.symbol}</span>
          <span class="asset-sub">${stock.name}</span>
        `;
        card.addEventListener('click', () => {
          this.addStockChart(stock.symbol);
        });
        this.quickStocksGrid.appendChild(card);
      });
    }

    if (this.quickScriptsGrid) {
      this.quickScriptsGrid.innerHTML = '';
      Object.entries(PINE_PRESETS).forEach(([key, preset]) => {
        const card = document.createElement('div');
        card.className = 'asset-card';
        card.innerHTML = `
          <span class="asset-symbol">${preset.name}</span>
          <span class="asset-sub">Pine v5 ${preset.type}</span>
        `;
        card.addEventListener('click', () => {
          const pine = this.addPineScriptNode(null, null, {
            title: preset.name,
            code: preset.code
          });
          if (pine.presetSelect) pine.presetSelect.value = key;
          pine.compileAndRun();
        });
        this.quickScriptsGrid.appendChild(card);
      });
    }
  }

  // ==========================================
  // Figma Right Sidebar (Design Inspector)
  // ==========================================
  setupFigmaInspector() {
    const alignHandlers = [
      { btn: this.btnAlignLeft, dir: 'left' },
      { btn: this.btnAlignCenterH, dir: 'center-h' },
      { btn: this.btnAlignRight, dir: 'right' },
      { btn: this.btnAlignTop, dir: 'top' },
      { btn: this.btnAlignCenterV, dir: 'center-v' },
      { btn: this.btnAlignBottom, dir: 'bottom' }
    ];

    alignHandlers.forEach(({ btn, dir }) => {
      if (btn) {
        btn.addEventListener('click', () => this.alignSelected(dir));
      }
    });

    const bindPropInput = (input, prop) => {
      if (!input) return;
      input.addEventListener('change', () => {
        const val = parseFloat(input.value);
        if (isNaN(val)) return;
        this.selectedFrames.forEach(f => {
          f[prop] = val;
          if (prop === 'x') f.element.style.left = `${val}px`;
          if (prop === 'y') f.element.style.top = `${val}px`;
          if (prop === 'width') {
            f.element.style.width = `${val}px`;
            if (f.renderChart) f.renderChart();
          }
          if (prop === 'height') {
            f.element.style.height = `${val}px`;
            if (f.renderChart) f.renderChart();
          }
        });
        this.updateWires();
        this.updateMinimap();
        this.pushHistory(`Change ${prop.toUpperCase()}`);
      });
    };

    bindPropInput(this.propInputX, 'x');
    bindPropInput(this.propInputY, 'y');
    bindPropInput(this.propInputW, 'width');
    bindPropInput(this.propInputH, 'height');

    this.updateInspector();
  }

  updateTransformInputs() {
    if (!this.propInputX) return;
    if (this.selectedFrames.size === 1) {
      const f = this.selectedFrame;
      this.propInputX.value = Math.round(f.x);
      this.propInputY.value = Math.round(f.y);
      this.propInputW.value = Math.round(f.width);
      this.propInputH.value = Math.round(f.height);
      this.propInputX.disabled = false;
      this.propInputY.disabled = false;
      this.propInputW.disabled = false;
      this.propInputH.disabled = false;
    } else if (this.selectedFrames.size > 1) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      this.selectedFrames.forEach(f => {
        minX = Math.min(minX, f.x);
        minY = Math.min(minY, f.y);
        maxX = Math.max(maxX, f.x + f.width);
        maxY = Math.max(maxY, f.y + f.height);
      });
      this.propInputX.value = Math.round(minX);
      this.propInputY.value = Math.round(minY);
      this.propInputW.value = Math.round(maxX - minX);
      this.propInputH.value = Math.round(maxY - minY);
    } else {
      this.propInputX.value = '';
      this.propInputY.value = '';
      this.propInputW.value = '';
      this.propInputH.value = '';
      this.propInputX.disabled = true;
      this.propInputY.disabled = true;
      this.propInputW.disabled = true;
      this.propInputH.disabled = true;
    }
  }

  updateInspector() {
    this.updateTransformInputs();
    if (!this.inspectorDynamicProps) return;

    if (this.selectedFrames.size === 0) {
      this.inspectorDynamicProps.innerHTML = `
        <div class="dynamic-inspector-card">
          <div class="dynamic-title-row">Canvas Overview</div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Stock Charts</span>
            <span class="dynamic-prop-val">${this.stockCharts.length}</span>
          </div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Pine Scripts</span>
            <span class="dynamic-prop-val">${this.pineNodes.length}</span>
          </div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Sections</span>
            <span class="dynamic-prop-val">${this.sections.length}</span>
          </div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Journal Notes</span>
            <span class="dynamic-prop-val">${this.notes.length}</span>
          </div>
        </div>
      `;
      return;
    }

    if (this.selectedFrames.size > 1) {
      this.inspectorDynamicProps.innerHTML = `
        <div class="dynamic-inspector-card">
          <div class="dynamic-title-row">Multiple Selection</div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Selected Objects</span>
            <span class="dynamic-prop-val">${this.selectedFrames.size} items</span>
          </div>
          <button class="primary-btn" id="btn-group-into-section" style="width:100%; justify-content:center; margin-top:6px;">
            Wrap into Section Frame
          </button>
        </div>
      `;
      const btnGroup = document.getElementById('btn-group-into-section');
      if (btnGroup) {
        btnGroup.addEventListener('click', () => {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          this.selectedFrames.forEach(f => {
            minX = Math.min(minX, f.x);
            minY = Math.min(minY, f.y);
            maxX = Math.max(maxX, f.x + f.width);
            maxY = Math.max(maxY, f.y + f.height);
          });
          const padding = 60;
          this.addSectionFrame(minX - padding, minY - padding, {
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2,
            title: `Group (${this.selectedFrames.size} items)`
          });
        });
      }
      return;
    }

    const frame = this.selectedFrame;
    if (frame instanceof StockChartFrame) {
      this.inspectorDynamicProps.innerHTML = `
        <div class="dynamic-inspector-card">
          <div class="dynamic-title-row">
            <span>Stock Chart</span>
            <span class="ticker-badge">${frame.symbol}</span>
          </div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Asset Name</span>
            <span style="font-size:11px; max-width:140px; text-overflow:ellipsis; overflow:hidden;">${frame.name}</span>
          </div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Live Price</span>
            <span style="font-weight:600; font-size:13px;">$${frame.price.toFixed(2)}</span>
          </div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Chart Type</span>
            <div class="dynamic-prop-control">
              <button class="tf-btn ${frame.chartType === 'candles' ? 'active' : ''}" id="btn-insp-candles">Candles</button>
              <button class="tf-btn ${frame.chartType === 'line' ? 'active' : ''}" id="btn-insp-line">Line</button>
            </div>
          </div>
        </div>
      `;
      const btnCandles = document.getElementById('btn-insp-candles');
      const btnLine = document.getElementById('btn-insp-line');
      if (btnCandles && btnLine) {
        btnCandles.addEventListener('click', () => {
          frame.chartType = 'candles';
          frame.renderChart();
          this.updateInspector();
        });
        btnLine.addEventListener('click', () => {
          frame.chartType = 'line';
          frame.renderChart();
          this.updateInspector();
        });
      }
    } else if (frame instanceof CanvasSectionFrame) {
      this.inspectorDynamicProps.innerHTML = `
        <div class="dynamic-inspector-card">
          <div class="dynamic-title-row">Section Frame</div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Theme Color</span>
            <div class="color-swatches-row">
              <div class="color-swatch-dot ${frame.color === 'purple' ? 'active' : ''}" data-col="purple" style="background:#a855f7"></div>
              <div class="color-swatch-dot ${frame.color === 'blue' ? 'active' : ''}" data-col="blue" style="background:#0d99ff"></div>
              <div class="color-swatch-dot ${frame.color === 'green' ? 'active' : ''}" data-col="green" style="background:#10b981"></div>
              <div class="color-swatch-dot ${frame.color === 'amber' ? 'active' : ''}" data-col="amber" style="background:#f59e0b"></div>
              <div class="color-swatch-dot ${frame.color === 'rose' ? 'active' : ''}" data-col="rose" style="background:#f43f5e"></div>
            </div>
          </div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Contained Nodes</span>
            <span>${frame.getContainedFrames().length} inside</span>
          </div>
        </div>
      `;
      this.inspectorDynamicProps.querySelectorAll('.color-swatch-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          frame.setColor(dot.dataset.col);
        });
      });
    } else if (frame instanceof StickyNoteFrame) {
      this.inspectorDynamicProps.innerHTML = `
        <div class="dynamic-inspector-card">
          <div class="dynamic-title-row">Sticky Note</div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Paper Color</span>
            <div class="color-swatches-row">
              <div class="color-swatch-dot ${frame.color === 'yellow' ? 'active' : ''}" data-col="yellow" style="background:#fef08a"></div>
              <div class="color-swatch-dot ${frame.color === 'green' ? 'active' : ''}" data-col="green" style="background:#bbf7d0"></div>
              <div class="color-swatch-dot ${frame.color === 'blue' ? 'active' : ''}" data-col="blue" style="background:#bae6fd"></div>
              <div class="color-swatch-dot ${frame.color === 'purple' ? 'active' : ''}" data-col="purple" style="background:#e9d5ff"></div>
              <div class="color-swatch-dot ${frame.color === 'pink' ? 'active' : ''}" data-col="pink" style="background:#fbcfe8"></div>
            </div>
          </div>
        </div>
      `;
      this.inspectorDynamicProps.querySelectorAll('.color-swatch-dot').forEach(dot => {
        dot.addEventListener('click', () => {
          frame.setColor(dot.dataset.col);
        });
      });
    } else if (frame instanceof PineScriptFrame) {
      this.inspectorDynamicProps.innerHTML = `
        <div class="dynamic-inspector-card">
          <div class="dynamic-title-row">
            <span>Pine Script</span>
            <span class="pine-badge">v5</span>
          </div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Title</span>
            <span style="font-weight:600; font-size:12px;">${frame.scriptTitle}</span>
          </div>
          <div class="dynamic-prop-row">
            <span class="dynamic-prop-label">Connected Feeds</span>
            <span>${frame.connections.size} stock charts</span>
          </div>
          <button class="btn-compile" id="btn-insp-compile" style="width:100%; justify-content:center; margin-top:6px;">
            Compile & Execute Script
          </button>
        </div>
      `;
      const btnComp = document.getElementById('btn-insp-compile');
      if (btnComp) {
        btnComp.addEventListener('click', () => frame.compileAndRun());
      }
    }
  }

  alignSelected(direction) {
    if (this.selectedFrames.size === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (this.selectedFrames.size > 1) {
      this.selectedFrames.forEach(f => {
        minX = Math.min(minX, f.x);
        minY = Math.min(minY, f.y);
        maxX = Math.max(maxX, f.x + f.width);
        maxY = Math.max(maxY, f.y + f.height);
      });
    } else {
      // Single frame aligns relative to canvas origin (0, 0)
      const centerScreen = this.screenToWorld(this.width / 2, this.height / 2);
      minX = centerScreen.x - 300;
      minY = centerScreen.y - 200;
      maxX = centerScreen.x + 300;
      maxY = centerScreen.y + 200;
    }

    this.selectedFrames.forEach(f => {
      if (direction === 'left') f.x = minX;
      else if (direction === 'center-h') f.x = minX + (maxX - minX - f.width) / 2;
      else if (direction === 'right') f.x = maxX - f.width;
      else if (direction === 'top') f.y = minY;
      else if (direction === 'center-v') f.y = minY + (maxY - minY - f.height) / 2;
      else if (direction === 'bottom') f.y = maxY - f.height;

      f.element.style.left = `${f.x}px`;
      f.element.style.top = `${f.y}px`;
    });

    this.updateWires();
    this.updateMinimap();
    this.updateTransformInputs();
    this.pushHistory(`Align ${direction}`);
  }

  // ==========================================
  // Minimap Radar Navigator
  // ==========================================
  setupMinimap() {
    if (this.btnCloseMinimap) {
      this.btnCloseMinimap.addEventListener('click', () => this.toggleMinimap(false));
    }

    if (this.minimapCanvas) {
      const handleMinimapNav = (e) => {
        const rect = this.minimapCanvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        if (this._minimapBounds) {
          const { minX, minY, spanW, spanH } = this._minimapBounds;
          const targetWorldX = minX + (clickX / rect.width) * spanW;
          const targetWorldY = minY + (clickY / rect.height) * spanH;
          this.pan.x = this.width / 2 - targetWorldX * this.zoom;
          this.pan.y = this.height / 2 - targetWorldY * this.zoom;
          this.updateTransform();
          this.requestRender();
          this.updateMinimap();
        }
      };

      this.minimapCanvas.addEventListener('mousedown', (e) => {
        handleMinimapNav(e);
        const onMouseMove = (moveEvent) => handleMinimapNav(moveEvent);
        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });
    }
  }

  toggleMinimap(force = null) {
    if (!this.minimapContainer) return;
    const isHidden = force !== null ? !force : !this.minimapContainer.classList.contains('hidden');
    this.minimapContainer.classList.toggle('hidden', isHidden);
    if (this.btnToggleMinimap) {
      this.btnToggleMinimap.classList.toggle('active', !isHidden);
    }
    if (!isHidden) this.updateMinimap();
  }

  updateMinimap() {
    if (!this.minimapCanvas || !this.minimapCtx || this.minimapContainer.classList.contains('hidden')) return;

    const ctx = this.minimapCtx;
    const cw = this.minimapCanvas.width;
    const ch = this.minimapCanvas.height;

    ctx.clearRect(0, 0, cw, ch);

    // Compute bounding box across all objects + current camera view
    const all = [...this.stockCharts, ...this.pineNodes, ...this.sections, ...this.notes];
    let minX = -1200, minY = -900, maxX = 1200, maxY = 900;

    all.forEach(f => {
      minX = Math.min(minX, f.x - 200);
      minY = Math.min(minY, f.y - 200);
      maxX = Math.max(maxX, f.x + f.width + 200);
      maxY = Math.max(maxY, f.y + f.height + 200);
    });

    const viewTopLeft = this.screenToWorld(0, 0);
    const viewBottomRight = this.screenToWorld(this.width, this.height);
    minX = Math.min(minX, viewTopLeft.x);
    minY = Math.min(minY, viewTopLeft.y);
    maxX = Math.max(maxX, viewBottomRight.x);
    maxY = Math.max(maxY, viewBottomRight.y);

    const spanW = Math.max(100, maxX - minX);
    const spanH = Math.max(100, maxY - minY);
    this._minimapBounds = { minX, minY, spanW, spanH };

    const toMiniX = (wx) => ((wx - minX) / spanW) * cw;
    const toMiniY = (wy) => ((wy - minY) / spanH) * ch;

    // Draw Sections
    this.sections.forEach(s => {
      const mx = toMiniX(s.x);
      const my = toMiniY(s.y);
      const mw = (s.width / spanW) * cw;
      const mh = (s.height / spanH) * ch;
      ctx.fillStyle = 'rgba(168, 85, 247, 0.12)';
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1;
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeRect(mx, my, mw, mh);
    });

    // Draw Stock Charts
    this.stockCharts.forEach(c => {
      const mx = toMiniX(c.x);
      const my = toMiniY(c.y);
      const mw = (c.width / spanW) * cw;
      const mh = (c.height / spanH) * ch;
      ctx.fillStyle = c.isSelected ? '#0d99ff' : 'rgba(13, 153, 255, 0.55)';
      ctx.fillRect(mx, my, mw, mh);
    });

    // Draw Pine Scripts
    this.pineNodes.forEach(p => {
      const mx = toMiniX(p.x);
      const my = toMiniY(p.y);
      const mw = (p.width / spanW) * cw;
      const mh = (p.height / spanH) * ch;
      ctx.fillStyle = p.isSelected ? '#c084fc' : 'rgba(168, 85, 247, 0.65)';
      ctx.fillRect(mx, my, mw, mh);
    });

    // Draw Sticky Notes
    this.notes.forEach(n => {
      const mx = toMiniX(n.x);
      const my = toMiniY(n.y);
      const mw = (n.width / spanW) * cw;
      const mh = (n.height / spanH) * ch;
      ctx.fillStyle = 'rgba(254, 240, 138, 0.8)';
      ctx.fillRect(mx, my, mw, mh);
    });

    // Draw Camera Viewport Rectangle
    const vx = toMiniX(viewTopLeft.x);
    const vy = toMiniY(viewTopLeft.y);
    const vw = toMiniX(viewBottomRight.x) - vx;
    const vh = toMiniY(viewBottomRight.y) - vy;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(vx, vy, vw, vh);
  }

  // ==========================================
  // Undo & Redo History Manager
  // ==========================================
  setupHistoryManager() {
    this.updateHistoryButtons();
  }

  pushHistory(actionName = 'Action') {
    if (this.isHistoryApplying) return;

    const snapshot = {
      actionName,
      pan: { ...this.pan },
      zoom: this.zoom,
      stockCharts: this.stockCharts.map(c => ({
        symbol: c.symbol,
        name: c.name,
        price: c.price,
        change: c.change,
        timeframe: c.timeframe,
        chartType: c.chartType,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height
      })),
      pineNodes: this.pineNodes.map(p => ({
        title: p.scriptTitle,
        code: p.codeTextarea ? p.codeTextarea.value : p.code,
        preset: p.presetSelect ? p.presetSelect.value : 'sma_cross',
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height
      })),
      sections: this.sections.map(s => ({
        title: s.title,
        color: s.color,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height
      })),
      notes: this.notes.map(n => ({
        content: n.content,
        color: n.color,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height
      }))
    };

    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(snapshot);
    if (this.history.length > 40) {
      this.history.shift();
    }
    this.historyIndex = this.history.length - 1;
    this.updateHistoryButtons();
  }

  updateHistoryButtons() {
    if (this.btnUndo) {
      this.btnUndo.style.opacity = this.historyIndex > 0 ? '1' : '0.4';
      this.btnUndo.style.pointerEvents = this.historyIndex > 0 ? 'auto' : 'none';
    }
    if (this.btnRedo) {
      this.btnRedo.style.opacity = this.historyIndex < this.history.length - 1 ? '1' : '0.4';
      this.btnRedo.style.pointerEvents = this.historyIndex < this.history.length - 1 ? 'auto' : 'none';
    }
  }

  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.applyHistorySnapshot(this.history[this.historyIndex]);
    this.showToast(`Undo: ${this.history[this.historyIndex].actionName}`);
    this.updateHistoryButtons();
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.applyHistorySnapshot(this.history[this.historyIndex]);
    this.showToast(`Redo: ${this.history[this.historyIndex].actionName}`);
    this.updateHistoryButtons();
  }

  applyHistorySnapshot(snapshot) {
    if (!snapshot) return;
    this.isHistoryApplying = true;

    // Remove existing DOM elements
    [...this.stockCharts, ...this.pineNodes, ...this.sections, ...this.notes].forEach(f => {
      if (f.element && f.element.parentElement) f.element.parentElement.removeChild(f.element);
    });

    this.stockCharts = [];
    this.pineNodes = [];
    this.sections = [];
    this.notes = [];
    this.selectedFrames.clear();
    this.selectedFrame = null;

    // Recreate Sections
    snapshot.sections.forEach(s => {
      const sec = new CanvasSectionFrame(this, s);
      this.sections.push(sec);
    });

    // Recreate Stock Charts
    snapshot.stockCharts.forEach(c => {
      const chart = new StockChartFrame(this, c);
      this.stockCharts.push(chart);
    });

    // Recreate Pine Nodes
    snapshot.pineNodes.forEach(p => {
      const pine = new PineScriptFrame(this, p);
      if (pine.presetSelect && p.preset) pine.presetSelect.value = p.preset;
      pine.compileAndRun();
      this.pineNodes.push(pine);
    });

    // Recreate Notes
    snapshot.notes.forEach(n => {
      const note = new StickyNoteFrame(this, n);
      this.notes.push(note);
    });

    this.updateTargetDropdowns();
    this.updateWires();
    this.updateLayersTree();
    this.updateInspector();
    this.updateMinimap();

    this.isHistoryApplying = false;
  }

  // ==========================================
  // Board Export to PNG
  // ==========================================
  setupExportBoard() {}

  exportCanvasToPNG() {
    this.showToast('Generating high-resolution canvas snapshot...');

    const offscreen = document.createElement('canvas');
    offscreen.width = 1920;
    offscreen.height = 1080;
    const octx = offscreen.getContext('2d');

    // Paint dark grid background
    octx.fillStyle = '#1e1e1e';
    octx.fillRect(0, 0, 1920, 1080);

    octx.fillStyle = '#383838';
    for (let x = 0; x < 1920; x += 24) {
      for (let y = 0; y < 1080; y += 24) {
        octx.fillRect(x, y, 1.5, 1.5);
      }
    }

    // Title & branding badge
    octx.fillStyle = '#0d99ff';
    octx.font = 'bold 22px Inter, sans-serif';
    octx.fillText('Trading Canvas Pro', 40, 50);

    octx.fillStyle = '#8e8e8e';
    octx.font = '13px Inter, sans-serif';
    octx.fillText(`Exported on ${new Date().toLocaleString()} • ${this.stockCharts.length} Charts • ${this.pineNodes.length} Scripts`, 40, 75);

    // Draw Section boxes
    this.sections.forEach(s => {
      const sx = 960 + s.x * 0.55;
      const sy = 540 + s.y * 0.55;
      const sw = s.width * 0.55;
      const sh = s.height * 0.55;
      octx.strokeStyle = '#a855f7';
      octx.lineWidth = 2;
      octx.setLineDash([6, 6]);
      octx.strokeRect(sx, sy, sw, sh);
      octx.setLineDash([]);
      octx.fillStyle = 'rgba(168, 85, 247, 0.15)';
      octx.fillRect(sx, sy - 22, 120, 22);
      octx.fillStyle = '#ffffff';
      octx.font = 'bold 11px Inter, sans-serif';
      octx.fillText(s.title, sx + 8, sy - 7);
    });

    // Draw Stock frames
    this.stockCharts.forEach(c => {
      const cx = 960 + c.x * 0.55;
      const cy = 540 + c.y * 0.55;
      const cw = c.width * 0.55;
      const ch = c.height * 0.55;

      octx.fillStyle = 'rgba(30, 30, 30, 0.9)';
      octx.strokeStyle = '#0d99ff';
      octx.lineWidth = 1.5;
      octx.fillRect(cx, cy, cw, ch);
      octx.strokeRect(cx, cy, cw, ch);

      octx.fillStyle = '#ffffff';
      octx.font = 'bold 12px Inter, sans-serif';
      octx.fillText(`${c.symbol} - $${c.price.toFixed(2)}`, cx + 10, cy + 22);
    });

    // Draw Pine nodes
    this.pineNodes.forEach(p => {
      const px = 960 + p.x * 0.55;
      const py = 540 + p.y * 0.55;
      const pw = p.width * 0.55;
      const ph = p.height * 0.55;

      octx.fillStyle = 'rgba(21, 22, 30, 0.95)';
      octx.strokeStyle = '#a855f7';
      octx.lineWidth = 2;
      octx.fillRect(px, py, pw, ph);
      octx.strokeRect(px, py, pw, ph);

      octx.fillStyle = '#c084fc';
      octx.font = 'bold 12px Inter, sans-serif';
      octx.fillText(`Pine Script: ${p.scriptTitle}`, px + 10, py + 22);
    });

    // Trigger instant download
    const link = document.createElement('a');
    link.download = `trading-canvas-${Date.now()}.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();

    this.showToast('Canvas exported successfully as PNG!');
  }


  autoArrangeCharts() {
    if (this.stockCharts.length === 0) return;

    // Center the Pine Script node at (0, 0)
    let pine = this.pineNodes[0];
    if (!pine) {
      pine = this.addPineScriptNode(-260, -210);
    } else {
      pine.x = -260;
      pine.y = -210;
      pine.element.style.left = `${pine.x}px`;
      pine.element.style.top = `${pine.y}px`;
    }

    // 4 cardinal side positions neatly surrounding the center node
    const sidePositions = [
      { x: -240, y: -620, side: 'top' },    // Top
      { x: 380, y: -170, side: 'right' },   // Right
      { x: -240, y: 290, side: 'bottom' },  // Bottom
      { x: -860, y: -170, side: 'left' }    // Left
    ];

    this.stockCharts.forEach((chart, idx) => {
      if (idx < 4) {
        chart.x = sidePositions[idx].x;
        chart.y = sidePositions[idx].y;
      } else {
        // Additional overflow charts arranged neatly in outer columns
        const extraIdx = idx - 4;
        const col = extraIdx % 2;
        const row = Math.floor(extraIdx / 2);
        chart.x = col === 0 ? -1420 : 940;
        chart.y = -350 + row * 400;
      }
      chart.element.style.left = `${chart.x}px`;
      chart.element.style.top = `${chart.y}px`;
      chart.renderChart();
    });

    // Re-connect the first 4 charts to ports 0..3 (Top, Right, Bottom, Left)
    this.stockCharts.forEach((chart, idx) => {
      if (idx < 4 && !pine.connections.has(chart.id)) {
        pine.connectToChart(chart, idx);
      }
    });

    this.centerView();
    this.updateWires();
  }

  // ==========================================
  // Connector Wire Mechanics (Screen-Space SVG)
  // ==========================================
  startWireDrag(frame, type, e, portIndex = 0) {
    e.stopPropagation();
    e.preventDefault();

    this.activeWireDrag = {
      sourceFrame: frame,
      type: type,
      portIndex: portIndex,
      startWorld: type === 'output' ? frame.getOutputPortWorldPos(portIndex) : frame.getInputPortWorldPos(),
      startScreen: { x: e.clientX, y: e.clientY }
    };

    document.body.classList.add('wire-dragging');
    if (frame.outputPorts && frame.outputPorts[portIndex]) {
      frame.outputPorts[portIndex].classList.add('active-drag');
    }
    if (frame.inputPort) frame.inputPort.classList.add('active-drag');

    // Create or reuse temporary dragging SVG wire path
    let path = document.getElementById('temp-drag-wire');
    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'connector-wire draft');
      path.setAttribute('id', 'temp-drag-wire');
      this.wiresSvg.appendChild(path);
    }
    this.activeWireDrag.tempPath = path;

    this.updateWireDrag(e.clientX, e.clientY);
  }

  findStockChartUnderScreenPoint(screenX, screenY) {
    for (const chart of this.stockCharts) {
      const rect = chart.element.getBoundingClientRect();
      if (screenX >= rect.left - 25 && screenX <= rect.right + 25 &&
        screenY >= rect.top - 25 && screenY <= rect.bottom + 25) {
        return chart;
      }
    }
    return null;
  }

  findPineNodeUnderScreenPoint(screenX, screenY) {
    for (const pine of this.pineNodes) {
      const rect = pine.element.getBoundingClientRect();
      if (screenX >= rect.left - 25 && screenX <= rect.right + 25 &&
        screenY >= rect.top - 25 && screenY <= rect.bottom + 25) {
        return pine;
      }
    }
    return null;
  }

  updateWireDrag(screenX, screenY) {
    if (!this.activeWireDrag || !this.activeWireDrag.tempPath) return;

    // Reset previous target highlight
    this.stockCharts.forEach(c => c.element.classList.remove('wire-target-hover'));

    const s1 = this.worldToScreen(this.activeWireDrag.startWorld.x, this.activeWireDrag.startWorld.y);
    let s2 = { x: screenX, y: screenY };
    let targetSide = 'left';

    // Check if hovering over any stock chart
    const target = this.findStockChartUnderScreenPoint(screenX, screenY);
    if (target && target !== this.activeWireDrag.sourceFrame) {
      target.element.classList.add('wire-target-hover');
      const targetWorld = target.getInputPortWorldPos(this.activeWireDrag.startWorld);
      s2 = this.worldToScreen(targetWorld.x, targetWorld.y);
      targetSide = targetWorld.side;
    }

    const dist = Math.hypot(s2.x - s1.x, s2.y - s1.y);
    const bend = Math.min(180, Math.max(50, dist * 0.45));

    let cp1 = { x: s1.x, y: s1.y };
    const srcSide = this.activeWireDrag.startWorld.side || 'right';
    if (srcSide === 'top') cp1.y -= bend;
    else if (srcSide === 'bottom') cp1.y += bend;
    else if (srcSide === 'left') cp1.x -= bend;
    else cp1.x += bend;

    let cp2 = { x: s2.x, y: s2.y };
    if (targetSide === 'top') cp2.y -= bend;
    else if (targetSide === 'bottom') cp2.y += bend;
    else if (targetSide === 'left') cp2.x -= bend;
    else cp2.x += bend;

    const d = `M ${s1.x} ${s1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${s2.x} ${s2.y}`;
    this.activeWireDrag.tempPath.setAttribute('d', d);
  }

  endWireDrag(e) {
    if (!this.activeWireDrag) return;

    document.body.classList.remove('wire-dragging');
    this.stockCharts.forEach(c => c.element.classList.remove('wire-target-hover'));
    if (this.activeWireDrag.sourceFrame.outputPorts) {
      this.activeWireDrag.sourceFrame.outputPorts.forEach(p => p.classList.remove('active-drag'));
    }
    if (this.activeWireDrag.sourceFrame.inputPorts) {
      this.activeWireDrag.sourceFrame.inputPorts.forEach(p => p.classList.remove('active-drag'));
    }

    const tempPath = document.getElementById('temp-drag-wire');
    if (tempPath && tempPath.parentElement) {
      tempPath.parentElement.removeChild(tempPath);
    }

    const target = this.findStockChartUnderScreenPoint(e.clientX, e.clientY);
    const distMoved = Math.hypot(
      e.clientX - this.activeWireDrag.startScreen.x,
      e.clientY - this.activeWireDrag.startScreen.y
    );

    if (this.activeWireDrag.type === 'output' && this.activeWireDrag.sourceFrame instanceof PineScriptFrame) {
      if (target && target instanceof StockChartFrame) {
        this.activeWireDrag.sourceFrame.connectToChart(target, this.activeWireDrag.portIndex);
      } else if (distMoved < 6) {
        // User clicked the port without dragging: enter Click-to-Connect mode
        this.startClickConnectMode(this.activeWireDrag.sourceFrame, this.activeWireDrag.portIndex);
      }
    } else if (this.activeWireDrag.type === 'input' && this.activeWireDrag.sourceFrame instanceof StockChartFrame) {
      const pineTarget = this.findPineNodeUnderScreenPoint(e.clientX, e.clientY);
      if (pineTarget) {
        pineTarget.connectToChart(this.activeWireDrag.sourceFrame);
      }
    }

    this.activeWireDrag = null;
    this.updateWires();
  }

  startClickConnectMode(pineFrame, portIndex = 0) {
    if (pineFrame.outputPorts[portIndex]) {
      pineFrame.outputPorts[portIndex].classList.add('active-drag');
    }
    const sideNames = ['Top Node 1', 'Right Node 2', 'Bottom Node 3', 'Left Node 4'];
    const sideLabel = sideNames[portIndex] || `Node ${portIndex + 1}`;
    pineFrame.statusText.textContent = `⚡ ${sideLabel}: Click any Stock Chart to connect...`;

    const onDocClick = (e) => {
      const target = this.findStockChartUnderScreenPoint(e.clientX, e.clientY);
      if (target) {
        pineFrame.connectToChart(target, portIndex);
      }
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('click', onDocClick, true);
      if (pineFrame.outputPorts[portIndex]) {
        pineFrame.outputPorts[portIndex].classList.remove('active-drag');
      }
    };

    setTimeout(() => {
      window.addEventListener('click', onDocClick, { capture: true, once: true });
    }, 60);
  }

  updateWires() {
    this.wiresSvg.innerHTML = '';

    const sideNames = ['Top Node 1', 'Right Node 2', 'Bottom Node 3', 'Left Node 4'];

    this.pineNodes.forEach(pine => {
      pine.connections.forEach(({ chart, portIndex }) => {
        const p1World = pine.getOutputPortWorldPos(portIndex);
        const p2World = chart.getInputPortWorldPos(p1World);
        const s1 = this.worldToScreen(p1World.x, p1World.y);
        const s2 = this.worldToScreen(p2World.x, p2World.y);

        const dist = Math.hypot(s2.x - s1.x, s2.y - s1.y);
        const bend = Math.min(180, Math.max(50, dist * 0.45));

        let cp1 = { x: s1.x, y: s1.y };
        if (p1World.side === 'top') cp1.y -= bend;
        else if (p1World.side === 'bottom') cp1.y += bend;
        else if (p1World.side === 'left') cp1.x -= bend;
        else cp1.x += bend;

        let cp2 = { x: s2.x, y: s2.y };
        if (p2World.side === 'top') cp2.y -= bend;
        else if (p2World.side === 'bottom') cp2.y += bend;
        else if (p2World.side === 'left') cp2.x -= bend;
        else cp2.x += bend;

        const d = `M ${s1.x} ${s1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${s2.x} ${s2.y}`;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        path.setAttribute('class', 'connector-wire');
        const nodeLabel = sideNames[portIndex] || `Node ${portIndex + 1}`;
        path.setAttribute('title', `Connected: ${pine.scriptTitle} (${nodeLabel}) -> ${chart.symbol} (Click wire to disconnect)`);

        path.addEventListener('click', (e) => {
          e.stopPropagation();
          pine.disconnectFromChart(chart);
        });

        this.wiresSvg.appendChild(path);
      });
    });
  }

  // ==========================================
  // Stock Picker Modal
  // ==========================================
  setupStockModal() {
    this.btnOpenStockModal.addEventListener('click', () => {
      this.openStockModal();
    });

    this.btnCloseModal.addEventListener('click', () => {
      this.closeStockModal();
    });

    this.stockModalOverlay.addEventListener('click', (e) => {
      if (e.target === this.stockModalOverlay) {
        this.closeStockModal();
      }
    });

    this.stockSearchInput.addEventListener('input', () => {
      this.renderStockList();
    });

    this.stockSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = this.stockSearchInput.value.trim().toUpperCase();
        if (query) {
          this.addStockChart(query);
          this.closeStockModal();
        }
      }
    });

    const catPills = this.stockModalOverlay.querySelectorAll('.cat-pill');
    catPills.forEach(pill => {
      pill.addEventListener('click', () => {
        catPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.activeCategory = pill.dataset.cat;
        this.renderStockList();
      });
    });

    this.activeCategory = 'all';
    this.renderStockList();
  }

  openStockModal() {
    this.stockModalOverlay.classList.remove('hidden');
    this.stockSearchInput.value = '';
    this.renderStockList();
    setTimeout(() => this.stockSearchInput.focus(), 50);
  }

  closeStockModal() {
    this.stockModalOverlay.classList.add('hidden');
  }

  renderStockList() {
    const query = this.stockSearchInput.value.trim().toLowerCase();
    const cat = this.activeCategory || 'all';

    let filtered = STOCK_DATABASE.filter(item => {
      const matchesCat = cat === 'all' || item.category === cat;
      const matchesQuery = !query ||
        item.symbol.toLowerCase().includes(query) ||
        item.name.toLowerCase().includes(query);
      return matchesCat && matchesQuery;
    });

    this.stockListContainer.innerHTML = '';

    if (filtered.length === 0) {
      const customRow = document.createElement('div');
      customRow.className = 'stock-row';
      customRow.innerHTML = `
        <div class="stock-row-left">
          <span class="row-symbol">${query.toUpperCase()}</span>
          <span class="row-name">Add custom trading asset</span>
        </div>
        <div class="stock-row-right">
          <span class="row-change positive">+ Add</span>
        </div>
      `;
      customRow.addEventListener('click', () => {
        this.addStockChart(query.toUpperCase());
        this.closeStockModal();
      });
      this.stockListContainer.appendChild(customRow);
      return;
    }

    filtered.forEach(item => {
      const row = document.createElement('div');
      row.className = 'stock-row';
      const isPos = item.change >= 0;
      const formattedPrice = item.basePrice > 1000 ? item.basePrice.toLocaleString('en-US', { minimumFractionDigits: 2 }) : item.basePrice.toFixed(2);

      row.innerHTML = `
        <div class="stock-row-left">
          <span class="row-symbol">${item.symbol}</span>
          <span class="row-name">${item.name}</span>
        </div>
        <div class="stock-row-right">
          <span class="row-price">$${formattedPrice}</span>
          <span class="row-change ${isPos ? 'positive' : 'negative'}">${isPos ? '+' : ''}${item.change.toFixed(2)}%</span>
        </div>
      `;

      row.addEventListener('click', () => {
        this.addStockChart(item.symbol);
        this.closeStockModal();
      });

      this.stockListContainer.appendChild(row);
    });
  }

  // ==========================================
  // Real-Time Simulation
  // ==========================================
  setupLiveSimulation() {
    setInterval(() => {
      if (this.stockCharts.length === 0) return;
      const chart = this.stockCharts[Math.floor(Math.random() * this.stockCharts.length)];
      const deltaPercent = (Math.random() - 0.49) * 0.004;
      const newPrice = Math.max(1, chart.price * (1 + deltaPercent));
      chart.applyTickUpdate(newPrice, deltaPercent >= 0);
    }, 2200);
  }

  // ==========================================
  // Canvas Background Render Loop
  // ==========================================
  requestRender() {
    if (!this.renderPending) {
      this.renderPending = true;
      requestAnimationFrame(() => {
        this.renderPending = false;
        this.render();
      });
    }
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    const styles = getComputedStyle(document.body);
    const bgCanvas = styles.getPropertyValue('--bg-canvas').trim() || '#1e1e1e';
    const gridDot = styles.getPropertyValue('--grid-dot').trim() || '#383838';
    const gridLine = styles.getPropertyValue('--grid-line').trim() || '#2a2a2a';
    const gridLineMajor = styles.getPropertyValue('--grid-line-major').trim() || '#353535';

    ctx.fillStyle = bgCanvas;
    ctx.fillRect(0, 0, w, h);

    if (this.gridMode === 'none') {
      this.renderOriginCross(ctx);
      return;
    }

    let baseGrid = 20;
    let step = baseGrid * this.zoom;

    while (step < 12) {
      step *= 5;
      baseGrid *= 5;
    }
    while (step > 80) {
      step /= 2;
      baseGrid /= 2;
    }

    const offsetX = this.pan.x % step;
    const offsetY = this.pan.y % step;

    if (this.gridMode === 'dots') {
      ctx.fillStyle = gridDot;
      const dotRadius = Math.max(1.0, Math.min(1.8, 1.2 * Math.sqrt(this.zoom)));

      ctx.beginPath();
      for (let x = offsetX; x < w; x += step) {
        for (let y = offsetY; y < h; y += step) {
          ctx.moveTo(x + dotRadius, y);
          ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
        }
      }
      ctx.fill();
    } else if (this.gridMode === 'lines') {
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.strokeStyle = gridLine;
      for (let x = offsetX; x < w; x += step) {
        ctx.moveTo(Math.floor(x) + 0.5, 0);
        ctx.lineTo(Math.floor(x) + 0.5, h);
      }
      for (let y = offsetY; y < h; y += step) {
        ctx.moveTo(0, Math.floor(y) + 0.5);
        ctx.lineTo(w, Math.floor(y) + 0.5);
      }
      ctx.stroke();

      const majorStep = step * 5;
      const majorOffsetX = this.pan.x % majorStep;
      const majorOffsetY = this.pan.y % majorStep;

      ctx.beginPath();
      ctx.strokeStyle = gridLineMajor;
      for (let x = majorOffsetX; x < w; x += majorStep) {
        ctx.moveTo(Math.floor(x) + 0.5, 0);
        ctx.lineTo(Math.floor(x) + 0.5, h);
      }
      for (let y = majorOffsetY; y < h; y += majorStep) {
        ctx.moveTo(0, Math.floor(y) + 0.5);
        ctx.lineTo(w, Math.floor(y) + 0.5);
      }
      ctx.stroke();
    }

    this.renderOriginCross(ctx);
  }

  renderOriginCross(ctx) {
    const origin = this.worldToScreen(0, 0);
    if (origin.x >= -20 && origin.x <= this.width + 20 && origin.y >= -20 && origin.y <= this.height + 20) {
      ctx.save();
      ctx.strokeStyle = 'rgba(13, 153, 255, 0.45)';
      ctx.lineWidth = 1.5;
      const size = 6;
      ctx.beginPath();
      ctx.moveTo(origin.x - size, origin.y);
      ctx.lineTo(origin.x + size, origin.y);
      ctx.moveTo(origin.x, origin.y - size);
      ctx.lineTo(origin.x, origin.y + size);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Instantiate on load
document.addEventListener('DOMContentLoaded', () => {
  window.canvasApp = new FigmaCanvasApp();
});
