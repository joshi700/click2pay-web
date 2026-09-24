import React, { useState } from 'react';

// TechGear storefront — styled after mgplayground.vercel.app. Catalogue is static
// demo data; the cart total is what gets charged through the Click to Pay flow.

const IMG = 'https://mgplayground.vercel.app';
const HERO_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmDiaBzcIm0iuBWsJNQNwSjOGFO9VTRWVLnc_5Xq84Tx6Cy2ScueSD9z0TbpTHhHvPsORFrv9VzVDxUMakWenGrewI7usesPltQqKRmGH2txYboHXx2t2ZLkBLk62njFe_lQ-RVKhcXMwvi556omgCK4UHQH41GVturtRLMjXl669mJu8zW_Ebu4u6uTgavBkDwE-RXAiO94ovsuzMfoKf5IRDb8Wa_0CyPqFCnzpeBSXy86itttYR6Jpx3tH9AIJtCM4Ez2HPvH8';
const EDITOR_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_Gb-GIXtK4y3f-MFpb3U0pMYhEoS4UNpnXNqa87qhVOljTyG5PGMrZU4Ol8Xna8NLYSDPCPSNKgZMyDJ-AotO7OCVFbkuPKpMSEfGmLyHNPZganthHKeFuQ3OCQKFMoyKny0O6chpxEo37EL7vnucWa2nh25QEZhSDlHpPrIngRtmmaUGuY_PgKQcslLv6__RjNkczvBdO7lnKvgGk_cBk7Icgf_8ClBwRBxN8pt-QRCguwXBnj6TgP9iNW_uAEgJiTcnhFFWe3o';

export const PRODUCTS = [
  {
    id: 'mechkey-pro-60',
    name: 'MechKey Pro 60%',
    category: 'Peripherals',
    price: 249,
    rating: 4.9,
    reviews: 86,
    image: `${IMG}/keyboard1.png`,
    tagline: 'Hot-swappable 60% mechanical keyboard with per-key RGB.',
    specs: [
      ['Layout', '60% · 61 keys'],
      ['Switches', 'Linear, hot-swappable'],
      ['Connectivity', 'USB-C, Bluetooth 5.1, 2.4 GHz'],
      ['Battery', 'Up to 200 hours (RGB off)'],
      ['Keycaps', 'Double-shot PBT'],
    ],
  },
  {
    id: 'velocity-wireless',
    name: 'Velocity Wireless',
    category: 'Peripherals',
    price: 149,
    rating: 4.7,
    reviews: 128,
    image: `${IMG}/mouse1.png`,
    tagline: 'Ultralight wireless gaming mouse tuned for esports.',
    specs: [
      ['Sensor', '26K DPI optical'],
      ['Weight', '63 g'],
      ['Polling rate', '4000 Hz wireless'],
      ['Battery', 'Up to 90 hours'],
      ['Connectivity', '2.4 GHz, USB-C'],
    ],
  },
  {
    id: 'sonic-blast-headset',
    name: 'Sonic Blast Headset',
    category: 'Gadgets',
    price: 199,
    rating: 4.8,
    reviews: 1200,
    image: `${IMG}/headset1.png`,
    tagline: 'Closed-back headset with spatial audio and a detachable boom mic.',
    specs: [
      ['Drivers', '50 mm graphene'],
      ['Audio', '7.1 spatial surround'],
      ['Microphone', 'Detachable, noise-cancelling'],
      ['Connectivity', '2.4 GHz, Bluetooth, 3.5 mm'],
      ['Battery', 'Up to 60 hours'],
    ],
  },
  {
    id: 'spectre-x15',
    name: 'Spectre X15 Laptop',
    category: 'Computers',
    price: 1299,
    rating: 4.8,
    reviews: 124,
    image: `${IMG}/laptop1.png`,
    tagline: 'A mobile workstation built for creators and competitive gamers.',
    specs: [
      ['Display', '15.6" QHD, 240 Hz'],
      ['Processor', '14-core, up to 5.4 GHz'],
      ['Graphics', 'RTX-class, 8 GB'],
      ['Memory', '32 GB DDR5'],
      ['Storage', '1 TB NVMe SSD'],
    ],
  },
];

