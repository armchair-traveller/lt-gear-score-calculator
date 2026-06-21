import {
  decimalStats,
  ratingScale,
} from '@/features/gear-score/data.js'

export function createEmptyIndividualResult() {
  return {
    DI: '',
    percent: '',
    tier: '',
    potentialMin: '',
    potentialMax: '',
    potentialMinPerc: '',
    potentialMaxPerc: '',
    potentialDIMin: '',
    potentialDIMax: '',
    potentialTierMin: '',
    potentialTierMax: '',
  }
}

export function getTierForPercent(percent, tierEquivalence, tierAvailable) {
  let tier = 'F'
  tierAvailable.forEach((entry) => {
    if (parseInt(percent) >= parseInt(tierEquivalence[entry].Penta)) {
      tier = entry
    }
  })

  return tier
}

export function formatStatValue(value, stat) {
  if (!Number.isFinite(value)) {
    return '0'
  }

  if (decimalStats.includes(stat)) {
    return value.toFixed(1)
  }

  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1).replace(/\.0$/, '')
}

export function formatRange(minValue, maxValue, stat) {
  const minText = formatStatValue(minValue, stat)
  const maxText = formatStatValue(maxValue, stat)

  return minText === maxText ? minText : `${minText} ~ ${maxText}`
}

export function formatProbability(probability) {
  if (probability <= 0) {
    return '0%'
  }

  const percent = probability * 100
  if (percent >= 10) {
    return percent.toFixed(1) + '%'
  }
  if (percent >= 1) {
    return percent.toFixed(2) + '%'
  }
  if (percent >= 0.01) {
    return percent.toFixed(3) + '%'
  }

  return percent.toFixed(4) + '%'
}

export function formatBaseRollSummary(methods, alreadyComplete = false) {
  if (alreadyComplete) {
    return 'None needed'
  }

  if (!methods.length) {
    return 'None'
  }

  const counts = new Map()
  methods.forEach((method) => {
    counts.set(method.successRate, (counts.get(method.successRate) || 0) + 1)
  })

  const groups = Array.from(counts, ([successRate, count]) =>
    `${count} at ${successRate * 100}%`,
  )

  return `Up to ${groups.join(' · ')}`
}

export function getRollDistribution(minRoll, maxRoll, step, maxValue, maxDI) {
  const buckets = new Map()
  const rollCount = Math.max(1, Math.round((maxRoll - minRoll) / step) + 1)

  for (let i = 0; i < rollCount; i++) {
    const rollValue = Math.min(maxRoll, minRoll + (i * step))
    const rating = rollValue / maxValue * maxDI
    const score = Math.round(rating * ratingScale)
    buckets.set(score, (buckets.get(score) || 0) + 1)
  }

  return Array.from(buckets, ([score, count]) => ({
    score,
    probability: count / rollCount,
  }))
}

export function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

export function getFirstPercent(text) {
  const value = parseFloat(String(text).split(' ~ ')[0])
  return Number.isFinite(value) ? value : 0
}

export function formatGainRangeWithPrecision(text, baseValue, decimals) {
  const values = String(text)
    .replaceAll('%', '')
    .split(' ~ ')
    .map((value) => parseFloat(value))
    .filter((value) => Number.isFinite(value))

  if (!values.length || !Number.isFinite(baseValue)) {
    return '+0%'
  }

  const gains = values.map((value) => value - baseValue)
  const formatted = gains.map((value) => `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`)
  return formatted.length === 1 ? formatted[0] : formatted.join(' ~ ')
}

export function getTierClass(tier) {
  const firstTier = String(tier).split(' ')[0]
  const classes = {
    F: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
    E: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300',
    D: 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
    C: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    B: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    A: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    S: 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950 dark:text-fuchsia-300',
    SS: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    SSS: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  }

  return classes[firstTier] ?? classes.F
}

export function getRollStatusClass(status) {
  const classes = {
    ignored: 'text-muted-foreground',
    upgrade: 'text-emerald-700 dark:text-emerald-300',
    new: 'text-amber-700 dark:text-amber-300',
  }

  return classes[status] ?? ''
}

export function formatMaxRollPercent(percent) {
  return Number.isFinite(percent) ? `${Math.floor(percent)}%` : ''
}

export function getMaxRollPercentClass(percent) {
  if (!Number.isFinite(percent)) {
    return ''
  }
  if (percent > 100) {
    return 'text-destructive'
  }
  if (percent < 70) {
    return 'text-muted-foreground'
  }
  if (percent < 90) {
    return 'text-amber-600 dark:text-amber-300'
  }

  return 'text-red-600 dark:text-red-400'
}
