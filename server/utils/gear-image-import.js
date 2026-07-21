const excludedGearCategories = new Set(['[5000] Accessories', '[4000] Weapon'])
const inputEnchantGearTypes = new Set([
  '[sLv5] Accessories',
  '[9999] Armor',
  '[9000] Accessories',
  '[8000] Weapons',
])
const otherStat = 'Other (Non-damaging)'
const healthStats = ['Stamina', 'Maximum HP %', 'Maximum HP']

const statAliases = new Map([
  ['attack elemental intensity', 'Attack/Intensity'],
  ['attack element intensity', 'Attack/Intensity'],
  ['attack intensity', 'Attack/Intensity'],
  ['elemental intensity', 'Attack/Intensity'],
  ['element intensity', 'Attack/Intensity'],
  ['atk elemental intensity', 'Attack/Intensity'],
  ['atk intensity', 'Attack/Intensity'],
  ['attack elemental intensity percent', 'Attack/Intensity %'],
  ['attack intensity percent', 'Attack/Intensity %'],
  ['elemental intensity percent', 'Attack/Intensity %'],
  ['normal damage amplification', 'Normal Amplification'],
  ['normal dmg amplification', 'Normal Amplification'],
  ['normal amplification', 'Normal Amplification'],
  ['boss damage amplification', 'Boss Amplification'],
  ['boss dmg amplification', 'Boss Amplification'],
  ['boss amplification', 'Boss Amplification'],
  ['dual critical damage', 'Critical Damage'],
  ['critical damage', 'Critical Damage'],
  ['crit damage', 'Critical Damage'],
  ['dual accuracy', 'Accuracy'],
  ['accuracy', 'Accuracy'],
  ['dual damage', 'Dual Damage'],
  ['max damage', 'Maximum Damage'],
  ['maximum damage', 'Maximum Damage'],
  ['min damage', 'Minimum Damage'],
  ['minimum damage', 'Minimum Damage'],
  ['back attack damage', 'Back Attack Damage'],
  ['basic stat', 'Basic Stats'],
  ['basic stats', 'Basic Stats'],
  ['basic stat percent', 'Basic Stats %'],
  ['basic stats percent', 'Basic Stats %'],
  ['strength magic', 'Strength/Magic'],
  ['str magic', 'Strength/Magic'],
  ['strength magic percent', 'Strength/Magic %'],
  ['str magic percent', 'Strength/Magic %'],
  ['boss added damage', 'Boss Added Damage'],
  ['normal added damage', 'Normal Added Damage'],
  ['static damage percent', 'Static Damage %'],
  ['static damage', 'Static Damage'],
  ['defense penetration', 'Defense Penetration'],
  ['movement speed', 'Movement Speed'],
  ['move speed', 'Movement Speed'],
  ['speed', 'Movement Speed'],
  ['cooldown reduction', 'Cooldown Reduction'],
  ['maximum hp percent', 'Maximum HP %'],
  ['max hp percent', 'Maximum HP %'],
  ['maximum hp', 'Maximum HP'],
  ['max hp', 'Maximum HP'],
  ['stamina', 'Stamina'],
])

const nonOffensivePatterns = [
  'defense',
  'static defense',
  'physical defense',
  'magic defense',
  'mitigation',
  'resistance',
  'evasion',
  'guard',
  'shield',
  'item drop',
  'ely',
  'exp',
  'skill level',
  'novice skill',
  'awakening',
]

export function getExtractorPrompt() {
  return [
    'Extract LaTale gear enchant option lines from the image.',
    'Return only visible enchant option lines, usually formatted like "Lv. 5 Stat Name +123 [74%]".',
    'Read every value character literally. A percent sign immediately after a value is a unit, not the digit 8: "+9%" must never become "+98".',
    'Keep every digit in large values, including repeated or trailing digits in five-digit values such as "+24011".',
    'The percentage in square brackets is a separate roll percentage; never merge it into the stat value.',
    'Ignore base item stats, durability, enchant limit, seals, awakening lines, titles, and unrelated UI text.',
    'If the full equipment tooltip is visible, infer the gear category and piece from title, required level, and piece wording.',
    'Use the provided fallback gear category and piece only when the screenshot does not show the equipment identity.',
    'Use exactly one of the allowed gear categories and piece names from the request context.',
    'If a visible "Class:" line appears in the equipment details, classify the item as [8000] Weapons / Weapon.',
    'Keep the raw visible stat wording in statText even when translated differently.',
    'Put only the stat name in statText; do not include the level, +value, or [roll%].',
    'For unenchanted placeholder lines like "Lv. 1 Strength / Magic +1", set ignored true with ignoreReason "Unenchanted placeholder".',
    'For all other enchant lines, set ignored false.',
  ].join('\n')
}

