# 🌍 GWN - Global Earth Monitor 1.1.0

A real-time global monitoring desktop application for earthquakes, fireballs, asteroids, volcanoes, atmosphere, and more. Built with Electron, GWN - Global Earth Monitor brings together live data, maps, and scientific tools in one window.

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

**v1.1.0** is the current Windows release.

### Release installer

Download and run the setup program:

[GWN-Setup-1.1.0.exe](https://github.com/tattooinmtl/GWN-GlobalEarthMonitor/releases/download/v1.1.0/GWN-Setup-1.1.0.exe)

That file is a normal Windows installer. It asks for an install folder, adds a Start menu shortcut and a desktop shortcut, and adds an uninstall entry in Apps & features. It is not a portable folder.

1. Download `GWN-Setup-1.1.0.exe` from the [v1.1.0 release](https://github.com/tattooinmtl/GWN-GlobalEarthMonitor/releases/tag/v1.1.0)
2. Run it and finish the wizard
3. Launch **GWN - Global Earth Monitor** from the Start menu or the desktop shortcut

Older builds stay on the [Releases](https://github.com/tattooinmtl/GWN-GlobalEarthMonitor/releases) page.

### PowerShell installer

`install.ps1` is the command-line installer. From PowerShell it downloads the **v1.1.0** release setup and runs it:

```powershell
irm https://raw.githubusercontent.com/tattooinmtl/GWN-GlobalEarthMonitor/main/install.ps1 | iex
```

The same command from the Run dialog or Command Prompt:

```text
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/tattooinmtl/GWN-GlobalEarthMonitor/main/install.ps1 | iex"
```

Build from the GitHub source instead of the published setup file. This needs Node.js 18 or newer:

```powershell
$env:GWN_INSTALL_MODE = 'source'; irm https://raw.githubusercontent.com/tattooinmtl/GWN-GlobalEarthMonitor/main/install.ps1 | iex
```

From a local copy of this repository:

```powershell
.\install.ps1
.\install.ps1 -Source
.\install.ps1 -Installer .\release\GWN-Setup-1.1.0.exe
.\install.ps1 -Silent
```

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
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Street map tiles |
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

### v1.1.0
- Street maps use OpenStreetMap. CARTO tiles are gone, so the maps no longer ask for a CARTO API key
- Sky Explorer **View in PS1 Cutout Service** and **View in MAST Catalog** open in the browser
- The window and taskbar show the app icon
- The side panel no longer shows a logo or title, so the lists use the full height
- Windows release installer: `GWN-Setup-1.1.0.exe`
- PowerShell installer: `install.ps1`

### v1.0.0 — First production release
- Security hardening: removed hardcoded API keys, sanitized notes HTML (XSS fix), escaped addon-rendered remote data, enforced web security and Vite fs strictness, removed open CORS proxy
- Reliability: user data moved from %TEMP% to proper userData dir with migration, atomic state writes, fixed tray quit race, consistent note filename validation
- Build/config: cross-platform dev script, bundled Leaflet CSS (offline-safe), no dead PHP/assets in dist, version consistency, electron-builder upgraded (v26) with icons wired up
- Quality: shared utils module, visible error logging for previously silent catches, timer registry to prevent interval leaks

### v5.1.0 — Minor update
- UI/UX Logos missing

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
