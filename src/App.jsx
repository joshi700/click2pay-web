import React, { useEffect, useState, useRef } from 'react';
import { api, loadScript } from './api.js';
import SequenceDiagram from './SequenceDiagram.jsx';
import Settings from './Settings.jsx';
import Storefront, { cartTotal, money, Icon } from './Storefront.jsx';
import { CheckoutPage, ReceiptPage } from './CheckoutPages.jsx';

const STAGES = {
  STORE: 'STORE',           // TechGear storefront (home / shop / product / cart)
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

// ── Developer view — slide-out drawer with the live API log + flow diagram ──
function DevDrawer({ open, setOpen, events, onClear, info }) {
  const [tab, setTab] = useState('network');
  const calls = groupEvents(events).filter(i => i.kind === 'txn').length;

  return (
    <>
      <button className="tg-devtab" onClick={() => setOpen(true)} aria-label="Open developer view">
        <Icon name="code" /> <span className="tg-devtab-label">Developer view</span>
        {calls > 0 && <span className="tg-devtab-count">{calls}</span>}
      </button>
      <div className={`tg-drawer-backdrop ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`tg-drawer ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label="Developer view">
        <div className="tg-drawer-head">
          <div>
            <span className="tg-label">Developer view</span>
            <h3>Behind the checkout</h3>
          </div>
          <button className="tg-icon-btn" onClick={() => setOpen(false)} aria-label="Close developer view">
            <Icon name="close" />
          </button>
        </div>
        <dl className="tg-drawer-meta">
          {info.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <div className="tg-drawer-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'network'} className={tab === 'network' ? 'is-on' : ''} onClick={() => setTab('network')}>
            Network calls
          </button>
          <button role="tab" aria-selected={tab === 'flow'} className={tab === 'flow' ? 'is-on' : ''} onClick={() => setTab('flow')}>
            Flow diagram
          </button>
        </div>
        <div className="tg-drawer-body">
          {tab === 'network'
            ? <ApiPanel events={events} onClear={onClear} />
            : <div className="tg-drawer-diagram"><SequenceDiagram /></div>}
        </div>
      </aside>
    </>
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
  const [storeView, setStoreView] = useState({ page: 'home' });
  const [cart, setCart] = useState([]);
  const [amount, setAmount] = useState(null);  // cart total locked in when checkout starts
  const [checkoutLines, setCheckoutLines] = useState([]);  // cart snapshot shown on checkout + receipt
  const [paidScheme, setPaidScheme] = useState(null);
  const [devOpen, setDevOpen] = useState(false);

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
        { amount, currency: config.currency },
        () => api.start(amount, config.currency)
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
        merchant: { id: config.merchantId, name: 'TechGear', url: window.location.origin },
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
            // The C2P SDK often returns only {errorCode, errorMessage}; dump the
            // whole payload so any extra fields Mastercard sends are visible
            // on-screen (no DevTools needed on mobile).
            const code = errInfo?.errorCode || errInfo?.reason || 'ERROR';
            const msg = errInfo?.errorMessage || errInfo?.message || '';
            let detail = '';
            try {
              const full = JSON.stringify(errInfo);
              if (full && full !== '{}') detail = full;
            } catch { /* ignore non-serialisable payloads */ }
            setError(`${code}: ${msg}${detail ? `\n${detail}` : ''}`);
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
      setPaidScheme(scheme);
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
      if (resp.ok) setCart([]);  // order placed — the receipt shows the checkoutLines snapshot
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

  if (!config) return <div className="tg tg-loading">Loading…</div>;

  // Any store navigation abandons an in-progress checkout (or leaves the receipt).
  function goStore(next) {
    if (stage !== STAGES.STORE) {
      setStage(STAGES.STORE);
      setOrder(null);
      setPayResult(null);
      setError(null);
      setEvents([]);
      setDevOpen(false);
    }
    setStoreView(next);
    window.scrollTo({ top: 0 });
  }

  const openSettings = () => goStore({ page: 'settings' });

  const gearBtn = (
    <button className="gear-btn" onClick={openSettings} title="Store settings" aria-label="Store settings">⚙</button>
  );
  const configBanner = !config.configured ? (
    <div className="config-banner">
      <span>No gateway credentials configured — payments will fail until you add them.</span>
      <button onClick={openSettings}>Open Settings</button>
    </div>
  ) : null;

  const isReceipt = stage === STAGES.PAID && payResult?.ok;
  const devDrawer = (
    <DevDrawer
      open={devOpen}
      setOpen={setDevOpen}
      events={events}
      onClear={() => setEvents([])}
      info={[
        ['Amount', amount && money(Number(amount), config.currency)],
        ['Gateway', config.gatewayHost],
        ['Order ID', order?.orderId],
        ['Session ID', order?.sessionId],
      ]}
    />
  );

  let page = null;
  if (storeView.page === 'settings') {
    page = <Settings defaults={config} onBack={() => goStore({ page: 'home' })} onSaved={refreshConfig} />;
  } else if (isReceipt) {
    page = (
      <>
        <ReceiptPage
          lines={checkoutLines}
          amount={amount}
          currency={config.currency}
          email={email}
          orderId={order?.orderId}
          scheme={paidScheme}
          gatewayCode={payResult.gatewayCode}
          onContinue={() => { setEmail(''); goStore({ page: 'home' }); }}
          onOpenDev={() => setDevOpen(true)}
        />
        {devDrawer}
      </>
    );
  } else if (stage !== STAGES.STORE) {
    page = (
      <>
        <CheckoutPage
          stage={stage}
          email={email}
          setEmail={setEmail}
          emailValid={isValidEmail(email)}
          onStart={startCheckout}
          onLookup={lookupCustomer}
          onExisting={checkoutWithExistingCard}
          onSubmitNewCard={submitNewCard}
          newCardBusy={newCardBusy}
          newCardStatus={newCardStatus}
          error={error}
          lines={checkoutLines}
          amount={amount}
          currency={config.currency}
          onBack={() => goStore({ page: 'cart' })}
          onOpenDev={() => setDevOpen(true)}
        />
        {devDrawer}
      </>
    );
  }

  return (
    <Storefront
      view={storeView}
      go={goStore}
      cart={cart}
      setCart={setCart}
      currency={config.currency}
      banner={configBanner}
      gearBtn={gearBtn}
      onCheckout={() => {
        setCheckoutLines(cart);
        setAmount(cartTotal(cart).toFixed(2));
        setPaidScheme(null);
        setError(null);
        setEvents([]);
        setStage(STAGES.IDLE);
        window.scrollTo({ top: 0 });
      }}
    >
      {page}
    </Storefront>
  );
}