export function getRequestContext(fallbackGearType, fallbackPieceType, gearCatalog) {
  return JSON.stringify({
    fallbackGearType,
    fallbackPieceType,
    allowedGear: getGearCategories(gearCatalog).map((gearType) => ({
      gearType,
      pieces: getPieceNames(gearType, gearCatalog),
    })),
  })
}

export function getExtractorSchema(gearCatalog) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['gearType', 'pieceType', 'confidence', 'lines'],
    properties: {
      gearType: {
        type: 'string',
        enum: getGearCategories(gearCatalog),
      },
      pieceType: {
        type: 'string',
        enum: getAllPieceNames(gearCatalog),
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
      },
      lines: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['rawText', 'level', 'statText', 'value', 'rollPercent', 'ignored', 'ignoreReason'],
          properties: {
            rawText: {
              type: 'string',
            },
            level: {
              type: 'integer',
              minimum: 0,
              maximum: 5,
            },
            statText: {
              type: 'string',
            },
            value: {
              type: 'number',
            },
            rollPercent: {
              type: 'number',
              minimum: 0,
              maximum: 100,
            },
            ignored: {
              type: 'boolean',
            },
            ignoreReason: {
              type: 'string',
            },
          },
        },
      },
    },
  }
}

export function normalizeExtraction(extracted, fallbackGearType, fallbackPieceType, gearCatalog) {
  const { gearType, pieceType } = resolveExtractionEquipment(
    extracted,
    fallbackGearType,
    fallbackPieceType,
    gearCatalog,
  )
  const item = gearCatalog?.[gearType]?.[pieceType]
  const lines = (Array.isArray(extracted?.lines) ? extracted.lines : [])
    .slice(0, 5)
    .map((line, index) => normalizeLine(line, item, gearType, index))
  const activeLines = lines.filter((line) => !line.ignored)
  const readyLines = activeLines.filter((line) => line.status !== 'needs_review')
  const validationConfidence = activeLines.length ? readyLines.length / activeLines.length : 0

  return {
    gearType,
    pieceType,
    confidence: Math.min(clampNumber(extracted?.confidence, 0, 1), validationConfidence),
    inputEnchantLevel: getImportEnchantLevel(lines),
    lines,
  }
}

export function getValidGearType(gearType, gearCatalog) {
  return getGearCategories(gearCatalog).includes(gearType) ? gearType : ''
}

export function getValidPieceType(gearType, pieceType, gearCatalog) {
  return getPieceNames(gearType, gearCatalog).includes(pieceType) ? pieceType : ''
}

export function getPieceNames(gearType, gearCatalog) {
  return Object.keys(gearCatalog?.[gearType] || {}).filter((key) => !['Sheet Link', 'Potential'].includes(key))
}

export function getLineMaxValue(statInfo, gearType, level) {
  if (!statInfo) {
    return 0
  }

  const baseValue = normalizeNumber(statInfo.Value)
  if (!inputEnchantGearTypes.has(gearType)) {
    return normalizeStatPrecision(statInfo, baseValue)
  }

  const numericLevel = parseInt(level)
  const maxLevel = getMaxEnchantLevel(gearType)
  if (!Number.isFinite(numericLevel) || numericLevel < 2 || numericLevel > maxLevel) {
    return 0
  }

  const potential = normalizeNumber(statInfo.Potential?.[1])
  return normalizeStatPrecision(statInfo, baseValue + potential * (numericLevel - 2))
}

export function getDisplayedRollPercent(value, maxValue) {
  const numericValue = Number(value)
  const numericMax = Number(maxValue)
  if (!Number.isFinite(numericValue) || !Number.isFinite(numericMax) || numericValue <= 0 || numericMax <= 0) {
    return null
  }

  return Math.floor(numericValue / numericMax * 100 + Number.EPSILON)
}

