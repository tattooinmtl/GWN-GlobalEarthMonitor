// =============================================
// Fireball Trend Module — filters, aggregation, chart
// =============================================

import { Chart } from 'chart.js'

/** Apply sidebar filters to a fireball event array */
export function filterFireballs(events, filters = {}) {
  const now = Date.now()
  let result = events

  // Time range filter
  if (filters.timeRange && filters.timeRange !== 'all') {
    const months = { '6mo': 6, '1y': 12, '5y': 60, '10y': 120 }
    const cutoff = now - (months[filters.timeRange] || 0) * 30.44 * 86400000
    result = result.filter(e => Date.parse(e.date) >= cutoff)
  }

  // Specific year filter
  if (filters.year && filters.year !== 'all') {
    const y = Number(filters.year)
    result = result.filter(e => {
      const d = new Date(e.date)
      return d.getUTCFullYear() === y
    })
  }

  // Specific month filter (1–12)
  if (filters.month && filters.month !== 'all') {
    const m = Number(filters.month) - 1
    result = result.filter(e => new Date(e.date).getUTCMonth() === m)
  }

  // Minimum energy filter
  if (filters.minEnergy && filters.minEnergy !== 'any') {
    const min = parseFloat(filters.minEnergy)
    result = result.filter(e => Number.isFinite(e.impactEnergyKt) && e.impactEnergyKt >= min)
  }

  return result
}

/** Build yearly trend buckets from a list of fireball events */
export function buildFireballTrend(events) {
  const buckets = {}
  let earliest = Infinity
  let latest = -Infinity

  for (const e of events) {
    const ts = Date.parse(e.date)
    if (!Number.isFinite(ts)) continue
    const year = new Date(ts).getUTCFullYear()
    buckets[year] = (buckets[year] || 0) + 1
    if (year < earliest) earliest = year
    if (year > latest) latest = year
  }

  if (!Number.isFinite(earliest) || !Number.isFinite(latest)) {
    return { labels: [], counts: [], avgPerYear: 0, totalInSelection: 0, last12Count: 0 }
  }

  const labels = []
  const counts = []
  for (let y = earliest; y <= latest; y++) {
    labels.push(String(y))
    counts.push(buckets[y] || 0)
  }

  const fullYears = Math.max(1, latest - earliest)
  const totalExcludingCurrent = counts.slice(0, -1).reduce((s, v) => s + v, 0)
  const avgPerYear = Math.round(totalExcludingCurrent / fullYears * 10) / 10

  // Last 12 months count
  const cutoff12 = Date.now() - 365.25 * 86400000
  let last12Count = 0
  for (const e of events) {
    if (Date.parse(e.date) >= cutoff12) last12Count++
  }

  return {
    labels,
    counts,
    avgPerYear,
    totalInSelection: events.length,
    last12Count
  }
}

/** Populate year dropdown from loaded events */
export function populateYearDropdown(events) {
  const select = document.getElementById('fireball-filter-year')
  if (!select) return

  const years = new Set()
  for (const e of events) {
    const ts = Date.parse(e.date)
    if (Number.isFinite(ts)) years.add(new Date(ts).getUTCFullYear())
  }

  const sorted = [...years].sort((a, b) => b - a)
  const existing = select.value
  select.innerHTML = '<option value="all">All years</option>'
  for (const y of sorted) {
    const opt = document.createElement('option')
    opt.value = String(y)
    opt.textContent = String(y)
    select.appendChild(opt)
  }
  if (existing && select.querySelector(`option[value="${existing}"]`)) {
    select.value = existing
  }
}

/** Render the trend bar chart on the given canvas */
export function renderFireballTrend(canvasId, trend) {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return

  const existing = Chart.getChart(canvas)
  if (existing) existing.destroy()

  if (!trend.labels.length) {
    new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: { labels: ['No data'], datasets: [{ data: [0], backgroundColor: 'rgba(139, 148, 158, 0.25)' }] },
      options: {
        animation: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { ticks: { color: '#8b949e' }, grid: { display: false } },
          y: { ticks: { display: false }, grid: { display: false }, beginAtZero: true }
        }
      }
    })
    return
  }

  const avg = trend.avgPerYear
  const barColors = trend.counts.map(c => c > avg ? '#ffb347' : 'rgba(88, 166, 255, 0.65)')

  new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: trend.labels,
      datasets: [{
        data: trend.counts,
        backgroundColor: barColors,
        borderRadius: 2
      }]
    },
    options: {
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            label: ctx => `${ctx.parsed.y} events`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#8b949e',
            maxRotation: 45,
            autoSkip: true,
            maxTicksLimit: 20,
            font: { size: 10 }
          },
          grid: { color: '#21262d' }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#8b949e', font: { size: 10 } },
          grid: { color: '#21262d' }
        }
      }
    }
  })
}

/** Update the trend summary text elements */
export function updateTrendSummary(trend) {
  const avgEl = document.getElementById('fireball-trend-avg')
  const last12El = document.getElementById('fireball-trend-last12')
  const totalEl = document.getElementById('fireball-trend-total')

  if (avgEl) avgEl.textContent = `${trend.avgPerYear}/yr`
  if (last12El) last12El.textContent = String(trend.last12Count)
  if (totalEl) totalEl.textContent = String(trend.totalInSelection)
}

/** Read current filter values from the DOM */
export function readFilters() {
  return {
    timeRange: document.getElementById('fireball-filter-range')?.value || 'all',
    year: document.getElementById('fireball-filter-year')?.value || 'all',
    month: document.getElementById('fireball-filter-month')?.value || 'all',
    minEnergy: document.getElementById('fireball-filter-energy')?.value || 'any'
  }
}
