# Click2Pay — Web

React + Vite browser client for **Mastercard Gateway Click to Pay (Hosted Session)**.
Renders the store/checkout, loads `click-to-pay.min.js` from the gateway, and drives
the flow through the backend API.

## Run locally

```bash
npm install
npm run dev               # http://localhost:5173
```

The dev server proxies `/api/*` to the backend on `:4000` (see `vite.config.js`).
Start the backend first.

## Configuration (Settings)

The **⚙ gear** (top-right) opens **Configuration Settings**: Merchant ID, API
Username, API Password, API Base URL, API Version. Values are saved to
`localStorage` and sent to the backend as `x-c2p-*` headers on every request, so the
demo can point at any test MID from the browser — no redeploy. Leave a field blank to
fall back to the backend's `.env`.

## Deploy (Vercel)

Import this repo as a Vercel project (Framework: **Vite**, auto-detected). Set:

| Key | Value |
|---|---|
| `VITE_API_BASE` | the deployed backend URL, e.g. `https://click2pay-backend.vercel.app` |

`VITE_API_BASE` is read at build time (`src/api.js`); leave it unset locally to use
the Vite proxy. Change it → redeploy the web project. See `DEPLOY.md` in the parent
project for the full walkthrough.

## Files

- `src/App.jsx` — checkout UI + Click to Pay flow orchestration
- `src/Settings.jsx` — Configuration Settings modal
- `src/settings.js` — localStorage + `x-c2p-*` header helpers
- `src/api.js` — backend HTTP client (prefixes `VITE_API_BASE`, attaches settings headers)
- `src/SequenceDiagram.jsx` — `?diagram` view of the API flow
