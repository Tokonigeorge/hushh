import { init as initSelector, enterSelectionMode, exitSelectionMode, isSelectionActive } from './selector.js';
import { removeSecret, getSecrets, clearAll } from './extractor.js';
import { stopObserver } from './observer.js';
import { removeOverlaysForSecret, clearAllOverlays, initPool } from './overlay.js';

if (!window.__hushhInitialized) {
window.__hushhInitialized = true;

initPool();

initSelector({
  onSecretAdded() { notifyPopup(); updateIcon(true); },
  onSelectionEnd() {},
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'TOGGLE_SELECTION':
      isSelectionActive() ? exitSelectionMode() : enterSelectionMode();
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
  }
  return true;
});

function handleRemoveSecret(id) {
  removeSecret(id);
  removeOverlaysForSecret(id);
  if (getSecrets().length === 0) { stopObserver(); updateIcon(false); }
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
  return getSecrets().map(s => ({ id: s.id, type: s.type, preview: maskSecret(s.raw) }));
}

// Show first 4 + last 4 chars — never exposes the full value to the popup
function maskSecret(raw) {
  if (raw.length <= 8) return '••••••••';
  return raw.slice(0, 4) + '••••••••' + raw.slice(-4);
}

function updateIcon(active) {
  chrome.runtime.sendMessage({ type: 'SET_ICON', active }).catch(() => {});
}

function notifyPopup() {
  chrome.runtime.sendMessage({ type: 'SECRETS_UPDATED' }).catch(() => {});
}

// SPA nav: clear overlays but keep secrets so the observer re-scans on new content
function handleNavigation() {
  clearAllOverlays();
  exitSelectionMode();
}

const _pushState    = history.pushState.bind(history);
const _replaceState = history.replaceState.bind(history);

history.pushState    = (...args) => { _pushState(...args);    handleNavigation(); };
history.replaceState = (...args) => { _replaceState(...args); handleNavigation(); };

window.addEventListener('popstate', handleNavigation);
}
