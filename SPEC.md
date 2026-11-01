# Scuba Weather: specification

Single source for what the app does and why. Combines the planning decisions and the requirements. Wireframes: [`docs/wireframes/`](docs/wireframes/index.html).

Requirement IDs (SPOT-, DASH-, DATA-, OFF-, NFR-, TEST-) are stable and referenced from code and tests.

**Ranges** are always written as "from X" (included) and "below Y" (not included), so every value falls into exactly one range.

## 1. Product

**One-liner:** a phone-first dashboard that tells a diver in about 5 seconds whether today and tomorrow look good for diving, and when the bad weather is likely to hit.

**Core questions:** rain (all day vs. showers vs. short heavy bursts, and when), storms / thunderstorm risk, sea state (waves, wind).

**Principles:**
- Facts first, details second. No overall score: show facts, highlight marginal and poor values.
- Dive-shaped time blocks instead of hourly rows.
- Only data that affects a dive decision.
- Fast, offline-capable, data age always visible.
- Honest about uncertainty. Not a safety tool.

**Scope:**
- One dive spot at a time, chosen by search and a movable pin. Only the last chosen spot is kept.
- Today and tomorrow in detail (three blocks each), days 3–5 as an outlook.
- Extra dive data: water temperature, tide as a curve (no times or heights), night shading from sunrise/sunset.
- Single user, worldwide, English, metric, wind in km/h, 24-hour times.

**Out of scope:** underwater visibility, currents, navigation-grade marine data, notifications, accounts, saved spot lists, "use my location", rain radar, dark mode, other languages or units, a backend.

## 2. Screens

| Screen | Wireframe |
|---|---|
| Dashboard | [dashboard.html](docs/wireframes/dashboard.html) |
| Choose dive spot, before a search | [spot-before-search.html](docs/wireframes/spot-before-search.html) |
| Choose dive spot, search results open | [spot-search-results.html](docs/wireframes/spot-search-results.html) |
| Choose dive spot, place chosen | [spot-place-chosen.html](docs/wireframes/spot-place-chosen.html) |
| Banners, messages, markers | [states.html](docs/wireframes/states.html) |

The wireframes are static mockups at 390 px with sample data. Where they and this document differ in text or behaviour, this document wins.

## 3. Choosing the dive spot

- **SPOT-1** On first launch (no spot stored) the app opens the "Choose dive spot" screen.
- **SPOT-2** The screen has a search field at the top. From 2 typed characters, the app queries the Open-Meteo Geocoding API (debounced, ~300 ms) and shows up to 5 results below the field, each with name and region/country (region = first-level region and country, e.g. "Surat Thani, Thailand"). States in the list: "Searching…", "No places found.", "Search failed. Check your connection." The search follows the accessible combobox pattern (arrow keys, Enter, Escape). Choosing a result cancels any search that is still pending or running, so the list stays closed.
- **SPOT-3** Until a search result has been chosen, there is no map and no bottom sheet. The map area shows a search icon and one line: "Search for a place, island or dive site above." (Offline: "You are offline. Choosing a dive spot needs a connection.") This makes clear that the pin can't be placed without a search. Choosing a result shows the map centred on it (zoom 12) with the pin there. Choosing another result later moves the map.
- **SPOT-4** The map (Leaflet + OpenStreetMap tiles) has a fixed pin in the centre; the user drags the map to move the pin. Zoom buttons and pinch zoom work.
- **SPOT-5** The land check runs only when the user taps "Use this spot", not while the map moves. The app requests the Marine API's current `wave_height` for the pin position: a value means "on water" (the spot is saved), null means "on land", a failed request means "Check failed". Moving the map, or choosing another search result, cancels a running check and clears its result (also when the map doesn't actually move).
  - *Why on save:* every water-based value (waves, water temperature, tide curve, and any added later) needs marine data at the spot, so a saved spot must always have it; checking once on save avoids a request for every map move.
  - *Known limitation:* marine data comes in squares of about 8 km, so pins near a coast or on a small island usually count as water. Only clearly inland points are rejected.
