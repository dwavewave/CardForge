# CardForge v0.2.1

CardForge is a local tabletop card studio for creating, organizing, and printing 63 × 88 mm reference cards. It runs in a browser without an account or backend.

## Run locally

Use Node.js 22.12 or newer and npm. From the CardForge directory:

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Vite prints the local URL. Use the same browser profile and origin to see your saved library. For offline and installation testing, use the production preview or serve `dist/` over HTTPS. The development server skips service worker registration.

## Make cards

1. Choose Spell, NPC RP, Plot Point, Monster, or Custom. Each can use any of the four ornamental frames or the Classic style. Pick a theme and use the Front and Back preview buttons.
2. Quick-reference fields start on the front. Longer fields typically start on the reverse. Use the selector beside each field to move it. Automatic reverse mode uses the dragon-compass artwork when the back is empty. Information mode always uses a framed reverse. Decorative mode keeps any reverse content saved while hiding it in output.
3. Add editable color tags with optional symbols. Under **Collection and artwork**, optionally assign a collection or import a JPEG, PNG, or WebP. Pick a side, then adjust crop zoom and horizontal and vertical focus while looking at the preview.
4. Select **Save card** to keep it. **Duplicate** opens a copy for editing. Search by title, subtitle, collection or tag. Use **Frame grid** for thumbnail browsing.
5. The renderer tries three type sizes, down to a 6.24 pt body. If it warns about overflow, check both previews, move fields or shorten text. **Create & save continuation cards** splits longer text while retaining both sides. Export either selected side as a 744 × 1039 PNG.

## Print and calibrate

1. Queue saved cards from the library and arrange their order in **Print queue**. Choose **Single-sided**, **Duplex · long edge**, or **Duplex · short edge**. Single-sided output contains fronts. Duplex alternates a front page and its matching back page, with unused slots blank.
2. **Prepare A4 PDF**, then **Download PDF** or **Open PDF**. Print portrait A4 at **100% / actual size**, with fitting disabled. Match the edge option in your printer dialog to CardForge. The default 2 mm gap leaves 8.5 mm on each side and 14.5 mm at the top and bottom before offsets.
3. Use **Prepare duplex test sheet** before printing cards. Measure the 20 mm ruler and hold the sheet to light to compare corresponding numbered corners. Adjust back X/Y in millimeters if needed and save offsets under a printer name. Positive X moves right and positive Y moves down when looking at the PDF back page. Reprint the test after adjusting.
4. Crop marks are optional. Safe area and bleed guides are proof overlays. The exterior guide shows available gutter space without adding artwork outside the trim. Printer hardware margins and feed accuracy vary. Test on plain paper before trimming or laminating.

## Install and back up

- On iPhone, open the HTTPS app in Safari and use **Share → Add to Home Screen**. On a supported desktop browser, use its install command. Open the app online once so the service worker can finish caching. When updating, close other CardForge tabs and standalone windows before reopening.
- On iPhone, try **Open PDF** and the system Share sheet to print or save to Files. **Share PDF** appears when the browser reports support for file sharing. Actual iPhone installation and export are pending device verification.
- **Export library** saves cards, image crops, queue order, and printer settings to JSON. **Import JSON** validates the file and asks before replacing the current library. v0.1 backups and browser data migrate in place. Existing fields stay on the front, with the Classic frame and single-sided printing. Keep regular backups because browser storage is tied to the origin and can be cleared or evicted.

See [implementation notes](docs/V02_IMPLEMENTATION.md), [acceptance evidence](docs/V02_ACCEPTANCE.md), and the [v0.1 reference audit](docs/REFERENCE_AUDIT.md).


## Cloudflare Workers

Build with `npm run build` and deploy using the checked-in `wrangler.jsonc` and Wrangler 4. Deploy to the **existing Worker name and hostname** so browsers keep access to their saved libraries. If that name differs from `cardforge`, pass the existing name with `npx wrangler@4 deploy --name <existing-worker-name>`.

After updating, open the app online, then close every CardForge tab and Home Screen instance and reopen. If the root still shows Safari’s redirect error, open `/recover` on the same hostname to let the browser fetch the update. See the [service worker release notes](docs/V021_SERVICE_WORKER.md) for the recovery sequence and verification status.
