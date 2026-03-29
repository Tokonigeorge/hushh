// overlay.js — Overlay renderer
//
// TEXT nodes: inject a <span data-hushh-blur> with filter:blur() around the
//   matched text. Moves with content — zero scroll lag.
//
// INPUT / TEXTAREA: position:fixed overlay div (can't inject into input values).

// ─── Span injection (text nodes) ──────────────────────────────────────────

const spansForSecret = new Map(); // secretId → Set<span>

function injectTextBlur(textNode, matchStart, matchLen, secretId) {
  const parent = textNode.parentElement;
  if (!parent) return;
  if (parent.hasAttribute('data-hushh-blur'))    return;
  if (parent.hasAttribute('data-hushh-overlay')) return;

  const textLen = textNode.textContent.length;
  const start   = Math.min(matchStart, textLen);
  const end     = Math.min(matchStart + matchLen, textLen);
  if (start >= end) return;

  const range = document.createRange();
  range.setStart(textNode, start);
  range.setEnd(textNode, end);

  const span = document.createElement('span');
  span.setAttribute('data-hushh-blur', secretId);
  span.style.cssText = `
    filter: blur(6px);
    -webkit-filter: blur(6px);
    border-radius: 3px;
    display: inline-block;
    user-select: none;
    pointer-events: none;
  `;

  try {
    range.surroundContents(span);
  } catch {
    return;
  }

  if (!spansForSecret.has(secretId)) spansForSecret.set(secretId, new Set());
  spansForSecret.get(secretId).add(span);
}

function removeTextBlursForSecret(secretId) {
  const spans = spansForSecret.get(secretId);
  if (!spans) return;
  for (const span of spans) {
    if (span.parentNode) span.replaceWith(...span.childNodes);
  }
  spansForSecret.delete(secretId);
}

function clearAllTextBlurs() {
  for (const id of spansForSecret.keys()) removeTextBlursForSecret(id);
}

// ─── Pool overlays (inputs / textareas) ───────────────────────────────────

const POOL_SIZE = 20;
const pool = [];
const activeOverlays = new Map();
let poolInitialized = false;

function initPool() {
  if (poolInitialized) return;
  poolInitialized = true;
  for (let i = 0; i < POOL_SIZE; i++) pool.push(createOverlayEl());
}

function createOverlayEl() {
  const el = document.createElement('div');
  el.setAttribute('data-hushh-overlay', '');
  el.style.cssText = `
    position: fixed;
    pointer-events: none;
    z-index: 2147483647;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    background: rgba(200, 200, 200, 0.25);
    border-radius: 4px;
    will-change: transform;
    transform-origin: top left;
    top: 0; left: 0;
    display: none;
  `;
  document.documentElement.appendChild(el);
  return el;
}

function showElementOverlay(secretId, targetEl) {
  initPool();
  const key = `${secretId}::${getElKey(targetEl)}`;
  let entry = activeOverlays.get(key);
  if (!entry) {
    const overlayEl = pool.pop() ?? createOverlayEl();
    entry = { el: overlayEl, secretId, mapKey: key, source: { el: targetEl } };
    activeOverlays.set(key, entry);
  }
  positionFromEl(entry.el, targetEl);
}

function positionFromEl(overlayEl, targetEl) {
  const rect = targetEl.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) { overlayEl.style.display = 'none'; return; }
  overlayEl.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
  overlayEl.style.width     = rect.width  + 'px';
  overlayEl.style.height    = rect.height + 'px';
  overlayEl.style.display   = 'block';
}

function repositionOverlays() {
  for (const entry of activeOverlays.values()) {
    if (!document.documentElement.contains(entry.source.el)) {
      returnToPool(entry.el);
      activeOverlays.delete(entry.mapKey);
      continue;
    }
    positionFromEl(entry.el, entry.source.el);
  }
}

function removeOverlaysForSecret(secretId) {
  removeTextBlursForSecret(secretId);
  for (const [key, entry] of activeOverlays) {
    if (entry.secretId === secretId) { returnToPool(entry.el); activeOverlays.delete(key); }
  }
}

function clearAllOverlays() {
  clearAllTextBlurs();
  for (const entry of activeOverlays.values()) returnToPool(entry.el);
  activeOverlays.clear();
}

function returnToPool(el) { el.style.display = 'none'; pool.push(el); }

function getElKey(el) {
  if (!el._hushhKey) el._hushhKey = `el-${Math.random().toString(36).slice(2)}`;
  return el._hushhKey;
}

export { initPool, injectTextBlur, showElementOverlay, repositionOverlays, removeOverlaysForSecret, clearAllOverlays };
