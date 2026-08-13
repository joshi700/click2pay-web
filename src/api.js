import { settingsHeaders } from './settings.js';

// In dev this is empty → calls hit the Vite proxy (`/api` → :4000). On Vercel,
// set VITE_API_BASE to the backend project's URL (e.g. https://xxx.vercel.app).
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

async function http(method, path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...settingsHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  config: () => http('GET', '/api/config'),
  start: (amount, currency) => http('POST', '/api/checkout/start', { amount, currency }),
  // sessionId / amount / currency are sent so the backend needn't rely on its
  // in-memory order store (which doesn't survive Vercel serverless cold starts).
  wallet: (orderId, correlationId, scheme, sessionId) =>
    http('POST', `/api/checkout/${orderId}/wallet`, { correlationId, scheme, sessionId }),
  pay: (orderId, { sessionId, amount, currency } = {}) =>
    http('PUT', `/api/checkout/${orderId}/pay`, { sessionId, amount, currency }),
  get: (orderId) => http('GET', `/api/checkout/${orderId}`),
};

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}
