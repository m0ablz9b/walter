# Walter

Kidnapping-proof Crypto Tax Calculator.

Walter is a browser-only app for computing French crypto capital gains tax reports following **Article 150 VH bis CGI**. All data stays in your browser's localStorage — no server, no database, no tracking.

## Features

- **Tax computation** — applies the French formula with 31.4% PFU flat tax on net gains
- **Transaction types** — buy, sell, swap, transfer, revenue (staking/mining/lending)
- **CSV import** — auto-detects French exchange format (Waltio, Coqonut) via header matching
- **CSV export** — export filtered transactions
- **Historical prices** — fetches from CryptoCompare API, with manual override support
- **Stablecoin handling** — EUR-pegged (1 EUR), USD-pegged (0.92 EUR), RealToken (skipped)
- **Portfolio overview** — current holdings with valuations
- **Per-year tax reports** — detailed sale-by-sale breakdown
- **Bulk edit** — select multiple transactions and update a field at once
- **Transfer merge** — combine matching transfer pairs into a single record

## Getting started

```bash
npm install
npm run dev
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | TypeScript check + production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build |

## Tech stack

React 19, TypeScript 5.9, Vite 7, Tailwind CSS v4, Recharts, PapaParse.

## Disclaimer

Walter is a personal tool for estimating crypto capital gains under French tax law. It is not certified tax software and does not constitute tax advice. Consult a qualified professional for your official tax return.
