# 🌍 GWN - Global Earthquake Viewer

A real-time global seismic monitoring desktop application built with Electron. Track earthquakes, fireballs, asteroids, volcanoes, atmospheric conditions, and seismic station waveforms — all in one place.

<!-- Add screenshots here -->
<!-- ![Screenshot](screenshots/main.png) -->

## Features

- **Real-time Earthquake Feed** — Live earthquake data from USGS, EMSC, JMA, ISC and more with magnitude filtering, auto-refresh, and interactive map markers
- **Fireball Tracking** — NASA fireball/bolide event overlay on the global map
- **Asteroid Monitor** — Near-Earth asteroid data from NASA JPL with close-approach details and Pan-STARRS sky imagery
- **Sky Explorer** — Browse the Pan-STARRS DR2 sky survey with 3 billion objects, color composites, multi-band photometry, and deep-sky presets
- **3D Solar System Simulation** — Interactive 3D view of asteroid orbits using Asterank, MPC, and Kepler data
- **Volcano Activity** — Live volcano alerts and eruption data from USGS and the Smithsonian Global Volcanism Program
- **Atmosphere Layer** — Weather overlays, SO₂, UV Aerosol Index, thermal anomalies, and space weather data
- **Prediction Center** — Seismic prediction tools and analysis workspace
- **Seismic Stations** — Browse global seismograph networks (EarthScope, NCEDC, GEOFON, and 10+ data centers), select stations, and view live MiniSEED waveforms with audio feedback
- **Statistics Workspace** — Filter, bucket, and compare earthquake feeds by source, magnitude, depth, and event cadence
- **Collapsible Waveform Drawer** — Station waveform panel collapses to a slim bar when switching tabs, preserving your session and resuming automatically when you return

## Download

Get the latest Windows installer from the [Releases](https://github.com/tattooinmtl/GWN---Global-Earthquake-Viewer-v3.0/releases/latest) page.

### Installation

1. Download the `.exe` installer from the latest release
2. Run the installer and follow the on-screen prompts
3. Launch **GWN - Global Earthquake Viewer** from your Start menu or desktop shortcut

## Data Sources

| Source | Data |
|--------|------|
| [USGS Earthquake Hazards](https://earthquake.usgs.gov) | Earthquakes, Volcanoes |
| [EarthScope (IRIS)](https://service.earthscope.org) | Seismic stations & waveforms |
| [EMSC / Seismic Portal](https://www.seismicportal.eu) | European seismic data |
| [NASA JPL](https://ssd-api.jpl.nasa.gov) | Asteroids, fireballs, close approaches |
| [Pan-STARRS / MAST](https://catalogs.mast.stsci.edu) | Sky survey imagery & photometry |
| [Smithsonian GVP](https://volcano.si.edu) | Global volcanism |
| [NOAA SWPC](https://services.swpc.noaa.gov) | Space weather (Kp, X-ray, solar wind) |
| [NASA GIBS](https://gibs.earthdata.nasa.gov) | SO₂, UV Aerosol, thermal anomalies |
| [Earthquakes Canada (NRCan)](https://www.earthquakescanada.nrcan.gc.ca) | Canadian seismic data |
| [GEOFON (GFZ)](https://geofon.gfz-potsdam.de) | German/global seismic data |
| + 10 more FDSN data centers | Global station networks |

## Tech Stack

- **Electron** — Desktop application framework
- **Vite** — Build tooling
- **Leaflet** — Interactive maps
- **Chart.js** — Waveform and statistics charts
- **MiniSEED** — Seismic data parsing
- **Vanilla JS** — No frontend framework dependencies

## Changelog

### v4.0.0 — Security Hardening
- **Sandboxed iframes** — 3D Simulation and Sky Explorer iframes now run with `sandbox="allow-scripts allow-same-origin"`, blocking breakout attacks
- **XSS protection** — All API-sourced data (earthquake locations, volcano names, error messages) now escaped before innerHTML insertion
- **postMessage origin enforcement** — Parent↔iframe messaging uses explicit origin checks instead of wildcard `'*'`
- **HTTPS-only data sources** — Upgraded GSRAS endpoint from HTTP to HTTPS; removed `http:` from Content Security Policy
- **API key protection** — OpenWeatherMap, AirNow, and NASA NeoWs keys moved to environment variables (`.env`), no longer hardcoded in source
- **Navigation lockdown** — `will-navigate` handler blocks renderer from loading external URLs; `window.open` requests denied
- **DevTools disabled** — Production builds no longer allow opening developer tools
- **Tightened addon CSP** — Sky Explorer and Asteroid Center pages use strict per-directive CSP with `object-src 'none'` and `base-uri 'self'`
- **PHP proxy hardened** — Asterank API proxy now allowlists query parameters to prevent SSRF
- **Filename sanitization** — Notes IPC rejects filenames starting with `.` or containing `..`
- Redesigned splash screen

### v3.3.0
- **Sky Explorer tab** — New standalone Pan-STARRS DR2 sky survey browser with object search, name resolver, 10 deep-sky presets, color composite imagery, individual band thumbnails, cutout size slider, and catalog photometry
- **Pan-STARRS enrichment on Asteroid tab** — When selecting an asteroid, a PS1 sky image and grizy magnitude badges appear in the detail panel (computed from orbital elements via Kepler solver)
- **Pan-STARRS in Asteroid Center addon** — Standalone addon page also enriches asteroid details with PS1 data
- **Atmosphere fix** — Replaced broken Aerosol Optical Depth overlay with working UV Aerosol Index (OMPS daily global coverage)
- New Sky Explorer GWN addon (sky-explorer.gwn)

### v3.2.0
- Waveform panel now completely hidden on non-station tabs
- Station selection persists across app restarts
- Notes tab with rich text editor, Quick Save, Save As, Open File
- Send to Notes from earthquake details, asteroid details, and fireball popups
- Unsaved notes guard on quit

### v3.1.0
- Fixed waveform audio continuing to play after leaving stations tab
- Fixed waveform panel disappearing with no way to reopen
- Waveform panel now collapses as a drawer instead of disappearing
- Station state preserved across tab switches with automatic resume

### v3.0.0
- Initial public release

## License

MIT

## Author

**Erik Boivin** — [Global Warning Networks](https://globalwarningnetworks.com)

---

*© 2026 GWN - Erik Boivin*
