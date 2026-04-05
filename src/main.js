// =============================================
// Global Earthquake Viewer v4.0 - main.js
// =============================================

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Chart, LineController, BarController, ScatterController, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler } from 'chart.js'
import { asteroidAverageSizeText, asteroidFormatApproachDates, asteroidListFacts, createAsteroidSourceLoaders, mergeAsteroidRows } from './asteroidSources.js'
import { parseMiniSEED } from './miniseed.js'
import { filterFireballs, buildFireballTrend, populateYearDropdown, renderFireballTrend, updateTrendSummary, readFilters } from './fireballTrend.js'
import { initNotesEditor, isNotesDirty, markNotesClean, appendToNotes } from './notes.js'

Chart.register(LineController, BarController, ScatterController, LineElement, BarElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler)

// ------- Constants -------
const USGS_BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/'
const CANADA_EVENT_URL = 'https://www.earthquakescanada.nrcan.gc.ca/fdsnws/event/1/query'
const EUROPE_EVENT_URL = 'https://www.seismicportal.eu/fdsnws/event/1/query'
const EMSC_EVENT_URL = 'https://www.seismicportal.eu/fdsnws/event/1/query'
const ISC_EVENT_URL = 'https://www.isc.ac.uk/fdsnws/event/1/query'
const JAPAN_EVENT_URL = 'https://www.jma.go.jp/bosai/quake/data/list.json'
const ITALY_EVENT_URL = 'https://webservices.ingv.it/fdsnws/event/1/query'
const GEOFON_EVENT_URL = 'https://geofon.gfz-potsdam.de/fdsnws/event/1/query'
const GSRAS_EVENT_URL = 'https://data.gsras.ru/fdsnws/event/1/query'
const OWM_API_KEY = import.meta.env.VITE_OWM_API_KEY || ''
const AIRNOW_API_KEY = import.meta.env.VITE_AIRNOW_API_KEY || ''
const EARTHQUAKE_REGIONS = {
  global: { label: 'Global' },
  canada: { label: 'Canada', latMin: 41, latMax: 84, lonMin: -141, lonMax: -52 },
  europe: { label: 'Europe', latMin: 34, latMax: 72, lonMin: -25, lonMax: 45 },
  italy: { label: 'Italy', latMin: 35, latMax: 47, lonMin: 6, lonMax: 19 },
  japan: { label: 'Japan', latMin: 24, latMax: 47, lonMin: 122, lonMax: 154 }
}
const GLOBAL_FEED_PROVIDERS = {
  usgs: { label: 'USGS' },
  emsc: { label: 'EMSC' },
  isc: { label: 'ISC' },
  geofon: { label: 'GEOFON' }
  // gsras added dynamically if online
}
// Runtime source availability map (populated by checkSourceAvailability)
const sourceAvailability = { gsras: false }
const REVERSE_GEOCODE_ENDPOINT = 'https://geocoding-api.open-meteo.com/v1/reverse'
const PLACE_ENRICH_LIMIT_PER_FETCH = 25
const REQUEST_TIMEOUT_MS = 12000
const PROVIDER_MAX_ATTEMPTS = 3
const PROVIDER_RETRY_BACKOFF_MS = 700
const DATA_CENTERS = {
  earthscope: {
    label: 'EarthScope',
    stationUrl: 'https://service.earthscope.org/fdsnws/station/1/query',
    dataselectUrl: 'https://service.earthscope.org/fdsnws/dataselect/1/query',
    networks: ['IU', 'II', 'IC', 'G', 'GE']
  },
  canada: {
    label: 'Earthquakes Canada',
    stationUrl: 'https://www.earthquakescanada.nrcan.gc.ca/fdsnws/station/1/query',
    dataselectUrl: 'https://www.earthquakescanada.nrcan.gc.ca/fdsnws/dataselect/1/query',
    networks: ['CN'],
    defaultNetwork: 'CN'
  },
  ncedc: {
    label: 'NCEDC',
    stationUrl: 'https://service.ncedc.org/fdsnws/station/1/query',
    dataselectUrl: 'https://service.ncedc.org/fdsnws/dataselect/1/query',
    networks: ['NC', 'BK', 'NN', 'CI']
  },
  scedc: {
    label: 'SCEDC',
    stationUrl: 'https://service.scedc.caltech.edu/fdsnws/station/1/query',
    dataselectUrl: 'https://service.scedc.caltech.edu/fdsnws/dataselect/1/query',
    networks: ['CI', 'AZ', 'NP', 'SB']
  },
  geofon: {
    label: 'GEOFON',
    stationUrl: 'https://geofon.gfz-potsdam.de/fdsnws/station/1/query',
    dataselectUrl: 'https://geofon.gfz-potsdam.de/fdsnws/dataselect/1/query',
    networks: ['GE', 'G', 'GR', 'MN']
  },
  ethz: {
    label: 'ETH Zurich',
    stationUrl: 'https://eida.ethz.ch/fdsnws/station/1/query',
    dataselectUrl: 'https://eida.ethz.ch/fdsnws/dataselect/1/query',
    networks: ['CH', '8D', 'S', 'Z3']
  },
  ipgp: {
    label: 'IPGP',
    stationUrl: 'https://ws.ipgp.fr/fdsnws/station/1/query',
    dataselectUrl: 'https://ws.ipgp.fr/fdsnws/dataselect/1/query',
    networks: ['G', 'PF', 'GL', 'WI']
  },
  orfeus: {
    label: 'ORFEUS',
    stationUrl: 'https://www.orfeus-eu.org/fdsnws/station/1/query',
    dataselectUrl: 'https://www.orfeus-eu.org/fdsnws/dataselect/1/query',
    networks: ['NL', 'BE', 'PL', 'OX']
  },
  bgr: {
    label: 'BGR',
    stationUrl: 'https://eida.bgr.de/fdsnws/station/1/query',
    dataselectUrl: 'https://eida.bgr.de/fdsnws/dataselect/1/query',
    networks: ['GR', 'SX', 'TH', 'RN']
  },
  japan: {
    label: 'Japan F-net (NIED)',
    stationUrl: 'https://www.fnet.bosai.go.jp/fdsnws/station/1/query',
    dataselectUrl: 'https://www.fnet.bosai.go.jp/fdsnws/dataselect/1/query',
    networks: ['JP', 'NIED'],
    defaultNetwork: 'JP'
  },
  ingv: {
    label: 'INGV (Italy)',
    stationUrl: 'https://webservices.ingv.it/fdsnws/station/1/query',
    dataselectUrl: 'https://webservices.ingv.it/fdsnws/dataselect/1/query',
    networks: ['IV', 'MN', 'NI'],
    defaultNetwork: 'IV'
  },
  resif: {
    label: 'RESIF (France)',
    stationUrl: 'https://ws.resif.fr/fdsnws/station/1/query',
    dataselectUrl: 'https://ws.resif.fr/fdsnws/dataselect/1/query',
    networks: ['FR', 'RD', 'RA'],
    defaultNetwork: 'FR'
  },
  geonet: {
    label: 'GeoNet (New Zealand)',
    stationUrl: 'https://service.geonet.org.nz/fdsnws/station/1/query',
    dataselectUrl: 'https://service.geonet.org.nz/fdsnws/dataselect/1/query',
    networks: ['NZ'],
    defaultNetwork: 'NZ'
  }
}

// ------- State -------
let map, markers = L.layerGroup(), fireballMarkers = L.layerGroup(), volcanoMarkers = L.layerGroup(), waveformChart = null
let currentStation = null, autoRefreshTimer = null
let lastStation = null
let waveformLiveTimer = null
let waveformFetchInFlight = false
let currentLiveStream = null
let currentEarthquakes = []
let currentFireballs = []
let fireballOverlayLoaded = false
let activeMapMode = 'earthquakes'
let lastSuccessfulGlobalProviderKey = 'usgs'
const lastGoodEarthquakeCache = new Map()
const reversePlaceCache = new Map()
let lastSeenEventId = null
const networkCatalogCache = new Map()
let networkPopulateToken = 0
const MAX_STATIONS_RENDERED = 300
const MAX_WAVEFORM_POINTS = 5000
// v2: current waveform window in seconds, default 1 minute
let currentWindowSeconds = 60
const LIVE_REFRESH_MS = 10000
const PREDICTION_HISTORY_LIMIT = 12
const CHANNEL_PRIORITY = ['BHZ', 'HHZ', 'EHZ', 'SHZ', 'LHZ', 'BH1', 'BH2']
const STARTUP_PROGRESS = {
  boot: 8,
  libraries: 14,
  map: 24,
  earthquakesStart: 36,
  earthquakesDone: 68,
  networksStart: 78,
  networksDone: 92,
  finalize: 97,
  complete: 100
}

function reportStartup(message, progress) {
  window.electronAPI?.reportStartup?.({ message, progress })
}

function notifyStartupReady(message = 'Startup complete.') {
  window.electronAPI?.notifyStartupReady?.({
    message,
    progress: STARTUP_PROGRESS.complete
  })
}

function notifyStartupFailed(message = 'Startup completed with warnings.') {
  window.electronAPI?.notifyStartupFailed?.({
    message,
    progress: STARTUP_PROGRESS.complete
  })
}

reportStartup('Booting renderer process...', STARTUP_PROGRESS.boot)

window.addEventListener('error', event => {
  const message = event?.error?.message || event?.message || 'Unknown renderer error'
  window.electronAPI?.reportError?.(message, {
    source: 'window.error',
    file: event?.filename,
    line: event?.lineno,
    column: event?.colno,
    stack: event?.error?.stack
  })
})

reportStartup('Core libraries ready.', STARTUP_PROGRESS.libraries)

window.addEventListener('unhandledrejection', event => {
  const reason = event?.reason
  const message = reason?.message || String(reason)
  window.electronAPI?.reportError?.(message, {
    source: 'window.unhandledrejection',
    stack: reason?.stack
  })
})

// ------- Sound Notifications -------
function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    const play = (freq, startAt, duration, vol = 0.25) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startAt)
      gain.gain.setValueAtTime(0, ctx.currentTime + startAt)
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + startAt + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startAt + duration)
      osc.connect(gain)
      osc.start(ctx.currentTime + startAt)
      osc.stop(ctx.currentTime + startAt + duration)
      osc.onended = () => { try { ctx.close() } catch (_) {} }
    }

    if (type === 'waveform') {
      play(880, 0, 0.18)
      play(1320, 0.16, 0.28)
    } else if (type === 'stations') {
      play(660, 0, 0.22, 0.15)
    }
  } catch (_) {
    // Audio not available; silently ignore
  }
}

// ------- Map Init -------
function initMap() {
  map = L.map('map', {
    center: [20, 0],
    zoom: 2,
    zoomControl: true
  })

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map)

  markers.addTo(map)
  // fireballMarkers and volcanoMarkers start off-map; added when their tabs activate
}

// ------- Source Availability Check (GSRAS probe) -------
async function checkSourceAvailability() {
  // Probe GSRAS with a minimal query, 3s timeout
  try {
    const testUrl = `${GSRAS_EVENT_URL}?format=text&limit=1&starttime=${new Date(Date.now()-3600000).toISOString().slice(0,19)}&endtime=${new Date().toISOString().slice(0,19)}`
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(testUrl, { signal: controller.signal })
    clearTimeout(tid)
    if (res.ok || res.status === 204 || res.status === 400) {
      sourceAvailability.gsras = true
      GLOBAL_FEED_PROVIDERS.gsras = { label: 'Russia (GSRAS)' }
      const sel = document.getElementById('global-source-select')
      if (sel) {
        const opt = document.createElement('option')
        opt.value = 'gsras'
        opt.textContent = 'Global Source: Russia (GSRAS)'
        sel.appendChild(opt)
      }
    }
  } catch {
    // GSRAS offline — silently skip; already not in dropdown
  }
}

// ------- Magnitude Helpers -------
function magColor(mag) {
  if (mag < 2.5) return '#3fb950'
  if (mag < 4.5) return '#d29922'
  if (mag < 6.0) return '#f0883e'
  if (mag < 7.0) return '#f85149'
  return '#bc8cff'
}

function magClass(mag) {
  if (mag < 2.5) return 'mag-low'
  if (mag < 4.5) return 'mag-medium'
  if (mag < 6.0) return 'mag-high'
  if (mag < 7.0) return 'mag-severe'
  return 'mag-major'
}

function magRadius(mag) {
  return Math.max(4, mag * 3)
}

function timeAgo(timestamp) {
  const diff = (Date.now() - timestamp) / 1000
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ------- Live Event Notifier -------
function notifyLatestEvent(features) {
  const textEl = document.getElementById('live-event-text')
  const dotEl  = document.getElementById('live-event-dot')
  const banner = document.getElementById('live-event-banner')
  if (!textEl || !dotEl || !banner) return

  if (!features.length) {
    textEl.textContent = 'No events in current window'
    dotEl.className = ''
    return
  }

  const latest = features.reduce((a, b) =>
    ((b.properties.time || 0) > (a.properties.time || 0) ? b : a)
  )
  const p   = latest.properties
  const mag  = p.mag != null ? p.mag : 0
  const place = p.place || 'Unknown location'
  const ageLabel = Number.isFinite(p.time) ? timeAgo(p.time) : 'just now'
  const isNew = latest.id !== lastSeenEventId && lastSeenEventId !== null

  textEl.textContent = `M${mag.toFixed(1)} — ${place}  (${ageLabel})`

  dotEl.className = ''
  banner.classList.remove('alert-major')
  if (mag >= 7.0) {
    dotEl.className = 'pulse-purple'
    banner.classList.add('alert-major')
  } else if (mag >= 6.0) {
    dotEl.className = 'pulse-red'
  } else if (mag >= 5.0) {
    dotEl.className = 'pulse-orange'
  } else if (mag >= 4.0) {
    dotEl.className = 'pulse-yellow'
  } else {
    dotEl.className = 'pulse-green'
  }

  if (isNew) {
    const coords = latest.geometry && latest.geometry.coordinates
    if (coords && map) {
      const zoom = mag >= 6.0 ? 5 : 4
      map.setView([coords[1], coords[0]], zoom, { animate: true })
    }
    const cls = dotEl.className
    dotEl.className = ''
    void dotEl.offsetWidth
    dotEl.className = cls
  }

  lastSeenEventId = latest.id
}

// ------- Fetch & Render Earthquakes -------
async function loadEarthquakes(isStartup = false) {
  const countEl = document.getElementById('quake-count')
  const cacheKey = getEarthquakeCacheKey()
  countEl.textContent = currentEarthquakes.length ? 'Refreshing...' : 'Loading...'

  if (isStartup) {
    reportStartup(`Loading ${getSelectedRegionLabel()} earthquake feed...`, STARTUP_PROGRESS.earthquakesStart)
  }

  try {
    currentEarthquakes = await fetchEarthquakesByRegion(getSelectedRegionKey())
    lastGoodEarthquakeCache.set(cacheKey, currentEarthquakes.slice())
    renderEarthquakes(currentEarthquakes)
    try {
      notifyLatestEvent(currentEarthquakes)
    } catch (notifyErr) {
      console.error('Live event notifier error:', notifyErr)
    }
    updateStatsView()

    const now = new Date().toLocaleTimeString()
    const regionLabel = getSelectedRegionLabel()
    const sourceSuffix = getSelectedRegionKey() === 'global'
      ? (() => {
          const selected = getSelectedGlobalProviderKey()
          const selectedLabel = getSelectedGlobalProviderLabel()
          const resolvedLabel = GLOBAL_FEED_PROVIDERS[lastSuccessfulGlobalProviderKey]?.label || selectedLabel
          return selected === lastSuccessfulGlobalProviderKey
            ? ` · Source: ${selectedLabel}`
            : ` · Source: ${selectedLabel} (fallback: ${resolvedLabel})`
        })()
      : ''
    countEl.textContent = `${currentEarthquakes.length} earthquakes (${regionLabel}${sourceSuffix})`
    document.getElementById('last-updated').textContent = `Updated: ${now}`
    if (isStartup) {
      reportStartup(`Loaded ${currentEarthquakes.length} earthquakes for ${getSelectedRegionLabel()}.`, STARTUP_PROGRESS.earthquakesDone)
    }
    return true
  } catch (err) {
    const cached = lastGoodEarthquakeCache.get(cacheKey)
    if (Array.isArray(cached) && cached.length) {
      currentEarthquakes = cached.slice()
      renderEarthquakes(currentEarthquakes)
      updateStatsView()

      const regionLabel = getSelectedRegionLabel()
      const sourceSuffix = getSelectedRegionKey() === 'global'
        ? (() => {
            const selected = getSelectedGlobalProviderKey()
            const selectedLabel = getSelectedGlobalProviderLabel()
            const resolvedLabel = GLOBAL_FEED_PROVIDERS[lastSuccessfulGlobalProviderKey]?.label || selectedLabel
            return selected === lastSuccessfulGlobalProviderKey
              ? ` · Source: ${selectedLabel}`
              : ` · Source: ${selectedLabel} (fallback: ${resolvedLabel})`
          })()
        : ''
      countEl.textContent = `${currentEarthquakes.length} earthquakes (${regionLabel}${sourceSuffix}) · stale cache`
      document.getElementById('last-updated').textContent = `Update failed at ${new Date().toLocaleTimeString()} · showing last good data`
    } else {
      countEl.textContent = `Error: ${err.message}`
      document.getElementById('earthquake-list').innerHTML =
        `<div style="padding:12px;color:#f85149">Could not load earthquakes: ${err.message}</div>`
    }

    const textEl = document.getElementById('live-event-text')
    const dotEl = document.getElementById('live-event-dot')
    const banner = document.getElementById('live-event-banner')
    if (textEl) textEl.textContent = 'Live status unavailable (using cached data)'
    if (!lastGoodEarthquakeCache.get(cacheKey)) {
      if (dotEl) dotEl.className = ''
      if (banner) banner.classList.remove('alert-major')
    }
    if (isStartup) {
      reportStartup(`Earthquake feed failed: ${err.message}`, STARTUP_PROGRESS.earthquakesDone)
    }
    return false
  }
}

function feedWindowStartIso() {
  const feed = document.getElementById('feed-select').value
  const now = new Date()
  const start = new Date(now.getTime())

  if (feed === 'all_hour.geojson') {
    start.setHours(start.getHours() - 1)
  } else if (feed === 'all_day.geojson') {
    start.setDate(start.getDate() - 1)
  } else if (feed === 'all_week.geojson') {
    start.setDate(start.getDate() - 7)
  } else {
    start.setMonth(start.getMonth() - 1)
  }

  return start.toISOString().slice(0, 19)
}

function getFeedWindowRange() {
  const start = new Date(feedWindowStartIso() + 'Z')
  const end = new Date()
  return { start, end }
}

function getSelectedMinimumMagnitude() {
  const rawValue = document.getElementById('quake-mag-filter')?.value ?? '1'
  const parsed = Number(rawValue)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 1
}

function filterFeaturesByMinimumMagnitude(features, minMagnitude = getSelectedMinimumMagnitude()) {
  return (Array.isArray(features) ? features : []).filter(feature => {
    const mag = Number(feature?.properties?.mag)
    return Number.isFinite(mag) && mag >= minMagnitude
  })
}

function getEarthquakeCacheKey() {
  const regionKey = getSelectedRegionKey()
  const feedKey = document.getElementById('feed-select')?.value || 'all_day.geojson'
  const minMagKey = getSelectedMinimumMagnitude().toFixed(0)
  if (regionKey === 'global') {
    const providerKey = getSelectedGlobalProviderKey()
    return `${regionKey}:${providerKey}:${feedKey}:m${minMagKey}`
  }
  return `${regionKey}:${feedKey}:m${minMagKey}`
}

function getSelectedGlobalProviderKey() {
  const selected = document.getElementById('global-source-select')?.value || 'usgs'
  return GLOBAL_FEED_PROVIDERS[selected] ? selected : 'usgs'
}

function getSelectedGlobalProviderLabel() {
  return GLOBAL_FEED_PROVIDERS[getSelectedGlobalProviderKey()].label
}

function updateGlobalSourceVisibility() {
  const sourceSelect = document.getElementById('global-source-select')
  const regionKey = getSelectedRegionKey()
  if (!sourceSelect) return
  sourceSelect.style.display = regionKey === 'global' ? 'block' : 'none'
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchParsedWithRetry({
  url,
  parse = 'json',
  timeoutMs = REQUEST_TIMEOUT_MS,
  attempts = PROVIDER_MAX_ATTEMPTS,
  retryBackoffMs = PROVIDER_RETRY_BACKOFF_MS,
  sourceLabel = 'feed'
}) {
  let lastError = null

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url, {}, timeoutMs)
      if (!res.ok) throw new Error(`${sourceLabel} HTTP ${res.status}`)
      return parse === 'text' ? await res.text() : await res.json()
    } catch (err) {
      lastError = err
      if (attempt < attempts) {
        const delay = retryBackoffMs * Math.pow(2, attempt - 1)
        await sleep(delay)
      }
    }
  }

  throw lastError || new Error(`${sourceLabel} request failed`)
}

