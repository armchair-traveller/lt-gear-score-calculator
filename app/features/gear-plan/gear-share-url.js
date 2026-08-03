import {
  encodeShareState,
  getShareParams,
} from '../gear-score/share-url.js'
import { sanitizeGearPlanEntry } from './plan-state.js'

const finalEnchantLevelByGearType = new Map([
  ['[sLv5] Accessories', 5],
  ['[9999] Armor', 5],
  ['[9000] Accessories', 4],
  ['[8000] Weapons', 4],
])

export function getGearPlanEntryCalculatorPath(entryOrSlot) {
  const rawEntry = getEntry(entryOrSlot)
  const entry = sanitizeGearPlanEntry(rawEntry)
  if (!entry) {
    return null
  }

  const itemString = encodeShareState(entry)
  const enchantLevel = finalEnchantLevelByGearType.get(entry.gearType)
  const params = getShareParams({
    itemString,
    enchantLevel,
    includeEnchantLevel: Number.isInteger(enchantLevel),
  })

  return `/?${params.toString()}`
}

function getEntry(value) {
  if (
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.hasOwn(value, 'entry')
  ) {
    return value.entry
  }

  return value
}
