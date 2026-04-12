const SOURCE_PRIORITY = ['NASA Sentry', 'NASA CAD', 'NASA NeoWs', 'MPC NEOCP', 'JPL Comets', 'JPL CAD Comets']

function sourceRank(source) {
  const index = SOURCE_PRIORITY.indexOf(source)
  return index >= 0 ? index : SOURCE_PRIORITY.length
}

function compareBySourcePriority(left, right) {
  return sourceRank(left?.source) - sourceRank(right?.source)
}

function normalizeAsteroidName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function asteroidGroupKey(row) {
  if (row?.groupKey) return row.groupKey
  const normalizedName = normalizeAsteroidName(row?.name)
  if (normalizedName) return normalizedName
  const lookup = normalizeAsteroidName(row?.sbdbLookup)
  return lookup || String(row?.id || 'unknown-asteroid')
}

function choosePreferredRecord(rows, predicate) {
  const sorted = [...rows].sort(compareBySourcePriority)
  return sorted.find(predicate) || null
}

function choosePreferredNumber(rows, getter) {
  const record = choosePreferredRecord(rows, row => Number.isFinite(getter(row)))
  return record ? getter(record) : null
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))]
}

function formatRiskScore(score) {
  if (!Number.isFinite(score) || score <= 0) return 'Risk unknown'
  if (score < 0.01) return `Risk ${score.toExponential(2)}`
  return `Risk ${(score * 100).toFixed(2)}%`
}

export function asteroidDistanceAuText(distanceAu) {
  return Number.isFinite(distanceAu) ? `${distanceAu.toFixed(6)} AU` : 'Unknown'
}

export function asteroidDistanceKmText(distanceAu) {
  return Number.isFinite(distanceAu) ? `${Math.round(distanceAu * 149597870.7).toLocaleString()} km` : 'Unknown'
}

export function asteroidAverageSizeText(sizeMeters) {
  if (!Number.isFinite(sizeMeters)) return 'Unknown'
  if (sizeMeters >= 1000) return `${(sizeMeters / 1000).toFixed(2)} km`
  return `${sizeMeters.toFixed(sizeMeters >= 100 ? 0 : 1)} m`
}

export function asteroidEstimateDiameterMeters(absMagnitude, albedo = 0.14) {
  if (!Number.isFinite(absMagnitude) || !Number.isFinite(albedo) || albedo <= 0) return null
  const diameterKm = (1329 / Math.sqrt(albedo)) * (10 ** (-absMagnitude / 5))
  return Number.isFinite(diameterKm) ? diameterKm * 1000 : null
}

export function asteroidFormatApproachDates(dates, limit = 3) {
  if (!Array.isArray(dates) || !dates.length) return 'Unknown'
  return uniqueStrings(dates).slice(0, limit).join(' | ')
}

export function asteroidListFacts(row) {
  const facts = []
  if (Array.isArray(row?.sources) && row.sources.length > 1) {
    facts.push(`${row.sources.length} sources`) 
  }
  if (Number.isFinite(row?.distanceAU)) {
    facts.push(`Closest pass ${row.distanceAU.toFixed(5)} AU`)
  }
  if (Number.isFinite(row?.averageSizeMeters)) {
    facts.push(`Avg size ${asteroidAverageSizeText(row.averageSizeMeters)}`)
  }
  if (Array.isArray(row?.approachDates) && row.approachDates.length > 1) {
    facts.push(`${row.approachDates.length} close approaches`)
  }
  return facts
}

function buildMergedMeta({ distanceAU, riskScore, sources, averageSizeMeters }) {
  if (Number.isFinite(riskScore) && riskScore > 0) {
    return Number.isFinite(distanceAU)
      ? `${formatRiskScore(riskScore)} · Dist ${distanceAU.toFixed(5)} AU`
      : formatRiskScore(riskScore)
  }
  if (Number.isFinite(distanceAU)) return `Dist ${distanceAU.toFixed(5)} AU`
  if (Number.isFinite(averageSizeMeters)) return `Avg size ${asteroidAverageSizeText(averageSizeMeters)}`
  return sources.join(' | ')
}

