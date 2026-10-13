# Trading Canvas Pro 📊🎨

A Figma-inspired infinite canvas desktop workstation designed for financial markets, multi-chart analysis, visual algorithmic wiring, and Pine Script execution.

![Trading Canvas Pro](https://img.shields.io/badge/Trading%20Canvas-Pro-0d99ff?style=for-the-badge&logo=figma&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JS%20%7C%20HTML5%20%7C%20CSS3-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## ✨ Features

### 📐 Figma Canvas Architecture
- **Infinite Vector Canvas**: Hardware-accelerated dot/grid rendering with smooth pan & zoom ($5\%$ to $2400\%$).
- **Figma Section Frames**: Group related assets into colored containers (**Purple**, **Blue**, **Green**, **Amber**, **Rose**). Moving a section header moves all nested child cards together in real time.
- **Sticky Journal Notes**: Color-coded post-it annotations with pastel paper presets (**Yellow**, **Green**, **Blue**, **Purple**, **Pink**, **Dark**).
- **Middle-Click Panning**: Pan the canvas anywhere by holding the scroll wheel or middle click.
- **Marquee Multi-Selection**: Left-click and drag across empty canvas to box-select multiple nodes.
- **Smart Non-Overlapping Paste**: <kbd>Ctrl+C</kbd>, <kbd>Ctrl+V</kbd>, and <kbd>Ctrl+D</kbd> intelligently calculate free space to paste without overlapping existing frames.

### 📈 Stock Charts & Real-Time Feed
- High-performance canvas charting with candlestick and smooth spline line modes.
- Built-in multi-asset database (**NVDA**, **AAPL**, **TSLA**, **BTC/USD**, **ETH/USD**, **SOL/USD**, **SPY**, **QQQ**, and custom tickers).
- Multiple timeframes (**1D**, **1W**, **1M**, **1Y**).
- Interactive crosshairs with OHLC pricing and tooltip inspection.

### ⚡ Cardinal Pine Script Engine & Wiring
- **Central Pine Script Hub**: Write, edit, and compile Pine Script v5 strategies and indicators on the canvas.
- **4 Cardinal Output Ports**: Top, Right, Bottom, and Left pins connect via cubic Bézier wires to stock chart inputs.
- **Built-in Presets**: SMA Golden Cross, Bollinger Bands, RSI Reversal, and SuperTrend Breakout.
- **Real-Time Backtest Metrics**: Live calculation of Net Profit %, Win Rate %, Profit Factor, and Max Drawdown %.

### 🎛️ Figma Left Sidebar (Layers & Assets)
- **Layers Panel**: Live hierarchical layer tree with visibility toggles (👁 / 🚫), lock toggles (🔒 / 🔓), and double-click to center camera on any object.
- **Assets Panel**: Quick-insert asset library for instant one-click chart and script spawning.

### 🛠️ Figma Right Sidebar (Design Inspector)
- **Alignment Toolbar**: Align Left, Align Horizontal Center, Align Right, Align Top, Align Vertical Center, Align Bottom.
- **Transform Inputs**: Two-way data binding for numeric $X$, $Y$, $W$ (Width), and $H$ (Height) coordinates.
- **Dynamic Properties**: Contextual inspector panels adapt based on whether a Stock Chart, Pine Script, Section Frame, or Note is active.

### 🧭 Radar Minimap & Export
- **Minimap Radar**: Bottom-right floating radar viewport showing full canvas coordinates and active screen bounds with click-to-pan.
- **Board Export**: Export high-resolution $1920 \times 1080$ PNG snapshots of the entire workstation layout.
- **Undo / Redo**: Robust history snapshot stack (<kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd>).

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Description |
| :--- | :--- |
| <kbd>C</kbd> | Open Stock Picker Modal |
| <kbd>P</kbd> | Add new Pine Script Frame |
| <kbd>S</kbd> | Add new Section Frame |
| <kbd>N</kbd> | Add new Sticky Note |
| <kbd>M</kbd> | Toggle Minimap Radar |
| <kbd>Alt + L</kbd> | Toggle Left Sidebar (Layers & Assets) |
| <kbd>Alt + R</kbd> | Toggle Right Sidebar (Design Inspector) |
| <kbd>Ctrl + Z</kbd> | Undo |
| <kbd>Ctrl + Y</kbd> / <kbd>Ctrl + Shift + Z</kbd> | Redo |
| <kbd>Ctrl + C</kbd> | Copy selected frames |
| <kbd>Ctrl + V</kbd> | Smart Paste (non-overlapping) |
| <kbd>Ctrl + D</kbd> | Duplicate selected frames |
| <kbd>Middle Click</kbd> / <kbd>Space + Drag</kbd> | Pan canvas |
| <kbd>Left Click + Drag</kbd> | Marquee selection box |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete selected frame(s) |
| <kbd>Shift + 1</kbd> / <kbd>Ctrl + 0</kbd> | Recenter view to origin |

---

## 🚀 Getting Started

Since Trading Canvas Pro is written in pure vanilla HTML5, CSS3, and modern JavaScript, no build tools or package managers are required!

### Option 1: Direct File Open
Simply double-click `index.html` or open it in any modern browser:
```bash
start index.html
```

### Option 2: Local HTTP Server
Using Python:
```bash
python -m http.server 8000
```
Then navigate to `http://localhost:8000`.

Using Node `npx serve`:
```bash
npx -y serve .
```

### React Native app (Expo)

The mobile app lives in [`mobile/`](mobile/). Install its locked dependencies and start Expo:

```bash
cd mobile
npm ci
npm run start
```

Open the printed QR code with Expo Go, or use `npm run android` / `npm run ios` with a connected device or emulator. Run `npm run web` to preview the layout in a browser. The app includes a touch-movable board, demo stock charts, editable Pine Script templates, and sticky notes. It currently uses sample market data, keeps edits for the current session only, and does not execute Pine Script.

---

## 📜 License
MIT License. Free to use, modify, and distribute.