- **SPOT-6** Bottom sheet (only once a result has been chosen): spot name and region/country (from the chosen search result, not editable, kept when the pin is moved away), coordinates ("10.06° N, 99.82° E", updated when the map stops moving), a short hint ("Drag the map to move the pin onto open water close to your dive site."), and the "Use this spot" button. After a failed check, an amber status above the hint: "Pin is on land" (hint: "Move the pin onto open water, then try again.") or "Check failed" (hint: "Couldn't check this position. Tap the button to try again.").
- **SPOT-7** "Use this spot" runs the land check (SPOT-5). While it runs, the button is disabled and reads "Checking position…" with a spinner. After "Pin is on land", the button stays disabled until the map is moved; after "Check failed", it can be tapped again. Offline, the button is disabled.
- **SPOT-8** Saving a spot stores name, region/country, and the pin's latitude and longitude on the device (replacing any previous spot and its forecast) and opens the dashboard. A refresh still running for the previous spot is ignored: its result is discarded and it doesn't end the new spot's loading state; the new spot's refresh starts right away.
- **SPOT-9** The map code is loaded only when this screen opens (lazy loading).
- **SPOT-10** When a spot is already stored, the screen opens with that spot's name and the map at its position, and shows a back button that returns to the dashboard without changes.

## 4. Dashboard

### 4.1 Header
- **DASH-1** Shows the spot name (large), region/country, and a "change spot" button (search icon) that opens the spot screen.
- **DASH-2** Shows the data age as a duration only: "Updated AGE", e.g. "Updated 5 h ago" (see 7.1). No clock times. A small dot before it: green normally, amber when a banner is shown, grey when offline.
- **DASH-3** A refresh icon button in the header, next to the "change spot" button. It is the only retry control: banners have no buttons of their own. While a refresh runs, the icon spins and the button is disabled. It is also disabled while offline.

