import {
  decimalStats,
  getOddsEnchantMethod,
  qualityOddsGearTypes,
  ratingScale,
} from './data.js'
import {
  createEmptyIndividualResult,
  formatBaseRollSummary,
  formatProbability,
  formatRange,
  formatStatValue,
  getRollDistribution,
  getTierForPercent,
} from './helpers.js'

export function createEmptyGearScoreResult() {
  return {
    individual: [
      createEmptyIndividualResult(),
      createEmptyIndividualResult(),
      createEmptyIndividualResult(),
      createEmptyIndividualResult(),
      createEmptyIndividualResult(),
    ],
    DI: '',
    percent: '',
    tier: '',
    potentialScore: '',
    potentialDI: '',
    potentialTier: '',
    qualityOdds: getEmptyQualityOdds(),
  }
}

export function getEmptyQualityOdds() {
  return {
    available: false,
    totalChance: 0,
    totalChanceText: '',
    survivedMissChance: 0,
    survivedMissChanceText: '',
    destroyedChance: 0,
    destroyedChanceText: '',
    survivalChance: 0,
    survivalChanceText: '',
    futureRolls: 0,
    futureBaseLines: 0,
    upgradeRolls: 0,
    targetQuality: 0,
    targetQualityText: '',
    qualityMin: 0,
    qualityMax: 0,
    qualityText: '—',
    plannedQualityMin: 0,
    plannedQualityMax: 0,
    plannedQualityText: '',
    showProjectedQuality: true,
    benchmarkDI: 0,
    baseRollText: '',
    isAlreadyComplete: false,
    isTargetReachable: false,
    targetState: 'unavailable',
    expectedStarts: null,
    expectedDestroyedItems: null,
    expectedKeptMisses: null,
    startsForEvenChance: null,
    startsForHighConfidence: null,
    materials: {
      perStart: getEmptyMaterialEstimate(),
      perTarget: getEmptyMaterialEstimate(null),
      fullSequence: getEmptyMaterialEstimate(),
    },
    lines: [],
  }
}

function getEmptyMaterialEstimate(emptyValue = 0) {
  return {
    ely: emptyValue,
    hammersMin: emptyValue,
    hammersMax: emptyValue,
  }
}

function formatQualityRange(minQuality, maxQuality) {
  const minText = minQuality.toFixed(2)
  const maxText = maxQuality.toFixed(2)
  return minText === maxText ? minText + '%' : minText + '% ~ ' + maxText + '%'
}

export function isDecimalStat(stat) {
  return decimalStats.includes(stat)
}

export function getStatStep(stat) {
  return isDecimalStat(stat) ? 0.1 : 1
}

export function getInputValue(statInputs, index) {
  const value = parseFloat(statInputs[index])
  return Number.isFinite(value) ? value : 0
}

export function hasRolledValue(statInputs, index) {
  return statInputs[index] !== '' && getInputValue(statInputs, index) > 0
}

function getDecimalPlaces(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return 0
  }

  const text = number.toString().toLowerCase()
  if (!text.includes('e')) {
    return (text.split('.')[1] ?? '').length
  }

  const [coefficient, exponentText] = text.split('e')
  const exponent = Number(exponentText)
  const coefficientDecimalPlaces = (coefficient.split('.')[1] ?? '').length
  return Math.max(0, coefficientDecimalPlaces - exponent)
}

function getStatValuePrecision(statInfo) {
  if (!statInfo) {
    return 0
  }

  const values = [
    statInfo.Value,
    ...(Array.isArray(statInfo.Potential) ? statInfo.Potential : []),
  ]

  return values.reduce((precision, value) => Math.max(precision, getDecimalPlaces(value)), 0)
}

export function normalizeStatValue(statInfo, value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return number
  }

  const precision = getStatValuePrecision(statInfo)
  if (precision <= 0) {
    return number
  }

  const factor = 10 ** precision
  return Math.round((number + Number.EPSILON) * factor) / factor
}

