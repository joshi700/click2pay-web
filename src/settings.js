// Gateway credentials the shopper/merchant configures in the browser.
// Stored in localStorage and sent as x-c2p-* headers on every backend call, so
// the backend talks to the gateway with THESE values instead of its .env.
const KEY = 'c2p.settings.v1';

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSettings(s) {
  localStorage.setItem(KEY, JSON.stringify(s || {}));
}

export function clearSettings() {
  localStorage.removeItem(KEY);
}

export function hasSettings() {
  const s = getSettings();
  return Boolean(s.merchantId || s.password || s.host || s.version || s.username);
}

// Only send a header when the field is non-empty — an empty field falls back to
// the backend's .env value.
export function settingsHeaders() {
  const s = getSettings();
  const h = {};
  if (s.merchantId) h['x-c2p-merchant-id'] = s.merchantId;
  if (s.username) h['x-c2p-username'] = s.username;
  if (s.password) h['x-c2p-password'] = s.password;
  if (s.host) h['x-c2p-host'] = s.host;
  if (s.version) h['x-c2p-version'] = s.version;
  return h;
}
