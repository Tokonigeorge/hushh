import { scanDirtyNodes } from './scanner.js';
import { repositionOverlays } from './overlay.js';

const dirtyNodes = new Set();
let rafId = null;
let mutationObserver = null;

function scheduleFlush() {
  if (rafId) return; // coalesce: one scan per animation frame max
  rafId = requestAnimationFrame(() => {
    rafId = null;
    scanDirtyNodes(dirtyNodes);
  });
}

function startObserver() {
  if (mutationObserver) return;

  mutationObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        dirtyNodes.add(node);
        if (node.nodeType === Node.ELEMENT_NODE) collectTextNodes(node, dirtyNodes);
      }
      if (m.type === 'characterData' && m.target) dirtyNodes.add(m.target);
      if (m.type === 'attributes'    && m.target) dirtyNodes.add(m.target);
    }
    scheduleFlush();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['value', 'placeholder', 'title', 'aria-label'],
  });

  // capture:true catches scroll events from custom scroll containers 
  document.addEventListener('scroll', repositionOverlays, { passive: true, capture: true });
  window.addEventListener('resize', repositionOverlays, { passive: true });
}

function stopObserver() {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
  }
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  dirtyNodes.clear();
  document.removeEventListener('scroll', repositionOverlays, { capture: true });
  window.removeEventListener('resize', repositionOverlays);
}

function collectTextNodes(el, set) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) set.add(node);
}

export { startObserver, stopObserver };
