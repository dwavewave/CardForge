# CardForge v0.2.1 service worker fix

## Cause

v0.2 precached `/index.html` with `Cache.addAll()` and normal redirect following. Cloudflare Workers’ default HTML handling can serve that path with a 307 to `/`. The fetch can still succeed, but Cache Storage keeps the followed response, including its redirect history. v0.2 returned that response unchanged when navigating to either `/` or `/index.html`. A browser can reject a redirected service worker response when the navigation request does not allow redirect following. Vite’s local preview served the HTML directly, so it did not reproduce the deployment behavior. [Cloudflare HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/) · [Fetch Standard](https://fetch.spec.whatwg.org/)

## Resolution

- Wrangler serves `dist/` with HTML canonicalization disabled and SPA fallback enabled. `/index.html` is the exact shell asset. Root and deep-link navigations also serve the app without a redirect. The production build keeps `/sw.js` at the root and leaves the Cloudflare `_headers` file out of precache. [Cloudflare SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- The worker fetches the shell and precaches build assets with redirect mode `error`. It checks that the shell is a direct 200 HTML response before storing it and before serving it. It also rejects an HTML fallback returned for a missing asset, so a partial deployment cannot replace a working cache. In-scope SPA navigations use that single cached shell, while asset requests retain their own cache keys. If the shell is missing, the worker requests the same explicit HTML URL and returns a 503 if no valid shell is available.
- The worker URL and scope are unchanged. A complete new cache is prepared before activation. The worker waits for old documents to close so they can still use their original bundles. On activation, it deletes only superseded CardForge caches for that scope. Card libraries, artwork, settings and printer offsets stay in localStorage. The update does not write or clear application data.

## Deployment and recovery

1. Run `npm ci`, `npm test`, and `npm run build`. Deploy the built assets using the checked-in Wrangler configuration. Keep the production Worker name and `workers.dev` hostname so existing registrations and browser data stay on the same origin.
2. To check the deployment, request `/index.html` and `/sw.js` over HTTPS without following redirects. Both should return 200 directly. Expect HTML for the first and JavaScript for the second. Also open the root and a deep link in a browser. Both should load without a redirect.
3. On an affected device, open CardForge online to let the browser fetch the update. If the root still errors, open `https://<existing-host>/recover` online in the affected browser or web app when possible. This route uses the SPA fallback and is outside v0.2’s navigation interception rules. Close all CardForge tabs and quit any standalone CardForge window, then reopen after a moment. Avoid clearing website data because it contains the library.
4. On iPhone, verify the update in Safari and in an existing Home Screen installation. Reload online, then enable Airplane Mode, relaunch, edit and save a card, and generate a PDF.

## Verification

- Wrangler’s local Workers runtime reproduced `307 Location: /` for `/index.html` with default routing. The new configuration served root, the exact shell URL, and a deep navigation with no redirect. The worker, manifest, fonts and artwork are same-origin static assets.
- Chromium over local HTTPS reproduced a cached response with `redirected: true` and a failed v0.2 navigation. The failed navigation triggered a worker update. After the old tabs closed, v0.2.1 reopened with the original library, artwork and calibration offsets. It retained unrelated Cache Storage entries. Fresh installation, controlled online reload, offline deep-link reload, offline edits after reload, and offline PDF generation passed.
- All 51 tests and the production build passed. The regression suite exercises the actual worker source, including rejection of followed redirects, failed asset precaching, offline navigation, and scope-limited cleanup.
- The live `workers.dev` deployment and physical iPhone Safari and Home Screen operation remain unverified.
