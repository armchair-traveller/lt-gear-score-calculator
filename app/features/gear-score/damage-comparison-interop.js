export const GEAR_COMPARISON_KIND = 'lt-gear-comparison'
export const GEAR_COMPARISON_VERSION = 1
export const GEAR_COMPARISON_SOURCE = 'lt-gear-score-calculator'
export const GEAR_COMPARISON_FRAGMENT_KEY = 'ltgear'
export const MAX_GEAR_COMPARISON_FRAGMENT_LENGTH = 16 * 1024

const maxCandidateIdLength = 120
const maxMetadataStringLength = 200
const maxOmittedLines = 20
const damageStatKeys = new Set([
  'strength',
  'attack',
  'critical',
  'minimum',
  'maximum',
  'static',
  'normalAdded',
  'bossAdded',
  'normalAmp',
  'bossAmp',
  'ratio',
  'back',
  'melee',
  'abnormal',
])
const percentlessStatKeys = new Set([
  'normalAmp',
  'bossAmp',
  'ratio',
  'back',
  'melee',
  'abnormal',
])

const gearStatTargets = {
  'Basic Stats': [['strength', 0]],
  'Strength/Magic': [['strength', 0]],
  'Only Strength/Magic': [['strength', 0]],
  'Basic Stats %': [['strength', 1]],
  'Strength/Magic %': [['strength', 1]],
  'Attack/Intensity': [['attack', 0]],
  'Attack/Intensity %': [['attack', 1]],
  'Critical Damage': [['critical', 0]],
  'Minimum Damage': [['minimum', 0]],
  'Maximum Damage': [['maximum', 0]],
  'Static Damage': [['static', 0]],
  'Static Damage %': [['static', 1]],
  'Normal Added': [['normalAdded', 0]],
  'Normal Added Damage': [['normalAdded', 0]],
  'Normal Added %': [['normalAdded', 1]],
  'Boss Added': [['bossAdded', 0]],
  'Boss Added Damage': [['bossAdded', 0]],
  'Boss Added %': [['bossAdded', 1]],
  'Normal Amplification': [['normalAmp', 0]],
  'Boss Amplification': [['bossAmp', 0]],
  'Back Attack Damage': [['back', 0]],
  'Dual Damage': [['minimum', 0], ['maximum', 0]],
}

function getNumericLineValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return 0
  }

  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

function addChange(changes, statKey, valueIndex, value) {
  const slots = changes[statKey] ?? [0, 0]
  slots[valueIndex] += value
  changes[statKey] = slots
}

function getEnchantLevel(value) {
  if (
    (typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && value.trim() === '')
  ) {
    return null
  }

  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 99 ? number : null
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBoundedString(value, maxLength = maxMetadataStringLength) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidChanges(value) {
  if (!isRecord(value)) {
    return false
  }

  const entries = Object.entries(value)
  return entries.length > 0 && entries.every(([statKey, pair]) =>
    damageStatKeys.has(statKey)
    && Array.isArray(pair)
    && pair.length === 2
    && pair.every(component => isFiniteNumber(component) && component >= 0)
    && pair.some(component => component > 0)
    && (!percentlessStatKeys.has(statKey) || pair[1] === 0),
  )
}

function isValidItem(value) {
  if (
    !isRecord(value)
    || !isBoundedString(value.gearType)
    || !isBoundedString(value.pieceType)
  ) {
    return false
  }

  return value.enchantLevel === undefined || (
    Number.isInteger(value.enchantLevel)
    && value.enchantLevel >= 0
    && value.enchantLevel <= 99
  )
}

function isValidOmittedLines(value) {
  return Array.isArray(value)
    && value.length <= maxOmittedLines
    && value.every(entry =>
      isRecord(entry)
      && isBoundedString(entry.stat)
      && isFiniteNumber(entry.value)
      && entry.value > 0,
    )
}

function isValidCandidate(value) {
  return isRecord(value)
    && value.id === 'current'
    && isBoundedString(value.id, maxCandidateIdLength)
    && isBoundedString(value.label)
    && isValidItem(value.item)
    && isValidChanges(value.changes)
    && isValidOmittedLines(value.omitted)
}

function isValidGearComparisonPayload(value) {
  return isRecord(value)
    && value.kind === GEAR_COMPARISON_KIND
    && value.version === GEAR_COMPARISON_VERSION
    && value.source === GEAR_COMPARISON_SOURCE
    && Array.isArray(value.candidates)
    && value.candidates.length === 1
    && isValidCandidate(value.candidates[0])
}

export function mapGearLinesToDamageChanges(statTypes = [], statInputs = []) {
  const changes = {}
  const omitted = []

  statTypes.forEach((stat, index) => {
    const value = getNumericLineValue(statInputs[index])
    if (value === 0) {
      return
    }

    const targets = Object.hasOwn(gearStatTargets, stat) ? gearStatTargets[stat] : null
    if (!targets) {
      omitted.push({ stat, value })
      return
    }

    targets.forEach(([statKey, valueIndex]) => {
      addChange(changes, statKey, valueIndex, value)
    })
  })

  return { changes, omitted }
}

export function createGearComparisonPayload({
  gearType,
  pieceType,
  enchantLevel,
  statTypes = [],
  statInputs = [],
  label,
}) {
  const item = {
    gearType: String(gearType ?? ''),
    pieceType: String(pieceType ?? ''),
  }
  const numericEnchantLevel = getEnchantLevel(enchantLevel)

  if (numericEnchantLevel !== null) {
    item.enchantLevel = numericEnchantLevel
  }

  const { changes, omitted } = mapGearLinesToDamageChanges(statTypes, statInputs)
  const candidateLabel = label === undefined
    ? `${item.gearType} · ${item.pieceType}`
    : String(label)

  return {
    kind: GEAR_COMPARISON_KIND,
    version: GEAR_COMPARISON_VERSION,
    source: GEAR_COMPARISON_SOURCE,
    candidates: [{
      id: 'current',
      label: candidateLabel,
      item,
      changes,
      omitted,
    }],
  }
}

export function serializeGearComparisonPayload(payload) {
  return JSON.stringify(payload)
}

export function buildGearComparisonFragment(payload) {
  const params = new URLSearchParams({
    [GEAR_COMPARISON_FRAGMENT_KEY]: serializeGearComparisonPayload(payload),
  })

  return `#${params.toString()}`
}

export function parseGearComparisonFragment(value) {
  try {
    const text = String(value ?? '')
    const hashIndex = text.indexOf('#')
    const fragment = hashIndex >= 0 ? text.slice(hashIndex + 1) : text.replace(/^#/, '')
    if (fragment.length === 0 || fragment.length > MAX_GEAR_COMPARISON_FRAGMENT_LENGTH) {
      return null
    }

    const serializedValues = new URLSearchParams(fragment).getAll(GEAR_COMPARISON_FRAGMENT_KEY)
    if (
      serializedValues.length !== 1
      || serializedValues[0].length > MAX_GEAR_COMPARISON_FRAGMENT_LENGTH
    ) {
      return null
    }

    const payload = JSON.parse(serializedValues[0])
    return isValidGearComparisonPayload(payload) ? payload : null
  }
  catch {
    return null
  }
}

export function buildGearComparisonUrl(destination, payload) {
  const url = destination instanceof URL ? new URL(destination) : new URL(String(destination))
  url.hash = buildGearComparisonFragment(payload).slice(1)
  return url.toString()
}
