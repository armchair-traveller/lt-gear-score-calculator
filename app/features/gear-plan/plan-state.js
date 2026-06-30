import gears from '@/utils/gear.js'
import {
  gearPlanShareVersion,
  gearPlanSlots,
  gearPlanStorageKey,
  getGearPlanSlot,
  getGearPlanSlotId,
} from '@/features/gear-plan/data.js'
import {
  encodeShareState,
  parseShareState,
} from '@/features/gear-score/share-url.js'
import {
  getFinalStatValue,
  isStatValueOverMax,
  normalizeStatValue,
} from '@/features/gear-score/score-calculation.js'

export function createEmptyGearPlan() {
  return {
    version: 1,
    slots: {},
  }
}

export function readStoredGearPlan() {
  try {
    const value = localStorage.getItem(gearPlanStorageKey)
    return value ? sanitizeGearPlan(JSON.parse(value)) : createEmptyGearPlan()
  }
  catch (error) {
    console.error(error)
    return createEmptyGearPlan()
  }
}

export function writeStoredGearPlan(plan) {
  const sanitized = sanitizeGearPlan(plan)
  localStorage.setItem(gearPlanStorageKey, JSON.stringify(sanitized))
  return sanitized
}

export function saveStoredGearPlanEntry(entry) {
  const sanitizedEntry = sanitizeGearPlanEntry(entry)
  if (!sanitizedEntry) {
    return false
  }

  const plan = readStoredGearPlan()
  plan.slots[getGearPlanSlotId(sanitizedEntry.gearType, sanitizedEntry.pieceType)] = sanitizedEntry
  writeStoredGearPlan(plan)
  return true
}

export function projectGearPlanEntry({
  gearType,
  pieceType,
  statType,
  statInput,
  currentUpgradeCount,
}) {
  const slot = getGearPlanSlot(gearType, pieceType)
  const item = gears[gearType]?.[pieceType]
  if (!slot || !item) {
    return null
  }

  const remainingUpgrades = Math.max(0, slot.upgradeCount - currentUpgradeCount)
  return sanitizeGearPlanEntry({
    gearType,
    pieceType,
    statType,
    statInput: statType.map((stat, index) => {
      const statInfo = item.Stats[stat]
      const value = Number(statInput[index])
      return Number.isFinite(value) && value > 0
        ? normalizeStatValue(statInfo, value + (statInfo?.Potential?.[1] ?? 0) * remainingUpgrades)
        : 0
    }),
  })
}

export function sanitizeGearPlan(value) {
  const plan = createEmptyGearPlan()

  if (!value || typeof value !== 'object' || value.version !== 1 || !value.slots || typeof value.slots !== 'object') {
    return plan
  }

  for (const entry of Object.values(value.slots)) {
    const sanitizedEntry = sanitizeGearPlanEntry(entry)
    if (!sanitizedEntry) {
      continue
    }

    plan.slots[getGearPlanSlotId(sanitizedEntry.gearType, sanitizedEntry.pieceType)] = sanitizedEntry
  }

  return plan
}

export function sanitizeGearPlanEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    return null
  }

  const slot = getGearPlanSlot(entry.gearType, entry.pieceType)
  const item = gears[entry.gearType]?.[entry.pieceType]
  if (!slot || !item || !Array.isArray(entry.statType) || !Array.isArray(entry.statInput)) {
    return null
  }

  const statType = entry.statType.slice(0, 5)
  const statInput = entry.statInput.slice(0, 5).map((value) => Number(value))
  if (statType.length !== 5 || statInput.length !== 5) {
    return null
  }

  const usedStats = new Set()
  let filledLineCount = 0
  const normalizedStatInput = []
  for (let index = 0; index < 5; index++) {
    const stat = statType[index]
    const statInfo = item.Stats[stat]
    const value = statInput[index]
    const canRepeat = stat === 'Other (Non-damaging)'
    const maxValue = getFinalStatValue(statInfo, slot.upgradeCount)

    if (
      !statInfo ||
      (!canRepeat && usedStats.has(stat)) ||
      !Number.isFinite(value) ||
      value < 0 ||
      isStatValueOverMax(statInfo, value, maxValue)
    ) {
      return null
    }

    const normalizedValue = normalizeStatValue(statInfo, value)
    normalizedStatInput[index] = normalizedValue

    if (normalizedValue > 0) {
      filledLineCount += 1
    }

    if (!canRepeat) {
      usedStats.add(stat)
    }
  }

  if (filledLineCount < 3) {
    return null
  }

  return {
    gearType: entry.gearType,
    pieceType: entry.pieceType,
    statType,
    statInput: normalizedStatInput,
  }
}

export function encodeGearPlanShare(plan) {
  const sanitized = sanitizeGearPlan(plan)
  const entries = gearPlanSlots.flatMap((slot) => {
    const entry = sanitized.slots[getGearPlanSlotId(slot.gearType, slot.pieceType)]
    return entry ? [encodeShareState(entry)] : []
  })

  return `${gearPlanShareVersion}.${entries.join('.')}`
}

export function parseGearPlanShare(value) {
  try {
    const [version, ...encodedEntries] = String(value ?? '').split('.')
    if (version !== gearPlanShareVersion || !encodedEntries.length) {
      throw new Error('Invalid plan version or empty plan')
    }

    const plan = createEmptyGearPlan()
    const seenSlots = new Set()

    for (const encodedEntry of encodedEntries) {
      const parsed = parseShareState(encodedEntry)
      const slotId = getGearPlanSlotId(parsed.gearName, parsed.pieceName)
      if (seenSlots.has(slotId)) {
        throw new Error('Duplicate plan slot')
      }

      const entry = sanitizeGearPlanEntry({
        gearType: parsed.gearName,
        pieceType: parsed.pieceName,
        statType: parsed.statNames,
        statInput: parsed.statValues,
      })
      if (!entry) {
        throw new Error('Invalid plan entry')
      }

      seenSlots.add(slotId)
      plan.slots[slotId] = entry
    }

    return {
      plan,
      error: '',
    }
  }
  catch (error) {
    return {
      plan: null,
      error: 'This shared planner link is invalid or no longer supported.',
    }
  }
}
