/**
 * =============================================================================
 * EARTH DANGER INDEX — ALGORITHM MODULE
 * =============================================================================
 * Runs in the Electron MAIN PROCESS (Node.js).
 * earthDanger.html calls window.electronAPI.getDangerIndex()
 * main.js handles that IPC call and calls calculateDangerIndex() here.
 *
 * Standalone test:  node earthDangerAlgorithm.js
 * =============================================================================
 */

'use strict';

// -----------------------------------------------------------------------------
// WEIGHTS  (must sum to 1.0)
// -----------------------------------------------------------------------------
const WEIGHTS = {
  kp:       0.25,  // Geomagnetic storm  — NOAA SWPC Kp index
  xray:     0.20,  // Solar flare class  — NOAA SWPC GOES
  neo:      0.20,  // Nearest asteroid   — NASA CNEOS CAD
  fireball: 0.10,  // Bolide energy 30d  — NASA CNEOS fireballs
  moon:     0.10,  // Lunar tidal force  — computed
  planets:  0.10,  // Planetary stress   — computed
  sentry:   0.05,  // Impact probability — NASA Sentry
};

// -----------------------------------------------------------------------------
// UTILITIES
// -----------------------------------------------------------------------------

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// -----------------------------------------------------------------------------
// SCORING FUNCTIONS  (each returns integer 0–100)
// -----------------------------------------------------------------------------

function scoreKp(kp) {
  return clamp(Math.round((kp / 9) * 100), 0, 100);
}

function scoreXray(flux) {
  if (flux >= 1e-4) return 100; // X-class
  if (flux >= 1e-5) return 75;  // M-class
  if (flux >= 1e-6) return 45;  // C-class
  if (flux >= 1e-7) return 20;  // B-class
  return 5;                     // A-class
}

function xrayLabel(flux) {
  if (flux >= 1e-4) return 'X';
  if (flux >= 1e-5) return 'M';
  if (flux >= 1e-6) return 'C';
  if (flux >= 1e-7) return 'B';
  return 'A';
}

function scoreNeo(distAU) {
  if (distAU > 0.5) return 0;
  return clamp(Math.round((1 - distAU / 0.5) * 100), 0, 100);
}

function scoreFireball(maxKt) {
  if (maxKt <= 0) return 0;
  return clamp(Math.round((Math.log10(maxKt + 1) / 2) * 100), 0, 100);
}

// Peaks at BOTH new moon and full moon (syzygy = max tidal stress on crust)
function scoreMoonPhase(daysSinceNewMoon) {
  const cycle = ((daysSinceNewMoon % 29.53) + 29.53) % 29.53;
  const angle = (cycle / 29.53) * 2 * Math.PI;
  return Math.round(((1 - Math.cos(2 * angle)) / 2) * 100);
}

// Weighted by tidal influence (∝ mass/dist³): Jupiter=1.0 Saturn=0.6 Venus=0.5 Mars=0.2
function scorePlanetaryAlignment(j2000) {
  const P = 2 * Math.PI;
  const e  = P * j2000 / 365.25;
  const v  = P * j2000 / 224.70;
  const ma = P * j2000 / 686.97;
  const ju = P * j2000 / 4332.59;
  const sa = P * j2000 / 10759.22;
  const s  = (Math.abs(Math.cos(e - ju)) * 1.0 +
              Math.abs(Math.cos(e - sa)) * 0.6 +
              Math.abs(Math.cos(e - v))  * 0.5 +
              Math.abs(Math.cos(e - ma)) * 0.2) / 2.3;
  return Math.round(s * 100);
}

// Log scale: 1e-5 → ~0,  1e-3 → ~40,  1.0 → 100
function scoreSentry(prob) {
  if (prob <= 0) return 0;
  return clamp(Math.round(((Math.log10(prob) + 5) / 5) * 100), 0, 100);
}

// -----------------------------------------------------------------------------
// AGGREGATION
// -----------------------------------------------------------------------------

function computeDangerIndex(scores) {
  let sum = 0, tw = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    sum += (scores[k] ?? 0) * w;
    tw  += w;
  }
  return Math.round(sum / tw);
}

function dangerLevel(score) {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'ELEVATED';
  if (score >= 20) return 'MODERATE';
  return 'LOW';
}

// -----------------------------------------------------------------------------
// FETCHERS  (graceful fallback to simulated data on any network error)
// -----------------------------------------------------------------------------