function getGlobalProviderFailoverOrder(primaryKey) {
  const keys = Object.keys(GLOBAL_FEED_PROVIDERS)
  const safePrimary = GLOBAL_FEED_PROVIDERS[primaryKey] ? primaryKey : 'usgs'
  return [safePrimary, ...keys.filter(k => k !== safePrimary)]
}

async function fetchGlobalWithFailover(primaryKey) {
  const order = getGlobalProviderFailoverOrder(primaryKey)
  const errors = []

  for (const providerKey of order) {
    const adapter = GLOBAL_FEED_ADAPTERS[providerKey]
    if (!adapter) continue
    try {
      const features = await adapter()
      lastSuccessfulGlobalProviderKey = providerKey
      return { features, providerKey }
    } catch (err) {
      errors.push(`${providerKey}: ${err?.message || String(err)}`)
      window.electronAPI?.reportError?.('Global provider fetch failed', {
        source: 'fetchGlobalWithFailover',
        providerKey,
        error: err?.message,
        stack: err?.stack
      })
    }
  }

  throw new Error(`All global providers failed (${errors.join(' | ')})`)
}

function normalizeProviderFeature(feature, fallbackSourceAgency) {
  const rawProps = feature?.properties || {}
  const rawGeom = feature?.geometry || {}
  const coords = Array.isArray(rawGeom.coordinates) ? rawGeom.coordinates : [0, 0, 0]

  const lon = Number(coords[0])
  const lat = Number(coords[1])
  const depth = Number(coords[2])
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null

  const magCandidates = [rawProps.mag, rawProps.magnitude, rawProps.mag_value]
  const magValue = magCandidates.map(Number).find(Number.isFinite)
  const timeCandidates = [rawProps.time, rawProps.date, rawProps.datetime, rawProps.origin_time]
  const timeValue = timeCandidates.find(v => Number.isFinite(Number(v)) || !Number.isNaN(Date.parse(v)))
  const eventTimeMs = Number.isFinite(Number(timeValue)) ? Number(timeValue) : Date.parse(timeValue)
  if (!Number.isFinite(eventTimeMs)) return null

  const place = rawProps.place || rawProps.flynn_region || rawProps.region || rawProps.title || 'Unknown location'
  const eventId = feature?.id || rawProps.id || `${eventTimeMs}-${lat}-${lon}`

  return {
    type: 'Feature',
    id: eventId,
    geometry: {
      type: 'Point',
      coordinates: [lon, lat, Number.isFinite(depth) ? depth : 0]
    },
    properties: {
      ...rawProps,
      mag: Number.isFinite(magValue) ? magValue : 0,
      place,
      time: eventTimeMs,
      sourceAgency: rawProps.sourceAgency || fallbackSourceAgency
    }
  }
}

function parseFdsnEventTextGeneric(text, fallbackSourceAgency) {
  if (!text) return []
  const rows = text.replace(/\r/g, '').split('\n').filter(line => line && !line.startsWith('#'))
  const features = []

  for (const row of rows) {
    const parts = row.split('|')
    if (parts.length < 5) continue

    const eventId = parts[0]
    const eventTime = parts[1]
    const lat = Number(parts[2])
    const lon = Number(parts[3])
    const depth = Number(parts[4])
    const magType = parts[9] || null
    const mag = Number(parts[10])
    const place = parts[12] || parts[11] || 'Unknown location'
    const timeMs = Date.parse(eventTime)

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(timeMs)) continue

    features.push({
      type: 'Feature',
      id: eventId || `${timeMs}-${lat}-${lon}`,
      geometry: {
        type: 'Point',
        coordinates: [lon, lat, Number.isFinite(depth) ? depth : 0]
      },
      properties: {
        mag: Number.isFinite(mag) ? mag : 0,
        magType,
        place,
        time: timeMs,
        sourceAgency: fallbackSourceAgency
      }
    })
  }

  return features
}

async function fetchGlobalFromUsgsAdapter() {
  return fetchUsgsEarthquakes()
}

async function fetchGlobalFromEmscAdapter() {
  const { start, end } = getFeedWindowRange()
  const minMagnitude = getSelectedMinimumMagnitude()
  const url = `${EMSC_EVENT_URL}?format=json&limit=400&starttime=${encodeURIComponent(start.toISOString())}&endtime=${encodeURIComponent(end.toISOString())}&minmagnitude=${encodeURIComponent(minMagnitude)}`
  const data = await fetchParsedWithRetry({
    url,
    parse: 'json',
    sourceLabel: 'EMSC'
  })
  const features = Array.isArray(data?.features) ? data.features : []
  return features
    .map(f => normalizeProviderFeature(f, 'SeismicPortal / EMSC'))
    .filter(Boolean)
}

async function fetchGlobalFromIscAdapter() {
  const { start, end } = getFeedWindowRange()
  const minMagnitude = getSelectedMinimumMagnitude()
  const query = `${ISC_EVENT_URL}?format=text&starttime=${encodeURIComponent(start.toISOString())}&endtime=${encodeURIComponent(end.toISOString())}&limit=400&minmagnitude=${encodeURIComponent(minMagnitude)}`
  const text = await fetchParsedWithRetry({
    url: query,
    parse: 'text',
    sourceLabel: 'ISC'
  })
  return parseFdsnEventTextGeneric(text, 'ISC')
}

async function fetchGlobalFromGeofonAdapter() {
  const { start, end } = getFeedWindowRange()
  const minMagnitude = getSelectedMinimumMagnitude()
  const url = `${GEOFON_EVENT_URL}?format=json&limit=400&starttime=${encodeURIComponent(start.toISOString())}&endtime=${encodeURIComponent(end.toISOString())}&minmagnitude=${encodeURIComponent(minMagnitude)}`
  const data = await fetchParsedWithRetry({ url, parse: 'json', sourceLabel: 'GEOFON' })
  const features = Array.isArray(data?.features) ? data.features : []
  return features.map(f => normalizeProviderFeature(f, 'GEOFON')).filter(Boolean)
}

async function fetchGlobalFromGsrasAdapter() {
  const { start, end } = getFeedWindowRange()
  const minMagnitude = getSelectedMinimumMagnitude()
  const url = `${GSRAS_EVENT_URL}?format=text&limit=400&starttime=${encodeURIComponent(start.toISOString())}&endtime=${encodeURIComponent(end.toISOString())}&minmagnitude=${encodeURIComponent(minMagnitude)}`
  const text = await fetchParsedWithRetry({ url, parse: 'text', sourceLabel: 'GSRAS', timeoutMs: 8000 })
  return parseFdsnEventTextGeneric(text, 'GSRAS')
}

async function fetchItalyEarthquakes() {
  const starttime = feedWindowStartIso()
  const endtime = new Date().toISOString().slice(0, 19)
  const minMagnitude = getSelectedMinimumMagnitude()
  // INGV covers all of Italy including Campi Flegrei, Etna, Vesuvius networks
  const url = `${ITALY_EVENT_URL}?format=geojson&starttime=${starttime}&endtime=${endtime}&minlat=35&maxlat=47&minlon=6&maxlon=19&limit=500&minmagnitude=${encodeURIComponent(minMagnitude)}`
  const data = await fetchParsedWithRetry({ url, parse: 'json', sourceLabel: 'INGV Italy' })
  const features = Array.isArray(data?.features) ? data.features : []
  return features.map(f => normalizeProviderFeature(f, 'INGV')).filter(Boolean)
}

const GLOBAL_FEED_ADAPTERS = {
  usgs: fetchGlobalFromUsgsAdapter,
  emsc: fetchGlobalFromEmscAdapter,
  isc: fetchGlobalFromIscAdapter,
  geofon: fetchGlobalFromGeofonAdapter,
  gsras: fetchGlobalFromGsrasAdapter
}

async function fetchEarthquakesByRegion(regionKey) {
  if (regionKey === 'canada') return filterFeaturesByMinimumMagnitude(await fetchCanadaEarthquakes())
  if (regionKey === 'europe') return filterFeaturesByMinimumMagnitude(await fetchEuropeEarthquakes())
  if (regionKey === 'japan') return filterFeaturesByMinimumMagnitude(await fetchJapanEarthquakes())
  if (regionKey === 'italy') return filterFeaturesByMinimumMagnitude(await fetchItalyEarthquakes())
  const providerKey = getSelectedGlobalProviderKey()
  const { features } = await fetchGlobalWithFailover(providerKey)
  return filterFeaturesByMinimumMagnitude(features)
}

