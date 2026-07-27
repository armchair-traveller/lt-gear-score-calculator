import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from '#app'
import materials from '@/data/item-enhancement-materials.en.json'
import {
  calculateUpgradePlan,
  clampInteger,
  formatUpgradeFee,
  formatUpgradeNumber,
  getAscensionRequirement,
  getAvailableUpgradeItems,
  getUpgradeCatalogGroups,
  normalizeUpgradeTargetLevel,
} from '@/features/upgrade/calculation.js'

const recentItemsStorageKey = 'ltUpgradeRecentItems'

export function useUpgradePlanner() {
  const route = useRoute()
  const router = useRouter()
  const availableItems = getAvailableUpgradeItems(materials)
  const queryItem = getQueryValue(route.query.item)
  const initialItem = availableItems.find(item => item.value === queryItem) ?? availableItems[0]
  const itemValue = ref(initialItem?.value ?? '')
  const currentLevel = ref(String(clampInteger(getQueryValue(route.query.from), 0, Math.max(0, (initialItem?.rows?.length ?? 1) - 1))))
  const targetLevel = ref(String(clampInteger(
    getQueryValue(route.query.to) ?? initialItem?.rows?.length,
    Number(currentLevel.value) + 1,
    initialItem?.rows?.length ?? 1,
  )))
  const quantity = ref(String(clampInteger(getQueryValue(route.query.qty), 1, 999)))
  const ownedMaterials = ref(String(clampInteger(
    getQueryValue(route.query.owned),
    0,
    Number.MAX_SAFE_INTEGER,
  )))
  const itemPickerOpen = ref(false)
  const recentItemValues = ref([])
  const shareCopyStatus = ref('idle')
  const shareCopyTimeout = ref(null)

  const selectedItem = computed(() =>
    availableItems.find(item => item.value === itemValue.value) ?? availableItems[0],
  )
  const maxLevel = computed(() => selectedItem.value?.rows?.length ?? 0)
  const currentLevelNumber = computed(() =>
    clampInteger(currentLevel.value, 0, Math.max(0, maxLevel.value - 1)),
  )
  const targetLevelNumber = computed(() =>
    normalizeUpgradeTargetLevel(
      targetLevel.value,
      currentLevelNumber.value,
      maxLevel.value,
    ),
  )
  const plan = computed(() => calculateUpgradePlan({
    item: selectedItem.value,
    currentLevel: currentLevel.value,
    targetLevel: targetLevel.value,
    quantity: quantity.value,
    ownedMaterials: ownedMaterials.value,
  }))
  const currentLevelOptions = computed(() =>
    Array.from({ length: maxLevel.value }, (_, level) => ({
      value: String(level),
      label: `+${level}`,
    })),
  )
  const targetLevelOptions = computed(() =>
    Array.from(
      { length: Math.max(0, maxLevel.value - currentLevelNumber.value) },
      (_, index) => {
        const level = currentLevelNumber.value + index + 1
        return {
          value: String(level),
          label: `+${level}`,
        }
      },
    ),
  )
  const activeRangePreset = computed(() => {
    if (currentLevelNumber.value === 0 && targetLevelNumber.value === maxLevel.value) {
      return 'full'
    }
    if (targetLevelNumber.value === currentLevelNumber.value + 1) {
      return 'next'
    }
    if (targetLevelNumber.value === maxLevel.value) {
      return 'to-max'
    }

    return ''
  })
  const quantityInvalid = computed(() => {
    const value = Number(String(quantity.value ?? '').trim().replaceAll(',', ''))
    return !Number.isInteger(value) || value < 1 || value > 999
  })
  const ownedMaterialsInvalid = computed(() => {
    const value = Number(String(ownedMaterials.value ?? '').trim().replaceAll(',', ''))
    return !Number.isSafeInteger(value) || value < 0
  })
  const shareCopied = computed(() => shareCopyStatus.value === 'copied')
  const shareCopyFailed = computed(() => shareCopyStatus.value === 'failed')
  const catalogGroups = computed(() => getUpgradeCatalogGroups(materials))
  const recentItems = computed(() =>
    recentItemValues.value
      .map(value => availableItems.find(item => item.value === value))
      .filter(Boolean),
  )
  const suggestedItems = computed(() => {
    const selected = selectedItem.value
    if (!selected) {
      return availableItems.slice(0, 4)
    }

    return availableItems
      .filter(item => item.value !== selected.value)
      .map(item => ({
        item,
        relevance:
          (item.summary?.farm === selected.summary?.farm ? 4 : 0)
          + (item.summary?.quarter === selected.summary?.quarter ? 2 : 0)
          + (item.rows.length === selected.rows.length ? 1 : 0),
      }))
      .sort((left, right) =>
        right.relevance - left.relevance
        || left.item.name.localeCompare(right.item.name),
      )
      .slice(0, 4)
      .map(entry => entry.item)
  })

  watch(selectedItem, (item) => {
    if (!item) {
      return
    }

    currentLevel.value = String(clampInteger(
      currentLevel.value,
      0,
      Math.max(0, item.rows.length - 1),
    ))
    targetLevel.value = String(clampInteger(
      targetLevel.value,
      currentLevelNumber.value + 1,
      item.rows.length,
    ))
  }, { immediate: true })

  watch(currentLevelNumber, (level) => {
    const normalizedTarget = normalizeUpgradeTargetLevel(
      targetLevel.value,
      level,
      maxLevel.value,
    )
    if (targetLevel.value !== String(normalizedTarget)) {
      targetLevel.value = String(normalizedTarget)
    }
  })

  watch(
    [
      () => route.query.item,
      () => route.query.from,
      () => route.query.to,
      () => route.query.qty,
      () => route.query.owned,
    ],
    syncPlanFromRoute,
  )

  onMounted(() => {
    recentItemValues.value = readRecentItemValues()
    rememberRecentItem(itemValue.value)
  })

  onBeforeUnmount(() => {
    if (shareCopyTimeout.value) {
      clearTimeout(shareCopyTimeout.value)
    }
  })

  function openItemPicker() {
    itemPickerOpen.value = true
  }

  function selectItem(value) {
    const item = availableItems.find(entry => entry.value === value)
    if (!item) {
      return
    }

    if (item.value === itemValue.value) {
      itemPickerOpen.value = false
      rememberRecentItem(item.value)
      return
    }

    itemValue.value = item.value
    currentLevel.value = '0'
    targetLevel.value = String(item.rows.length)
    ownedMaterials.value = '0'
    itemPickerOpen.value = false
    rememberRecentItem(item.value)
  }

  function applyRangePreset(value) {
    if (!value) {
      return
    }

    if (value === 'next') {
      targetLevel.value = String(Math.min(maxLevel.value, currentLevelNumber.value + 1))
      return
    }
    if (value === 'full') {
      currentLevel.value = '0'
      targetLevel.value = String(maxLevel.value)
      return
    }
    if (value === 'to-max') {
      targetLevel.value = String(maxLevel.value)
    }
  }

  function normalizeQuantity() {
    quantity.value = String(clampInteger(quantity.value, 1, 999))
  }

  function normalizeOwnedMaterials() {
    ownedMaterials.value = String(clampInteger(
      ownedMaterials.value,
      0,
      Number.MAX_SAFE_INTEGER,
    ))
  }

  async function copyPlanLink() {
    const href = router.resolve({
      path: '/upgrade',
      query: {
        item: selectedItem.value?.value,
        from: plan.value.currentLevel,
        to: plan.value.targetLevel,
        qty: plan.value.quantity,
        owned: plan.value.ownedMaterials || undefined,
      },
    }).href
    const url = new URL(href, window.location.origin).toString()

    try {
      await writeClipboardText(url)
      setShareCopyStatus('copied')
    }
    catch {
      setShareCopyStatus('failed')
    }
  }

  function setShareCopyStatus(status) {
    shareCopyStatus.value = status
    if (shareCopyTimeout.value) {
      clearTimeout(shareCopyTimeout.value)
    }
    shareCopyTimeout.value = setTimeout(() => {
      shareCopyStatus.value = 'idle'
    }, 1800)
  }

  function syncPlanFromRoute() {
    const queryItemValue = getQueryValue(route.query.item)
    const item = availableItems.find(entry => entry.value === queryItemValue) ?? availableItems[0]
    if (!item) {
      return
    }

    const nextCurrentLevel = clampInteger(
      getQueryValue(route.query.from),
      0,
      Math.max(0, item.rows.length - 1),
    )

    itemValue.value = item.value
    currentLevel.value = String(nextCurrentLevel)
    targetLevel.value = String(normalizeUpgradeTargetLevel(
      getQueryValue(route.query.to) ?? item.rows.length,
      nextCurrentLevel,
      item.rows.length,
    ))
    quantity.value = String(clampInteger(getQueryValue(route.query.qty), 1, 999))
    ownedMaterials.value = String(clampInteger(
      getQueryValue(route.query.owned),
      0,
      Number.MAX_SAFE_INTEGER,
    ))
    rememberRecentItem(item.value)
  }

  function rememberRecentItem(value) {
    if (!availableItems.some(item => item.value === value)) {
      return
    }

    recentItemValues.value = [
      value,
      ...recentItemValues.value.filter(itemValue => itemValue !== value),
    ].slice(0, 5)

    try {
      localStorage.setItem(recentItemsStorageKey, JSON.stringify(recentItemValues.value))
    }
    catch {
      // Recent items are a convenience; calculations do not depend on storage.
    }
  }

  return {
    itemValue,
    currentLevel,
    targetLevel,
    quantity,
    ownedMaterials,
    itemPickerOpen,
    shareCopied,
    shareCopyFailed,
    quantityInvalid,
    ownedMaterialsInvalid,
    availableItems,
    selectedItem,
    maxLevel,
    currentLevelNumber,
    targetLevelNumber,
    currentLevelOptions,
    targetLevelOptions,
    activeRangePreset,
    catalogGroups,
    recentItems,
    suggestedItems,
    plan,
    openItemPicker,
    selectItem,
    applyRangePreset,
    normalizeQuantity,
    normalizeOwnedMaterials,
    copyPlanLink,
    formatNumber: formatUpgradeNumber,
    formatFee: formatUpgradeFee,
    getAscensionRequirement,
  }
}

function getQueryValue(value) {
  return Array.isArray(value) ? value[0] : value
}

function readRecentItemValues() {
  try {
    const parsed = JSON.parse(localStorage.getItem(recentItemsStorageKey) || '[]')
    return Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : []
  }
  catch {
    return []
  }
}

async function writeClipboardText(value) {
  const copyTarget = document.createElement('textarea')
  copyTarget.value = value
  copyTarget.setAttribute('readonly', '')
  copyTarget.style.position = 'fixed'
  copyTarget.style.opacity = '0'
  document.body.append(copyTarget)
  copyTarget.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  }
  catch {
    // Some browsers throw here; the Clipboard API remains available as a fallback.
  }
  finally {
    copyTarget.remove()
  }

  if (copied) {
    return
  }

  if (navigator.clipboard?.writeText) {
    await Promise.race([
      navigator.clipboard.writeText(value),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Clipboard access timed out.')), 1000)
      }),
    ])
    return
  }

  throw new Error('Clipboard access is unavailable.')
}
