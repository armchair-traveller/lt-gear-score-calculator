export function parseMaterialCount(value) {
  const normalized = String(value ?? '').trim().replaceAll(',', '')
  if (!normalized) {
    return 0
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseFeeToMillions(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '-') {
    return 0
  }

  const match = text.match(/([\d.]+)\s*([KMBT]?)/i)
  if (!match) {
    return 0
  }

  const amount = Number(match[1])
  const unit = match[2].toUpperCase()
  if (!Number.isFinite(amount)) {
    return 0
  }

  const multipliers = {
    K: 0.001,
    M: 1,
    B: 1000,
    T: 1000000,
  }

  return amount * (multipliers[unit] ?? 1)
}

export function clampInteger(value, min, max) {
  const parsed = Number(String(value ?? '').trim().replaceAll(',', ''))
  if (!Number.isFinite(parsed)) {
    return min
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

export function normalizeUpgradeTargetLevel(value, currentLevel, maxLevel) {
  const normalizedCurrent = clampInteger(
    currentLevel,
    0,
    Math.max(0, maxLevel - 1),
  )

  return clampInteger(value, normalizedCurrent + 1, maxLevel)
}

export function getAvailableUpgradeItems(entries) {
  return entries.filter(item => !item.disabled && item.rows?.length)
}

export function getAscensionRequirement(item, quantity = 1) {
  const match = String(item?.summary?.type ?? '')
    .match(/\+\s*([^+]*?\bAscension Stone)\s*x\s*([\d,]+)/i)

  if (!match) {
    return null
  }

  const perItem = parseMaterialCount(match[2])
  if (!perItem) {
    return null
  }

  const normalizedQuantity = Math.max(1, clampInteger(quantity, 1, 999))

  return {
    name: match[1].trim(),
    perItem,
    total: perItem * normalizedQuantity,
  }
}

export function getUpgradeCatalogGroups(entries) {
  const confirmed = getAvailableUpgradeItems(entries)
  const quarterGroups = new Map()

  for (const item of confirmed) {
    const quarter = item.summary?.quarter || 'Other'
    if (!quarterGroups.has(quarter)) {
      quarterGroups.set(quarter, [])
    }
    quarterGroups.get(quarter).push(item)
  }

  const groups = [...quarterGroups.entries()]
    .sort(([left], [right]) => getQuarterOrder(right) - getQuarterOrder(left))
    .map(([label, items]) => ({
      label,
      items: items.slice().sort((left, right) => left.name.localeCompare(right.name)),
    }))

  const unconfirmed = entries.filter(item => item.disabled || !item.rows?.length)
  if (unconfirmed.length) {
    groups.push({
      label: 'Unconfirmed',
      items: unconfirmed,
    })
  }

  return groups
}

export function calculateUpgradePlan({
  item,
  currentLevel = 0,
  targetLevel,
  quantity = 1,
  ownedMaterials = 0,
} = {}) {
  const rows = item?.rows ?? []
  const maxLevel = rows.length

  if (!maxLevel) {
    return createEmptyUpgradePlan()
  }

  const normalizedCurrent = clampInteger(currentLevel, 0, Math.max(0, maxLevel - 1))
  const normalizedTarget = normalizeUpgradeTargetLevel(
    targetLevel ?? maxLevel,
    normalizedCurrent,
    maxLevel,
  )
  const normalizedQuantity = clampInteger(quantity, 1, 999)
  const normalizedOwned = clampInteger(
    ownedMaterials,
    0,
    Number.MAX_SAFE_INTEGER,
  )
  const rangeRows = rows.slice(normalizedCurrent, normalizedTarget)
  const largestStepMaterial = Math.max(
    ...rangeRows.map(row => parseMaterialCount(row.material) * normalizedQuantity),
    1,
  )

  let runningMaterial = 0
  let runningFeeMillions = 0

  const steps = rangeRows.map((row, index) => {
    const material = parseMaterialCount(row.material) * normalizedQuantity
    const feeMillions = parseFeeToMillions(row.fee) * normalizedQuantity
    runningMaterial += material
    runningFeeMillions += feeMillions

    return {
      ...row,
      level: normalizedCurrent + index + 1,
      material,
      feeMillions,
      runningMaterial,
      runningFeeMillions,
      sourceCumulative: parseMaterialCount(row.cumulative) * normalizedQuantity,
      barPercent: material / largestStepMaterial * 100,
      affordable: normalizedOwned >= runningMaterial,
    }
  })

  const requiredMaterials = runningMaterial
  const requiredFeeMillions = runningFeeMillions
  const affordableStepCount = steps.filter(step => step.affordable).length
  const reachableLevel = normalizedCurrent + affordableStepCount
  const nextStep = steps[affordableStepCount] ?? null
  const remainingMaterials = Math.max(0, requiredMaterials - normalizedOwned)
  const extraMaterials = Math.max(0, normalizedOwned - requiredMaterials)
  const covered = normalizedOwned >= requiredMaterials
  const coveragePercent = requiredMaterials
    ? Math.min(normalizedOwned / requiredMaterials * 100, 100)
    : 100

  return {
    maxLevel,
    currentLevel: normalizedCurrent,
    targetLevel: normalizedTarget,
    quantity: normalizedQuantity,
    ownedMaterials: normalizedOwned,
    steps,
    requiredMaterials,
    requiredFeeMillions,
    remainingMaterials,
    extraMaterials,
    covered,
    coveragePercent,
    reachableLevel,
    nextStep,
    nextStepShortage: nextStep
      ? Math.max(0, nextStep.runningMaterial - normalizedOwned)
      : 0,
    currentCumulative: rows
      .slice(0, normalizedCurrent)
      .reduce((total, row) => total + parseMaterialCount(row.material), 0)
      * normalizedQuantity,
    targetCumulative: rows
      .slice(0, normalizedTarget)
      .reduce((total, row) => total + parseMaterialCount(row.material), 0)
      * normalizedQuantity,
    ascensionRequirement: getAscensionRequirement(item, normalizedQuantity),
  }
}

export function formatUpgradeNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString()
}

export function formatUpgradeFee(millions) {
  const normalized = Number(millions) || 0
  if (!normalized) {
    return 'No fee'
  }

  if (normalized >= 1000000) {
    return `${trimDecimal(normalized / 1000000)}T`
  }
  if (normalized >= 1000) {
    return `${trimDecimal(normalized / 1000)}B`
  }

  return `${trimDecimal(normalized)}M`
}

function getQuarterOrder(value) {
  const parsed = Number(String(value ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(parsed) ? parsed : -1
}

function trimDecimal(value) {
  return Number(value.toFixed(2)).toLocaleString()
}

function createEmptyUpgradePlan() {
  return {
    maxLevel: 0,
    currentLevel: 0,
    targetLevel: 0,
    quantity: 1,
    ownedMaterials: 0,
    steps: [],
    requiredMaterials: 0,
    requiredFeeMillions: 0,
    remainingMaterials: 0,
    extraMaterials: 0,
    covered: false,
    coveragePercent: 0,
    reachableLevel: 0,
    nextStep: null,
    nextStepShortage: 0,
    currentCumulative: 0,
    targetCumulative: 0,
    ascensionRequirement: null,
  }
}