async function fetchUsgsEarthquakes() {
  const { start, end } = getFeedWindowRange()
  const minMagnitude = getSelectedMinimumMagnitude()
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&limit=2000&starttime=${encodeURIComponent(start.toISOString())}&endtime=${encodeURIComponent(end.toISOString())}&minmagnitude=${encodeURIComponent(minMagnitude)}`
  const data = await fetchParsedWithRetry({
    url,
    parse: 'json',
    sourceLabel: 'USGS'
  })
  return Array.isArray(data.features) ? data.features : []
}

async function fetchCanadaEarthquakes() {
  const starttime = feedWindowStartIso()
  const endtime = new Date().toISOString().slice(0, 19)
  const minMagnitude = getSelectedMinimumMagnitude()
  const url = `${CANADA_EVENT_URL}?format=text&starttime=${encodeURIComponent(starttime)}&endtime=${encodeURIComponent(endtime)}&minmagnitude=${encodeURIComponent(minMagnitude)}`
  const text = await fetchParsedWithRetry({
    url,
    parse: 'text',
    sourceLabel: 'Earthquakes Canada'
  })
  return parseCanadaEventText(text)
}

function parseCanadaEventText(text) {
  if (!text) return []
  const rows = text.replace(/\r/g, '').split('\n').filter(line => line && !line.startsWith('#'))
  const features = []

  for (const row of rows) {
    const parts = row.split('|')
    if (parts.length < 8) continue
    const [eventId, time, lat, lon, depthKm, magType, mag, place] = parts
    const latNum = Number(lat)
    const lonNum = Number(lon)
    const depthNum = Number(depthKm)
    const magNum = Number(mag)
    const timeMs = Date.parse(time)
    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum) || !Number.isFinite(timeMs)) continue

    features.push({
      type: 'Feature',
      id: eventId,
      geometry: {
        type: 'Point',
        coordinates: [lonNum, latNum, Number.isFinite(depthNum) ? depthNum : 0]
      },
      properties: {
        mag: Number.isFinite(magNum) ? magNum : 0,
        magType: magType || null,
        place: place || 'Canada',
        time: timeMs,
        type: 'earthquake',
        status: 'reviewed',
        sourceAgency: 'Earthquakes Canada'
      }
    })
  }

  return features
}

async function fetchEuropeEarthquakes() {
  const starttime = feedWindowStartIso().slice(0, 10)
  const endtime = new Date().toISOString().slice(0, 10)
  const minMagnitude = getSelectedMinimumMagnitude()
  const region = EARTHQUAKE_REGIONS.europe
  const url = `${EUROPE_EVENT_URL}?format=json&limit=400&starttime=${encodeURIComponent(starttime)}&endtime=${encodeURIComponent(endtime)}&minlat=${region.latMin}&maxlat=${region.latMax}&minlon=${region.lonMin}&maxlon=${region.lonMax}&minmagnitude=${encodeURIComponent(minMagnitude)}`
  const data = await fetchParsedWithRetry({
    url,
    parse: 'json',
    sourceLabel: 'SeismicPortal'
  })
  const features = Array.isArray(data?.features) ? data.features : []
  const mapped = features.map(f => normalizeProviderFeature(f, 'SeismicPortal / EMSC')).filter(Boolean)
  await enrichMissingPlacesWithCoordinates(mapped, PLACE_ENRICH_LIMIT_PER_FETCH)
  return mapped
}

function coordCacheKey(lat, lon) {
  // Round to reduce duplicate reverse-geocode lookups for nearby points.
  return `${lat.toFixed(2)},${lon.toFixed(2)}`
}

function isUnknownPlace(place) {
  if (!place) return true
  const normalized = String(place).trim().toLowerCase()
  return !normalized || normalized === 'unknown location' || normalized === 'unknown'
}

async function reverseLookupPlaceName(lat, lon) {
  const key = coordCacheKey(lat, lon)
  if (reversePlaceCache.has(key)) {
    return reversePlaceCache.get(key)
  }

  const url = `${REVERSE_GEOCODE_ENDPOINT}?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&language=en&count=1`
  try {
    const data = await fetchParsedWithRetry({
      url,
      parse: 'json',
      sourceLabel: 'ReverseGeocode',
      attempts: 2,
      retryBackoffMs: 300,
      timeoutMs: 8000
    })
    const result = Array.isArray(data?.results) ? data.results[0] : null
    const label = result
      ? [result.name, result.admin1, result.country].filter(Boolean).join(', ')
      : ''
    const place = label || 'Unknown location'
    reversePlaceCache.set(key, place)
    return place
  } catch (_) {
    reversePlaceCache.set(key, 'Unknown location')
    return 'Unknown location'
  }
}

async function enrichMissingPlacesWithCoordinates(features, limit = 25) {
  const targets = []
  for (const feature of features) {
    if (targets.length >= limit) break
    const props = feature?.properties
    const coords = feature?.geometry?.coordinates
    if (!props || !Array.isArray(coords) || coords.length < 2) continue
    if (!isUnknownPlace(props.place)) continue
    const lon = Number(coords[0])
    const lat = Number(coords[1])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    targets.push({ props, lat, lon })
  }

  // Resolve in parallel with bounded concurrency to keep UI responsive.
  const batchSize = 5
  for (let i = 0; i < targets.length; i += batchSize) {
    const chunk = targets.slice(i, i + batchSize)
    const resolved = await Promise.all(chunk.map(item => reverseLookupPlaceName(item.lat, item.lon)))
    chunk.forEach((item, idx) => {
      if (resolved[idx] && resolved[idx] !== 'Unknown location') {
        item.props.place = resolved[idx]
      }
    })
  }
}

async function fetchJapanEarthquakes() {
  const items = await fetchParsedWithRetry({
    url: JAPAN_EVENT_URL,
    parse: 'json',
    sourceLabel: 'JMA'
  })
  const minTime = new Date(feedWindowStartIso()).getTime()
  const features = []

  for (const item of Array.isArray(items) ? items : []) {
    const timeMs = Date.parse(item?.at)
    if (!Number.isFinite(timeMs) || timeMs < minTime) continue

    const cod = String(item?.cod || '')
    const match = cod.match(/^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)-([+-]?\d+)(?:\/.*)?$/)
    if (!match) continue

    const latNum = Number(match[1])
    const lonNum = Number(match[2])
    const depthMeters = Number(match[3])
    const magNum = Number(item?.mag)

    if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) continue

    features.push({
      type: 'Feature',
      id: item?.eid || `${timeMs}-${latNum}-${lonNum}`,
      geometry: {
        type: 'Point',
        coordinates: [lonNum, latNum, Number.isFinite(depthMeters) ? depthMeters / 1000 : 0]
      },
      properties: {
        mag: Number.isFinite(magNum) ? magNum : 0,
        magType: null,
        place: item?.en_anm || item?.anm || 'Japan',
        time: timeMs,
        type: 'earthquake',
        status: item?.ift || null,
        sourceAgency: 'JMA'
      }
    })
  }

  return features
}

function getSelectedRegionKey() {
  const selected = document.getElementById('region-select')?.value || 'global'
  return EARTHQUAKE_REGIONS[selected] ? selected : 'global'
}

function getSelectedRegionLabel() {
  return EARTHQUAKE_REGIONS[getSelectedRegionKey()].label
}

function filterEventsBySelectedRegion(features) {
  return [...features]
}

function renderEarthquakes(features) {
  markers.clearLayers()
  const list = document.getElementById('earthquake-list')
  list.innerHTML = ''

  features.sort((a, b) => b.properties.time - a.properties.time)

  features.forEach(f => {
    const p = f.properties
    const [lon, lat, depth] = f.geometry.coordinates
    const mag = p.mag ?? 0
    const place = p.place ?? 'Unknown location'
    const time = p.time

    const circle = L.circleMarker([lat, lon], {
      radius: magRadius(mag),
      fillColor: magColor(mag),
      fillOpacity: 0.75,
      color: '#fff',
      weight: 0.5
    })

    circle.on('click', () => {
      openEarthquakeDetails(f)
    })

    markers.addLayer(circle)

    const item = document.createElement('div')
    item.className = 'quake-item'
    item.innerHTML = `
      <div class="quake-mag ${magClass(mag)}">${mag.toFixed(1)}</div>
      <div class="quake-info">
        <div class="quake-place">${escapeHtml(place)}</div>
        <div class="quake-meta">Depth ${depth?.toFixed(0) ?? '?'} km · ${timeAgo(time)}</div>
      </div>
    `
    item.addEventListener('click', () => {
      map.setView([lat, lon], 6, { animate: true })
      openEarthquakeDetails(f)
    })
    list.appendChild(item)
  })
}

function getFireballFieldIndex(fields, name) {
  return Array.isArray(fields) ? fields.indexOf(name) : -1
}

function applyFireballFilters() {
  const filters = readFilters()
  const filtered = filterFireballs(currentFireballs, filters)
  const mappable = filtered.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon))
  renderFireballOverlay(mappable)
  updateFireballSummary(filtered, mappable.length)
  if (activeMapMode === 'fireballs') fitMapToFireballs(mappable)
  const trend = buildFireballTrend(filtered)
  renderFireballTrend('fireball-trend-chart', trend)
  updateTrendSummary(trend)
}

function parseFireballCoordinate(value, direction) {
  const numeric = parseFloat(value ?? Number.NaN)
  if (!Number.isFinite(numeric)) return null
  if (direction === 'S' || direction === 'W') return -numeric
  return numeric
}

function formatFireballDate(value) {
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return value || 'Unknown date'
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  })
}

function formatFireballCoordinate(value, positiveSuffix, negativeSuffix) {
  if (!Number.isFinite(value)) return 'Unknown'
  const suffix = value < 0 ? negativeSuffix : positiveSuffix
  return `${Math.abs(value).toFixed(2)}° ${suffix}`
}

function updateFireballSummary(events, mappableCount) {
  const countNode = document.getElementById('fireball-count')
  const latestNode = document.getElementById('fireball-latest')
  if (!countNode || !latestNode) return

  const mapped = typeof mappableCount === 'number' ? mappableCount : events.length
  countNode.textContent = mapped < events.length
    ? `${events.length} (${mapped} on map)`
    : String(events.length)
  if (!events.length) {
    latestNode.textContent = 'No recent event'
    return
  }

  const latest = [...events].sort((left, right) => Date.parse(right.date || 0) - Date.parse(left.date || 0))[0]
  latestNode.textContent = formatFireballDate(latest?.date)
}

function fitMapToFireballs(events) {
  if (!map || !events.length) {
    map?.setView([20, 0], 2, { animate: false })
    return
  }

  const bounds = []
  for (const event of events) {
    if (Number.isFinite(event.lat) && Number.isFinite(event.lon)) {
      bounds.push([event.lat, event.lon])
    }
  }

  if (!bounds.length) {
    map.setView([20, 0], 2, { animate: false })
    return
  }

  if (bounds.length === 1) {
    map.setView(bounds[0], 4, { animate: false })
    return
  }

  map.fitBounds(bounds, {
    padding: [36, 36],
    maxZoom: 5,
    animate: false
  })
}

function renderFireballOverlay(events) {
  fireballMarkers.clearLayers()

  for (const event of events) {
    if (!Number.isFinite(event.lat) || !Number.isFinite(event.lon)) continue
    const energyKt = Number.isFinite(event.impactEnergyKt) ? event.impactEnergyKt : 0.05
    const radius = Math.max(4, Math.min(16, 4 + (Math.log10(energyKt + 1) * 5)))
    const marker = L.circleMarker([event.lat, event.lon], {
      radius,
      fillColor: '#ffb347',
      fillOpacity: 0.72,
      color: '#fff1d6',
      weight: 0.8
    })

    marker.bindPopup(`
      <div style="min-width:220px;color:#111;line-height:1.45;">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#7a5a19;font-weight:700;">NASA Fireball</div>
        <div style="font-size:16px;font-weight:700;margin-top:4px;">${formatFireballDate(event.date)}</div>
        <div style="margin-top:8px;"><strong>Impact energy:</strong> ${Number.isFinite(event.impactEnergyKt) ? `${event.impactEnergyKt.toFixed(3)} kt` : 'Unknown'}</div>
        <div><strong>Radiated energy:</strong> ${Number.isFinite(event.radiatedEnergy) ? `${event.radiatedEnergy.toFixed(2)} ×10^10 J` : 'Unknown'}</div>
        <div><strong>Altitude:</strong> ${Number.isFinite(event.altitudeKm) ? `${event.altitudeKm.toFixed(1)} km` : 'Unknown'}</div>
        <div><strong>Coordinates:</strong> ${formatFireballCoordinate(event.lat, 'N', 'S')} , ${formatFireballCoordinate(event.lon, 'E', 'W')}</div>
        <button class="fireball-send-notes" data-date="${escapeHtml(event.date || '')}" data-energy="${event.impactEnergyKt ?? ''}" data-alt="${event.altitudeKm ?? ''}" data-lat="${event.lat}" data-lon="${event.lon}" style="margin-top:8px;background:#1f6feb;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Send to Notes</button>
      </div>
    `)

    fireballMarkers.addLayer(marker)
  }
}

function setFireballStatus(message, kind = '') {
  const node = document.getElementById('fireball-status')
  if (!node) return
  node.textContent = message
  node.className = `fireball-status${kind ? ` ${kind}` : ''}`
}

function refreshMapLayersForMode() {
  if (!map) return

  // Earthquake markers: show only in earthquakes/stations/stats mode
  const showQuakes = activeMapMode === 'earthquakes' || activeMapMode === 'stations' || activeMapMode === 'stats'
  if (showQuakes && !map.hasLayer(markers)) markers.addTo(map)
  if (!showQuakes && map.hasLayer(markers)) map.removeLayer(markers)

  // Fireball markers: show only in fireballs mode
  if (activeMapMode === 'fireballs' && !map.hasLayer(fireballMarkers)) fireballMarkers.addTo(map)
  if (activeMapMode !== 'fireballs' && map.hasLayer(fireballMarkers)) map.removeLayer(fireballMarkers)

  // Volcano markers: show only in volcanoes mode
  if (activeMapMode === 'volcanoes' && !map.hasLayer(volcanoMarkers)) volcanoMarkers.addTo(map)
  if (activeMapMode !== 'volcanoes' && map.hasLayer(volcanoMarkers)) map.removeLayer(volcanoMarkers)
}

async function loadFireballOverlay(force = false) {
  if (fireballOverlayLoaded && !force) return true

  try {
    const payload = await fetchJsonWithTimeout('https://ssd-api.jpl.nasa.gov/fireball.api?sort=-date', 'NASA Fireballs')
    const fields = Array.isArray(payload?.fields) ? payload.fields : []
    const dateIndex = getFireballFieldIndex(fields, 'date')
    const energyIndex = getFireballFieldIndex(fields, 'energy')
    const impactIndex = getFireballFieldIndex(fields, 'impact-e')
    const latIndex = getFireballFieldIndex(fields, 'lat')
    const latDirIndex = getFireballFieldIndex(fields, 'lat-dir')
    const lonIndex = getFireballFieldIndex(fields, 'lon')
    const lonDirIndex = getFireballFieldIndex(fields, 'lon-dir')
    const altIndex = getFireballFieldIndex(fields, 'alt')
    const rows = Array.isArray(payload?.data) ? payload.data : []

    const allFireballs = rows.map((row, index) => ({
      id: `fireball-${index}`,
      date: dateIndex >= 0 ? row[dateIndex] : null,
      radiatedEnergy: energyIndex >= 0 ? parseFloat(row[energyIndex] ?? Number.NaN) : Number.NaN,
      impactEnergyKt: impactIndex >= 0 ? parseFloat(row[impactIndex] ?? Number.NaN) : Number.NaN,
      lat: parseFireballCoordinate(latIndex >= 0 ? row[latIndex] : null, latDirIndex >= 0 ? row[latDirIndex] : null),
      lon: parseFireballCoordinate(lonIndex >= 0 ? row[lonIndex] : null, lonDirIndex >= 0 ? row[lonDirIndex] : null),
      altitudeKm: altIndex >= 0 ? parseFloat(row[altIndex] ?? Number.NaN) : Number.NaN
    }))
    currentFireballs = allFireballs
    const mappable = allFireballs.filter(event => Number.isFinite(event.lat) && Number.isFinite(event.lon))

    renderFireballOverlay(mappable)
    updateFireballSummary(allFireballs, mappable.length)
    populateYearDropdown(allFireballs)
    const trend = buildFireballTrend(allFireballs)
    renderFireballTrend('fireball-trend-chart', trend)
    updateTrendSummary(trend)
    if (activeMapMode === 'fireballs') {
      fitMapToFireballs(mappable)
    }
    setFireballStatus(
      allFireballs.length
        ? `Loaded ${allFireballs.length} NASA fireball events (${mappable.length} with coordinates). Click a marker to inspect details.`
        : 'No NASA fireball events were returned.',
      allFireballs.length ? 'ok' : ''
    )
    fireballOverlayLoaded = true
    return true
  } catch {
    const cachedMappable = currentFireballs.filter(e => Number.isFinite(e.lat) && Number.isFinite(e.lon))
    updateFireballSummary(currentFireballs, cachedMappable.length)
    if (activeMapMode === 'fireballs' && cachedMappable.length) {
      fitMapToFireballs(cachedMappable)
    }
    setFireballStatus(
      currentFireballs.length
        ? `Using ${currentFireballs.length} cached NASA fireball events.`
        : 'Fireball data could not be loaded right now.',
      currentFireballs.length ? '' : 'error'
    )
    if (cachedMappable.length) {
      renderFireballOverlay(cachedMappable)
    }
    return false
  }
}

function openEarthquakeDetails(feature) {
  const panel = document.getElementById('quake-detail-panel')
  const content = document.getElementById('quake-detail-content')
  const title = document.getElementById('quake-detail-title')
  const subtitle = document.getElementById('quake-detail-subtitle')

  const p = feature?.properties || {}
  const [lon, lat, depth] = feature?.geometry?.coordinates || []
  const mag = p.mag ?? 0
  const place = p.place || 'Unknown location'

  title.textContent = `M${Number.isFinite(mag) ? mag.toFixed(1) : '?'} - ${place}`
  subtitle.textContent = `${new Date(p.time || Date.now()).toUTCString()} | ${p.type || 'earthquake'}`

  const details = {
    id: feature?.id,
    magnitude: p.mag,
    magnitudeType: p.magType,
    place: p.place,
    eventType: p.type,
    status: p.status,
    tsunami: p.tsunami,
    significance: p.sig,
    feltReports: p.felt,
    cdi: p.cdi,
    mmi: p.mmi,
    alert: p.alert,
    latitude: lat,
    longitude: lon,
    depthKm: depth,
    eventTimeUtc: p.time ? new Date(p.time).toISOString() : null,
    updatedUtc: p.updated ? new Date(p.updated).toISOString() : null,
    nst: p.nst,
    dmin: p.dmin,
    rms: p.rms,
    gap: p.gap,
    net: p.net,
    code: p.code,
    ids: p.ids,
    sources: p.sources,
    types: p.types,
    products: p.products,
    detailUrl: p.detail,
    usgsUrl: p.url
  }

  content.innerHTML = ''
  Object.entries(details).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    const card = document.createElement('div')
    card.className = 'detail-item'

    const label = document.createElement('div')
    label.className = 'detail-label'
    label.textContent = key

    const val = document.createElement('div')
    val.className = 'detail-value'
    val.textContent = String(value)

    card.appendChild(label)
    card.appendChild(val)
    content.appendChild(card)
  })

  const sendBtn = document.createElement('button')
  sendBtn.className = 'notes-send-btn'
  sendBtn.textContent = 'Send to Notes'
  sendBtn.addEventListener('click', () => {
    const lines = [`<b>Earthquake — ${title.textContent}</b><br>${subtitle.textContent}<br>`]
    Object.entries(details).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') lines.push(`${k}: ${v}`)
    })
    appendToNotes(`<div style="margin:8px 0;padding:8px;border-left:3px solid #f0883e;background:#161b22">${lines.join('<br>')}</div>`)
  })
  content.appendChild(sendBtn)

  panel.classList.remove('hidden')
}

function closeEarthquakeDetails() {
  document.getElementById('quake-detail-panel').classList.add('hidden')
}

// ------- Load Stations -------
async function loadStations() {
  const net = document.getElementById('station-network').value
  const center = getSelectedCenter()
  const list = document.getElementById('station-list')
  list.innerHTML = '<div style="padding:12px;color:#8b949e">Loading stations...</div>'

  try {
    const text = await fetchStationsForNetwork(center, net)
    renderStations(text, net)
  } catch (err) {
    window.electronAPI?.reportError?.('Station load failed', {
      source: 'loadStations',
      network: net,
      dataCenter: center.label,
      error: err?.message,
      stack: err?.stack
    })
    list.innerHTML = `<div style="padding:12px;color:#f85149">Error: ${escapeHtml(err.message)}</div>`
  }
}

function renderStations(text, net) {
  const list = document.getElementById('station-list')
  list.innerHTML = ''

  const parsedRows = readStationRows(text, MAX_STATIONS_RENDERED + 1)
  const lines = parsedRows.rows
  const limitedLines = lines.slice(0, MAX_STATIONS_RENDERED)
  const hasMoreRows = parsedRows.hasMore || lines.length > MAX_STATIONS_RENDERED
  const fragment = document.createDocumentFragment()

  limitedLines.forEach(line => {
    const parts = line.split('|')
    if (parts.length < 6) return

    const [network, station, lat, lon, elev, name] = parts
    const latNum = parseFloat(lat)
    const lonNum = parseFloat(lon)

    const item = document.createElement('div')
    item.className = 'station-item'

    const codeEl = document.createElement('div')
    codeEl.className = 'station-code'
    codeEl.textContent = `${network}.${station}`

    const nameEl = document.createElement('div')
    nameEl.className = 'station-name'
    nameEl.title = name
    nameEl.textContent = name

    const metaEl = document.createElement('div')
    metaEl.className = 'station-name'
    metaEl.textContent = `Lat: ${Number.isFinite(latNum) ? latNum.toFixed(2) : '?'}  Lon: ${Number.isFinite(lonNum) ? lonNum.toFixed(2) : '?'}  Elev: ${elev}m`

    item.appendChild(codeEl)
    item.appendChild(nameEl)
    item.appendChild(metaEl)
    item.addEventListener('click', () => openStationWaveform({ network, station, lat: latNum, lon: lonNum, name }))
    fragment.appendChild(item)
  })

  list.appendChild(fragment)
  if (limitedLines.length > 0) playSound('stations')

  if (hasMoreRows) {
    const note = document.createElement('div')
    note.style.padding = '10px 14px'
    note.style.color = '#8b949e'
    note.textContent = `Showing first ${MAX_STATIONS_RENDERED} stations for ${net}.`
    list.insertBefore(note, list.firstChild)
  }

  if (!lines.length) {
    list.innerHTML = '<div style="padding:12px;color:#8b949e">No stations found.</div>'
  }
}

async function fetchStationsForNetwork(center, net) {
  const params = ['net', 'network']
  const recentActiveSince = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19)
  const extraFilters = [`&endafter=${encodeURIComponent(recentActiveSince)}`, '']

  for (const key of params) {
    for (const extra of extraFilters) {
      const url = `${center.stationUrl}?${key}=${encodeURIComponent(net)}&format=text&level=station${extra}`
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const text = await res.text()
        if (hasStationRows(text)) return text
      } catch (_) {
        continue
      }
    }
  }

  throw new Error(`No station rows returned for network ${net} from ${center.label}`)
}

function hasStationRows(text) {
  if (!text) return false
  return readStationRows(text, 1).rows.length > 0
}

function readStationRows(text, maxRows = Infinity) {
  const rows = []
  let start = 0
  let hasMore = false

  for (let i = 0; i <= text.length; i++) {
    const isEnd = i === text.length
    const isLineBreak = !isEnd && text.charCodeAt(i) === 10
    if (!isEnd && !isLineBreak) continue

    let line = text.slice(start, i)
    if (line.endsWith('\r')) line = line.slice(0, -1)
    if (line && !line.startsWith('#')) {
      if (rows.length < maxRows) {
        rows.push(line)
      } else {
        hasMore = true
        break
      }
    }
    start = i + 1
  }

  return { rows, hasMore }
}

// ------- Waveform Panel -------
function openStationWaveform(station) {
  currentStation = station
  lastStation = station
  currentLiveStream = null
  window.electronAPI?.saveState('lastStation', station)
  const wp = document.getElementById('waveform-panel')
  wp.classList.remove('hidden', 'collapsed')
  document.getElementById('waveform-close').textContent = '✕'
  document.getElementById('waveform-title').textContent =
    `Waveform — ${station.network}.${station.station}  (${station.name})`
  document.getElementById('waveform-status').textContent = 'Searching live stream...'
  void initializeLiveWaveformForStation(station)
}

function reopenWaveformPanel() {
  const wp = document.getElementById('waveform-panel')
  wp.classList.remove('hidden', 'collapsed')
  document.getElementById('waveform-close').textContent = '✕'
  if (!lastStation) {
    document.getElementById('waveform-title').textContent = 'Waveform'
    document.getElementById('waveform-status').textContent = 'Select a station first to open live waveform.'
    return
  }
  openStationWaveform(lastStation)
}

async function initializeLiveWaveformForStation(station) {
  const streams = await discoverStationStreams(station)
  if (!streams.length) {
    document.getElementById('waveform-panel').classList.remove('hidden', 'collapsed')
    document.getElementById('waveform-status').textContent = 'No live MiniSEED stream found for this station.'
    return
  }

  currentLiveStream = streams[0]
  document.getElementById('waveform-panel').classList.remove('hidden', 'collapsed')
  await fetchWaveform()
  startWaveformAutoRefresh()
}

async function discoverStationStreams(station) {
  const center = getSelectedCenter()
  const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const end = new Date().toISOString()
  const urls = [
    `${center.stationUrl}?level=channel&format=text&net=${encodeURIComponent(station.network)}&sta=${encodeURIComponent(station.station)}&starttime=${encodeURIComponent(start)}&endtime=${encodeURIComponent(end)}`,
    `${center.stationUrl}?level=channel&format=text&network=${encodeURIComponent(station.network)}&station=${encodeURIComponent(station.station)}&starttime=${encodeURIComponent(start)}&endtime=${encodeURIComponent(end)}`
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const text = await res.text()
      const streams = parseStationChannelText(text, station)
      const ordered = orderStreamsByPriority(streams)
      const working = await findFirstWorkingLiveStream(station, ordered)
      if (working) return [working]
    } catch (_) {
      continue
    }
  }

  return []
}

function parseStationChannelText(text, station) {
  const lines = text.split('\n').filter(l => l && !l.startsWith('#'))
  const streams = []

  for (const line of lines) {
    const parts = line.split('|')
    if (parts.length < 4) continue
    const network = (parts[0] || '').trim()
    const sta = (parts[1] || '').trim()
    const loc = (parts[2] || '').trim() || '--'
    const cha = (parts[3] || '').trim().toUpperCase()
    if (network !== station.network || sta !== station.station) continue
    if (!cha) continue
    streams.push({ network, station: sta, loc, cha })
  }

  const seen = new Set()
  return streams.filter(s => {
    const key = `${s.loc}.${s.cha}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function orderStreamsByPriority(streams) {
  return [...streams].sort((a, b) => {
    const ai = CHANNEL_PRIORITY.indexOf(a.cha)
    const bi = CHANNEL_PRIORITY.indexOf(b.cha)
    const ap = ai === -1 ? 999 : ai
    const bp = bi === -1 ? 999 : bi
    return ap - bp
  })
}

async function findFirstWorkingLiveStream(station, streams) {
  for (const stream of streams) {
    const buffer = await fetchWaveformBuffer(station, stream, 60)
    if (buffer && buffer.byteLength > 0) return stream
  }
  return null
}

async function fetchWaveformBuffer(station, stream, windowSeconds) {
  const dataselectCandidates = getDataselectCandidates()
  const end = new Date()
  const start = new Date(end.getTime() - windowSeconds * 1000)
  const startIso = start.toISOString().replace('Z', '')
  const endIso = end.toISOString().replace('Z', '')

  for (const endpoint of dataselectCandidates) {
    const locCode = stream.loc && stream.loc !== '--' ? stream.loc : '*'
    const url = `${endpoint.url}?net=${encodeURIComponent(station.network)}&sta=${encodeURIComponent(station.station)}&loc=${encodeURIComponent(locCode)}&cha=${encodeURIComponent(stream.cha)}&starttime=${encodeURIComponent(startIso)}&endtime=${encodeURIComponent(endIso)}&format=miniseed`
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const buffer = await res.arrayBuffer()
      if (buffer.byteLength > 0) return buffer
    } catch (_) {
      continue
    }
  }

  return null
}