export function isStatValueOverMax(statInfo, value, maxValue) {
  const number = Number(value)
  const max = Number(maxValue)
  if (!Number.isFinite(number) || !Number.isFinite(max)) {
    return false
  }

  const precision = getStatValuePrecision(statInfo)
  const normalizedMax = normalizeStatValue(statInfo, max)
  const floatingTolerance = Number.EPSILON * Math.max(1, Math.abs(normalizedMax))
  const decimalTolerance = precision > 0 ? 1 / (10 ** (precision + 6)) : 0
  const tolerance = Math.max(floatingTolerance, decimalTolerance)

  return number - normalizedMax > tolerance
}

export function calculateGearScore({
  gearType,
  item,
  tierEquivalence,
  statTypes,
  statInputs,
  qualityOddsOrder,
  qualityLineEnchantMethods,
  qualityTargetPercent,
  remainingPotentialMultiplier,
  futurePotentialMultiplier,
}) {
  let totalDI = 0
  let potentialGainMin = 0
  let potentialGainMax = 0
  const tierAvailable = Object.keys(tierEquivalence)
  const result = createEmptyGearScoreResult()
  const validStats = ['', '', '', '', '']

  for (let i = 0; i < 5; i++) {
    const stat = statTypes[i]
    const statInfo = item.Stats[stat]
    if (!statInfo) {
      continue
    }

    const maxDI = statInfo.DI
    const maxValue = statInfo.Value
    const currentValue = getInputValue(statInputs, i)
    const hasValue = hasRolledValue(statInputs, i)
    const res = currentValue / maxValue * maxDI
    totalDI += res

    const pot = statInfo.Potential
    const potentialValueMin = normalizeStatValue(statInfo, currentValue + pot[0] * remainingPotentialMultiplier)
    const potentialValueMax = normalizeStatValue(statInfo, currentValue + pot[1] * remainingPotentialMultiplier)

    if (hasValue) {
      potentialGainMin += pot[0] / maxValue * maxDI
      potentialGainMax += pot[1] / maxValue * maxDI
    }

    const singleTier = getTierForPercent(currentValue / maxValue * 100, tierEquivalence, tierAvailable)
    const potentialTierMin = getTierForPercent(potentialValueMin / maxValue * 100, tierEquivalence, tierAvailable)
    const potentialTierMax = getTierForPercent(potentialValueMax / maxValue * 100, tierEquivalence, tierAvailable)
    const individual = result.individual[i]

    individual.DI = res.toFixed(2)
    individual.percent = parseInt(currentValue / maxValue * 100)
    individual.tier = singleTier
    individual.potentialMin = formatStatValue(potentialValueMin, stat)
    individual.potentialMax = formatStatValue(potentialValueMax, stat)

    if (!hasValue) {
      individual.potentialMinPerc = 0
      individual.potentialMaxPerc = 0
    }
    else {
      individual.potentialMinPerc = parseInt(potentialValueMin / maxValue * 100)
      individual.potentialMaxPerc = parseInt(potentialValueMax / maxValue * 100)
      validStats[i] = stat
    }

    individual.potentialDIMin = parseFloat(potentialValueMin / maxValue * maxDI).toFixed(2)
    individual.potentialDIMax = parseFloat(potentialValueMax / maxValue * maxDI).toFixed(2)
    individual.potentialTierMin = potentialTierMin
    individual.potentialTierMax = potentialTierMax
  }

  result.DI = totalDI.toFixed(2)
  const itemDI = parseInt(totalDI / item.DI * 100)
  result.percent = itemDI
  result.tier = getTierForPercent(itemDI, tierEquivalence, tierAvailable)

  const potentialMin = parseInt((potentialGainMin * remainingPotentialMultiplier + totalDI) / item.DI * 100)
  const potentialMax = parseInt((potentialGainMax * remainingPotentialMultiplier + totalDI) / item.DI * 100)
  const potentialDIMin = potentialGainMin * remainingPotentialMultiplier + totalDI
  const potentialDIMax = potentialGainMax * remainingPotentialMultiplier + totalDI

  let potentialText = potentialMin + '%'
  let potentialDIText = potentialDIMin.toFixed(2) + '%'
  if (potentialMin !== potentialMax) {
    potentialText += ' ~ ' + potentialMax + '%'
    potentialDIText += ' ~ ' + potentialDIMax.toFixed(2) + '%'
  }

  let finalTierMin = 'F'
  let finalTierMax = 'F'
  tierAvailable.forEach((entry) => {
    if (potentialMin >= parseInt(tierEquivalence[entry].Penta)) {
      finalTierMin = entry
    }
    if (potentialMax >= parseInt(tierEquivalence[entry].Penta)) {
      finalTierMax = entry
    }
  })

  let potentialTierText = finalTierMin
  if (finalTierMin !== finalTierMax) {
    potentialTierText += ' ~ ' + finalTierMax
  }

  if (potentialGainMax === 0) {
    potentialText = result.percent + '%'
    potentialDIText = result.DI + '%'
    potentialTierText = result.tier
  }

  result.potentialScore = potentialText
  result.potentialDI = potentialDIText
  result.potentialTier = potentialTierText
  result.qualityOdds = calculateQualityOdds({
    gearType,
    item,
    statTypes,
    statInputs,
    lineOrder: qualityOddsOrder,
    lineEnchantMethods: qualityLineEnchantMethods,
    qualityTargetPercent,
    remainingPotentialMultiplier,
    futurePotentialMultiplier,
  })

  return {
    result,
    validStats,
  }
}

