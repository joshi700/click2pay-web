import React, { useState } from 'react';
import { getSettings, saveSettings, clearSettings } from './settings.js';
import { Icon } from './Storefront.jsx';

// Store Settings page — lets the merchant point the demo at any Mastercard
// Gateway MID from the browser. Values are stored in localStorage (see
// settings.js) and sent as x-c2p-* headers on every backend request.
//
// Props:
//   defaults  — the config the backend currently resolves (from /api/config),
//               used to show placeholder hints of the .env fallback.
//   onBack    — leave the page (back to the store).
//   onSaved   — called after save/reset so the app can re-fetch /api/config.
// Default API base URL when the merchant hasn't set one (Mastercard MTF).
const DEFAULT_HOST = 'https://mtf.gateway.mastercard.com/';
// Derive the API username from the Merchant ID, per gateway convention.
const deriveUsername = (mid) => (mid.trim() ? `merchant.${mid.trim()}` : '');

export default function Settings({ defaults = {}, onBack, onSaved }) {
  const saved = getSettings();
  const [form, setForm] = useState({
    merchantId: saved.merchantId || '',
    username: saved.username || '',
    password: saved.password || '',
    host: saved.host || DEFAULT_HOST,
    version: saved.version || '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [flash, setFlash] = useState(null);
  // Once the user hand-edits the username, stop auto-syncing it to the Merchant ID.
  const [usernameEdited, setUsernameEdited] = useState(Boolean(saved.username));

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Typing the Merchant ID auto-fills the API Username as `merchant.<id>`,
  // unless the user has manually overridden the username.
  const onMerchantId = (e) => {
    const merchantId = e.target.value;
    setForm((f) => ({
      ...f,
      merchantId,
      username: usernameEdited ? f.username : deriveUsername(merchantId),
    }));
  };
  const onUsername = (e) => {
    setUsernameEdited(true);
    setForm((f) => ({ ...f, username: e.target.value }));
  };

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
    setForm({ merchantId: '', username: '', password: '', host: DEFAULT_HOST, version: '' });
    setUsernameEdited(false);
    setFlash({ kind: 'ok', msg: 'Cleared — using server defaults again.' });
    onSaved && onSaved();
  }

  const usernameHint =
    defaults.username || (form.merchantId ? `merchant.${form.merchantId}` : 'merchant.YOUR_MERCHANT_ID');

  return (
    <section className="tg-wrap tg-settings">
      <nav className="tg-crumbs">
        <button onClick={onBack}>Home</button>
        <span>/</span>
        <span>Store Settings</span>
      </nav>

      <div className="tg-settings-head">
        <span className="tg-label">Demo configuration</span>
        <h1 className="tg-page-title">Store Settings</h1>
        <p className="tg-muted">Point this demo store at your Mastercard Gateway merchant.</p>
      </div>

      <div className="tg-settings-grid">
        <form className="tg-settings-form" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <h3>Payment Gateway</h3>

          <label className="tg-field-label" htmlFor="st-mid">Merchant ID</label>
          <input
            id="st-mid"
            className="tg-input"
            placeholder={defaults.merchantId || 'Enter Merchant ID'}
            value={form.merchantId}
            onChange={onMerchantId}
          />

          <label className="tg-field-label" htmlFor="st-user">API Username</label>
          <input
            id="st-user"
            className="tg-input"
            placeholder={usernameHint}
            value={form.username}
            onChange={onUsername}
          />
          <p className="tg-help">Leave blank to use <code>merchant.&lt;Merchant ID&gt;</code>.</p>

          <label className="tg-field-label" htmlFor="st-pass">API Password</label>
          <div className="tg-email-row">
            <input
              id="st-pass"
              className="tg-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter API Password"
              value={form.password}
              onChange={set('password')}
              autoComplete="off"
            />
            <button type="button" className="tg-btn tg-btn--outline" onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          <label className="tg-field-label" htmlFor="st-host">API Base URL</label>
          <input
            id="st-host"
            className="tg-input"
            placeholder={defaults.gatewayHost ? `https://${defaults.gatewayHost}` : 'https://mtf.gateway.mastercard.com'}
            value={form.host}
            onChange={set('host')}
          />

          <label className="tg-field-label" htmlFor="st-ver">API Version</label>
          <input
            id="st-ver"
            className="tg-input"
            placeholder={defaults.apiVersion || '100'}
            value={form.version}
            onChange={set('version')}
          />

          {flash && <div className="tg-flash"><Icon name="check_circle" /> {flash.msg}</div>}

          <div className="tg-settings-actions">
            <button type="submit" className="tg-btn">Save Configuration</button>
            <button type="button" className="tg-btn tg-btn--outline" onClick={handleReset}>Reset to defaults</button>
          </div>
        </form>

        <aside className="tg-settings-side">
          <div className="tg-receipt-card">
            <h3>Current Status</h3>
            <div className={`tg-status ${defaults.configured ? 'is-ok' : 'is-warn'}`}>
              <Icon name={defaults.configured ? 'check_circle' : 'error'} />
              {defaults.configured ? 'Gateway credentials configured' : 'No gateway credentials yet'}
            </div>
            <dl className="tg-specs">
              <div><dt>Merchant ID</dt><dd className="tg-mono">{defaults.merchantId || '—'}</dd></div>
              <div><dt>Gateway</dt><dd className="tg-mono">{defaults.gatewayHost || '—'}</dd></div>
              <div><dt>API version</dt><dd>{defaults.apiVersion || '—'}</dd></div>
              <div><dt>Currency</dt><dd>{defaults.currency || '—'}</dd></div>
            </dl>
          </div>
          <p className="tg-settings-note">
            <Icon name="lock" />
            <span>
              Credentials are stored only in this browser and sent to this demo's backend to call the
              gateway. Use integration / test credentials only.
            </span>
          </p>
          <button className="tg-btn tg-btn--outline tg-btn--block" onClick={onBack}>Back to store</button>
        </aside>
      </div>
    </section>
  );
}
