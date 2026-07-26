import {
  decimalStats,
  ratingScale,
} from './data.js'

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
    F: 'border-tier-f/30 bg-tier-f/10 text-tier-f',
    E: 'border-tier-e/30 bg-tier-e/10 text-tier-e',
    D: 'border-tier-d/30 bg-tier-d/10 text-tier-d',
    C: 'border-tier-c/30 bg-tier-c/10 text-tier-c',
    B: 'border-tier-b/30 bg-tier-b/10 text-tier-b',
    A: 'border-tier-a/30 bg-tier-a/10 text-tier-a',
    S: 'border-tier-s/30 bg-tier-s/10 text-tier-s',
    SS: 'border-tier-ss/30 bg-tier-ss/10 text-tier-ss',
    SSS: 'border-tier-sss/30 bg-tier-sss/10 text-tier-sss',
  }

  return classes[firstTier] ?? classes.F
}

export function getRollStatusClass(status) {
  const classes = {
    ignored: 'text-muted-foreground',
    upgrade: 'text-success-foreground',
    new: 'text-warning-foreground',
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
    return 'text-warning-foreground'
  }

  return 'text-destructive'
}