### 4.2 Today and Tomorrow
- **DASH-4** Two sections, "Today" and "Tomorrow", each with the weekday and date of the spot's local calendar day ("Sun 1 Nov"). Both are always fully visible.
- **DASH-5** Each section has a grid: rows **Rain, Storms, Wind, Waves** × columns **Morning 06–12, Afternoon 12–18, Night 18–24** (spot local time; a block covers the hours starting at 06, 07 … 11 etc.). All three blocks are 6 hours, so the columns are equally wide and the chart below keeps one time scale across the day. Long labels may be hyphenated rather than overflow.
- **DASH-6** Each cell shows a severity icon, the full label, and optionally a detail line, using the marker style (section 6). Cell contents are defined in section 5.
- **DASH-7** Below the grid, one continuous hourly chart (06–24) spanning all three columns, with no gaps between the blocks; thin dashed lines at 12 and 18 mark the block boundaries:
  - rain bars per hour, by intensity:
    - dry (below 0.1 mm/h): a flat grey line
    - drizzle (from 0.1, below 0.5): a very low, pale bar (3 px)
    - light (from 0.5, below 2.5), moderate (from 2.5, below 7.6), heavy (from 7.6): bars in three blues, light to dark
    - bar height 2.85 px per mm/h, at least 5 px, at most 68 px (68 px ≈ 24 mm/h)
  - the tide as a line through the hourly sea level at 06 … 24 (24 = the next day's 00:00; on the last forecast day the line ends at 23), scaled between the lowest and highest value of the calendar day (00–23) and that 24:00 point; no times or heights shown
  - night shading for the hours before sunrise and after sunset; no shading when the day has no sunrise or sunset (polar day/night)
  - hour labels every 2 hours (06, 08 … 22), each centered under the bar of the hour it names (the 06 bar is 06:00–06:59)
  - a small key: Tide / Night / Rain per hour
  - a text alternative per block, e.g. "Afternoon: rain in 3 of 6 hours, peak 14 mm/h at 15:00, tide rising, partly dark"
- **DASH-8** Below the chart: "Water NN °C" (average sea surface temperature of the hours 06–23, rounded; "–" without data).
- **DASH-9** Blocks of today that are already over are dimmed (column header, cells and their part of the chart, 45 % opacity), but stay visible. A block counts as over once its last hour has ended in spot local time.
  - *Accessibility exception:* dimmed text falls below the 4.5:1 contrast of NFR-3. Accepted for now as "inactive" content; to be reviewed after real-world use.

### 4.3 Next days
- **DASH-10** A compact grid for days 3–5: one row per day (weekday + date), columns **Rain, Storms, Wind, Waves**. Each cell uses the same rules as a block, applied to the whole day window 06–24, and shows the short form (5.5).

### 4.4 Footer
- **DASH-11** Key for the markers (OK / Marginal / Poor).
- **DASH-12** Caveats: "Rain timing is approximate, especially for tropical downpours. Waves are open-water values on a grid of about 8 km; sheltered bays may be calmer, exposed points rougher. Tides are model-based. Not a safety tool: the dive operator decides."
- **DASH-13** Credits: "Weather data: Open-Meteo (CC BY 4.0)" with links, and "© OpenStreetMap contributors" on the map.

## 5. Classification rules

All rules apply per block (or per day window for days 3–5) and live in one pure TypeScript module (`src/lib/classify.ts`, constants in `src/lib/thresholds.ts`). The worst severity found in the window wins.

Hours with a missing value are ignored for that metric. If a metric has no data at all in the window, its cell shows "–" in neutral style (DATA-8).

**Thresholds at a glance:**

| Metric | Marginal | Poor |
|---|---|---|
| Rain | Rain in at least half of the block, or a peak from 2.5 mm/h | A peak from 7.6 mm/h |
| Thunderstorm | Possible | Likely |
| Wind (sustained, strongest hour) | from 20 km/h | from 29 km/h |
| Gusts | from 35 km/h | from 45 km/h |
| Waves (height alone) | from 1.0 m | from 2.0 m |
| Waves (short and steep: period below 6.5 s per metre of height) | from 0.6 m | from 1.25 m |

*Rationale:* wind thresholds follow the Beaufort-based dive rating scale published by a Phuket dive shop (Beaufort 4 = boat moves, Beaufort 5 = boats likely cancel). The wave-steepness rule is the boaters' rule of thumb: period in seconds should be at least 2× wave height in feet.

### 5.1 Rain
- A "drizzle hour" has from 0.1 mm, below 0.5 mm. A "rainy hour" has from 0.5 mm.
- Peak = highest hourly amount in the window.
- Share = rainy hours ÷ hours with data in the window.

| Label | Condition (checked top to bottom) | Severity | Detail |
|---|---|---|---|
| Dry | peak below 0.1 | OK | – |
| Drizzle | no rainy hour | OK | – |
| Bursts | peak from 7.6 | Poor | "peak X mm/h" |
| Persistent | share from 50 % | Marginal | "peak X mm/h" |
| Showers | peak from 2.5 | Marginal | "peak X mm/h" |
| Showers | otherwise | OK | "peak X mm/h" |

### 5.2 Storms
| Label | Condition (checked top to bottom) | Severity | Detail |
|---|---|---|---|
| Likely | any hour with weather code 95, 96 or 99 | Poor | hour range from the first to the end of the last such hour, e.g. "14–16" (also when hours in between have no thunder) |
| Possible | any rainy hour (from 0.5 mm) with CAPE from 1000 J/kg | Marginal | – |
| None | otherwise | OK | – |

The CAPE value is a starting point and may be tuned after real-world use.

### 5.3 Wind
- Sustained = highest hourly wind speed in the window; gust = highest hourly gust.
- Marginal: sustained from 20 km/h or gust from 35 km/h. Poor: sustained from 29 km/h or gust from 45 km/h.
- OK cell: "✓ OK". Otherwise label "Wind", detail "NN km/h DIR gusts NN".
- DIR = 8-point compass direction (e.g. "SW") of the **strongest hour**: the hour with the highest sustained wind (the earliest one on a tie); without sustained wind data, the hour with the highest gust. If that hour has no direction, DIR is left out ("NN km/h gusts NN").

### 5.4 Waves
Per hour, with wave height H (m) and wave period T (s):
- Height rule: marginal from H 1.0; poor from H 2.0.
- Steep rule (short, steep waves) applies when T is below 6.5 × H: marginal from H 0.6; poor from H 1.25. Without a period, only the height rule applies.
- The hour's severity is the worse of the two rules; the window's severity is the worst hour. Among hours with the same severity, the one with the highest wave is shown.
- OK cell: "✓ OK". If the shown hour reached its severity through the steep rule (also when both rules give the same severity): label "Choppy", detail "H m every T s". Otherwise label "Big waves", detail "H m".

### 5.5 Full and short forms
Every cell has a full form (label + optional detail, for Today/Tomorrow) and a short form (for the days 3–5 grid). Both are produced by the classification module.

| Metric | Full form | Short form |
|---|---|---|
| Rain | label + "peak X mm/h" | label ("Showers") |
| Storms | label + hour range when Likely | label ("Likely") |
| Wind | "OK", or "Wind" + "NN km/h DIR gusts NN" | "OK", or "NN km/h" (sustained; "gusts NN" without sustained data) |
| Waves | "OK", or "Choppy"/"Big waves" + detail | "OK", or "H m" |
| No data | "–" | "–" |

Screen readers hear the severity before the text, e.g. "Marginal, Wind, 24 km/h SW gusts 41".

### 5.6 Number formats
- mm/h: one decimal below 10 ("2.4"), whole numbers from 10 ("14").
- Wave height one decimal ("1.1 m"); wave period, wind and gusts as whole numbers.
- Numbers and their units never wrap onto separate lines.

## 6. Marker style
- **STYLE-1** Every cell = icon + label (+ detail) on a background:
  - OK: grey background, check icon
  - Marginal: amber background (#FFF1CC, text #6B4200), triangle icon
  - Poor: red background (#FBDAD6, text #7E1610), octagon icon
  - No data: grey background, no icon, "–"
- **STYLE-2** Severity is never shown by colour alone (icon + text always present).
- **STYLE-3** Light theme only, following the wireframe palette and type (Inter, bundled with the app; system font as fallback).

## 7. Data and refresh
- **DATA-1** Forecast API: hourly `precipitation, weather_code, cape, wind_speed_10m, wind_gusts_10m, wind_direction_10m`; daily `sunrise, sunset`; `timezone=auto`, `wind_speed_unit=kmh`, `forecast_days=6`.
- **DATA-2** Marine API: hourly `wave_height, wave_period, sea_level_height_msl, sea_surface_temperature`; `timezone=auto`, `forecast_days=6`.
  - *Why 6 days:* a forecast up to 12 h old (the most the app shows, OFF-5) must still cover today, tomorrow and the three outlook days after the date has changed at the spot.
- **DATA-3** Both requests run in parallel. A refresh only counts as successful if both succeed. Any HTTP error, including rate limiting (429), an error in the response, or a request that hasn't completed within **20 seconds** counts as a failed refresh. A timed-out request is cancelled.
- **DATA-4** All dates and times use the spot's local time zone as returned by the API, independent of the phone's time zone.
  - *Known limitation:* if the browser doesn't know the spot's IANA time zone, the app uses the fixed UTC offset returned with the forecast. After a daylight-saving change during the forecast's lifetime, local times are then off by the DST shift until the next refresh. Current iOS Safari and Android Chrome know all zones, so this is a fallback only.
- **DATA-5** "Today" is the current calendar date at the spot, computed when the dashboard is shown and updated every minute (so a cached forecast moves forward correctly).
- **DATA-6** On app open, when the app comes back to the foreground, and when the connection comes back: if the stored forecast is older than 1 hour and the device is online, refresh automatically.
  - *Known limitation:* an app left open in the foreground is not refreshed on its own; after 12 h it shows the OFF-5 message until the user taps refresh, reopens it or switches back to it.
- **DATA-7** Manual refresh is always possible when online.
- **DATA-8** Missing values (e.g. a model gap) are treated as "no data" for that hour; a cell with no data at all shows "–" in neutral style.
- **DATA-9** Every hour in the app means the hour that starts at that time ("06" = 06:00–06:59), in the grid, the chart and the rules. Open-Meteo reports `precipitation` as the sum and `wind_gusts_10m` as the maximum of the *preceding* hour, so the value for 06:00–06:59 is the one at 07:00; all other variables are instant values and are used at their own time. The last forecast hour has no following value and counts as no data (DATA-8).

Open-Meteo's free non-commercial tier (below 10,000 calls a day) needs no API key; the CC BY 4.0 credit is required (DASH-13).

### 7.1 Age formats
Data age is always shown as a duration, never as a clock time:
- "AGE" in DASH-2 and the banners: "just now" (below 1 min), "N min ago" (below 1 h), "N h ago" (below 48 h), "N d ago".
- Forecast age in the OFF-5 message: "N h" below 48 h, otherwise "N d".

## 8. Offline and error states
- **OFF-1** The app shell (HTML, JS, CSS, icons, fonts) is cached by the service worker and opens without network. A new version is installed automatically in the background and used on the next open.
- **OFF-2** The last successful forecast and the chosen spot are stored on the device and shown immediately on open.
- **OFF-3** Offline: grey banner "Offline · forecast from AGE" (e.g. "Offline · forecast from 5 h ago").
- **OFF-4** Failed refresh while online: amber banner "Couldn't update. Showing the forecast from AGE. Tap refresh to try again." No separate Retry button; the header refresh button (DASH-3) is used. Going offline clears the failed state: after the connection comes back, no OFF-4 banner is shown until a new refresh fails (the same applies to the "after a failed refresh" wording in OFF-5 and the failed message in OFF-8).
- **OFF-5** Forecast older than 12 hours (or, as a safeguard, not covering today): **no forecast data is shown**. Instead of the Today/Tomorrow/Next days sections, an amber message: "No current forecast" + "The stored forecast is AGE old." followed by the next step:
  - online: "Tap refresh to load a new one."
  - after a failed refresh: "Couldn't update. Tap refresh to try again."
  - offline: "Connect to the internet to load a new one."

  Exactly 12 hours old is still shown.
- **OFF-6** Map tiles are not cached for offline use (choosing a spot needs a connection).
- **OFF-7** Only one banner or message is shown at a time, in this priority: OFF-5 message > OFF-4 > OFF-3.
- **OFF-8** Without any stored forecast for the spot: "Loading forecast…" while loading; offline: "Offline. No forecast stored for this spot yet. It will load when you're back online."; failed: "Couldn't load the forecast. Tap refresh to try again."

## 9. Non-functional requirements
- **NFR-1** Minimum supported width: 400 CSS px. Reference device: Pixel 10 Pro, which reports roughly 410–427 CSS px depending on its "Display size" setting; 400 leaves a small margin. Wider screens get a centred column (max. ~480 px). The longest labels ("Persistent", "Big waves", "1.1 m every 5 s") must not overflow their cells at 400 px.
- **NFR-2** Supported browsers: current Safari on iOS and current Chrome on Android; installable to the home screen (web manifest, icons, standalone display).
- **NFR-3** Accessibility: text contrast at least 4.5:1 (exception: DASH-9), touch targets at least 44 px, proper buttons/labels, chart has a text alternative.
- **NFR-4** Performance: dashboard JavaScript at most 50 kB compressed (map excluded); dashboard renders from cache in under 1 s on a mid-range phone.
- **NFR-5** Privacy: no analytics, no tracking, no cookies; only Open-Meteo and OpenStreetMap are contacted. The Inter font is therefore bundled with the app (no Google Fonts).
- **NFR-6** English text, metric units, wind in km/h, 24-hour times.
- **NFR-7** App name "Scuba Weather" (short name the same). Theme colour #0A5F86.
- **NFR-8** App icon: rain cloud above a wave line with rising bubbles, on ocean blue (source: `assets/icon.svg`). Exported as 192 px and 512 px PNG (also marked maskable; all elements sit inside the safe zone) and a 180 px Apple touch icon (`npm run icons`).

## 10. Technology
- **Framework:** Svelte 5 + TypeScript, a plain Svelte SPA (no SvelteKit). Chosen over Preact for less code, built-in scoped styles and no hooks pitfalls; React, Stencil, Lit and Solid were also considered.
- **Build:** Vite 8 (Rolldown). Node.js 22 or newer (`engines`, `.nvmrc`).
- **PWA:** vite-plugin-pwa (Workbox): offline app shell, installable, automatic updates.
- **Data:** Open-Meteo only (Geocoding, Forecast and Marine APIs), no key, no backend.
- **Map:** Leaflet + OpenStreetMap tiles, lazy-loaded with the spot screen; attribution required.
- **Chart:** SVG rendered directly by Svelte components (no chart library); `d3-shape` for the smooth tide curve.
- **UI:** no UI component library; own components with Svelte scoped CSS and design tokens (colours, spacing, radii) as CSS custom properties.
- **Storage:** spot and last forecast in `localStorage`.
- **Hosting:** GitHub Pages, once implementation and review are done. The build uses a relative base, so it works under a project path.

## 11. Testing and acceptance
- **TEST-1** Unit tests for every classification rule, including values exactly at each threshold.
- **TEST-2** Time zone tests: a spot in UTC+7 viewed from a device in UTC+1 gets the correct blocks, "today" and dimmed past blocks.
- **TEST-3** Component tests for the grid cells, the banners, the dashboard states, the spot screen and the app's navigation (Leaflet replaced by a small stand-in).
- **TEST-4** Tests for the refresh logic (age above 1 h, offline, failed request, coming back online or to the foreground).
- **TEST-5** `npm run coverage` reports test coverage; keep line coverage at 95 % or more.
- **Acceptance:** all tests pass; the dashboard matches the dashboard wireframe; the requirements above are met.

## 12. Decision log

Key decisions and the alternatives they replaced, so they aren't reopened by accident.

| Decision | Instead of | Why |
|---|---|---|
| Facts with severity markers, no overall score | A single "dive score" | Product principle: facts first, the diver decides. |
| Three 6-hour blocks, Night 18–24 | Night 18–22 with narrower or unequal columns | Equal columns and one time scale in the chart. |
| Matrix dashboard (rows = metrics, columns = blocks) | Card per block (wireframe layout A) | Chosen in the wireframe review; wind and waves as separate rows for clarity. |
| Land check when saving the spot | Check on every map move; or allow any pin and warn | Every water value (waves, water temperature, tide, future additions) needs marine data, so a saved spot must have it; one request instead of one per move. |
| Placeholder instead of map before a search | Map shown from the start | Makes clear the pin can't be placed without a search. |
| Forecast older than 12 h: no data, only a message | Showing old data with a warning | Decided in the implementation review; also removes the need to track "offline since". |
| Data age as a duration only | Clock time plus duration | The exact time was more information than needed. |
| Wind direction of the strongest hour | Vector average with a spread rule | Simpler, and it's the wind that causes the warning. |
| 6 forecast days | 5 | A 12 h old forecast still covers all shown days. |
| Greyed-out past blocks below 4.5:1 contrast | Another way of marking past blocks | Accepted exception for now; review after real-world use. |
| Inter bundled with the app | Google Fonts | No third-party requests (NFR-5). |
| Request timeout of 20 s | No timeout; 10 s or 30 s | A stalled connection must not block refreshing forever; 20 s tolerates slow mobile/boat links. |
| Going offline clears a failed refresh | Retrying automatically on reconnect regardless of age | No extra request; the banner only reports failures since the connection came back. |
| No auto-refresh while the app stays open | Running the 1 h check every minute | Kept DATA-6 as decided; foreground/open/reconnect cover normal use. |
| Fixed-offset fallback when the time zone is unknown | Deriving the offset per hour from Unix timestamps | Current target browsers know all zones; documented as a limitation instead. |
