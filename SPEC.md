# Technical Specification

## 1. Executive Summary & Objective

The **Scuba Weather App** is a mobile-first, offline-capable Progressive Web Application built specifically for recreational scuba divers. 

The primary purpose of the application is to provide instantaneous, actionable dive-readiness briefings, combining raw marine forecasts with local topographical shelter intelligence so divers and dive operators can select safe, protected dive sites.

---

## 2. Target Persona & Operational Environment

| Attribute | Specification |
| :--- | :--- |
| **Primary Users** | Recreational divers, divemasters, dive boat captains, and instructors |
| **Operational Setting** | Pre-dive planning on land and in-transit operation aboard dive boats |
| **Connectivity Constraints** | Cellular coverage drops are possible on dive boats |
| **Platform Target** | Android mobile browsers (Chrome), installable as a standalone PWA |
| **Coordinates** | Dynamic user input (Default onboarding: `10.0956° N, 99.8404° E` - Ko Tao) |
| **Timezone** | Dynamic (`timezone=auto` applied to API queries) |

---

## 3. System Architecture & Tech Stack

The system employs a client-side architecture requiring no custom backend servers. All data transformations, condition scoring, and tidal simulations run within the browser runtime.

### 3.1 Technology Stack Selection
* **Application Shell:** Semantic HTML5, CSS3 with responsive custom properties, and modern ECMAScript (ES2022).
* **Offline Infrastructure:** W3C Service Worker API (`sw.js`) utilizing `CacheStorage` for static assets and client `localStorage` for 7-day forecast state persistence.
* **Mapping:** Leaflet.js with OpenStreetMap tiles for location pinning.

---

## 4. Functional Requirements

### 4.1 Multi-Location & Onboarding Workflow
* **Search & Pin:** Users search for a general area using the Open-Meteo Geocoding API. The UI presents an interactive map (Leaflet.js).
* **Precision Placement:** Users drag and drop a pin onto the exact water location of their target dive site (e.g., an offshore pinnacle).
* **Coordinate Extraction:** The app uses the pin's exact Lat/Lng to query the Marine API, bypassing the risk of querying inland coordinates.

### 4.2 7-Day Multi-Day Navigation
* **Date Range:** Supports a rolling 7-day forecast window starting from the current date.
* **Navigation Controls:** Bidirectional step arrows and a direct "Today" shortcut button.
* **Reactivity:** Selecting any date instantly triggers re-computation of core marine metric cards.

### 4.3 Core Diving Metrics
1. **Swell & Waves:** Significant wave height ($H_s$), wave period ($T_p$), and wave direction.
2. **Wind Speed & Direction:** Sustained wind speed (kts), peak gusts (kts), and compass bearing.
3. **Precipitation & Squalls:** Precipitation probability (%) and accumulation volume (mm).
4. **Tides & Currents:** Water level height, flow state (Rising/Falling), and High/Low tide timings.
5. **Sunrise & Sunset**

---

## 5. Dive Condition Scoring Logic

### 5.1 Surface Safety Condition Scoring Algorithm
The application computes an overall **Surface Safety Score** ($S \in [0, 100]$). To prevent negative scores during extreme weather, the final calculation is clamped at zero. The wave period acts as a multiplier to the wave height, but is ignored if waves are extremely low.

$$S = \max(0, 100 - P_{\text{wave\_combined}} - P_{\text{wind}} - P_{\text{rain}})$$

#### Penalty Thresholds

**1. Combined Wave Penalty ($P_{\text{wave\_combined}}$)**
First, determine the Base Wave Penalty ($P_{\text{wave}}$):

| Wave Height ($H_s$) | Base Penalty ($P_{\text{wave}}$) |
| :--- | :--- |
| $H_s \le 0.6\,\text{m}$ | $0$ (Period modifier ignored) |
| $0.6\,\text{m} < H_s \le 1.0\,\text{m}$ | $15$ |
| $1.0\,\text{m} < H_s \le 1.4\,\text{m}$ | $35$ |
| $H_s > 1.4\,\text{m}$ | $50$ |

If $H_s > 0.6\,\text{m}$, apply the Wave Period ($T_p$) modifier:
* **$T_p < 6\,\text{s}$ (Short chop):** $P_{\text{wave\_combined}} = P_{\text{wave}} \times 1.5$
* **$6\,\text{s} \le T_p \le 10\,\text{s}$ (Average):** $P_{\text{wave\_combined}} = P_{\text{wave}} \times 1.0$
* **$T_p > 10\,\text{s}$ (Long swell):** $P_{\text{wave\_combined}} = P_{\text{wave}} \times 0.5$

**2. Wind & Rain Penalties**

| Metric | Condition Range | Penalty Points |
| :--- | :--- | :--- |
| **Wind Speed ($V_w$)** | $V_w \le 12\,\text{kts}$ | $0$ |
| | $12\,\text{kts} < V_w \le 16\,\text{kts}$ | $15$ |
| | $16\,\text{kts} < V_w \le 22\,\text{kts}$ | $30$ |
| | $V_w > 22\,\text{kts}$ | $45$ |
| **Precipitation ($P_r$)** | $P_r \le 35\%$ | $0$ |
| | $35\% < P_r \le 60\%$ | $10$ |
| | $P_r > 60\%$ | $20$ |

#### Rating Categories
* **Green (Score $\ge 80$):** Favorable / Calm Conditions. Offshore pinnacles and exposed sites optimal.
* **Amber (Score $60 - 79$):** Moderate Conditions. Seek local leeward protection; offshore swell or chop present.
* **Red (Score $< 60$):** Challenging Conditions. Surface chop, strong surge, or active squall band; training restricted to protected bays.

### 5.2 Scope of Scoring (Surface vs. Visibility)
The application calculates a **Surface Safety Score**, not an underwater visibility prediction. The UI must explicitly display a disclaimer that the score reflects boat transit comfort and surface water entry/exit conditions. Visibility is affected by runoff, tidal flow, and plankton blooms not tracked by this algorithm.

---

## 6. External Data Pipeline & Storage Policy

The application interfaces directly with the **Open-Meteo** API platform (Marine & Weather endpoints) requiring no API key.

### 6.1 Storage Eviction & Cache Policy
* **Location Limit:** `localStorage` caps saved locations to a maximum of 10 using a Least Recently Used (LRU) eviction algorithm.
* **Forecast Data Overwrite:** Retain only a single 7-day forecast object per location, strictly overwritten on successful syncs.
* **Stale Data Expiration:** 
  * `> 12 hours` since last sync: Render a visible "Stale Data: Sync Required" UI warning.
  * `> 48 hours` since last sync: Nullify the forecast array. The UI must prompt an immediate network sync to prevent dive planning on dangerously outdated data.

---

## 7. Progressive Web App (PWA) Specifications

* **Static Assets (App Shell):** `CacheFirst` strategy caches HTML, manifest, and icon assets.
* **API Endpoints:** `NetworkFirst` strategy attempts fresh weather queries, falling back to cache if unavailable.
* **Cache Invalidation:** Versioned cache key clears outdated assets during the service worker `activate` lifecycle phase.