function resolveExtractionEquipment(extracted, fallbackGearType, fallbackPieceType, gearCatalog) {
  const extractedGearType = getValidGearType(extracted?.gearType, gearCatalog)
  const validFallbackGearType = getValidGearType(fallbackGearType, gearCatalog) || '[9999] Armor'
  const fallbackPieceForFallbackGear =
    getValidPieceType(validFallbackGearType, fallbackPieceType, gearCatalog)
    || getPieceNames(validFallbackGearType, gearCatalog)[0]

  if (!extractedGearType) {
    return {
      gearType: validFallbackGearType,
      pieceType: fallbackPieceForFallbackGear,
    }
  }

  const extractedPieceType = getValidPieceType(extractedGearType, extracted?.pieceType, gearCatalog)
  if (extractedPieceType) {
    return {
      gearType: extractedGearType,
      pieceType: extractedPieceType,
    }
  }

  return {
    gearType: extractedGearType,
    pieceType:
      extractedGearType === validFallbackGearType
        ? fallbackPieceForFallbackGear
        : getPieceNames(extractedGearType, gearCatalog)[0],
  }
}

function normalizeLine(line, item, gearType, index) {
  const rawText = String(line?.rawText || '').trim()
  const detectedStat = String(line?.statText || '').trim()
  const extractedValue = normalizeNumber(line?.value)
  const rollPercent = normalizeNumber(line?.rollPercent)
  const level = Math.max(0, Math.min(5, parseInt(line?.level) || 0))
  const unenchantedPlaceholder = level <= 1 && (extractedValue <= 1 || rollPercent === 1)
  const ignored = Boolean(line?.ignored) || unenchantedPlaceholder
  const reconciled = reconcileStatAndValue({
    detectedStat,
    rawText,
    extractedValue,
    rollPercent,
    level,
    item,
    gearType,
    ignored,
  })
  const stat = reconciled.stat
  const validStat = stat && item?.Stats?.[stat]
  const finalValue = stat === otherStat ? 1 : reconciled.value
  const status = ignored
    ? 'ignored'
    : validStat && finalValue > 0 && reconciled.rollStatus !== 'mismatch'
      ? stat === otherStat
        ? 'other'
        : 'matched'
      : 'needs_review'

  return {
    id: `line-${index}`,
    rawText,
    level,
    detectedStat,
    stat: validStat ? stat : '',
    value: validStat ? finalValue : 0,
    rollPercent,
    ignored,
    status,
    reason: getLineReason({
      ignored,
      unenchantedPlaceholder,
      providedReason: line?.ignoreReason,
      stat,
      validStat,
      rollStatus: reconciled.rollStatus,
      rollPercent,
    }),
  }
}

function reconcileStatAndValue({
  detectedStat,
  rawText,
  extractedValue,
  rollPercent,
  level,
  item,
  gearType,
  ignored,
}) {
  const primaryStat = normalizeStat(detectedStat || rawText, item, rawText)
  const statCandidates = getStatCandidates(detectedStat || rawText, item, rawText)
  const hasVisibleRoll =
    Number.isInteger(rollPercent) &&
    rollPercent > 0 &&
    rollPercent <= 100

  if (ignored || !hasVisibleRoll || primaryStat === otherStat) {
    return {
      stat: primaryStat,
      value: extractedValue,
      rollStatus: 'unchecked',
    }
  }

  if (level < 2 || level > getMaxEnchantLevel(gearType)) {
    return {
      stat: primaryStat,
      value: extractedValue,
      rollStatus: 'mismatch',
    }
  }

  const exactMatches = statCandidates.filter((stat) =>
    isRollConsistent(item?.Stats?.[stat], gearType, level, extractedValue, rollPercent),
  )
  const exactStat = chooseStatCandidate(exactMatches, primaryStat)
  if (exactStat) {
    return {
      stat: exactStat,
      value: extractedValue,
      rollStatus: 'consistent',
    }
  }

  const percentGlyphValue = getTrailingPercentGlyphCorrection(extractedValue)
  if (percentGlyphValue > 0) {
    const correctedMatches = statCandidates.filter((stat) =>
      stat.endsWith('%') &&
      isRollConsistent(item?.Stats?.[stat], gearType, level, percentGlyphValue, rollPercent),
    )

    if (correctedMatches.length === 1) {
      return {
        stat: correctedMatches[0],
        value: percentGlyphValue,
        rollStatus: 'corrected',
      }
    }
  }

  const pixelFontDigitCorrection = getPixelFontDigitCorrection({
    value: extractedValue,
    stats: statCandidates,
    item,
    gearType,
    level,
    rollPercent,
  })
  if (pixelFontDigitCorrection) {
    return {
      ...pixelFontDigitCorrection,
      rollStatus: 'corrected',
    }
  }

  return {
    stat: primaryStat,
    value: extractedValue,
    rollStatus: 'mismatch',
  }
}

