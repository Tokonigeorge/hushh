// selector.js — UX input layer
// Manages selection mode: hover highlighting, click-to-lock, draw-to-region.

import { addSecret, addRawSecret, extractValue } from './extractor.js';
import { scanFullDocument } from './scanner.js';
import { startObserver } from './observer.js';

let selectionActive = false;
let hoveredEl = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragRect = null;

// UI elements injected during selection mode
let banner = null;
let tooltip = null;
let dragOverlay = null;

const HUSHH_OUTLINE = '2px dashed rgba(127, 119, 221, 0.7)';
const HUSHH_OUTLINE_SAVED = '2px solid rgba(127, 119, 221, 0.9)';

// Callbacks to notify index.js of state changes
let onSecretAdded = null;
let onSelectionEnd = null;

function init(callbacks = {}) {
  onSecretAdded = callbacks.onSecretAdded ?? null;
  onSelectionEnd = callbacks.onSelectionEnd ?? null;
}

function isSelectionActive() {
  return selectionActive;
}

function enterSelectionMode() {
  if (selectionActive) return;
  selectionActive = true;

  document.body.style.cursor = 'crosshair';
  showBanner();

  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('mouseout', onMouseOut);
  document.addEventListener('click', onClick, { capture: true });
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('keydown', onKeyDown);
}

function exitSelectionMode() {
  if (!selectionActive) return;
  selectionActive = false;

  document.body.style.cursor = '';
  hideBanner();
  clearHover();
  hideTooltip();
  cleanupDrag();

  document.removeEventListener('mouseover', onMouseOver);
  document.removeEventListener('mouseout', onMouseOut);
  document.removeEventListener('click', onClick, { capture: true });
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('keydown', onKeyDown);

  onSelectionEnd?.();
}

// ─── Hover highlight ───────────────────────────────────────────────────────

function onMouseOver(e) {
  const target = findMeaningfulElement(e.target);
  if (!target || isHushhElement(target)) return;

  if (hoveredEl && hoveredEl !== target) {
    clearHover();
  }
  hoveredEl = target;
  hoveredEl._hushhPrevOutline = hoveredEl.style.outline;
  hoveredEl.style.outline = HUSHH_OUTLINE;

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
  hoveredEl.style.outline = hoveredEl._hushhPrevOutline ?? '';
  hoveredEl._hushhPrevOutline = undefined;
  hoveredEl = null;
}

// ─── Tooltip ───────────────────────────────────────────────────────────────

function showTooltip(el, x, y) {
  ensureTooltip();
  const value = extractValue(el);
  const preview = value.slice(0, 24) + (value.length > 24 ? '…' : '');
  tooltip.textContent = preview
    ? `"${preview}" — click to protect`
    : 'click to protect';

  tooltip.style.left = `${x + 12}px`;
  tooltip.style.top = `${y + 12}px`;
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

// ─── Click to lock ─────────────────────────────────────────────────────────

function onClick(e) {
  if (isDragging) return; // drag supersedes click
  if (isHushhElement(e.target)) return;

  e.preventDefault();
  e.stopPropagation();

  const target = findMeaningfulElement(e.target) ?? e.target;
  const id = addSecret(target);

  if (id) {
    flashConfirm(target);
    startObserver();
    scanFullDocument();
    onSecretAdded?.(id);
  }

  exitSelectionMode();
}

function flashConfirm(el) {
  el.style.outline = HUSHH_OUTLINE_SAVED;
  setTimeout(() => {
    el.style.outline = el._hushhPrevOutline ?? '';
  }, 800);
}

// ─── Draw to region ────────────────────────────────────────────────────────

function onMouseDown(e) {
  // Only start a draw if clicking on a blank/non-meaningful area
  const target = findMeaningfulElement(e.target);
  if (target && extractValue(target).trim().length > 0) return; // let click handle it
  if (isHushhElement(e.target)) return;

  isDragging = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp, { once: true });
}

function onMouseMove(e) {
  const dx = Math.abs(e.clientX - dragStartX);
  const dy = Math.abs(e.clientY - dragStartY);
  if (dx < 4 && dy < 4) return; // threshold before treating as drag

  isDragging = true;
  ensureDragOverlay();

  const x = Math.min(e.clientX, dragStartX);
  const y = Math.min(e.clientY, dragStartY);
  const w = Math.abs(e.clientX - dragStartX);
  const h = Math.abs(e.clientY - dragStartY);

  dragOverlay.style.left = `${x}px`;
  dragOverlay.style.top = `${y}px`;
  dragOverlay.style.width = `${w}px`;
  dragOverlay.style.height = `${h}px`;
  dragOverlay.style.display = 'block';

  dragRect = { x, y, w, h };
}

function onMouseUp(e) {
  document.removeEventListener('mousemove', onMouseMove);

  if (!isDragging || !dragRect) {
    cleanupDrag();
    return;
  }

  // Collect all elements within the drawn rectangle
  const { x, y, w, h } = dragRect;
  const elements = document.elementsFromPoint(x + w / 2, y + h / 2);
  const intersecting = [];

  // Walk the full DOM looking for elements that intersect the drag rect
  const allEls = document.querySelectorAll('*');
  for (const el of allEls) {
    if (isHushhElement(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rectsIntersect(rect, { left: x, top: y, right: x + w, bottom: y + h })) {
      const text = extractValue(el).trim();
      if (text.length >= 3) {
        intersecting.push(text);
      }
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
  dragRect = null;
  if (dragOverlay) {
    dragOverlay.style.display = 'none';
  }
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

// ─── Banner ────────────────────────────────────────────────────────────────

function showBanner() {
  if (banner) {
    banner.style.display = 'block';
    return;
  }
  banner = document.createElement('div');
  banner.setAttribute('data-hushh-ui', '');
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2147483647;
    background: rgba(127, 119, 221, 0.95);
    color: #fff;
    font: 13px/1 -apple-system, system-ui, sans-serif;
    letter-spacing: 0.01em;
    padding: 8px 16px;
    text-align: center;
    pointer-events: none;
  `;
  const mod = isMac() ? 'Option' : 'Alt';
  banner.textContent = `Hushh active — click or draw to protect  ·  Esc to cancel  ·  ${mod}+Shift+X to clear all`;
  document.documentElement.appendChild(banner);
}

function hideBanner() {
  if (banner) banner.style.display = 'none';
}

// ─── Keyboard ──────────────────────────────────────────────────────────────

function onKeyDown(e) {
  if (e.key === 'Escape') {
    exitSelectionMode();
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Walk up the DOM tree to find the nearest "meaningful" element —
 * one with non-empty textContent or a value, not body/html/bare divs.
 */
function findMeaningfulElement(el) {
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    if (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA') return current;
    const text = current.textContent?.trim();
    if (text && text.length >= 1) return current;
    current = current.parentElement;
  }
  return el?.tagName !== 'BODY' && el?.tagName !== 'HTML' ? el : null;
}

function isMac() {
  return navigator.platform.toUpperCase().includes('MAC');
}

function isHushhElement(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  return el.hasAttribute('data-hushh-overlay') || el.hasAttribute('data-hushh-ui');
}

export { init, enterSelectionMode, exitSelectionMode, isSelectionActive };
