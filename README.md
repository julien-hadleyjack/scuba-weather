# Scuba Weather

Phone-first PWA that shows dive-relevant weather for one dive spot: rain, thunderstorms,
wind and waves for today and tomorrow (Morning / Afternoon / Night), plus a 3-day outlook.
Not a safety tool.

What the app does and why: [SPEC.md](SPEC.md). Wireframes: [view in the browser](https://htmlpreview.github.io/?https://github.com/julien-hadleyjack/scuba-weather/blob/main/docs/wireframes/index.html) (via htmlpreview.github.io; sources and details in [docs/wireframes/](docs/wireframes/README.md)).

## Run

Requires Node.js 22 or newer (`.nvmrc` pins the major version).

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit + component tests (Vitest)
npm run coverage   # tests with coverage report (text + coverage/index.html)
npm run check      # svelte-check / TypeScript
npm run build      # production build in dist/ (with service worker)
npm run preview    # serve dist/ locally
npm run icons      # re-render PNG icons from assets/icon.svg
```

The build uses a relative `base`, so `dist/` can be served from a domain root or a
GitHub Pages project path as-is.

## Layout

| Path | What |
|---|---|
| `src/lib/thresholds.ts` | All classification constants (rain, CAPE, wind, waves, blocks, refresh ages) |
| `src/lib/classify.ts` | Pure classification rules (§4) |
| `src/lib/dashboard.ts` | Forecast → Today/Tomorrow/Next days view model, past-block dimming, chart data |
| `src/lib/time.ts` | Spot-local time helpers (all times use the spot's time zone) |
| `src/lib/status.ts` | Auto-refresh rule and banner priority (OFF-3…OFF-7) |
| `src/lib/api.ts` | Open-Meteo Forecast, Marine and Geocoding clients |
| `src/lib/storage.ts` | Spot + last forecast in `localStorage` |
| `src/lib/app-state.svelte.ts` | App state and refresh behaviour |
| `src/components/` | Dashboard, day grid, hourly chart, outlook, banners, spot picker (lazy, with Leaflet) |

## Data and credits

Weather data: [Open-Meteo](https://open-meteo.com/) (CC BY 4.0), free non-commercial tier.
Map: © OpenStreetMap contributors. Font: Inter (SIL OFL), bundled.
