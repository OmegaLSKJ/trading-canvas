/* Pointer and trackpad navigation shared by the canvas and its frames. */
class CanvasInput {
  constructor(app) {
    this.app = app;
    this.isMac = /Mac|iPhone|iPad/.test(navigator.platform);
    this.touches = new Map();
    this.mode = 'auto';
    this.setup();
  }

  isEditing(target) {
    return !!target.closest('input, textarea, select, [contenteditable="true"]');
  }

  isCanvasTarget(target) {
    return !!target.closest('#bg-canvas, #canvas-world, #canvas-wires');
  }

  isControl(target) {
    return this.isEditing(target) || !!target.closest('button, a, .sticky-color-dot');
  }

  isBlank(target) {
    return target === this.app.canvas || target.classList.contains('canvas-section');
  }

  trackDrag(event, move, end, record = true) {
    this.finishDrag?.();
    const target = event.currentTarget;
    let moved = false;
    const onMove = e => {
      if (e.pointerId !== event.pointerId) return;
      moved ||= Math.hypot(e.clientX - event.clientX, e.clientY - event.clientY) > 3;
      move(e);
    };
    const finish = e => {
      if (e && e.pointerId !== event.pointerId) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      target?.removeEventListener('lostpointercapture', finish);
      this.finishDrag = null;
      if (moved && event.pointerType === 'touch') this.suppressClickUntil = Date.now() + 700;
      if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
      end?.();
      if (moved && record) this.app.pushHistory('Move or Resize Frame');
      this.app.updateMinimap();
      this.app.updateTransformInputs();
    };
    target?.setPointerCapture?.(event.pointerId);
    target?.addEventListener('lostpointercapture', finish);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    this.finishDrag = finish;
  }

  stopInteraction() {
    clearTimeout(this.holdTimer);
    this.finishDrag?.();
    this.app.isDraggingCanvas = false;
    this.app.isSelectingMarquee = false;
    this.app.selectionBox.style.display = 'none';
    this.app.canvas.classList.remove('panning-active', 'panning');
    document.body.classList.remove('panning-cursor');
    if (this.app.activeWireDrag) this.app.endWireDrag({ clientX: NaN, clientY: NaN });
  }

  reset() {
    this.stopInteraction();
    this.app.isSpacePressed = false;
    this.touches.clear();
    this.pinch = null;
    this.multiTouch = false;
    this.safariGesture = null;
    this.lastTap = null;
  }