const COLLECTIONS = [
  { tag: 'Performance', title: 'The Elite Suite', image: `${IMG}/laptop1.png`, category: 'Computers',
    body: 'Uncompromising power for those who demand the absolute best in processing and graphics.' },
  { tag: 'Tactile', title: 'Aesthetic Precision', image: `${IMG}/keyboard1.png`, category: 'Peripherals',
    body: 'Crafted for touch. Mechanical masterpieces that respond to your every impulse.' },
  { tag: 'Immersion', title: 'Sonic Mastery', image: `${IMG}/headset1.png`, category: 'Gadgets',
    body: 'Isolate the noise. Hear every footstep. Total auditory domination.' },
];

const CATEGORIES = ['Computers', 'Peripherals', 'Gadgets'];

const findProduct = (id) => PRODUCTS.find((p) => p.id === id);

export function cartTotal(cart) {
  return cart.reduce((sum, line) => sum + (findProduct(line.id)?.price || 0) * line.qty, 0);
}

function money(n, currency) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency, minimumFractionDigits: n % 1 ? 2 : 0,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

const Icon = ({ name, filled, className = '' }) => (
  <span className={`material-symbols-outlined ${filled ? 'filled' : ''} ${className}`} aria-hidden="true">{name}</span>
);

function Stars({ rating }) {
  const r = Math.round(rating * 2) / 2;
  return (
    <span className="tg-stars" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Icon key={i} name={r === i - 0.5 ? 'star_half' : 'star'} filled={r >= i - 0.5} />
      ))}
    </span>
  );
}

// ── Header / footer ───────────────────────────────────────────
function Header({ cartCount, query, onQuery, go }) {
  return (
    <header className="tg-header">
      <div className="tg-wrap tg-header-inner">
        <button className="tg-logo" onClick={() => go({ page: 'home' })}>
          <span className="tg-logo-mark"><Icon name="terminal" /></span>
          <span className="tg-logo-text">TechGear</span>
        </button>
        <nav className="tg-nav">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => go({ page: 'shop', category: c })}>{c}</button>
          ))}
        </nav>
        <div className="tg-header-actions">
          <form
            className="tg-search"
            onSubmit={(e) => { e.preventDefault(); go({ page: 'shop' }); }}
          >
            <input
              placeholder="Search products..."
              value={query}
              onChange={(e) => { onQuery(e.target.value); if (e.target.value) go({ page: 'shop' }); }}
              aria-label="Search products"
            />
            <Icon name="search" />
          </form>
          <button className="tg-icon-btn" onClick={() => go({ page: 'cart' })} aria-label={`Cart, ${cartCount} items`}>
            <Icon name="shopping_cart" />
            {cartCount > 0 && <span className="tg-badge">{cartCount}</span>}
          </button>
          <button className="tg-icon-btn" aria-label="Account" title="Accounts are coming soon">
            <Icon name="person" />
          </button>
        </div>
      </div>
    </header>
  );
}

function Footer({ go }) {
  return (
    <footer className="tg-footer">
      <div className="tg-wrap tg-footer-grid">
        <div>
          <div className="tg-logo tg-logo--static">
            <span className="tg-logo-mark"><Icon name="terminal" /></span>
            <span className="tg-logo-text">TechGear</span>
          </div>
          <p className="tg-footer-blurb">
            Equipping gamers and creators with the ultimate hardware to perform at their best.
            Sophisticated tools for elite minds.
          </p>
        </div>
        <div>
          <h4>Shop</h4>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => go({ page: 'shop', category: c })}>{c}</button>
          ))}
          <button onClick={() => go({ page: 'shop' })}>New Arrivals</button>
        </div>
        <div>
          <h4>Support</h4>
          <span>Help Center</span>
          <span>Warranty</span>
          <span>Contact Us</span>
          <span>Order Status</span>
        </div>
        <div>
          <h4>Connect</h4>
          <div className="tg-footer-social">
            <Icon name="public" /><Icon name="alternate_email" /><Icon name="rss_feed" />
          </div>
        </div>
      </div>
      <div className="tg-wrap tg-footer-bottom">
        <span>© {new Date().getFullYear()} TechGear Inc. All rights reserved.</span>
        <span className="tg-footer-legal"><span>Privacy</span><span>Terms</span></span>
      </div>
    </footer>
  );
}

