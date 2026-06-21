import { computed, ref, unref, watch } from 'vue'
import { useRoute, useRouter } from '#app'
import gears from '@/utils/gear.js'
import tiers from '@/utils/tiers.js'
import {
  decimalStats,
  defaultOddsEnchantMethod,
  getOddsEnchantMethodOptions,
  repeatableStats,
  inputEnchantGearTypes,
  tierGuideRows,
  traitCatalog,
  recommendedOptionGuide,
} from '@/features/gear-score/data.js'
import {
  clamp,
  formatGainRangeWithPrecision,
  formatStatValue,
  getFirstPercent,
  getRollStatusClass,
  getTierClass,
} from '@/features/gear-score/helpers.js'
import {
  calculateGearScore,
  createEmptyGearScoreResult,
  getDefaultQualityTargetPercent,
  getInputValue as getScoreInputValue,
  getStatStep as getScoreStatStep,
  hasRolledValue as hasScoreRolledValue,
} from '@/features/gear-score/score-calculation.js'
import {
  getQualityTargetKey,
  readStoredQualityTargets,
  writeStoredQualityTargets,
} from '@/features/gear-score/quality-target-storage.js'
import {
  encodeShareState,
  getShareParams,
  parseShareState,
} from '@/features/gear-score/share-url.js'
import { useGearScoreSnapshot } from '@/features/gear-score/useGearScoreSnapshot.js'
import { isGearPlanSlot } from '@/features/gear-plan/data.js'
import {
  projectGearPlanEntry,
  saveStoredGearPlanEntry,
} from '@/features/gear-plan/plan-state.js'

