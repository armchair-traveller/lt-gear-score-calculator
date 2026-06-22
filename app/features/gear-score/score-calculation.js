import {
  decimalStats,
  getOddsEnchantMethod,
  qualityOddsGearTypes,
  ratingScale,
} from '@/features/gear-score/data.js'
import {
  createEmptyIndividualResult,
  formatBaseRollSummary,
  formatProbability,
  formatRange,
  formatStatValue,
  getRollDistribution,
  getTierForPercent,
} from '@/features/gear-score/helpers.js'

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
    plannedQualityText: '',
    showProjectedQuality: true,
    benchmarkDI: 0,
    baseRollText: '',
    lines: [],
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
    const potentialValueMin = currentValue + pot[0] * remainingPotentialMultiplier
    const potentialValueMax = currentValue + pot[1] * remainingPotentialMultiplier

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

  return statInfo.Value + (statInfo.Potential?.[1] ?? 0) * upgradeCount
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
    const value = Number(rawValue)
    const weight = Number.isFinite(lineWeights[index]) ? lineWeights[index] : 1
    const hasInput = rawValue !== '' && rawValue !== null && rawValue !== undefined && value !== 0
    const filled = Number.isFinite(value) && value > 0
    const finalMaxValue = getFinalStatValue(statInfo, upgradeCount)
    const currentDI = getStatRatingForValue(statInfo, value) * weight
    const ceilingDI = getStatRatingForValue(statInfo, finalMaxValue) * weight
    const valid = filled && Boolean(statInfo) && value <= finalMaxValue
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

function calculateQualityOdds({
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
    const upgradeMinValue = potential[0] * linePotentialMultiplier
    const upgradeMaxValue = potential[1] * linePotentialMultiplier
    const upgradeScore = Math.round(upgradeMinValue / maxValue * maxDI * ratingScale)
    const finalMaxValue = getFinalStatValue(statInfo, futurePotentialMultiplier)

    let lineMinValue = hasValue ? currentValue : step
    let lineMaxValue = hasValue ? currentValue : maxValue
    lineMinValue += upgradeMinValue
    lineMaxValue += upgradeMaxValue

    if (hasValue) {
      hasRolledLines = true
      rolledMinRating += lineMinValue / maxValue * maxDI
      rolledMaxRating += lineMaxValue / maxValue * maxDI
    }

    if (!shouldRollLine) {
      // Non-damaging lines are ignored for SSS attempts, so they add no survival risk.
    }
    else if (hasValue) {
      fixedScore += upgradeScore
      fixedScore += Math.round(currentValue / maxValue * maxDI * ratingScale)
    }
    else {
      futureBaseLines += 1
      const enchantMethod = getOddsEnchantMethod(gearType, lineEnchantMethods?.[lineIndex])
      rollableFutureLines.push({
        upgradeScore,
        enchantMethod,
        distribution: getRollDistribution(step, maxValue, step, maxValue, maxDI),
      })
    }

    plannedMinRating += lineMinValue / maxValue * maxDI
    plannedMaxRating += lineMaxValue / maxValue * maxDI
    const projectedValue = hasValue ? currentValue + upgradeMaxValue : null
    lines.push({
      index: lineIndex,
      stat,
      range: shouldRollLine ? formatRange(lineMinValue, lineMaxValue, stat) : 'Ignored',
      rollText: !shouldRollLine ? 'not rolled' : hasValue ? linePotentialMultiplier > 0 ? 'already rolled' : 'complete' : 'needs base roll',
      status: !shouldRollLine ? 'ignored' : hasValue ? 'upgrade' : 'new',
      maxRollPercent: hasValue && finalMaxValue > 0 ? projectedValue / finalMaxValue * 100 : null,
    })
  }

  let activeOutcomes = fixedScore >= targetScore ? new Map() : new Map([[fixedScore, 1]])
  let totalChance = fixedScore >= targetScore ? 1 : 0

  for (const line of rollableFutureLines) {
    if (activeOutcomes.size === 0) {
      break
    }

    const nextOutcomes = new Map()

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
  }

  const isAlreadyComplete = fixedScore >= targetScore
  const survivalChance = isAlreadyComplete
    ? 1
    : rollableFutureLines.reduce(
        (probability, line) => probability * line.enchantMethod.successRate,
        1,
      )
  const plannedMinQuality = benchmarkDI > 0 ? plannedMinRating / benchmarkDI * 100 : 0
  const plannedMaxQuality = benchmarkDI > 0 ? plannedMaxRating / benchmarkDI * 100 : 0
  const qualityMin = benchmarkDI > 0 ? rolledMinRating / benchmarkDI * 100 : 0
  const qualityMax = benchmarkDI > 0 ? rolledMaxRating / benchmarkDI * 100 : 0
  const qualityText = hasRolledLines ? formatQualityRange(qualityMin, qualityMax) : '—'
  const plannedQualityText = formatQualityRange(plannedMinQuality, plannedMaxQuality)
  const showProjectedQuality = qualityText !== plannedQualityText

  return {
    available: true,
    totalChance,
    totalChanceText: formatProbability(totalChance),
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
    plannedQualityText,
    showProjectedQuality,
    benchmarkDI,
    lines,
  }
}
