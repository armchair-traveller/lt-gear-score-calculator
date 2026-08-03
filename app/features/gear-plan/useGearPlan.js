import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from '#app'
import {
  encodeGearPlanShare,
  parseGearPlanShare,
} from '@/features/gear-plan/plan-state.js'
import { useGearPlanReadModel } from '@/features/gear-plan/useGearPlanReadModel.js'
import {
  getGearPlanEntryCalculatorPath,
} from '@/features/gear-plan/gear-share-url.js'
import {
  calculateGearPlanItem,
  getFinalStatValue,
  isStatValueOverMax,
  getStatStep,
} from '@/features/gear-score/score-calculation.js'
import {
  formatMaxRollPercent,
  formatStatValue,
  getMaxRollPercentClass,
} from '@/features/gear-score/helpers.js'

export function useGearPlan() {
  const route = useRoute()
  const router = useRouter()
  const persistence = useGearPlanPersistence()
  const { isSessionPending, isSignedIn } = useAuth()
  const homeHref = computed(() => router.resolve('/').href)
  const upgradeHref = computed(() => router.resolve('/upgrade').href)
  const localPlan = persistence.plan
  const shareCopied = ref(false)
  const sharePending = ref(false)
  const shareFailed = ref(false)
  const shareCopyTimeout = ref(null)
  const snapshotCopied = ref(false)
  const snapshotCopyTimeout = ref(null)
  const gearShareCopyStatus = ref('idle')
  const gearShareCopyTimeout = ref(null)
  const lastSavedSlotId = ref('')
  const saveFeedbackMessage = ref('')
  const saveFeedbackTimeout = ref(null)
  const hasAcceptedPlannerNotes = localStorage.getItem('ltGearPlanNotesAccepted') === 'true'
  const plannerNotesOpen = ref(!hasAcceptedPlannerNotes)
  const editorOpen = ref(false)
  const editorSlotId = ref('')
  const editorStatType = ref([])
  const editorStatInput = ref([])
  const editorPickerOpen = ref([])

  const sharedPlan = ref(null)
  const shareError = ref('')
  const isSharedPreview = computed(() => Boolean(sharedPlan.value))
  const displayedPlan = computed(() => sharedPlan.value ?? localPlan.value)
  const {
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
    getPrimaryReason,
    getLineStatusLabel,
  } = useGearPlanReadModel(displayedPlan)
  const shareUsesPublicBuild = computed(() =>
    isSignedIn.value && !isSharedPreview.value,
  )
  const canCopyShareLink = computed(() => {
    if (!eligibleSlots.value.length || sharePending.value) {
      return false
    }
    if (isSharedPreview.value) {
      return true
    }
    if (isSessionPending.value) {
      return false
    }
    if (!isSignedIn.value) {
      return true
    }
    return persistence.syncStatus.value === 'saved'
  })

  watch(
    () => route.query.gp,
    syncSharedPreview,
    { immediate: true },
  )

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

  function syncSharedPreview(value) {
    const shareParam = getQueryValue(value)
    if (!shareParam) {
      sharedPlan.value = null
      shareError.value = ''
      return
    }

    const parsedShare = parseGearPlanShare(shareParam)
    sharedPlan.value = parsedShare.plan
    shareError.value = parsedShare.error
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
    setGearShareCopyStatus('idle')
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

  function getEditorLineMaxPercentText(index) {
    const line = editorResult.value.lines[index]
    if (!line?.filled || !Number.isFinite(line.maxPercent)) {
      return ''
    }

    return formatMaxRollPercent(line.maxPercent)
  }

  function getEditorLineMaxPercentClass(index) {
    const line = editorResult.value.lines[index]
    if (!line?.filled || !Number.isFinite(line.maxPercent)) {
      return ''
    }
    return getMaxRollPercentClass(line.maxPercent)
  }

  function isEditorInputOverMax(index) {
    const stat = editorStatType.value[index]
    const statInfo = selectedItem.value?.Stats?.[stat]
    const max = getEditorMaxValue(stat)
    const value = Number(editorStatInput.value[index])
    return max !== null && Number.isFinite(value) && isStatValueOverMax(statInfo, value, max)
  }

  function saveEditor() {
    if (isSharedPreview.value || !selectedSlot.value || !editorResult.value.eligible) {
      return false
    }

    const savedSlot = selectedSlot.value
    const saved = persistence.saveEntry({
      gearType: savedSlot.gearType,
      pieceType: savedSlot.pieceType,
      statType: editorStatType.value.slice(),
      statInput: editorStatInput.value.map((value) => Number(value)),
    })
    if (!saved) {
      return false
    }

    clearTimeout(saveFeedbackTimeout.value)
    lastSavedSlotId.value = savedSlot.id
    saveFeedbackMessage.value = `${savedSlot.pieceType} saved. Upgrade priority updated.`
    saveFeedbackTimeout.value = setTimeout(() => {
      lastSavedSlotId.value = ''
      saveFeedbackMessage.value = ''
    }, 1800)
    editorOpen.value = false
    return true
  }

  function deleteSelectedSlot() {
    if (isSharedPreview.value || !selectedSlot.value?.entry) {
      return false
    }

    if (!persistence.deleteEntry(selectedSlot.value.id)) {
      return false
    }

    editorOpen.value = false
    return true
  }

  function resetPlan() {
    if (isSharedPreview.value) {
      return false
    }

    if (!persistence.resetPlan()) {
      return false
    }

    editorOpen.value = false
    return true
  }

  async function copyShareLink() {
    if (!canCopyShareLink.value) {
      return false
    }

    const usesPublicBuild = shareUsesPublicBuild.value
    shareFailed.value = false
    sharePending.value = usesPublicBuild

    try {
      const url = usesPublicBuild
        ? getAbsoluteHref(await createPublicBuildPath())
        : getSnapshotShareUrl()
      await navigator.clipboard.writeText(url)
      clearTimeout(shareCopyTimeout.value)
      shareCopied.value = true
      shareCopyTimeout.value = setTimeout(() => {
        shareCopied.value = false
      }, 1800)
      return true
    }
    catch {
      console.error('[gear-plan-share] plan_link_copy_failed')
      shareFailed.value = true
      return false
    }
    finally {
      sharePending.value = false
    }
  }

  async function copySnapshotLink() {
    if (!eligibleSlots.value.length) {
      return false
    }

    try {
      await navigator.clipboard.writeText(getSnapshotShareUrl())
      clearTimeout(snapshotCopyTimeout.value)
      snapshotCopied.value = true
      snapshotCopyTimeout.value = setTimeout(() => {
        snapshotCopied.value = false
      }, 1800)
      return true
    }
    catch {
      console.error('[gear-plan-share] snapshot_link_copy_failed')
      return false
    }
  }

  async function createPublicBuildPath() {
    const response = await $fetch('/api/gear-plan/share', {
      method: 'POST',
      body: {},
    })
    const slug = String(response?.slug ?? '')
    const path = String(response?.path ?? '')
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || path !== `/build/${slug}`) {
      throw new TypeError('The public build response is invalid.')
    }
    return path
  }

  function getSnapshotShareUrl() {
    const value = encodeGearPlanShare(displayedPlan.value)
    return getAbsoluteHref({
      path: '/plan',
      query: { gp: value },
    })
  }

  async function copySelectedGearLink() {
    const path = getGearPlanEntryCalculatorPath(selectedSlot.value)
    if (!path) {
      setGearShareCopyStatus('failed')
      return false
    }

    try {
      await navigator.clipboard.writeText(getAbsoluteHref(path))
      setGearShareCopyStatus('copied')
      return true
    }
    catch {
      console.error('[gear-plan-share] gear_link_copy_failed')
      setGearShareCopyStatus('failed')
      return false
    }
  }

  function setGearShareCopyStatus(status) {
    clearTimeout(gearShareCopyTimeout.value)
    gearShareCopyStatus.value = status
    if (status === 'idle') {
      return
    }

    gearShareCopyTimeout.value = setTimeout(() => {
      gearShareCopyStatus.value = 'idle'
    }, 1800)
  }

  function useSharedPlan() {
    if (!sharedPlan.value) {
      return false
    }

    if (!persistence.replacePlan(sharedPlan.value)) {
      return false
    }

    void router.push('/plan')
    return true
  }

  function acceptPlannerNotes() {
    localStorage.setItem('ltGearPlanNotesAccepted', 'true')
    plannerNotesOpen.value = false
  }

  function getAbsoluteHref(to) {
    return new URL(router.resolve(to).href, window.location.origin).toString()
  }

  function getQueryValue(value) {
    return Array.isArray(value) ? value[0] : value
  }

  onBeforeUnmount(() => {
    clearTimeout(shareCopyTimeout.value)
    clearTimeout(snapshotCopyTimeout.value)
    clearTimeout(gearShareCopyTimeout.value)
    clearTimeout(saveFeedbackTimeout.value)
  })

  return {
    homeHref,
    upgradeHref,
    sortMode,
    shareCopied,
    sharePending,
    shareFailed,
    snapshotCopied,
    shareUsesPublicBuild,
    canCopyShareLink,
    gearShareCopyStatus,
    lastSavedSlotId,
    saveFeedbackMessage,
    plannerNotesOpen,
    editorOpen,
    editorStatType,
    editorStatInput,
    editorPickerOpen,
    shareError,
    isSharedPreview,
    displayedPlan,
    syncStatus: persistence.syncStatus,
    pauseReason: persistence.pauseReason,
    conflict: persistence.conflict,
    localUpdatedAt: persistence.localUpdatedAt,
    entryCount: persistence.entryCount,
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
    getEditorLineMaxPercentText,
    getEditorLineMaxPercentClass,
    isEditorInputOverMax,
    saveEditor,
    deleteSelectedSlot,
    resetPlan,
    replacePlan: persistence.replacePlan,
    retry: persistence.retry,
    useCloudPlan: persistence.useCloudPlan,
    replaceCloudWithDevice: persistence.replaceCloudWithDevice,
    copyShareLink,
    copySnapshotLink,
    copySelectedGearLink,
    useSharedPlan,
    acceptPlannerNotes,
    getPrimaryReason,
    getLineStatusLabel,
    getStatStep,
  }
}
