// scanner.js — Text scanning logic

import { getSecrets } from './extractor.js';
import { injectTextBlur, showElementOverlay } from './overlay.js';

/**
 * Scan a single text node against all registered secrets.
 */
function scanTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return;
  if (parent.hasAttribute('data-hushh-blur'))    return; // already wrapped
  if (parent.hasAttribute('data-hushh-overlay')) return;
  if (parent.hasAttribute('data-hushh-ui'))      return;
  if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return;

  const text = node.textContent;
  if (!text?.trim()) return;

  const lower = text.toLowerCase();
  // Collect matches in reverse order so char offsets don't shift as we inject spans
  const matches = [];
  for (const secret of getSecrets()) {
    let from = 0;
    while (true) {
      const idx = lower.indexOf(secret.matchValue, from);
      if (idx === -1) break;
      matches.push({ idx, len: secret.matchValue.length, secretId: secret.id });
      from = idx + secret.matchValue.length;
    }
  }

  // Inject from end to start so offsets stay valid
  matches.sort((a, b) => b.idx - a.idx);
  for (const { idx, len, secretId } of matches) {
    injectTextBlur(node, idx, len, secretId);
  }
}

/**
 * Scan an input or textarea — blurs the whole element.
 */
function scanInputEl(el) {
  if (el.hasAttribute('data-hushh-overlay')) return;
  if (el.hasAttribute('data-hushh-ui'))      return;

  const text = ((el.value ?? '') + ' ' + (el.placeholder ?? '')).toLowerCase();
  if (!text.trim()) return;

  for (const secret of getSecrets()) {
    if (text.includes(secret.matchValue)) {
      showElementOverlay(secret.id, el);
    }
  }
}

/**
 * Scan a dirty node from the rAF batcher.
 */
function scanNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    scanTextNode(node);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      scanInputEl(node);
    } else {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      let child;
      while ((child = walker.nextNode())) scanTextNode(child);
      for (const input of node.querySelectorAll('input, textarea')) scanInputEl(input);
    }
  }
}

function scanDirtyNodes(dirtyNodes) {
  if (getSecrets().length === 0) { dirtyNodes.clear(); return; }
  for (const node of dirtyNodes) scanNode(node);
  dirtyNodes.clear();
}

/**
 * Full document scan — called once when a new secret is registered.
 */
function scanFullDocument() {
  if (getSecrets().length === 0) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (p.hasAttribute('data-hushh-blur'))    return NodeFilter.FILTER_REJECT;
        if (p.hasAttribute('data-hushh-overlay')) return NodeFilter.FILTER_REJECT;
        if (p.hasAttribute('data-hushh-ui'))      return NodeFilter.FILTER_REJECT;
        if (p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node;
  while ((node = walker.nextNode())) scanTextNode(node);
  for (const el of document.body.querySelectorAll('input, textarea')) scanInputEl(el);
}

export { scanNode, scanDirtyNodes, scanFullDocument };
