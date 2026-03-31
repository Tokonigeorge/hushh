import { addSecret, addRawSecret, extractValue } from './extractor.js';
import { scanFullDocument } from './scanner.js';
import { startObserver } from './observer.js';

let selectionActive = false;
let hoveredEl  = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragRect   = null;

let banner      = null;
let tooltip     = null;
let dragOverlay = null;

const HUSHH_HOVER_CLASS = 'hushh-hover-outline';
let hoverStyle = null;

let onSecretAdded  = null;
let onSelectionEnd = null;

function init(callbacks = {}) {
  onSecretAdded  = callbacks.onSecretAdded  ?? null;
  onSelectionEnd = callbacks.onSelectionEnd ?? null;
}

function isSelectionActive() { return selectionActive; }

function enterSelectionMode() {
  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    const raw = sel.toString().trim();
    if (raw.length >= 3) {
      const id = addRawSecret(raw, 'text');
      if (id) {
        startObserver();
        scanFullDocument();
        onSecretAdded?.(id);
        sel.removeAllRanges();
        return;
      }
    }
  }

  if (selectionActive) return;
  selectionActive = true;

  document.body.style.cursor = 'crosshair';
  showBanner();

  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout',  onMouseOut);
  document.addEventListener('click',     onClick, { capture: true });
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('keydown',   onKeyDown);
}

function exitSelectionMode() {
  if (!selectionActive) return;
  selectionActive = false;

  document.body.style.cursor = '';
  hideBanner();
  clearAllHovers();
  hideTooltip();
  cleanupDrag();

  document.removeEventListener('mouseover', onMouseOver);
  document.removeEventListener('mouseout',  onMouseOut);
  document.removeEventListener('click',     onClick, { capture: true });
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('keydown',   onKeyDown);

  onSelectionEnd?.();
}

function ensureHoverStyle() {
  if (hoverStyle) return;
  hoverStyle = document.createElement('style');
  hoverStyle.setAttribute('data-hushh-ui', '');
  hoverStyle.textContent = `.${HUSHH_HOVER_CLASS} { outline: 2px dashed rgba(127, 119, 221, 0.7) !important; }`;
  document.documentElement.appendChild(hoverStyle);
}

function onMouseOver(e) {
  const target = findMeaningfulElement(e.target);
  if (!target || isHushhElement(target)) return;

  if (hoveredEl && hoveredEl !== target) clearHover();
  hoveredEl = target;
  ensureHoverStyle();
  hoveredEl.classList.add(HUSHH_HOVER_CLASS);

  showTooltip(target, e.clientX, e.clientY);
}

function onMouseOut(e) {
  if (!hoveredEl) return;
  if (!hoveredEl.contains(e.relatedTarget)) {
    clearHover();
    hideTooltip();
  }
}

function clearHover() {
  if (!hoveredEl) return;
  hoveredEl.classList.remove(HUSHH_HOVER_CLASS);
  hoveredEl = null;
}

function clearAllHovers() {
  document.querySelectorAll(`.${HUSHH_HOVER_CLASS}`).forEach(el => el.classList.remove(HUSHH_HOVER_CLASS));
  hoveredEl = null;
}

function showTooltip(el, x, y) {
  ensureTooltip();
  const value   = extractValue(el);
  const preview = value.slice(0, 24) + (value.length > 24 ? '…' : '');
  tooltip.textContent = preview ? `"${preview}" — click to protect` : 'click to protect';
  tooltip.style.left    = `${x + 12}px`;
  tooltip.style.top     = `${y + 12}px`;
  tooltip.style.display = 'block';
}

function hideTooltip() {
  if (tooltip) tooltip.style.display = 'none';
}

function ensureTooltip() {
  if (tooltip) return;
  tooltip = document.createElement('div');
  tooltip.setAttribute('data-hushh-ui', '');
  tooltip.style.cssText = `
    position: fixed;
    z-index: 2147483646;
    background: rgba(26, 26, 46, 0.9);
    color: #fff;
    font: 12px/1.4 -apple-system, system-ui, sans-serif;
    padding: 5px 10px;
    border-radius: 6px;
    pointer-events: none;
    max-width: 260px;
    white-space: nowrap;
    display: none;
  `;
  document.documentElement.appendChild(tooltip);
}

function onClick(e) {
  if (isDragging) return;
  if (isHushhElement(e.target)) return;

  e.preventDefault();
  e.stopPropagation();

  const textNode = getTextNodeAtPoint(e.clientX, e.clientY);
  let id = null;

  if (textNode) {
    const raw = textNode.textContent?.trim() ?? '';
    if (raw.length >= 3) id = addRawSecret(raw, 'text');
  }

  if (!id) {
    const target = findMeaningfulElement(e.target) ?? e.target;
    id = addSecret(target, false);
  }

  if (id) {
    startObserver();
    scanFullDocument();
    onSecretAdded?.(id);
  }
}

