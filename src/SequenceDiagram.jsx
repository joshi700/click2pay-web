export default function SequenceDiagram() {
  const actors = ['Shopper', 'Browser / iOS', 'Your Backend', 'C2P JS SDK', 'Mastercard Gateway'];

  const COL = [80, 230, 420, 610, 820];
  const START_Y = 100;
  const ROW_H = 52;
  const ACTOR_H = 44;

  const COLORS = {
    shopper:  '#f97316',
    browser:  '#6366f1',
    backend:  '#0ea5e9',
    sdk:      '#a855f7',
    gateway:  '#10b981',
  };

  const actorColors = [
    COLORS.shopper,
    COLORS.browser,
    COLORS.backend,
    COLORS.sdk,
    COLORS.gateway,
  ];

  const steps = [
    // Step 1 — Start Checkout
    { type: 'group', label: 'Step 1 — Create & Configure Session', color: '#f97316' },
    { from: 0, to: 1, label: 'Click "Start Checkout"', color: COLORS.shopper },
    { from: 1, to: 2, label: 'POST /api/checkout/start', color: COLORS.browser },
    { from: 2, to: 4, label: 'POST /session  (create blank session)', color: COLORS.backend },
    { from: 4, to: 2, label: '← sessionId', color: COLORS.gateway, dashed: true },
    { from: 2, to: 4, label: 'PUT /session/:id  (attach amount, orderId)', color: COLORS.backend },
    { from: 4, to: 2, label: '← session updated', color: COLORS.gateway, dashed: true },
    { from: 2, to: 4, label: 'POST /paymentOptionsInquiry', color: COLORS.backend },
    { from: 4, to: 2, label: '← paymentOptions (schemes, dpaId)', color: COLORS.gateway, dashed: true },
    { from: 2, to: 1, label: '← { sessionId, paymentOptions, amount }', color: COLORS.backend, dashed: true },

    // Step 2 — SDK
    { type: 'group', label: 'Step 2 — SDK Wallet Selection', color: '#6366f1' },
    { from: 1, to: 3, label: 'loadScript(click-to-pay.min.js)', color: COLORS.browser },
    { from: 3, to: 1, label: '← SDK ready (window.ClickToPay)', color: COLORS.sdk, dashed: true },
    { from: 1, to: 3, label: 'ClickToPay.configure({ merchant, session, order, payer })', color: COLORS.browser },
    { from: 3, to: 4, label: 'identityLookup (shopper email)', color: COLORS.sdk },
    { from: 4, to: 3, label: '← consumerPresent: true', color: COLORS.gateway, dashed: true },
    { from: 3, to: 0, label: 'Render OTP input', color: COLORS.sdk },
    { from: 0, to: 3, label: 'Enter OTP', color: COLORS.shopper },
    { from: 3, to: 4, label: 'initiateValidation / validate', color: COLORS.sdk },
    { from: 4, to: 3, label: '← authenticated', color: COLORS.gateway, dashed: true },
    { from: 3, to: 0, label: 'Render card list (3 cards found)', color: COLORS.sdk },
    { from: 0, to: 3, label: 'Select card → DCF popup opens', color: COLORS.shopper },
    { from: 0, to: 3, label: 'Confirm in DCF', color: COLORS.shopper },
    { from: 3, to: 1, label: 'onComplete(correlationId, scheme)', color: COLORS.sdk },

    // Step 3 — Wallet Link
    { type: 'group', label: 'Step 3 — Link Wallet to Session', color: '#0ea5e9' },
    { from: 1, to: 2, label: 'POST /api/checkout/:id/wallet  { correlationId, scheme }', color: COLORS.browser },
    { from: 2, to: 4, label: 'POST /session/:id  (UPDATE_SESSION_FROM_WALLET)', color: COLORS.backend },
    { from: 4, to: 2, label: '← session updated, card tokenised', color: COLORS.gateway, dashed: true },
    { from: 2, to: 1, label: '← { ok: true }', color: COLORS.backend, dashed: true },

    // Step 4 — Pay
    { type: 'group', label: 'Step 4 — Charge the Card', color: '#10b981' },
    { from: 1, to: 2, label: 'POST /api/checkout/:id/pay', color: COLORS.browser },
    { from: 2, to: 4, label: 'PUT /order/:id/transaction/:id  (PAY)', color: COLORS.backend },
    { from: 4, to: 2, label: '← result: SUCCESS  gatewayCode: APPROVED', color: COLORS.gateway, dashed: true },
    { from: 2, to: 1, label: '← { ok: true, gatewayCode: "APPROVED" }', color: COLORS.backend, dashed: true },
    { from: 1, to: 0, label: '🎉 Show receipt page', color: COLORS.browser },
  ];

  // Calculate total rows (groups don't get a row, messages do)
  let msgIndex = 0;
  const laid = steps.map(s => {
    if (s.type === 'group') return { ...s, y: null };
    const y = START_Y + ACTOR_H + msgIndex * ROW_H;
    msgIndex++;
    return { ...s, y };
  });

  const totalMsgs = msgIndex;
  const svgH = START_Y + ACTOR_H + totalMsgs * ROW_H + 60;
  const svgW = 980;

  function arrowPath(x1, x2, y) {
    const right = x2 > x1;
    const mx = right ? x2 - 10 : x2 + 10;
    return `M${x1},${y} L${mx},${y}`;
  }

  function arrowHead(x1, x2, y) {
    const right = x2 > x1;
    if (right) {
      return `M${x2 - 10},${y - 5} L${x2},${y} L${x2 - 10},${y + 5}`;
    } else {
      return `M${x2 + 10},${y - 5} L${x2},${y} L${x2 + 10},${y + 5}`;
    }
  }

  // Assign y to group labels based on the next message's y
  let lastGroupY = null;
  const finalLaid = laid.map((s, i) => {
    if (s.type === 'group') {
      // find next message y
      for (let j = i + 1; j < laid.length; j++) {
        if (laid[j].y !== null) {
          return { ...s, y: laid[j].y - 32 };
        }
      }
    }
    return s;
  });

  return (
    <div style={{ overflowX: 'auto', padding: '24px 0' }}>
      <svg width={svgW} height={svgH} style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <defs>
          {actorColors.map((c, i) => (
            <marker key={i} id={`arrow-${i}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={c} />
            </marker>
          ))}
          <marker id="arrow-dashed" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
          </marker>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#00000015" />
          </filter>
        </defs>

        {/* Lifelines */}
        {COL.map((x, i) => (
          <line
            key={i}
            x1={x} y1={START_Y + ACTOR_H}
            x2={x} y2={svgH - 30}
            stroke={actorColors[i]}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.35"
          />
        ))}

        {/* Actor boxes */}
        {actors.map((a, i) => (
          <g key={i}>
            <rect
              x={COL[i] - 60} y={START_Y}
              width={120} height={ACTOR_H}
              rx="8"
              fill={actorColors[i]}
              filter="url(#shadow)"
            />
            <text
              x={COL[i]} y={START_Y + 26}
              textAnchor="middle"
              fill="white"
              fontSize="11"
              fontWeight="600"
            >
              {a}
            </text>
          </g>
        ))}

        {/* Messages & Groups */}
        {finalLaid.map((s, i) => {
          if (s.type === 'group') {
            return (
              <g key={i}>
                <rect
                  x={28} y={s.y - 14}
                  width={svgW - 56} height={22}
                  rx="4"
                  fill={s.color}
                  opacity="0.12"
                />
                <text
                  x={40} y={s.y + 3}
                  fill={s.color}
                  fontSize="11"
                  fontWeight="700"
                  letterSpacing="0.5"
                >
                  {s.label.toUpperCase()}
                </text>
              </g>
            );
          }

          const x1 = COL[s.from];
          const x2 = COL[s.to];
          const y = s.y;
          const colorIdx = s.dashed ? -1 : s.from;
          const strokeColor = s.dashed ? '#94a3b8' : s.color;
          const markerId = s.dashed ? 'arrow-dashed' : `arrow-${s.from}`;
          const midX = (x1 + x2) / 2;
          const above = y - 6;

          return (
            <g key={i}>
              <line
                x1={x1} y1={y}
                x2={x2} y2={y}
                stroke={strokeColor}
                strokeWidth={s.dashed ? 1.5 : 2}
                strokeDasharray={s.dashed ? '5 3' : 'none'}
                markerEnd={`url(#${markerId})`}
              />
              <text
                x={midX}
                y={above}
                textAnchor="middle"
                fill={s.dashed ? '#64748b' : s.color}
                fontSize="10"
                fontWeight={s.dashed ? '400' : '500'}
              >
                {s.label}
              </text>
            </g>
          );
        })}

        {/* Bottom actor repeat */}
        {actors.map((a, i) => (
          <g key={i}>
            <rect
              x={COL[i] - 60} y={svgH - 50}
              width={120} height={ACTOR_H}
              rx="8"
              fill={actorColors[i]}
              filter="url(#shadow)"
            />
            <text
              x={COL[i]} y={svgH - 22}
              textAnchor="middle"
              fill="white"
              fontSize="11"
              fontWeight="600"
            >
              {a}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