export function useGearScoreCalculator() {
  const route = useRoute()
  const router = useRouter()
  const upgradeHref = computed(() => router.resolve('/upgrade').href)
  const planHref = computed(() => router.resolve('/plan').href)

  const gearType = ref('[sLv5] Accessories')
  const pieceType = ref('Cloak')
  const highlightedPiece = ref(['[sLv5] Accessories', 'Cloak'])
  const valueButton = ref('90')
  const resultMode = ref('score')
  const inputEnchantLevel = ref('2')

  const statType = ref([])
  const statInput = ref(['', '', '', '', ''])
  const statPickerOpen = ref([])
  const qualityOddsOrder = ref([0, 1, 2, 3, 4])
  const qualityLineEnchantMethods = ref(Array(5).fill(defaultOddsEnchantMethod))
  const qualityTargets = ref(readStoredQualityTargets())
  const validStats = ref([])

  const imgUrls = import.meta.glob('../../assets/*.png', {
    import: 'default',
    eager: true,
  })

  const hasSeenDisclaimer = localStorage.getItem('ltGearCalculatorDisclaimerAccepted') === 'true'
  const disclaimerOpen = ref(!hasSeenDisclaimer)
  const gearSheetOpen = ref(false)
  const clipboardTooltip = ref(false)
  const clipboardToolTipTimeout = ref(null)
  const gearPlanSaveSucceeded = ref(false)
  const gearPlanSaveTimeout = ref(null)

  const results = ref(createEmptyGearScoreResult())





  const gearCategories = computed(() => Object.keys(gears).filter((category) =>
    !['[5000] Accessories', '[4000] Weapon'].includes(category),
  ))
  const pieceOptions = computed(() => getPieceNames(gearType.value))
  const currentItem = computed(() => gears[gearType.value]?.[pieceType.value])
  const statOptions = computed(() => Object.keys(currentItem.value?.Stats ?? {}))
  const selectedImage = computed(() => getItemImage(pieceType.value, gearType.value))
  const selectedTierRows = computed(() => getTierRows(gearType.value, pieceType.value))
  const highlightedStats = computed(() => Object.keys(highlightedItem.value?.Stats ?? {}))
  const highlightedItem = computed(() => gears[highlightedPiece.value[0]]?.[highlightedPiece.value[1]])
  const highlightedTierRows = computed(() => getTierRows(highlightedPiece.value[0], highlightedPiece.value[1]))
  const selectedTraitRows = computed(() => getTraitMatches(validStats.value))
  const highlightedTraitRows = computed(() => getTraitMatches(highlightedStats.value))
  const currentRecommendations = computed(() => recommendedOptionGuide[gearType.value]?.[pieceType.value] ?? null)
  const currentInputEnchantLevelOptions = computed(() => getInputEnchantLevelOptions())
  const currentOddsEnchantMethodOptions = computed(() => getOddsEnchantMethodOptions(gearType.value))
  const qualityTargetKey = computed(() => getQualityTargetKey(gearType.value, pieceType.value))
  const defaultQualityTargetPercent = computed(() => {
    const item = currentItem.value
    const tierEquivalence = item ? tiers[gearType.value]?.[item.Type] : null
    return getDefaultQualityTargetPercent({
      item,
      tierEquivalence,
      upgradeCount: getPotentialMultiplier(),
    })
  })
  const hasCustomQualityTarget = computed(() =>
    Object.prototype.hasOwnProperty.call(qualityTargets.value, qualityTargetKey.value),
  )
  const qualityTargetPercent = computed(() =>
    hasCustomQualityTarget.value
      ? qualityTargets.value[qualityTargetKey.value]
      : defaultQualityTargetPercent.value,
  )
  const totalProgress = computed(() => clamp(Number(results.value.percent), 0, 100))
  const potentialProgress = computed(() => clamp(getFirstPercent(results.value.potentialScore), 0, 100))
  const potentialGainText = computed(() => {
    if (resultMode.value === 'rating') {
      return formatGainRange(results.value.potentialDI, Number(results.value.DI))
    }

    return formatGainRange(results.value.potentialScore, Number(results.value.percent))
  })
  const supportsGearPlan = computed(() => isGearPlanSlot(gearType.value, pieceType.value))
  const canSaveToGearPlan = computed(() => {
    if (!supportsGearPlan.value || statType.value.length !== 5) {
      return false
    }

    const filledLineCount = statInput.value.filter((_, index) => hasRolledValue(index)).length
    const allInputsValid = statInput.value.every((value, index) => {
      const isBlank = value === '' || value === null || value === undefined || Number(value) === 0
      return isBlank || (
        currentItem.value?.Stats?.[statType.value[index]] &&
        hasRolledValue(index) &&
        !isInputOverMax(index)
      )
    })

    return filledLineCount >= 3 && allInputsValid
  })

  function getPieceNames(category) {
    return Object.keys(gears[category] ?? {}).filter((key) => !['Sheet Link', 'Potential'].includes(key))
  }

  function getItemImage(piece, category) {
    return getAsset(`${piece}_${category.slice(1, 5)}.png`)
  }

  function getAsset(name) {
    return imgUrls[`../../assets/${name}`] ?? ''
  }

  function getTierRows(category, piece) {
    const item = gears[category]?.[piece]
    if (!item) {
      return []
    }

    return Object.entries(tiers[category][item.Type]).map(([tier, values]) => ({
      tier,
      ...values,
    }))
  }

  function getTraitMatches(stats) {
    return traitCatalog.filter((trait) => trait.test(stats))
  }

  function canRepeatStat(stat) {
    return repeatableStats.includes(stat)
  }

  function isStatSelectedOnOtherLine(stat, index) {
    if (canRepeatStat(stat)) {
      return false
    }

    return statType.value.some((selectedStat, selectedIndex) => selectedIndex !== index && selectedStat === stat)
  }

  function getUniqueStatTypes(stats) {
    const usedStats = new Set()

    return stats.map((stat) => {
      if (canRepeatStat(stat)) {
        return stat
      }

      if (!usedStats.has(stat)) {
        usedStats.add(stat)
        return stat
      }

      const fallback = statOptions.value.find((option) => !usedStats.has(option))
      if (fallback) {
        usedStats.add(fallback)
        return fallback
      }

      return stat
    })
  }

  function setStatType(index, stat) {
    if (isStatSelectedOnOtherLine(stat, index)) {
      return
    }

    statType.value[index] = stat
  }

  function selectStatType(index, stat) {
    setStatType(index, stat)
    statPickerOpen.value[index] = false
  }

  function setGear(category, piece) {
    gearType.value = category
    pieceType.value = piece
    highlightedPiece.value = [category, piece]
    gearSheetOpen.value = false
  }

  function changePiece() {
    const options = statOptions.value
    statType.value = options.slice(0, 5)
    resetQualityOddsOrder()
    resetOddsEnchantMethods()
    setValues(0, 0)
  }

  function isDecimalStat(stat) {
    return decimalStats.includes(stat)
  }

  function getStatStep(stat) {
    return getScoreStatStep(stat)
  }

  function getInputValue(index) {
    return getScoreInputValue(statInput.value, index)
  }

  function hasRolledValue(index) {
    return hasScoreRolledValue(statInput.value, index)
  }

  function getPotentialMultiplier(item = gearType.value) {
    return getProjectionEnchantLevel(item) - 2
  }

  function supportsInputEnchantLevel(item = gearType.value) {
    return inputEnchantGearTypes.includes(item) && hasUpgradePotential(item)
  }

  function hasUpgradePotential(item = gearType.value) {
    const category = gears[item]
    if (!category) {
      return false
    }

    return getPieceNames(item).some((piece) =>
      Object.values(category[piece]?.Stats ?? {}).some((stat) =>
        Array.isArray(stat.Potential) && Number(stat.Potential[0]) > 0,
      ),
    )
  }

  function getMaxInputEnchantLevel(item = gearType.value) {
    return supportsInputEnchantLevel(item) ? getProjectionEnchantLevel(item) : 2
  }

  function getInputEnchantLevelOptions(item = gearType.value) {
    const maxLevel = getMaxInputEnchantLevel(item)

    return [2, 3, 4, 5]
      .filter((level) => level <= maxLevel)
      .map((level) => ({
        value: String(level),
        label: level === 2 ? 'Lv.2 Base' : `Lv.${level}${level === maxLevel ? ' Full' : ''}`,
      }))
  }

  function getInputEnchantLevelNumber(item = gearType.value) {
    if (!supportsInputEnchantLevel(item)) {
      return 2
    }

    const level = parseInt(inputEnchantLevel.value)
    return Number.isFinite(level) ? clamp(level, 2, getMaxInputEnchantLevel(item)) : 2
  }

  function getInputEnchantUpgradeCount(item = gearType.value) {
    return Math.max(0, getInputEnchantLevelNumber(item) - 2)
  }

  function getRemainingPotentialMultiplier(item = gearType.value) {
    return Math.max(0, getPotentialMultiplier(item) - getInputEnchantUpgradeCount(item))
  }

  function getInputMaxValue(stat) {
    const statInfo = currentItem.value?.Stats?.[stat]
    if (!statInfo) {
      return null
    }

    return statInfo.Value + (statInfo.Potential?.[1] ?? 0) * getInputEnchantUpgradeCount()
  }

  function getInputMaxValueText(stat) {
    const value = getInputMaxValue(stat)
    return value === null ? '-' : formatStatValue(value, stat)
  }

  function getProjectionEnchantLevel(item = gearType.value) {
    const gearLevel = parseInt(item.slice(1, 5))
    return item === '[sLv5] Accessories' || gearLevel >= 9999 ? 5 : 4
  }

  function setInputEnchantLevel(value) {
    const level = parseInt(value)
    if (Number.isFinite(level)) {
      inputEnchantLevel.value = String(clamp(level, 2, getMaxInputEnchantLevel()))
    }
  }

  function getQualityOddsOrder() {
    const maxLines = statType.value.length
    const ordered = qualityOddsOrder.value.filter((index) => Number.isInteger(index) && index >= 0 && index < maxLines)

    for (let i = 0; i < maxLines; i++) {
      if (!ordered.includes(i)) {
        ordered.push(i)
      }
    }

    return ordered
  }

  function resetQualityOddsOrder() {
    qualityOddsOrder.value = statType.value.map((_, index) => index)
  }

  function resetOddsEnchantMethods() {
    qualityLineEnchantMethods.value = statType.value.map(() => defaultOddsEnchantMethod)
  }

  function setQualityLineEnchantMethod(lineIndex, method) {
    if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= statType.value.length) {
      return
    }

    const validMethods = currentOddsEnchantMethodOptions.value.map((option) => option.value)
    qualityLineEnchantMethods.value[lineIndex] = validMethods.includes(method)
      ? method
      : defaultOddsEnchantMethod
  }

  function moveQualityOddsLine(position, direction) {
    const order = getQualityOddsOrder()
    const nextPosition = position + direction

    if (nextPosition < 0 || nextPosition >= order.length) {
      return
    }

    const nextOrder = order.slice()
    ;[nextOrder[position], nextOrder[nextPosition]] = [nextOrder[nextPosition], nextOrder[position]]
    qualityOddsOrder.value = nextOrder
    updateValues()
  }

  function setQualityTargetPercent(value) {
    if (value === null || value === undefined || String(value).trim() === '') {
      return false
    }

    const target = Number(value)
    if (!Number.isFinite(target) || target < 0 || target > 100) {
      return false
    }

    if (target.toFixed(2) === defaultQualityTargetPercent.value.toFixed(2)) {
      resetQualityTarget()
      return true
    }

    qualityTargets.value = writeStoredQualityTargets({
      ...qualityTargets.value,
      [qualityTargetKey.value]: target,
    })
    return true
  }

  function resetQualityTarget() {
    const nextTargets = { ...qualityTargets.value }
    delete nextTargets[qualityTargetKey.value]
    qualityTargets.value = writeStoredQualityTargets(nextTargets)
  }

  function updateValues() {
    const item = currentItem.value
    if (!item) {
      return
    }

    const remainingPotentialMultiplier = getRemainingPotentialMultiplier()
    const futurePotentialMultiplier = getPotentialMultiplier()
    const tierEquivalence = tiers[gearType.value][item.Type]
    const calculated = calculateGearScore({
      gearType: gearType.value,
      item,
      tierEquivalence,
      statTypes: statType.value,
      statInputs: statInput.value,
      qualityOddsOrder: getQualityOddsOrder(),
      qualityLineEnchantMethods: qualityLineEnchantMethods.value,
      qualityTargetPercent: qualityTargetPercent.value,
      remainingPotentialMultiplier,
      futurePotentialMultiplier,
    })
    results.value = calculated.result
    validStats.value = calculated.validStats
  }

  function setValues(enchants, value) {
    const percent = Number(unref(value))
    for (let i = 0; i < 5; i++) {
      const stat = statType.value[i]
      const maxValue = getInputMaxValue(stat) ?? 0

      if (enchants > i) {
        statInput.value[i] = isDecimalStat(stat) ? +(percent * maxValue / 100).toFixed(1) : parseInt(percent * maxValue / 100)
      }
      else {
        statInput.value[i] = ''
      }
    }
  }

  function applyGearImageImport(importResult) {
    if (!importResult) {
      return
    }

    const nextGear = gears[importResult.gearType]?.[importResult.pieceType]
      ? importResult.gearType
      : gearType.value
    const nextPiece = gears[nextGear]?.[importResult.pieceType]
      ? importResult.pieceType
      : pieceType.value
    const item = gears[nextGear]?.[nextPiece]
    if (!item) {
      return
    }

    gearType.value = nextGear
    pieceType.value = nextPiece
    highlightedPiece.value = [nextGear, nextPiece]

    const options = Object.keys(item.Stats ?? {})
    const usedStats = new Set()
    const importLines = Array.isArray(importResult.lines) ? importResult.lines.slice(0, 5) : []
    const nextStatType = []
    const nextStatInput = []

    for (let index = 0; index < 5; index++) {
      const line = importLines[index]
      const lineStat = item.Stats?.[line?.stat] ? line.stat : ''
      const selectedStat = getAvailableImportStat(lineStat, options, usedStats)
        || getAvailableImportStat('', options, usedStats)

      nextStatType[index] = selectedStat
      nextStatInput[index] = line && !line.ignored && lineStat && selectedStat === lineStat && Number(line.value) > 0
        ? formatImportInputValue(lineStat, line.value)
        : ''

      if (selectedStat && !canRepeatStat(selectedStat)) {
        usedStats.add(selectedStat)
      }
    }

    statType.value = nextStatType
    statInput.value = nextStatInput
    resetQualityOddsOrder()
    resetOddsEnchantMethods()
    setInputEnchantLevel(importResult.inputEnchantLevel || 2)
  }

  function getAvailableImportStat(stat, options, usedStats) {
    if (stat && options.includes(stat) && (canRepeatStat(stat) || !usedStats.has(stat))) {
      return stat
    }

    return options.find((option) => canRepeatStat(option) || !usedStats.has(option)) ?? ''
  }

  function formatImportInputValue(stat, value) {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      return ''
    }

    return isDecimalStat(stat)
      ? Number(numericValue.toFixed(1))
      : parseInt(numericValue)
  }

  function getFinalUpgrade(item) {
    switch (item) {
      case '[3500] Badge 6':
      case '[9999] Badge 6':
        return ''
      case '[9999] Armor':
        return 'Ascended'
      default:
        return 'Lucent'
    }
  }

  function saveCurrentGearToPlan() {
    if (!canSaveToGearPlan.value) {
      return
    }

    const entry = projectGearPlanEntry({
      gearType: gearType.value,
      pieceType: pieceType.value,
      statType: statType.value,
      statInput: statInput.value,
      currentUpgradeCount: getInputEnchantUpgradeCount(),
    })
    if (!entry || !saveStoredGearPlanEntry(entry)) {
      return
    }

    clearTimeout(gearPlanSaveTimeout.value)
    gearPlanSaveSucceeded.value = true
    gearPlanSaveTimeout.value = setTimeout(() => {
      gearPlanSaveSucceeded.value = false
    }, 1800)
  }

  function getSelectedRating() {
    let rating = 0
    const item = currentItem.value
    if (!item) {
      return rating
    }

    for (let i = 0; i < 4; i++) {
      rating += item.Stats[statType.value[i]]?.DI ?? 0
    }

    if (['6000', '7000'].includes(gearType.value.slice(1, 5))) {
      rating += (item.Stats[statType.value[4]]?.DI ?? 0) * 0.8
    }
    else {
      rating += item.Stats[statType.value[4]]?.DI ?? 0
    }

    return rating
  }

  async function generateURL() {
    const resString = encodeShareState({
      gearType: gearType.value,
      pieceType: pieceType.value,
      statType: statType.value,
      statInput: statInput.value,
    })
    const enchantLevel = getInputEnchantLevelNumber()
    const params = getShareParams({
      itemString: resString,
      enchantLevel,
      includeEnchantLevel: supportsInputEnchantLevel() && enchantLevel > 2,
    })

    try {
      await navigator.clipboard.writeText(getAbsoluteHref({
        path: route.path,
        query: Object.fromEntries(params.entries()),
      }))
      toggleClipboardTooltip()
    }
    catch (error) {
      console.error(error)
    }

    return resString
  }

  function readURL(pars) {
    try {
      const { gearName, pieceName, statNames, statValues } = parseShareState(pars)

      gearType.value = gearName
      pieceType.value = pieceName
      highlightedPiece.value = [gearName, pieceName]
      statType.value = getUniqueStatTypes(statNames.slice())
      statInput.value = statValues.slice()
      resetQualityOddsOrder()
      resetOddsEnchantMethods()
    }
    catch (error) {
      console.error(error)
    }
  }

  function acceptDisclaimer() {
    localStorage.setItem('ltGearCalculatorDisclaimerAccepted', 'true')
    disclaimerOpen.value = false
  }

  function toggleClipboardTooltip() {
    clearTimeout(clipboardToolTipTimeout.value)
    clipboardTooltip.value = true

    clipboardToolTipTimeout.value = setTimeout(() => {
      clipboardTooltip.value = false
    }, 2000)
  }

  function formatGainRange(text, baseValue) {
    return formatGainRangeWithPrecision(text, baseValue, resultMode.value === 'rating' ? 2 : 0)
  }

  function getPotentialScoreLineText(index) {
    const row = results.value.individual[index]
    return row.potentialMinPerc === row.potentialMaxPerc
      ? `${row.potentialMinPerc}%`
      : `${row.potentialMinPerc}% ~ ${row.potentialMaxPerc}%`
  }

  function getPotentialValueRange(index) {
    const row = results.value.individual[index]
    if (!row.potentialMin && !row.potentialMax) {
      return '-'
    }

    return row.potentialMin === row.potentialMax
      ? row.potentialMin
      : `${row.potentialMin} ~ ${row.potentialMax}`
  }

  function getLineScoreText(index) {
    const row = results.value.individual[index]
    return resultMode.value === 'rating' ? `${row.DI}%` : `${row.percent}%`
  }

  function isInputOverMax(index) {
    const maxValue = getInputMaxValue(statType.value[index])
    return maxValue !== null && hasRolledValue(index) && getInputValue(index) > maxValue
  }

  function getLineMaxRatingText(index) {
    const maxRating = currentItem.value?.Stats?.[statType.value[index]]?.DI
    return Number.isFinite(maxRating) ? `${maxRating.toFixed(2)}%` : '0.00%'
  }

  function getLineMaxSummaryText(index) {
    return `Max ${getInputMaxValueText(statType.value[index])} / ${getLineMaxRatingText(index)}`
  }

  function getPotentialLineText(index) {
    const row = results.value.individual[index]
    if (resultMode.value === 'rating') {
      return row.potentialDIMin === row.potentialDIMax
        ? `${row.potentialDIMin}%`
        : `${row.potentialDIMin}% ~ ${row.potentialDIMax}%`
    }

    return row.potentialMinPerc === row.potentialMaxPerc
      ? `${row.potentialMinPerc}%`
      : `${row.potentialMinPerc}% ~ ${row.potentialMaxPerc}%`
  }

  function getPotentialLineTier(index) {
    const row = results.value.individual[index]
    return row.potentialTierMin === row.potentialTierMax
      ? row.potentialTierMin
      : `${row.potentialTierMin} ~ ${row.potentialTierMax}`
  }

  function getAbsoluteHref(to) {
    return new URL(router.resolve(to).href, window.location.origin).toString()
  }

  function getQueryValue(value) {
    return Array.isArray(value) ? value[0] : value
  }

  const {
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
  } = useGearScoreSnapshot({
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
  })

  changePiece()

  const sharedItem = getQueryValue(route.query.it)
  if (sharedItem) {
    readURL(sharedItem)
    const sharedEnchantLevel = getQueryValue(route.query.el)
    if (sharedEnchantLevel && supportsInputEnchantLevel()) {
      setInputEnchantLevel(sharedEnchantLevel)
    }
    disclaimerOpen.value = false
  }

  updateValues()

  watch([gearType, pieceType], ([nextGear, nextPiece]) => {
    const pieces = getPieceNames(nextGear)
    if (!pieces.includes(nextPiece)) {
      pieceType.value = pieces[0]
      return
    }

    highlightedPiece.value = [nextGear, nextPiece]
    changePiece()
    setInputEnchantLevel(inputEnchantLevel.value)
  }, { flush: 'sync' })

  watch([statType, statInput, inputEnchantLevel, qualityLineEnchantMethods, qualityTargetPercent], () => {
    updateValues()
  }, {
    deep: true,
    flush: 'post',
  })

  return {
    gears,
    upgradeHref,
    planHref,
    gearType,
    pieceType,
    highlightedPiece,
    valueButton,
    resultMode,
    inputEnchantLevel,
    qualityLineEnchantMethods,
    statType,
    statInput,
    statPickerOpen,
    disclaimerOpen,
    gearSheetOpen,
    clipboardTooltip,
    gearPlanSaveSucceeded,
    snapshotOpen,
    snapshotImageUrl,
    snapshotIsGenerating,
    snapshotError,
    snapshotCopySucceeded,
    snapshotDownloadSucceeded,
    results,
    tierGuideRows,
    gearCategories,
    pieceOptions,
    currentItem,
    statOptions,
    selectedImage,
    selectedTierRows,
    highlightedStats,
    highlightedItem,
    highlightedTierRows,
    selectedTraitRows,
    highlightedTraitRows,
    currentRecommendations,
    currentInputEnchantLevelOptions,
    currentOddsEnchantMethodOptions,
    defaultQualityTargetPercent,
    hasCustomQualityTarget,
    qualityTargetPercent,
    totalProgress,
    potentialProgress,
    potentialGainText,
    supportsGearPlan,
    canSaveToGearPlan,
    getPieceNames,
    getItemImage,
    getAsset,
    isStatSelectedOnOtherLine,
    selectStatType,
    setGear,
    getStatStep,
    hasRolledValue,
    supportsInputEnchantLevel,
    getInputMaxValue,
    getInputMaxValueText,
    getProjectionEnchantLevel,
    setInputEnchantLevel,
    setQualityLineEnchantMethod,
    moveQualityOddsLine,
    setQualityTargetPercent,
    resetQualityTarget,
    setValues,
    applyGearImageImport,
    getFinalUpgrade,
    saveCurrentGearToPlan,
    getSelectedRating,
    generateURL,
    acceptDisclaimer,
    clamp,
    formatGainRangeWithPrecision,
    getSnapshotProjectedLevelLabel,
    getSnapshotCurrentHeading,
    openSnapshot,
    copySnapshot,
    downloadSnapshot,
    getLineScoreText,
    isInputOverMax,
    getLineMaxSummaryText,
    getPotentialLineText,
    getPotentialLineTier,
    getTierClass,
    getRollStatusClass,
  }
}
