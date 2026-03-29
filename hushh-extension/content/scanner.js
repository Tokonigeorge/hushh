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
 * For a text node, the overlay target is its parent element.
 * For an input/textarea, it's the element itself.
 */
function getOverlayTarget(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.parentElement ?? null;
  }
  return node;
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
