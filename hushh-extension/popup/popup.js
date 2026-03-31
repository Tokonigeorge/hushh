const stateReload   = document.getElementById('stateReload');
const stateInactive = document.getElementById('stateInactive');
const stateEmpty    = document.getElementById('stateEmpty');
const secretsList   = document.getElementById('secretsList');
const countBadge    = document.getElementById('countBadge');
const btnActivate   = document.getElementById('btnActivate');
const btnReload     = document.getElementById('btnReload');
const btnClearAll   = document.getElementById('btnClearAll');
const shortcutHint  = document.getElementById('shortcutHint');

const isMac = navigator.userAgentData?.platform === 'macOS';
const mod = isMac ? '⌥' : 'Alt';

let currentTabId = null;

async function ensureContentScript() {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId },
      files: ['dist/content/index.js'],
    });
  } catch {}
}

async function init() {
  shortcutHint.innerHTML =
    `<kbd>${mod}</kbd><kbd>⇧</kbd><kbd>H</kbd> protect &nbsp;·&nbsp; <kbd>${mod}</kbd><kbd>⇧</kbd><kbd>X</kbd> clear`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { showState('needs-reload'); return; }
  currentTabId = tab.id;

  const restricted = tab.url?.startsWith('chrome://') ||
                     tab.url?.startsWith('chrome-extension://') ||
                     tab.url?.startsWith('https://chrome.google.com/webstore');
  if (restricted) { showState('inactive'); return; }

  await ensureContentScript();

  try {
    const res = await sendToContent({ type: 'GET_SECRETS' });
    renderSecrets(res.secrets ?? [], true);
  } catch {
    showState('needs-reload');
  }
}

function renderSecrets(secrets, autoActivate = false) {
  secretsList.innerHTML = '';
  if (secrets.length === 0) {
    if (autoActivate) {
      sendToContent({ type: 'TOGGLE_SELECTION' }).catch(() => {});
      window.close();
      return;
    }
    showState('empty');
    return;
  }

  showState('list');
  countBadge.textContent = secrets.length;
  countBadge.classList.add('visible');
  btnClearAll.classList.add('visible');

  for (const s of secrets) secretsList.appendChild(buildSecretItem(s));
}

function buildSecretItem(secret) {
  const li = document.createElement('li');
  li.className = 'secret-item';

  const dot = document.createElement('span');
  dot.className = `secret-dot ${secret.type ?? 'text'}`;

  const blurIcon = document.createElement('span');
  blurIcon.className = 'secret-style-blur';

  const preview = document.createElement('span');
  preview.className = 'secret-preview';
  preview.textContent = secret.preview;

  const remove = document.createElement('button');
  remove.className = 'secret-remove';
  remove.textContent = '×';
  remove.title = 'Remove';
  remove.addEventListener('click', () => handleRemove(secret.id));

  li.append(dot, blurIcon, preview, remove);
  return li;
}

const STATE_ELS = {
  'needs-reload': stateReload,
  'inactive':     stateInactive,
  'empty':        stateEmpty,
  'list':         secretsList,
};

function showState(state) {
  [stateReload, stateInactive, stateEmpty, secretsList, countBadge, btnClearAll]
    .forEach(el => el.classList.remove('visible'));
  STATE_ELS[state]?.classList.add('visible');
}

btnActivate.addEventListener('click', async () => {
  if (!currentTabId) return;
  try {
    await ensureContentScript();
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

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SECRETS_UPDATED') {
    sendToContent({ type: 'GET_SECRETS' })
      .then(res => renderSecrets(res.secrets ?? []))
      .catch(() => {});
  }
});

function sendToContent(msg) {
  return chrome.tabs.sendMessage(currentTabId, msg);
}

init();
