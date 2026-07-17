function parseThreshold(value) {
  const threshold = Number.parseInt(String(value), 10)
  return Number.isFinite(threshold) ? threshold : null
}

function findGuideRow(tierRows, guideRows, currentTierIndex) {
  if (currentTierIndex < 0) {
    return null
  }

  return guideRows.find((guideRow) => {
    const [firstTier, lastTier = firstTier] = String(guideRow.tier).split(/\s+-\s+/)
    const firstIndex = tierRows.findIndex((row) => row.tier === firstTier)
    const lastIndex = tierRows.findIndex((row) => row.tier === lastTier)

    return firstIndex >= 0 && lastIndex >= firstIndex
      && currentTierIndex >= firstIndex
      && currentTierIndex <= lastIndex
  }) ?? null
}

export function getTierGuideDetails({
  tierRows = [],
  guideRows = [],
  currentTier = '',
  currentPercent = null,
} = {}) {
  const currentTierIndex = tierRows.findIndex((row) => row.tier === currentTier)
  const currentTierRow = currentTierIndex >= 0 ? tierRows[currentTierIndex] : null
  const nextTierRow = currentTierIndex >= 0 ? tierRows[currentTierIndex + 1] ?? null : null
  const nextTierThreshold = parseThreshold(nextTierRow?.Penta)
  const numericPercent = Number(currentPercent)
  const pointsToNextTier = nextTierThreshold !== null && Number.isFinite(numericPercent)
    ? Math.max(0, nextTierThreshold - numericPercent)
    : null

  return {
    currentTierIndex,
    currentTierRow,
    currentGuideRow: findGuideRow(tierRows, guideRows, currentTierIndex),
    nextTierRow,
    nextTierThreshold,
    pointsToNextTier,
  }
}

export function formatTierProgressText({
  currentTierRow = null,
  nextTierRow = null,
  nextTierThreshold = null,
  pointsToNextTier = null,
} = {}) {
  if (!currentTierRow) {
    return 'Tier progress unavailable'
  }

  if (!nextTierRow) {
    return 'Highest tier reached'
  }

  if (nextTierThreshold === null) {
    return `Next ${nextTierRow.tier}: threshold unavailable`
  }

  if (pointsToNextTier === null) {
    return `Next ${nextTierRow.tier}: ${nextTierThreshold}%`
  }

  const pointUnit = pointsToNextTier === 1 ? 'pt' : 'pts'
  return `Next ${nextTierRow.tier}: ${nextTierThreshold}% · ${pointsToNextTier} score ${pointUnit}`
}
