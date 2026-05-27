import {
  decimalStats,
  enchantSuccessRate,
  ratingScale,
  sssOddsGearTypes,
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
    sssOdds: getEmptySssOdds(),
  }
}

export function getEmptySssOdds() {
  return {
    available: false,
    totalChance: 0,
    totalChanceText: '',
    survivalChance: 0,
    survivalChanceText: '',
    rollValueChance: 0,
    rollValueChanceText: '',
    futureRolls: 0,
    futureBaseLines: 0,
    upgradeRolls: 0,
    targetScore: '',
    plannedScoreText: '',
    plannedDIText: '',
    baseRollText: '',
    lines: [],
  }
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
  sssOrder,
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
  result.sssOdds = calculateSssOdds({
    gearType,
    item,
    tierEquivalence,
    statTypes,
    statInputs,
    sssOrder,
    remainingPotentialMultiplier,
    futurePotentialMultiplier,
  })

  return {
    result,
    validStats,
  }
}

function calculateSssOdds({
  gearType,
  item,
  tierEquivalence,
  statTypes,
  statInputs,
  sssOrder,
  remainingPotentialMultiplier,
  futurePotentialMultiplier,
}) {
  if (!sssOddsGearTypes.includes(gearType) || !tierEquivalence.SSS) {
    return getEmptySssOdds()
  }

  const targetPercent = parseInt(tierEquivalence.SSS.Penta)
  const targetRating = item.DI * targetPercent / 100
  const targetScore = Math.ceil(targetRating * ratingScale)

  let fixedScore = 0
  let futureBaseLines = 0
  let plannedMinRating = 0
  let plannedMaxRating = 0
  const lines = []
  const rollableFutureLines = []

  for (const lineIndex of sssOrder) {
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

    let lineMinValue = hasValue ? currentValue : step
    let lineMaxValue = hasValue ? currentValue : maxValue
    lineMinValue += upgradeMinValue
    lineMaxValue += upgradeMaxValue

    if (!shouldRollLine) {
      // Non-damaging lines are ignored for SSS attempts, so they add no survival risk.
    }
    else if (hasValue) {
      fixedScore += upgradeScore
      fixedScore += Math.round(currentValue / maxValue * maxDI * ratingScale)
    }
    else {
      futureBaseLines += 1
      rollableFutureLines.push({
        upgradeScore,
        distribution: getRollDistribution(step, maxValue, step, maxValue, maxDI),
      })
    }

    plannedMinRating += lineMinValue / maxValue * maxDI
    plannedMaxRating += lineMaxValue / maxValue * maxDI
    lines.push({
      index: lineIndex,
      stat,
      range: shouldRollLine ? formatRange(lineMinValue, lineMaxValue, stat) : 'Ignored',
      rollText: !shouldRollLine ? 'not rolled' : hasValue ? linePotentialMultiplier > 0 ? 'already rolled' : 'complete' : '60% base roll',
      status: !shouldRollLine ? 'ignored' : hasValue ? 'upgrade' : 'new',
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
      const survivedProbability = currentProbability * enchantSuccessRate

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
  const survivalChance = isAlreadyComplete ? 1 : Math.pow(enchantSuccessRate, futureBaseLines)
  const rollValueChance = totalChance
  const plannedMinPercent = parseInt(plannedMinRating / item.DI * 100)
  const plannedMaxPercent = parseInt(plannedMaxRating / item.DI * 100)
  const plannedScoreText = plannedMinPercent === plannedMaxPercent
    ? plannedMinPercent + '%'
    : plannedMinPercent + '% ~ ' + plannedMaxPercent + '%'
  const plannedDIText = plannedMinRating.toFixed(2) === plannedMaxRating.toFixed(2)
    ? plannedMinRating.toFixed(2) + '%'
    : plannedMinRating.toFixed(2) + '% ~ ' + plannedMaxRating.toFixed(2) + '%'

  return {
    available: true,
    totalChance,
    totalChanceText: formatProbability(totalChance),
    survivalChance,
    survivalChanceText: formatProbability(survivalChance),
    rollValueChance,
    rollValueChanceText: formatProbability(rollValueChance),
    futureRolls: futureBaseLines,
    futureBaseLines,
    baseRollText: formatBaseRollSummary(futureBaseLines, isAlreadyComplete),
    upgradeRolls: 0,
    targetScore: targetPercent + '%',
    plannedScoreText,
    plannedDIText,
    lines,
  }
}