// caretPositionFromPoint: Chrome 128+, Firefox. caretRangeFromPoint: older Chrome/Edge
function getTextNodeAtPoint(x, y) {
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos?.offsetNode?.nodeType === Node.TEXT_NODE) return pos.offsetNode;
  }
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range?.startContainer?.nodeType === Node.TEXT_NODE) return range.startContainer;
  }
  return null;
}

function onMouseDown(e) {
  if (isHushhElement(e.target)) return;

  const target = findMeaningfulElement(e.target);

  // Without this, inputs get focused on mousedown before we can intercept the click
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    e.preventDefault();
    return;
  }

  const forceDrawMode = e.shiftKey;
  if (!forceDrawMode && target && extractValue(target).trim().length > 0) return;

  isDragging = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp, { once: true });
}

function onMouseMove(e) {
  const dx = Math.abs(e.clientX - dragStartX);
  const dy = Math.abs(e.clientY - dragStartY);
  if (dx < 4 && dy < 4) return;

  isDragging = true;
  ensureDragOverlay();

  const x = Math.min(e.clientX, dragStartX);
  const y = Math.min(e.clientY, dragStartY);
  const w = Math.abs(e.clientX - dragStartX);
  const h = Math.abs(e.clientY - dragStartY);

  dragOverlay.style.left    = `${x}px`;
  dragOverlay.style.top     = `${y}px`;
  dragOverlay.style.width   = `${w}px`;
  dragOverlay.style.height  = `${h}px`;
  dragOverlay.style.display = 'block';

  dragRect = { x, y, w, h };
}

function onMouseUp() {
  document.removeEventListener('mousemove', onMouseMove);
  if (!isDragging || !dragRect) { cleanupDrag(); return; }

  const { x, y, w, h } = dragRect;
  const intersecting = [];

  for (const el of document.querySelectorAll('*')) {
    if (isHushhElement(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rectsIntersect(rect, { left: x, top: y, right: x + w, bottom: y + h })) {
      const text = extractValue(el).trim();
      if (text.length >= 3) intersecting.push(text);
    }
  }

  const merged = [...new Set(intersecting)].join(' ');
  if (merged.length >= 3) {
    const id = addRawSecret(merged, 'region');
    if (id) {
      startObserver();
      scanFullDocument();
      onSecretAdded?.(id);
    }
  }

  cleanupDrag();
  exitSelectionMode();
}

function cleanupDrag() {
  isDragging = false;
  dragRect   = null;
  if (dragOverlay) dragOverlay.style.display = 'none';
}

function ensureDragOverlay() {
  if (dragOverlay) return;
  dragOverlay = document.createElement('div');
  dragOverlay.setAttribute('data-hushh-ui', '');
  dragOverlay.style.cssText = `
    position: fixed;
    z-index: 2147483645;
    background: rgba(127, 119, 221, 0.15);
    border: 2px dashed rgba(127, 119, 221, 0.6);
    border-radius: 4px;
    pointer-events: none;
    display: none;
  `;
  document.documentElement.appendChild(dragOverlay);
}

function rectsIntersect(a, b) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function showBanner() {
  if (banner) { banner.style.display = 'flex'; return; }
  banner = document.createElement('div');
  banner.setAttribute('data-hushh-ui', '');
  banner.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 2147483647;
    background: rgba(127, 119, 221, 0.95);
    color: #fff;
    font: 13px/1 -apple-system, system-ui, sans-serif;
    letter-spacing: 0.01em;
    padding: 8px 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  `;

  const label = document.createElement('span');
  label.style.pointerEvents = 'none';
  label.textContent = 'Hushh active: click anything to protect it';

  const doneBtn = document.createElement('button');
  doneBtn.setAttribute('data-hushh-ui', '');
  doneBtn.textContent = 'Done';
  doneBtn.style.cssText = `
    background: #fff;
    color: rgba(127, 119, 221, 1);
    border: none;
    border-radius: 4px;
    padding: 4px 14px;
    font: 600 12px/1 -apple-system, system-ui, sans-serif;
    cursor: pointer;
    pointer-events: auto;
  `;
  doneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exitSelectionMode();
  });

  banner.append(label, doneBtn);
  document.documentElement.appendChild(banner);
}

function hideBanner() {
  if (banner) banner.style.display = 'none';
  document.body.style.cursor = '';
}

function onKeyDown(e) {
  if (e.key === 'Escape') exitSelectionMode();
}

function findMeaningfulElement(el) {
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    if (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA') return current;
    if (current.textContent?.trim().length >= 1) return current;
    current = current.parentElement;
  }
  return el?.tagName !== 'BODY' && el?.tagName !== 'HTML' ? el : null;
}

function isHushhElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  return el.hasAttribute('data-hushh-overlay') || el.hasAttribute('data-hushh-ui');
}

export { init, enterSelectionMode, exitSelectionMode, isSelectionActive };
