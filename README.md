# Hushh

A Chrome extension that hides sensitive information during screen recordings and screenshots. Point at any element containing a secret, click once, and that value stays blurred wherever it appears on the page.

## How it works

When you protect a piece of text, Hushh stores it in memory and scans the entire page for that exact string. Every element containing it gets blurred inline using CSS `filter: blur()`, which renders into the OS compositor so Loom, Zoom, QuickTime, OBS, and every other recorder see the blur.

When the page navigates or the value appears in a new element, Hushh re-scans automatically. Nothing is ever sent to a server.

## Features

- Click any element or highlight any text to protect it
- Blur follows the value across the whole page, including after navigation
- Works with inputs, textareas, and any text node
- Drag to select a region and protect everything inside it
- Keyboard shortcuts: `⌥⇧H` / `Alt+Shift+H` to activate, `⌥⇧X` / `Alt+Shift+X` to clear all
- Zero network requests, zero storage

## Loading the extension locally

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click "Load unpacked" and select the `hushh-extension/` folder

The `dist/` folder contains pre-built output. If you modify source files, rebuild with:

```bash
cd hushh-extension
npm install
npm run build
```
