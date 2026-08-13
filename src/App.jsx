import React, { useEffect, useState, useRef } from 'react';
import { api, loadScript } from './api.js';
import SequenceDiagram from './SequenceDiagram.jsx';
import Settings from './Settings.jsx';

const STAGES = {
  STORE: 'STORE',           // ← NEW: e-commerce checkout landing page
  IDLE: 'IDLE',             //   Email entry (Click to Pay flow starts here)
  STARTING: 'STARTING',
  C2P_CONFIGURING: 'C2P_CONFIGURING',
  C2P_READY: 'C2P_READY',
  C2P_NEW_CARD: 'C2P_NEW_CARD',   // new-card enrollment: collect card via Hosted Session fields
  WALLET_LINKING: 'WALLET_LINKING',
  PAYING: 'PAYING',
  PAID: 'PAID',
  ERROR: 'ERROR',
};

// Demo product for the store landing page
const PRODUCT = {
  name: 'Aurora Wireless Headphones',
  variant: 'Midnight Black · ANC Pro',
  qty: 1,
  emoji: '🎧',
};
const STORE_NAME = 'Test Merchant';

function timeStr(d) {
  return d.toLocaleTimeString([], { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

// Basic email validation — good enough for a checkout form
function isValidEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());
}

// ── Group raw events into render-friendly items ────────────────
// Pair each request with the next response (same URL) into a "txn" item.
// Standalone events stay as "evt" items.
function groupEvents(events) {
  const items = [];
  const used = new Set();
  for (let i = 0; i < events.length; i++) {
    if (used.has(i)) continue;
    const ev = events[i];
    if (ev.type === 'request') {
      // find the next matching response
      let matchIdx = -1;
      for (let j = i + 1; j < events.length; j++) {
        if (used.has(j)) continue;
        if (events[j].type === 'response' && events[j].url === ev.url) {
          matchIdx = j;
          break;
        }
      }
      if (matchIdx !== -1) {
        used.add(matchIdx);
        items.push({ kind: 'txn', id: ev.id, request: ev, response: events[matchIdx] });
      } else {
        items.push({ kind: 'txn', id: ev.id, request: ev, response: null });
      }
    } else if (ev.type === 'response') {
      // orphan response (shouldn't normally happen)
      items.push({ kind: 'txn', id: ev.id, request: null, response: ev });
    } else {
      items.push({ kind: 'evt', id: ev.id, event: ev });
    }
  }
  return items;
}

function TxnCard({ item }) {
  // Auto-expand so gateway calls (Create Session, Update Session, etc.) are visible up front
  const [open, setOpen] = useState(true);
  const [showPayload, setShowPayload] = useState(false); // backend req/res body hidden by default
  const [tab, setTab] = useState('request');
  const req = item.request;
  const res = item.response;

  const status = res?.status;
  const ok = status >= 200 && status < 300;
  const pending = !res;
  const url = req?.url || res?.url;
  const method = req?.method || 'RES';

  // Extract gateway calls from the response body (without polluting the displayed JSON)
  const gatewayCalls = res?.data?._gatewayCalls || [];
  const displayedResData = res?.data ? (() => {
    const { _gatewayCalls, ...rest } = res.data;
    return rest;
  })() : null;

  return (
    <div className={`txn ${pending ? 'txn--pending' : ok ? 'txn--ok' : 'txn--err'}`}>
      <div className="txn-head" onClick={() => setOpen(o => !o)}>
        <span className="txn-method">{method}</span>
        <span className="txn-url">{url}</span>
        {gatewayCalls.length > 0 && (
          <span className="txn-gwcount" title={`${gatewayCalls.length} gateway call(s)`}>
            +{gatewayCalls.length} GW
          </span>
        )}
        <span className={`txn-status ${pending ? 'txn-status--pending' : ok ? 'txn-status--ok' : 'txn-status--err'}`}>
          {pending ? '…' : status}
        </span>
        <span className="txn-chevron">{open ? '▾' : '▸'}</span>
      </div>
      <div className="txn-meta">
        {req && <span>→ {timeStr(req.ts)}</span>}
        {res && <span>← {timeStr(res.ts)}</span>}
      </div>
      {open && (
        <div className="txn-body">
          {/* Backend req/res body — hidden by default to keep gateway calls visible */}
          <button className="txn-payload-toggle" onClick={() => setShowPayload(s => !s)}>
            {showPayload ? '▾' : '▸'} Backend request / response body
          </button>
          {showPayload && (
            <>
              <div className="txn-tabs">
                <button
                  className={`txn-tab ${tab === 'request' ? 'active' : ''}`}
                  onClick={() => setTab('request')}
                  disabled={!req}
                >Request</button>
                <button
                  className={`txn-tab ${tab === 'response' ? 'active' : ''}`}
                  onClick={() => setTab('response')}
                  disabled={!res}
                >Response{!res ? ' (pending…)' : ''}</button>
              </div>
              <pre className="txn-payload">
                {tab === 'request'
                  ? (req?.body !== null && req?.body !== undefined
                      ? JSON.stringify(req.body, null, 2)
                      : '(no body)')
                  : (displayedResData
                      ? JSON.stringify(displayedResData, null, 2)
                      : '(no body)')}
              </pre>
            </>
          )}

          {gatewayCalls.length > 0 && (
            <div className="gw-section">
              <div className="gw-section-header">
                <span className="gw-section-badge">GATEWAY</span>
                <span className="gw-section-title">
                  {gatewayCalls.length} call{gatewayCalls.length !== 1 ? 's' : ''} to Mastercard
                </span>
              </div>
              {gatewayCalls.map((gc, i) => <GwCall key={i} call={gc} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Human-readable label for a Gateway call based on method/path/apiOperation
function gwLabel(call) {
  const p = call.path || '';
  const op = call.request?.apiOperation;
  if (op === 'UPDATE_SESSION_FROM_WALLET') return 'Link Wallet to Session';
  if (op === 'PAY')                        return 'Charge the Card (PAY)';
  if (call.method === 'POST' && p === '/session')                  return 'Create Session';
  if (call.method === 'PUT'  && p.startsWith('/session/'))         return 'Update Session (attach amount + orderId)';
  if (call.method === 'POST' && p === '/paymentOptionsInquiry')    return 'Payment Options Inquiry';
  return null;
}

function GwCall({ call }) {
  // Collapsed by default — so ALL gateway calls show as a compact list (click to expand a body)
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('request');
  const ok = call.status >= 200 && call.status < 300;
  const ms = call.receivedAt - call.sentAt;
  const label = gwLabel(call);

  return (
    <div className={`gw-call ${ok ? 'gw-call--ok' : 'gw-call--err'}`}>
      <div className="gw-call-head" onClick={() => setOpen(o => !o)}>
        <span className="gw-call-method">{call.method}</span>
        <div className="gw-call-path-wrap">
          {label && <div className="gw-call-label">{label}</div>}
          <div className="gw-call-path">{call.path}</div>
        </div>
        <span className={`gw-call-status ${ok ? 'gw-call-status--ok' : 'gw-call-status--err'}`}>
          {call.status}
        </span>
        <span className="gw-call-ms">{ms}ms</span>
        <span className="gw-call-chevron">{open ? '▾' : '▸'}</span>
      </div>
      {open && (
        <div className="gw-call-body">
          <div className="gw-call-tabs">
            <button
              className={`gw-call-tab ${tab === 'request' ? 'active' : ''}`}
              onClick={() => setTab('request')}
              disabled={!call.request}
            >Request</button>
            <button
              className={`gw-call-tab ${tab === 'response' ? 'active' : ''}`}
              onClick={() => setTab('response')}
            >Response</button>
          </div>
          <pre className="gw-call-payload">
            {tab === 'request'
              ? (call.request ? JSON.stringify(call.request, null, 2) : '(no body)')
              : JSON.stringify(call.response, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function EvtCard({ event }) {
  const [open, setOpen] = useState(false);
  const hasData = event.data !== undefined && event.data !== null;
  return (
    <div className="evt-card">
      <div className="evt-card-head" onClick={() => hasData && setOpen(o => !o)} style={{ cursor: hasData ? 'pointer' : 'default' }}>
        <span className="evt-card-badge">EVENT</span>
        <span className="evt-card-msg">{event.message}</span>
        <span className="evt-card-time">{timeStr(event.ts)}</span>
        {hasData && <span className="evt-card-chevron">{open ? '▾' : '▸'}</span>}
      </div>
      {open && hasData && (
        <pre className="evt-card-data">{JSON.stringify(event.data, null, 2)}</pre>
      )}
    </div>
  );
}

function ApiPanel({ events, onClear, collapsible = false, defaultOpen = true }) {
  // Show only HTTP transactions — hide SDK events (those still get logged for debugging)
  const items = groupEvents(events).filter(i => i.kind === 'txn');
  const [open, setOpen] = useState(defaultOpen);

  // Summary stats for the collapsed header
  const txnCount = items.length;
  const gwCount  = items.reduce((n, i) => n + (i.response?.data?._gatewayCalls?.length || 0), 0);

  return (
    <section className={`api-panel ${collapsible ? 'api-panel--collapsible' : ''}`}>
      <div
        className={`api-panel-header ${collapsible ? 'api-panel-header--clickable' : ''}`}
        onClick={collapsible ? () => setOpen(o => !o) : undefined}
      >
        <div className="api-panel-title-wrap">
          {collapsible && (
            <span className="api-panel-toggle">{open ? '▾' : '▸'}</span>
          )}
          <div className="api-panel-dot" />
          <h2 className="api-panel-title">Network Console</h2>
          <span className="api-panel-count">{txnCount + gwCount}</span>
          {!open && collapsible && txnCount > 0 && (
            <span className="api-panel-summary">
              {txnCount} API · {gwCount} Gateway
            </span>
          )}
        </div>
        {open && events.length > 0 && (
          <button
            className="api-panel-clear"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
          >
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="api-panel-body">
          {items.length === 0 ? (
            <div className="api-panel-empty">
              <div className="api-panel-empty-icon">⚡</div>
              <p className="api-panel-empty-title">No API calls yet</p>
              <p className="api-panel-empty-sub">Backend and gateway calls will appear here once a payment is made</p>
            </div>
          ) : (
            items.map(item => <TxnCard key={item.id} item={item} />)
          )}
        </div>
      )}
    </section>
  );
}

// ── SDK placeholder ──────────────────────────────────────────
function SdkPlaceholder({ id, label, active, hidden }) {
  return (
    <div
      id={id}
      className={`sdk-placeholder ${active ? 'sdk-placeholder--active' : ''}`}
      data-label={label}
      // Keep the element in the DOM (the SDK renders into it) but hide it when not wanted.
      style={hidden ? { display: 'none' } : undefined}
    />
  );
}

// ── Store-checkout landing page (looks like a real e-commerce site) ──
function StoreCheckout({ config, onChooseClickToPay, onChooseCard }) {
  const subtotal = Number(config.amount);
  const total = subtotal;   // no tax — matches the actual gateway charge

  return (
    <div className="store">
      {/* Brand header */}
      <header className="store-header">
        <div className="store-brand">
          <div className="store-logo">N</div>
          <div>
            <div className="store-brand-name">{STORE_NAME}</div>
          </div>
        </div>
        <div className="store-secure">
          <span className="store-secure-dot" />
          Secure checkout
        </div>
      </header>

      <div className="store-grid">
        {/* Left — Order summary */}
        <section className="store-summary">
          <h3 className="store-section-title">Order summary</h3>

          <div className="store-item">
            <div className="store-item-image">{PRODUCT.emoji}</div>
            <div className="store-item-meta">
              <div className="store-item-name">{PRODUCT.name}</div>
              <div className="store-item-variant">{PRODUCT.variant}</div>
              <div className="store-item-qty">Qty {PRODUCT.qty}</div>
            </div>
            <div className="store-item-price">
              {subtotal.toFixed(2)} <em>{config.currency}</em>
            </div>
          </div>

          <div className="store-totals">
            <div className="store-total-row">
              <span>Subtotal</span>
              <span>{subtotal.toFixed(2)} {config.currency}</span>
            </div>
            <div className="store-total-row">
              <span>Shipping</span>
              <span className="store-total-free">Free</span>
            </div>
            <div className="store-total-row store-total-row--total">
              <span>Total</span>
              <span>{total.toFixed(2)} {config.currency}</span>
            </div>
          </div>
        </section>

        {/* Right — Payment methods */}
        <section className="store-payment">
          <h3 className="store-section-title">Payment method</h3>

          {/* Primary: Click to Pay */}
          <button className="ctp-button" onClick={onChooseClickToPay}>
            <span className="ctp-button-logo">
              <span className="ctp-arrow">»</span>
            </span>
            <span className="ctp-button-text">
              <span className="ctp-button-title">Click to Pay</span>
              <span className="ctp-button-sub">Use a saved card — no typing</span>
            </span>
            <span className="ctp-button-chevron">→</span>
          </button>

          {/* Divider */}
          <div className="store-divider"><span>or pay with a new card</span></div>

          {/* Demo manual card entry */}
          <div className="card-form">
            <label className="card-label">Card number</label>
            <input className="card-input card-input--full" placeholder="1234 1234 1234 1234" disabled />
            <div className="card-row">
              <div>
                <label className="card-label">Expiry</label>
                <input className="card-input" placeholder="MM / YY" disabled />
              </div>
              <div>
                <label className="card-label">CVV</label>
                <input className="card-input" placeholder="123" disabled />
              </div>
            </div>
          </div>

          {/* Secondary pay button (also routes to Click to Pay) */}
          <button className="store-pay-button" onClick={onChooseCard}>
            Pay {total.toFixed(2)} {config.currency}
          </button>
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState(null);
  const [stage, setStage] = useState(STAGES.STORE);
  const [order, setOrder] = useState(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  const [payResult, setPayResult] = useState(null);
  const [newCardStatus, setNewCardStatus] = useState(null);  // field errors / status for enrollment form
  const [newCardBusy, setNewCardBusy] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const psConfiguredRef = useRef(false);  // guard against double PaymentSession.configure
  const handledCorrelationRef = useRef(null);  // guard against duplicate onComplete (enroll-then-checkout)
  const seqRef = useRef(0);
  const nextId = () => `${Date.now()}-${++seqRef.current}`;

  const logReq   = (method, url, body)         => setEvents(e => [...e, { id: nextId(), type: 'request',  method, url, body, ts: new Date() }]);
  const logRes   = (status, url, data)         => setEvents(e => [...e, { id: nextId(), type: 'response', status, url, data, ts: new Date() }]);
  const logEvent = (message, data)             => setEvents(e => [...e, { id: nextId(), type: 'event',    message, data, ts: new Date() }]);

  async function call(method, url, body, fn) {
    logReq(method, url, body);
    try {
      const res = await fn();
      logRes(200, url, res);
      return res;
    } catch (e) {
      logRes(e.status || 500, url, { error: e.message });
      throw e;
    }
  }

  const refreshConfig = () => api.config().then(setConfig).catch((e) => setError(e.message));

  useEffect(() => {
    refreshConfig();
  }, []);

  // Bind Hosted Session hosted fields once the new-card form is on screen. session.js
  // replaces the placeholder inputs (matched by selector) with secure iframes, so the
  // DOM nodes must exist before configure() runs — hence this effect keyed on stage.
  useEffect(() => {
    if (stage !== STAGES.C2P_NEW_CARD) return;
    if (psConfiguredRef.current) return;
    if (!window.PaymentSession || !order?.sessionId) return;
    psConfiguredRef.current = true;

    logEvent('PaymentSession.configure(...) — binding hosted card fields', { session: order.sessionId });
    window.PaymentSession.configure({
      session: order.sessionId,
      fields: {
        card: {
          number: '#nc-number',
          securityCode: '#nc-cvv',
          expiryMonth: '#nc-exp-month',
          expiryYear: '#nc-exp-year',
          nameOnCard: '#nc-name',
        },
      },
      frameEmbeddingMitigation: ['javascript'],
      callbacks: {
        initialized: (response) => {
          logEvent('PaymentSession initialized', response);
        },
        // Fires after updateSessionFromForm('card'): the card is now on the session.
        formSessionUpdate: (response) => {
          logEvent('PaymentSession.formSessionUpdate', response);
          if (response.status === 'ok') {
            const scheme = response.sourceOfFunds?.provided?.card?.scheme;
            logEvent('Session updated with card — checking C2P enrollment availability', { scheme });
            // Only checkoutWithNewCard() once a card is on the session AND the scheme is
            // C2P-enabled for this merchant.
            window.ClickToPay.isEnrollmentAvailableForScheme(scheme, (canEnroll) => {
              logEvent('ClickToPay.isEnrollmentAvailableForScheme', { scheme, canEnroll });
              if (canEnroll) {
                logEvent('ClickToPay.checkoutWithNewCard()  (enrollment → DCF)');
                window.ClickToPay.checkoutWithNewCard();
                // onComplete (wired in configure) takes over from here.
              } else {
                setNewCardBusy(false);
                setNewCardStatus(`Click to Pay isn't available for ${scheme || 'this card'} on this merchant. Use guest checkout.`);
              }
            });
          } else if (response.status === 'fields_in_error') {
            const errs = response.errors || {};
            setNewCardBusy(false);
            setNewCardStatus('Check these fields: ' + (Object.keys(errs).join(', ') || 'card details'));
          } else {
            setNewCardBusy(false);
            setNewCardStatus('Session update failed: ' + (response.errors?.message || response.status || 'unknown error'));
          }
        },
      },
      interaction: {
        displayControl: { formatCard: 'EMBOSSED', invalidFieldCharacters: 'REJECT' },
      },
    });
  }, [stage, order]);

  // mode: 'email' | 'cookie' | 'new'
  //   'email'  → identify the shopper by the email they typed (most common)
  //   'cookie' → trust the C2P first-party cookie on this browser (no email needed)
  //   'new'    → skip identification entirely, prompt the user to add a brand-new card
  async function startCheckout(mode = 'email') {
    setError(null);
    setPayResult(null);
    setEvents([]);
    setNewCardStatus(null);
    setNewCardBusy(false);
    psConfiguredRef.current = false;
    handledCorrelationRef.current = null;
    setStage(STAGES.STARTING);
    try {
      const resp = await call('POST', '/api/checkout/start',
        { amount: config.amount, currency: config.currency },
        () => api.start(config.amount, config.currency)
      );
      setOrder(resp);

      logEvent('Loading click-to-pay.min.js', { url: config.clickToPayJsUrl });
      await loadScript(config.clickToPayJsUrl);
      if (!window.ClickToPay) {
        throw new Error('window.ClickToPay not defined after loading SDK');
      }

      setStage(STAGES.C2P_CONFIGURING);

      // configure() is async internally — it takes ~1.5s to initialise. We resolve this
      // promise on the first onStateChange callback, which the SDK fires once it's ready.
      let configureReadyResolve;
      const configureReady = new Promise((resolve) => { configureReadyResolve = resolve; });

      const c2pConfig = {
        merchant: { id: config.merchantId, name: 'Click2Pay Demo', url: window.location.origin },
        session: {
          id: resp.sessionId,
          wsVersion: Number(config.apiVersion),
          paymentOptions: resp.paymentOptions,
        },
        order: { amount: Number(resp.amount), currency: resp.currency },
        interaction: {
          locale: 'en_US',
          country: 'USA',
          billingPreference: 'NONE',
          collectShippingAddress: false,
          // ADD_NEW_CARD opens straight to the enrollment form; SELECT_AND_PROCEED uses the
          // wallet's card list (or falls through to add-new if none exist).
          cardSelectionAction: mode === 'new' ? 'ADD_NEW_CARD' : 'SELECT_AND_PROCEED',
          suppressPayerInteraction: false,
          skipDCFInteraction: false,
        },
        // Only attach customer.email for the 'email' flow — cookie / new flows are anonymous at configure time.
        // (Docs use `customer.email`; the SDK also accepts `payer` but customer is the documented key.)
        customer: (mode === 'email' && email) ? { email } : undefined,
        elements: { cardList: 'c2p-cardList', otp: 'c2p-otp', dcf: 'c2p-dcf' },
        callbacks: {
          onStateChange: (change) => {
            console.log('[C2P] onStateChange:', change);
            logEvent('SDK onStateChange', change.diffState || change);
            // First state change after configure() means the SDK has finished init.
            if (configureReadyResolve) {
              configureReadyResolve();
              configureReadyResolve = null;
            }
            // Auto-detect cookie-based recognition.
            const s = change.diffState || change.newState || change.state || change;
            if (s && (s.consumerPresent === true || s.recognized === true)) {
              logEvent('🍪  Shopper recognized from cookie — no email needed');
            }
          },
          onComplete: (correlationId, scheme) => {
            console.log('[C2P] onComplete', correlationId, scheme);
            // C2P can fire onComplete more than once (new-card enrollment emits it for
            // the enroll step and again for the auto-checkout, with the same
            // correlationId). Run the server-side wallet→auth→pay sequence only once.
            if (handledCorrelationRef.current === correlationId) {
              logEvent('SDK onComplete (duplicate — ignored)', { correlationId, scheme });
              return;
            }
            handledCorrelationRef.current = correlationId;
            logEvent('SDK onComplete', { correlationId, scheme });
            completeFlow(resp.orderId, correlationId, scheme, resp);
          },
          onError: (errInfo) => {
            console.error('[C2P] onError:', errInfo);
            logEvent('SDK onError', errInfo);
            setError(`${errInfo.errorCode}: ${errInfo.errorMessage}`);
            setStage(STAGES.ERROR);
          },
        },
      };

      logEvent('ClickToPay.configure(...)', { mode, ...c2pConfig });
      const configureResult = window.ClickToPay.configure(c2pConfig);

      setStage(STAGES.C2P_READY);

      // ── Post-configure action: wait for SDK init first ──────────
      if (mode === 'cookie' || mode === 'new') {
        // The SDK fires onStateChange DURING init — before configure() has actually
        // finished — so it's not a reliable "ready" signal. Calling checkoutWith* too
        // early throws: "configure() did not complete. Configuration should be
        // initialized first." configure() returns a promise that resolves only once
        // init is truly done, so prefer that; fall back to onStateChange (capped at 5s)
        // for older SDK builds that don't return a thenable.
        if (configureResult && typeof configureResult.then === 'function') {
          await configureResult;
        } else {
          await Promise.race([
            configureReady,
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);
        }
        logEvent('SDK initialised — invoking post-configure action');

        if (mode === 'cookie') {
          // Cookie path — ask the SDK to recognise the shopper from a previous session
          logEvent('ClickToPay.checkoutWithExistingCard()  (cookie-based)');
          window.ClickToPay.checkoutWithExistingCard();
        } else if (mode === 'new') {
          // New-card enrollment is a Hosted Session flow: the card must be put on the
          // session via PaymentSession.updateSessionFromForm('card') BEFORE
          // checkoutWithNewCard() — calling it directly returns a gateway INVALID_REQUEST.
          // Load session.js, then render the card form (PaymentSession.configure runs in
          // an effect once the hosted-field inputs are mounted).
          logEvent('Loading session.js (Hosted Session)', { url: config.sessionJsUrl });
          await loadScript(config.sessionJsUrl);
          if (!window.PaymentSession) {
            throw new Error('window.PaymentSession not defined after loading session.js');
          }
          setStage(STAGES.C2P_NEW_CARD);
        }
      }
      // For mode === 'email': SDK auto-runs identityLookup because payer.email was passed.
    } catch (e) {
      console.error(e);
      setError(e.message);
      setStage(STAGES.ERROR);
    }
  }

  function lookupCustomer() {
    if (!window.ClickToPay || !email) return;
    logEvent('ClickToPay.lookupCustomer(...)', { email });
    window.ClickToPay.lookupCustomer(email);
  }

  function checkoutWithExistingCard() {
    if (!window.ClickToPay) return;
    logEvent('ClickToPay.checkoutWithExistingCard()');
    window.ClickToPay.checkoutWithExistingCard();
  }

  // New-card enrollment: push the entered card onto the session. The hosted-field
  // values never touch our JS — session.js submits them to the gateway and replies
  // via the formSessionUpdate callback (see the PaymentSession.configure effect).
  function submitNewCard() {
    if (!window.PaymentSession) return;
    setNewCardStatus(null);
    setNewCardBusy(true);
    logEvent("PaymentSession.updateSessionFromForm('card')");
    window.PaymentSession.updateSessionFromForm('card');
  }

  async function completeFlow(orderId, correlationId, scheme, ord) {
    try {
      const sessionId = ord?.sessionId;
      setStage(STAGES.WALLET_LINKING);
      await call('POST', `/api/checkout/${orderId}/wallet`,
        { correlationId, scheme, sessionId },
        () => api.wallet(orderId, correlationId, scheme, sessionId)
      );

      await doPay(orderId, ord);
    } catch (e) {
      console.error('[C2P] completeFlow error:', e);
      setError(e.message);
      setStage(STAGES.ERROR);
    }
  }

  async function doPay(orderId, ord) {
    try {
      const payload = { sessionId: ord?.sessionId, amount: ord?.amount, currency: ord?.currency };
      setStage(STAGES.PAYING);
      const resp = await call('PUT', `/api/checkout/${orderId}/pay`,
        payload,
        () => api.pay(orderId, payload)
      );
      setPayResult(resp);
      setStage(resp.ok ? STAGES.PAID : STAGES.ERROR);
    } catch (e) {
      console.error('[C2P] pay error:', e);
      setError(e.message);
      setStage(STAGES.ERROR);
    }
  }

  // ── Sequence diagram route ──────────────────────────────────
  if (window.location.search.includes('diagram')) {
    return (
      <div style={{ padding: '32px', background: '#f5f6f8', minHeight: '100vh' }}>
        <div style={{ maxWidth: 1020, margin: '0 auto' }}>
          <h1 style={{ fontFamily: '-apple-system, sans-serif', fontSize: 22, marginBottom: 4 }}>
            Click to Pay — Sequence Diagram
          </h1>
          <p style={{ color: '#666', fontSize: 13, marginBottom: 24, fontFamily: 'sans-serif' }}>
            Full API flow: Session → SDK → Wallet → Pay
          </p>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', padding: '24px 16px' }}>
            <SequenceDiagram />
          </div>
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#999', fontFamily: 'sans-serif' }}>
            <a href="/" style={{ color: '#6366f1' }}>← Back to Checkout</a>
          </p>
        </div>
      </div>
    );
  }

  if (!config) return <div className="container">Loading config…</div>;

  // ── Configuration settings (browser-stored gateway credentials) ──
  const gearBtn = (
    <button
      className="gear-btn"
      onClick={() => setShowSettings(true)}
      title="Configuration settings"
      aria-label="Configuration settings"
    >⚙</button>
  );
  const settingsOverlay = showSettings ? (
    <Settings
      defaults={config}
      onClose={() => setShowSettings(false)}
      onSaved={refreshConfig}
    />
  ) : null;
  const configBanner = !config.configured ? (
    <div className="config-banner">
      <span>⚠ No API credentials configured — the payment flow will fail until you set them.</span>
      <button onClick={() => setShowSettings(true)}>Open Settings</button>
    </div>
  ) : null;

  // ── Inner checkout column content (shared by both views) ────
  const sdkActive = stage !== STAGES.IDLE && stage !== STAGES.STARTING && stage !== STAGES.ERROR;

  const isReceipt = stage === STAGES.PAID && payResult?.ok;
  const isStore   = stage === STAGES.STORE;

  // ── Store landing page ─────────────────────────────────────
  if (isStore) {
    return (
      <div className="layout-store">
        {gearBtn}
        {configBanner}
        <StoreCheckout
          config={config}
          onChooseClickToPay={() => setStage(STAGES.IDLE)}
          onChooseCard={() => setStage(STAGES.IDLE)}
        />
        {settingsOverlay}
      </div>
    );
  }

  const checkoutColumn = isReceipt ? (
    <div className="container">
      <div className="receipt">
        <div className="receipt-icon">✓</div>
        <h2 className="receipt-title">Payment Approved</h2>
        <p className="receipt-subtitle">Your payment was processed successfully.</p>

        <div className="receipt-card">
          <div className="receipt-row">
            <span className="receipt-label">Amount</span>
            <span className="receipt-value receipt-amount">{config.amount} {config.currency}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">Order ID</span>
            <span className="receipt-value receipt-mono">{order?.orderId}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">Gateway Code</span>
            <span className="receipt-value receipt-badge">{payResult.gatewayCode}</span>
          </div>
          <div className="receipt-row">
            <span className="receipt-label">Gateway</span>
            <span className="receipt-value receipt-mono">{config.gatewayHost}</span>
          </div>
        </div>

        <button onClick={() => {
          setStage(STAGES.STORE);
          setOrder(null);
          setPayResult(null);
          setError(null);
          setEvents([]);
          setEmail('');
        }}>
          Continue Shopping
        </button>
      </div>
    </div>
  ) : (
    <div className="container">
      <div className="app-header">
        <button
          className="back-link"
          onClick={() => {
            setStage(STAGES.STORE);
            setEvents([]);
            setError(null);
          }}
          title="Back to cart"
        >← Back</button>
        <div className="app-header-dot" />
        <h1 className="app-title">Click to Pay</h1>
        <span className="app-subtitle">Hosted Session</span>
      </div>

      <div className="info-grid">
        <div className="info-card info-card--wide">
          <span className="info-card-label">Amount</span>
          <span className="info-card-value info-card-amount">{config.amount} <em>{config.currency}</em></span>
        </div>
        <div className="info-card info-card--wide">
          <span className="info-card-label">Gateway</span>
          <span className="info-card-value info-card-mono">{config.gatewayHost}</span>
        </div>
        {order && (
          <>
            <div className="info-card info-card--wide">
              <span className="info-card-label">Order ID</span>
              <span className="info-card-value info-card-mono">{order.orderId}</span>
            </div>
            <div className="info-card info-card--wide">
              <span className="info-card-label">Session ID</span>
              <span className="info-card-value info-card-mono" style={{ fontSize: 10 }}>{order.sessionId}</span>
            </div>
          </>
        )}
      </div>

      {stage !== STAGES.C2P_NEW_CARD && (
      <>
      {/* ── Email-based flow (returning shopper, no cookie) ─────── */}
      <div className="email-section">
        <label className="email-label">
          Email address <span className="email-required">*</span>
        </label>
        <div className="email-row">
          <input
            type="email"
            className="email-input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={stage !== STAGES.IDLE && stage !== STAGES.ERROR && stage !== STAGES.C2P_READY}
          />
          {stage === STAGES.C2P_READY && (
            <button className="btn-lookup" onClick={lookupCustomer}>Lookup</button>
          )}
        </div>
        <p className="email-help">
          We'll use your email to find cards already saved in your Click to Pay wallet.
        </p>
      </div>

      {stage === STAGES.IDLE || stage === STAGES.ERROR ? (
        <button onClick={() => startCheckout('email')} disabled={!isValidEmail(email)}>
          {isValidEmail(email) ? 'Continue with Email' : 'Enter email to continue'}
        </button>
      ) : stage === STAGES.C2P_READY ? (
        <button onClick={checkoutWithExistingCard}>Checkout with existing card</button>
      ) : (
        <button disabled className="btn-processing">
          <span className="btn-spinner" /> Processing…
        </button>
      )}

      {/* ── Alternate flows (only shown before checkout starts) ── */}
      {(stage === STAGES.IDLE || stage === STAGES.ERROR) && (
        <div className="alt-flows">
          <div className="alt-flows-divider"><span>or</span></div>

          <button
            className="alt-flow-btn alt-flow-btn--cookie"
            onClick={() => startCheckout('cookie')}
          >
            <span className="alt-flow-icon">🍪</span>
            <span className="alt-flow-text">
              <span className="alt-flow-title">Use saved card</span>
              <span className="alt-flow-sub">If you've shopped here before with Click to Pay</span>
            </span>
          </button>

          <button
            className="alt-flow-btn alt-flow-btn--new"
            onClick={() => startCheckout('new')}
          >
            <span className="alt-flow-icon">＋</span>
            <span className="alt-flow-text">
              <span className="alt-flow-title">Add a new card</span>
              <span className="alt-flow-sub">First time using Click to Pay — enrol a card</span>
            </span>
          </button>
        </div>
      )}
      </>
      )}

      {/* ── New-card enrollment: Hosted Session fields → checkoutWithNewCard ── */}
      {stage === STAGES.C2P_NEW_CARD && (
        <div className="new-card-form">
          <h3 className="new-card-title">Enrol a new card</h3>
          <p className="new-card-sub">
            Enter your card details. We'll save it to your Click to Pay wallet for faster checkout next time.
          </p>

          <label className="card-label">Card number</label>
          <input id="nc-number" className="card-input card-input--full" readOnly />

          <div className="card-row card-row--three">
            <div>
              <label className="card-label">Exp. month</label>
              <input id="nc-exp-month" className="card-input" placeholder="MM" readOnly />
            </div>
            <div>
              <label className="card-label">Exp. year</label>
              <input id="nc-exp-year" className="card-input" placeholder="YY" readOnly />
            </div>
            <div>
              <label className="card-label">CVV</label>
              <input id="nc-cvv" className="card-input" placeholder="123" readOnly />
            </div>
          </div>

          <label className="card-label">Name on card</label>
          <input id="nc-name" className="card-input card-input--full" readOnly />

          <button className="store-pay-button" onClick={submitNewCard} disabled={newCardBusy}>
            {newCardBusy
              ? <><span className="btn-spinner" /> Processing…</>
              : <>Pay {config.amount} {config.currency} &amp; enrol</>}
          </button>

          {newCardStatus && <div className="status error">⚠ {newCardStatus}</div>}
        </div>
      )}

      {/* Hidden during new-card enrollment: a recognized device auto-renders its saved
          wallet here, which is confusing on an "enrol a new card" screen. */}
      <SdkPlaceholder id="c2p-cardList" label="Card list will appear here" active={sdkActive} hidden={stage === STAGES.C2P_NEW_CARD} />
      <SdkPlaceholder id="c2p-otp"      label="OTP input will appear here"  active={sdkActive} hidden={stage === STAGES.C2P_NEW_CARD} />
      <div id="c2p-dcf" />

      {error && <div className="status error">⚠ {error}</div>}
    </div>
  );

  if (isReceipt) {
    return (
      <div className="layout-with-panel">
        {gearBtn}
        <main className="layout-with-panel-main">{checkoutColumn}</main>
        <ApiPanel events={events} onClear={() => setEvents([])} />
        {settingsOverlay}
      </div>
    );
  }

  return (
    <div className="layout-single">
      {gearBtn}
      {configBanner}
      {checkoutColumn}
      {settingsOverlay}
    </div>
  );
}
