// overlay.js — Overlay pool + GPU-compositor renderer
// Overlays are pre-allocated divs attached to documentElement.
// Movement uses only CSS transform (translate) — no layout, no paint.
// backdrop-filter: blur() renders into OS screen captures natively.

const POOL_SIZE = 20;
const pool = [];
// activeOverlays: key (secretId+nodeKey) → { el, targetEl, secretId, nodeKey }
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
  el.style.cssText = `
    position: absolute;
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
 * Show or update an overlay for a given secret+node pair.
 * @param {string} secretId
 * @param {Node} targetNode - the DOM node containing the secret text
 * @param {Element} targetEl - the nearest positioned element to use for rect
 */
function showOverlay(secretId, targetNode, targetEl) {
  initPool();

  const nodeKey = getNodeKey(targetNode);
  const mapKey = `${secretId}::${nodeKey}`;

  let entry = activeOverlays.get(mapKey);
  if (!entry) {
    const overlayEl = pool.pop() ?? createOverlayEl();
    entry = { el: overlayEl, targetEl, secretId, nodeKey, mapKey };
    activeOverlays.set(mapKey, entry);
  } else {
    // Update target in case it moved
    entry.targetEl = targetEl;
  }

  positionOverlay(entry.el, targetEl);
}

function positionOverlay(overlayEl, targetEl) {
  const rect = targetEl.getBoundingClientRect();

  // Skip invisible elements
  if (rect.width === 0 && rect.height === 0) {
    overlayEl.style.display = 'none';
    return;
  }

  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  overlayEl.style.transform = `translate(${rect.left + scrollX}px, ${rect.top + scrollY}px)`;
  overlayEl.style.width = rect.width + 'px';
  overlayEl.style.height = rect.height + 'px';
  overlayEl.style.display = 'block';
}

/**
 * Reposition all active overlays. Called on scroll/resize.
 */
function repositionOverlays() {
  for (const entry of activeOverlays.values()) {
    if (!document.documentElement.contains(entry.targetEl)) {
      hideOverlay(entry.mapKey);
      continue;
    }
    positionOverlay(entry.el, entry.targetEl);
  }
}

/**
 * Remove all overlays associated with a secretId. Returns the overlay els
 * to the pool.
 */
function removeOverlaysForSecret(secretId) {
  for (const [key, entry] of activeOverlays) {
    if (entry.secretId === secretId) {
      returnToPool(entry.el);
      activeOverlays.delete(key);
    }
  }
}

/**
 * Remove a single overlay by mapKey.
 */
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

/**
 * Remove all overlays and reset state.
 */
function clearAllOverlays() {
  for (const entry of activeOverlays.values()) {
    returnToPool(entry.el);
  }
  activeOverlays.clear();
}

/**
 * Produce a stable key for a DOM node.
 */
function getNodeKey(node) {
  // For text nodes, use parent + child index
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
  showOverlay,
  repositionOverlays,
  removeOverlaysForSecret,
  clearAllOverlays,
};
