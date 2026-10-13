import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  PanResponder,
  Pressable,
  ScrollView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import CanvasBoard from './CanvasBoard';

const C = {
  bg: '#0b0e13', panel: '#11151c', raised: '#171c25', line: '#242a35',
  text: '#f2f4f8', muted: '#8993a3', green: '#42d392', red: '#f16d79',
  blue: '#78a9ff', purple: '#bd91ff', amber: '#f2bd62',
};

const ASSETS = [
  { symbol: 'NVDA', name: 'NVIDIA', price: 132.8, change: 4.62 },
  { symbol: 'AAPL', name: 'Apple', price: 228.45, change: 1.85 },
  { symbol: 'TSLA', name: 'Tesla', price: 254.1, change: -2.15 },
  { symbol: 'BTC/USD', name: 'Bitcoin', price: 67420, change: 3.28 },
  { symbol: 'ETH/USD', name: 'Ethereum', price: 2640.5, change: 2.1 },
  { symbol: 'SPY', name: 'S&P 500 ETF', price: 584.2, change: 0.74 },
  { symbol: 'QQQ', name: 'Nasdaq 100 ETF', price: 492.1, change: 1.3 },
];

const PRESETS = {
  'SMA Golden Cross': `//@version=5\nstrategy("SMA Golden Cross", overlay=true)\n\nfastLength = input(9, "Fast SMA")\nslowLength = input(21, "Slow SMA")\nfastSMA = ta.sma(close, fastLength)\nslowSMA = ta.sma(close, slowLength)\n\nplot(fastSMA, color=#06b6d4)\nplot(slowSMA, color=#f59e0b)\nif ta.crossover(fastSMA, slowSMA)\n    strategy.entry("Long", strategy.long)`,
  'Bollinger Bands': `//@version=5\nindicator("Bollinger Bands", overlay=true)\n\nlength = input(20, "Length")\nbasis = ta.sma(close, length)\ndev = 2 * ta.stdev(close, length)\nplot(basis + dev, color=#ec4899)\nplot(basis, color=#3b82f6)\nplot(basis - dev, color=#10b981)`,
  'RSI Reversal': `//@version=5\nstrategy("RSI Reversal", overlay=true)\n\nrsiLength = input(14, "RSI Length")\ntrend = ta.ema(close, 20)\nplot(trend, color=#8b5cf6)\nif ta.crossover(close, trend)\n    strategy.entry("Long", strategy.long)`,
};

/** @typedef {{id: string, kind: string, x: number, y: number, symbol?: string, name?: string, price?: number, change?: number, timeframe?: string, chartType?: string, title?: string, code?: string, content?: string, color?: string}} Frame */
/** @type {Frame[]} */
const INITIAL = [
  { id: 'chart-1', kind: 'chart', x: 18, y: 18, ...ASSETS[0], timeframe: '1D', chartType: 'Candles' },
  { id: 'script-1', kind: 'script', x: 378, y: 18, title: 'SMA Golden Cross', code: PRESETS['SMA Golden Cross'] },
  { id: 'note-1', kind: 'note', x: 18, y: 478, title: 'Trade plan', content: 'Watch the daily trend.\n\nRisk / reward: 1:3\nStop loss set before entry.', color: '#28352d' },
  { id: 'chart-2', kind: 'chart', x: 378, y: 478, ...ASSETS[1], timeframe: '1D', chartType: 'Candles' },
];