async function fetchWaveform() {
  if (!currentStation || !currentLiveStream || waveformFetchInFlight) return
  waveformFetchInFlight = true
  const statusEl = document.getElementById('waveform-status')

  statusEl.textContent = `Live ${currentLiveStream.cha}/${currentLiveStream.loc}...`

  try {
    const buffer = await fetchWaveformBuffer(currentStation, currentLiveStream, currentWindowSeconds)
    if (!buffer || buffer.byteLength === 0) {
      statusEl.textContent = 'No live MiniSEED data currently available.'
      return
    }

    const samples = parseMiniSEED(buffer, { maxSamples: 50000 })
    if (!samples || samples.length === 0) {
      statusEl.textContent = 'No live MiniSEED data currently available.'
      return
    }

    const chartSamples = downsample(samples, MAX_WAVEFORM_POINTS)
    renderWaveform(chartSamples, currentLiveStream.cha, currentWindowSeconds)
    playSound('waveform')
    statusEl.textContent = `${currentStation.network}.${currentStation.station} ${currentLiveStream.cha}/${currentLiveStream.loc} · ${chartSamples.length} pts`
  } catch (err) {
    window.electronAPI?.reportError?.('Live waveform failed', {
      source: 'fetchWaveform',
      station: `${currentStation.network}.${currentStation.station}`,
      channel: currentLiveStream?.cha,
      loc: currentLiveStream?.loc,
      error: err?.message,
      stack: err?.stack
    })
    statusEl.textContent = 'Live waveform temporarily unavailable.'
  } finally {
    waveformFetchInFlight = false
  }
}

function downsample(samples, maxPoints) {
  if (samples.length <= maxPoints) return samples
  const step = Math.ceil(samples.length / maxPoints)
  const reduced = []
  for (let i = 0; i < samples.length; i += step) {
    reduced.push(samples[i])
  }
  return reduced
}

function renderWaveform(samples, channel, windowSeconds) {
  const canvas = document.getElementById('waveform-chart')
  const ctx = canvas.getContext('2d')

  if (waveformChart) {
    waveformChart.destroy()
    waveformChart = null
  }

  // Build time labels: evenly distribute windowSeconds across sample count
  const now = Date.now()
  const startMs = now - windowSeconds * 1000
  const labels = samples.map((_, i) => {
    const ms = startMs + (i / Math.max(samples.length - 1, 1)) * windowSeconds * 1000
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  })

  // Thin out x-axis tick labels to avoid crowding
  const maxTicks = 8
  const tickStep = Math.ceil(labels.length / maxTicks)
  const sparsedLabels = labels.map((l, i) => (i % tickStep === 0 ? l : ''))

  waveformChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sparsedLabels,
      datasets: [{
        data: samples,
        borderColor: '#58a6ff',
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        tension: 0
      }]
    },
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      },
      scales: {
        x: {
          ticks: {
            color: '#8b949e',
            font: { size: 10 },
            maxRotation: 0,
            autoSkip: false
          },
          grid: { color: '#21262d' }
        },
        y: {
          grid: { color: '#21262d' },
          ticks: { color: '#8b949e', font: { size: 10 } }
        }
      }
    }
  })
}

// ------- v2: Waveform Window Button Logic -------
function initWaveformWindowButtons() {
  document.querySelectorAll('.window-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const seconds = parseInt(btn.dataset.seconds, 10)
      if (!Number.isFinite(seconds) || seconds < 1) return

      // Update active state
      document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('active'))
      btn.classList.add('active')

      currentWindowSeconds = seconds

      // Immediately re-fetch with new window
      if (currentStation && currentLiveStream) {
        void fetchWaveform()
      }
    })
  })
}

// ------- Auto-refresh waveform every 10 s -------
function startWaveformAutoRefresh() {
  clearInterval(waveformLiveTimer)
  waveformLiveTimer = null

  if (!currentStation || !currentLiveStream) return

  waveformLiveTimer = setInterval(() => {
    void fetchWaveform()
  }, LIVE_REFRESH_MS)
}

// ------- Stats -------
function statsEl(id) {
  return document.getElementById(id)
}

function readNumericInput(id, fallback) {
  const parsed = Number.parseFloat(statsEl(id)?.value ?? '')
  return Number.isFinite(parsed) ? parsed : fallback
}

function computeAverage(values) {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function computeMedian(values) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function formatStatNumber(value, digits = 1, suffix = '') {
  return Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : '—'
}

function formatStatMinutes(value) {
  if (!Number.isFinite(value)) return '—'
  if (value >= 1440) return `${(value / 1440).toFixed(2)} d`
  if (value >= 60) return `${(value / 60).toFixed(2)} hr`
  return `${value.toFixed(1)} min`
}

function getStatsFilters() {
  const magMinDefault = getSelectedMinimumMagnitude()
  const source = statsEl('stats-source-filter')?.value || 'all'
  const magMin = readNumericInput('stats-mag-min', magMinDefault)
  const magMax = readNumericInput('stats-mag-max', 10)
  const depthMin = readNumericInput('stats-depth-min', 0)
  const depthMax = readNumericInput('stats-depth-max', 700)
  const bucketSize = readNumericInput('stats-bucket-size', 1)

  return {
    source,
    magMin: Math.min(magMin, magMax),
    magMax: Math.max(magMin, magMax),
    depthMin: Math.min(depthMin, depthMax),
    depthMax: Math.max(depthMin, depthMax),
    bucketSize: [0.5, 1, 2].includes(bucketSize) ? bucketSize : 1
  }
}

function resetStatsFilters() {
  const defaultMinMag = getSelectedMinimumMagnitude()
  if (statsEl('stats-source-filter')) statsEl('stats-source-filter').value = 'all'
  if (statsEl('stats-mag-min')) statsEl('stats-mag-min').value = String(defaultMinMag)
  if (statsEl('stats-mag-max')) statsEl('stats-mag-max').value = '10'
  if (statsEl('stats-depth-min')) statsEl('stats-depth-min').value = '0'
  if (statsEl('stats-depth-max')) statsEl('stats-depth-max').value = '700'
  if (statsEl('stats-bucket-size')) statsEl('stats-bucket-size').value = '1'
}

function updateStatsSourceFilterOptions() {
  const select = statsEl('stats-source-filter')
  if (!select) return

  const previousValue = select.value || 'all'
  const sources = [...new Set(currentEarthquakes.map(feature => feature?.properties?.sourceAgency || 'Unknown source'))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))

  select.innerHTML = ['<option value="all">All loaded sources</option>']
    .concat(sources.map(source => `<option value="${escapeHtml(source)}">${escapeHtml(source)}</option>`))
    .join('')

  select.value = sources.includes(previousValue) || previousValue === 'all' ? previousValue : 'all'
}

function buildMagnitudeBands(events, bucketSize, magMin, magMax) {
  if (!events.length) return []

  const precision = bucketSize < 1 ? 1 : 0
  const safeStart = Math.floor(magMin / bucketSize) * bucketSize
  const safeEnd = Math.max(safeStart + bucketSize, Math.ceil(magMax / bucketSize) * bucketSize)
  const bandCount = Math.max(1, Math.ceil((safeEnd - safeStart) / bucketSize))
  const bands = Array.from({ length: bandCount }, (_, index) => {
    const lower = safeStart + (index * bucketSize)
    const upper = lower + bucketSize
    return {
      lower,
      upper,
      label: `${lower.toFixed(precision)}-${upper.toFixed(precision)}`,
      count: 0,
      depthValues: [],
      magValues: [],
      gapValues: []
    }
  })

  events.forEach((event, index) => {
    const bandIndex = Math.min(bands.length - 1, Math.max(0, Math.floor((event.mag - safeStart) / bucketSize)))
    const band = bands[bandIndex]
    band.count += 1
    band.depthValues.push(event.depth)
    band.magValues.push(event.mag)
    if (Number.isFinite(event.gapMinutes)) band.gapValues.push(event.gapMinutes)
  })

  return bands.map(band => ({
    ...band,
    avgDepth: computeAverage(band.depthValues),
    avgMag: computeAverage(band.magValues),
    avgGap: computeAverage(band.gapValues)
  }))
}

function buildDepthDistribution(events, binSize = 25) {
  if (!events.length) return []
  const maxDepth = Math.max(...events.map(event => event.depth))
  const finalDepth = Math.max(binSize, Math.ceil(maxDepth / binSize) * binSize)
  const bucketCount = Math.max(1, Math.ceil(finalDepth / binSize))
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    lower: index * binSize,
    upper: (index + 1) * binSize,
    label: `${index * binSize}-${(index + 1) * binSize}`,
    count: 0
  }))

  events.forEach(event => {
    const index = Math.min(buckets.length - 1, Math.max(0, Math.floor(event.depth / binSize)))
    buckets[index].count += 1
  })

  return buckets
}

function buildHourlyCounts(events) {
  const counts = Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    count: 0
  }))

  events.forEach(event => {
    const hour = new Date(event.time).getUTCHours()
    counts[hour].count += 1
  })

  return counts
}

function buildWeekdayCounts(events) {
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const counts = weekdayNames.map(label => ({ label, count: 0 }))

  events.forEach(event => {
    const weekday = new Date(event.time).getUTCDay()
    counts[weekday].count += 1
  })

  return counts
}

function buildDailyTrend(events) {
  const counts = new Map()

  events.forEach(event => {
    const dayKey = new Date(event.time).toISOString().slice(0, 10)
    counts.set(dayKey, (counts.get(dayKey) || 0) + 1)
  })

  return [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }))
}

function buildScatterPoints(events) {
  return downsample(events, 250).map(event => ({
    x: Number(event.mag.toFixed(2)),
    y: Number(event.depth.toFixed(1))
  }))
}

function buildSourceSummary(events) {
  const summary = new Map()

  events.forEach(event => {
    const source = event.source || 'Unknown source'
    if (!summary.has(source)) {
      summary.set(source, {
        source,
        count: 0,
        mags: [],
        depths: [],
        strongestMag: null,
        latestTime: null
      })
    }

    const row = summary.get(source)
    row.count += 1
    row.mags.push(event.mag)
    row.depths.push(event.depth)
    row.strongestMag = row.strongestMag == null ? event.mag : Math.max(row.strongestMag, event.mag)
    row.latestTime = row.latestTime == null ? event.time : Math.max(row.latestTime, event.time)
  })

  return [...summary.values()]
    .map(row => ({
      ...row,
      avgMag: computeAverage(row.mags),
      avgDepth: computeAverage(row.depths)
    }))
    .sort((left, right) => right.count - left.count || right.avgMag - left.avgMag)
}

function setStatsKpi(id, value, subtext = '') {
  const valueEl = statsEl(id)
  const subEl = statsEl(`${id}-sub`)
  if (valueEl) valueEl.textContent = value
  if (subEl) subEl.textContent = subtext
}

function renderStatsChart(canvasId, config) {
  const canvas = statsEl(canvasId)
  if (!canvas) return
  const existing = Chart.getChart(canvas)
  if (existing) existing.destroy()

  const datasets = Array.isArray(config?.data?.datasets) ? config.data.datasets : []
  const hasData = datasets.some(dataset => Array.isArray(dataset.data) && dataset.data.some(value => {
    if (Number.isFinite(value)) return value > 0
    return value && Number.isFinite(value.x) && Number.isFinite(value.y)
  }))
  const chartConfig = hasData
    ? config
    : {
        type: 'bar',
        data: {
          labels: ['No data'],
          datasets: [{ data: [0], backgroundColor: 'rgba(139, 148, 158, 0.25)' }]
        },
        options: {
          animation: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { ticks: { color: '#8b949e' }, grid: { display: false } },
            y: { ticks: { display: false }, grid: { display: false }, beginAtZero: true }
          }
        }
      }

  new Chart(canvas.getContext('2d'), chartConfig)
}

function renderStatsTable(containerId, headers, rows) {
  const container = statsEl(containerId)
  if (!container) return

  if (!rows.length) {
    container.innerHTML = '<div class="stats-empty">No rows match the current filters.</div>'
    return
  }

  container.innerHTML = `
    <table class="stats-table">
      <thead>
        <tr>${headers.map(header => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `
}

function updateStatsView() {
  updateStatsSourceFilterOptions()

  const summary = statsEl('stats-summary')
  const filters = getStatsFilters()
  const baseEvents = filterEventsBySelectedRegion(currentEarthquakes)
    .map(feature => ({
      id: feature?.id || '',
      mag: Number(feature?.properties?.mag),
      depth: Number(feature?.geometry?.coordinates?.[2]),
      time: Number(feature?.properties?.time),
      place: feature?.properties?.place || 'Unknown location',
      source: feature?.properties?.sourceAgency || 'Unknown source'
    }))
    .filter(event => Number.isFinite(event.mag) && Number.isFinite(event.depth) && Number.isFinite(event.time))
    .sort((left, right) => right.time - left.time)

  const filteredEvents = baseEvents
    .filter(event => filters.source === 'all' || event.source === filters.source)
    .filter(event => event.mag >= filters.magMin && event.mag <= filters.magMax)
    .filter(event => event.depth >= filters.depthMin && event.depth <= filters.depthMax)
    .map((event, index, list) => ({
      ...event,
      gapMinutes: index < list.length - 1 ? Math.max(0, (event.time - list[index + 1].time) / 60000) : null
    }))

  const allSources = [...new Set(baseEvents.map(event => event.source))]

  if (!filteredEvents.length) {
    if (summary) {
      summary.textContent = `No loaded earthquakes match source ${filters.source === 'all' ? 'All loaded sources' : filters.source}, magnitude ${filters.magMin} to ${filters.magMax}, and depth ${filters.depthMin} to ${filters.depthMax} km.`
    }
    setStatsKpi('stats-kpi-count', '0', `${baseEvents.length} events currently loaded`)
    setStatsKpi('stats-kpi-sources', String(allSources.length), 'Sources in the loaded feed')
    setStatsKpi('stats-kpi-avg-mag', '—', 'No matching events')
    setStatsKpi('stats-kpi-median-mag', '—', 'No matching events')
    setStatsKpi('stats-kpi-avg-depth', '—', 'No matching events')
    setStatsKpi('stats-kpi-avg-gap', '—', 'No matching events')
    setStatsKpi('stats-kpi-strongest', '—', 'No matching events')
    setStatsKpi('stats-kpi-span', '—', 'No matching events')
    renderStatsChart('stats-count-chart', null)
    renderStatsChart('stats-depth-by-mag-chart', null)
    renderStatsChart('stats-gap-chart', null)
    renderStatsChart('stats-hourly-chart', null)
    renderStatsChart('stats-weekday-chart', null)
    renderStatsChart('stats-daily-trend-chart', null)
    renderStatsChart('stats-scatter-chart', null)
    renderStatsChart('stats-depth-chart', null)
    renderStatsChart('stats-source-chart', null)
    renderStatsTable('stats-band-table', ['Band', 'Count', 'Avg Mag', 'Avg Depth', 'Avg Gap'], [])
    renderStatsTable('stats-source-table', ['Source', 'Count', 'Avg Mag', 'Avg Depth', 'Strongest'], [])
    return
  }

  const magnitudeBands = buildMagnitudeBands(filteredEvents, filters.bucketSize, filters.magMin, filters.magMax)
  const hourlyCounts = buildHourlyCounts(filteredEvents)
  const weekdayCounts = buildWeekdayCounts(filteredEvents)
  const dailyTrend = buildDailyTrend(filteredEvents)
  const scatterPoints = buildScatterPoints(filteredEvents)
  const depthDistribution = buildDepthDistribution(filteredEvents)
  const sourceSummary = buildSourceSummary(filteredEvents)
  const gapValues = filteredEvents.map(event => event.gapMinutes).filter(Number.isFinite)
  const magValues = filteredEvents.map(event => event.mag)
  const depthValues = filteredEvents.map(event => event.depth)
  const newestTime = filteredEvents[0].time
  const oldestTime = filteredEvents[filteredEvents.length - 1].time
  const strongestEvent = [...filteredEvents].sort((left, right) => right.mag - left.mag || right.time - left.time)[0]
  const timeSpanHours = Math.max(0, (newestTime - oldestTime) / 3600000)

  if (summary) {
    summary.textContent = `Loaded dataset: ${baseEvents.length} events from ${allSources.length} sources | Filtered view: ${filteredEvents.length} events | Region ${getSelectedRegionLabel()} | Feed ${document.getElementById('feed-select').value} | Fetch minimum magnitude ${getSelectedMinimumMagnitude()} | Bucket size ${filters.bucketSize}`
  }

  setStatsKpi('stats-kpi-count', String(filteredEvents.length), `${baseEvents.length} total events in the loaded feed`)
  setStatsKpi('stats-kpi-sources', String(sourceSummary.length), `${allSources.length} unique sources loaded`)
  setStatsKpi('stats-kpi-avg-mag', formatStatNumber(computeAverage(magValues), 2), `Range ${formatStatNumber(Math.min(...magValues), 1)} to ${formatStatNumber(Math.max(...magValues), 1)}`)
  setStatsKpi('stats-kpi-median-mag', formatStatNumber(computeMedian(magValues), 2), 'Median strength of filtered events')
  setStatsKpi('stats-kpi-avg-depth', formatStatNumber(computeAverage(depthValues), 1, ' km'), `Deepest ${formatStatNumber(Math.max(...depthValues), 1, ' km')}`)
  setStatsKpi('stats-kpi-avg-gap', formatStatMinutes(computeAverage(gapValues)), `${gapValues.length} consecutive intervals measured`)
  setStatsKpi('stats-kpi-strongest', `M${formatStatNumber(strongestEvent.mag, 1)}`, `${strongestEvent.place} · ${timeAgo(strongestEvent.time)}`)
  setStatsKpi('stats-kpi-span', timeSpanHours >= 24 ? `${(timeSpanHours / 24).toFixed(2)} days` : `${timeSpanHours.toFixed(1)} hr`, `Newest ${timeAgo(newestTime)} · oldest ${timeAgo(oldestTime)}`)

  renderStatsChart('stats-count-chart', {
    type: 'bar',
    data: {
      labels: magnitudeBands.map(band => band.label),
      datasets: [{ data: magnitudeBands.map(band => band.count), backgroundColor: '#58a6ff' }]
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true }
      }
    }
  })

  renderStatsChart('stats-depth-by-mag-chart', {
    type: 'bar',
    data: {
      labels: magnitudeBands.map(band => band.label),
      datasets: [{ data: magnitudeBands.map(band => Number.isFinite(band.avgDepth) ? Number(band.avgDepth.toFixed(1)) : 0), backgroundColor: '#f2cc60' }]
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true }
      }
    }
  })

  renderStatsChart('stats-gap-chart', {
    type: 'bar',
    data: {
      labels: magnitudeBands.map(band => band.label),
      datasets: [{ data: magnitudeBands.map(band => Number.isFinite(band.avgGap) ? Number(band.avgGap.toFixed(1)) : 0), backgroundColor: '#3fb950' }]
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true }
      }
    }
  })

  renderStatsChart('stats-hourly-chart', {
    type: 'bar',
    data: {
      labels: hourlyCounts.map(row => row.label),
      datasets: [{ data: hourlyCounts.map(row => row.count), backgroundColor: '#7ee787' }]
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e', maxTicksLimit: 12 }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true }
      }
    }
  })

  renderStatsChart('stats-weekday-chart', {
    type: 'bar',
    data: {
      labels: weekdayCounts.map(row => row.label),
      datasets: [{ data: weekdayCounts.map(row => row.count), backgroundColor: '#8b949e' }]
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true }
      }
    }
  })

  renderStatsChart('stats-daily-trend-chart', {
    type: 'line',
    data: {
      labels: dailyTrend.map(row => row.label),
      datasets: [{
        data: dailyTrend.map(row => row.count),
        borderColor: '#58a6ff',
        backgroundColor: 'rgba(88, 166, 255, 0.18)',
        borderWidth: 2,
        pointRadius: 2,
        fill: true,
        tension: 0.2
      }]
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e', maxTicksLimit: 8 }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true }
      }
    }
  })

  renderStatsChart('stats-scatter-chart', {
    type: 'scatter',
    data: {
      datasets: [{
        data: scatterPoints,
        pointRadius: 3,
        pointHoverRadius: 4,
        backgroundColor: 'rgba(242, 204, 96, 0.6)',
        borderColor: 'rgba(242, 204, 96, 0.9)'
      }]
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: 'Magnitude', color: '#8b949e' },
          ticks: { color: '#8b949e' },
          grid: { color: '#21262d' }
        },
        y: {
          type: 'linear',
          title: { display: true, text: 'Depth (km)', color: '#8b949e' },
          ticks: { color: '#8b949e' },
          grid: { color: '#21262d' },
          beginAtZero: true
        }
      }
    }
  })

  renderStatsChart('stats-depth-chart', {
    type: 'bar',
    data: {
      labels: depthDistribution.map(row => row.label),
      datasets: [{ data: depthDistribution.map(row => row.count), backgroundColor: '#d2a8ff' }]
    },
    options: {
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e', maxTicksLimit: 10 }, grid: { color: '#21262d' } },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true }
      }
    }
  })

  renderStatsChart('stats-source-chart', {
    type: 'bar',
    data: {
      labels: sourceSummary.map(row => row.source),
      datasets: [{ data: sourceSummary.map(row => row.count), backgroundColor: '#ffb347' }]
    },
    options: {
      animation: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' }, beginAtZero: true },
        y: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } }
      }
    }
  })

  renderStatsTable(
    'stats-band-table',
    ['Band', 'Count', 'Avg Mag', 'Avg Depth', 'Avg Gap'],
    magnitudeBands.map(band => [
      band.label,
      String(band.count),
      formatStatNumber(band.avgMag, 2),
      formatStatNumber(band.avgDepth, 1, ' km'),
      formatStatMinutes(band.avgGap)
    ])
  )

  renderStatsTable(
    'stats-source-table',
    ['Source', 'Count', 'Avg Mag', 'Avg Depth', 'Strongest'],
    sourceSummary.map(row => [
      row.source,
      String(row.count),
      formatStatNumber(row.avgMag, 2),
      formatStatNumber(row.avgDepth, 1, ' km'),
      `M${formatStatNumber(row.strongestMag, 1)}`
    ])
  )
}

