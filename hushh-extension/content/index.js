// content/index.js — Entry point, injected on all pages
// Orchestrates all modules: selector, extractor, observer, overlay.
// NOTE: Hushh does NOT read, transmit, or store secrets outside the current
// page session. No network calls. No persistence. No account required.

import { init as initSelector, enterSelectionMode, exitSelectionMode, isSelectionActive } from './selector.js';
import { removeSecret, getSecrets, clearAll } from './extractor.js';
import { stopObserver } from './observer.js';
import { removeOverlaysForSecret, clearAllOverlays, initPool } from './overlay.js';

// Initialize the overlay pool eagerly so first-use is fast
initPool();

// ─── Selector callbacks ────────────────────────────────────────────────────

initSelector({
  onSecretAdded(id) {
    notifyPopup();
    updateIcon(true);
  },
  onSelectionEnd() {
    // Nothing extra needed; selection ended
  },
});

// ─── Message bridge (from popup + service worker) ─────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'TOGGLE_SELECTION':
      if (isSelectionActive()) {
        exitSelectionMode();
      } else {
        enterSelectionMode();
      }
      sendResponse({ active: isSelectionActive() });
      break;

    case 'GET_SECRETS':
      sendResponse({ secrets: getSecretsForPopup() });
      break;

    case 'REMOVE_SECRET':
      handleRemoveSecret(msg.id);
      sendResponse({ ok: true });
      break;

    case 'CLEAR_ALL':
      handleClearAll();
      sendResponse({ ok: true });
      break;

    default:
      break;
  }
  return true; // keep message channel open for async
});

// ─── Secret management ─────────────────────────────────────────────────────

function handleRemoveSecret(id) {
  removeSecret(id);
  removeOverlaysForSecret(id);
  if (getSecrets().length === 0) {
    stopObserver();
    updateIcon(false);
  }
  notifyPopup();
}

function handleClearAll() {
  clearAll();
  clearAllOverlays();
  stopObserver();
  updateIcon(false);
  notifyPopup();
}

function getSecretsForPopup() {
  return getSecrets().map(s => ({
    id: s.id,
    type: s.type,
    preview: maskSecret(s.raw),
  }));
}

/**
 * Show first 4 + last 4 chars of a secret, with dots in between.
 * Never reveals the full value to the popup.
 */
function maskSecret(raw) {
  if (raw.length <= 8) return '••••••••';
  return raw.slice(0, 4) + '••••••••' + raw.slice(-4);
}

// ─── Icon state ────────────────────────────────────────────────────────────

function updateIcon(active) {
  chrome.runtime.sendMessage({ type: 'SET_ICON', active }).catch(() => {});
}

// ─── Popup sync ────────────────────────────────────────────────────────────

function notifyPopup() {
  chrome.runtime.sendMessage({ type: 'SECRETS_UPDATED' }).catch(() => {});
}

// ─── SPA navigation handling ───────────────────────────────────────────────
// On SPA route changes, reset overlays but keep the secret registry.
// The observer re-scans when the new page content loads.

function handleNavigation() {
  clearAllOverlays();
  exitSelectionMode();
  // Registry intentionally kept — secrets persist across SPA nav
  // Full re-scan will happen when observer fires on new content
}

// Intercept pushState / replaceState
const _pushState = history.pushState.bind(history);
const _replaceState = history.replaceState.bind(history);

history.pushState = function (...args) {
  _pushState(...args);
  handleNavigation();
};
history.replaceState = function (...args) {
  _replaceState(...args);
  handleNavigation();
};

window.addEventListener('popstate', handleNavigation);

// ─── Hard navigation cleanup ───────────────────────────────────────────────
// On actual page unload, clear everything (secrets are session-only)
window.addEventListener('beforeunload', () => {
  clearAll();
  clearAllOverlays();
  stopObserver();
});
