import gears from '../../utils/gear.js'
import tiers from '../../utils/tiers.js'
import {
  defaultOddsEnchantMethod,
  inputEnchantGearTypes,
  repeatableStats,
} from './data.js'
import { formatStatValue } from './helpers.js'
import {
  calculateGearScore,
  getDefaultQualityTargetPercent,
  getFinalStatValue,
  isStatValueOverMax,
} from './score-calculation.js'
import { encodeShareState, getShareParams } from './share-url.js'

const excludedGearCategories = new Set(['[5000] Accessories', '[4000] Weapon'])
const maximumGearLines = 5

export class GearEvaluationError extends Error {
  constructor(code, message, options = {}) {
    super(message, options)
    this.name = 'GearEvaluationError'
    this.code = code
    this.statusCode = options.statusCode || 422
    this.details = options.details || null
  }
}

export function evaluateImportedGear(importResult, { calculatorPath = '/' } = {}) {
  const equipment = requireResolvedEquipment(importResult)
  const gearType = importResult.gearType
  const pieceType = importResult.pieceType
  const item = gears[gearType]?.[pieceType]
  const tierEquivalence = item ? tiers[gearType]?.[item.Type] : null
  if (!item || !tierEquivalence || excludedGearCategories.has(gearType)) {
    throw new GearEvaluationError(
      'equipment_unsupported',
      'That equipment is not supported by the gear-score calculator.',
      {
        details: {
          gearType,
          pieceType,
        },
      },
    )
  }

  const activeLines = getActiveImportLines(importResult.lines)
  validateImportLines(activeLines, item)
  const inputEnchantLevel = getInputEnchantLevelNumber(
    gearType,
    item,
    importResult.inputEnchantLevel,
  )
  validateImportValues(activeLines, gearType, item, inputEnchantLevel)

  const { statTypes, statInputs } = buildCalculatorInputs(activeLines, item)
  const futurePotentialMultiplier = getProjectionEnchantLevel(gearType) - 2
  const inputUpgradeCount = supportsInputEnchantLevel(gearType, item)
    ? inputEnchantLevel - 2
    : 0
  const remainingPotentialMultiplier = Math.max(
    0,
    futurePotentialMultiplier - inputUpgradeCount,
  )
  const qualityTargetPercent = getDefaultQualityTargetPercent({
    item,
    tierEquivalence,
    upgradeCount: futurePotentialMultiplier,
  })
  const { result, validStats } = calculateGearScore({
    gearType,
    item,
    tierEquivalence,
    statTypes,
    statInputs,
    qualityOddsOrder: [0, 1, 2, 3, 4],
    qualityLineEnchantMethods: Array(maximumGearLines).fill(defaultOddsEnchantMethod),
    qualityTargetPercent,
    remainingPotentialMultiplier,
    futurePotentialMultiplier,
  })
  const projection = getProjectionSummary({
    gearType,
    item,
    inputEnchantLevel,
    result,
  })
  const snapshotPayload = buildEvaluationSnapshotPayload({
    gearType,
    pieceType,
    inputEnchantLevel,
    statTypes,
    statInputs,
    result,
    projection,
  })
  const itemString = encodeShareState({
    gearType,
    pieceType,
    statType: statTypes,
    statInput: statInputs,
  })
  const shareParams = getShareParams({
    itemString,
    enchantLevel: inputEnchantLevel,
    includeEnchantLevel:
      supportsInputEnchantLevel(gearType, item) && inputEnchantLevel > 2,
  })
  const shareQuery = shareParams.toString()
  const normalizedCalculatorPath = normalizeCalculatorPath(calculatorPath)

  return {
    gearType,
    pieceType,
    equipment,
    itemType: item.Type,
    inputEnchantLevel,
    statTypes,
    statInputs,
    lines: activeLines,
    result,
    validStats,
    summary: {
      score: Number(result.percent),
      tier: result.tier,
      rating: Number(result.DI),
      scoreText: `${result.percent}%`,
      ratingText: `${result.DI}%`,
    },
    projection,
    snapshotPayload,
    shareQuery,
    sharePath: `${normalizedCalculatorPath}?${shareQuery}`,
  }
}

export function getSupportedEquipmentOptions() {
  return Object.entries(gears).flatMap(([gearType, category]) => {
    if (excludedGearCategories.has(gearType)) {
      return []
    }

    return Object.keys(category)
      .filter((pieceType) => !['Sheet Link', 'Potential'].includes(pieceType))
      .map((pieceType) => ({
        gearType,
        pieceType,
        value: `${gearType}::${pieceType}`,
        label: `${gearType} · ${pieceType}`,
      }))
  })
}