// ── Shared product card ───────────────────────────────────────
function ProductCard({ p, currency, wished, onWish, onOpen }) {
  return (
    <article className="tg-card">
      <div className="tg-card-media" style={{ backgroundImage: `url(${p.image})` }} onClick={onOpen}>
        <button
          className={`tg-wish ${wished ? 'is-on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onWish(); }}
          aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <Icon name="favorite" filled={wished} />
        </button>
      </div>
      <div className="tg-card-row">
        <h3>{p.name}</h3>
        <span className="tg-price">{money(p.price, currency)}</span>
      </div>
      <div className="tg-card-rating">
        <Icon name="star" /> {p.rating} ({p.reviews})
      </div>
      <button className="tg-btn tg-btn--outline tg-btn--block" onClick={onOpen}>View Details</button>
    </article>
  );
}

function ProductGrid({ products, currency, wishlist, toggleWish, go }) {
  return (
    <div className="tg-grid">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          p={p}
          currency={currency}
          wished={wishlist.includes(p.id)}
          onWish={() => toggleWish(p.id)}
          onOpen={() => go({ page: 'product', id: p.id })}
        />
      ))}
    </div>
  );
}

// ── Pages ─────────────────────────────────────────────────────
function Home({ currency, wishlist, toggleWish, go }) {
  const [slide, setSlide] = useState(0);
  const flagship = findProduct('spectre-x15');

  return (
    <>
      <section className="tg-hero">
        <div className="tg-hero-copy">
          <span className="tg-eyebrow"><span className="tg-dot" />New Arrivals</span>
          <h1>Level Up<br /><em>Your Gear</em></h1>
          <p>
            Experience peak performance with our curated selection of elite gaming rigs and
            peripherals designed for champions.
          </p>
          <div className="tg-hero-ctas">
            <button className="tg-btn" onClick={() => go({ page: 'shop' })}>Browse Collection</button>
            <button className="tg-btn tg-btn--outline" onClick={() => go({ page: 'product', id: flagship.id })}>
              View Flagship
            </button>
          </div>
        </div>

        <button className="tg-hero-feature" onClick={() => go({ page: 'product', id: flagship.id })}>
          <div className="tg-hero-img" style={{ backgroundImage: `url(${HERO_IMG})` }} />
          <div className="tg-hero-caption">
            <div>
              <span className="tg-label">Featured Product</span>
              <strong>Spectre X15 Workstation</strong>
            </div>
            <Icon name="north_east" />
          </div>
        </button>

        <aside className="tg-hero-side">
          <div className="tg-quote">
            <Icon name="verified" className="tg-accent" />
            <span className="tg-label">Editor's Choice</span>
            <blockquote>"The Spectre X15 redefines what a mobile workstation can achieve. It is simply in a class of its own."</blockquote>
            <div className="tg-byline">
              <img src={EDITOR_IMG} alt="" />
              <span>Sarah Jenkins, TechDaily</span>
            </div>
          </div>
          <div className="tg-quote">
            <Stars rating={4.5} />
            <span className="tg-label">User Insight</span>
            <blockquote>"Unmatched precision in every click. A true pro-grade experience for everyday use."</blockquote>
          </div>
          <div className="tg-hero-warranty">
            <span className="tg-label">Warranty Info</span>
            <span>3-Year Premium Support</span>
          </div>
        </aside>
      </section>

      <section className="tg-section tg-wrap">
        <div className="tg-section-head">
          <div>
            <span className="tg-label">Explore</span>
            <h2 className="tg-serif">Curated Collections</h2>
            <p className="tg-muted">
              Immerse yourself in our narrative browsing experience. Each collection tells a story of
              performance, aesthetics, and lifestyle.
            </p>
          </div>
          <div className="tg-arrows">
            <button onClick={() => setSlide((s) => Math.max(0, s - 1))} disabled={slide === 0} aria-label="Previous">
              <Icon name="arrow_back" />
            </button>
            <button
              onClick={() => setSlide((s) => Math.min(COLLECTIONS.length - 1, s + 1))}
              disabled={slide === COLLECTIONS.length - 1}
              aria-label="Next"
            >
              <Icon name="arrow_forward" />
            </button>
          </div>
        </div>
        <div className="tg-carousel">
          <div className="tg-carousel-track" style={{ '--slide': slide }}>
            {COLLECTIONS.map((c) => (
              <button
                key={c.title}
                className="tg-collection"
                style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,.6), rgba(0,0,0,0)), url(${c.image})` }}
                onClick={() => go({ page: 'shop', category: c.category })}
              >
                <span className="tg-chip">{c.tag}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="tg-section tg-section--ruled tg-wrap">
        <div className="tg-section-head tg-section-head--line">
          <h2>Trending Hardware</h2>
          <button className="tg-link" onClick={() => go({ page: 'shop' })}>View All <Icon name="north_east" /></button>
        </div>
        <ProductGrid products={PRODUCTS} currency={currency} wishlist={wishlist} toggleWish={toggleWish} go={go} />
      </section>
    </>
  );
}

