

const registry = new Map();
let idCounter = 0;

// Priority: input/textarea value → data-hushh-value override → textContent
function extractValue(el) {
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el.value;
  if (el.dataset?.hushhValue) return el.dataset.hushhValue;
  return el.textContent?.trim() ?? '';
}

function detectType(el, isRegion = false) {
  if (isRegion) return 'region';
  if (el.tagName === 'INPUT' && el.type === 'password') return 'password';
  return 'text';
}

function normalize(raw) {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

function addSecret(el, isRegion = false) {
  const id = addRawSecret(extractValue(el), detectType(el, isRegion));
  if (id) {
    const secret = registry.get(id);
    if (secret && !secret.sourceEl) secret.sourceEl = el;
  }
  return id;
}

function addRawSecret(raw, type = 'text') {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length < 3) return null;

  const capped = trimmed.slice(0, 500);
  const normalized = normalize(capped);

  for (const [id, secret] of registry) {
    if (secret.normalized === normalized) return id;
  }

  // Long secrets: match on first 80 chars to avoid false negatives from truncated DOM text
  const matchValue = normalized.length > 100 ? normalized.slice(0, 80) : normalized;

  const id = `hushh-${++idCounter}`;
  registry.set(id, { id, raw: capped, normalized, matchValue, type });
  return id;
}

function removeSecret(id) {
  registry.delete(id);
}

function getSecrets() {
  return [...registry.values()];
}

function clearAll() {
  registry.clear();
}

export { addSecret, addRawSecret, removeSecret, getSecrets, clearAll, extractValue };
