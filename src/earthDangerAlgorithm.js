// Earth Danger Index module for renderer use.
// For full theory/background notes, see Version2/earthDangerAlgorithm.js (planning reference file).

const WEIGHTS = {
  kp: 0.25,
  xray: 0.20,
  neo: 0.20,
  fireball: 0.10,
  moon: 0.10,
  planets: 0.10,
  sentry: 0.05
}

const TIMEOUT_MS = 10000

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function scoreKp(kp) {
  return clamp(Math.round((kp / 9) * 100), 0, 100)
}

function scoreXray(flux) {
  if (flux >= 1e-4) return 100
  if (flux >= 1e-5) return 75
  if (flux >= 1e-6) return 45
  if (flux >= 1e-7) return 20
  return 5
}

function xrayLabel(flux) {
  if (flux >= 1e-4) return 'X'
  if (flux >= 1e-5) return 'M'
  if (flux >= 1e-6) return 'C'
  if (flux >= 1e-7) return 'B'
  return 'A'
}

function scoreNeo(distAU) {
  if (distAU > 0.5) return 0
  return clamp(Math.round((1 - distAU / 0.5) * 100), 0, 100)
}

function scoreFireball(maxEnergyKt) {
  if (maxEnergyKt <= 0) return 0
  return clamp(Math.round((Math.log10(maxEnergyKt + 1) / 2) * 100), 0, 100)
}

function scoreMoonPhase(daysSinceNewMoon) {
  const cycle = ((daysSinceNewMoon % 29.53) + 29.53) % 29.53
  const angle = (cycle / 29.53) * 2 * Math.PI
  return Math.round(((1 - Math.cos(2 * angle)) / 2) * 100)
}

function scorePlanetaryAlignment(daysSinceJ2000) {
  const TWO_PI = 2 * Math.PI
  const earthL = (TWO_PI * daysSinceJ2000) / 365.25
  const marsL = (TWO_PI * daysSinceJ2000) / 686.97
  const jupiterL = (TWO_PI * daysSinceJ2000) / 4332.59
  const saturnL = (TWO_PI * daysSinceJ2000) / 10759.22
  const venusL = (TWO_PI * daysSinceJ2000) / 224.70

  const alignMars = Math.abs(Math.cos(earthL - marsL))
  const alignJupiter = Math.abs(Math.cos(earthL - jupiterL))
  const alignSaturn = Math.abs(Math.cos(earthL - saturnL))
  const alignVenus = Math.abs(Math.cos(earthL - venusL))

  const weighted =
    (alignJupiter * 1.0 + alignSaturn * 0.6 + alignVenus * 0.5 + alignMars * 0.2) /
    (1.0 + 0.6 + 0.5 + 0.2)

  return Math.round(weighted * 100)
}

function scoreSentry(maxProb) {
  if (maxProb <= 0) return 0
  const logScore = (Math.log10(maxProb) + 5) / 5
  return clamp(Math.round(logScore * 100), 0, 100)
}

function computeDangerIndex(scores) {
  let weightedSum = 0
  let totalWeight = 0
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    weightedSum += (scores[key] ?? 0) * weight
    totalWeight += weight
  }
  return Math.round(weightedSum / totalWeight)
}

function dangerLevel(score) {
  if (score >= 80) return 'CRITICAL'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'ELEVATED'
  if (score >= 20) return 'MODERATE'
  return 'LOW'
}

async function fetchWithTimeout(url, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchKp() {
  try {
    const res = await fetchWithTimeout('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json', 8000)
    const data = await res.json()
    const last = data[data.length - 1]
    const kp = parseFloat(last?.kp_index ?? last?.Kp ?? 0)
    return { value: kp, source: 'NOAA SWPC (live)', simulated: false }
  } catch {
    return { value: parseFloat((Math.random() * 4 + 0.5).toFixed(1)), source: 'NOAA SWPC (simulated)', simulated: true }
  }
}

async function fetchXray() {
  try {
    const res = await fetchWithTimeout('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json', 8000)
    const data = await res.json()
    for (let i = data.length - 1; i >= 0; i--) {
      const flux = parseFloat(data[i]?.flux_1_0 ?? data[i]?.flux ?? 0)
      if (flux > 0) return { value: flux, source: 'NOAA GOES (live)', simulated: false }
    }
    throw new Error('No valid xray flux')
  } catch {
    return { value: Math.random() * 3e-6 + 1e-7, source: 'NOAA GOES (simulated)', simulated: true }
  }
}

async function fetchNearestNEO() {
  try {
    const today = new Date().toISOString().split('T')[0]
    const future = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0]
    const url = `https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.5&sort=dist&limit=5&date-min=${today}&date-max=${future}`
    const res = await fetchWithTimeout(url, 10000)
    const data = await res.json()
    if (!Array.isArray(data?.data) || !data.data.length) throw new Error('No CAD entries')
    const obj = data.data[0]
    return {
      name: obj[0],
      distAU: parseFloat(obj[4]),
      approachDate: obj[3],
      velocityKmS: parseFloat(obj[7] ?? 0),
      source: 'NASA CNEOS CAD (live)',
      simulated: false
    }
  } catch {
    return {
      name: 'simulated-NEO',
      distAU: parseFloat((Math.random() * 0.3 + 0.05).toFixed(5)),
      approachDate: 'N/A',
      velocityKmS: parseFloat((Math.random() * 20 + 5).toFixed(2)),
      source: 'NASA CNEOS CAD (simulated)',
      simulated: true
    }
  }
}

