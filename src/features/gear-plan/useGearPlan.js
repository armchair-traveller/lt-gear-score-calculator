import { computed, ref } from 'vue'
import gears from '@/utils/gear.js'
import {
  gearPlanSlots,
  getGearPlanSlotId,
} from '@/features/gear-plan/data.js'
import {
  createEmptyGearPlan,
  encodeGearPlanShare,
  parseGearPlanShare,
  readStoredGearPlan,
  writeStoredGearPlan,
} from '@/features/gear-plan/plan-state.js'
import {
  calculateGearPlanItem,
  getFinalStatValue,
  getStatStep,
} from '@/features/gear-score/score-calculation.js'
import { formatStatValue } from '@/features/gear-score/helpers.js'

export function useGearPlan() {
  const basePath = window.location.pathname.replace(/\/plan\/?$/, '').replace(/\/?$/, '/')
  const homeHref = basePath || '/'
  const planHref = `${basePath}plan`
  const upgradeHref = `${basePath}upgrade`
  const localPlan = ref(readStoredGearPlan())
  const sortMode = ref('impact')
  const shareCopied = ref(false)
  const shareCopyTimeout = ref(null)
  const editorOpen = ref(false)
  const editorSlotId = ref('')
  const editorStatType = ref([])
  const editorStatInput = ref([])
  const editorPickerOpen = ref([])

  const shareParam = new URLSearchParams(window.location.search).get('gp')
  const parsedShare = shareParam ? parseGearPlanShare(shareParam) : { plan: null, error: '' }
  const sharedPlan = ref(parsedShare.plan)
  const shareError = ref(parsedShare.error)
  const isSharedPreview = computed(() => Boolean(sharedPlan.value))
  const displayedPlan = computed(() => sharedPlan.value ?? localPlan.value)

  const imgUrls = import.meta.glob('/src/assets/*.png', {
    import: 'default',
    eager: true,
  })

  const slotModels = computed(() => gearPlanSlots.map((slot, index) => {
    const id = getGearPlanSlotId(slot.gearType, slot.pieceType)
    const item = gears[slot.gearType][slot.pieceType]
    const entry = displayedPlan.value.slots[id]
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

  const eligibleSlots = computed(() => slotModels.value.filter((slot) => slot.result.eligible))
  const rankedSlots = computed(() => {
    const rows = eligibleSlots.value.slice()
    if (sortMode.value === 'quality') {
      return rows.sort((a, b) =>
        a.result.qualityPercent - b.result.qualityPercent ||
        b.result.opportunityDI - a.result.opportunityDI ||
        a.index - b.index,
      )
    }

    return rows.sort((a, b) =>
      b.result.opportunityDI - a.result.opportunityDI ||
      a.result.qualityPercent - b.result.qualityPercent ||
      a.index - b.index,
    )
  })
  const topPriority = computed(() =>
    rankedSlots.value.find((slot) => slot.result.opportunityDI > 0.0001) ?? null,
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
    totalBenchmarkDI.value > 0 ? totalCurrentDI.value / totalBenchmarkDI.value * 100 : 0,
  )
  const maxChartDI = computed(() =>
    Math.max(...slotModels.value.map((slot) =>
      Math.max(slot.result.benchmarkDI, slot.result.currentDI),
    ), 1),
  )
  const categoryGroups = computed(() => {
    const groups = []
    for (const slot of slotModels.value) {
      let group = groups.find((row) => row.gearType === slot.gearType)
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

  const selectedSlot = computed(() =>
    slotModels.value.find((slot) => slot.id === editorSlotId.value) ?? null,
  )
  const selectedItem = computed(() => selectedSlot.value?.item ?? null)
  const editorStatOptions = computed(() => Object.keys(selectedItem.value?.Stats ?? {}))
  const editorResult = computed(() => calculateGearPlanItem({
    item: selectedItem.value,
    statTypes: editorStatType.value,
    statInputs: editorStatInput.value,
    upgradeCount: selectedSlot.value?.upgradeCount ?? 0,
    lineWeights: selectedSlot.value?.lineWeights,
  }))

  function getItemImage(piece, category) {
    return imgUrls[`/src/assets/${piece}_${category.slice(1, 5)}.png`] ?? ''
  }

  function openEditor(slotId) {
    const slot = slotModels.value.find((row) => row.id === slotId)
    if (!slot) {
      return
    }

    editorSlotId.value = slotId
    editorStatType.value = (slot.entry?.statType ?? slot.item.Optimal).slice()
    editorStatInput.value = slot.entry
      ? slot.entry.statInput.map((value) => value > 0 ? value : '')
      : ['', '', '', '', '']
    editorPickerOpen.value = []
    editorOpen.value = true
  }

  function isEditorStatSelectedOnOtherLine(stat, index) {
    if (stat === 'Other (Non-damaging)') {
      return false
    }

    return editorStatType.value.some((selected, selectedIndex) =>
      selectedIndex !== index && selected === stat,
    )
  }

  function selectEditorStat(index, stat) {
    if (isEditorStatSelectedOnOtherLine(stat, index)) {
      return
    }

    editorStatType.value[index] = stat
    editorPickerOpen.value[index] = false
  }

  function setEditorPickerOpen(index, value) {
    editorPickerOpen.value[index] = value
  }

  function setEditorInput(index, value) {
    editorStatInput.value[index] = value
  }

  function getEditorMaxValue(stat) {
    const statInfo = selectedItem.value?.Stats?.[stat]
    return statInfo ? getFinalStatValue(statInfo, selectedSlot.value?.upgradeCount ?? 0) : null
  }

  function getEditorLineMaxSummaryText(index) {
    const stat = editorStatType.value[index]
    const statInfo = selectedItem.value?.Stats?.[stat]
    const maxValue = getEditorMaxValue(stat)
    if (!statInfo || maxValue === null) {
      return 'Max -'
    }

    const weight = selectedSlot.value?.lineWeights?.[index] ?? 1
    const maxDI = maxValue / statInfo.Value * statInfo.DI * weight
    return `Max ${formatStatValue(maxValue, stat)} / ${maxDI.toFixed(2)}%`
  }

  function isEditorInputOverMax(index) {
    const max = getEditorMaxValue(editorStatType.value[index])
    const value = Number(editorStatInput.value[index])
    return max !== null && Number.isFinite(value) && value > max
  }

  function saveEditor() {
    if (isSharedPreview.value || !selectedSlot.value || !editorResult.value.eligible) {
      return false
    }

    const nextPlan = {
      version: 1,
      slots: {
        ...localPlan.value.slots,
        [selectedSlot.value.id]: {
          gearType: selectedSlot.value.gearType,
          pieceType: selectedSlot.value.pieceType,
          statType: editorStatType.value.slice(),
          statInput: editorStatInput.value.map((value) => Number(value)),
        },
      },
    }
    localPlan.value = writeStoredGearPlan(nextPlan)
    editorOpen.value = false
    return true
  }

  function deleteSelectedSlot() {
    if (isSharedPreview.value || !selectedSlot.value?.entry) {
      return
    }

    const nextPlan = {
      version: 1,
      slots: { ...localPlan.value.slots },
    }
    delete nextPlan.slots[selectedSlot.value.id]
    localPlan.value = writeStoredGearPlan(nextPlan)
    editorOpen.value = false
  }

  function resetPlan() {
    if (isSharedPreview.value) {
      return
    }

    localPlan.value = writeStoredGearPlan(createEmptyGearPlan())
    editorOpen.value = false
  }

  async function copyShareLink() {
    if (!eligibleSlots.value.length) {
      return
    }

    const value = encodeGearPlanShare(displayedPlan.value)
    const url = `${window.location.origin}${planHref}?gp=${encodeURIComponent(value)}`

    try {
      await navigator.clipboard.writeText(url)
      clearTimeout(shareCopyTimeout.value)
      shareCopied.value = true
      shareCopyTimeout.value = setTimeout(() => {
        shareCopied.value = false
      }, 1800)
    }
    catch (error) {
      console.error(error)
    }
  }

  function useSharedPlan() {
    if (!sharedPlan.value) {
      return
    }

    localPlan.value = writeStoredGearPlan(sharedPlan.value)
    window.location.href = planHref
  }

  function returnToMyPlan() {
    window.location.href = planHref
  }

  function getPrimaryReason(slot) {
    if (!slot?.result?.eligible) {
      return 'Unranked'
    }
    if (slot.result.aboveBenchmark || slot.result.opportunityDI <= 0) {
      return slot.result.aboveBenchmark ? 'Above curated benchmark' : 'At curated benchmark'
    }
    if (slot.result.pieceGapDI > slot.result.rollGapDI) {
      return 'Piece replacement is the larger gap'
    }
    if (slot.result.rollGapDI > 0) {
      return 'Roll values are the larger gap'
    }
    return 'Close to the curated benchmark'
  }

  function getLineStatusLabel(result) {
    if (result?.lineStatus === 'penta') {
      return 'Penta'
    }
    if (result?.lineStatus === 'partial') {
      return 'Partial'
    }
    return 'Unranked'
  }

  return {
    homeHref,
    planHref,
    upgradeHref,
    sortMode,
    shareCopied,
    editorOpen,
    editorStatType,
    editorStatInput,
    editorPickerOpen,
    shareError,
    isSharedPreview,
    displayedPlan,
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
    selectedSlot,
    editorStatOptions,
    editorResult,
    openEditor,
    isEditorStatSelectedOnOtherLine,
    selectEditorStat,
    setEditorPickerOpen,
    setEditorInput,
    getEditorMaxValue,
    getEditorLineMaxSummaryText,
    isEditorInputOverMax,
    saveEditor,
    deleteSelectedSlot,
    resetPlan,
    copyShareLink,
    useSharedPlan,
    returnToMyPlan,
    getPrimaryReason,
    getLineStatusLabel,
    getStatStep,
  }
}