const predictionState = {
  readings: [],
  autoTimer: null,
  initialized: false,
  loading: false
}

function predictionEl(id) {
  return document.getElementById(id)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function predictionLevelInfo(score) {
  if (score >= 80) return { label: 'CRITICAL', bg: '#f7c1c1', fg: '#791f1f' }
  if (score >= 60) return { label: 'HIGH', bg: '#f5c4b3', fg: '#993c1d' }
  if (score >= 40) return { label: 'ELEVATED', bg: '#fac775', fg: '#633806' }
  if (score >= 20) return { label: 'MODERATE', bg: '#c0dd97', fg: '#27500a' }
  return { label: 'LOW', bg: '#9fe1cb', fg: '#085041' }
}

function predictionBarColor(score) {
  if (score >= 80) return '#e24b4a'
  if (score >= 60) return '#d85a30'
  if (score >= 40) return '#ba7517'
  if (score >= 20) return '#639922'
  return '#1d9e75'
}

function setPredictionBar(fillId, valueId, score) {
  const normalized = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0
  const fill = predictionEl(fillId)
  const label = predictionEl(valueId)
  if (fill) fill.style.width = `${normalized}%`
  if (label) label.textContent = `${normalized}%`
}

function predictionSafeFixed(value, digits = 1, fallback = '-') {
  return Number.isFinite(value) ? value.toFixed(digits) : fallback
}

const NASA_NEOWS_PRIMARY_API_KEY = import.meta.env.VITE_NASA_API_KEY || 'DEMO_KEY'
const NASA_NEOWS_FALLBACK_API_KEY = 'DEMO_KEY'

function buildNeoWsFeedUrl(startDate, endDate, apiKey) {
  return `https://api.nasa.gov/neo/rest/v1/feed?start_date=${startDate}&end_date=${endDate}&api_key=${apiKey}`
}

function isNeoWsRateLimitError(error) {
  const status = Number(error?.status)
  if (status === 403 || status === 429) return true
  const message = String(error?.message || '')
  return /HTTP\s+(403|429)/.test(message)
}

async function fetchJsonWithTimeout(url, source, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) {
      const error = new Error(`${source} HTTP ${response.status}`)
      error.status = response.status
      throw error
    }
    return await response.json()
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${source} timeout`)
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

async function fetchNeoWsFeedWithFallback(startDate, endDate) {
  const keys = [NASA_NEOWS_PRIMARY_API_KEY, NASA_NEOWS_FALLBACK_API_KEY].filter((key, index, all) => key && all.indexOf(key) === index)
  let lastError = null

  for (let index = 0; index < keys.length; index += 1) {
    const apiKey = keys[index]
    const sourceLabel = index === 0 ? 'NASA NeoWs' : 'NASA NeoWs fallback'

    try {
      return await fetchJsonWithTimeout(buildNeoWsFeedUrl(startDate, endDate, apiKey), sourceLabel)
    } catch (error) {
      lastError = error
      if (!isNeoWsRateLimitError(error) || index === keys.length - 1) {
        throw error
      }
    }
  }

  throw lastError || new Error('NASA NeoWs request failed')
}

const asteroidState = {
  rows: [],
  selectedId: null,
  enrichBusy: false,
  lastLoadReport: [],
  initialized: false,
  loading: false
}

function asteroidEl(id) {
  return document.getElementById(id)
}

function setAsteroidStatus(message, kind = '') {
  const node = asteroidEl('asteroid-status')
  if (!node) return
  node.textContent = message
  node.className = `asteroid-status${kind ? ` ${kind}` : ''}`
}

function renderAsteroidSourceHealth() {
  const host = asteroidEl('asteroid-source-health')
  if (!host) return
  host.innerHTML = asteroidState.lastLoadReport.map(item => `
    <div class="asteroid-source-pill ${item.ok ? 'ok' : 'error'}">
      <div class="asteroid-source-pill-name">${escapeHtml(item.name)}</div>
      <div class="asteroid-source-pill-state">${escapeHtml(item.ok ? `${item.count} loaded` : item.message)}</div>
    </div>
  `).join('')
}

const asteroidSources = createAsteroidSourceLoaders({
  fetchJsonWithTimeout,
  fetchNeoWsFeedWithFallback
})

function getFilteredAsteroids() {
  const source = asteroidEl('asteroid-source-filter')?.value || 'all'
  const query = (asteroidEl('asteroid-search')?.value || '').trim().toLowerCase()
  const sortMode = asteroidEl('asteroid-sort')?.value || 'risk'
  const hazardOnly = Boolean(asteroidEl('asteroid-hazard-only')?.checked)
  const prefixFilter = asteroidEl('asteroid-prefix-filter')?.value || 'all'
  let list = asteroidState.rows

  if (source !== 'all') {
    list = list.filter(row => Array.isArray(row.sources) ? row.sources.includes(source) : row.source === source)
  }

  if (prefixFilter === 'asteroid') {
    list = list.filter(row => !row.cometPrefix)
  } else if (prefixFilter !== 'all') {
    list = list.filter(row => row.cometPrefix === prefixFilter)
  }

  if (hazardOnly) {
    list = list.filter(row => row.isHazardous)
  }

  if (query) {
    list = list.filter(row => (row.name || '').toLowerCase().includes(query))
  }

  list = [...list]
  if (sortMode === 'name') {
    list.sort((left, right) => (left.name || '').localeCompare(right.name || ''))
  } else if (sortMode === 'distance') {
    list.sort((left, right) => {
      const leftValue = Number.isFinite(left.distanceAU) ? left.distanceAU : Number.POSITIVE_INFINITY
      const rightValue = Number.isFinite(right.distanceAU) ? right.distanceAU : Number.POSITIVE_INFINITY
      return leftValue - rightValue
    })
  } else {
    list.sort((left, right) => {
      const riskDiff = (right.riskScore || 0) - (left.riskScore || 0)
      if (Math.abs(riskDiff) > 0) return riskDiff
      const leftValue = Number.isFinite(left.distanceAU) ? left.distanceAU : Number.POSITIVE_INFINITY
      const rightValue = Number.isFinite(right.distanceAU) ? right.distanceAU : Number.POSITIVE_INFINITY
      return leftValue - rightValue
    })
  }

  return list
}

function ensureSelectedAsteroid(list) {
  if (!list.length) {
    asteroidState.selectedId = null
    return
  }
  if (!asteroidState.selectedId || !list.some(row => row.id === asteroidState.selectedId)) {
    asteroidState.selectedId = list[0].id
  }
}

function renderAsteroidDetail() {
  const row = asteroidState.rows.find(item => item.id === asteroidState.selectedId)
  if (!row) return

  asteroidEl('asteroid-title').textContent = row.name
  asteroidEl('asteroid-source').textContent = row.source
  const summaryBits = []
  if (row.isHazardous) summaryBits.push('Hazard flagged')
  if (Number.isFinite(row.distanceAU)) summaryBits.push(`Closest pass ${row.distanceAU.toFixed(6)} AU`)
  if (Number.isFinite(row.averageSizeMeters)) summaryBits.push(`Avg size ${asteroidAverageSizeText(row.averageSizeMeters)}`)
  asteroidEl('asteroid-extra').textContent = summaryBits.join(' | ') || 'Distance: Unknown'

  // Reset PS1 panel while waiting for SBDB → PS1 enrichment
  const ps1Wrap = document.getElementById('asteroid-ps1')
  if (ps1Wrap) ps1Wrap.classList.add('hidden')

  asteroidEl('asteroid-grid').innerHTML = Object.entries(row.details).map(([key, value]) => `
    <div class="asteroid-grid-key">${escapeHtml(key)}</div>
    <div class="asteroid-grid-value">${escapeHtml(value)}</div>
  `).join('')

  // Send to Notes button
  let sendBtn = document.getElementById('asteroid-send-notes')
  if (!sendBtn) {
    sendBtn = document.createElement('button')
    sendBtn.id = 'asteroid-send-notes'
    sendBtn.className = 'notes-send-btn'
    sendBtn.textContent = 'Send to Notes'
    asteroidEl('asteroid-grid').parentElement.appendChild(sendBtn)
  }
  sendBtn.onclick = () => {
    const lines = [`<b>Asteroid — ${escapeHtml(row.name)}</b><br>Source: ${escapeHtml(row.source)}`]
    Object.entries(row.details).forEach(([k, v]) => lines.push(`${escapeHtml(k)}: ${escapeHtml(v)}`))
    appendToNotes(`<div style="margin:8px 0;padding:8px;border-left:3px solid #58a6ff;background:#161b22">${lines.join('<br>')}</div>`)
  }

  const view3dBtn = asteroidEl('asteroid-view3d-btn')
  if (view3dBtn) {
    view3dBtn.disabled = !row.orbitElements
    view3dBtn.onclick = row.orbitElements ? () => sendAsteroidTo3dSim(row) : null
  }

  void enrichAsteroidSbdb(row)
}

function renderAsteroidList() {
  const listEl = asteroidEl('asteroid-list')
  const list = getFilteredAsteroids()
  ensureSelectedAsteroid(list)

  if (!list.length) {
    listEl.innerHTML = '<li class="prediction-placeholder">No asteroids for current filters.</li>'
    asteroidEl('asteroid-title').textContent = 'Select an asteroid'
    asteroidEl('asteroid-source').textContent = ''
    asteroidEl('asteroid-extra').textContent = ''
    asteroidEl('asteroid-grid').innerHTML = ''
    return
  }

  listEl.innerHTML = list.map(row => `
    <li>
      <button class="asteroid-item-btn ${row.id === asteroidState.selectedId ? 'active' : ''} ${row.isHazardous ? 'hazard' : ''}" data-id="${escapeHtml(row.id)}" type="button">
        <div class="asteroid-item-topline">
          <div class="asteroid-item-name">${escapeHtml(row.name)}</div>
          ${row.cometPrefix ? `<span class="asteroid-comet-pill">${escapeHtml(row.cometPrefix + '/')}</span>` : ''}
          ${row.isHazardous ? '<span class="asteroid-hazard-pill">Hazard</span>' : ''}
        </div>
        <div class="asteroid-item-meta">${escapeHtml(`${row.source} · ${row.meta}`)}</div>
        <div class="asteroid-item-facts">${asteroidListFacts(row).map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
        <div class="asteroid-item-approaches">${escapeHtml(`Approaches: ${asteroidFormatApproachDates(row.approachDates)}`)}</div>
      </button>
    </li>
  `).join('')

  listEl.querySelectorAll('.asteroid-item-btn').forEach(button => {
    button.addEventListener('click', () => {
      asteroidState.selectedId = button.dataset.id
      renderAsteroidList()
      renderAsteroidDetail()
    })
  })

  renderAsteroidDetail()
}

async function enrichAsteroidSbdb(row) {
  if (!row || !row.sbdbLookup || row.sbdbLoaded || asteroidState.enrichBusy) return

  asteroidState.enrichBusy = true
  try {
    const data = await fetchJsonWithTimeout(`https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${encodeURIComponent(row.sbdbLookup)}`, 'JPL SBDB')
    const objectInfo = data?.object || {}
    const physical = data?.phys_par || {}
    if (objectInfo.fullname) row.details['SBDB full name'] = objectInfo.fullname
    if (objectInfo.des) row.details['SBDB designation'] = objectInfo.des
    if (physical.diameter) {
      row.details['SBDB diameter (km)'] = String(physical.diameter)
      if (!Number.isFinite(row.averageSizeMeters)) {
        const diameterKm = parseFloat(physical.diameter)
        if (Number.isFinite(diameterKm)) {
          row.averageSizeMeters = diameterKm * 1000
          row.details['Average diameter'] = asteroidAverageSizeText(row.averageSizeMeters)
        }
      }
    }
    if (physical.albedo) row.details['SBDB albedo'] = String(physical.albedo)

    // Extract orbital elements for 3D simulation
    const orbitElements = data?.orbit?.elements
    if (Array.isArray(orbitElements)) {
      const getEl = name => {
        const el = orbitElements.find(e => e.name === name)
        return el ? parseFloat(el.value) : NaN
      }
      const a = getEl('a')
      const e = getEl('e')
      const i = getEl('i')
      const om = getEl('om')
      const w = getEl('w')
      const ma = getEl('ma')
      const per = getEl('per')
      if ([a, e, i, om, w].every(Number.isFinite)) {
        row.orbitElements = { a, e, i, om, w, ma: Number.isFinite(ma) ? ma : 0, per: Number.isFinite(per) ? per : Math.pow(a, 1.5) * 365.25 }
        row.details['Semi-major axis (AU)'] = String(a)
        row.details['Eccentricity'] = String(e)
        row.details['Inclination (°)'] = String(i)
        row.details['Ascending node (°)'] = String(om)
        row.details['Arg. perihelion (°)'] = String(w)
      }
    }

    row.sbdbLoaded = true
    renderAsteroidList()
    if (asteroidState.selectedId === row.id) renderAsteroidDetail()

    // Trigger Pan-STARRS enrichment if we have orbital elements → RA/Dec
    const orbit = data?.orbit
    if (orbit) {
      const raStr = orbit.elements?.find(e => e.name === 'ma')
      // Use the object's RA/Dec from orbit epoch or fall back to elements
      void enrichPanstarrs(row, data)
    }
  } catch {
    // Ignore SBDB enrichment failures.
  } finally {
    asteroidState.enrichBusy = false
  }
}

// ---- Pan-STARRS DR2 Enrichment ----
const ps1Cache = new Map()

function getPs1ColorUrl(ra, dec, size = 240) {
  return new Promise(async (resolve) => {
    const key = `${ra.toFixed(5)}_${dec.toFixed(5)}_${size}`
    if (ps1Cache.has(key)) { resolve(ps1Cache.get(key)); return }
    try {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), 12000)
      const resp = await fetch(
        `https://ps1images.stsci.edu/cgi-bin/ps1filenames.py?ra=${ra}&dec=${dec}&filters=gri&type=stack&sep=,`,
        { signal: controller.signal }
      )
      clearTimeout(tid)
      const text = await resp.text()
      const lines = text.trim().split('\n').slice(1) // skip header
      const files = {}
      for (const line of lines) {
        const cols = line.split(',')
        if (cols.length >= 8) files[cols[4]?.trim()] = cols[7]?.trim()
      }
      if (!files.r && !files.g && !files.i) { resolve(null); return }
      const params = [`ra=${ra}`, `dec=${dec}`, `size=${size}`, 'format=jpg']
      if (files.i) params.push(`red=${encodeURIComponent(files.i)}`)
      if (files.r) params.push(`green=${encodeURIComponent(files.r)}`)
      if (files.g) params.push(`blue=${encodeURIComponent(files.g)}`)
      const url = `https://ps1images.stsci.edu/cgi-bin/fitscut.cgi?${params.join('&')}`
      ps1Cache.set(key, url)
      resolve(url)
    } catch { resolve(null) }
  })
}