export function getFinalStatValue(statInfo, upgradeCount) {
  if (!statInfo) {
    return 0
  }

  const baseValue = Number(statInfo.Value)
  const potentialMax = Number(statInfo.Potential?.[1] ?? 0)
  const upgrades = Number(upgradeCount)
  const value = (Number.isFinite(baseValue) ? baseValue : 0)
    + (Number.isFinite(potentialMax) ? potentialMax : 0)
    * (Number.isFinite(upgrades) ? upgrades : 0)

  return normalizeStatValue(statInfo, value)
}

export function getStatRatingForValue(statInfo, value) {
  if (!statInfo || !Number.isFinite(Number(value))) {
    return 0
  }

  return Number(value) / statInfo.Value * statInfo.DI
}

export function getGearQualityBenchmark(item, upgradeCount, lineWeights = []) {
  if (!item) {
    return 0
  }

  return item.Optimal.reduce((total, stat, index) => {
    const statInfo = item.Stats[stat]
    const weight = Number.isFinite(lineWeights[index]) ? lineWeights[index] : 1
    return total + getStatRatingForValue(statInfo, getFinalStatValue(statInfo, upgradeCount)) * weight
  }, 0)
}

export function getDefaultQualityTargetPercent({ item, tierEquivalence, upgradeCount }) {
  const legacyTargetPercent = parseFloat(tierEquivalence?.SSS?.Penta)
  const benchmarkDI = getGearQualityBenchmark(item, upgradeCount)
  if (!item || !Number.isFinite(legacyTargetPercent) || benchmarkDI <= 0) {
    return 0
  }

  return item.DI * legacyTargetPercent / benchmarkDI
}