function buildMergedDetails(rows, merged) {
  const details = {
    Sources: merged.sources.join(' | '),
    'Object name': merged.name,
    'Hazard status': merged.isHazardous ? 'Hazard flagged in one or more feeds' : 'No hazard flag from merged feeds',
    'Average diameter': asteroidAverageSizeText(merged.averageSizeMeters),
    'Closest pass (AU)': asteroidDistanceAuText(merged.distanceAU),
    'Closest pass (km)': asteroidDistanceKmText(merged.distanceAU),
    'Close approach dates': asteroidFormatApproachDates(merged.approachDates, 5)
  }

  for (const row of [...rows].sort(compareBySourcePriority)) {
    for (const [key, value] of Object.entries(row.details || {})) {
      const detailKey = `${row.source} · ${key}`
      if (!(detailKey in details)) {
        details[detailKey] = value
      }
    }
  }

  return details
}

export function mergeAsteroidRows(rows) {
  const grouped = new Map()

  for (const row of rows) {
    const key = asteroidGroupKey(row)
    const bucket = grouped.get(key) || []
    bucket.push(row)
    grouped.set(key, bucket)
  }

  return [...grouped.entries()].map(([key, bucket]) => {
    const sorted = [...bucket].sort(compareBySourcePriority)
    const sources = uniqueStrings(sorted.map(row => row.source))
    const preferredNameRow = choosePreferredRecord(sorted, row => row.name && row.name !== 'Unknown') || sorted[0]
    const distanceCandidates = sorted.map(row => row.distanceAU).filter(Number.isFinite)
    const distanceAU = distanceCandidates.length ? Math.min(...distanceCandidates) : null
    const riskCandidates = sorted.map(row => row.riskScore).filter(Number.isFinite)
    const riskScore = riskCandidates.length ? Math.max(...riskCandidates) : 0
    const averageSizeMeters = choosePreferredNumber(sorted, row => row.averageSizeMeters)
    const approachDates = uniqueStrings(sorted.flatMap(row => Array.isArray(row.approachDates) ? row.approachDates : []))
    const lookupRow = choosePreferredRecord(sorted, row => row.sbdbLookup && !/^\d+$/.test(String(row.sbdbLookup)))
      || choosePreferredRecord(sorted, row => row.sbdbLookup)
      || preferredNameRow
    const merged = {
      id: `merged-${key.replace(/[^a-z0-9]+/g, '-') || 'asteroid'}`,
      source: sources.join(' | '),
      sources,
      name: preferredNameRow?.name || 'Unknown',
      distanceAU,
      riskScore,
      isHazardous: sorted.some(row => row.isHazardous),
      averageSizeMeters,
      approachDates,
      sbdbLookup: lookupRow?.sbdbLookup || preferredNameRow?.name || 'Unknown',
      meta: buildMergedMeta({ distanceAU, riskScore, sources, averageSizeMeters }),
      sbdbLoaded: false
    }
    merged.cometPrefix = sorted.find(r => r.cometPrefix)?.cometPrefix || null
    merged.details = buildMergedDetails(sorted, merged)
    return merged
  })
}

function aggregateByKey(rows, keySelector, reducer) {
  const grouped = new Map()
  for (const row of rows) {
    const key = keySelector(row)
    const bucket = grouped.get(key) || []
    bucket.push(row)
    grouped.set(key, bucket)
  }
  return [...grouped.entries()].map(([key, bucket]) => reducer(key, bucket))
}

