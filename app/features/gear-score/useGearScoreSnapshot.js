import { onUnmounted, ref } from 'vue'
import { renderGearSnapshot } from '@/utils/snapshot.js'

export function useGearScoreSnapshot({
  gearType,
  pieceType,
  currentItem,
  selectedImage,
  statType,
  results,
  totalProgress,
  potentialProgress,
  getFinalUpgrade,
  supportsInputEnchantLevel,
  getInputEnchantLevelNumber,
  getProjectionEnchantLevel,
  getSelectedRating,
  hasRolledValue,
  getInputValue,
  formatStatValue,
  getPotentialValueRange,
  getPotentialScoreLineText,
  getPotentialLineTier,
  updateValues,
  formatGainRangeWithPrecision,
}) {
  const snapshotOpen = ref(false)
  const snapshotImageUrl = ref('')
  const snapshotBlob = ref(null)
  const snapshotIsGenerating = ref(false)
  const snapshotError = ref('')
  const snapshotCopySucceeded = ref(false)
  const snapshotDownloadSucceeded = ref(false)
  let snapshotObjectUrl = ''
  let snapshotCopySucceededTimeout = null
  let snapshotDownloadSucceededTimeout = null

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

  function getSnapshotCurrentHeading(item = gearType.value) {
    const levelLabel = getSnapshotCurrentLevelLabel(item)
    return levelLabel === 'Current' ? levelLabel : `${levelLabel} Current`
  }

  function getSnapshotPayload() {
    const finalUpgrade = getFinalUpgrade(gearType.value)
    const currentLevelLabel = getSnapshotCurrentLevelLabel()
    const projectedLevelLabel = getSnapshotProjectedLevelLabel()
    const itemMaxRating = currentItem.value?.DI?.toFixed(2) ?? '0.00'
    const selectedMaxRating = getSelectedRating().toFixed(2)

    return {
      itemName: `${pieceType.value} ${gearType.value}`,
      itemPiece: pieceType.value,
      itemGearType: gearType.value,
      itemImage: selectedImage.value,
      finalUpgrade,
      upgradeLabel: finalUpgrade ? `${currentLevelLabel} -> ${projectedLevelLabel}` : 'Current only',
      subtitle: `${currentLevelLabel} current / ${selectedMaxRating}% selected max / ${itemMaxRating}% item max`,
      generatedLabel: new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date()),
      current: {
        score: `${results.value.percent}%`,
        rating: `${results.value.DI}%`,
        tier: results.value.tier,
        progress: totalProgress.value,
        levelLabel: currentLevelLabel,
      },
      projected: {
        score: results.value.potentialScore,
        rating: results.value.potentialDI,
        tier: results.value.potentialTier,
        progress: potentialProgress.value,
        scoreGain: formatGainRangeWithPrecision(results.value.potentialScore, Number(results.value.percent), 0),
        levelLabel: projectedLevelLabel,
      },
      lines: statType.value.flatMap((stat, index) => {
        const hasValue = hasRolledValue(index)
        if (!hasValue) {
          return []
        }

        const row = results.value.individual[index]

        return [{
          index: index + 1,
          stat,
          value: formatStatValue(getInputValue(index), stat),
          currentScore: `${row.percent}%`,
          currentTier: row.tier,
          projectedValue: getPotentialValueRange(index),
          projectedScore: getPotentialScoreLineText(index),
          projectedTier: getPotentialLineTier(index),
          progress: Math.min(Math.max(Number(row.potentialMinPerc || row.percent), 0), 100),
        }]
      }),
    }
  }

  function clearSnapshotActionFeedback() {
    clearTimeout(snapshotCopySucceededTimeout)
    clearTimeout(snapshotDownloadSucceededTimeout)
    snapshotCopySucceeded.value = false
    snapshotDownloadSucceeded.value = false
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

  async function refreshSnapshot() {
    snapshotIsGenerating.value = true
    snapshotError.value = ''
    clearSnapshotActionFeedback()
    updateValues()

    try {
      const blob = await renderGearSnapshot(getSnapshotPayload())
      snapshotBlob.value = blob

      if (snapshotObjectUrl) {
        URL.revokeObjectURL(snapshotObjectUrl)
      }

      snapshotObjectUrl = URL.createObjectURL(blob)
      snapshotImageUrl.value = snapshotObjectUrl
    }
    catch (error) {
      console.error(error)
      snapshotError.value = 'Could not generate snapshot.'
    }
    finally {
      snapshotIsGenerating.value = false
    }
  }

  function openSnapshot() {
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
    const itemName = `${pieceType.value}-${gearType.value}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    return `lt-gear-${itemName || 'snapshot'}.png`
  }

  async function copySnapshot() {
    const blob = await ensureSnapshotBlob()
    snapshotError.value = ''

    if (!blob) {
      snapshotError.value = 'Snapshot is not ready yet.'
      return
    }

    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      snapshotError.value = 'Image copy is not supported in this browser.'
      return
    }

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ])
      showSnapshotCopySucceeded()
    }
    catch (error) {
      console.error(error)
      snapshotError.value = 'Could not copy image.'
    }
  }

  async function downloadSnapshot() {
    const blob = await ensureSnapshotBlob()
    snapshotError.value = ''

    if (!blob) {
      snapshotError.value = 'Snapshot is not ready yet.'
      return
    }

    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = getSnapshotFilename()
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(downloadUrl)
    showSnapshotDownloadSucceeded()
  }

  onUnmounted(() => {
    clearSnapshotActionFeedback()

    if (snapshotObjectUrl) {
      URL.revokeObjectURL(snapshotObjectUrl)
    }
  })

  return {
    snapshotOpen,
    snapshotImageUrl,
    snapshotIsGenerating,
    snapshotError,
    snapshotCopySucceeded,
    snapshotDownloadSucceeded,
    getSnapshotProjectedLevelLabel,
    getSnapshotCurrentHeading,
    openSnapshot,
    copySnapshot,
    downloadSnapshot,
  }
}