function Shop({ category, query, currency, wishlist, toggleWish, go }) {
  const q = query.trim().toLowerCase();
  const products = PRODUCTS.filter((p) =>
    (!category || p.category === category) &&
    (!q || `${p.name} ${p.category} ${p.tagline}`.toLowerCase().includes(q))
  );
  return (
    <section className="tg-section tg-wrap">
      <div className="tg-section-head tg-section-head--line">
        <div>
          <span className="tg-label">{q ? `Results for “${query.trim()}”` : 'Shop'}</span>
          <h2>{category || 'All Hardware'}</h2>
        </div>
        <div className="tg-filters">
          <button className={!category ? 'is-on' : ''} onClick={() => go({ page: 'shop' })}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} className={category === c ? 'is-on' : ''} onClick={() => go({ page: 'shop', category: c })}>{c}</button>
          ))}
        </div>
      </div>
      {products.length
        ? <ProductGrid products={products} currency={currency} wishlist={wishlist} toggleWish={toggleWish} go={go} />
        : <p className="tg-empty">No products match your search.</p>}
    </section>
  );
}

function ProductPage({ id, currency, wishlist, toggleWish, inCart, addToCart, go }) {
  const p = findProduct(id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  if (!p) return <Shop category={null} query="" currency={currency} wishlist={wishlist} toggleWish={toggleWish} go={go} />;
  const wished = wishlist.includes(p.id);
  const related = PRODUCTS.filter((x) => x.id !== p.id).slice(0, 3);

  return (
    <>
      <section className="tg-wrap tg-pdp">
        <nav className="tg-crumbs">
          <button onClick={() => go({ page: 'home' })}>Home</button>
          <span>/</span>
          <button onClick={() => go({ page: 'shop', category: p.category })}>{p.category}</button>
          <span>/</span>
          <span>{p.name}</span>
        </nav>

        <div className="tg-pdp-grid">
          <div className="tg-pdp-media" style={{ backgroundImage: `url(${p.image})` }} />
          <div className="tg-pdp-info">
            <span className="tg-label">{p.category}</span>
            <h1>{p.name}</h1>
            <div className="tg-pdp-rating">
              <Stars rating={p.rating} /> <span>{p.rating} · {p.reviews.toLocaleString()} reviews</span>
            </div>
            <div className="tg-pdp-price">{money(p.price, currency)}</div>
            <p className="tg-muted">{p.tagline}</p>

            <div className="tg-stock"><span className="tg-stock-dot" /> In stock · ships in 1–2 business days</div>

            <div className="tg-pdp-buy">
              <div className="tg-qty">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
                <span>{qty}</span>
                <button onClick={() => setQty((q) => Math.min(9, q + 1))} aria-label="Increase quantity">+</button>
              </div>
              <button
                className="tg-btn tg-btn--grow"
                onClick={() => { addToCart(p.id, qty); setAdded(true); }}
              >
                {added ? 'Added to Cart' : 'Add to Cart'}
              </button>
              <button
                className={`tg-icon-btn tg-icon-btn--box ${wished ? 'is-on' : ''}`}
                onClick={() => toggleWish(p.id)}
                aria-label={wished ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <Icon name="favorite" filled={wished} />
              </button>
            </div>
            <button
              className="tg-btn tg-btn--outline tg-btn--block"
              onClick={() => { if (!inCart) addToCart(p.id, qty); go({ page: 'cart' }); }}
            >
              Buy Now
            </button>
            {added && (
              <button className="tg-link tg-link--inline" onClick={() => go({ page: 'cart' })}>
                View cart <Icon name="north_east" />
              </button>
            )}

            <dl className="tg-specs">
              {p.specs.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>

            <ul className="tg-perks">
              <li><Icon name="verified_user" /> 3-Year Premium Warranty</li>
              <li><Icon name="local_shipping" /> Free express delivery</li>
              <li><Icon name="undo" /> 30-day returns</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="tg-section tg-section--ruled tg-wrap">
        <div className="tg-section-head tg-section-head--line">
          <h2>Complete Your Setup</h2>
        </div>
        <ProductGrid products={related} currency={currency} wishlist={wishlist} toggleWish={toggleWish} go={go} />
      </section>
    </>
  );
}

function Cart({ cart, setQty, currency, onCheckout, go }) {
  const total = cartTotal(cart);
  const inCart = new Set(cart.map((l) => l.id));
  const suggestion = PRODUCTS.find((p) => !inCart.has(p.id));

  if (!cart.length) {
    return (
      <section className="tg-section tg-wrap tg-cart-empty">
        <Icon name="shopping_cart" />
        <h2 className="tg-serif">Your cart is empty</h2>
        <p className="tg-muted">Discover our curated hardware and build your ultimate setup.</p>
        <button className="tg-btn" onClick={() => go({ page: 'shop' })}>Browse Collection</button>
      </section>
    );
  }

  return (
    <section className="tg-section tg-wrap">
      <div className="tg-section-head tg-section-head--line">
        <h2>Your Cart</h2>
        <button className="tg-link" onClick={() => go({ page: 'shop' })}>Continue Shopping <Icon name="north_east" /></button>
      </div>

      <div className="tg-cart">
        <div className="tg-cart-lines">
          {cart.map((line) => {
            const p = findProduct(line.id);
            return (
              <div className="tg-line" key={line.id}>
                <button
                  className="tg-line-img"
                  style={{ backgroundImage: `url(${p.image})` }}
                  onClick={() => go({ page: 'product', id: p.id })}
                  aria-label={p.name}
                />
                <div className="tg-line-meta">
                  <span className="tg-label">{p.category}</span>
                  <h3>{p.name}</h3>
                  <div className="tg-qty tg-qty--sm">
                    <button onClick={() => setQty(p.id, line.qty - 1)} aria-label="Decrease quantity">−</button>
                    <span>{line.qty}</span>
                    <button onClick={() => setQty(p.id, Math.min(9, line.qty + 1))} aria-label="Increase quantity">+</button>
                  </div>
                </div>
                <div className="tg-line-end">
                  <span className="tg-price">{money(p.price * line.qty, currency)}</span>
                  <button className="tg-remove" onClick={() => setQty(p.id, 0)}>Remove</button>
                </div>
              </div>
            );
          })}

          {suggestion && (
            <div className="tg-crosssell">
              <div className="tg-line-img" style={{ backgroundImage: `url(${suggestion.image})` }} />
              <div>
                <span className="tg-label">Complete your setup</span>
                <strong>{suggestion.name}</strong>
                <span className="tg-price">{money(suggestion.price, currency)}</span>
              </div>
              <button className="tg-btn tg-btn--outline" onClick={() => setQty(suggestion.id, 1)}>Add</button>
            </div>
          )}
        </div>

        <aside className="tg-summary">
          <h3>Order Summary</h3>
          <div className="tg-summary-row"><span>Subtotal</span><span>{money(total, currency)}</span></div>
          <div className="tg-summary-row"><span>Shipping</span><span className="tg-accent">Free</span></div>
          <div className="tg-summary-row tg-summary-row--total"><span>Total</span><span>{money(total, currency)}</span></div>

          <button className="tg-ctp" onClick={onCheckout}>
            <span className="tg-ctp-mark">»</span>
            <span className="tg-ctp-text">
              <strong>Checkout with Click to Pay</strong>
              <small>Use a saved card — no typing</small>
            </span>
            <Icon name="arrow_forward" />
          </button>
          <p className="tg-secure"><Icon name="lock" /> Secure checkout · Mastercard Gateway</p>
        </aside>
      </div>
    </section>
  );
}

// ── Shell ─────────────────────────────────────────────────────
export default function Storefront({ view, go, cart, setCart, currency, onCheckout, banner, gearBtn }) {
  const [query, setQuery] = useState('');
  const [wishlist, setWishlist] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);

  const toggleWish = (id) => setWishlist((w) => (w.includes(id) ? w.filter((x) => x !== id) : [...w, id]));

  const addToCart = (id, qty) => setCart((c) => {
    const line = c.find((l) => l.id === id);
    return line
      ? c.map((l) => (l.id === id ? { ...l, qty: Math.min(9, l.qty + qty) } : l))
      : [...c, { id, qty }];
  });

  const setQty = (id, qty) => setCart((c) => {
    if (qty <= 0) return c.filter((l) => l.id !== id);
    return c.some((l) => l.id === id)
      ? c.map((l) => (l.id === id ? { ...l, qty } : l))
      : [...c, { id, qty }];
  });

  const navigate = (next) => {
    if (next.page !== 'shop') setQuery('');
    go(next);
    window.scrollTo({ top: 0 });
  };

  const shared = { currency, wishlist, toggleWish, go: navigate };
  const cartCount = cart.reduce((n, l) => n + l.qty, 0);

  return (
    <div className="tg">
      {banner}
      <Header cartCount={cartCount} query={query} onQuery={setQuery} go={navigate} />
      <main>
        {view.page === 'home' && <Home {...shared} />}
        {view.page === 'shop' && <Shop {...shared} category={view.category} query={query} />}
        {view.page === 'product' && <ProductPage key={view.id} {...shared} id={view.id} inCart={cart.some((l) => l.id === view.id)} addToCart={addToCart} />}
        {view.page === 'cart' && <Cart cart={cart} setQty={setQty} currency={currency} onCheckout={onCheckout} go={navigate} />}
      </main>
      <Footer go={navigate} />

      {gearBtn}
      <div className="tg-ai">
        {aiOpen && (
          <div className="tg-ai-pop" role="dialog">
            <strong>TechGear AI</strong>
            <p>The AI shopping assistant is coming soon. It will help you compare products and build your setup.</p>
          </div>
        )}
        <button className="tg-ai-btn" onClick={() => setAiOpen((o) => !o)}>
          <Icon name="chat_bubble" /> Ask AI
        </button>
      </div>
    </div>
  );
}
