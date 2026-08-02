import gears from '../../utils/gear.js'
import {
  gearPlanDeviceMetaStorageKey,
  gearPlanShareVersion,
  gearPlanSlots,
  gearPlanStorageKey,
  getGearPlanSlot,
  getGearPlanSlotId,
} from './data.js'
import {
  encodeShareState,
  parseShareState,
} from '../gear-score/share-url.js'
import {
  normalizeStatValue,
} from '../gear-score/score-calculation.js'
import {
  createEmptyGearPlan,
  parseGearPlanStrict,
} from './plan-validation.js'

export { createEmptyGearPlan }

export function readStoredGearPlan(storage = globalThis.localStorage) {
  try {
    if (!storage) {
      return createEmptyGearPlan()
    }

    const value = storage.getItem(gearPlanStorageKey)
    return value ? sanitizeGearPlan(JSON.parse(value)) : createEmptyGearPlan()
  }
  catch {
    console.error('[gear-plan-storage] plan_read_failed')
    return createEmptyGearPlan()
  }
}

export function writeStoredGearPlan(plan, storage = globalThis.localStorage) {
  const canonicalPlan = parseGearPlanStrict(plan)
  storage.setItem(gearPlanStorageKey, JSON.stringify(canonicalPlan))
  return canonicalPlan
}

export function normalizeGearPlanUpdatedAt(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const timestamp = new Date(value)
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null
}

export function readStoredGearPlanDeviceMeta(storage = globalThis.localStorage) {
  try {
    if (!storage) {
      return { updatedAt: null, ownerId: null }
    }

    const value = storage.getItem(gearPlanDeviceMetaStorageKey)
    if (!value) {
      return { updatedAt: null, ownerId: null }
    }

    const parsed = JSON.parse(value)
    return {
      updatedAt: normalizeGearPlanUpdatedAt(parsed?.updatedAt),
      ownerId: typeof parsed?.ownerId === 'string' && parsed.ownerId.trim()
        ? parsed.ownerId.trim()
        : null,
    }
  }
  catch {
    console.error('[gear-plan-storage] metadata_read_failed')
    return { updatedAt: null, ownerId: null }
  }
}

export function writeStoredGearPlanDeviceMeta(
  metadata,
  storage = globalThis.localStorage,
) {
  const canonicalMetadata = {
    updatedAt: normalizeGearPlanUpdatedAt(metadata?.updatedAt),
    ownerId: typeof metadata?.ownerId === 'string' && metadata.ownerId.trim()
      ? metadata.ownerId.trim()
      : null,
  }
  storage.setItem(gearPlanDeviceMetaStorageKey, JSON.stringify(canonicalMetadata))
  return canonicalMetadata
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
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || value.version !== 1
    || !value.slots
    || typeof value.slots !== 'object'
    || Array.isArray(value.slots)
  ) {
    return plan
  }

  for (const entry of Object.values(value.slots)) {
    const canonicalEntry = sanitizeGearPlanEntry(entry)
    if (!canonicalEntry) {
      continue
    }

    const slotId = getGearPlanSlotId(
      canonicalEntry.gearType,
      canonicalEntry.pieceType,
    )
    if (!plan.slots[slotId]) {
      plan.slots[slotId] = canonicalEntry
    }
  }

  return plan
}

export function sanitizeGearPlanEntry(entry) {
  try {
    const slotId = getGearPlanSlotId(entry?.gearType, entry?.pieceType)
    const plan = parseGearPlanStrict({
      version: 1,
      slots: { [slotId]: entry },
    })
    return plan.slots[slotId] ?? null
  }
  catch {
    return null
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