export function parseEquipmentOption(value) {
  const [gearType = '', pieceType = ''] = String(value || '').split('::')
  return gears[gearType]?.[pieceType] && !excludedGearCategories.has(gearType)
    ? { gearType, pieceType }
    : null
}

export function getProjectionEnchantLevel(gearType) {
  const gearLevel = parseInt(String(gearType).slice(1, 5))
  return gearType === '[sLv5] Accessories' || gearLevel >= 9999 ? 5 : 4
}

export function getFinalUpgrade(gearType) {
  switch (gearType) {
    case '[3500] Badge 6':
    case '[9999] Badge 6':
      return ''
    case '[sLv5] Accessories':
    case '[9999] Armor':
      return 'Ascended'
    default:
      return 'Lucent'
  }
}

export function supportsInputEnchantLevel(gearType, item = null) {
  const selectedItem = item || getFirstItem(gearType)
  return inputEnchantGearTypes.includes(gearType)
    && Object.values(selectedItem?.Stats || {}).some(
      (stat) => Array.isArray(stat.Potential) && Number(stat.Potential[0]) > 0,
    )
}

function requireResolvedEquipment(importResult) {
  const equipment = importResult?.equipment
  if (
    equipment?.status !== 'resolved'
    || !['image', 'hint'].includes(equipment?.source)
  ) {
    throw new GearEvaluationError(
      'equipment_unresolved',
      'The equipment type is not clear. Retake the screenshot with the item title visible or choose an equipment hint.',
      {
        details: {
          reason: equipment?.reason || 'Missing equipment identity provenance',
        },
      },
    )
  }

  return equipment
}

function getActiveImportLines(lines) {
  if (!Array.isArray(lines)) {
    return []
  }

  return lines.filter((line) => !line?.ignored)
}

function validateImportLines(lines, item) {
  if (!lines.length) {
    throw new GearEvaluationError(
      'lines_missing',
      'No gear enchant lines were found in the screenshot.',
    )
  }

  if (lines.length > maximumGearLines) {
    throw new GearEvaluationError(
      'lines_too_many',
      'The screenshot contains more than five active enchant lines.',
      {
        details: {
          lineCount: lines.length,
        },
      },
    )
  }

  const reviewLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) =>
      !['matched', 'other'].includes(line?.status)
      || !item.Stats?.[line?.stat]
      || !Number.isFinite(Number(line?.value))
      || Number(line?.value) <= 0,
    )
  if (reviewLines.length) {
    throw new GearEvaluationError(
      'lines_need_review',
      'One or more enchant lines could not be read confidently. Retake a tighter, sharper crop.',
      {
        details: {
          lines: reviewLines.map(({ line, index }) => ({
            index,
            id: line?.id || '',
            reason: line?.reason || 'Unreadable enchant line',
          })),
        },
      },
    )
  }

  const seenStats = new Set()
  const duplicateStats = new Set()
  lines.forEach((line) => {
    if (!repeatableStats.includes(line.stat) && seenStats.has(line.stat)) {
      duplicateStats.add(line.stat)
    }
    seenStats.add(line.stat)
  })
  if (duplicateStats.size) {
    throw new GearEvaluationError(
      'stats_duplicated',
      'The screenshot contains duplicate offensive stat lines. Verify the crop and try again.',
      {
        details: {
          stats: Array.from(duplicateStats),
        },
      },
    )
  }
}

function validateImportValues(lines, gearType, item, inputEnchantLevel) {
  const upgradeCount = supportsInputEnchantLevel(gearType, item)
    ? inputEnchantLevel - 2
    : 0
  const invalidLines = lines
    .map((line, index) => {
      const statInfo = item.Stats[line.stat]
      const value = Number(line.value)
      const maxValue = getFinalStatValue(statInfo, upgradeCount)
      return isStatValueOverMax(statInfo, value, maxValue)
        ? {
            index,
            stat: line.stat,
            value,
            maxValue,
          }
        : null
    })
    .filter(Boolean)

  if (invalidLines.length) {
    throw new GearEvaluationError(
      'values_out_of_range',
      'One or more enchant values exceed the maximum for the detected enchant level.',
      {
        details: {
          lines: invalidLines,
        },
      },
    )
  }
}

