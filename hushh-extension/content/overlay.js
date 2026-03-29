// overlay.js — Overlay pool + GPU-compositor renderer
// Overlays are pre-allocated divs attached to documentElement.
// Movement uses only CSS transform (translate) — no layout, no paint.
// backdrop-filter: blur() renders into OS screen captures natively.
//
// Two positioning modes:
//   - Text node match: use a DOM Range to get exact word bounds (precise)
//   - Input/element match: use the element's bounding rect (whole field)

const POOL_SIZE = 20;
const pool = [];
// activeOverlays: mapKey → { el, secretId, nodeKey, source }
// source is either { type: 'range', textNode, start, length }
//               or { type: 'element', el: targetEl }
const activeOverlays = new Map();

let poolInitialized = false;

function initPool() {
  if (poolInitialized) return;
  poolInitialized = true;
  for (let i = 0; i < POOL_SIZE; i++) {
    pool.push(createOverlayEl());
  }
}

function createOverlayEl() {
  const el = document.createElement('div');
  el.setAttribute('data-hushh-overlay', '');
  // position: fixed — viewport-relative, works with SPA custom scroll containers
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
    top: 0;
    left: 0;
    display: none;
  `;
  document.documentElement.appendChild(el);
  return el;
}

/**
 * Show an overlay for a TEXT NODE match — blurs only the matched word(s),
 * not the whole parent element.
 *
 * @param {string}  secretId
 * @param {Text}    textNode   - the text node containing the match
 * @param {number}  matchStart - char index in textNode.textContent where match begins
 * @param {number}  matchLen   - length of the matched string
 */
function showTextOverlay(secretId, textNode, matchStart, matchLen) {
  initPool();
  const nodeKey = getNodeKey(textNode) + `::${matchStart}`;
  const mapKey  = `${secretId}::${nodeKey}`;

  let entry = activeOverlays.get(mapKey);
  if (!entry) {
    const overlayEl = pool.pop() ?? createOverlayEl();
    entry = { el: overlayEl, secretId, nodeKey, mapKey,
              source: { type: 'range', textNode, start: matchStart, length: matchLen } };
    activeOverlays.set(mapKey, entry);
  }

  positionFromSource(entry.el, entry.source);
}

/**
 * Show an overlay for an INPUT or TEXTAREA — blurs the whole element.
 */
function showElementOverlay(secretId, targetEl) {
  initPool();
  const nodeKey = getElKey(targetEl);
  const mapKey  = `${secretId}::${nodeKey}`;

  let entry = activeOverlays.get(mapKey);
  if (!entry) {
    const overlayEl = pool.pop() ?? createOverlayEl();
    entry = { el: overlayEl, secretId, nodeKey, mapKey,
              source: { type: 'element', el: targetEl } };
    activeOverlays.set(mapKey, entry);
  }

  positionFromSource(entry.el, entry.source);
}

function positionFromSource(overlayEl, source) {
  let rect;

  if (source.type === 'range') {
    // Check text node is still in the document
    if (!source.textNode.parentElement ||
        !document.documentElement.contains(source.textNode.parentElement)) {
      overlayEl.style.display = 'none';
      return;
    }
    // Clamp indices to actual text length (text may have changed)
    const textLen = source.textNode.textContent.length;
    const start   = Math.min(source.start, textLen);
    const end     = Math.min(source.start + source.length, textLen);
    if (start >= end) { overlayEl.style.display = 'none'; return; }

    const range = document.createRange();
    range.setStart(source.textNode, start);
    range.setEnd(source.textNode, end);
    rect = range.getBoundingClientRect();
  } else {
    if (!document.documentElement.contains(source.el)) {
      overlayEl.style.display = 'none';
      return;
    }
    rect = source.el.getBoundingClientRect();
  }

  if (rect.width === 0 && rect.height === 0) {
    overlayEl.style.display = 'none';
    return;
  }

  // position:fixed — rect is already in viewport coordinates
  overlayEl.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
  overlayEl.style.width     = rect.width  + 'px';
  overlayEl.style.height    = rect.height + 'px';
  overlayEl.style.display   = 'block';
}

/**
 * Reposition all active overlays. Called on scroll/resize.
 */
function repositionOverlays() {
  for (const entry of activeOverlays.values()) {
    positionFromSource(entry.el, entry.source);
  }
}

/**
 * Remove all overlays for a secretId.
 */
function removeOverlaysForSecret(secretId) {
  for (const [key, entry] of activeOverlays) {
    if (entry.secretId === secretId) {
      returnToPool(entry.el);
      activeOverlays.delete(key);
    }
  }
}

function hideOverlay(mapKey) {
  const entry = activeOverlays.get(mapKey);
  if (!entry) return;
  returnToPool(entry.el);
  activeOverlays.delete(mapKey);
}

function returnToPool(el) {
  el.style.display = 'none';
  pool.push(el);
}

function clearAllOverlays() {
  for (const entry of activeOverlays.values()) {
    returnToPool(entry.el);
  }
  activeOverlays.clear();
}

function getNodeKey(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent) return String(Math.random());
    const idx = Array.from(parent.childNodes).indexOf(node);
    return `txt::${getElKey(parent)}::${idx}`;
  }
  return getElKey(node);
}

function getElKey(el) {
  if (!el._hushhKey) {
    el._hushhKey = `el-${Math.random().toString(36).slice(2)}`;
  }
  return el._hushhKey;
}

export {
  initPool,
  showTextOverlay,
  showElementOverlay,
  repositionOverlays,
  removeOverlaysForSecret,
  clearAllOverlays,
};