async function enrichPanstarrs(row, sbdbData) {
  const ps1Wrap = document.getElementById('asteroid-ps1')
  const ps1Img = document.getElementById('asteroid-ps1-img')
  const ps1Placeholder = document.getElementById('asteroid-ps1-img-placeholder')
  const ps1Mags = document.getElementById('asteroid-ps1-mags')
  const ps1Status = document.getElementById('asteroid-ps1-status')
  if (!ps1Wrap || !ps1Img) return

  // Try to get RA/Dec from SBDB orbit epoch position
  const orbit = sbdbData?.orbit
  const elements = orbit?.elements
  if (!Array.isArray(elements)) {
    ps1Wrap.classList.add('hidden')
    return
  }

  // Compute approximate RA/Dec from orbital elements at epoch
  // Use mean anomaly at epoch to get ecliptic position, then convert
  const getEl = name => { const el = elements.find(e => e.name === name); return el ? parseFloat(el.value) : NaN }
  const a = getEl('a'), e = getEl('e'), i = getEl('i')
  const om = getEl('om'), w = getEl('w'), ma = getEl('ma')

  if (![a, e, i, om, w, ma].every(Number.isFinite)) {
    ps1Wrap.classList.add('hidden')
    return
  }

  // Solve Kepler's equation for eccentric anomaly
  const deg2rad = d => d * Math.PI / 180
  const rad2deg = r => r * 180 / Math.PI
  const M = deg2rad(ma)
  let E = M
  for (let iter = 0; iter < 20; iter++) {
    E = M + e * Math.sin(E)
  }
  const trueAnomaly = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2))
  const r = a * (1 - e * Math.cos(E))

  // Heliocentric ecliptic coordinates
  const argLat = deg2rad(w) + trueAnomaly
  const omRad = deg2rad(om)
  const iRad = deg2rad(i)

  const xEcl = r * (Math.cos(omRad) * Math.cos(argLat) - Math.sin(omRad) * Math.sin(argLat) * Math.cos(iRad))
  const yEcl = r * (Math.sin(omRad) * Math.cos(argLat) + Math.cos(omRad) * Math.sin(argLat) * Math.cos(iRad))
  const zEcl = r * Math.sin(argLat) * Math.sin(iRad)

  // Ecliptic → Equatorial (obliquity = 23.4393°)
  const obliq = deg2rad(23.4393)
  const xEq = xEcl
  const yEq = yEcl * Math.cos(obliq) - zEcl * Math.sin(obliq)
  const zEq = yEcl * Math.sin(obliq) + zEcl * Math.cos(obliq)

  let ra = rad2deg(Math.atan2(yEq, xEq))
  if (ra < 0) ra += 360
  const dec = rad2deg(Math.asin(zEq / Math.sqrt(xEq * xEq + yEq * yEq + zEq * zEq)))

  // PS1 only covers dec > -30
  if (dec < -30) {
    ps1Wrap.classList.remove('hidden')
    ps1Img.classList.add('hidden')
    ps1Placeholder.classList.remove('hidden')
    ps1Placeholder.textContent = 'Outside Pan-STARRS footprint (dec < -30°)'
    ps1Mags.innerHTML = ''
    ps1Status.textContent = `RA ${ra.toFixed(4)}° Dec ${dec.toFixed(4)}°`
    return
  }

  ps1Wrap.classList.remove('hidden')
  ps1Status.textContent = `RA ${ra.toFixed(4)}° Dec ${dec.toFixed(4)}° — loading…`
  ps1Img.classList.add('hidden')
  ps1Placeholder.classList.remove('hidden')
  ps1Placeholder.textContent = 'Loading sky image…'
  ps1Mags.innerHTML = ''

  // Fetch color cutout and catalog data in parallel
  const [imgUrl, catalog] = await Promise.all([
    getPs1ColorUrl(ra, dec, 240),
    fetchPs1Catalog(ra, dec, 0.0028)
  ])

  // Bail if user switched asteroids while we were loading
  if (asteroidState.selectedId !== row.id) return

  // Render image
  if (imgUrl) {
    ps1Img.src = imgUrl
    ps1Img.classList.remove('hidden')
    ps1Placeholder.classList.add('hidden')
    ps1Img.onerror = () => { ps1Img.classList.add('hidden'); ps1Placeholder.classList.remove('hidden'); ps1Placeholder.textContent = 'Image unavailable' }
  } else {
    ps1Img.classList.add('hidden')
    ps1Placeholder.classList.remove('hidden')
    ps1Placeholder.textContent = 'No PS1 image at this position'
  }

  // Render magnitude badges if catalog data found
  if (catalog && catalog.data && catalog.data.length > 0) {
    const obj = catalog.data[0]
    const bands = [
      { key: 'gMeanPSFMag', label: 'g', color: '#6366f1' },
      { key: 'rMeanPSFMag', label: 'r', color: '#22c55e' },
      { key: 'iMeanPSFMag', label: 'i', color: '#eab308' },
      { key: 'zMeanPSFMag', label: 'z', color: '#f97316' },
      { key: 'yMeanPSFMag', label: 'y', color: '#ef4444' }
    ]
    const badgeHtml = bands.map(b => {
      const val = obj[b.key]
      const display = val != null && val > -99 ? parseFloat(val).toFixed(2) : '—'
      return `<span class="ps1-mag-badge" style="border-color:${b.color}40;background:${b.color}18;color:${b.color}"><span class="ps1-mag-label">${b.label}</span>${display}</span>`
    }).join('')
    const detections = obj.nDetections != null ? obj.nDetections : '?'
    ps1Mags.innerHTML = `<div class="ps1-mag-row">${badgeHtml}</div><div class="ps1-det-count">${detections} detections across bands</div>`
    ps1Status.textContent = `RA ${ra.toFixed(4)}° Dec ${dec.toFixed(4)}° · ${catalog.data.length} source${catalog.data.length !== 1 ? 's' : ''}`
  } else {
    ps1Mags.innerHTML = '<div class="ps1-det-count">No catalog sources at this position</div>'
    ps1Status.textContent = `RA ${ra.toFixed(4)}° Dec ${dec.toFixed(4)}°`
  }
}

async function fetchPs1Catalog(ra, dec, radiusDeg) {
  try {
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 12000)
    const url = `https://catalogs.mast.stsci.edu/api/v0.1/panstarrs/dr2/mean.json?ra=${ra}&dec=${dec}&radius=${radiusDeg}&nDetections.gte=2&pagesize=20&columns=[objName,raMean,decMean,nDetections,gMeanPSFMag,rMeanPSFMag,iMeanPSFMag,zMeanPSFMag,yMeanPSFMag]`
    const resp = await fetch(url, { signal: controller.signal })
    clearTimeout(tid)
    if (!resp.ok) return null
    const d = await resp.json()
    if (!d?.info || !d?.data) return null
    const cols = d.info.map(c => c.column_name)
    d.data = d.data.map(row => {
      const obj = {}
      cols.forEach((k, i) => { obj[k] = row[i] === -999 || row[i] === -999.0 ? null : row[i] })
      return obj
    })
    return d
  } catch { return null }
}

function sendAsteroidTo3dSim(row) {
  if (!row.orbitElements) return
  activateTab('3dsim')
  const iframe = document.getElementById('sim3d-iframe')
  if (!iframe?.contentWindow) return
  const payload = {
    type: 'showAsteroid',
    asteroid: {
      id: row.id,
      name: row.name,
      a: row.orbitElements.a,
      e: row.orbitElements.e,
      i: row.orbitElements.i,
      om: row.orbitElements.om,
      w: row.orbitElements.w,
      ma: row.orbitElements.ma,
      per: row.orbitElements.per,
      diameterKm: Number.isFinite(row.averageSizeMeters) ? row.averageSizeMeters / 1000 : 0.5,
      hazardous: row.isHazardous,
      orbitClass: row.source
    }
  }
  iframe.contentWindow.postMessage(payload, window.location.origin)
}

function initAsteroidCenter() {
  if (asteroidState.initialized) return

  const rerender = () => {
    renderAsteroidList()
    const visible = getFilteredAsteroids().length
    if (asteroidState.rows.length) {
      setAsteroidStatus(`Loaded ${asteroidState.rows.length} unique objects (${visible} visible).`, 'ok')
    }
  }

  asteroidEl('asteroid-search')?.addEventListener('input', rerender)
  asteroidEl('asteroid-hazard-only')?.addEventListener('change', rerender)
  asteroidEl('asteroid-source-filter')?.addEventListener('change', rerender)
  asteroidEl('asteroid-prefix-filter')?.addEventListener('change', rerender)
  asteroidEl('asteroid-sort')?.addEventListener('change', rerender)
  asteroidEl('asteroid-load-btn')?.addEventListener('click', () => { void loadAsteroids(true) })
  asteroidEl('asteroid-reload-btn')?.addEventListener('click', () => { void loadAsteroids(true) })
  asteroidState.initialized = true
}

async function loadAsteroids(force = false) {
  initAsteroidCenter()
  if (asteroidState.loading) return
  if (asteroidState.rows.length && !force) {
    const visible = getFilteredAsteroids().length
    setAsteroidStatus(`Loaded ${asteroidState.rows.length} unique objects (${visible} visible).`, 'ok')
    return
  }

  asteroidState.loading = true
  asteroidEl('asteroid-load-btn').disabled = true
  asteroidEl('asteroid-reload-btn').disabled = true
  setAsteroidStatus('Loading asteroid feeds...')

  const sources = [
    ['NASA CAD', asteroidSources.fetchAsteroidCad],
    ['NASA Sentry', asteroidSources.fetchAsteroidSentry],
    ['NASA NeoWs', asteroidSources.fetchAsteroidNeoWs],
    ['MPC NEOCP', asteroidSources.fetchAsteroidMpc],
    ['JPL Comets', asteroidSources.fetchCometSbdb],
    ['JPL CAD Comets', asteroidSources.fetchCometCad]
  ]

  const results = await Promise.allSettled(sources.map(([, loader]) => loader()))
  const merged = []
  const failures = []
  asteroidState.lastLoadReport = results.map((result, index) => {
    const name = sources[index][0]
    if (result.status === 'fulfilled') {
      merged.push(...result.value)
      return { name, ok: true, count: result.value.length, message: 'ok' }
    }
    const message = result.reason?.message || 'failed'
    failures.push(name)
    return { name, ok: false, count: 0, message }
  })

  asteroidState.rows = mergeAsteroidRows(merged)
  asteroidState.selectedId = null
  renderAsteroidSourceHealth()
  renderAsteroidList()

  const visible = getFilteredAsteroids().length
  if (asteroidState.rows.length) {
    setAsteroidStatus(
      failures.length
        ? `Loaded ${asteroidState.rows.length} unique objects (${visible} visible). Failed: ${failures.join(', ')}`
        : `Loaded ${asteroidState.rows.length} unique objects (${visible} visible) from ${sources.length} feeds.`,
      failures.length ? '' : 'ok'
    )
  } else {
    setAsteroidStatus(`No asteroid data loaded.${failures.length ? ` Sources failed: ${failures.join(', ')}` : ''}`, 'error')
  }

  asteroidEl('asteroid-load-btn').disabled = false
  asteroidEl('asteroid-reload-btn').disabled = false
  asteroidState.loading = false
}

async function getPredictionData() {
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

  async function fetchKp() {
    try {
      const data = await fetchJsonWithTimeout('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', 'NOAA Kp')
      const last = data[data.length - 1]
      return { value: parseFloat(last.kp_index ?? last.Kp ?? Number.NaN), error: false }
    } catch {
      return { value: null, error: true }
    }
  }

  async function fetchXray() {
    try {
      const data = await fetchJsonWithTimeout('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json', 'NOAA X-ray')
      for (let index = data.length - 1; index >= 0; index -= 1) {
        const flux = parseFloat(data[index].flux_1_0 ?? data[index].flux ?? Number.NaN)
        if (flux > 0) {
          return { value: flux, error: false }
        }
      }
      return { value: null, error: true }
    } catch {
      return { value: null, error: true }
    }
  }

  async function fetchNeo() {
    try {
      const start = new Date().toISOString().split('T')[0]
      const end = new Date(Date.now() + (30 * 86400000)).toISOString().split('T')[0]
      const data = await fetchJsonWithTimeout(`https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.5&sort=dist&limit=1&date-min=${start}&date-max=${end}`, 'NASA CAD')
      if (Array.isArray(data.data) && data.data.length > 0) {
        const closest = data.data[0]
        return { name: closest[0], distAU: parseFloat(closest[4]), error: false }
      }
      return { name: null, distAU: null, error: true }
    } catch {
      return { name: null, distAU: null, error: true }
    }
  }

  async function fetchFireballs() {
    try {
      const data = await fetchJsonWithTimeout('https://ssd-api.jpl.nasa.gov/fireball.api?sort=-date', 'NASA Fireballs')
      const cutoff = Date.now() - (30 * 86400000)
      let maxKt = null
      let count = 0

      if (Array.isArray(data.data)) {
        for (const event of data.data) {
          const timestamp = Date.parse(event[0])
          if (!Number.isFinite(timestamp) || timestamp < cutoff) continue
          const energy = parseFloat(event[2] ?? Number.NaN)
          if (!Number.isFinite(energy)) continue
          count += 1
          if (!Number.isFinite(maxKt) || energy > maxKt) {
            maxKt = energy
          }
        }
      }

      return { maxKt, count, error: false }
    } catch {
      return { maxKt: null, count: 0, error: true }
    }
  }

  async function fetchSentry() {
    try {
      const data = await fetchJsonWithTimeout('https://ssd-api.jpl.nasa.gov/sentry.api', 'NASA Sentry')
      const rows = Array.isArray(data.data) ? data.data : []
      let maxProb = null

      for (const entry of rows) {
        const probability = parseFloat(entry.ip ?? entry.prob ?? Number.NaN)
        if (!Number.isFinite(probability)) continue
        if (!Number.isFinite(maxProb) || probability > maxProb) {
          maxProb = probability
        }
      }

      return { maxProb, count: rows.length, error: false }
    } catch {
      return { maxProb: null, count: null, error: true }
    }
  }

  const scoreKp = kp => Number.isFinite(kp) ? clamp(Math.round((kp / 9) * 100), 0, 100) : 0
  const scoreXray = flux => {
    if (!Number.isFinite(flux)) return 0
    if (flux >= 1e-4) return 100
    if (flux >= 1e-5) return 75
    if (flux >= 1e-6) return 45
    if (flux >= 1e-7) return 20
    return 5
  }
  const xrayClass = flux => {
    if (!Number.isFinite(flux)) return null
    if (flux >= 1e-4) return 'X'
    if (flux >= 1e-5) return 'M'
    if (flux >= 1e-6) return 'C'
    if (flux >= 1e-7) return 'B'
    return 'A'
  }
  const scoreNeo = distanceAu => Number.isFinite(distanceAu) ? clamp(Math.round((1 - (distanceAu / 0.5)) * 100), 0, 100) : 0
  const scoreFireballs = energy => Number.isFinite(energy) && energy > 0 ? clamp(Math.round((Math.log10(energy + 1) / 2) * 100), 0, 100) : 0
  const scoreMoon = daysSinceNewMoon => {
    const cycle = ((daysSinceNewMoon % 29.53) + 29.53) % 29.53
    const angle = (cycle / 29.53) * 2 * Math.PI
    return Math.round(((1 - Math.cos(2 * angle)) / 2) * 100)
  }
  const scorePlanets = julianDays => {
    const period = 2 * Math.PI
    const earth = (period * julianDays) / 365.25
    const venus = (period * julianDays) / 224.7
    const mars = (period * julianDays) / 686.97
    const jupiter = (period * julianDays) / 4332.59
    const saturn = (period * julianDays) / 10759.22
    return Math.round(((Math.abs(Math.cos(earth - jupiter)) * 1) + (Math.abs(Math.cos(earth - saturn)) * 0.6) + (Math.abs(Math.cos(earth - venus)) * 0.5) + (Math.abs(Math.cos(earth - mars)) * 0.2)) / 2.3 * 100)
  }
  const scoreSentry = probability => Number.isFinite(probability) && probability > 0 ? clamp(Math.round(((Math.log10(probability) + 5) / 5) * 100), 0, 100) : 0

  const weights = { kp: 0.25, xray: 0.2, neo: 0.2, fireball: 0.1, moon: 0.1, planets: 0.1, sentry: 0.05 }
  const weightedScore = scores => {
    let total = 0
    let totalWeight = 0
    for (const key of Object.keys(weights)) {
      total += (scores[key] ?? 0) * weights[key]
      totalWeight += weights[key]
    }
    return Math.round(total / totalWeight)
  }

  const [kpData, xrayData, neoData, fireballData, sentryData] = await Promise.all([
    fetchKp(),
    fetchXray(),
    fetchNeo(),
    fetchFireballs(),
    fetchSentry()
  ])

  const j2000 = new Date('2000-01-01T12:00:00Z').getTime()
  const newMoon = new Date('2024-01-11T11:57:00Z').getTime()
  const now = Date.now()
  const daysSinceJ2000 = (now - j2000) / 86400000
  const daysSinceNewMoon = (now - newMoon) / 86400000
  const cycle = ((daysSinceNewMoon % 29.53) + 29.53) % 29.53
  const phases = ['New Moon', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full Moon', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent']
  const phaseName = phases[Math.floor((cycle / 29.53) * 8) % 8]

  const scores = {
    kp: scoreKp(kpData.value),
    xray: scoreXray(xrayData.value),
    neo: scoreNeo(neoData.distAU),
    fireball: scoreFireballs(fireballData.maxKt),
    moon: scoreMoon(daysSinceNewMoon),
    planets: scorePlanets(daysSinceJ2000),
    sentry: scoreSentry(sentryData.maxProb)
  }
  const dangerIndex = weightedScore(scores)

  return {
    dangerIndex,
    timestamp: new Date().toISOString(),
    components: {
      kp: { score: scores.kp, rawValue: kpData.value, error: kpData.error },
      xray: { score: scores.xray, rawValue: xrayData.value, flareClass: xrayClass(xrayData.value), error: xrayData.error },
      neo: { score: scores.neo, distAU: neoData.distAU, name: neoData.name, error: neoData.error },
      fireball: { score: scores.fireball, maxKt: fireballData.maxKt, count30d: fireballData.count, error: fireballData.error },
      moon: { score: scores.moon, phaseName, error: false },
      planets: { score: scores.planets, error: false },
      sentry: { score: scores.sentry, count: sentryData.count, error: sentryData.error }
    }
  }
}

