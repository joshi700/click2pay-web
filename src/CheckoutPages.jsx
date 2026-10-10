import React from 'react';
import { findProduct, money, Icon } from './Storefront.jsx';

// TechGear-styled checkout + receipt. All Click to Pay / Hosted Session logic stays
// in App.jsx; these components only render state and call back into it.

const BUSY_LABELS = {
  STARTING: 'Creating a secure payment session…',
  C2P_CONFIGURING: 'Loading Click to Pay…',
  WALLET_LINKING: 'Retrieving your card from Click to Pay…',
  PAYING: 'Authorising your payment…',
};

const titleCase = (s) => String(s).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

function Progress({ step }) {
  const steps = ['Cart', 'Checkout', 'Confirmation'];
  return (
    <ol className="tg-progress">
      {steps.map((label, i) => (
        <li key={label} className={i < step ? 'is-done' : i === step ? 'is-current' : ''}>
          <span className="tg-progress-num">{i < step ? <Icon name="check" /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function OrderLines({ lines, currency }) {
  return (
    <ul className="tg-mini-lines">
      {lines.map((line) => {
        const p = findProduct(line.id);
        if (!p) return null;
        return (
          <li key={line.id}>
            <span className="tg-mini-img" style={{ backgroundImage: `url(${p.image})` }}>
              <span className="tg-mini-qty">{line.qty}</span>
            </span>
            <span className="tg-mini-name">{p.name}</span>
            <span className="tg-mini-price">{money(p.price * line.qty, currency)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Totals({ amount, currency }) {
  const total = Number(amount) || 0;
  return (
    <>
      <div className="tg-summary-row"><span>Subtotal</span><span>{money(total, currency)}</span></div>
      <div className="tg-summary-row"><span>Shipping</span><span className="tg-accent">Free</span></div>
      <div className="tg-summary-row tg-summary-row--total"><span>Total</span><span>{money(total, currency)}</span></div>
    </>
  );
}

// SDK mount point — must stay in the DOM while the SDK is active; hidden via style
// rather than unmounted.
function SdkSlot({ id, label, active, hidden }) {
  return (
    <div
      id={id}
      className={`sdk-placeholder ${active ? 'sdk-placeholder--active' : ''}`}
      data-label={label}
      style={hidden ? { display: 'none' } : undefined}
    />
  );
}

export function CheckoutPage({
  stage, email, setEmail, emailValid,
  onStart, onLookup, onExisting, onSubmitNewCard,
  newCardBusy, newCardStatus, error,
  lines, amount, currency, onBack, onOpenDev,
}) {
  const idle = stage === 'IDLE' || stage === 'ERROR';
  const ready = stage === 'C2P_READY';
  const newCard = stage === 'C2P_NEW_CARD';
  const busyLabel = BUSY_LABELS[stage];
  const sdkActive = !idle && stage !== 'STARTING';

  return (
    <section className="tg-wrap tg-checkout">
      <Progress step={1} />

      <div className="tg-checkout-grid">
        <div className="tg-checkout-main">
          <h1 className="tg-page-title">Checkout</h1>

          {/* 01 — Contact */}
          <div className="tg-step">
            <div className="tg-step-head">
              <span className="tg-step-num">01</span>
              <h2>Contact</h2>
            </div>
            <label className="tg-field-label" htmlFor="tg-email">Email address</label>
            <div className="tg-email-row">
              <input
                id="tg-email"
                type="email"
                className="tg-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={!idle && !ready}
                autoComplete="email"
              />
              {ready && (
                <button className="tg-btn tg-btn--outline" onClick={onLookup}>Look up</button>
              )}
            </div>
            <p className="tg-help">We use your email to find cards saved in your Click to Pay wallet.</p>
          </div>

          {/* 02 — Payment */}
          <div className="tg-step">
            <div className="tg-step-head">
              <span className="tg-step-num">02</span>
              <h2>Payment</h2>
            </div>

            <div className="tg-c2p-panel">
              <div className="tg-c2p-head">
                <span className="tg-ctp-mark">»</span>
                <div>
                  <strong>Click to Pay</strong>
                  <small>Pay with a card saved to your Click to Pay wallet</small>
                </div>
                <span className="tg-c2p-brands">Visa · Mastercard · Amex · Discover</span>
              </div>

              {idle && (
                <div className="tg-c2p-body">
                  <button className="tg-btn tg-btn--block" onClick={() => onStart('email')} disabled={!emailValid}>
                    {emailValid ? 'Continue with Click to Pay' : 'Enter your email to continue'}
                  </button>
                  <div className="tg-or"><span>or</span></div>
                  <div className="tg-options">
                    <button className="tg-option" onClick={() => onStart('cookie')}>
                      <Icon name="devices" />
                      <span>
                        <strong>Use a card saved on this device</strong>
                        <small>If you've paid with Click to Pay in this browser before</small>
                      </span>
                      <Icon name="arrow_forward" />
                    </button>
                    <button className="tg-option" onClick={() => onStart('new')}>
                      <Icon name="add_card" />
                      <span>
                        <strong>Add a new card</strong>
                        <small>First time with Click to Pay — enrol a card</small>
                      </span>
                      <Icon name="arrow_forward" />
                    </button>
                  </div>
                </div>
              )}

              {ready && (
                <div className="tg-c2p-body">
                  <p className="tg-help">Choose a card or enter the code sent to you below, then continue.</p>
                  <button className="tg-btn tg-btn--block" onClick={onExisting}>Checkout with existing card</button>
                </div>
              )}

              {busyLabel && (
                <div className="tg-c2p-body">
                  <div className="tg-busy"><span className="tg-spinner" /> {busyLabel}</div>
                </div>
              )}

              {newCard && (
                <div className="tg-c2p-body tg-newcard">
                  <p className="tg-help">
                    Enter your card details. We'll save the card to your Click to Pay wallet for faster checkout next time.
                  </p>
                  <label className="tg-field-label" htmlFor="nc-number">Card number</label>
                  <input id="nc-number" className="tg-input" readOnly />
                  <div className="tg-field-row">
                    <div>
                      <label className="tg-field-label" htmlFor="nc-exp-month">Exp. month</label>
                      <input id="nc-exp-month" className="tg-input" placeholder="MM" readOnly />
                    </div>
                    <div>
                      <label className="tg-field-label" htmlFor="nc-exp-year">Exp. year</label>
                      <input id="nc-exp-year" className="tg-input" placeholder="YY" readOnly />
                    </div>
                    <div>
                      <label className="tg-field-label" htmlFor="nc-cvv">CVV</label>
                      <input id="nc-cvv" className="tg-input" placeholder="123" readOnly />
                    </div>
                  </div>
                  <label className="tg-field-label" htmlFor="nc-name">Name on card</label>
                  <input id="nc-name" className="tg-input" readOnly />
                  <button className="tg-btn tg-btn--block" onClick={onSubmitNewCard} disabled={newCardBusy}>
                    {newCardBusy
                      ? <><span className="tg-spinner tg-spinner--light" /> Processing…</>
                      : <>Pay {money(Number(amount), currency)} &amp; enrol card</>}
                  </button>
                  {newCardStatus && <div className="tg-alert">{newCardStatus}</div>}
                </div>
              )}

              {/* Hidden during new-card enrollment: a recognised device auto-renders its
                  saved wallet here, which is confusing on an "add a new card" screen. */}
              <div className="tg-c2p-sdk">
                <SdkSlot id="c2p-cardList" label="Your Click to Pay cards will appear here" active={sdkActive} hidden={newCard} />
                <SdkSlot id="c2p-otp" label="Verification code entry will appear here" active={sdkActive} hidden={newCard} />
                <div id="c2p-dcf" />
              </div>

              {error && (
                <div className="tg-alert">
                  <strong>Payment couldn't be completed.</strong>
                  <span className="tg-alert-detail">{error}</span>
                  <button className="tg-link" onClick={onOpenDev}>See API calls <Icon name="north_east" /></button>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="tg-summary">
          <h3>Order Summary</h3>
          <OrderLines lines={lines} currency={currency} />
          <Totals amount={amount} currency={currency} />
          <button className="tg-link tg-summary-back" onClick={onBack}>
            <Icon name="arrow_back" /> Back to cart
          </button>
          <p className="tg-secure"><Icon name="lock" /> Secure checkout · Mastercard Gateway</p>
        </aside>
      </div>
    </section>
  );
}

export function ReceiptPage({ lines, amount, currency, email, orderId, scheme, gatewayCode, onContinue, onOpenDev }) {
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <section className="tg-wrap tg-receipt">
      <Progress step={3} />

      <div className="tg-receipt-hero">
        <span className="tg-receipt-icon"><Icon name="check" /></span>
        <span className="tg-eyebrow"><span className="tg-dot" />Order confirmed</span>
        <h1>Thank you for <em>your order</em></h1>
        <p className="tg-muted">
          Your payment was approved with Click to Pay.
          {email ? <> A confirmation would normally be sent to <strong>{email}</strong>.</> : null}
        </p>
      </div>

      <div className="tg-receipt-grid">
        <div className="tg-receipt-card">
          <h3>Order Details</h3>
          <dl className="tg-specs">
            <div><dt>Order number</dt><dd className="tg-mono">{orderId}</dd></div>
            <div><dt>Date</dt><dd>{date}</dd></div>
            <div><dt>Payment</dt><dd>Click to Pay{scheme ? ` · ${titleCase(scheme)}` : ''}</dd></div>
            <div><dt>Gateway result</dt><dd><span className="tg-pill">{gatewayCode}</span></dd></div>
            <div><dt>Delivery</dt><dd>Free express · 1–2 business days</dd></div>
          </dl>
        </div>

        <div className="tg-receipt-card">
          <h3>Items</h3>
          <OrderLines lines={lines} currency={currency} />
          <Totals amount={amount} currency={currency} />
        </div>
      </div>

      <div className="tg-receipt-actions">
        <button className="tg-btn" onClick={onContinue}>Continue Shopping</button>
        <button className="tg-btn tg-btn--outline" onClick={onOpenDev}>
          <Icon name="code" /> View API calls
        </button>
      </div>
    </section>
  );
}