async function fetchKp() {
  try {
    const r = await fetch('https://services.swpc.noaa.gov/json/planetary_k_index_1m.json',
                          { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    const last = d[d.length - 1];
    return { value: parseFloat(last.kp_index ?? last.Kp ?? 0),
             source: 'NOAA SWPC (live)', simulated: false };
  } catch {
    return { value: parseFloat((Math.random() * 4 + 0.5).toFixed(1)),
             source: 'NOAA SWPC (simulated)', simulated: true };
  }
}

async function fetchXray() {
  try {
    const r = await fetch('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json',
                          { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    for (let i = d.length - 1; i >= 0; i--) {
      const flux = parseFloat(d[i]['flux_1_0'] ?? d[i].flux ?? 0);
      if (flux > 0) return { value: flux, source: 'NOAA SWPC GOES (live)', simulated: false };
    }
    throw new Error('no flux');
  } catch {
    return { value: Math.random() * 2e-6 + 1e-7,
             source: 'NOAA SWPC GOES (simulated)', simulated: true };
  }
}

async function fetchNearestNEO() {
  try {
    const today  = new Date().toISOString().split('T')[0];
    const future = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const url    = `https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.5&sort=dist&limit=1&date-min=${today}&date-max=${future}`;
    const r      = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const d      = await r.json();
    if (d.data?.length) {
      const o = d.data[0]; // [des, orbit_id, jd, cd, dist, dist_min, dist_max, v_rel, ...]
      return { name: o[0], distAU: parseFloat(o[4]), approachDate: o[3],
               velocityKmS: parseFloat(o[7] ?? 0),
               source: 'NASA CNEOS CAD (live)', simulated: false };
    }
    throw new Error('empty');
  } catch {
    return { name: 'simulated-NEO',
             distAU: parseFloat((Math.random() * 0.3 + 0.05).toFixed(5)),
             approachDate: 'N/A', velocityKmS: parseFloat((Math.random() * 20 + 5).toFixed(2)),
             source: 'NASA CNEOS CAD (simulated)', simulated: true };
  }
}

async function fetchFireballs() {
  try {
    const r      = await fetch('https://ssd-api.jpl.nasa.gov/fireball.api?limit=50',
                               { signal: AbortSignal.timeout(10000) });
    const d      = await r.json();
    const cutoff = Date.now() - 30 * 86400000;
    let maxKt = 0, count = 0;
    if (d.data) {
      for (const ev of d.data) {
        if (new Date(ev[0]).getTime() > cutoff) {
          count++;
          const e = parseFloat(ev[2] ?? 0); // kt TNT impact energy
          if (e > maxKt) maxKt = e;
        }
      }
    }
    return { maxKt, count, source: 'NASA CNEOS Fireballs (live)', simulated: false };
  } catch {
    return { maxKt: parseFloat((Math.random() * 4).toFixed(2)),
             count: Math.floor(Math.random() * 10 + 2),
             source: 'NASA CNEOS Fireballs (simulated)', simulated: true };
  }
}

async function fetchSentry() {
  try {
    const r = await fetch('https://ssd-api.jpl.nasa.gov/sentry.api',
                          { signal: AbortSignal.timeout(10000) });
    const d = await r.json();
    let maxProb = 0, best = null;
    if (d.data) {
      for (const o of d.data) {
        const p = parseFloat(o.ip ?? o.prob ?? 0);
        if (p > maxProb) { maxProb = p; best = { name: o.des, range: o.range, prob: p }; }
      }
    }
    return { maxProb, count: d.data?.length ?? 0, mostDangerous: best,
             source: 'NASA Sentry (live)', simulated: false };
  } catch {
    return { maxProb: Math.random() * 0.0005, count: Math.floor(Math.random() * 25 + 8),
             mostDangerous: null, source: 'NASA Sentry (simulated)', simulated: true };
  }
}

function computeLocalAstro() {
  const J2000_MS    = new Date('2000-01-01T12:00:00Z').getTime();
  const NEW_MOON_MS = new Date('2024-01-11T11:57:00Z').getTime();
  const j2000 = (Date.now() - J2000_MS)    / 86400000;
  const dsnm  = (Date.now() - NEW_MOON_MS) / 86400000;
  const cyc   = ((dsnm % 29.53) + 29.53) % 29.53;
  let phaseName;
  if      (cyc < 1.85)  phaseName = 'New Moon';
  else if (cyc < 7.38)  phaseName = 'Waxing Crescent';
  else if (cyc < 9.22)  phaseName = 'First Quarter';
  else if (cyc < 14.76) phaseName = 'Waxing Gibbous';
  else if (cyc < 16.61) phaseName = 'Full Moon';
  else if (cyc < 22.15) phaseName = 'Waning Gibbous';
  else if (cyc < 23.99) phaseName = 'Last Quarter';
  else                  phaseName = 'Waning Crescent';
  return { j2000, dsnm, phaseName };
}

// -----------------------------------------------------------------------------
// MAIN EXPORT FUNCTION
// -----------------------------------------------------------------------------

async function calculateDangerIndex() {
  const [kpD, xrD, neoD, firD, senD] = await Promise.all([
    fetchKp(), fetchXray(), fetchNearestNEO(), fetchFireballs(), fetchSentry(),
  ]);
  const astro = computeLocalAstro();

  const scores = {
    kp:       scoreKp(kpD.value),
    xray:     scoreXray(xrD.value),
    neo:      scoreNeo(neoD.distAU),
    fireball: scoreFireball(firD.maxKt),
    moon:     scoreMoonPhase(astro.dsnm),
    planets:  scorePlanetaryAlignment(astro.j2000),
    sentry:   scoreSentry(senD.maxProb),
  };

  const dangerIndex = computeDangerIndex(scores);

  return {
    dangerIndex,
    level: dangerLevel(dangerIndex),
    timestamp: new Date().toISOString(),
    components: {
      kp:       { score: scores.kp,       rawValue: kpD.value,
                  weight: WEIGHTS.kp,       source: kpD.source,     simulated: kpD.simulated },
      xray:     { score: scores.xray,     rawValue: xrD.value,  flareClass: xrayLabel(xrD.value),
                  weight: WEIGHTS.xray,     source: xrD.source,     simulated: xrD.simulated },
      neo:      { score: scores.neo,      distAU: neoD.distAU,  name: neoD.name,
                  approachDate: neoD.approachDate, velocityKmS: neoD.velocityKmS,
                  weight: WEIGHTS.neo,      source: neoD.source,    simulated: neoD.simulated },
      fireball: { score: scores.fireball, maxKt: firD.maxKt,    count30d: firD.count,
                  weight: WEIGHTS.fireball, source: firD.source,    simulated: firD.simulated },
      moon:     { score: scores.moon,     phaseName: astro.phaseName,
                  daysSinceNewMoon: parseFloat(astro.dsnm.toFixed(2)),
                  weight: WEIGHTS.moon,     source: 'Computed (orbital mechanics)', simulated: false },
      planets:  { score: scores.planets,  daysSinceJ2000: Math.round(astro.j2000),
                  weight: WEIGHTS.planets,  source: 'Computed (planetary ephemeris)', simulated: false },
      sentry:   { score: scores.sentry,   maxProb: senD.maxProb, count: senD.count,
                  mostDangerous: senD.mostDangerous,
                  weight: WEIGHTS.sentry,   source: senD.source,    simulated: senD.simulated },
    },
    formula: 'DangerIndex = Σ(score × weight) / Σ(weights) × 100  |  ' +
             'kp=0.25 · xray=0.20 · neo=0.20 · fireball=0.10 · moon=0.10 · planets=0.10 · sentry=0.05',
  };
}

// -----------------------------------------------------------------------------
// PRETTY-PRINT HELPER  (debug / terminal use)
// -----------------------------------------------------------------------------

function printResult(r) {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  EARTH DANGER INDEX: ${String(r.dangerIndex).padStart(3)}/100  [${r.level.padEnd(8)}] ║`);
  console.log('╠══════════════════════════════════════════╣');
  for (const [k, c] of Object.entries(r.components)) {
    const bar = '█'.repeat(Math.round(c.score / 10)).padEnd(10, '░');
    console.log(`║  ${k.padEnd(9)} ${bar} ${String(c.score).padStart(3)}%  (w=${c.weight}) ║`);
  }
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  ${r.timestamp.slice(0, 19).replace('T', ' ')}                        ║`);
  console.log('╚══════════════════════════════════════════╝\n');
}

// -----------------------------------------------------------------------------
// EXPORTS  (used by main.js)
// -----------------------------------------------------------------------------

module.exports = {
  calculateDangerIndex,
  computeDangerIndex, dangerLevel,
  scoreKp, scoreXray, scoreNeo, scoreFireball,
  scoreMoonPhase, scorePlanetaryAlignment, scoreSentry,
  xrayLabel, WEIGHTS, printResult,
};

// -----------------------------------------------------------------------------
// STANDALONE TEST  →  node earthDangerAlgorithm.js
// -----------------------------------------------------------------------------

if (require.main === module) {
  console.log('Fetching live data…\n');
  calculateDangerIndex()
    .then(r => { printResult(r); console.log(JSON.stringify(r, null, 2)); })
    .catch(e => console.error('Error:', e));
}