export function calculateGearPlanItem({
  item,
  statTypes,
  statInputs,
  upgradeCount,
  lineWeights = [],
}) {
  if (!item) {
    return createEmptyGearPlanResult()
  }

  const lines = statTypes.map((stat, index) => {
    const statInfo = item.Stats[stat]
    const rawValue = statInputs[index]
    const numericValue = Number(rawValue)
    const value = normalizeStatValue(statInfo, numericValue)
    const weight = Number.isFinite(lineWeights[index]) ? lineWeights[index] : 1
    const hasInput = rawValue !== '' && rawValue !== null && rawValue !== undefined && numericValue !== 0
    const filled = Number.isFinite(numericValue) && numericValue > 0
    const finalMaxValue = getFinalStatValue(statInfo, upgradeCount)
    const currentDI = getStatRatingForValue(statInfo, value) * weight
    const ceilingDI = getStatRatingForValue(statInfo, finalMaxValue) * weight
    const valid = filled && Boolean(statInfo) && !isStatValueOverMax(statInfo, numericValue, finalMaxValue)
    const maxPercent = filled && finalMaxValue > 0 ? value / finalMaxValue * 100 : null

    return {
      index,
      stat,
      value,
      weight,
      filled,
      currentDI,
      ceilingDI,
      gapDI: Math.max(ceilingDI - currentDI, 0),
      finalMaxValue,
      maxPercent,
      valid,
      invalid: hasInput && !valid,
    }
  })

  const benchmarkDI = getGearQualityBenchmark(item, upgradeCount, lineWeights)
  const currentDI = lines.reduce((total, line) => total + line.currentDI, 0)
  const selectedCeilingDI = lines.reduce((total, line) =>
    total + (line.filled ? line.ceilingDI : 0), 0)
  const opportunityDI = Math.max(benchmarkDI - currentDI, 0)
  const rollGapDI = Math.min(Math.max(selectedCeilingDI - currentDI, 0), opportunityDI)
  const pieceGapDI = Math.max(opportunityDI - rollGapDI, 0)
  const filledLineCount = lines.filter((line) => line.filled).length
  const eligible = lines.length === 5 && filledLineCount >= 3 && !lines.some((line) => line.invalid)
  const lineStatus = filledLineCount < 3
    ? 'needs-lines'
    : filledLineCount < 5
      ? 'partial'
      : 'penta'

  return {
    filledLineCount,
    eligible,
    lineStatus,
    currentDI,
    benchmarkDI,
    selectedCeilingDI,
    opportunityDI,
    rollGapDI,
    pieceGapDI,
    qualityPercent: benchmarkDI > 0 ? currentDI / benchmarkDI * 100 : 0,
    aboveBenchmark: eligible && currentDI > benchmarkDI,
    lines,
  }
}

function createEmptyGearPlanResult() {
  return {
    filledLineCount: 0,
    eligible: false,
    lineStatus: 'needs-lines',
    currentDI: 0,
    benchmarkDI: 0,
    selectedCeilingDI: 0,
    opportunityDI: 0,
    rollGapDI: 0,
    pieceGapDI: 0,
    qualityPercent: 0,
    aboveBenchmark: false,
    lines: [],
  }
}

