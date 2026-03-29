// scanner.js — Text scanning logic
// Only scans TEXT nodes and input/textarea elements directly.

import { getSecrets } from './extractor.js';
import { showTextOverlay, showElementOverlay } from './overlay.js';

/**
 * Scan a single text node against all registered secrets.
 * Uses a DOM Range to get exact word bounds — not the whole parent element.
 */
function scanTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return;
  if (parent.hasAttribute('data-hushh-overlay')) return;
  if (parent.hasAttribute('data-hushh-ui')) return;
  if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;

  const text = node.textContent;
  if (!text?.trim()) return;

  const lower = text.toLowerCase();
  for (const secret of getSecrets()) {
    let searchFrom = 0;
    // Find all occurrences of the secret within this text node
    while (true) {
      const idx = lower.indexOf(secret.matchValue, searchFrom);
      if (idx === -1) break;
      showTextOverlay(secret.id, node, idx, secret.matchValue.length);
      searchFrom = idx + secret.matchValue.length;
    }
  }
}

/**
 * Scan an input or textarea element.
 * Blurs the whole element (no partial match possible on an opaque field).
 */
function scanInputEl(el) {
  if (el.hasAttribute('data-hushh-overlay')) return;
  if (el.hasAttribute('data-hushh-ui')) return;

  const text = ((el.value ?? '') + ' ' + (el.placeholder ?? '')).toLowerCase();
  if (!text.trim()) return;

  for (const secret of getSecrets()) {
    if (text.includes(secret.matchValue)) {
      showElementOverlay(secret.id, el);
    }
  }
}

/**
 * Scan a node from the dirty-nodes set (called every rAF flush).
 */
function scanNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    scanTextNode(node);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      scanInputEl(node);
    }
    // For other element nodes added to dirty set, scan their text node children
    else {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let child;
      while ((child = walker.nextNode())) scanTextNode(child);
      for (const input of node.querySelectorAll('input, textarea')) scanInputEl(input);
    }
  }
}

/**
 * Scan a set of dirty nodes (called from the rAF batcher).
 */
function scanDirtyNodes(dirtyNodes) {
  if (getSecrets().length === 0) { dirtyNodes.clear(); return; }
  for (const node of dirtyNodes) scanNode(node);
  dirtyNodes.clear();
}

/**
 * Full document scan — called once when a new secret is first registered.
 */
function scanFullDocument() {
  if (getSecrets().length === 0) return;

  const textWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.hasAttribute('data-hushh-overlay')) return NodeFilter.FILTER_REJECT;
        if (p.hasAttribute('data-hushh-ui'))      return NodeFilter.FILTER_REJECT;
        if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node;
  while ((node = textWalker.nextNode())) scanTextNode(node);
  for (const el of document.body.querySelectorAll('input, textarea')) scanInputEl(el);
}

export { scanNode, scanDirtyNodes, scanFullDocument };
