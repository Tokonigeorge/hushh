// scanner.js — Text scanning logic
// Only scans TEXT nodes and input/textarea elements directly.


import { getSecrets } from './extractor.js';
import { showOverlay } from './overlay.js';

/**
 * Get the text to match against for a given node.
 * Returns null if this node type shouldn't be scanned.
 */
function getMatchText(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.tagName;
    // Only check inputs/textareas directly 
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      return (node.value ?? '') + ' ' + (node.placeholder ?? '');
    }
  }
  return null; // skip everything else
}

/**
 * For a text node, walk up from the immediate parent until we find an element
 * with real rendered dimensions that isn't too large (not a full-page container).
 * For an input/textarea, use the element itself.
 */
function getOverlayTarget(node) {
  const start = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!start) return null;

  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  let current = start;
  while (current && current !== document.body && current !== document.documentElement) {
    const rect = current.getBoundingClientRect();
    const hasSize = rect.width > 0 && rect.height > 0;
    // Stop if we've found a reasonably-sized element that doesn't span the whole viewport
    const notFullPage = rect.width < viewW * 0.95 || rect.height < viewH * 0.8;
    if (hasSize && notFullPage) return current;
    current = current.parentElement;
  }

  // Fall back to start even if dimensions are odd
  return start;
}

/**
 * Scan a single node against all registered secrets.
 */
function scanNode(node) {
  if (node.nodeType === Node.ELEMENT_NODE) {
    if (node.hasAttribute?.('data-hushh-overlay')) return;
    if (node.hasAttribute?.('data-hushh-ui')) return;
  }

  const text = getMatchText(node);
  if (text === null || text.trim() === '') return;

  const secrets = getSecrets();
  if (secrets.length === 0) return;

  const lower = text.toLowerCase();
  for (const secret of secrets) {
    if (lower.includes(secret.matchValue)) {
      const target = getOverlayTarget(node);
      if (target && target !== document.body && target !== document.documentElement) {
        showOverlay(secret.id, node, target);
      }
    }
  }
}

/**
 * Scan a set of dirty nodes (called from the rAF batcher).
 */
function scanDirtyNodes(dirtyNodes) {
  const secrets = getSecrets();
  if (secrets.length === 0) {
    dirtyNodes.clear();
    return;
  }
  for (const node of dirtyNodes) {
    scanNode(node);
  }
  dirtyNodes.clear();
}

/**
 * Full document scan — called once when a new secret is registered.
 * Walks all text nodes + input/textarea elements.
 */
function scanFullDocument() {
  const secrets = getSecrets();
  if (secrets.length === 0) return;

  // Text nodes
  const textWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.hasAttribute('data-hushh-overlay')) return NodeFilter.FILTER_REJECT;
        if (parent.hasAttribute('data-hushh-ui')) return NodeFilter.FILTER_REJECT;
        if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        if (!node.textContent?.trim()) return NodeFilter.FILTER_SKIP;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node;
  while ((node = textWalker.nextNode())) {
    scanNode(node);
  }


  for (const el of document.body.querySelectorAll('input, textarea')) {
    scanNode(el);
  }
}

export { scanNode, scanDirtyNodes, scanFullDocument };
