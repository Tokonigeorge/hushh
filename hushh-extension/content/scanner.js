import { getSecrets } from './extractor.js';
import { injectTextBlur, showElementOverlay } from './overlay.js';

const HUSHH_ATTRS = ['data-hushh-blur', 'data-hushh-overlay', 'data-hushh-ui'];
const SKIP_TAGS   = new Set(['SCRIPT', 'STYLE']);

function isHushhNode(parent) {
  return HUSHH_ATTRS.some(a => parent.hasAttribute(a)) || SKIP_TAGS.has(parent.tagName);
}

function scanTextNode(node) {
  const parent = node.parentElement;
  if (!parent || isHushhNode(parent)) return;

  const text  = node.textContent;
  if (!text?.trim()) return;

  const lower = text.toLowerCase();
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

  // Inject right-to-left so earlier char offsets stay valid after each DOM insertion
  matches.sort((a, b) => b.idx - a.idx);
  for (const { idx, len, secretId } of matches) {
    injectTextBlur(node, idx, len, secretId);
  }
}

function scanInputEl(el) {
  if (HUSHH_ATTRS.some(a => el.hasAttribute(a))) return;

  const text = ((el.value ?? '') + ' ' + (el.placeholder ?? '')).toLowerCase();
  if (!text.trim()) return;

  for (const secret of getSecrets()) {
    if (text.includes(secret.matchValue)) showElementOverlay(secret.id, el);
  }
}

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

function scanFullDocument() {
  if (getSecrets().length === 0) return;

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p || isHushhNode(p)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node;
  while ((node = walker.nextNode())) scanTextNode(node);
  for (const el of document.body.querySelectorAll('input, textarea')) scanInputEl(el);
}

export { scanNode, scanDirtyNodes, scanFullDocument };