function renderPredictionCenter(result) {
  const components = result.components
  const level = predictionLevelInfo(result.dangerIndex)
  const mainBar = predictionEl('prediction-main-bar')
  const levelPill = predictionEl('prediction-level-pill')

  predictionEl('prediction-total-score').textContent = String(result.dangerIndex)
  predictionEl('prediction-updated-time').textContent = `Updated ${new Date(result.timestamp).toLocaleTimeString()}`
  if (levelPill) {
    levelPill.textContent = level.label
    levelPill.style.background = level.bg
    levelPill.style.color = level.fg
  }
  if (mainBar) {
    mainBar.style.width = `${result.dangerIndex}%`
    mainBar.style.background = predictionBarColor(result.dangerIndex)
  }

  setPredictionBar('prediction-bar-kp', 'prediction-val-kp', components.kp.score)
  setPredictionBar('prediction-bar-xray', 'prediction-val-xray', components.xray.score)
  setPredictionBar('prediction-bar-neo', 'prediction-val-neo', components.neo.score)
  setPredictionBar('prediction-bar-fire', 'prediction-val-fire', components.fireball.score)
  setPredictionBar('prediction-bar-moon', 'prediction-val-moon', components.moon.score)
  setPredictionBar('prediction-bar-planet', 'prediction-val-planet', components.planets.score)
  setPredictionBar('prediction-bar-sentry', 'prediction-val-sentry', components.sentry.score)

  predictionEl('prediction-m-kp').textContent = predictionSafeFixed(components.kp.rawValue, 1)
  predictionEl('prediction-m-xray').textContent = components.xray.flareClass ? `${components.xray.flareClass}-class` : '-'
  predictionEl('prediction-m-neo').textContent = Number.isFinite(components.neo.distAU) ? `${components.neo.distAU.toFixed(4)} AU` : '-'
  predictionEl('prediction-m-moon').textContent = components.moon.phaseName || '-'

  const sources = [
    { dot: '#d85a30', name: 'NOAA SWPC - Kp index', value: Number.isFinite(components.kp.rawValue) ? `Kp ${components.kp.rawValue.toFixed(1)}` : 'Unavailable', error: Boolean(components.kp.error) },
    { dot: '#d85a30', name: 'NOAA SWPC - X-ray flux', value: Number.isFinite(components.xray.rawValue) ? `${components.xray.flareClass}-class (${components.xray.rawValue.toExponential(1)})` : 'Unavailable', error: Boolean(components.xray.error) },
    { dot: '#ba7517', name: 'NASA CNEOS - close approach', value: Number.isFinite(components.neo.distAU) ? `${components.neo.name || 'Unknown'} @ ${components.neo.distAU.toFixed(4)} AU` : 'Unavailable', error: Boolean(components.neo.error) },
    { dot: '#ba7517', name: 'NASA CNEOS - fireballs (30d)', value: Number.isFinite(components.fireball.maxKt) ? `${components.fireball.count30d} events, max ${components.fireball.maxKt.toFixed(1)} kt` : 'Unavailable', error: Boolean(components.fireball.error) },
    { dot: '#e24b4a', name: 'NASA Sentry - impact risk', value: Number.isFinite(components.sentry.count) ? `${components.sentry.count} objects tracked` : 'Unavailable', error: Boolean(components.sentry.error) },
    { dot: '#7f77dd', name: 'Lunar tidal (computed)', value: `Phase: ${components.moon.phaseName || '-'} score ${components.moon.score}%`, error: false },
    { dot: '#7f77dd', name: 'Planetary alignment (computed)', value: `Alignment score ${components.planets.score}%`, error: false }
  ]

  predictionEl('prediction-sources-panel').innerHTML = sources.map(source => `
    <div class="prediction-source-row">
      <div class="prediction-source-dot" style="background:${escapeHtml(source.dot)}"></div>
      <span class="prediction-source-name">${escapeHtml(source.name)}</span>
      <span class="prediction-source-val">${escapeHtml(source.value)}</span>
      <span class="prediction-source-pill ${source.error ? 'error' : 'live'}">${source.error ? 'unavailable' : 'live'}</span>
    </div>
  `).join('')

  predictionState.readings.unshift({
    time: new Date(result.timestamp).toLocaleTimeString(),
    score: result.dangerIndex,
    level
  })
  if (predictionState.readings.length > PREDICTION_HISTORY_LIMIT) {
    predictionState.readings.length = PREDICTION_HISTORY_LIMIT
  }

  predictionEl('prediction-history-panel').innerHTML = predictionState.readings.map(reading => `
    <div class="prediction-history-row">
      <span class="prediction-history-time">${escapeHtml(reading.time)}</span>
      <span class="prediction-history-score">${escapeHtml(`${reading.score} / 100`)}</span>
      <span class="prediction-history-pill" style="background:${escapeHtml(reading.level.bg)};color:${escapeHtml(reading.level.fg)}">${escapeHtml(reading.level.label)}</span>
    </div>
  `).join('')
}

async function loadPredictionCenter(force = false) {
  if (predictionState.loading) return
  if (predictionState.initialized && !force) return

  predictionState.loading = true
  predictionEl('prediction-updated-time').textContent = 'Fetching...'
  predictionEl('prediction-total-score').textContent = '-'

  try {
    const result = await getPredictionData()
    renderPredictionCenter(result)
    predictionState.initialized = true
  } catch (error) {
    predictionEl('prediction-updated-time').textContent = `Error: ${error.message}`
  } finally {
    predictionState.loading = false
  }
}

function togglePredictionAutoRefresh() {
  const button = predictionEl('prediction-auto-btn')
  if (!button) return

  if (predictionState.autoTimer) {
    window.clearInterval(predictionState.autoTimer)
    predictionState.autoTimer = null
    button.textContent = 'Auto-refresh: OFF'
    button.classList.remove('on')
    return
  }

  predictionState.autoTimer = window.setInterval(() => {
    void loadPredictionCenter(true)
  }, 60000)
  button.textContent = 'Auto-refresh: ON (1 min)'
  button.classList.add('on')
}

function hideMainOverlays() {
  closeEarthquakeDetails()
  const wp = document.getElementById('waveform-panel')
  wp.classList.add('hidden')
  clearInterval(waveformLiveTimer)
  waveformLiveTimer = null
}

function showMapSurface() {
  document.getElementById('asteroids-view').classList.add('hidden')
  document.getElementById('prediction-view').classList.add('hidden')
  document.getElementById('stats-view').classList.add('hidden')
  document.getElementById('3dsim-view').classList.add('hidden')
  document.getElementById('skyexplorer-view').classList.add('hidden')
  document.getElementById('atmosphere-view').classList.add('hidden')
  document.getElementById('notes-view').classList.add('hidden')
  document.getElementById('map').classList.remove('hidden')
  refreshMapLayersForMode()
  window.setTimeout(() => {
    map?.invalidateSize()
  }, 50)
}

function showMainView(viewName) {
  document.getElementById('map').classList.add('hidden')
  document.getElementById('asteroids-view').classList.toggle('hidden', viewName !== 'asteroids')
  document.getElementById('prediction-view').classList.toggle('hidden', viewName !== 'prediction')
  document.getElementById('stats-view').classList.toggle('hidden', viewName !== 'stats')
  document.getElementById('3dsim-view').classList.toggle('hidden', viewName !== '3dsim')
  document.getElementById('skyexplorer-view').classList.toggle('hidden', viewName !== 'skyexplorer')
  document.getElementById('atmosphere-view').classList.toggle('hidden', viewName !== 'atmosphere')
  document.getElementById('notes-view').classList.toggle('hidden', viewName !== 'notes')
}

function syncSidebarHeader(tabName) {
  const showQuakeHeader = tabName === 'earthquakes'
  document.getElementById('controls')?.classList.toggle('hidden', !showQuakeHeader)
  document.getElementById('stats')?.classList.toggle('hidden', !showQuakeHeader)
  document.getElementById('quake-mag-filter-panel')?.classList.toggle('hidden', !showQuakeHeader)
  document.getElementById('live-event-banner')?.classList.toggle('hidden', !showQuakeHeader)
}

function activateTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tabName)
  })
  syncSidebarHeader(tabName)

  const sidebarTabs = new Set(['earthquakes', 'fireballs', 'asteroids', 'prediction', 'stations', 'notes', 'stats', 'volcanoes', '3dsim', 'skyexplorer', 'atmosphere'])
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', sidebarTabs.has(tabName) && panel.id === `tab-${tabName}`)
  })

  if (tabName === 'asteroids') {
    hideMainOverlays()
    showMainView('asteroids')
    void loadAsteroids()
    return
  }

  if (tabName === 'prediction') {
    hideMainOverlays()
    showMainView('prediction')
    void loadPredictionCenter()
    return
  }

  if (tabName === 'stats') {
    hideMainOverlays()
    showMainView('stats')
    updateStatsView()
    return
  }

  if (tabName === '3dsim') {
    hideMainOverlays()
    showMainView('3dsim')
    return
  }

  if (tabName === 'skyexplorer') {
    hideMainOverlays()
    showMainView('skyexplorer')
    return
  }

  if (tabName === 'atmosphere') {
    hideMainOverlays()
    showMainView('atmosphere')
    void initAtmosphereTab()
    return
  }

  if (tabName === 'notes') {
    hideMainOverlays()
    showMainView('notes')
    return
  }

  if (tabName === 'fireballs') {
    activeMapMode = 'fireballs'
    hideMainOverlays()
    showMapSurface()
    map?.setView([20, 0], 2, { animate: false })
    void loadFireballOverlay(true)
    return
  }

  if (tabName === 'volcanoes') {
    activeMapMode = 'volcanoes'
    hideMainOverlays()
    showMapSurface()
    map?.setView([20, 0], 2, { animate: false })
    void loadVolcanoes()
    return
  }

  activeMapMode = tabName
  showMapSurface()
  if (tabName === 'earthquakes') {
    document.getElementById('waveform-panel').classList.add('hidden')
    clearInterval(waveformLiveTimer)
    waveformLiveTimer = null
    if (!fireballOverlayLoaded) void loadFireballOverlay()
  }
  if (tabName === 'stations') {
    const wp = document.getElementById('waveform-panel')
    if (currentStation) {
      wp.classList.remove('hidden', 'collapsed')
      document.getElementById('waveform-close').textContent = '✕'
      if (currentLiveStream) startWaveformAutoRefresh()
    }
  }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activateTab(btn.dataset.tab)
  })
})

predictionEl('prediction-refresh-btn')?.addEventListener('click', () => {
  void loadPredictionCenter(true)
})
predictionEl('prediction-auto-btn')?.addEventListener('click', togglePredictionAutoRefresh)
document.getElementById('fireball-refresh-btn')?.addEventListener('click', () => {
  void loadFireballOverlay(true)
})
for (const id of ['fireball-filter-range', 'fireball-filter-year', 'fireball-filter-month', 'fireball-filter-energy']) {
  document.getElementById(id)?.addEventListener('change', applyFireballFilters)
}
document.getElementById('volcano-refresh-btn')?.addEventListener('click', () => {
  void loadVolcanoes(true)
})
document.getElementById('volcano-filter')?.addEventListener('change', () => {
  renderVolcanoList(currentVolcanoes)
  renderVolcanoMarkers(currentVolcanoes)
})
initAsteroidCenter()

// ------- Event Listeners -------
document.getElementById('refresh-btn').addEventListener('click', loadEarthquakes)
document.getElementById('feed-select').addEventListener('change', loadEarthquakes)
document.getElementById('quake-mag-filter').addEventListener('change', () => {
  void loadEarthquakes()
})
document.getElementById('region-select').addEventListener('change', () => {
  updateGlobalSourceVisibility()
  void loadEarthquakes()
})
document.getElementById('global-source-select').addEventListener('change', () => {
  if (getSelectedRegionKey() === 'global') {
    void loadEarthquakes()
  }
})
document.getElementById('load-stations-btn').addEventListener('click', loadStations)
document.getElementById('data-center').addEventListener('change', () => {
  void populateStationNetworks()
})
document.getElementById('waveform-close').addEventListener('click', (e) => {
  e.stopPropagation()
  const panel = document.getElementById('waveform-panel')
  const btn = document.getElementById('waveform-close')
  if (panel.classList.contains('collapsed')) {
    panel.classList.remove('collapsed')
    btn.textContent = '✕'
    if (currentStation && currentLiveStream) startWaveformAutoRefresh()
  } else {
    panel.classList.add('collapsed')
    btn.textContent = '▲'
    clearInterval(waveformLiveTimer)
    waveformLiveTimer = null
  }
})
document.getElementById('reopen-waveform-btn').addEventListener('click', reopenWaveformPanel)
document.getElementById('waveform-header').addEventListener('click', () => {
  const panel = document.getElementById('waveform-panel')
  if (panel.classList.contains('collapsed')) {
    panel.classList.remove('collapsed')
    document.getElementById('waveform-close').textContent = '✕'
    if (currentStation && currentLiveStream) startWaveformAutoRefresh()
  }
})
document.getElementById('quake-detail-close').addEventListener('click', closeEarthquakeDetails)
document.getElementById('stats-apply-btn').addEventListener('click', () => {
  updateStatsView()
})
document.getElementById('stats-reset-btn').addEventListener('click', () => {
  resetStatsFilters()
  updateStatsView()
})

// ------- Auto-refresh earthquakes every 60 seconds -------
function startAutoRefresh() {
  clearInterval(autoRefreshTimer)
  autoRefreshTimer = setInterval(loadEarthquakes, 60000)
}

// ------- Station Network Helpers -------
function getSelectedCenter() {
  const selected = document.getElementById('data-center').value
  return DATA_CENTERS[selected] || DATA_CENTERS.earthscope
}

function getSelectedCenterKey() {
  const selected = document.getElementById('data-center').value
  return DATA_CENTERS[selected] ? selected : 'earthscope'
}

async function populateStationNetworks(isStartup = false) {
  const centerKey = getSelectedCenterKey()
  const center = DATA_CENTERS[centerKey]
  const select = document.getElementById('station-network')
  const loadBtn = document.getElementById('load-stations-btn')
  const previous = select.value
  const token = ++networkPopulateToken

  if (isStartup) {
    reportStartup(`Loading station networks for ${center.label}...`, STARTUP_PROGRESS.networksStart)
  }

  select.disabled = true
  loadBtn.disabled = true
  select.innerHTML = ''
  const loadingOption = document.createElement('option')
  loadingOption.value = ''
  loadingOption.textContent = 'Loading networks...'
  select.appendChild(loadingOption)

  try {
    const networks = await discoverNetworksForCenter(centerKey, center)
    if (token !== networkPopulateToken) return false

    select.innerHTML = ''
    for (const net of networks) {
      const option = document.createElement('option')
      option.value = net
      option.textContent = net
      select.appendChild(option)
    }

    if (networks.includes(previous)) {
      select.value = previous
    } else if (center.defaultNetwork && networks.includes(center.defaultNetwork)) {
      select.value = center.defaultNetwork
    } else {
      select.value = networks[0]
    }

    select.disabled = false
    loadBtn.disabled = false
    if (isStartup) {
      reportStartup(`Station networks ready for ${center.label}.`, STARTUP_PROGRESS.networksDone)
    }
    return true
  } catch (err) {
    select.innerHTML = ''
    const fallbackNetworks = Array.isArray(center.networks) && center.networks.length ? center.networks : ['IU']
    for (const net of fallbackNetworks) {
      const option = document.createElement('option')
      option.value = net
      option.textContent = net
      select.appendChild(option)
    }
    select.value = center.defaultNetwork && fallbackNetworks.includes(center.defaultNetwork)
      ? center.defaultNetwork
      : fallbackNetworks[0]
    select.disabled = false
    loadBtn.disabled = false
    window.electronAPI?.reportError?.('Station network discovery failed', {
      source: 'populateStationNetworks',
      center: center.label,
      error: err?.message,
      stack: err?.stack
    })
    if (isStartup) {
      reportStartup(`Station network discovery failed for ${center.label}. Using fallback list.`, STARTUP_PROGRESS.networksDone)
    }
    return false
  }
}

async function discoverNetworksForCenter(centerKey, center) {
  if (networkCatalogCache.has(centerKey)) {
    return networkCatalogCache.get(centerKey)
  }

  const configured = Array.isArray(center.networks)
    ? center.networks.filter(code => /^[A-Za-z0-9]{1,8}$/.test(code)).map(code => code.toUpperCase())
    : []
  if (configured.length) {
    const uniqueConfigured = [...new Set(configured)].sort((a, b) => a.localeCompare(b))
    networkCatalogCache.set(centerKey, uniqueConfigured)
    return uniqueConfigured
  }

  const discovered = new Set()
  const urls = [
    `${center.stationUrl}?level=network&format=text`,
    `${center.stationUrl}?level=station&format=text&limit=200`
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) continue
      const text = await res.text()
      const lines = text.split('\n').filter(l => l && !l.startsWith('#'))
      for (const line of lines) {
        const parts = line.split('|')
        const code = parts[0] ? parts[0].trim() : ''
        if (/^[A-Za-z0-9]{1,8}$/.test(code)) {
          discovered.add(code.toUpperCase())
        }
      }
      if (discovered.size > 0) break
    } catch (_) {
      continue
    }
  }

  const fallback = Array.isArray(center.networks) ? center.networks : []
  for (const code of fallback) discovered.add(code)

  const finalNetworks = [...discovered]
  if (!finalNetworks.length) finalNetworks.push('IU')
  finalNetworks.sort((a, b) => a.localeCompare(b))
  networkCatalogCache.set(centerKey, finalNetworks)
  return finalNetworks
}

function getDataselectCandidates() {
  const selectedValue = document.getElementById('data-center').value
  const selected = DATA_CENTERS[selectedValue] || DATA_CENTERS.earthscope
  const rest = Object.values(DATA_CENTERS).filter(center => center.dataselectUrl !== selected.dataselectUrl)
  return [{ label: selected.label, url: selected.dataselectUrl }, ...rest.map(center => ({ label: center.label, url: center.dataselectUrl }))]
}

// ------- Init -------
async function bootstrapApp() {
  let bootFailed = false

  try {
    initMap()
    reportStartup('Map engine initialized.', STARTUP_PROGRESS.map)

    initWaveformWindowButtons()
    updateGlobalSourceVisibility()

    reportStartup('Loading startup datasets...', STARTUP_PROGRESS.earthquakesStart)
    // Probe Russian seismic network availability (non-blocking, fire and forget)
    void checkSourceAvailability()
    const [quakeResult, networkResult] = await Promise.allSettled([
      loadEarthquakes(true),
      populateStationNetworks(true)
    ])

    const quakeOk = quakeResult.status === 'fulfilled' ? quakeResult.value !== false : false
    const networksOk = networkResult.status === 'fulfilled' ? networkResult.value !== false : false
    bootFailed = !quakeOk || !networksOk

    reportStartup(
      bootFailed ? 'Finalizing interface with warnings...' : 'Finalizing interface...',
      STARTUP_PROGRESS.finalize
    )
    await loadFireballOverlay()
    startAutoRefresh()

    if (bootFailed) {
      notifyStartupFailed('Startup completed with warnings.')
    } else {
      notifyStartupReady('Startup complete.')
    }

    // Restore last station from previous session
    try {
      const saved = await window.electronAPI?.loadState('lastStation')
      if (saved && saved.network && saved.station) {
        lastStation = saved
      }
    } catch { /* ignore */ }
  } catch (err) {
    window.electronAPI?.reportError?.('Application bootstrap failed', {
      source: 'bootstrapApp',
      error: err?.message,
      stack: err?.stack
    })
    notifyStartupFailed(`Startup failed: ${err.message}`)
  }
}

// =============================================
// PHASE 4 — VOLCANOES
// =============================================
let currentVolcanoes = []
let volcanoesLoaded = false

function volcanoAlertOrder(alert) {
  const map = { WARNING: 0, WATCH: 1, ADVISORY: 2, NORMAL: 3, UNASSIGNED: 4, '': 5 }
  return map[String(alert).toUpperCase()] ?? 5
}

async function loadVolcanoes(force = false) {
  if (volcanoesLoaded && !force) return
  const statusEl = document.getElementById('volcano-status')
  if (statusEl) statusEl.textContent = 'Loading volcano data…'

  // Minimal CSV parser — handles quoted fields that contain commas
  function parseCsvLine(line) {
    const out = []; let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { out.push(cur.trim()); cur = '' }
      else { cur += ch }
    }
    out.push(cur.trim())
    return out
  }

  try {
    // Smithsonian GVP dataset (~958 Holocene volcanoes) mirrored on GitHub — no CORS block
    const csvText = await fetchParsedWithRetry({
      url: 'https://raw.githubusercontent.com/rfordatascience/tidytuesday/master/data/2020/2020-05-12/volcano.csv',
      parse: 'text', sourceLabel: 'GVP', timeoutMs: 15000
    })

    const lines = csvText.replace(/\r/g, '').split('\n').filter(Boolean)
    const hdr = parseCsvLine(lines[0])
    const ci = f => hdr.indexOf(f)
    const iNum = ci('volcano_number'), iName = ci('volcano_name'), iType = ci('primary_volcano_type')
    const iYear = ci('last_eruption_year'), iCountry = ci('country')
    const iLat = ci('latitude'), iLon = ci('longitude'), iElev = ci('elevation')

    const volcanoes = []
    for (let i = 1; i < lines.length; i++) {
      const row = parseCsvLine(lines[i])
      const lat = Number(row[iLat])
      const lon = Number(row[iLon])
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
      const lastYear = Number(row[iYear])
      let alertLevel = 'UNASSIGNED'
      if (Number.isFinite(lastYear) && lastYear > 0) {
        if (lastYear >= 2010) alertLevel = 'WATCH'
        else if (lastYear >= 1970) alertLevel = 'ADVISORY'
        else alertLevel = 'NORMAL'
      }
      volcanoes.push({
        id: `gvp-${row[iNum]}`,
        name: row[iName],
        country: row[iCountry],
        alertLevel,
        type: row[iType],
        lat, lon,
        elev: Number(row[iElev]) || 0,
        lastEruption: (Number.isFinite(lastYear) && lastYear > 0) ? lastYear : null,
        source: 'GVP'
      })
    }

    currentVolcanoes = volcanoes.sort((a, b) => volcanoAlertOrder(a.alertLevel) - volcanoAlertOrder(b.alertLevel))
    volcanoesLoaded = true
    renderVolcanoMarkers(currentVolcanoes)
    renderVolcanoList(currentVolcanoes)
    updateVolcanoCounts(currentVolcanoes)
    if (statusEl) statusEl.textContent = `${currentVolcanoes.length} volcanoes loaded.`
  } catch (err) {
    if (statusEl) statusEl.textContent = `Could not load volcano data: ${err.message}`
  }
}

