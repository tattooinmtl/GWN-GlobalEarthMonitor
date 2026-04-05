# GWN — Global Earthquake Viewer v2.0 Plan

## Overview

Full rebuild of the v1.0 Electron + Vite seismic desktop viewer into a clean v2.0
codebase under `Version2/`. The v1.0 project is kept intact and untouched.

---

## What was in v1.0 (ported)

| Area | Detail |
|---|---|
| Shell | Electron 31 + Vite 5 |
| Map | Leaflet (CartoDB Dark Matter tiles) |
| Earthquake feeds | USGS, NRCan, SeismicPortal, JMA — auto-refresh 60 s |
| Stations | 13 FDSN data centres, network auto-discovery |
| Waveform | Chart.js line chart, fixed refresh interval selector (5s/10s/15s/30s) |
| MiniSEED | Pure-JS parser — Steim-1, Steim-2, float32/64, int16/32 |
| Stats tab | Count-by-magnitude bar + inter-event interval line chart |
| Audio | Web Audio API chime on waveform load |
| Splash | Frameless splash screen with IPC-driven startup log |

---

## What is new in v2.0

### Feature 1 — 3 Waveform Time Windows

Inspired by the NRCan react-waveform viewer (earthquakescanada.nrcan.gc.ca).
Reference file: `mainGOV.js` (minified bundle, saved in project root).

**Replaces** the 5s/10s/15s/30s refresh-interval dropdown.

Three toggle buttons in the waveform panel:

| Button  | FDSNWS duration | Notes |
|---------|----------------|-------|
| 1 min   | 60 s           | Fast, lightweight — default |
| 10 min  | 600 s          | Medium, good for context |
| 1 hr    | 3600 s         | Large — may be slow on some stations |

- The selected window determines `start = now - window`, `end = now` for the
  FDSNWS Dataselect fetch.
- X-axis label shows local time ticks spanning the chosen window.
- Active button is highlighted (accent colour).
- Auto-refresh runs every 10 s, fetching the currently selected window.
- English only.

---

## Future features (to be added)

- TBD — add ideas here as v2 development continues.

---

## Global Data Sources Backlog (Saved Apr 2, 2026)

This section captures major public/global earthquake sources for v2 planning.
Goal: keep v2 feed architecture expandable beyond the current USGS + regional mix.

### Priority 1 (live app sources)

| Source | Coverage | Best use in app | Access |
|---|---|---|---|
| USGS Earthquake Hazards Program | Global, near real-time + deep history | Primary real-time feed + advanced search | GeoJSON summary feeds + FDSN Event API |
| EMSC / SeismicPortal | Global (strong Euro-Med), rapid reports | Secondary live validation and optional felt-oriented feed | FDSN WS-Event |

### Priority 2 (secondary live / verification)

| Source | Coverage | Best use in app | Access |
|---|---|---|---|
| GFZ GEOFON | Global rapid event information | Optional cross-check source and event detail links | Public event pages, explorer, FDSN-compatible services where offered |

### Priority 3 (historical / offline datasets)

| Source | Coverage | Best use in app | Access |
|---|---|---|---|
| ISC Bulletin + ISC-GEM | Global detailed and historical catalogs (delayed for bulletin) | Historical analytics, bulk imports, retrospective studies | ISC search + FDSN Event service + downloadable files |
| NOAA/NCEI Significant EQ DB | Global significant events, impact-focused (historical) | Impacts/deaths/damage overlays and historical context mode | Downloadable dataset / API access paths |

### Supporting ecosystem references

- FDSN data centers and web services registry for provider discovery/interoperability.
- NASA Earthdata (research-oriented earthquake products; some assets require login).
- GEM / OpenQuake ecosystem for hazard/risk workflows (non-live event stream focus).

### Integration strategy for v2

1. Real-time monitor mode: USGS GeoJSON as default source.
2. Redundancy mode: optional USGS + EMSC side-by-side validation.
3. Historical mode: import ISC-GEM and NOAA significant events into local storage.
4. Provider abstraction: keep feed adapters FDSN-compatible so new sources plug in with minimal UI changes.
5. Polling/rate hygiene: prefer summary feeds for frequent updates, avoid heavy repeated full-catalog queries.

---

## File structure

```
Version2/
  docs/
    plan.md          ← this file
  electron/
    main.js
    preload.js
    splash-preload.js
    splash.html
  src/
    main.js          ← v2 implementation (3 time windows)
    miniseed.js      ← ported from v1, unchanged
    style.css        ← v1 base + new time-window button styles
  index.html         ← v2 markup (time-window buttons)
  package.json       ← version bumped to 2.0.0
  vite.config.js     ← same as v1
```

---

## Key implementation notes

- `LIVE_WINDOW_SECONDS` constant replaced by `currentWindowSeconds` state variable.
- `updateLiveWaveformMode()` reads `currentWindowSeconds` instead of a `<select>`.
- `fetchWaveformBuffer()` signature unchanged — `windowSeconds` param already exists.
- X-axis: `renderWaveform()` now receives `windowSeconds` and builds time labels
  (`now - window … now`) for each sample index.
- Refresh timer hardcoded to 10 s in v2 (no UI selector).
