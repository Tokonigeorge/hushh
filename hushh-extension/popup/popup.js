// popup.js — Popup UI logic

const stateReload   = document.getElementById('stateReload');
const stateInactive = document.getElementById('stateInactive');
const stateEmpty    = document.getElementById('stateEmpty');
const secretsList   = document.getElementById('secretsList');
const countBadge    = document.getElementById('countBadge');
const btnActivate   = document.getElementById('btnActivate');
const btnReload     = document.getElementById('btnReload');
const btnClearAll   = document.getElementById('btnClearAll');
const shortcutHint  = document.getElementById('shortcutHint');

const isMac = navigator.platform.toUpperCase().includes('MAC');
const mod   = isMac ? 'Option' : 'Alt';

let currentTabId = null;

// ─── Init ──────────────────────────────────────────────────────────────────

async function init() {
  // Set correct modifier key label
  shortcutHint.innerHTML =
    `Toggle: <kbd>${mod}</kbd>+<kbd>Shift</kbd>+<kbd>H</kbd>` +
    `&nbsp;&nbsp;Clear: <kbd>${mod}</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showState('needs-reload');
    return;
  }
  currentTabId = tab.id;

  try {
    const res = await sendToContent({ type: 'GET_SECRETS' });
    renderSecrets(res.secrets ?? []);
  } catch {
    // Content script didn't respond — either needs reload or restricted page
    const isRestricted = tab.url?.startsWith('chrome://') ||
                         tab.url?.startsWith('chrome-extension://') ||
                         tab.url?.startsWith('https://chrome.google.com/webstore');
    showState(isRestricted ? 'inactive' : 'needs-reload');
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────

function renderSecrets(secrets) {
  secretsList.innerHTML = '';

  if (secrets.length === 0) {
    showState('empty');
    return;
  }

  showState('list');
  countBadge.textContent = secrets.length;
  countBadge.classList.add('visible');
  btnClearAll.classList.add('visible');

  for (const secret of secrets) {
    secretsList.appendChild(buildSecretItem(secret));
  }
}

function buildSecretItem(secret) {
  const li = document.createElement('li');
  li.className = 'secret-item';
  li.dataset.id = secret.id;

  const dot = document.createElement('span');
  dot.className = `secret-dot ${secret.type ?? 'text'}`;

  const preview = document.createElement('span');
  preview.className = 'secret-preview';
  preview.textContent = secret.preview;
  preview.setAttribute('aria-label', 'hidden secret value');

  const remove = document.createElement('button');
  remove.className = 'secret-remove';
  remove.textContent = '×';
  remove.title = 'Remove this secret';
  remove.setAttribute('aria-label', 'Remove secret');
  remove.addEventListener('click', () => handleRemove(secret.id));

  li.append(dot, preview, remove);
  return li;
}

function showState(state) {
  stateReload.classList.remove('visible');
  stateInactive.classList.remove('visible');
  stateEmpty.classList.remove('visible');
  secretsList.classList.remove('visible');
  countBadge.classList.remove('visible');
  btnClearAll.classList.remove('visible');

  if      (state === 'needs-reload') stateReload.classList.add('visible');
  else if (state === 'inactive')     stateInactive.classList.add('visible');
  else if (state === 'empty')        stateEmpty.classList.add('visible');
  else if (state === 'list')         secretsList.classList.add('visible');
}

// ─── Actions ──────────────────────────────────────────────────────────────

btnActivate.addEventListener('click', async () => {
  if (!currentTabId) return;
  try {
    await sendToContent({ type: 'TOGGLE_SELECTION' });
    window.close();
  } catch {
    showState('needs-reload');
  }
});

btnReload.addEventListener('click', async () => {
  if (!currentTabId) return;
  await chrome.tabs.reload(currentTabId);
  window.close();
});

async function handleRemove(id) {
  await sendToContent({ type: 'REMOVE_SECRET', id });
  const res = await sendToContent({ type: 'GET_SECRETS' });
  renderSecrets(res.secrets ?? []);
}

btnClearAll.addEventListener('click', async () => {
  await sendToContent({ type: 'CLEAR_ALL' });
  renderSecrets([]);
});

// ─── Live updates from content script ────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SECRETS_UPDATED') {
    sendToContent({ type: 'GET_SECRETS' })
      .then(res => renderSecrets(res.secrets ?? []))
      .catch(() => {});
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function sendToContent(msg) {
  return chrome.tabs.sendMessage(currentTabId, msg);
}

init();
