// background/service-worker.js — Shortcut handler + icon state management

// Handle keyboard shortcut (Alt+Shift+H)
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-hushh') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECTION' });
  } catch (e) {
    // Content script not yet injected — inject it
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/index.js'],
    });
    // Retry after injection
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SELECTION' });
    } catch {}
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SET_ICON') {
    const tabId = sender.tab?.id;
    if (!tabId) return;

    const path = msg.active
      ? {
          16: 'assets/icons/16-active.png',
          32: 'assets/icons/32-active.png',
          48: 'assets/icons/48-active.png',
        }
      : {
          16: 'assets/icons/16.png',
          32: 'assets/icons/32.png',
          48: 'assets/icons/48.png',
        };

    chrome.action.setIcon({ tabId, path }).catch(() => {});
    sendResponse({ ok: true });
  }
  return true;
});

// On install, set default badge style
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeBackgroundColor({ color: '#7F77DD' });
});
