# Bitcoin Dashboard website

A static, dependency-free dashboard (network stats, block explorer search, fee and mempool panels). It is independent of the Bitcoin Core node code and build.

## Data sources
Read-only calls to a public mempool.space/esplora-compatible API. Configure via [`config.json`](config.json) (`apiBase`, `refreshSeconds`) or the Settings panel (stored in `localStorage`). Endpoints must be `https` (or `http` on localhost) and must not contain credentials. **Never put node RPC credentials in this site**; it does not talk to bitcoind RPC. If an API call fails, the panel shows an error instead of placeholder data.

## Preview
```
cd website
python3 -m http.server 8080   # then open http://localhost:8080
```

## Test
```
cd website && npm test        # Node >= 18, no install needed
```
Covers input classification, endpoint validation, formatting, error handling and static security checks (CSP present, no inline scripts, no `innerHTML`, no RPC credentials).

## Deployment
`.github/workflows/website.yml` tests the site and deploys `website/` to GitHub Pages on pushes to `master` that touch `website/`. Enable Pages (Source: GitHub Actions) in repo settings first.

## Accessibility
Skip link, landmarks, labelled form controls, live regions for status/errors, visible focus, reduced-motion support, and responsive layouts down to mobile widths.