function getStatCandidates(statText, item, rawText) {
  const options = Object.keys(item?.Stats || {})
  const textWithoutPercent = String(statText || '').replaceAll('%', ' ').replace(/\bpercent\b/gi, ' ')
  const candidates = [
    normalizeStat(statText, item, rawText),
    normalizeStat(statText, item, rawText, false),
    normalizeStat(statText, item, rawText, true),
    normalizeStat(textWithoutPercent, item, rawText, false),
    normalizeStat(textWithoutPercent, item, rawText, true),
  ]

  return Array.from(new Set(candidates.filter((stat) => options.includes(stat))))
}

function chooseStatCandidate(candidates, primaryStat) {
  if (!candidates.length) {
    return ''
  }

  if (candidates.includes(primaryStat)) {
    return primaryStat
  }

  return candidates.length === 1 ? candidates[0] : ''
}

function isRollConsistent(statInfo, gearType, level, value, rollPercent) {
  const maxValue = getLineMaxValue(statInfo, gearType, level)
  const numericValue = Number(value)
  if (!maxValue || !Number.isFinite(numericValue) || numericValue <= 0 || numericValue > maxValue) {
    return false
  }

  return getDisplayedRollPercent(numericValue, maxValue) === rollPercent
}

function getTrailingPercentGlyphCorrection(value) {
  const numericValue = Number(value)
  if (!Number.isInteger(numericValue) || numericValue < 10) {
    return 0
  }

  const text = String(numericValue)
  return text.endsWith('8') ? Number(text.slice(0, -1)) : 0
}

function getPixelFontDigitCorrection({ value, stats, item, gearType, level, rollPercent }) {
  const candidateValues = getEightMisreadAsSixCandidates(value)
  const matches = stats.flatMap((stat) =>
    candidateValues
      .filter((candidateValue) =>
        isRollConsistent(item?.Stats?.[stat], gearType, level, candidateValue, rollPercent),
      )
      .map((candidateValue) => ({ stat, value: candidateValue })),
  )

  return matches.length === 1 ? matches[0] : null
}

function getEightMisreadAsSixCandidates(value) {
  const numericValue = Number(value)
  if (!Number.isSafeInteger(numericValue)) {
    return []
  }

  const digits = String(numericValue)
  if (digits.length < 5) {
    return []
  }

  const candidates = new Set()
  for (let index = 0; index < digits.length; index += 1) {
    if (digits[index] === '6') {
      candidates.add(Number(`${digits.slice(0, index)}8${digits.slice(index + 1)}`))
    }
  }

  return Array.from(candidates)
}

function normalizeStat(statText, item, rawText = '', percentOverride) {
  const options = Object.keys(item?.Stats || {})
  const key = canonicalizeStat(getStatNameText(statText))
  const rawKey = canonicalizeStat(getStatNameText(rawText))
  const statValueIsPercent = typeof percentOverride === 'boolean'
    ? percentOverride
    : hasPercentStatValue(statText) || hasPercentStatValue(rawText)

  if (!key) {
    return ''
  }

  if (isHealthStat(key) || isHealthStat(rawKey)) {
    const healthStat = healthStats.find(
      (stat) =>
        options.includes(stat) && key === canonicalizeStat(getPreferredPercentStat(stat, options, statValueIsPercent)),
    )
    if (healthStat) {
      return getPreferredPercentStat(healthStat, options, statValueIsPercent)
    }
  }

  const aliasedStat = statAliases.get(key)
  const preferredAliasedStat = getPreferredPercentStat(aliasedStat, options, statValueIsPercent)
  if (
    preferredAliasedStat &&
    options.includes(preferredAliasedStat) &&
    !isNonOffensiveStat(key, preferredAliasedStat)
  ) {
    return preferredAliasedStat
  }

  const exactStat = options.find((stat) => canonicalizeStat(stat) === key)
  const preferredExactStat = getPreferredPercentStat(exactStat, options, statValueIsPercent)
  if (preferredExactStat && !isNonOffensiveStat(key, preferredExactStat)) {
    return preferredExactStat
  }

  const containsStat = options.find((stat) => {
    const optionKey = canonicalizeStat(stat)
    return key.includes(optionKey) || optionKey.includes(key)
  })

  const preferredContainsStat = getPreferredPercentStat(containsStat, options, statValueIsPercent)
  if (preferredContainsStat && !isNonOffensiveStat(key, preferredContainsStat)) {
    return preferredContainsStat
  }

  return options.includes(otherStat) ? otherStat : ''
}