function buildCalculatorInputs(lines, item) {
  const options = Object.keys(item.Stats || {})
  const statTypes = lines.map((line) => line.stat)
  const statInputs = lines.map((line) => formatInputValue(line.stat, line.value))
  const usedStats = new Set(
    statTypes.filter((stat) => !repeatableStats.includes(stat)),
  )

  while (statTypes.length < maximumGearLines) {
    const fallback =
      options.find(
        (option) => repeatableStats.includes(option) || !usedStats.has(option),
      )
      || ''
    statTypes.push(fallback)
    statInputs.push('')
    if (fallback && !repeatableStats.includes(fallback)) {
      usedStats.add(fallback)
    }
  }

  return {
    statTypes,
    statInputs,
  }
}

function formatInputValue(stat, value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return ''
  }

  return ['Normal Amplification', 'Boss Amplification', 'Cooldown Reduction'].includes(stat)
    ? Number(number.toFixed(1))
    : parseInt(number)
}

function getInputEnchantLevelNumber(gearType, item, value) {
  if (!supportsInputEnchantLevel(gearType, item)) {
    return 2
  }

  const parsed = parseInt(value)
  const maxLevel = getProjectionEnchantLevel(gearType)
  return Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, 2), maxLevel)
    : 2
}

function getProjectionSummary({ gearType, item, inputEnchantLevel, result }) {
  const finalUpgrade = getFinalUpgrade(gearType)
  const finalEnchantLevel = getProjectionEnchantLevel(gearType)
  const available =
    Boolean(finalUpgrade)
    && (
      !supportsInputEnchantLevel(gearType, item)
      || inputEnchantLevel < finalEnchantLevel
    )

  return {
    available,
    finalUpgrade,
    currentEnchantLevel: inputEnchantLevel,
    finalEnchantLevel,
    score: available ? result.potentialScore : `${result.percent}%`,
    rating: available ? result.potentialDI : `${result.DI}%`,
    tier: available ? result.potentialTier : result.tier,
  }
}

function buildEvaluationSnapshotPayload({
  gearType,
  pieceType,
  inputEnchantLevel,
  statTypes,
  statInputs,
  result,
  projection,
}) {
  const currentLevelLabel = getFinalUpgrade(gearType)
    ? `Lv.${inputEnchantLevel}`
    : 'Current'
  const lines = statTypes.flatMap((stat, index) => {
    const inputValue = Number(statInputs[index])
    if (!Number.isFinite(inputValue) || inputValue <= 0) {
      return []
    }

    const row = result.individual[index]
    const line = {
      stat,
      value: formatStatValue(inputValue, stat),
      currentMetric: `${row.percent}%`,
    }
    if (projection.available) {
      line.projectedValue = formatPotentialValueRange(row)
      line.projectedMetric = formatPotentialLineMetric(row)
    }

    return [line]
  })

  return {
    itemName: gearType.toLowerCase().includes(pieceType.toLowerCase())
      ? gearType
      : `${gearType} · ${pieceType}`,
    itemImage: '',
    itemImageKey: `${pieceType}_${gearType.slice(1, 5)}.png`,
    metricMode: 'score',
    current: {
      value: `${result.percent}%`,
      tier: result.tier,
      levelLabel: currentLevelLabel,
    },
    projected: projection.available
      ? {
          value: result.potentialScore,
          tier: result.potentialTier,
          levelLabel: `Lv.${projection.finalEnchantLevel} ${projection.finalUpgrade}`,
        }
      : null,
    lines,
  }
}

function formatPotentialValueRange(row) {
  if (!row.potentialMin && !row.potentialMax) {
    return '-'
  }

  return row.potentialMin === row.potentialMax
    ? row.potentialMin
    : `${row.potentialMin} ~ ${row.potentialMax}`
}

function formatPotentialLineMetric(row) {
  return row.potentialMinPerc === row.potentialMaxPerc
    ? `${row.potentialMinPerc}%`
    : `${row.potentialMinPerc}% ~ ${row.potentialMaxPerc}%`
}

function normalizeCalculatorPath(path) {
  const normalized = String(path || '/').replace(/\/+$/, '')
  return normalized || '/'
}

function getFirstItem(gearType) {
  const category = gears[gearType]
  if (!category) {
    return null
  }

  const pieceType = Object.keys(category).find(
    (key) => !['Sheet Link', 'Potential'].includes(key),
  )
  return category[pieceType]
}
