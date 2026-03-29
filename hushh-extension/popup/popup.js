// popup.js — Popup UI logic
// Communicates with the content script via chrome.runtime.sendMessage.
// No secret values are ever shown in full — only masked previews.

const stateInactive = document.getElementById('stateInactive');
const stateEmpty    = document.getElementById('stateEmpty');
const secretsList   = document.getElementById('secretsList');
const countBadge    = document.getElementById('countBadge');
const btnActivate   = document.getElementById('btnActivate');
const btnClearAll   = document.getElementById('btnClearAll');

let currentTabId = null;

// ─── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    showState('inactive');
    return;
  }
  currentTabId = tab.id;

  try {
    const res = await sendToContent({ type: 'GET_SECRETS' });
    renderSecrets(res.secrets ?? []);
  } catch {
    // Content script not injected yet
    showState('inactive');
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
  countBadge.classList.toggle('visible', secrets.length > 0);
  btnClearAll.classList.toggle('visible', secrets.length > 0);

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
  stateInactive.classList.remove('visible');
  stateEmpty.classList.remove('visible');
  secretsList.classList.remove('visible');
  countBadge.classList.remove('visible');
  btnClearAll.classList.remove('visible');

  if (state === 'inactive') {
    stateInactive.classList.add('visible');
  } else if (state === 'empty') {
    stateEmpty.classList.add('visible');
  } else if (state === 'list') {
    secretsList.classList.add('visible');
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────

btnActivate.addEventListener('click', async () => {
  if (!currentTabId) return;

  try {
    // Inject content script if needed
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ['content/index.js'],
    });
  } catch {}

  try {
    await sendToContent({ type: 'TOGGLE_SELECTION' });
    showState('empty');
  } catch {
    showState('inactive');
  }
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

// ─── Boot ─────────────────────────────────────────────────────────────────

init();
