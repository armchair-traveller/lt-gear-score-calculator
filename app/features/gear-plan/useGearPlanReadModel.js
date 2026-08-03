import { computed, ref, unref } from 'vue'
import gears from '@/utils/gear.js'
import {
  gearPlanSlots,
  getGearPlanSlotId,
} from '@/features/gear-plan/data.js'
import { calculateGearPlanItem } from '@/features/gear-score/score-calculation.js'

const imgUrls = import.meta.glob('../../assets/*.png', {
  import: 'default',
  eager: true,
})

export function useGearPlanReadModel(plan, options = {}) {
  const sortMode = options.sortMode ?? ref('impact')

  const slotModels = computed(() => gearPlanSlots.map((slot, index) => {
    const id = getGearPlanSlotId(slot.gearType, slot.pieceType)
    const item = gears[slot.gearType][slot.pieceType]
    const entry = unref(plan)?.slots?.[id]
    const result = calculateGearPlanItem({
      item,
      statTypes: entry?.statType ?? [],
      statInputs: entry?.statInput ?? [],
      upgradeCount: slot.upgradeCount,
      lineWeights: slot.lineWeights,
    })

    return {
      ...slot,
      id,
      index,
      item,
      entry,
      result,
      image: getItemImage(slot.pieceType, slot.gearType),
    }
  }))

  const eligibleSlots = computed(() =>
    slotModels.value.filter(slot => slot.result.eligible),
  )
  const rankedSlots = computed(() => {
    const rows = eligibleSlots.value.slice()
    if (sortMode.value === 'quality') {
      return rows.sort((a, b) =>
        a.result.qualityPercent - b.result.qualityPercent
        || b.result.opportunityDI - a.result.opportunityDI
        || a.index - b.index,
      )
    }

    return rows.sort((a, b) =>
      b.result.opportunityDI - a.result.opportunityDI
      || a.result.qualityPercent - b.result.qualityPercent
      || a.index - b.index,
    )
  })
  const topPriority = computed(() =>
    rankedSlots.value.find(slot => slot.result.opportunityDI > 0.0001) ?? null,
  )
  const totalCurrentDI = computed(() =>
    eligibleSlots.value.reduce((total, slot) => total + slot.result.currentDI, 0),
  )
  const totalBenchmarkDI = computed(() =>
    eligibleSlots.value.reduce((total, slot) => total + slot.result.benchmarkDI, 0),
  )
  const totalOpportunityDI = computed(() =>
    eligibleSlots.value.reduce((total, slot) => total + slot.result.opportunityDI, 0),
  )
  const loadoutQualityPercent = computed(() =>
    totalBenchmarkDI.value > 0
      ? totalCurrentDI.value / totalBenchmarkDI.value * 100
      : 0,
  )
  const maxChartDI = computed(() =>
    Math.max(...slotModels.value.map(slot =>
      Math.max(slot.result.benchmarkDI, slot.result.currentDI),
    ), 1),
  )
  const categoryGroups = computed(() => {
    const groups = []
    for (const slot of slotModels.value) {
      let group = groups.find(row => row.gearType === slot.gearType)
      if (!group) {
        group = {
          gearType: slot.gearType,
          slots: [],
        }
        groups.push(group)
      }
      group.slots.push(slot)
    }
    return groups
  })

  return {
    sortMode,
    slotModels,
    eligibleSlots,
    rankedSlots,
    topPriority,
    totalCurrentDI,
    totalBenchmarkDI,
    totalOpportunityDI,
    loadoutQualityPercent,
    maxChartDI,
    categoryGroups,
    getPrimaryReason: getGearPlanPrimaryReason,
    getLineStatusLabel: getGearPlanLineStatusLabel,
  }
}

function getItemImage(piece, category) {
  return imgUrls[`../../assets/${piece}_${category.slice(1, 5)}.png`] ?? ''
}

export function getGearPlanPrimaryReason(slot) {
  if (!slot?.result?.eligible) {
    return 'Unranked'
  }
  if (slot.result.aboveBenchmark || slot.result.opportunityDI <= 0) {
    return slot.result.aboveBenchmark
      ? 'Above curated benchmark'
      : 'At curated benchmark'
  }
  if (slot.result.pieceGapDI > slot.result.rollGapDI) {
    return 'Piece replacement is the larger gap'
  }
  if (slot.result.rollGapDI > 0) {
    return 'Roll values are the larger gap'
  }
  return 'Close to the curated benchmark'
}

export function getGearPlanLineStatusLabel(result) {
  if (result?.lineStatus === 'penta') {
    return 'Penta'
  }
  if (result?.lineStatus === 'partial') {
    return 'Partial'
  }
  return 'Unranked'
}