  touchPair() {
    const [a, b] = [...this.touches.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)) };
  }

  setup() {
    const app = this.app;
    document.querySelectorAll('[title]').forEach(el => {
      if (this.isMac) el.title = el.title.replace('Ctrl+Y', '⌘⇧Z').replaceAll('Ctrl', '⌘').replaceAll('Alt', '⌥');
    });
    document.querySelectorAll('[data-canvas-mode]').forEach(button => {
      button.addEventListener('click', () => {
        this.mode = button.dataset.canvasMode;
        document.querySelectorAll('[data-canvas-mode]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      });
    });

    window.addEventListener('pointerdown', e => {
      if (!this.isCanvasTarget(e.target) || !app.stockModalOverlay.classList.contains('hidden')) return;
      if (e.pointerType === 'touch') {
        this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, time: Date.now(), target: e.target });
        if (this.touches.size >= 2) {
          this.stopInteraction();
          this.multiTouch = true;
          this.pinch = this.touchPair();
          this.lastTap = null;
          this.suppressClickUntil = Date.now() + 700;
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
      }
      if (this.isControl(e.target) || e.button !== 0 || (this.isMac && e.ctrlKey)) return;
      const blank = this.isBlank(e.target);
      const touchPan = e.pointerType === 'touch' && blank && this.mode !== 'select';
      if (blank && this.mode === 'select' && !app.isSpacePressed) {
        app.isSelectingMarquee = true;
        app.marqueeStart = { x: e.clientX, y: e.clientY };
        app.marqueePreservedSelection = e.shiftKey ? new Set(app.selectedFrames) : new Set();
        if (!e.shiftKey) app.deselectAll();
        app.updateMarqueeBox(e.clientX, e.clientY);
        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (app.isSpacePressed || this.mode === 'pan' || touchPan) {
        app.isDraggingCanvas = true;
        app.dragStart = { x: e.clientX, y: e.clientY };
        document.body.classList.add('panning-cursor');
        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (e.pointerType === 'touch' && !blank) {
        const frame = [...app.stockCharts, ...app.pineNodes, ...app.sections, ...app.notes].find(f => f.element.contains(e.target));
        const previous = [...app.selectedFrames];
        this.holdTimer = setTimeout(() => {
          this.stopInteraction();
          previous.forEach(f => app.addToSelection(f));
          if (frame) app.addToSelection(frame);
          this.suppressClickUntil = Date.now() + 700;
          app.showToast('Added to selection');
        }, 550);
      }
    }, { capture: true, passive: false });

    window.addEventListener('pointermove', e => {
      const touch = this.touches.get(e.pointerId);
      if (!touch) return;
      touch.x = e.clientX;
      touch.y = e.clientY;
      if (Math.hypot(touch.x - touch.startX, touch.y - touch.startY) > 8) clearTimeout(this.holdTimer);
      if (!this.multiTouch) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (this.touches.size < 2) return;
      const next = this.touchPair();
      app.setZoomAtPoint(app.zoom * next.distance / this.pinch.distance, this.pinch.x, this.pinch.y);
      app.pan.x += next.x - this.pinch.x;
      app.pan.y += next.y - this.pinch.y;
      this.pinch = next;
      app.updateTransform();
      app.requestRender();
    }, { capture: true, passive: false });

    const release = e => {
      clearTimeout(this.holdTimer);
      const touch = this.touches.get(e.pointerId);
      if (touch && !this.multiTouch && e.type === 'pointerup' && this.isBlank(touch.target) && Date.now() - touch.time < 300 && Math.hypot(e.clientX - touch.startX, e.clientY - touch.startY) < 8) {
        if (this.lastTap && Date.now() - this.lastTap.time < 350 && Math.hypot(e.clientX - this.lastTap.x, e.clientY - this.lastTap.y) < 30) {
          app.setZoomAtPoint(app.zoom < 1 ? 1 : 0.72, e.clientX, e.clientY);
          this.lastTap = null;
        } else {
          app.deselectAll();
          this.lastTap = { x: e.clientX, y: e.clientY, time: Date.now() };
        }
      }
      this.touches.delete(e.pointerId);
      if (this.multiTouch) {
        this.suppressClickUntil = Date.now() + 700;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (this.touches.size >= 2) this.pinch = this.touchPair();
        if (!this.touches.size) { this.multiTouch = false; this.pinch = null; }
      }
      if (e.type === 'pointercancel') this.stopInteraction();
    };
    window.addEventListener('pointerup', release, { capture: true, passive: false });
    window.addEventListener('pointercancel', release, { capture: true, passive: false });
    window.addEventListener('click', e => {
      if (Date.now() < (this.suppressClickUntil || 0) && this.isCanvasTarget(e.target)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }, true);

    window.addEventListener('wheel', e => {
      if (!this.isCanvasTarget(e.target) || !app.stockModalOverlay.classList.contains('hidden') || this.isEditing(e.target)) return;
      e.preventDefault();
      if (this.safariGesture || this.multiTouch || this.finishDrag) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? app.height : 1;
      if (e.ctrlKey || e.metaKey) {
        app.setZoomAtPoint(app.zoom * Math.exp(-e.deltaY * unit * 0.01), e.clientX, e.clientY);
      } else {
        app.pan.x -= (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * unit;
        app.pan.y -= (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * unit;
        app.updateTransform();
        app.requestRender();
      }
    }, { passive: false });

    // Safari's trackpad uses GestureEvents instead of ctrl+wheel.
    window.addEventListener('gesturestart', e => {
      if (!this.isCanvasTarget(e.target) || this.isEditing(e.target) || !app.stockModalOverlay.classList.contains('hidden')) return;
      e.preventDefault();
      if (this.touches.size || this.finishDrag) return;
      this.safariGesture = { zoom: app.zoom, x: e.clientX ?? app.width / 2, y: e.clientY ?? app.height / 2 };
    }, { passive: false });
    window.addEventListener('gesturechange', e => {
      if (!this.safariGesture) return;
      e.preventDefault();
      const start = this.safariGesture;
      app.setZoomAtPoint(start.zoom * e.scale, start.x, start.y);
    }, { passive: false });
    window.addEventListener('gestureend', e => {
      if (this.safariGesture) e.preventDefault();
      this.safariGesture = null;
    }, { passive: false });
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
  }
}
