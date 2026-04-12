# 🌍 GWN - Global Earth Monitor 5.0

A real-time global monitoring desktop application for earthquakes, fireballs, asteroids, volcanoes, atmosphere, and more. Built with Electron, GWN - Global Earth Monitor 5.0 brings together advanced data visualization, live feeds, and scientific tools in a single, modern interface.

<!-- Add screenshots here -->
<!-- ![Screenshot](screenshots/main.png) -->

## Features

- **Real-time Earthquake Feed** — Live data from USGS, EMSC, JMA, ISC, and more with magnitude filtering, auto-refresh, and interactive maps
- **Fireball Tracking** — NASA fireball/bolide event overlays
- **Asteroid Monitor** — Near-Earth asteroid data from NASA JPL, close-approach details, and Pan-STARRS sky imagery
- **Sky Explorer** — Pan-STARRS DR2 sky survey browser with 3 billion objects, color composites, and deep-sky presets
- **3D Solar System Simulation** — Interactive asteroid orbits using Asterank, MPC, and Kepler data
- **Volcano Activity** — Live volcano alerts and eruption data
- **Atmosphere Layer** — Weather overlays, SO₂, UV Aerosol Index, thermal anomalies, and space weather
- **Prediction Center** — Seismic prediction tools and analysis workspace
- **Seismic Stations** — Browse global seismograph networks, select stations, and view live MiniSEED waveforms with audio feedback
- **Statistics Workspace** — Filter and compare earthquake feeds by source, magnitude, depth, and cadence
- **Collapsible Waveform Drawer** — Station waveform panel collapses to a slim bar, preserving your session

## Download

Get the latest Windows installer or portable version from the [Releases](https://github.com/tattooinmtl/GWN-GlobalEarthMonitor/releases/latest) page.

### Installation

1. Download the `.exe` installer from the latest release
2. Run the installer and follow the prompts
3. Launch **GWN - Global Earth Monitor 5.0** from your Start menu or desktop shortcut

Or, use the portable (unpacked) version from the `win-unpacked` folder for a no-install experience.

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

### v5.0.0 — Major Update
- App renamed to **GWN - Global Earth Monitor 5.0**
- UI/UX improvements and new branding
- Updated data feeds and improved reliability
- Enhanced packaging: Windows installer and portable version
- Security and performance enhancements

### v4.0.0 — Security Hardening
- Sandboxed iframes for 3D Simulation and Sky Explorer
- XSS protection and origin enforcement
- HTTPS-only data sources
- API key protection and navigation lockdown
- DevTools disabled in production
- Tightened addon CSP and PHP proxy hardening
- Filename sanitization and redesigned splash screen

### v3.3.0 and earlier
- Sky Explorer tab, Pan-STARRS enrichment, Atmosphere fixes, Notes tab, waveform panel improvements, and more

## License

MIT

## Author

**Erik Boivin** — [Global Warning Networks](https://globalwarningnetworks.com)

---

*© 2026 GWN - Erik Boivin*
