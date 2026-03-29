// observer.js — MutationObserver + rAF batcher
// Mutations populate a dirtyNodes Set; a single rAF flush scans them.
// This guarantees at most one DOM scan per animation frame (≤16ms), regardless
// of how many mutations fire (e.g. keystroke autocomplete storms).

import { scanDirtyNodes } from './scanner.js';
import { repositionOverlays } from './overlay.js';

const dirtyNodes = new Set();
let rafId = null;
let mutationObserver = null;

function scheduleFlush() {
  if (rafId) return; // already scheduled for this frame
  rafId = requestAnimationFrame(() => {
    rafId = null;
    scanDirtyNodes(dirtyNodes);
    // dirtyNodes is cleared inside scanDirtyNodes
  });
}

function startObserver() {
  if (mutationObserver) return; // already running

  mutationObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // Added/removed nodes
      for (const node of m.addedNodes) {
        dirtyNodes.add(node);
        // Also add all descendant text nodes for newly inserted subtrees
        if (node.nodeType === Node.ELEMENT_NODE) {
          collectDescendantTextNodes(node, dirtyNodes);
        }
      }
      // Character data change
      if (m.type === 'characterData' && m.target) {
        dirtyNodes.add(m.target);
      }
      // Attribute change (value, placeholder, etc.)
      if (m.type === 'attributes' && m.target) {
        dirtyNodes.add(m.target);
      }
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

  // Passive scroll/resize listeners to reposition overlays without blocking
  window.addEventListener('scroll', repositionOverlays, { passive: true });
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
  window.removeEventListener('scroll', repositionOverlays);
  window.removeEventListener('resize', repositionOverlays);
}

/**
 * Mark all descendant text nodes of an element as dirty.
 * Called when a new subtree is inserted so we scan all its text content.
 */
function collectDescendantTextNodes(el, set) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    set.add(node);
  }
}

export { startObserver, stopObserver };