/** @param {string} kind @param {Partial<Frame>} data @returns {Frame} */
function makeFrame(kind, data = {}, index = 0) {
  const id = `${kind}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return { id, kind, x: 18 + (index % 2) * 360, y: 18 + Math.floor(index / 2) * 460, ...data };
}

function Button({ children, onPress, active = false, tint = C.muted, style = undefined }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={[styles.button, active && { backgroundColor: `${tint}1c`, borderColor: `${tint}65` }, style]}>
      <Text style={[styles.buttonText, active && { color: tint }]}>{children}</Text>
    </Pressable>
  );
}

function DragCard({ frame, children, onMove, selected, onSelect, scale }) {
  const start = useRef({ x: frame.x, y: frame.y, dx: 0, dy: 0 });
  const latest = useRef({ frame, onMove, onSelect, scale });
  latest.current = { frame, onMove, onSelect, scale };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.numberActiveTouches === 1 && Math.hypot(gesture.dx, gesture.dy) > 4,
    onPanResponderGrant: (_event, gesture) => {
      const value = latest.current;
      start.current = { x: value.frame.x, y: value.frame.y, dx: gesture.dx, dy: gesture.dy };
      value.onSelect(value.frame.id);
    },
    onPanResponderMove: (_event, gesture) => {
      if (gesture.numberActiveTouches !== 1) return;
      const value = latest.current;
      value.onMove(value.frame.id, start.current.x + (gesture.dx - start.current.dx) / value.scale, start.current.y + (gesture.dy - start.current.dy) / value.scale);
    },
    onPanResponderTerminationRequest: () => true,
  }), []);

  return <View style={[
    styles.card,
    { left: frame.x, top: frame.y },
    frame.kind === 'script' && styles.scriptCard,
    frame.kind === 'note' && [styles.noteCard, { backgroundColor: frame.color || '#28352d' }],
    selected && styles.selectedCard,
  ]}>
    <View {...pan.panHandlers} style={styles.cardGrip}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Select ${frame.symbol || frame.title}`} onPress={() => onSelect(frame.id)} onLongPress={() => onSelect(frame.id)} style={styles.gripButton}>
        <Text style={styles.gripText}>⠿  Drag to move</Text>
      </Pressable>
    </View>
    {children}
  </View>;
}

function CandlestickChart({ color, seed, width, chartType }) {
  const values = Array.from({ length: 34 }, (_, i) => {
    const drift = Math.sin((i + seed) * 0.58) * 20 + Math.cos((i + seed) * 0.19) * 12 + i * (seed % 2 ? 0.45 : -0.12);
    return { open: 54 + drift, close: 54 + drift + Math.sin((i + seed) * 1.7) * 10, high: 0, low: 0 };
  }).map((c) => ({ ...c, high: Math.max(c.open, c.close) + 3 + (seed % 3), low: Math.min(c.open, c.close) - 3 - (seed % 2) }));
  const chartWidth = width - 62;
  const chartHeight = 126;
  const valuesAll = values.flatMap((c) => [c.high, c.low]);
  const min = Math.min(...valuesAll);
  const max = Math.max(...valuesAll);
  const scaleY = (price) => chartHeight - ((price - min) / (max - min || 1)) * chartHeight;
  const gap = chartWidth / values.length;
  const candleWidth = Math.max(3, gap * 0.48);

  return (
    <View style={{ height: chartHeight, marginHorizontal: 17, marginTop: 18, overflow: 'hidden' }}>
      {[0, 1, 2, 3].map((row) => <View key={row} style={[styles.gridLine, { top: row * (chartHeight / 3), width: chartWidth }]} />)}
      {chartType === 'Line' ? values.slice(1).map((candle, i) => {
        const previous = values[i];
        const x1 = i * gap + gap / 2;
        const x2 = (i + 1) * gap + gap / 2;
        const y1 = scaleY(previous.close);
        const y2 = scaleY(candle.close);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        return <View key={i} style={{ position: 'absolute', left: (x1 + x2 - length) / 2, top: (y1 + y2 - 2) / 2, width: length, height: 2, backgroundColor: color, transform: [{ rotate: `${angle}deg` }] }} />;
      }) : values.map((candle, i) => {
        const up = candle.close >= candle.open;
        const x = i * gap + (gap - candleWidth) / 2;
        const top = Math.min(scaleY(candle.open), scaleY(candle.close));
        const bodyHeight = Math.max(2, Math.abs(scaleY(candle.open) - scaleY(candle.close)));
        return <View key={i} style={{ position: 'absolute', left: x, top: scaleY(candle.high), height: scaleY(candle.low) - scaleY(candle.high), width: candleWidth, backgroundColor: up ? C.green : C.red, opacity: 0.82 }}>
          <View style={{ position: 'absolute', top: scaleY(up ? candle.close : candle.open) - scaleY(candle.high), left: -1, height: bodyHeight, width: candleWidth + 2, backgroundColor: up ? C.green : C.red, borderRadius: 1 }} />
        </View>;
      })}
      <View style={[styles.priceGuide, { top: scaleY(values[values.length - 1].close), backgroundColor: color }]} />
    </View>
  );
}

