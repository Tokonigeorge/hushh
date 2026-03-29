// scanner.js — Text scanning logic
// Scans dirty nodes for registered secret values and schedules overlays.
// Only scans nodes flagged as dirty by the observer — never the full document
// except on initial secret registration.

import { getSecrets } from './extractor.js';
import { showOverlay } from './overlay.js';

/**
 * Get the text content of a node, handling both element and text nodes.
 */
function getNodeText(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? '';
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    // For inputs, check value attribute too
    if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
      return (node.value ?? '') + ' ' + (node.placeholder ?? '');
    }
    return node.textContent ?? '';
  }
  return '';
}

/**
 * Find the best element to overlay for a given node.
 * For text nodes, walk up to the nearest block-ish or meaningful element.
 */
function getOverlayTarget(node) {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!el) return null;

  // Walk up to find an element with a non-zero bounding box
  let current = el;
  while (current && current !== document.documentElement) {
    const rect = current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return current;
    current = current.parentElement;
  }
  return el;
}

/**
 * Scan a single node against all registered secrets.
 */
function scanNode(node) {
  // Skip overlay elements themselves
  if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute?.('data-hushh-overlay')) return;
  if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute?.('data-hushh-ui')) return;

  const secrets = getSecrets();
  if (secrets.length === 0) return;

  const text = getNodeText(node).toLowerCase();
  if (!text) return;

  for (const secret of secrets) {
    if (text.includes(secret.matchValue)) {
      const target = getOverlayTarget(node);
      if (target) {
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
 * Walks all text nodes and relevant elements.
 */
function scanFullDocument() {
  const secrets = getSecrets();
  if (secrets.length === 0) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        // Skip hushh UI elements
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.hasAttribute('data-hushh-overlay')) return NodeFilter.FILTER_REJECT;
          if (node.hasAttribute('data-hushh-ui')) return NodeFilter.FILTER_REJECT;
          // Skip script/style
          if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    scanNode(node);
  }
}

export { scanNode, scanDirtyNodes, scanFullDocument };
