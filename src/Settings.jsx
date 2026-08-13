import React, { useState } from 'react';
import { getSettings, saveSettings, clearSettings } from './settings.js';

// Configuration Settings — lets the merchant point the demo at any Mastercard
// Gateway MID from the browser. Values are stored in localStorage (see
// settings.js) and sent as x-c2p-* headers on every backend request.
//
// Props:
//   defaults  — the config the backend currently resolves (from /api/config),
//               used to show placeholder hints of the .env fallback.
//   onClose   — dismiss without re-fetching.
//   onSaved   — called after save/reset so the app can re-fetch /api/config.
export default function Settings({ defaults = {}, onClose, onSaved }) {
  const saved = getSettings();
  const [form, setForm] = useState({
    merchantId: saved.merchantId || '',
    username: saved.username || '',
    password: saved.password || '',
    host: saved.host || '',
    version: saved.version || '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [flash, setFlash] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function handleSave() {
    // Trim everything; drop empty keys so they fall back to the backend .env.
    const clean = {};
    for (const [k, v] of Object.entries(form)) {
      const t = (v || '').trim();
      if (t) clean[k] = t;
    }
    saveSettings(clean);
    setFlash({ kind: 'ok', msg: 'Configuration saved to this browser.' });
    onSaved && onSaved();
  }

  function handleReset() {
    clearSettings();
    setForm({ merchantId: '', username: '', password: '', host: '', version: '' });
    setFlash({ kind: 'ok', msg: 'Cleared — using server defaults again.' });
    onSaved && onSaved();
  }

  const usernameHint =
    defaults.username || (form.merchantId ? `merchant.${form.merchantId}` : 'merchant.YOUR_MERCHANT_ID');

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <div>
            <h2 className="settings-title">Configuration Settings</h2>
            <p className="settings-subtitle">Point the demo at your Mastercard Gateway MID</p>
          </div>
          <button className="settings-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="settings-body">
          <h3 className="settings-section-title">Payment Gateway Configuration</h3>

          <label className="settings-label">Merchant ID</label>
          <input
            className="settings-input"
            placeholder={defaults.merchantId || 'Enter Merchant ID'}
            value={form.merchantId}
            onChange={set('merchantId')}
          />

          <label className="settings-label">API Username</label>
          <input
            className="settings-input"
            placeholder={usernameHint}
            value={form.username}
            onChange={set('username')}
          />
          <p className="settings-help">Leave blank to use <code>merchant.&lt;Merchant ID&gt;</code>.</p>

          <label className="settings-label">API Password</label>
          <div className="settings-password-row">
            <input
              className="settings-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter API Password"
              value={form.password}
              onChange={set('password')}
              autoComplete="off"
            />
            <button
              type="button"
              className="settings-eye"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <label className="settings-label">API Base URL</label>
          <input
            className="settings-input"
            placeholder={defaults.gatewayHost ? `https://${defaults.gatewayHost}` : 'https://mtf.gateway.mastercard.com'}
            value={form.host}
            onChange={set('host')}
          />

          <label className="settings-label">API Version</label>
          <input
            className="settings-input"
            placeholder={defaults.apiVersion || '100'}
            value={form.version}
            onChange={set('version')}
          />

          {flash && <div className={`settings-flash settings-flash--${flash.kind}`}>{flash.msg}</div>}

          <div className="settings-actions">
            <button className="settings-save" onClick={handleSave}>💾 Save Configuration</button>
            <button className="settings-reset" onClick={handleReset}>Reset to defaults</button>
          </div>

          <div className="settings-note">
            🔒 <strong>Security:</strong> API credentials are stored locally in your browser and
            sent to this demo's backend to call the gateway. Use integration/test credentials only.
          </div>
        </div>
      </div>
    </div>
  );
}
