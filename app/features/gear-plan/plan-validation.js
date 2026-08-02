import gears from '../../utils/gear.js'
import {
  gearPlanSlots,
  getGearPlanSlot,
  getGearPlanSlotId,
} from './data.js'
import {
  getFinalStatValue,
  isStatValueOverMax,
  normalizeStatValue,
} from '../gear-score/score-calculation.js'

export const gearPlanVersion = 1
export const gearPlanValidationCode = 'GEAR_PLAN_INVALID'
export const gearPlanValidationMessage = 'This planner data is invalid or no longer supported.'

export class GearPlanValidationError extends Error {
  constructor() {
    super(gearPlanValidationMessage)
    this.name = 'GearPlanValidationError'
    this.code = gearPlanValidationCode
  }
}

export function createEmptyGearPlan() {
  return {
    version: gearPlanVersion,
    slots: {},
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function rejectInvalidPlan() {
  throw new GearPlanValidationError()
}

function parseGearPlanEntry(entry) {
  if (!isRecord(entry)) {
    rejectInvalidPlan()
  }

  const slot = getGearPlanSlot(entry.gearType, entry.pieceType)
  const item = gears[entry.gearType]?.[entry.pieceType]
  if (
    !slot
    || !item
    || !Array.isArray(entry.statType)
    || !Array.isArray(entry.statInput)
    || entry.statType.length !== 5
    || entry.statInput.length !== 5
  ) {
    rejectInvalidPlan()
  }

  const usedStats = new Set()
  let filledLineCount = 0
  const statType = []
  const statInput = []

  for (let index = 0; index < 5; index++) {
    const stat = entry.statType[index]
    const value = entry.statInput[index]
    const statInfo = typeof stat === 'string' ? item.Stats[stat] : undefined
    const canRepeat = stat === 'Other (Non-damaging)'

    if (
      !statInfo
      || (!canRepeat && usedStats.has(stat))
      || typeof value !== 'number'
      || !Number.isFinite(value)
      || value < 0
      || isStatValueOverMax(
        statInfo,
        value,
        getFinalStatValue(statInfo, slot.upgradeCount),
      )
    ) {
      rejectInvalidPlan()
    }

    const normalizedValue = normalizeStatValue(statInfo, value)
    statType.push(stat)
    statInput.push(normalizedValue)

    if (normalizedValue > 0) {
      filledLineCount += 1
    }
    if (!canRepeat) {
      usedStats.add(stat)
    }
  }

  if (filledLineCount < 3) {
    rejectInvalidPlan()
  }

  return {
    gearType: entry.gearType,
    pieceType: entry.pieceType,
    statType,
    statInput,
  }
}

export function parseGearPlanStrict(value) {
  if (
    !isRecord(value)
    || value.version !== gearPlanVersion
    || !isRecord(value.slots)
  ) {
    rejectInvalidPlan()
  }

  const entries = Object.entries(value.slots)
  if (entries.length > gearPlanSlots.length) {
    rejectInvalidPlan()
  }

  const plan = createEmptyGearPlan()
  for (const [slotId, rawEntry] of entries) {
    const entry = parseGearPlanEntry(rawEntry)
    const canonicalSlotId = getGearPlanSlotId(entry.gearType, entry.pieceType)
    if (slotId !== canonicalSlotId || plan.slots[canonicalSlotId]) {
      rejectInvalidPlan()
    }

    plan.slots[canonicalSlotId] = entry
  }

  return plan
}

export function validateGearPlan(value) {
  try {
    return {
      plan: parseGearPlanStrict(value),
      error: '',
    }
  }
  catch (error) {
    if (!(error instanceof GearPlanValidationError)) {
      throw error
    }

    return {
      plan: null,
      error: gearPlanValidationMessage,
    }
  }
}