export function createAsteroidSourceLoaders({ fetchJsonWithTimeout, fetchNeoWsFeedWithFallback }) {
  async function fetchAsteroidCad() {
    const start = new Date().toISOString().split('T')[0]
    const end = new Date(Date.now() + (365 * 86400000)).toISOString().split('T')[0]
    const data = await fetchJsonWithTimeout(`https://ssd-api.jpl.nasa.gov/cad.api?dist-max=1&sort=dist&limit=250&date-min=${start}&date-max=${end}`, 'NASA CAD')
    const rawRows = Array.isArray(data?.data) ? data.data : []

    return aggregateByKey(rawRows, row => row[0] || `cad-${Math.random()}`, (name, bucket) => {
      const approachDates = uniqueStrings(bucket.map(row => row[3]).filter(Boolean))
      const distanceValues = bucket.map(row => parseFloat(row[4] ?? Number.NaN)).filter(Number.isFinite)
      const closestDistanceAu = distanceValues.length ? Math.min(...distanceValues) : null
      const representative = bucket.find(row => Number.isFinite(parseFloat(row[10] ?? Number.NaN))) || bucket[0]
      const velocity = parseFloat(representative?.[7] ?? Number.NaN)
      const absMagnitude = parseFloat(representative?.[10] ?? Number.NaN)
      const averageSizeMeters = asteroidEstimateDiameterMeters(absMagnitude)
      return {
        id: `cad-${normalizeAsteroidName(name) || bucket.length}`,
        source: 'NASA CAD',
        name,
        distanceAU: closestDistanceAu,
        riskScore: 0,
        isHazardous: false,
        averageSizeMeters,
        approachDates,
        sbdbLookup: name,
        meta: Number.isFinite(closestDistanceAu) ? `Dist ${closestDistanceAu.toFixed(5)} AU` : 'Dist unknown',
        details: {
          Source: 'NASA CAD',
          'Object name': name,
          'Closest known pass (AU)': asteroidDistanceAuText(closestDistanceAu),
          'Closest known pass (km)': asteroidDistanceKmText(closestDistanceAu),
          'Close approach dates': asteroidFormatApproachDates(approachDates, 5),
          'Relative velocity (km/s)': Number.isFinite(velocity) ? velocity.toFixed(3) : 'Unknown',
          'Absolute magnitude H': Number.isFinite(absMagnitude) ? absMagnitude.toFixed(2) : 'Unknown',
          'Average diameter': asteroidAverageSizeText(averageSizeMeters)
        }
      }
    })
  }

  async function fetchAsteroidSentry() {
    const data = await fetchJsonWithTimeout('https://ssd-api.jpl.nasa.gov/sentry.api', 'NASA Sentry')
    const rows = Array.isArray(data?.data) ? data.data : []

    return rows.slice(0, 300).map((item, index) => {
      const name = item?.des || item?.fullname || 'Unknown'
      const impactProbability = parseFloat(item?.ip ?? item?.prob ?? Number.NaN)
      const palermo = parseFloat(item?.ps_max ?? Number.NaN)
      const absMagnitude = parseFloat(item?.h ?? item?.H ?? Number.NaN)
      const directDiameterKm = parseFloat(item?.diameter ?? Number.NaN)
      const averageSizeMeters = Number.isFinite(directDiameterKm)
        ? directDiameterKm * 1000
        : asteroidEstimateDiameterMeters(absMagnitude)
      const isHazardous = Number.isFinite(impactProbability) && impactProbability > 0
      return {
        id: `sentry-${index}-${name}`,
        source: 'NASA Sentry',
        name,
        distanceAU: null,
        riskScore: Number.isFinite(impactProbability) ? impactProbability : 0,
        isHazardous,
        averageSizeMeters,
        approachDates: [],
        sbdbLookup: name,
        meta: Number.isFinite(impactProbability) ? `IP ${impactProbability.toExponential(2)}` : 'IP unknown',
        details: {
          Source: 'NASA Sentry',
          'Object name': name,
          'Hazard status': isHazardous ? 'Monitored impact risk' : 'No active hazard flag',
          'Average diameter': asteroidAverageSizeText(averageSizeMeters),
          'Impact probability': Number.isFinite(impactProbability) ? impactProbability.toExponential(6) : 'Unknown',
          'Palermo scale max': Number.isFinite(palermo) ? palermo.toFixed(3) : 'Unknown',
          'Absolute magnitude H': Number.isFinite(absMagnitude) ? absMagnitude.toFixed(2) : 'Unknown',
          'Impact date range': item?.range || 'Unknown',
          'Potential impact years': item?.n_imp || 'Unknown'
        }
      }
    })
  }

  async function fetchAsteroidNeoWs() {
    const start = new Date()
    const end = new Date(Date.now() + (6 * 86400000))
    const startDate = start.toISOString().split('T')[0]
    const endDate = end.toISOString().split('T')[0]
    const data = await fetchNeoWsFeedWithFallback(startDate, endDate)
    const byDay = data?.near_earth_objects || {}
    const rawRows = []
    for (const day of Object.keys(byDay)) {
      const list = Array.isArray(byDay[day]) ? byDay[day] : []
      rawRows.push(...list)
    }

    return aggregateByKey(rawRows, item => item?.id || item?.name || `neows-${Math.random()}`, (key, bucket) => {
      const representative = bucket[0]
      const name = representative?.name || 'Unknown'
      const allApproaches = bucket.flatMap(item => Array.isArray(item?.close_approach_data) ? item.close_approach_data : [])
      const approachDates = uniqueStrings(allApproaches.map(entry => entry?.close_approach_date_full || entry?.close_approach_date || null))
      const closestDistanceAu = allApproaches.reduce((closest, entry) => {
        const value = parseFloat(entry?.miss_distance?.astronomical ?? Number.NaN)
        if (!Number.isFinite(value)) return closest
        if (!Number.isFinite(closest) || value < closest) return value
        return closest
      }, Number.NaN)
      const closestApproach = allApproaches.find(entry => parseFloat(entry?.miss_distance?.astronomical ?? Number.NaN) === closestDistanceAu) || allApproaches[0] || null
      const distanceKm = parseFloat(closestApproach?.miss_distance?.kilometers ?? Number.NaN)
      const meters = representative?.estimated_diameter?.meters
      const diameterMin = parseFloat(meters?.estimated_diameter_min ?? Number.NaN)
      const diameterMax = parseFloat(meters?.estimated_diameter_max ?? Number.NaN)
      const averageSizeMeters = Number.isFinite(diameterMin) && Number.isFinite(diameterMax)
        ? (diameterMin + diameterMax) / 2
        : Number.isFinite(diameterMin)
          ? diameterMin
          : Number.isFinite(diameterMax)
            ? diameterMax
            : null
      const hazardous = bucket.some(item => Boolean(item?.is_potentially_hazardous_asteroid))
      return {
        id: `neows-${key}`,
        source: 'NASA NeoWs',
        name,
        distanceAU: Number.isFinite(closestDistanceAu) ? closestDistanceAu : null,
        riskScore: hazardous ? 1e-3 : 0,
        isHazardous: hazardous,
        averageSizeMeters,
        approachDates,
        sbdbLookup: representative?.id || name,
        meta: Number.isFinite(closestDistanceAu) ? `Dist ${closestDistanceAu.toFixed(5)} AU` : 'Dist unknown',
        details: {
          Source: 'NASA NeoWs',
          'Object name': name,
          'NASA NEO id': representative?.id || 'Unknown',
          'Potentially hazardous': hazardous ? 'Yes' : 'No',
          'Average diameter': asteroidAverageSizeText(averageSizeMeters),
          'Close approach date': closestApproach?.close_approach_date || 'Unknown',
          'Close approach dates': asteroidFormatApproachDates(approachDates, 5),
          'Closest pass (AU)': asteroidDistanceAuText(closestDistanceAu),
          'Closest pass (km)': asteroidDistanceKmText(closestDistanceAu),
          'Distance (km)': Number.isFinite(distanceKm) ? Math.round(distanceKm).toLocaleString() : 'Unknown',
          'Estimated diameter min (m)': Number.isFinite(diameterMin) ? diameterMin.toFixed(1) : 'Unknown',
          'Estimated diameter max (m)': Number.isFinite(diameterMax) ? diameterMax.toFixed(1) : 'Unknown'
        }
      }
    })
  }

  async function fetchAsteroidMpc() {
    const data = await fetchJsonWithTimeout('https://www.minorplanetcenter.net/Extended_Files/neocp.json', 'MPC NEOCP')
    const rows = Array.isArray(data) ? data : []

    return rows.slice(0, 300).map((item, index) => {
      const name = item?.Temp_Desig || item?.desig || item?.Designation || 'Unknown'
      const score = parseFloat(item?.Score ?? item?.score ?? Number.NaN)
      const visualMag = parseFloat(item?.V ?? item?.v ?? Number.NaN)
      const absMagnitude = parseFloat(item?.H ?? item?.h ?? Number.NaN)
      const averageSizeMeters = asteroidEstimateDiameterMeters(absMagnitude)
      const isHazardous = Number.isFinite(score) && score >= 50
      return {
        id: `mpc-${index}-${name}`,
        source: 'MPC NEOCP',
        name,
        distanceAU: null,
        riskScore: Number.isFinite(score) ? score / 100 : 0,
        isHazardous,
        averageSizeMeters,
        approachDates: [],
        sbdbLookup: name,
        meta: Number.isFinite(score) ? `Score ${score.toFixed(1)}` : 'Score unknown',
        details: {
          Source: 'MPC NEOCP',
          'Temporary designation': name,
          'Hazard status': isHazardous ? 'High-priority candidate' : 'Tracking candidate',
          'Average diameter': asteroidAverageSizeText(averageSizeMeters),
          'MPC score': Number.isFinite(score) ? score.toFixed(1) : 'Unknown',
          'Visual magnitude (V)': Number.isFinite(visualMag) ? visualMag.toFixed(2) : 'Unknown',
          'Absolute magnitude H': Number.isFinite(absMagnitude) ? absMagnitude.toFixed(2) : 'Unknown',
          'Observation arc': item?.Arc || item?.arc || 'Unknown',
          Updated: item?.Updated || item?.updated || 'Unknown'
        }
      }
    })
  }

  async function fetchCometSbdb() {
    const data = await fetchJsonWithTimeout(
      'https://ssd-api.jpl.nasa.gov/sbdb_query.api?fields=full_name,pdes,name,prefix,e,a,q,i,om,w,tp_cal,per_y,epoch_cal,H&sb-kind=c',
      'JPL Comets',
      45000
    )
    const rawRows = Array.isArray(data?.data) ? data.data : []

    return rawRows.map((row, index) => {
      const fullName = (row[0] || '').trim()
      const pdes = row[1] || ''
      const cometName = row[2] || ''
      const prefix = row[3] || ''
      const perihelionAu = parseFloat(row[6] ?? Number.NaN)
      const periodYears = parseFloat(row[11] ?? Number.NaN)
      const absMagnitude = parseFloat(row[13] ?? Number.NaN)
      const displayName = fullName || (pdes && cometName ? `${pdes}/${cometName}` : pdes) || `comet-${index}`
      const averageSizeMeters = asteroidEstimateDiameterMeters(absMagnitude)

      return {
        id: `comet-sbdb-${index}-${pdes}`,
        source: 'JPL Comets',
        name: displayName,
        groupKey: normalizeAsteroidName(pdes),
        cometPrefix: prefix || null,
        distanceAU: null,
        riskScore: 0,
        isHazardous: false,
        averageSizeMeters,
        approachDates: [],
        sbdbLookup: pdes || displayName,
        meta: Number.isFinite(perihelionAu)
          ? `Perihelion ${perihelionAu.toFixed(3)} AU`
          : 'Perihelion unknown',
        details: {
          Source: 'JPL Comets (SBDB)',
          'Object name': displayName,
          'Designation': pdes,
          'Common name': cometName || 'None',
          'Comet type': prefix || 'Unknown',
          'Perihelion distance (AU)': Number.isFinite(perihelionAu) ? perihelionAu.toFixed(6) : 'Unknown',
          'Orbital period (years)': Number.isFinite(periodYears) ? periodYears.toFixed(2) : 'Unknown',
          'Absolute magnitude H': Number.isFinite(absMagnitude) ? absMagnitude.toFixed(2) : 'Unknown',
          'Average diameter': asteroidAverageSizeText(averageSizeMeters)
        }
      }
    })
  }

  async function fetchCometCad() {
    const data = await fetchJsonWithTimeout(
      'https://ssd-api.jpl.nasa.gov/cad.api?dist-max=2&sort=dist&body=Earth&comet=true',
      'JPL CAD Comets'
    )
    const rawRows = Array.isArray(data?.data) ? data.data : []

    return rawRows.map((row, index) => {
      const des = row[0] || `comet-cad-${index}`
      const approachDate = row[3] || 'Unknown'
      const distanceAu = parseFloat(row[4] ?? Number.NaN)
      const velocity = parseFloat(row[7] ?? Number.NaN)
      const absMagnitude = parseFloat(row[10] ?? Number.NaN)
      const averageSizeMeters = asteroidEstimateDiameterMeters(absMagnitude)
      const prefixMatch = des.match(/^(?:\d+)?([A-Z])(?:\/|$)/)
      const prefix = prefixMatch ? prefixMatch[1] : null

      return {
        id: `comet-cad-${index}-${des}`,
        source: 'JPL CAD Comets',
        name: des,
        groupKey: normalizeAsteroidName(des),
        cometPrefix: prefix,
        distanceAU: Number.isFinite(distanceAu) ? distanceAu : null,
        riskScore: 0,
        isHazardous: false,
        averageSizeMeters,
        approachDates: [approachDate].filter(d => d !== 'Unknown'),
        sbdbLookup: des,
        meta: Number.isFinite(distanceAu) ? `Dist ${distanceAu.toFixed(5)} AU` : 'Dist unknown',
        details: {
          Source: 'JPL CAD Comets',
          'Object name': des,
          'Comet type': prefix ? `${prefix}/` : 'Unknown',
          'Close approach date': approachDate,
          'Distance (AU)': Number.isFinite(distanceAu) ? distanceAu.toFixed(6) : 'Unknown',
          'Distance (km)': asteroidDistanceKmText(distanceAu),
          'Relative velocity (km/s)': Number.isFinite(velocity) ? velocity.toFixed(3) : 'Unknown',
          'Absolute magnitude H': Number.isFinite(absMagnitude) ? absMagnitude.toFixed(2) : 'Unknown',
          'Average diameter': asteroidAverageSizeText(averageSizeMeters)
        }
      }
    })
  }

  return {
    fetchAsteroidCad,
    fetchAsteroidSentry,
    fetchAsteroidNeoWs,
    fetchAsteroidMpc,
    fetchCometSbdb,
    fetchCometCad
  }
}