import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

const clampZoom = (value) => Math.max(0.35, Math.min(3, value));

// Translate in screen coordinates and scale around the gesture's focal point.
export function zoomAt(view, scale, x, y) {
  const next = clampZoom(scale);
  return { x: x - (x - view.x) * next / view.scale, y: y - (y - view.y) * next / view.scale, scale: next };
}

function touchGeometry(touches) {
  const a = touches[0];
  const b = touches[1] || a;
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2, distance: Math.max(1, Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY)), count: touches.length };
}

const CanvasBoard = forwardRef(
/**
 * @param {{children: (scale: number) => import('react').ReactNode, onDeselect: () => void}} props
 * @param {import('react').ForwardedRef<{focus: (frame: {x: number, y: number}) => void, reset: () => void}>} ref
 */
function CanvasBoard({ children, onDeselect }, ref) {
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [help, setHelp] = useState(false);
  const viewport = useRef(null);
  const current = useRef(view);
  const bounds = useRef({ x: 0, y: 0, width: 1, height: 1 });
  const gesture = useRef(null);
  const pendingGeometry = useRef(null);
  const lastTap = useRef(null);
  const deselect = useRef(onDeselect);
  deselect.current = onDeselect;
  const apply = (next) => { current.current = next; setView(next); };
  const measure = () => viewport.current?.measureInWindow((x, y, width, height) => { bounds.current = { x, y, width, height }; });
  const zoom = (factor) => apply(zoomAt(current.current, current.current.scale * factor, bounds.current.width / 2, bounds.current.height / 2));

  useImperativeHandle(ref, () => ({
    focus(frame) { apply({ x: 18 - frame.x * current.current.scale, y: 18 - frame.y * current.current.scale, scale: current.current.scale }); },
    reset() { apply({ x: 0, y: 0, scale: 1 }); },
  }), []);

  const responders = useMemo(() => {
    const config = {
      onStartShouldSetPanResponderCapture: e => {
        if (e.nativeEvent.touches.length < 2) { pendingGeometry.current = null; return false; }
        pendingGeometry.current = touchGeometry(e.nativeEvent.touches);
        return true;
      },
      onMoveShouldSetPanResponderCapture: e => e.nativeEvent.touches.length >= 2,
      onPanResponderGrant: e => {
        measure();
        const point = pendingGeometry.current || touchGeometry(e.nativeEvent.touches);
        pendingGeometry.current = null;
        gesture.current = { ...point, moved: false, multi: point.count > 1, time: Date.now() };
      },
      onPanResponderMove: e => {
        const touches = e.nativeEvent.touches;
        if (!touches.length || !gesture.current) return;
        const point = touchGeometry(touches);
        const previous = gesture.current;
        // Rebase when fingers are added/removed; never jump to a new centroid.
        if (point.count !== previous.count) {
          gesture.current = { ...point, moved: true, multi: true, time: previous.time };
          return;
        }
        let next = current.current;
        if (point.count > 1) {
          next = zoomAt(next, next.scale * point.distance / previous.distance, previous.x - bounds.current.x, previous.y - bounds.current.y);
        }
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        apply({ ...next, x: next.x + dx, y: next.y + dy });
        gesture.current = { ...point, time: previous.time, multi: previous.multi, moved: previous.moved || Math.abs(dx) + Math.abs(dy) > 2 };
      },
      onPanResponderRelease: () => {
        const point = gesture.current;
        if (point && !point.moved && !point.multi && Date.now() - point.time < 300) {
          const last = lastTap.current;
          if (last && Date.now() - last.time < 350 && Math.hypot(point.x - last.x, point.y - last.y) < 30) {
            apply(zoomAt(current.current, current.current.scale < 1.5 ? 2 : 1, point.x - bounds.current.x, point.y - bounds.current.y));
            lastTap.current = null;
          } else { deselect.current?.(); lastTap.current = { ...point, time: Date.now() }; }
        }
        gesture.current = null;
        pendingGeometry.current = null;
      },
      onPanResponderTerminate: () => { gesture.current = null; pendingGeometry.current = null; lastTap.current = null; },
      onPanResponderTerminationRequest: () => true,
    };
    return {
      board: PanResponder.create(config),
      background: PanResponder.create({ ...config, onStartShouldSetPanResponder: () => true }),
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const element = viewport.current;
    if (!element?.addEventListener) return;
    let safari = null;
    const editing = target => target.closest('input, textarea, select, [contenteditable="true"]');
    const wheel = e => {
      if (editing(e.target) || e.target.closest('[data-testid="board-controls"]')) return;
      e.preventDefault();
      if (safari || gesture.current) return;
      const rect = element.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1;
      if (e.ctrlKey || e.metaKey) apply(zoomAt(current.current, current.current.scale * Math.exp(-e.deltaY * unit * 0.01), e.clientX - rect.left, e.clientY - rect.top));
      else apply({ ...current.current, x: current.current.x - (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit, y: current.current.y - (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit });
    };
    const start = e => {
      if (editing(e.target)) return;
      e.preventDefault();
      if (gesture.current) return;
      const rect = element.getBoundingClientRect();
      safari = { view: current.current, x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const change = e => { if (safari) { e.preventDefault(); apply(zoomAt(safari.view, safari.view.scale * e.scale, safari.x, safari.y)); } };
    const end = () => { safari = null; };
    const key = e => {
      if (editing(e.target) || !(e.metaKey || e.ctrlKey)) return;
      if (['+', '=', '-', '0'].includes(e.key)) {
        e.preventDefault();
        if (e.key === '0') apply({ x: 0, y: 0, scale: 1 });
        else zoom(e.key === '-' ? 0.8 : 1.25);
      }
    };
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('gesturestart', start, { passive: false });
    element.addEventListener('gesturechange', change, { passive: false });
    element.addEventListener('gestureend', end);
    element.addEventListener('keydown', key);
    return () => {
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('gesturestart', start);
      element.removeEventListener('gesturechange', change);
      element.removeEventListener('gestureend', end);
      element.removeEventListener('keydown', key);
    };
  }, []);

  return <View ref={viewport} testID="canvas-board" onLayout={measure} {...responders.board.panHandlers}
    onTouchStart={e => {
      // A child may own the first touch. Remember the initial pair before
      // the parent takes over on the first move (React Native Web).
      if (e.nativeEvent.touches.length < 2) return;
      const point = touchGeometry(e.nativeEvent.touches);
      if (gesture.current) gesture.current = { ...gesture.current, ...point, multi: true };
      else pendingGeometry.current = point;
    }}
    style={styles.viewport} tabIndex={Platform.OS === 'web' ? 0 : undefined} accessibilityLabel="Trading board">
    <View {...responders.background.panHandlers} style={styles.background} />
    <View testID="canvas-world" pointerEvents="box-none" style={[styles.world, { transform: [{ translateX: view.x }, { translateY: view.y }, { scale: view.scale }] }]}>
      {children(view.scale)}
    </View>
    <View style={styles.controls} testID="board-controls">
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom out" onPress={() => zoom(0.8)} style={styles.control}><Text style={styles.label}>−</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Reset canvas view" onPress={() => apply({ x: 0, y: 0, scale: 1 })} style={styles.control}><Text style={styles.label}>{Math.round(view.scale * 100)}%</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Zoom in" onPress={() => zoom(1.25)} style={styles.control}><Text style={styles.label}>+</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Gesture help" accessibilityState={{ expanded: help }} onPress={() => setHelp(!help)} style={styles.control}><Text style={styles.label}>?</Text></Pressable>
    </View>
    {help && <View pointerEvents="none" style={styles.help}><Text style={styles.helpText}>Drag empty space to pan. Pinch with two fingers to zoom. Double-tap empty space to zoom. Drag a card’s grip to move it. On Mac, scroll with two fingers to pan; pinch to zoom. Focus the board for ⌘ +/−/0.</Text></View>}
  </View>;
});

const styles = StyleSheet.create({
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#0e1218' },
  background: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, ...(Platform.OS === 'web' ? { touchAction: 'none' } : {}) },
  world: { position: 'absolute', left: 0, top: 0, width: 1, height: 1, overflow: 'visible', transformOrigin: '0px 0px' },
  controls: { position: 'absolute', alignSelf: 'center', bottom: 12, flexDirection: 'row', borderRadius: 12, backgroundColor: '#171c25', borderWidth: 1, borderColor: '#343c49' },
  control: { minWidth: 44, minHeight: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#d4dae4', fontSize: 14 },
  help: { position: 'absolute', bottom: 68, left: 12, right: 12, maxWidth: 440, alignSelf: 'center', borderRadius: 12, padding: 14, backgroundColor: '#171c25' },
  helpText: { color: '#bac3d0', fontSize: 12, lineHeight: 19 },
});

export default CanvasBoard;