export function calculateQualityOdds({
  gearType,
  item,
  statTypes,
  statInputs,
  lineOrder,
  lineEnchantMethods,
  qualityTargetPercent,
  remainingPotentialMultiplier,
  futurePotentialMultiplier,
}) {
  if (!qualityOddsGearTypes.includes(gearType)) {
    return getEmptyQualityOdds()
  }

  const targetQuality = Math.min(Math.max(Number(qualityTargetPercent) || 0, 0), 100)
  const benchmarkDI = getGearQualityBenchmark(item, futurePotentialMultiplier)
  const targetRating = benchmarkDI * targetQuality / 100
  const targetScore = Math.ceil(targetRating * ratingScale)

  let fixedScore = 0
  let futureBaseLines = 0
  let hasRolledLines = false
  let rolledMinRating = 0
  let rolledMaxRating = 0
  let plannedMinRating = 0
  let plannedMaxRating = 0
  const lines = []
  const rollableFutureLines = []

  for (const lineIndex of lineOrder) {
    const stat = statTypes[lineIndex]
    const statInfo = item.Stats[stat]
    if (!statInfo) {
      continue
    }

    const maxValue = statInfo.Value
    const maxDI = statInfo.DI
    const potential = statInfo.Potential
    const shouldRollLine = maxDI > 0
    const currentValue = getInputValue(statInputs, lineIndex)
    const step = getStatStep(stat)
    const hasValue = hasRolledValue(statInputs, lineIndex)
    const linePotentialMultiplier = hasValue ? remainingPotentialMultiplier : futurePotentialMultiplier
    const upgradeMinValue = normalizeStatValue(statInfo, potential[0] * linePotentialMultiplier)
    const upgradeMaxValue = normalizeStatValue(statInfo, potential[1] * linePotentialMultiplier)
    const upgradeScore = Math.round(upgradeMinValue / maxValue * maxDI * ratingScale)
    const finalMaxValue = getFinalStatValue(statInfo, futurePotentialMultiplier)

    let lineMinValue = hasValue ? currentValue : step
    let lineMaxValue = hasValue ? currentValue : maxValue
    lineMinValue = normalizeStatValue(statInfo, lineMinValue + upgradeMinValue)
    lineMaxValue = normalizeStatValue(statInfo, lineMaxValue + upgradeMaxValue)

    if (hasValue) {
      hasRolledLines = true
      rolledMinRating += lineMinValue / maxValue * maxDI
      rolledMaxRating += lineMaxValue / maxValue * maxDI
    }

    let enchantMethod = null

    if (!shouldRollLine) {
      // Non-damaging lines are ignored for SSS attempts, so they add no survival risk.
    }
    else if (hasValue) {
      fixedScore += upgradeScore
      fixedScore += Math.round(currentValue / maxValue * maxDI * ratingScale)
    }
    else {
      futureBaseLines += 1
      enchantMethod = getOddsEnchantMethod(gearType, lineEnchantMethods?.[lineIndex])
      rollableFutureLines.push({
        index: lineIndex,
        upgradeScore,
        enchantMethod,
        distribution: getRollDistribution(step, maxValue, step, maxValue, maxDI),
      })
    }

    plannedMinRating += lineMinValue / maxValue * maxDI
    plannedMaxRating += lineMaxValue / maxValue * maxDI
    const projectedValue = hasValue ? normalizeStatValue(statInfo, currentValue + upgradeMaxValue) : null
    lines.push({
      index: lineIndex,
      stat,
      range: shouldRollLine ? formatRange(lineMinValue, lineMaxValue, stat) : 'Ignored',
      rollText: !shouldRollLine ? 'not rolled' : hasValue ? linePotentialMultiplier > 0 ? 'already rolled' : 'complete' : 'needs base roll',
      status: !shouldRollLine ? 'ignored' : hasValue ? 'upgrade' : 'new',
      maxRollPercent: hasValue && finalMaxValue > 0 ? projectedValue / finalMaxValue * 100 : null,
      enchantMethod: enchantMethod?.value ?? null,
      enchantMethodLabel: enchantMethod?.label ?? '',
      successRate: enchantMethod?.successRate ?? null,
      elyCost: enchantMethod?.elyCost ?? 0,
      hammerCostMin: enchantMethod?.hammerCostMin ?? 0,
      hammerCostMax: enchantMethod?.hammerCostMax ?? 0,
    })
  }

  const maximumRemainingScores = Array(rollableFutureLines.length + 1).fill(0)
  for (let index = rollableFutureLines.length - 1; index >= 0; index--) {
    const line = rollableFutureLines[index]
    const maxRollScore = line.distribution.reduce(
      (maximum, roll) => Math.max(maximum, roll.score),
      0,
    )
    maximumRemainingScores[index] = maximumRemainingScores[index + 1]
      + line.upgradeScore
      + maxRollScore
  }

  let activeOutcomes = fixedScore >= targetScore ? new Map() : new Map([[fixedScore, 1]])
  let totalChance = fixedScore >= targetScore ? 1 : 0
  let abandonedMissChance = 0
  let expectedElyPerStart = 0
  let expectedHammersMinPerStart = 0
  let expectedHammersMaxPerStart = 0
  const lineOutcomeDetails = new Map()

  for (let index = 0; index < rollableFutureLines.length; index++) {
    const line = rollableFutureLines[index]

    const reachableOutcomes = new Map()
    activeOutcomes.forEach((probability, currentScore) => {
      if (currentScore + maximumRemainingScores[index] >= targetScore) {
        reachableOutcomes.set(currentScore, probability)
      }
      else {
        abandonedMissChance += probability
      }
    })
    activeOutcomes = reachableOutcomes

    if (activeOutcomes.size === 0) {
      break
    }

    const targetChanceBefore = totalChance
    const attemptChance = sumOutcomeProbabilities(activeOutcomes)
    const nextOutcomes = new Map()

    expectedElyPerStart += attemptChance * line.enchantMethod.elyCost
    expectedHammersMinPerStart += attemptChance * line.enchantMethod.hammerCostMin
    expectedHammersMaxPerStart += attemptChance * line.enchantMethod.hammerCostMax

    activeOutcomes.forEach((currentProbability, currentScore) => {
      const survivedProbability = currentProbability * line.enchantMethod.successRate

      line.distribution.forEach((roll) => {
        const nextScore = currentScore + line.upgradeScore + roll.score
        const nextProbability = survivedProbability * roll.probability

        if (nextScore >= targetScore) {
          totalChance += nextProbability
        }
        else {
          nextOutcomes.set(nextScore, (nextOutcomes.get(nextScore) || 0) + nextProbability)
        }
      })
    })

    activeOutcomes = nextOutcomes
    const aliveBelowTargetChanceAfter = abandonedMissChance
      + sumOutcomeProbabilities(activeOutcomes)
    const cumulativeSurvivalChance = totalChance + aliveBelowTargetChanceAfter
    lineOutcomeDetails.set(line.index, {
      pendingStep: index + 1,
      attemptChance,
      attemptChanceText: formatProbability(attemptChance),
      finishChance: totalChance - targetChanceBefore,
      finishChanceText: formatProbability(totalChance - targetChanceBefore),
      targetChanceAfter: totalChance,
      targetChanceAfterText: formatProbability(totalChance),
      aliveBelowTargetChanceAfter,
      cumulativeSurvivalChance,
      cumulativeSurvivalChanceText: formatProbability(cumulativeSurvivalChance),
    })
  }

  const isAlreadyComplete = fixedScore >= targetScore
  const survivedMissChance = isAlreadyComplete
    ? 0
    : abandonedMissChance + sumOutcomeProbabilities(activeOutcomes)
  const survivalChance = clampProbability(totalChance + survivedMissChance)
  const destroyedChance = clampProbability(1 - totalChance - survivedMissChance)
  const plannedMinQuality = benchmarkDI > 0 ? plannedMinRating / benchmarkDI * 100 : 0
  const plannedMaxQuality = benchmarkDI > 0 ? plannedMaxRating / benchmarkDI * 100 : 0
  const qualityMin = benchmarkDI > 0 ? rolledMinRating / benchmarkDI * 100 : 0
  const qualityMax = benchmarkDI > 0 ? rolledMaxRating / benchmarkDI * 100 : 0
  const qualityText = hasRolledLines ? formatQualityRange(qualityMin, qualityMax) : '—'
  const plannedQualityText = formatQualityRange(plannedMinQuality, plannedMaxQuality)
  const showProjectedQuality = qualityText !== plannedQualityText
  const isTargetReachable = isAlreadyComplete || totalChance > 0
  const targetState = isAlreadyComplete
    ? 'secured'
    : isTargetReachable
      ? 'active'
      : rollableFutureLines.length
        ? 'impossible'
        : 'no-rolls'
  const expectedStarts = totalChance > 0 ? 1 / totalChance : null
  const expectedDestroyedItems = totalChance > 0 ? destroyedChance / totalChance : null
  const expectedKeptMisses = totalChance > 0 ? survivedMissChance / totalChance : null
  const fullSequenceMaterials = rollableFutureLines.reduce((materials, line) => {
    materials.ely += line.enchantMethod.elyCost
    materials.hammersMin += line.enchantMethod.hammerCostMin
    materials.hammersMax += line.enchantMethod.hammerCostMax
    return materials
  }, getEmptyMaterialEstimate())
  const perStartMaterials = {
    ely: expectedElyPerStart,
    hammersMin: expectedHammersMinPerStart,
    hammersMax: expectedHammersMaxPerStart,
  }
  const perTargetMaterials = totalChance > 0
    ? {
        ely: expectedElyPerStart / totalChance,
        hammersMin: expectedHammersMinPerStart / totalChance,
        hammersMax: expectedHammersMaxPerStart / totalChance,
      }
    : getEmptyMaterialEstimate(null)
  const detailedLines = lines.map((line) => ({
    ...line,
    ...(lineOutcomeDetails.get(line.index) ?? {
      pendingStep: line.status === 'new'
        ? rollableFutureLines.findIndex((rollableLine) => rollableLine.index === line.index) + 1
        : null,
      attemptChance: line.status === 'new' ? 0 : null,
      attemptChanceText: line.status === 'new' ? '0%' : '',
      finishChance: line.status === 'new' ? 0 : null,
      finishChanceText: line.status === 'new' ? '0%' : '',
      targetChanceAfter: line.status === 'new' ? totalChance : null,
      targetChanceAfterText: line.status === 'new' ? formatProbability(totalChance) : '',
      aliveBelowTargetChanceAfter: line.status === 'new' ? survivedMissChance : null,
      cumulativeSurvivalChance: line.status === 'new' ? survivalChance : null,
      cumulativeSurvivalChanceText: line.status === 'new' ? formatProbability(survivalChance) : '',
    }),
  }))

  return {
    available: true,
    totalChance,
    totalChanceText: formatProbability(totalChance),
    survivedMissChance,
    survivedMissChanceText: formatProbability(survivedMissChance),
    destroyedChance,
    destroyedChanceText: formatProbability(destroyedChance),
    survivalChance,
    survivalChanceText: formatProbability(survivalChance),
    futureRolls: futureBaseLines,
    futureBaseLines,
    baseRollText: formatBaseRollSummary(
      rollableFutureLines.map((line) => line.enchantMethod),
      isAlreadyComplete,
    ),
    upgradeRolls: 0,
    targetQuality,
    targetQualityText: targetQuality.toFixed(2) + '%',
    qualityMin,
    qualityMax,
    qualityText,
    plannedQualityMin: plannedMinQuality,
    plannedQualityMax: plannedMaxQuality,
    plannedQualityText,
    showProjectedQuality,
    benchmarkDI,
    isAlreadyComplete,
    isTargetReachable,
    targetState,
    expectedStarts,
    expectedDestroyedItems,
    expectedKeptMisses,
    startsForEvenChance: getStartsForConfidence(totalChance, 0.5),
    startsForHighConfidence: getStartsForConfidence(totalChance, 0.9),
    materials: {
      perStart: perStartMaterials,
      perTarget: perTargetMaterials,
      fullSequence: fullSequenceMaterials,
    },
    lines: detailedLines,
  }
}