async function fetchFireballs() {
  try {
    const res = await fetchWithTimeout('https://ssd-api.jpl.nasa.gov/fireball.api?sort=-date', 10000)
    const data = await res.json()
    const now = Date.now()
    const thirtyDaysMs = 30 * 24 * 3600 * 1000
    let maxEnergy = 0
    let count = 0
    for (const ev of data?.data || []) {
      const evDate = new Date(ev[0]).getTime()
      if (now - evDate < thirtyDaysMs) {
        count++
        const impactE = parseFloat(ev[2] ?? 0)
        if (impactE > maxEnergy) maxEnergy = impactE
      }
    }
    return { maxEnergyKt: maxEnergy, count, source: 'NASA Fireballs (live)', simulated: false }
  } catch {
    return { maxEnergyKt: parseFloat((Math.random() * 5).toFixed(2)), count: Math.floor(Math.random() * 12 + 2), source: 'NASA Fireballs (simulated)', simulated: true }
  }
}

async function fetchSentry() {
  try {
    const res = await fetchWithTimeout('https://ssd-api.jpl.nasa.gov/sentry.api', 10000)
    const data = await res.json()
    let maxProb = 0
    let mostDangerous = null
    for (const obj of data?.data || []) {
      const prob = parseFloat(obj?.ip ?? obj?.prob ?? 0)
      if (prob > maxProb) {
        maxProb = prob
        mostDangerous = { name: obj.des, year: obj.range, prob }
      }
    }
    return { maxProb, count: data?.data?.length || 0, mostDangerous, source: 'NASA Sentry (live)', simulated: false }
  } catch {
    return { maxProb: Math.random() * 0.0005, count: Math.floor(Math.random() * 20 + 5), mostDangerous: null, source: 'NASA Sentry (simulated)', simulated: true }
  }
}

function computeLocalAstro() {
  const J2000 = new Date('2000-01-01T12:00:00Z').getTime()
  const daysSinceJ2000 = (Date.now() - J2000) / (1000 * 3600 * 24)

  const knownNewMoon = new Date('2024-01-11T11:57:00Z').getTime()
  const daysSinceNewMoon = (Date.now() - knownNewMoon) / (1000 * 3600 * 24)
  const lunarCycleDays = daysSinceNewMoon % 29.53

  let phaseName
  if (lunarCycleDays < 1.85) phaseName = 'New Moon'
  else if (lunarCycleDays < 7.38) phaseName = 'Waxing Crescent'
  else if (lunarCycleDays < 9.22) phaseName = 'First Quarter'
  else if (lunarCycleDays < 14.76) phaseName = 'Waxing Gibbous'
  else if (lunarCycleDays < 16.61) phaseName = 'Full Moon'
  else if (lunarCycleDays < 22.15) phaseName = 'Waning Gibbous'
  else if (lunarCycleDays < 23.99) phaseName = 'Last Quarter'
  else phaseName = 'Waning Crescent'

  return { daysSinceNewMoon, daysSinceJ2000, phaseName }
}

export async function calculateDangerIndex() {
  const [kpData, xrayData, neoData, fireData, sentryData] = await Promise.all([
    fetchKp(),
    fetchXray(),
    fetchNearestNEO(),
    fetchFireballs(),
    fetchSentry()
  ])

  const astro = computeLocalAstro()
  const scores = {
    kp: scoreKp(kpData.value),
    xray: scoreXray(xrayData.value),
    neo: scoreNeo(neoData.distAU),
    fireball: scoreFireball(fireData.maxEnergyKt),
    moon: scoreMoonPhase(astro.daysSinceNewMoon),
    planets: scorePlanetaryAlignment(astro.daysSinceJ2000),
    sentry: scoreSentry(sentryData.maxProb)
  }

  const dangerIndex = computeDangerIndex(scores)

  return {
    dangerIndex,
    level: dangerLevel(dangerIndex),
    timestamp: new Date().toISOString(),
    components: {
      kp: { score: scores.kp, rawValue: kpData.value, source: kpData.source, simulated: kpData.simulated, weight: WEIGHTS.kp },
      xray: { score: scores.xray, rawValue: xrayData.value, flareClass: xrayLabel(xrayData.value), source: xrayData.source, simulated: xrayData.simulated, weight: WEIGHTS.xray },
      neo: { score: scores.neo, name: neoData.name, distAU: neoData.distAU, source: neoData.source, simulated: neoData.simulated, weight: WEIGHTS.neo },
      fireball: { score: scores.fireball, maxEnergyKt: fireData.maxEnergyKt, count30d: fireData.count, source: fireData.source, simulated: fireData.simulated, weight: WEIGHTS.fireball },
      moon: { score: scores.moon, phaseName: astro.phaseName, source: 'Computed', simulated: false, weight: WEIGHTS.moon },
      planets: { score: scores.planets, daysSinceJ2000: Math.round(astro.daysSinceJ2000), source: 'Computed', simulated: false, weight: WEIGHTS.planets },
      sentry: { score: scores.sentry, maxProb: sentryData.maxProb, count: sentryData.count, source: sentryData.source, simulated: sentryData.simulated, weight: WEIGHTS.sentry }
    }
  }
}