function ChartCard({ frame, width, update, remove }) {
  const positive = frame.change >= 0;
  return <>
    <View style={styles.cardTopLine}><Text style={styles.dragHint}>⠿</Text><Text style={styles.frameType}>CHART</Text><Pressable onPress={() => remove(frame.id)} hitSlop={10}><Text style={styles.close}>×</Text></Pressable></View>
    <View style={styles.chartHeader}>
      <View><Text style={styles.symbol}>{frame.symbol}</Text><Text style={styles.company}>{frame.name}</Text></View>
      <View style={{ alignItems: 'flex-end' }}><Text style={styles.lastPrice}>${frame.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text><Text style={[styles.change, { color: positive ? C.green : C.red }]}>{positive ? '+' : ''}{frame.change.toFixed(2)}%</Text></View>
    </View>
    <View style={styles.chartToggleRow}>
      {['1D', '1W', '1M', '1Y'].map((tf) => <Button key={tf} active={frame.timeframe === tf} tint={C.blue} onPress={() => update(frame.id, { timeframe: tf })}>{tf}</Button>)}
      <Button active={frame.chartType === 'Line'} tint={C.purple} onPress={() => update(frame.id, { chartType: frame.chartType === 'Line' ? 'Candles' : 'Line' })}>{frame.chartType === 'Line' ? '↗ Line' : '▥'}</Button>
    </View>
    <CandlestickChart seed={frame.price} width={width} color={positive ? C.green : C.red} chartType={frame.chartType} />
    <View style={styles.chartFooter}><Text style={styles.axisLabel}>09:30</Text><Text style={styles.axisLabel}>12:00</Text><Text style={styles.axisLabel}>16:00</Text><View style={styles.liveDot} /><Text style={styles.axisLabel}>Demo data</Text></View>
  </>;
}

function ScriptCard({ frame, update, remove }) {
  const [compiled, setCompiled] = useState(false);
  return <>
    <View style={styles.cardTopLine}><Text style={styles.dragHint}>⠿</Text><Text style={[styles.frameType, { color: C.purple }]}>PINE SCRIPT · v5</Text><Pressable onPress={() => remove(frame.id)} hitSlop={10}><Text style={styles.close}>×</Text></Pressable></View>
    <Text style={styles.scriptTitle}>{frame.title}</Text>
    <Text style={styles.company}>Strategy editor</Text>
    <TextInput
      multiline
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      value={frame.code}
      onChangeText={(code) => { update(frame.id, { code }); setCompiled(false); }}
      textAlignVertical="top"
      style={styles.codeInput}
      accessibilityLabel="Pine Script editor"
    />
    <View style={styles.scriptActions}>
      <Pressable style={styles.runButton} onPress={() => setCompiled(true)}><Text style={styles.runText}>▶  Run preview</Text></Pressable>
      <Pressable style={styles.templateButton} onPress={() => {
        const names = Object.keys(PRESETS);
        const next = names[(names.indexOf(frame.title) + 1) % names.length];
        update(frame.id, { title: next, code: PRESETS[next] });
        setCompiled(false);
      }}><Text style={styles.templateText}>Template ↻</Text></Pressable>
    </View>
    <Text style={[styles.compileStatus, { color: compiled ? C.green : C.muted }]}>{compiled ? 'Preview ready · simulated candles' : 'Templates edit code; execution is a UI preview'}</Text>
  </>;
}

function NoteCard({ frame, update, remove }) {
  return <>
    <View style={styles.cardTopLine}><Text style={styles.dragHint}>⠿</Text><Text style={[styles.frameType, { color: C.amber }]}>TRADING NOTE</Text><Pressable onPress={() => remove(frame.id)} hitSlop={10}><Text style={styles.close}>×</Text></Pressable></View>
    <TextInput value={frame.title} onChangeText={(title) => update(frame.id, { title })} style={styles.noteTitle} placeholder="Note title" placeholderTextColor="#a3acb6" />
    <TextInput value={frame.content} onChangeText={(content) => update(frame.id, { content })} style={styles.noteBody} multiline textAlignVertical="top" placeholder="Write your plan…" placeholderTextColor="#a3acb6" />
    <View style={styles.noteColors}>{['#28352d', '#293447', '#423044', '#433827'].map((color) => <Pressable key={color} onPress={() => update(frame.id, { color })} style={[styles.colorSwatch, { backgroundColor: color, borderColor: frame.color === color ? C.text : 'transparent' }]} />)}</View>
  </>;
}

function TradingWorkspace() {
  const { width: viewportWidth } = useWindowDimensions();
  const wide = viewportWidth >= 900;
  const [frames, setFrames] = useState(INITIAL);
  const [selected, setSelected] = useState('chart-1');
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('Canvas');
  const boardRef = useRef(null);

  const update = (id, changes) => setFrames((all) => all.map((frame) => frame.id === id ? { ...frame, ...changes } : frame));
  const move = (id, x, y) => update(id, { x, y });
  const remove = (id) => setFrames((all) => all.filter((frame) => frame.id !== id));
  const addStock = (asset) => {
    const count = frames.filter((frame) => frame.kind === 'chart').length;
    const frame = makeFrame('chart', { ...asset, timeframe: '1D', chartType: 'Candles' }, frames.length);
    frame.x = 18 + (count % 2) * 360;
    frame.y = 18 + Math.floor((frames.length) / 2) * 460;
    setFrames((all) => [...all, frame]);
    setSelected(frame.id);
    setPicker(false);
    setSearch('');
    setTab('Canvas');
    boardRef.current?.focus(frame);
  };
  const addScript = () => {
    const frame = makeFrame('script', { title: 'SMA Golden Cross', code: PRESETS['SMA Golden Cross'] }, frames.length);
    setFrames((all) => [...all, frame]); setSelected(frame.id); setTab('Canvas');
    boardRef.current?.focus(frame);
  };
  const addNote = () => {
    const frame = makeFrame('note', { title: 'Trade plan', content: '', color: '#28352d' }, frames.length);
    setFrames((all) => [...all, frame]); setSelected(frame.id); setTab('Canvas');
    boardRef.current?.focus(frame);
  };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (event) => {
      if (event.key === 'Escape') { setPicker(false); setTab('Canvas'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  const visibleAssets = ASSETS.filter((asset) => `${asset.symbol} ${asset.name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.brandRow}><View style={styles.brandIcon}><Text style={styles.brandIconText}>$</Text></View><View><Text style={styles.brand}>Trading Canvas <Text style={styles.pro}>PRO</Text></Text><Text style={styles.subtitle}>MARKET WORKSPACE</Text></View></View>
        <Pressable style={styles.avatar} onPress={() => Alert.alert('Trading Canvas', 'Your workspace is saved for this session.')}><Text style={styles.avatarText}>TC</Text></Pressable>
      </View>

      <View style={styles.titleRow}><View><Text style={styles.pageTitle}>Workspace</Text><Text style={styles.pageSubtitle}>Watchlist · {frames.length} frames</Text></View><Button onPress={() => Alert.alert('Workspace', 'Session-only board. Local persistence is not enabled yet.')}>•••</Button></View>
      <ScrollView horizontal style={styles.actionScroll} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
        <Pressable style={styles.primaryAction} onPress={() => { setPicker(true); setTab('Canvas'); }}><Text style={styles.primaryActionText}>＋  Add market</Text></Pressable>
        <Button onPress={addScript} tint={C.purple}>⌘  Script</Button>
        <Button onPress={addNote} tint={C.amber}>▤  Note</Button>
        <Button onPress={() => { const charts = frames.filter((frame) => frame.kind === 'chart'); if (!charts.length) return; charts.forEach((frame, i) => update(frame.id, { x: 18 + (i % 2) * 360, y: 18 + Math.floor(i / 2) * 460 })); }}>▦  Arrange</Button>
      </ScrollView>

      <View style={styles.canvasBar}><View style={styles.canvasName}><View style={styles.liveDot} /><Text style={styles.canvasLabel}>Untitled board</Text><Text style={styles.boardPill}>DRAFT</Text></View><Text style={styles.zoomText}>Pan · Pinch · Drag grips</Text></View>

      <CanvasBoard ref={boardRef} onDeselect={() => setSelected(null)}>
        {(scale) => <>
          {frames.map((frame) => (
            <DragCard key={frame.id} frame={frame} onMove={move} selected={selected === frame.id} onSelect={setSelected} scale={scale}>
              {frame.kind === 'chart' && <ChartCard frame={frame} width={330} update={update} remove={remove} />}
              {frame.kind === 'script' && <ScriptCard frame={frame} update={update} remove={remove} />}
              {frame.kind === 'note' && <NoteCard frame={frame} update={update} remove={remove} />}
            </DragCard>
          ))}
          {!frames.length && <View style={[styles.emptyBoard, { width: viewportWidth }]}><Text style={styles.emptyTitle}>Your canvas is ready</Text><Text style={styles.company}>Add a chart, script, or note to start your board.</Text></View>}
        </>}
      </CanvasBoard>

      <View style={styles.bottomNav}>{['Canvas', 'Layers', 'Assets'].map((item, i) => <Pressable key={item} onPress={() => item === 'Assets' ? setPicker(true) : setTab(item)} style={styles.navItem}><Text style={[styles.navIcon, tab === item && styles.navActive]}>{['▦', '☷', '✣'][i]}</Text><Text style={[styles.navLabel, tab === item && styles.navActive]}>{item}</Text></Pressable>)}</View>

      {tab === 'Layers' && <View style={[styles.layersPanel, wide && { right: 'auto', width: 340 }]}><View style={styles.panelHeading}><Text style={styles.panelTitle}>Layers</Text><Pressable onPress={() => setTab('Canvas')}><Text style={styles.close}>×</Text></Pressable></View><ScrollView>{frames.map((frame) => <Pressable key={frame.id} style={styles.layerRow} onPress={() => { setSelected(frame.id); setTab('Canvas'); boardRef.current?.focus(frame); }}><Text style={styles.layerIcon}>{frame.kind === 'chart' ? '▥' : frame.kind === 'script' ? '⌘' : '▤'}</Text><Text style={styles.layerName}>{frame.kind === 'chart' ? frame.symbol : frame.title}</Text><Text style={styles.layerType}>{frame.kind}</Text></Pressable>)}</ScrollView></View>}

      {picker && <View style={[styles.modalShade, wide && { alignItems: 'center', justifyContent: 'center' }]}><View style={[styles.pickerPanel, wide && { width: 480, borderRadius: 18 }]}><View style={styles.pickerHeading}><View><Text style={styles.panelTitle}>Add to canvas</Text><Text style={styles.company}>Choose an asset to chart</Text></View><Pressable onPress={() => setPicker(false)}><Text style={styles.close}>×</Text></Pressable></View><TextInput value={search} onChangeText={setSearch} placeholder="Search tickers" placeholderTextColor={C.muted} style={styles.searchInput} autoCapitalize="characters" /><ScrollView keyboardShouldPersistTaps="handled">{visibleAssets.map((asset) => <Pressable key={asset.symbol} style={styles.assetRow} onPress={() => addStock(asset)}><View style={styles.assetIcon}><Text style={styles.assetIconText}>{asset.symbol.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={styles.assetSymbol}>{asset.symbol}</Text><Text style={styles.company}>{asset.name}</Text></View><Text style={[styles.change, { color: asset.change >= 0 ? C.green : C.red }]}>{asset.change >= 0 ? '+' : ''}{asset.change.toFixed(2)}%</Text></Pressable>)}{!visibleAssets.length && <Text style={styles.emptySearch}>No ticker found in this demo list.</Text>}</ScrollView></View></View>}
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><TradingWorkspace /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  cardGrip: { marginHorizontal: -14, marginTop: -14, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: C.line, ...(Platform.OS === 'web' ? { touchAction: 'none', cursor: 'pointer' } : {}) },
  gripButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14 },
  gripText: { color: C.muted, fontSize: 11 },
  screen: { flex: 1, backgroundColor: C.bg },
  header: { height: 58, paddingHorizontal: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#191e27' },
  brandRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, brandIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#164d43', alignItems: 'center', justifyContent: 'center' }, brandIconText: { color: C.green, fontSize: 19, fontWeight: '700' },
  brand: { color: C.text, fontSize: 14, fontWeight: '700', letterSpacing: 0.2 }, pro: { color: C.green, fontSize: 9, letterSpacing: 1.2 }, subtitle: { color: C.muted, fontSize: 8, letterSpacing: 1.7, marginTop: 2 }, avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#272633', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#514765' }, avatarText: { color: '#d9c6ff', fontSize: 10, fontWeight: '700' },
  titleRow: { paddingHorizontal: 18, paddingTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, pageTitle: { color: C.text, fontSize: 22, fontWeight: '700' }, pageSubtitle: { color: C.muted, fontSize: 11, marginTop: 3 }, actionScroll: { height: 62, flexGrow: 0, flexShrink: 0 }, actionRow: { paddingHorizontal: 18, paddingVertical: 14, gap: 8, alignItems: 'center' },
  primaryAction: { minHeight: 44, backgroundColor: '#4a9eff', height: 36, paddingHorizontal: 13, borderRadius: 8, justifyContent: 'center' }, primaryActionText: { color: '#08101b', fontWeight: '700', fontSize: 12 }, button: { minHeight: 44, paddingHorizontal: 11, borderRadius: 8, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, justifyContent: 'center', alignItems: 'center' }, buttonText: { color: '#bac3d0', fontSize: 11, fontWeight: '600' },
  canvasBar: { height: 41, paddingHorizontal: 17, backgroundColor: '#10141b', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#202632', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, canvasName: { flexDirection: 'row', gap: 7, alignItems: 'center' }, canvasLabel: { fontSize: 11, color: '#d4dae4', fontWeight: '600' }, boardPill: { fontSize: 7, color: C.amber, borderColor: '#65502b', borderWidth: 1, overflow: 'hidden', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 }, zoomText: { fontSize: 10, color: C.muted }, liveDot: { width: 6, height: 6, backgroundColor: C.green, borderRadius: 3 },
  boardScroll: { flex: 1 }, board: { backgroundColor: '#0e1218' }, card: { ...(Platform.OS === 'web' ? { touchAction: 'pan-x pan-y' } : {}), position: 'absolute', width: 330, minHeight: 330, padding: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: '#252c38', borderRadius: 12, overflow: 'hidden' }, selectedCard: { borderColor: '#5493ed' }, scriptCard: { minHeight: 380 }, noteCard: { minHeight: 230, borderColor: '#4c5346' }, cardTopLine: { height: 22, flexDirection: 'row', alignItems: 'center', gap: 7 }, dragHint: { color: '#758092', fontSize: 13 }, frameType: { color: '#8e9aab', fontSize: 9, fontWeight: '700', letterSpacing: 1, flex: 1 }, close: { minWidth: 32, minHeight: 32, textAlign: 'center', color: '#8590a0', fontSize: 21, lineHeight: 22, paddingHorizontal: 2 },
  chartHeader: { marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, symbol: { color: C.text, fontSize: 16, fontWeight: '700' }, company: { color: C.muted, fontSize: 10, marginTop: 3 }, lastPrice: { color: C.text, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] }, change: { fontSize: 10, fontWeight: '700', marginTop: 3 }, chartToggleRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }, gridLine: { position: 'absolute', left: 0, height: 1, backgroundColor: '#262c36' }, priceGuide: { position: 'absolute', left: 0, right: 0, height: 1, opacity: 0.75 }, chartFooter: { marginHorizontal: 17, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 7 }, axisLabel: { color: '#737e8f', fontSize: 8 },
  scriptTitle: { color: C.text, fontWeight: '700', fontSize: 15, marginTop: 11 }, codeInput: { height: 220, marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: '#2b303e', padding: 10, color: '#d6ceec', backgroundColor: '#0b0e14', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 10, lineHeight: 16 }, scriptActions: { flexDirection: 'row', gap: 7, marginTop: 10 }, runButton: { backgroundColor: '#7553be', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 8 }, runText: { color: '#fff', fontSize: 10, fontWeight: '700' }, templateButton: { borderColor: '#3b334b', borderWidth: 1, borderRadius: 7, paddingHorizontal: 10, justifyContent: 'center' }, templateText: { color: '#cfbaf9', fontSize: 10 }, compileStatus: { fontSize: 9, marginTop: 9 },
  noteTitle: { marginTop: 9, color: '#f4f1e9', fontSize: 15, fontWeight: '700', paddingVertical: 3 }, noteBody: { minHeight: 110, color: '#d3d5cc', fontSize: 12, lineHeight: 19, paddingVertical: 5 }, noteColors: { flexDirection: 'row', gap: 8, marginTop: 8 }, colorSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  emptyBoard: { marginTop: 180, alignItems: 'center', paddingHorizontal: 30 }, emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  bottomNav: { height: 61, borderTopWidth: 1, borderTopColor: '#202632', backgroundColor: '#10141b', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 3 }, navItem: { minHeight: 44, justifyContent: 'center', alignItems: 'center', gap: 3, width: 70 }, navIcon: { color: '#8490a1', fontSize: 17 }, navLabel: { color: '#8490a1', fontSize: 9, fontWeight: '600' }, navActive: { color: '#77aaff' },
  modalShade: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, justifyContent: 'flex-end', backgroundColor: '#0009' }, pickerPanel: { backgroundColor: '#151a22', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: '#343c4a', paddingHorizontal: 18, paddingTop: 19, paddingBottom: 22, maxHeight: '83%' }, pickerHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, panelTitle: { color: C.text, fontSize: 16, fontWeight: '700' }, searchInput: { height: 40, marginTop: 16, marginBottom: 7, borderRadius: 8, borderWidth: 1, borderColor: '#343c49', backgroundColor: '#0c1016', paddingHorizontal: 12, color: C.text, fontSize: 12 }, assetRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#272e38', gap: 10 }, assetIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1d2938' }, assetIconText: { color: C.blue, fontWeight: '700' }, assetSymbol: { color: C.text, fontSize: 12, fontWeight: '700' }, emptySearch: { color: C.muted, textAlign: 'center', paddingVertical: 24, fontSize: 12 },
  layersPanel: { position: 'absolute', left: 10, right: 10, bottom: 70, maxHeight: '60%', backgroundColor: '#171c25', borderRadius: 12, borderWidth: 1, borderColor: '#343c49', padding: 14 }, panelHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }, layerRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', height: 39, borderBottomWidth: 1, borderColor: '#282e38', gap: 10 }, layerIcon: { color: C.blue, width: 18 }, layerName: { color: '#d6dce5', flex: 1, fontSize: 11 }, layerType: { color: C.muted, fontSize: 9 },
});