export function findBestQualityOddsOrder({
  gearType,
  item,
  statTypes,
  statInputs,
  lineOrder,
  lineEnchantMethods,
  qualityTargetPercent,
  remainingPotentialMultiplier,
  futurePotentialMultiplier,
}) {
  if (!qualityOddsGearTypes.includes(gearType)) {
    return {
      pendingOrder: [],
      totalChance: 0,
    }
  }

  const targetQuality = Math.min(Math.max(Number(qualityTargetPercent) || 0, 0), 100)
  const benchmarkDI = getGearQualityBenchmark(item, futurePotentialMultiplier)
  const targetScore = Math.ceil(benchmarkDI * targetQuality / 100 * ratingScale)
  let fixedScore = 0
  const rollableLines = []

  for (const lineIndex of lineOrder) {
    const stat = statTypes[lineIndex]
    const statInfo = item.Stats[stat]
    if (!statInfo || statInfo.DI <= 0) {
      continue
    }

    const currentValue = getInputValue(statInputs, lineIndex)
    const hasValue = hasRolledValue(statInputs, lineIndex)
    const linePotentialMultiplier = hasValue
      ? remainingPotentialMultiplier
      : futurePotentialMultiplier
    const upgradeMinValue = normalizeStatValue(
      statInfo,
      statInfo.Potential[0] * linePotentialMultiplier,
    )
    const upgradeScore = Math.round(
      upgradeMinValue / statInfo.Value * statInfo.DI * ratingScale,
    )

    if (hasValue) {
      fixedScore += upgradeScore
      fixedScore += Math.round(currentValue / statInfo.Value * statInfo.DI * ratingScale)
      continue
    }

    rollableLines.push({
      index: lineIndex,
      upgradeScore,
      enchantMethod: getOddsEnchantMethod(gearType, lineEnchantMethods?.[lineIndex]),
      distribution: getRollDistribution(
        getStatStep(stat),
        statInfo.Value,
        getStatStep(stat),
        statInfo.Value,
        statInfo.DI,
      ),
    })
  }

  if (fixedScore >= targetScore) {
    return {
      pendingOrder: rollableLines.map((line) => line.index),
      totalChance: 1,
    }
  }

  const subsetCount = 2 ** rollableLines.length
  const activeOutcomesBySubset = Array(subsetCount)
  activeOutcomesBySubset[0] = new Map([[fixedScore, 1]])

  for (let subset = 1; subset < subsetCount; subset++) {
    const linePosition = getFirstSetBitIndex(subset)
    const previousSubset = subset & ~(1 << linePosition)
    activeOutcomesBySubset[subset] = getRemainingQualityOutcomes(
      activeOutcomesBySubset[previousSubset],
      rollableLines[linePosition],
      targetScore,
    )
  }

  const bestChanceBySubset = Array(subsetCount).fill(Number.NEGATIVE_INFINITY)
  const bestOrderBySubset = Array(subsetCount)
  bestChanceBySubset[0] = 0
  bestOrderBySubset[0] = []

  for (let subset = 0; subset < subsetCount; subset++) {
    for (let linePosition = 0; linePosition < rollableLines.length; linePosition++) {
      const lineBit = 1 << linePosition
      if (subset & lineBit) {
        continue
      }

      const nextSubset = subset | lineBit
      const candidateChance = bestChanceBySubset[subset] + getQualityFinishChance(
        activeOutcomesBySubset[subset],
        rollableLines[linePosition],
        targetScore,
      )

      if (candidateChance > bestChanceBySubset[nextSubset] + Number.EPSILON) {
        bestChanceBySubset[nextSubset] = candidateChance
        bestOrderBySubset[nextSubset] = [
          ...bestOrderBySubset[subset],
          rollableLines[linePosition].index,
        ]
      }
    }
  }

  return {
    pendingOrder: bestOrderBySubset[subsetCount - 1] ?? [],
    totalChance: Math.max(bestChanceBySubset[subsetCount - 1], 0),
  }
}

