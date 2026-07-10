import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { renderGearSnapshot } from '@/utils/snapshot.js'

export function useGearScoreSnapshot({
  gearType,
  pieceType,
  selectedImage,
  statType,
  resultMode,
  results,
  getFinalUpgrade,
  supportsInputEnchantLevel,
  getInputEnchantLevelNumber,
  getProjectionEnchantLevel,
  hasRolledValue,
  getInputValue,
  formatStatValue,
  getPotentialValueRange,
  getPotentialLineText,
  isInputOverMax,
  updateValues,
}) {
  const snapshotOpen = ref(false)
  const snapshotImageUrl = ref('')
  const snapshotBlob = ref(null)
  const snapshotIsGenerating = ref(false)
  const snapshotError = ref('')
  const snapshotCopySucceeded = ref(false)
  const snapshotDownloadSucceeded = ref(false)
  const snapshotShareSucceeded = ref(false)
  const snapshotCanShare = ref(false)
  const snapshotCanCopy = ref(false)
  const snapshotExportAction = ref('')
  let snapshotObjectUrl = ''
  let snapshotCopySucceededTimeout = null
  let snapshotDownloadSucceededTimeout = null
  let snapshotShareSucceededTimeout = null
  let snapshotGenerationId = 0
  let snapshotTriggerElement = null

  function getSnapshotCurrentLevelLabel(item = gearType.value) {
    if (getFinalUpgrade(item) === '') {
      return 'Current'
    }

    const level = supportsInputEnchantLevel(item) ? getInputEnchantLevelNumber(item) : 2
    return `Lv.${level}`
  }

  function getSnapshotProjectedLevelLabel(item = gearType.value) {
    const finalUpgrade = getFinalUpgrade(item)
    return finalUpgrade ? `Lv.${getProjectionEnchantLevel(item)} ${finalUpgrade}` : 'Current'
  }

  function hasSnapshotProjection(item = gearType.value) {
    if (!getFinalUpgrade(item)) {
      return false
    }

    return !supportsInputEnchantLevel(item)
      || getInputEnchantLevelNumber(item) < getProjectionEnchantLevel(item)
  }

  function getSnapshotItemName() {
    return gearType.value.toLowerCase().includes(pieceType.value.toLowerCase())
      ? gearType.value
      : `${gearType.value} · ${pieceType.value}`
  }

  function getSnapshotPayload() {
    const hasProjection = hasSnapshotProjection()
    const metricMode = resultMode.value === 'rating' ? 'rating' : 'score'
    const currentLevelLabel = getSnapshotCurrentLevelLabel()
    const projectedLevelLabel = getSnapshotProjectedLevelLabel()
    const lines = statType.value.flatMap((stat, index) => {
      const hasValue = hasRolledValue(index)
      if (!hasValue) {
        return []
      }

      const row = results.value.individual[index]

      const line = {
        stat,
        value: formatStatValue(getInputValue(index), stat),
        currentMetric: metricMode === 'rating' ? `${row.DI}%` : `${row.percent}%`,
      }

      if (hasProjection) {
        line.projectedValue = getPotentialValueRange(index)
        line.projectedMetric = getPotentialLineText(index)
      }

      return [line]
    })

    const currentValue = metricMode === 'rating'
      ? `${results.value.DI}%`
      : `${results.value.percent}%`
    const projectedValue = metricMode === 'rating'
      ? results.value.potentialDI
      : results.value.potentialScore
    return {
      itemName: getSnapshotItemName(),
      itemImage: selectedImage.value,
      metricMode,
      current: {
        value: currentValue,
        tier: metricMode === 'score' ? results.value.tier : '',
        levelLabel: currentLevelLabel,
      },
      projected: hasProjection
        ? {
            value: projectedValue,
            tier: metricMode === 'score' ? results.value.potentialTier : '',
            levelLabel: projectedLevelLabel,
          }
        : null,
      lines,
    }
  }

  function clearSnapshotActionFeedback() {
    clearTimeout(snapshotCopySucceededTimeout)
    clearTimeout(snapshotDownloadSucceededTimeout)
    clearTimeout(snapshotShareSucceededTimeout)
    snapshotCopySucceeded.value = false
    snapshotDownloadSucceeded.value = false
    snapshotShareSucceeded.value = false
  }

  function showSnapshotCopySucceeded() {
    clearTimeout(snapshotCopySucceededTimeout)
    snapshotCopySucceeded.value = true
    snapshotCopySucceededTimeout = setTimeout(() => {
      snapshotCopySucceeded.value = false
    }, 1800)
  }

  function showSnapshotDownloadSucceeded() {
    clearTimeout(snapshotDownloadSucceededTimeout)
    snapshotDownloadSucceeded.value = true
    snapshotDownloadSucceededTimeout = setTimeout(() => {
      snapshotDownloadSucceeded.value = false
    }, 1800)
  }

  function showSnapshotShareSucceeded() {
    clearTimeout(snapshotShareSucceededTimeout)
    snapshotShareSucceeded.value = true
    snapshotShareSucceededTimeout = setTimeout(() => {
      snapshotShareSucceeded.value = false
    }, 1800)
  }

  function revokeSnapshotObjectUrl() {
    if (!snapshotObjectUrl) {
      return
    }

    URL.revokeObjectURL(snapshotObjectUrl)
    snapshotObjectUrl = ''
  }

  function clearSnapshotResult() {
    snapshotBlob.value = null
    snapshotImageUrl.value = ''
    revokeSnapshotObjectUrl()
  }

  async function refreshSnapshot() {
    const generationId = ++snapshotGenerationId
    snapshotIsGenerating.value = true
    snapshotError.value = ''
    clearSnapshotActionFeedback()
    clearSnapshotResult()

    try {
      updateValues()
      const blob = await renderGearSnapshot(getSnapshotPayload())

      if (generationId !== snapshotGenerationId) {
        return
      }

      snapshotBlob.value = blob
      snapshotObjectUrl = URL.createObjectURL(blob)
      snapshotImageUrl.value = snapshotObjectUrl
    }
    catch (error) {
      if (generationId !== snapshotGenerationId) {
        return
      }

      console.error(error)
      snapshotError.value = 'Could not build the preview. Try generating it again.'
    }
    finally {
      if (generationId === snapshotGenerationId) {
        snapshotIsGenerating.value = false
      }
    }
  }

  function openSnapshot(triggerElement) {
    if (
      !statType.value.some((_, index) => hasRolledValue(index))
      || statType.value.some((_, index) => isInputOverMax(index))
    ) {
      return
    }

    snapshotTriggerElement = triggerElement instanceof HTMLElement
      ? triggerElement
      : document.activeElement
    snapshotOpen.value = true
    refreshSnapshot()
  }

  async function ensureSnapshotBlob() {
    if (!snapshotBlob.value) {
      await refreshSnapshot()
    }

    return snapshotBlob.value
  }

  function getSnapshotFilename() {
    const finalUpgrade = hasSnapshotProjection() ? getFinalUpgrade(gearType.value) : ''
    const metricMode = resultMode.value === 'rating' ? 'rating' : 'score'
    const levelContext = supportsInputEnchantLevel(gearType.value)
      ? `lv-${getInputEnchantLevelNumber(gearType.value)}`
      : 'current'
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-')
    const itemName = [pieceType.value, gearType.value, levelContext, finalUpgrade, metricMode, date]
      .filter(Boolean)
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    return `lt-gear-${itemName || 'snapshot'}.png`
  }

  async function copySnapshot() {
    if (snapshotExportAction.value) {
      return
    }

    snapshotExportAction.value = 'copy'
    snapshotError.value = ''
    clearSnapshotActionFeedback()

    try {
      const blob = await ensureSnapshotBlob()
      if (!blob) {
        snapshotError.value = 'Snapshot is not ready yet.'
        return
      }

      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        snapshotError.value = 'Image copy is not supported in this browser.'
        return
      }

      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
      showSnapshotCopySucceeded()
    }
    catch (error) {
      console.error(error)
      snapshotError.value = 'Could not copy image.'
    }
    finally {
      snapshotExportAction.value = ''
    }
  }

  async function downloadSnapshot() {
    if (snapshotExportAction.value) {
      return
    }

    snapshotExportAction.value = 'download'
    snapshotError.value = ''
    clearSnapshotActionFeedback()
    let downloadUrl = ''

    try {
      const blob = await ensureSnapshotBlob()
      if (!blob) {
        snapshotError.value = 'Snapshot is not ready yet.'
        return
      }

      downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = getSnapshotFilename()
      document.body.appendChild(link)
      link.click()
      link.remove()
      showSnapshotDownloadSucceeded()
    }
    catch (error) {
      console.error(error)
      snapshotError.value = 'Could not save the PNG. Try copying the image instead.'
    }
    finally {
      snapshotExportAction.value = ''
      if (downloadUrl) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      }
    }
  }

  async function shareSnapshot() {
    if (snapshotExportAction.value) {
      return
    }

    snapshotExportAction.value = 'share'
    snapshotError.value = ''
    clearSnapshotActionFeedback()

    try {
      const blob = await ensureSnapshotBlob()
      if (!blob) {
        snapshotError.value = 'Snapshot is not ready yet.'
        return
      }

      if (typeof File === 'undefined' || !navigator.share || !navigator.canShare) {
        snapshotError.value = 'File sharing is not supported in this browser. Copy or save the PNG instead.'
        return
      }

      const file = new File([blob], getSnapshotFilename(), { type: blob.type })
      if (!navigator.canShare({ files: [file] })) {
        snapshotError.value = 'File sharing is not supported in this browser. Copy or save the PNG instead.'
        return
      }

      await navigator.share({
        files: [file],
        title: `${getSnapshotItemName()} · ${resultMode.value === 'rating' ? 'Rating' : 'Score'} snapshot`,
      })
      showSnapshotShareSucceeded()
    }
    catch (error) {
      if (error?.name === 'AbortError') {
        return
      }

      console.error(error)
      snapshotError.value = 'Could not share the image. Copy or save the PNG instead.'
    }
    finally {
      snapshotExportAction.value = ''
    }
  }

  onMounted(() => {
    snapshotCanCopy.value = Boolean(
      navigator.clipboard?.write && typeof ClipboardItem !== 'undefined',
    )

    if (navigator.share && navigator.canShare && typeof File !== 'undefined') {
      try {
        const testFile = new File([''], 'snapshot.png', { type: 'image/png' })
        snapshotCanShare.value = navigator.canShare({ files: [testFile] })
      }
      catch {
        snapshotCanShare.value = false
      }
    }
  })

  watch(snapshotOpen, (isOpen, wasOpen) => {
    if (isOpen || !wasOpen) {
      return
    }

    snapshotGenerationId += 1
    snapshotIsGenerating.value = false
    snapshotExportAction.value = ''
    clearSnapshotActionFeedback()
    clearSnapshotResult()

    if (!snapshotTriggerElement) {
      return
    }

    const triggerElement = snapshotTriggerElement
    snapshotTriggerElement = null
    nextTick(() => {
      if (triggerElement.isConnected) {
        triggerElement.focus()
      }
    })
  })

  onUnmounted(() => {
    snapshotGenerationId += 1
    clearSnapshotActionFeedback()
    revokeSnapshotObjectUrl()
    snapshotTriggerElement = null
  })

  return {
    snapshotOpen,
    snapshotImageUrl,
    snapshotIsGenerating,
    snapshotError,
    snapshotCopySucceeded,
    snapshotDownloadSucceeded,
    snapshotShareSucceeded,
    snapshotCanShare,
    snapshotCanCopy,
    snapshotExportAction,
    hasSnapshotProjection,
    openSnapshot,
    refreshSnapshot,
    copySnapshot,
    downloadSnapshot,
    shareSnapshot,
  }
}