function volcanoFilteredList(volcanoes) {
  const filter = document.getElementById('volcano-filter')?.value || 'all'
  if (filter === 'active') return volcanoes.filter(v => ['WARNING', 'WATCH', 'ADVISORY'].includes(v.alertLevel))
  return volcanoes
}

function alertColor(level) {
  if (level === 'WARNING') return '#f85149'
  if (level === 'WATCH') return '#f0883e'
  if (level === 'ADVISORY') return '#d29922'
  if (level === 'NORMAL') return '#8b949e'
  return '#3fb950'
}

function renderVolcanoMarkers(volcanoes) {
  volcanoMarkers.clearLayers()
  const list = volcanoFilteredList(volcanoes)
  for (const v of list) {
    const color = alertColor(v.alertLevel)
    // Triangle SVG icon
    const svg = `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg"><polygon points="11,2 21,20 1,20" fill="${color}" stroke="#fff" stroke-width="1.5" opacity="0.9"/></svg>`
    const icon = L.divIcon({ html: svg, className: '', iconSize: [22, 22], iconAnchor: [11, 20] })
    const marker = L.marker([v.lat, v.lon], { icon })
    marker.bindPopup(`
      <div style="min-width:200px;color:#111;line-height:1.5">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#7a3800;font-weight:700">${v.source} Volcano</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${v.name}</div>
        <div style="margin-top:6px"><strong>Country:</strong> ${v.country || 'N/A'}</div>
        <div><strong>Type:</strong> ${v.type || 'N/A'}</div>
        <div><strong>Alert:</strong> <span style="color:${color};font-weight:600">${v.alertLevel || 'N/A'}</span></div>
        ${v.lastEruption ? `<div><strong>Last eruption:</strong> ${v.lastEruption}</div>` : ''}
        ${v.url ? `<div style="margin-top:6px"><a href="${v.url}" style="color:#58a6ff" target="_blank">More info ↗</a></div>` : ''}
      </div>
    `)
    volcanoMarkers.addLayer(marker)
  }
  if (activeMapMode === 'volcanoes') {
    if (!map.hasLayer(volcanoMarkers)) volcanoMarkers.addTo(map)
  }
}

function renderVolcanoList(volcanoes) {
  const listEl = document.getElementById('volcano-list')
  if (!listEl) return
  const list = volcanoFilteredList(volcanoes)
  if (!list.length) {
    listEl.innerHTML = '<div style="padding:12px;color:var(--text-muted)">No volcanoes match the current filter.</div>'
    return
  }
  listEl.innerHTML = list.map(v => {
    const color = alertColor(v.alertLevel)
    return `<div class="volcano-item" data-lat="${v.lat}" data-lon="${v.lon}" style="cursor:pointer;padding:9px 14px;border-bottom:1px solid var(--border);display:flex;gap:10px;align-items:start">
      <div style="width:10px;height:10px;border-radius:50%;background:${color};margin-top:4px;flex-shrink:0"></div>
      <div>
        <div style="font-weight:600;font-size:13px">${escapeHtml(v.name)}</div>
        <div style="font-size:11px;color:var(--text-muted)">${escapeHtml(v.country)}${v.type ? ' · ' + escapeHtml(v.type) : ''}</div>
        <div style="font-size:11px;color:${color};font-weight:600">${escapeHtml(v.alertLevel || 'UNASSIGNED')}</div>
      </div>
    </div>`
  }).join('')

  listEl.querySelectorAll('.volcano-item').forEach(el => {
    el.addEventListener('click', () => {
      const lat = Number(el.dataset.lat)
      const lon = Number(el.dataset.lon)
      if (Number.isFinite(lat) && Number.isFinite(lon) && map) {
        map.setView([lat, lon], 8, { animate: true })
      }
    })
  })
}

function updateVolcanoCounts(volcanoes) {
  const active = volcanoes.filter(v => ['WARNING', 'WATCH', 'ADVISORY'].includes(v.alertLevel)).length
  const el = document.getElementById('volcano-counts')
  if (!el) return
  el.innerHTML = `<span style="color:#f85149;font-weight:600">${active} active alert</span> &nbsp;|&nbsp; <span style="color:var(--text-muted)">${volcanoes.length} total</span>`
}

// =============================================
// PHASE 6 — ATMOSPHERE TAB
// =============================================
let atmoWeatherMap = null
let atmoSpaceMap = null
let atmoLayersActive = {}
let atmoOwmLayers = {}
let atmoGibsLayers = {}
let atmoAuroraLayer = null
let atmoAbsorptionLayer = null
let atmoPlayTimer = null
let atmoCurrentDayOffset = 0  // 0 = today, 6 = 6 days ago
let atmoInitialized = false

const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'
const GIBS_LAYERS = {
  so2:     'OMPS_SO2_Planetary_Boundary_Layer',
  aerosol: 'OMPS_Aerosol_Index',
  fires:   'VIIRS_SNPP_Thermal_Anomalies_375m_All'
}
const OWM_LAYERS = {
  precip: 'precipitation_new',
  clouds: 'clouds_new',
  wind:   'wind_new',
  temp:   'temp_new'
}

function gibsDateString(dayOffset) {
  const d = new Date()
  d.setDate(d.getDate() - dayOffset)
  return d.toISOString().slice(0, 10)
}

function initAtmosphereMaps() {
  if (atmoWeatherMap) return  // already initialized

  atmoWeatherMap = L.map('atmo-weather-map', {
    center: [20, 0], zoom: 2,
    zoomControl: true
  })
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd', maxZoom: 19
  }).addTo(atmoWeatherMap)

  atmoSpaceMap = L.map('atmo-space-map', {
    center: [60, 0], zoom: 2,
    zoomControl: true
  })
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd', maxZoom: 10
  }).addTo(atmoSpaceMap)

  // D-Region absorption image overlay (full globe)
  const absorptionImgUrl = 'https://services.swpc.noaa.gov/images/animations/d-region-absorption/latest.png'
  atmoAbsorptionLayer = L.imageOverlay(absorptionImgUrl, [[-90, -180], [90, 180]], { opacity: 0.7, interactive: false })

  // Load space weather once
  void loadSpaceWeather()
  void loadAuroraOverlay()
}

function buildGibsLayer(layerName, dayOffset) {
  const date = gibsDateString(dayOffset)
  return L.tileLayer.wms(GIBS_WMS, {
    layers: layerName,
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    TIME: date,
    attribution: 'NASA GIBS',
    opacity: 0.75,
    crs: L.CRS.EPSG4326
  })
}

function buildOwmLayer(layerName) {
  return L.tileLayer(`https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, {
    attribution: '© OpenWeatherMap',
    opacity: 0.65,
    maxZoom: 18
  })
}

function setAtmoLayer(layerKey, enabled) {
  atmoLayersActive[layerKey] = enabled

  // Remove existing layer if present
  if (atmoOwmLayers[layerKey]) { atmoWeatherMap?.removeLayer(atmoOwmLayers[layerKey]); delete atmoOwmLayers[layerKey] }
  if (atmoGibsLayers[layerKey]) { atmoWeatherMap?.removeLayer(atmoGibsLayers[layerKey]); delete atmoGibsLayers[layerKey] }

  if (!enabled) return

  if (OWM_LAYERS[layerKey]) {
    const l = buildOwmLayer(OWM_LAYERS[layerKey])
    atmoOwmLayers[layerKey] = l
    atmoWeatherMap?.addLayer(l)
  } else if (GIBS_LAYERS[layerKey]) {
    const l = buildGibsLayer(GIBS_LAYERS[layerKey], atmoCurrentDayOffset)
    atmoGibsLayers[layerKey] = l
    atmoWeatherMap?.addLayer(l)
  }
}

function updateGibsTime(dayOffset) {
  atmoCurrentDayOffset = dayOffset
  for (const [key, l] of Object.entries(atmoGibsLayers)) {
    atmoWeatherMap?.removeLayer(l)
    const newLayer = buildGibsLayer(GIBS_LAYERS[key], dayOffset)
    atmoGibsLayers[key] = newLayer
    atmoWeatherMap?.addLayer(newLayer)
  }
  const label = dayOffset === 0 ? 'Today' : `${dayOffset}d ago`
  const el = document.getElementById('atmo-time-label')
  if (el) el.textContent = `— ${label}`
}

// AirNow removed — see setAtmoLayer
async function _unused_loadAirQualityMarkers() {
  if (!atmoWeatherMap) return
  try {
    // Use the AirNow /aq/data/ bbox endpoint — covers all continental US stations (~2000+ readings)
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const dateHour = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}`
    const url = `https://www.airnowapi.org/aq/data/?startDate=${dateHour}&endDate=${dateHour}&parameters=PM25,OZONE&BBOX=-130,24,-65,50&dataType=A&format=application/json&verbose=0&API_KEY=${AIRNOW_API_KEY}`
    const data = await fetchParsedWithRetry({ url, parse: 'json', sourceLabel: 'AirNow', timeoutMs: 12000 })
    atmoAirQualityMarkers?.clearLayers()
    if (!Array.isArray(data)) return

    // Group by station (lat/lon): keep highest AQI reading per location
    const stations = new Map()
    for (const obs of data) {
      const key = `${obs.Latitude},${obs.Longitude}`
      const existing = stations.get(key)
      if (!existing || obs.AQI > existing.AQI) stations.set(key, obs)
    }

    const catNames = ['', 'Good', 'Moderate', 'Unhealthy for Sensitive Groups', 'Unhealthy', 'Very Unhealthy', 'Hazardous']
    for (const obs of stations.values()) {
      const aqi = Number(obs.AQI)
      if (!Number.isFinite(aqi) || aqi < 0) continue
      const color = aqiColor(aqi)
      const textColor = aqi > 100 ? '#fff' : '#111'
      const icon = L.divIcon({
        html: `<div style="background:${color};color:${textColor};width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid rgba(255,255,255,0.4);box-shadow:0 2px 6px rgba(0,0,0,0.5)">${aqi}</div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })
      const marker = L.marker([obs.Latitude, obs.Longitude], { icon })
      marker.bindPopup(`
        <div style="min-width:180px;color:#111;line-height:1.5">
          <div style="font-size:20px;font-weight:700;margin:4px 0;color:${color}">${aqi}</div>
          <div style="font-size:11px;color:#555">AQI · ${catNames[obs.Category] || aqiLabel(aqi)}</div>
          <div style="margin-top:6px"><strong>Pollutant:</strong> ${obs.Parameter}</div>
          <div><strong>Unit:</strong> ${obs.Unit}</div>
          <div style="font-size:11px;color:#888;margin-top:4px">Source: AirNow / EPA</div>
        </div>
      `)
      atmoAirQualityMarkers?.addLayer(marker)
    }
  } catch {
    // AirNow fetch failed — silently ignore
  }
}

async function loadSpaceWeather() {
  try {
    const [kpRes, xrayRes, windRes] = await Promise.allSettled([
      fetchParsedWithRetry({ url: 'https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', parse: 'json', sourceLabel: 'Kp', timeoutMs: 6000 }),
      fetchParsedWithRetry({ url: 'https://services.swpc.noaa.gov/json/goes/primary/xrays-7-day.json', parse: 'json', sourceLabel: 'Xray', timeoutMs: 6000 }),
      fetchParsedWithRetry({ url: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json', parse: 'json', sourceLabel: 'Wind', timeoutMs: 6000 })
    ])

    if (kpRes.status === 'fulfilled') {
      const arr = Array.isArray(kpRes.value) ? kpRes.value : []
      const last = arr[arr.length - 1]
      const kp = last?.kp_index ?? last?.Kp ?? '—'
      document.getElementById('atmo-kp-badge')?.setAttribute('data-val', String(kp))
      document.getElementById('atmo-kp-badge').textContent = `Kp: ${Number.isFinite(Number(kp)) ? Number(kp).toFixed(1) : kp}`
      document.getElementById('atmo-kp-inline').textContent = `Kp ${Number.isFinite(Number(kp)) ? Number(kp).toFixed(1) : kp}`
    }

    if (xrayRes.status === 'fulfilled') {
      const arr = Array.isArray(xrayRes.value) ? xrayRes.value : []
      const last = arr[arr.length - 1]
      const flux = last?.flux ?? last?.observed_flux ?? 0
      const cls = xrayFluxClass(Number(flux))
      document.getElementById('atmo-xray-badge').textContent = `X-ray: ${cls}`
    }

    if (windRes.status === 'fulfilled') {
      const arr = Array.isArray(windRes.value) ? windRes.value : []
      const last = arr[arr.length - 1]
      const speed = last?.speed ?? last?.proton_speed ?? '—'
      document.getElementById('atmo-solar-wind-badge').textContent = `Solar Wind: ${Number.isFinite(Number(speed)) ? Math.round(Number(speed)) : speed} km/s`
    }

    // D-Region absorption on space map
    if (atmoSpaceMap && atmoAbsorptionLayer) {
      if (!atmoSpaceMap.hasLayer(atmoAbsorptionLayer)) atmoAbsorptionLayer.addTo(atmoSpaceMap)
    }
  } catch {
    // Space weather fetch failed
  }
}

function xrayFluxClass(flux) {
  if (!flux || flux <= 0) return '—'
  if (flux < 1e-7) return 'A'
  if (flux < 1e-6) return 'B'
  if (flux < 1e-5) return 'C'
  if (flux < 1e-4) return 'M'
  return 'X'
}

async function loadAuroraOverlay() {
  try {
    const data = await fetchParsedWithRetry({
      url: 'https://services.swpc.noaa.gov/json/ovation_aurora_latest.json',
      parse: 'json', sourceLabel: 'Aurora', timeoutMs: 8000
    })
    if (!atmoSpaceMap || !data?.coordinates) return
    if (atmoAuroraLayer) atmoSpaceMap.removeLayer(atmoAuroraLayer)

    // NOAA Aurora is a flat 2D grid: [[lon, lat, aurora_probability], ...]
    const coords = Array.isArray(data.coordinates) ? data.coordinates : []
    if (!coords.length) return
    // Render as small colored rectangles using a canvas or just L.circleMarker sampling every Nth point
    const layer = L.layerGroup()
    const step = 4  // sample every 4th point to avoid thousands of markers
    for (let i = 0; i < coords.length; i += step) {
      const [lon, lat, prob] = coords[i]
      if (!prob || prob < 5) continue
      const alpha = Math.min(0.8, prob / 100)
      const hue = 120  // green aurora
      const circle = L.circleMarker([lat, lon], {
        radius: 3,
        fillColor: `hsla(${hue}, 100%, 60%, ${alpha})`,
        fillOpacity: alpha,
        stroke: false
      })
      layer.addLayer(circle)
    }
    atmoAuroraLayer = layer
    atmoSpaceMap.addLayer(layer)
  } catch {
    // Aurora data unavailable
  }
}

async function initAtmosphereTab() {
  if (atmoInitialized) {
    atmoWeatherMap?.invalidateSize()
    atmoSpaceMap?.invalidateSize()
    return
  }
  atmoInitialized = true

  // Wait for DOM to be visible
  await new Promise(r => setTimeout(r, 80))
  initAtmosphereMaps()
  atmoWeatherMap?.invalidateSize()
  atmoSpaceMap?.invalidateSize()

  // Wire up layer checkboxes
  document.querySelectorAll('.atmo-layer-toggle input[data-layer]').forEach(cb => {
    cb.addEventListener('change', () => {
      setAtmoLayer(cb.dataset.layer, cb.checked)
    })
  })

  // Time slider
  const slider = document.getElementById('atmo-time-slider')
  slider?.addEventListener('input', () => {
    const offset = Number(slider.value)  // 0=today, 6=6 days ago stored as slider max-val
    // slider goes 0..6 where 6=today (max val), 0=oldest
    const dayOffset = 6 - Number(slider.value)
    updateGibsTime(dayOffset)
  })

  // Play button
  document.getElementById('atmo-play-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('atmo-play-btn')
    if (atmoPlayTimer) {
      clearInterval(atmoPlayTimer)
      atmoPlayTimer = null
      btn.textContent = '▶ Play'
      return
    }
    btn.textContent = '⏹ Stop'
    const sliderEl = document.getElementById('atmo-time-slider')
    if (sliderEl) sliderEl.value = '0'
    updateGibsTime(6)
    atmoPlayTimer = setInterval(() => {
      if (!sliderEl) return
      const cur = Number(sliderEl.value)
      if (cur >= 6) {
        clearInterval(atmoPlayTimer)
        atmoPlayTimer = null
        btn.textContent = '▶ Play'
        return
      }
      sliderEl.value = String(cur + 1)
      updateGibsTime(6 - (cur + 1))
    }, 1500)
  })
}

try {
  localStorage.removeItem('gwn_installed_addons')
} catch {
  // Ignore storage cleanup errors.
}

void bootstrapApp()

// Initialize notes editor
initNotesEditor()

// Fireball popup "Send to Notes" delegation
document.addEventListener('click', e => {
  const btn = e.target.closest('.fireball-send-notes')
  if (!btn) return
  const d = btn.dataset
  const lines = [`<b>NASA Fireball — ${escapeHtml(d.date)}</b>`]
  if (d.energy) lines.push(`Impact energy: ${d.energy} kt`)
  if (d.alt) lines.push(`Altitude: ${d.alt} km`)
  if (d.lat && d.lon) lines.push(`Coordinates: ${d.lat}, ${d.lon}`)
  appendToNotes(`<div style="margin:8px 0;padding:8px;border-left:3px solid #ffb347;background:#161b22">${lines.join('<br>')}</div>`)
})

// Quit guard — handle unsaved notes
window.electronAPI?.onBeforeQuit(async () => {
  if (isNotesDirty()) {
    const response = await window.electronAPI.showSavePrompt()
    if (response === 0) {
      // Save
      const editor = document.getElementById('notes-editor')
      await window.electronAPI.writeNote('TEMP_text', 'note.txt', editor.innerHTML)
      markNotesClean()
      window.electronAPI.confirmQuit()
    } else if (response === 1) {
      // Discard
      window.electronAPI.confirmQuit()
    }
    // Cancel (2) — do nothing, don't quit
  } else {
    window.electronAPI.confirmQuit()
  }
})