function getFirstSetBitIndex(value) {
  for (let index = 0; index < 32; index++) {
    if (value & (1 << index)) {
      return index
    }
  }
  return 0
}

function getRemainingQualityOutcomes(activeOutcomes, line, targetScore) {
  const nextOutcomes = new Map()
  activeOutcomes.forEach((currentProbability, currentScore) => {
    const survivedProbability = currentProbability * line.enchantMethod.successRate
    line.distribution.forEach((roll) => {
      const nextScore = currentScore + line.upgradeScore + roll.score
      if (nextScore >= targetScore) {
        return
      }

      const nextProbability = survivedProbability * roll.probability
      nextOutcomes.set(nextScore, (nextOutcomes.get(nextScore) || 0) + nextProbability)
    })
  })
  return nextOutcomes
}

function getQualityFinishChance(activeOutcomes, line, targetScore) {
  let finishChance = 0
  activeOutcomes.forEach((currentProbability, currentScore) => {
    const survivedProbability = currentProbability * line.enchantMethod.successRate
    line.distribution.forEach((roll) => {
      if (currentScore + line.upgradeScore + roll.score >= targetScore) {
        finishChance += survivedProbability * roll.probability
      }
    })
  })
  return finishChance
}

function sumOutcomeProbabilities(outcomes) {
  let total = 0
  outcomes.forEach((probability) => {
    total += probability
  })
  return total
}

function clampProbability(probability) {
  return Math.min(Math.max(probability, 0), 1)
}

function getStartsForConfidence(probability, confidence) {
  if (probability <= 0) {
    return null
  }
  if (probability >= 1) {
    return 1
  }

  return Math.ceil(Math.log(1 - confidence) / Math.log(1 - probability))
}
