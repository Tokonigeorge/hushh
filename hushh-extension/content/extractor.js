// extractor.js — Secret Fingerprinter + Registry
// Secrets are NEVER written to localStorage, sessionStorage, or chrome.storage.
// The registry lives only in memory for the current page session.

const registry = new Map(); // id → { id, raw, normalized, type, overlayIds: [] }
let idCounter = 0;

/**
 * Extract the text value from a DOM element.
 * Priority: input/textarea value → data-hushh-value override → textContent
 */
function extractValue(el) {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    return el.value;
  }
  if (el.dataset && el.dataset.hushhValue) {
    return el.dataset.hushhValue;
  }
  return el.textContent?.trim() ?? '';
}

/**
 * Detect a rough type for color-coding in the popup.
 * password = coral, text = purple, region = teal
 */
function detectType(el, isRegion = false) {
  if (isRegion) return 'region';
  if (el.tagName === 'INPUT' && el.type === 'password') return 'password';
  return 'text';
}

/**
 * Normalize a raw string value before storage:
 * - trim whitespace
 * - collapse internal whitespace to single spaces
 * - lowercase for matching
 */
function normalize(raw) {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Add a secret extracted from a single element.
 * Returns the secret id, or null if the value is below minimum length.
 */
function addSecret(el, isRegion = false) {
  const raw = extractValue(el);
  return addRawSecret(raw, detectType(el, isRegion));
}

/**
 * Add a secret from a raw string value (e.g. merged region text).
 * Returns the secret id, or null if rejected.
 */
function addRawSecret(raw, type = 'text') {
  const trimmed = raw.trim().replace(/\s+/g, ' ');

  // Minimum 3 chars, max 500 chars
  if (trimmed.length < 3) return null;
  const capped = trimmed.slice(0, 500);

  // Avoid exact duplicate secrets
  const normalized = normalize(capped);
  for (const [id, secret] of registry) {
    if (secret.normalized === normalized) return id;
  }

  // For very long secrets (>100 chars), use first 80 chars for matching
  const matchValue = normalized.length > 100
    ? normalized.slice(0, 80)
    : normalized;

  const id = `hushh-${++idCounter}`;
  registry.set(id, {
    id,
    raw: capped,
    normalized,
    matchValue,
    type,
    overlayIds: [],
  });

  return id;
}

/**
 * Remove a secret from the registry and return its overlayIds so the
 * caller can clean up overlays.
 */
function removeSecret(id) {
  const secret = registry.get(id);
  if (!secret) return [];
  const ids = [...secret.overlayIds];
  registry.delete(id);
  return ids;
}

/**
 * Return all secrets as an array.
 */
function getSecrets() {
  return [...registry.values()];
}

/**
 * Clear all secrets (called on page navigation).
 */
function clearAll() {
  registry.clear();
}

export {
  registry,
  addSecret,
  addRawSecret,
  removeSecret,
  getSecrets,
  clearAll,
  extractValue,
};