function getPreferredPercentStat(stat, options, statValueIsPercent) {
  if (!stat || !statValueIsPercent || stat.endsWith('%')) {
    return stat
  }

  const candidates = [`${stat} %`]
  if (stat.endsWith(' Damage')) {
    candidates.push(`${stat.replace(/ Damage$/, '')} %`)
  }

  return candidates.find((candidate) => options.includes(candidate)) || stat
}

function canonicalizeStat(value) {
  return String(value || '')
    .toLowerCase()
    .replaceAll('%', ' percent ')
    .replaceAll('&', ' and ')
    .replace(/\bdual\b/g, '')
    .replace(/\bonly\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getStatNameText(value) {
  return String(value || '')
    .replace(/\[[^\]]*]/g, ' ')
    .replace(/\blv\.?\s*\d+\b/gi, ' ')
    .replace(/[+＋]\s*\d+(?:[.,]\d+)?\s*%?\s*$/u, ' ')
    .trim()
}

function hasPercentStatValue(value) {
  const textWithoutRoll = String(value || '').replace(/\[[^\]]*]/g, ' ')
  return /(?:^|[^\w])\+?\s*\d+(?:[.,]\d+)?\s*(?:%|\bpercent\b)/i.test(textWithoutRoll)
}

function isHealthStat(key) {
  return key.includes('stamina') || key.includes('hp') || key.includes('health')
}

function isNonOffensiveStat(key, stat) {
  if (healthStats.includes(stat)) {
    return false
  }

  return nonOffensivePatterns.some((pattern) => key.includes(pattern))
}

function getLineReason({
  ignored,
  unenchantedPlaceholder,
  providedReason,
  stat,
  validStat,
  rollStatus,
  rollPercent,
}) {
  if (unenchantedPlaceholder) {
    return 'Unenchanted placeholder'
  }

  if (ignored) {
    return providedReason || 'Ignored by parser'
  }

  if (!validStat) {
    return 'Choose a matching stat or ignore this line'
  }

  if (stat === otherStat) {
    return 'Mapped to non-damaging option'
  }

  if (rollStatus === 'mismatch') {
    return `Value does not match the visible ${rollPercent}% roll`
  }

  if (rollStatus === 'corrected') {
    return 'Corrected using the visible roll percentage'
  }

  return 'Ready to apply'
}

function getImportEnchantLevel(lines) {
  const levels = lines
    .filter((line) => !line.ignored && line.value > 0)
    .map((line) => line.level)
    .filter((level) => Number.isFinite(level) && level > 0)

  return levels.length ? Math.max(...levels) : 2
}

function getMaxEnchantLevel(gearType) {
  if (!inputEnchantGearTypes.has(gearType)) {
    return 2
  }

  const gearLevel = parseInt(String(gearType).slice(1, 5))
  return gearType === '[sLv5] Accessories' || gearLevel >= 9999 ? 5 : 4
}

function getGearCategories(gearCatalog) {
  return Object.keys(gearCatalog || {}).filter((category) => !excludedGearCategories.has(category))
}

function getAllPieceNames(gearCatalog) {
  return Array.from(new Set(
    getGearCategories(gearCatalog).flatMap((gearType) => getPieceNames(gearType, gearCatalog)),
  ))
}

function getStatPrecision(statInfo) {
  const values = [statInfo?.Value, ...(Array.isArray(statInfo?.Potential) ? statInfo.Potential : [])]
  return values.reduce((precision, value) => {
    const text = String(value ?? '')
    const decimals = text.includes('.') ? text.split('.')[1].length : 0
    return Math.max(precision, decimals)
  }, 0)
}

function normalizeStatPrecision(statInfo, value) {
  const precision = getStatPrecision(statInfo)
  if (!precision) {
    return value
  }

  const factor = 10 ** precision
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function normalizeNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function clampNumber(value, min, max) {
  const number = normalizeNumber(value)
  return Math.min(Math.max(number, min), max)
}
