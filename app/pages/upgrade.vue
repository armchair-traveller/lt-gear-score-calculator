<script setup>
import {
  ArrowLeftIcon,
  CalculatorIcon,
  CheckCircle2Icon,
  CoinsIcon,
  Layers3Icon,
  MapPinnedIcon,
  PackageIcon,
  SearchIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from '@lucide/vue'

import materials from '@/data/item-enhancement-materials.en.json'
import hammerImage from '@/assets/hammer.png'

const router = useRouter()
const initialItem = getAvailableItems()[0]
const itemValue = ref(initialItem?.value ?? '')
const currentLevel = ref('0')
const targetLevel = ref(String(initialItem?.rows?.length ?? 1))
const ownedMaterials = ref(0)
const quantity = ref(1)
const searchQuery = ref('')
const catalogExpanded = ref(false)
const catalogSection = ref(null)
const catalogSearchControl = ref(null)
const catalogFocusPending = ref(false)
const catalogSearchScrollPending = ref(false)
const homeHref = computed(() => router.resolve('/').href)
const planHref = computed(() => router.resolve('/plan').href)

const availableItems = computed(() => getAvailableItems())
const selectedItem = computed(() =>
  availableItems.value.find((item) => item.value === itemValue.value) ?? availableItems.value[0],
)
const maxLevel = computed(() => selectedItem.value?.rows?.length ?? 0)
const currentLevelNumber = computed(() => clampInteger(currentLevel.value, 0, Math.max(0, maxLevel.value - 1)))
const targetLevelNumber = computed(() => clampInteger(targetLevel.value, currentLevelNumber.value + 1, maxLevel.value))
const quantityNumber = computed(() => Math.max(1, clampInteger(quantity.value, 1, 999)))
const ownedMaterialNumber = computed(() => Math.max(0, parseNumber(ownedMaterials.value)))
const selectedRows = computed(() =>
  (selectedItem.value?.rows ?? []).slice(currentLevelNumber.value, targetLevelNumber.value),
)
const requiredMaterials = computed(() =>
  selectedRows.value.reduce((total, row) => total + parseNumber(row.material), 0) * quantityNumber.value,
)
const requiredFeeMillions = computed(() =>
  selectedRows.value.reduce((total, row) => total + parseFeeToMillions(row.fee), 0) * quantityNumber.value,
)
const ascensionMaterial = computed(() => getAscensionMaterial(selectedItem.value, quantityNumber.value))
const remainingMaterials = computed(() => Math.max(0, requiredMaterials.value - ownedMaterialNumber.value))
const extraMaterials = computed(() => Math.max(0, ownedMaterialNumber.value - requiredMaterials.value))
const completionPercent = computed(() => {
  if (!requiredMaterials.value) {
    return 100
  }

  return clamp(ownedMaterialNumber.value / requiredMaterials.value * 100, 0, 100)
})
const canEnhance = computed(() => ownedMaterialNumber.value >= requiredMaterials.value)
const materialStatusClasses = computed(() => canEnhance.value
  ? {
      badge: 'border-success-border bg-success-surface text-success-foreground',
      foreground: 'text-success-foreground',
      surface: 'parade-success-surface border-success-border',
    }
  : {
      badge: 'border-warning-border bg-warning-surface text-warning-foreground',
      foreground: 'text-warning-foreground',
      surface: 'parade-warning-surface border-warning-border',
    })
const currentCumulative = computed(() =>
  (selectedItem.value?.rows ?? [])
    .slice(0, currentLevelNumber.value)
    .reduce((total, row) => total + parseNumber(row.material), 0),
)
const targetCumulative = computed(() =>
  (selectedItem.value?.rows ?? [])
    .slice(0, targetLevelNumber.value)
    .reduce((total, row) => total + parseNumber(row.material), 0),
)
const currentLevelOptions = computed(() =>
  Array.from({ length: Math.max(0, maxLevel.value) }, (_, level) => ({
    value: String(level),
    label: `+${level}`,
  })),
)
const targetLevelOptions = computed(() =>
  Array.from({ length: Math.max(0, maxLevel.value - currentLevelNumber.value) }, (_, index) => {
    const level = currentLevelNumber.value + index + 1
    return {
      value: String(level),
      label: `+${level}`,
    }
  }),
)
const visibleCatalogItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const items = materials.filter((item) => item.rows?.length)

  if (!query) {
    return items
  }

  return items.filter((item) => [
    item.name,
    item.summary?.type,
    item.summary?.farm,
    item.summary?.quarter,
    getAscensionMaterialLabel(item),
  ].some((value) => String(value ?? '').toLowerCase().includes(query)))
})
const selectedStepsKey = computed(() => [
  selectedItem.value?.value,
  ...selectedRows.value.map((row) => row.step),
].join(':'))

watch(selectedItem, (item) => {
  if (!item) {
    return
  }

  currentLevel.value = String(clampInteger(currentLevel.value, 0, Math.max(0, item.rows.length - 1)))
  targetLevel.value = String(clampInteger(targetLevel.value, currentLevelNumber.value + 1, item.rows.length))
}, { immediate: true })

watch(currentLevelNumber, (level) => {
  if (targetLevelNumber.value <= level) {
    targetLevel.value = String(Math.min(maxLevel.value, level + 1))
  }
})

function getAvailableItems() {
  return materials.filter((item) => !item.disabled && item.rows?.length)
}

function selectCatalogItem(value) {
  if (availableItems.value.some((item) => item.value === value)) {
    itemValue.value = value
    currentLevel.value = '0'
    targetLevel.value = String(maxLevel.value || 1)
  }
}

async function expandCatalog({ scrollToCatalog = false } = {}) {
  catalogFocusPending.value = true
  catalogSearchScrollPending.value = !scrollToCatalog
  catalogExpanded.value = true
  await nextTick()

  if (scrollToCatalog) {
    const catalogElement = catalogSection.value?.$el ?? catalogSection.value
    catalogElement?.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  focusCatalogSearch()
}

function focusCatalogSearch() {
  if (!catalogFocusPending.value) {
    return
  }

  const searchInput = catalogSearchControl.value?.querySelector('input')
  if (!searchInput) {
    return
  }

  searchInput?.focus({ preventScroll: true })

  if (catalogSearchScrollPending.value) {
    searchInput.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    })
  }

  catalogFocusPending.value = false
  catalogSearchScrollPending.value = false
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function browseCatalog(event) {
  event.preventDefault()
  expandCatalog({ scrollToCatalog: true })
}

function setRange(startLevel, endLevel) {
  currentLevel.value = String(clampInteger(startLevel, 0, Math.max(0, maxLevel.value - 1)))
  targetLevel.value = String(clampInteger(endLevel, currentLevelNumber.value + 1, maxLevel.value))
}

function parseNumber(value) {
  const parsed = Number(String(value ?? '').replaceAll(',', '').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function parseFeeToMillions(value) {
  const text = String(value ?? '').trim()
  if (!text || text === '-') {
    return 0
  }

  const match = text.match(/([\d.]+)\s*([KMBT]?)/i)
  if (!match) {
    return 0
  }

  const amount = Number(match[1])
  const unit = match[2].toUpperCase()
  if (!Number.isFinite(amount)) {
    return 0
  }

  const multipliers = {
    K: 0.001,
    M: 1,
    B: 1000,
    T: 1000000,
  }

  return amount * (multipliers[unit] ?? 1)
}

function getAscensionMaterial(item, itemQuantity) {
  const match = String(item?.summary?.type ?? '').match(/\+\s*([^+]*?\bAscension Stone)\s*x\s*([\d,]+)/i)
  if (!match) {
    return null
  }

  const perItem = parseNumber(match[2])
  if (!perItem) {
    return null
  }

  return {
    name: match[1].trim(),
    perItem,
    total: perItem * itemQuantity,
  }
}

function getAscensionMaterialLabel(item) {
  const material = getAscensionMaterial(item, 1)
  if (!material) {
    return ''
  }

  return `${material.name} x${formatNumber(material.perItem)}`
}

function clampInteger(value, min, max) {
  const parsed = parseInt(value)
  if (!Number.isFinite(parsed)) {
    return min
  }

  return Math.min(Math.max(parsed, min), max)
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.min(Math.max(value, min), max)
}

function formatNumber(value) {
  return Math.round(value).toLocaleString()
}

function formatCompactNumber(value) {
  if (value >= 1000000) {
    return trimDecimal(value / 1000000) + 'M'
  }
  if (value >= 1000) {
    return trimDecimal(value / 1000) + 'K'
  }

  return formatNumber(value)
}

function formatFee(millions) {
  if (!millions) {
    return '-'
  }

  if (millions >= 1000000) {
    return trimDecimal(millions / 1000000) + 'T'
  }
  if (millions >= 1000) {
    return trimDecimal(millions / 1000) + 'B'
  }

  return trimDecimal(millions) + 'M'
}

function trimDecimal(value) {
  return Number(value.toFixed(2)).toLocaleString()
}
</script>

<template>
  <TooltipProvider>
    <div class="parade-page">
      <AppShellHeader
        active="upgrade"
        eyebrow="Upgrade materials"
        title="Plan your next upgrade."
      />

      <main class="parade-workspace grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
        <section class="grid content-start gap-4 xl:col-span-2">
          <Card class="parade-card parade-goal-card relative rounded-[22px] border-info-border">
            <CardHeader>
              <div class="flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <img class="size-12 object-contain drop-shadow-sm" src="/cool_priring.png" alt="">
                  <div>
                    <p class="parade-section-kicker">Upgrade setup</p>
                    <CardTitle class="mt-1 text-lg">Choose your goal</CardTitle>
                  </div>
                </div>
                <Button variant="secondary" as-child>
                  <a href="#upgrade-catalog" aria-controls="upgrade-catalog" @click="browseCatalog">Browse</a>
                </Button>
              </div>
            </CardHeader>
            <CardContent class="grid gap-4 lg:grid-cols-[minmax(240px,1.3fr)_1fr_1fr_auto] lg:items-end">
              <div class="grid gap-2 lg:min-w-0">
                <Label for="upgrade-item">Item</Label>
                <Select v-model="itemValue">
                  <SelectTrigger
                    id="upgrade-item"
                    class="min-h-9 w-full justify-start data-[size=default]:h-auto *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-start *:data-[slot=select-value]:text-left *:data-[slot=select-value]:line-clamp-none"
                  >
                    <SparklesIcon class="size-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue as-child placeholder="Select item">
                      <span class="min-w-0 whitespace-normal break-words text-left leading-snug">
                        {{ selectedItem?.name ?? 'Select item' }}
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="item in availableItems"
                      :key="item.value"
                      :value="item.value"
                      :text-value="item.name"
                      class="items-start whitespace-normal"
                    >
                      <span class="min-w-0 whitespace-normal break-words leading-snug">
                        {{ item.name }}
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="grid gap-2">
                  <Label for="current-level">Current</Label>
                  <Select v-model="currentLevel">
                    <SelectTrigger id="current-level" class="w-full">
                      <SelectValue placeholder="Current" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="level in currentLevelOptions"
                        :key="level.value"
                        :value="level.value"
                      >
                        {{ level.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="grid gap-2">
                  <Label for="target-level">Target</Label>
                  <Select v-model="targetLevel">
                    <SelectTrigger id="target-level" class="w-full">
                      <SelectValue placeholder="Target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="level in targetLevelOptions"
                        :key="level.value"
                        :value="level.value"
                      >
                        {{ level.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="grid gap-2">
                  <Label for="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    v-model="quantity"
                    type="number"
                    min="1"
                    inputmode="numeric"
                  />
                </div>

                <div class="grid gap-2">
                  <Label for="owned-materials">Owned materials</Label>
                  <Input
                    id="owned-materials"
                    v-model="ownedMaterials"
                    type="number"
                    min="0"
                    inputmode="numeric"
                  />
                </div>
              </div>

              <div class="grid gap-2">
                <Label>Presets</Label>
                <div class="flex flex-wrap gap-2 lg:flex-nowrap">
                  <Button variant="secondary" size="sm" @click="setRange(currentLevelNumber, Math.min(maxLevel, currentLevelNumber + 1))">
                    Next
                  </Button>
                  <Button variant="outline" size="sm" @click="setRange(0, maxLevel)">
                    +0 → max
                  </Button>
                  <Button variant="outline" size="sm" @click="setRange(currentLevelNumber, maxLevel)">
                    Current → max
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card class="hidden">
            <CardHeader>
              <CardTitle class="flex items-center gap-2 text-base">
                <MapPinnedIcon class="size-4" />
                Source
              </CardTitle>
              <CardDescription>{{ selectedItem?.name }}</CardDescription>
            </CardHeader>
            <CardContent class="grid gap-3">
              <div class="grid grid-cols-2 gap-2">
                <div class="rounded-lg bg-muted/20 p-3">
                  <div class="text-xs text-muted-foreground">Farm</div>
                  <div class="mt-1 text-sm font-medium">{{ selectedItem?.summary?.farm }}</div>
                </div>
                <div class="rounded-lg bg-muted/20 p-3">
                  <div class="text-xs text-muted-foreground">Added</div>
                  <div class="mt-1 text-sm font-medium">{{ selectedItem?.summary?.quarter }}</div>
                </div>
                <div class="rounded-lg bg-muted/20 p-3">
                  <div class="text-xs text-muted-foreground">Max</div>
                  <div class="mt-1 text-sm font-medium">{{ selectedItem?.summary?.max }}</div>
                </div>
                <div class="rounded-lg bg-muted/20 p-3">
                  <div class="text-xs text-muted-foreground">Full cost</div>
                  <div class="mt-1 text-sm font-medium">{{ selectedItem?.summary?.fee }}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section class="grid content-start gap-4 xl:col-span-2 xl:grid-cols-[1.08fr_.92fr]">
          <Card class="parade-card rounded-[22px] border-t-4 border-t-primary">
            <CardHeader>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle class="flex items-center gap-2 text-base">
                    <PackageIcon class="size-4" />
                    Materials
                  </CardTitle>
                  <CardDescription>
                    <span class="motion-tabular">+{{ currentLevelNumber }} to +{{ targetLevelNumber }} / {{ quantityNumber }} item{{ quantityNumber === 1 ? '' : 's' }}</span>
                  </CardDescription>
                </div>

                <div
                  class="grid h-5 w-48"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <Transition name="motion-swap">
                    <Badge
                      :key="canEnhance ? 'ready' : 'missing'"
                      variant="outline"
                      class="col-start-1 row-start-1 w-full justify-center overflow-hidden"
                      :class="materialStatusClasses.badge"
                    >
                      <CheckCircle2Icon v-if="canEnhance" data-icon="inline-start" />
                      <TriangleAlertIcon v-else data-icon="inline-start" />
                      <span class="motion-tabular">{{ canEnhance ? 'Ready' : `${formatNumber(remainingMaterials)} missing` }}</span>
                    </Badge>
                  </Transition>
                </div>
              </div>
            </CardHeader>

            <CardContent class="grid gap-4">
              <div class="parade-material-hero grid grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border border-info-border p-4">
                <div class="min-w-0">
                  <div class="flex items-center gap-3">
                    <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-raised shadow-sm">
                      <img class="size-8 object-contain" :src="hammerImage" alt="">
                    </span>
                    <div class="min-w-0">
                      <h3 class="truncate text-base font-bold">{{ selectedItem?.summary?.farm }} material</h3>
                      <p class="motion-tabular text-sm text-muted-foreground">{{ formatNumber(ownedMaterialNumber) }} / {{ formatNumber(requiredMaterials) }}</p>
                    </div>
                  </div>
                  <Progress :model-value="completionPercent" class="mt-3 h-2" />
                </div>
                <div class="text-right">
                  <strong class="motion-tabular block text-3xl font-bold" :class="materialStatusClasses.foreground">{{ completionPercent.toFixed(0) }}%</strong>
                  <span class="text-xs font-semibold" :class="materialStatusClasses.foreground">owned</span>
                </div>
              </div>

              <div class="grid grid-cols-3 gap-2">
                <div class="rounded-2xl border border-info-border bg-info-surface p-3 md:p-4">
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <PackageIcon class="size-4" />
                    Required
                  </div>
                  <div class="motion-tabular mt-2 text-xl font-bold tracking-tight md:text-3xl">{{ formatNumber(requiredMaterials) }}</div>
                </div>

                <div class="hidden">
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Layers3Icon class="size-4" />
                    Owned
                  </div>
                  <div class="mt-2 text-3xl font-semibold tracking-normal">{{ formatNumber(ownedMaterialNumber) }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">{{ completionPercent.toFixed(0) }}% covered</div>
                </div>

                <div class="grid min-w-0">
                  <Transition name="motion-swap">
                    <div
                      :key="canEnhance ? 'extra' : 'remaining'"
                      class="col-start-1 row-start-1 rounded-2xl border p-3 md:p-4"
                      :class="materialStatusClasses.surface"
                    >
                      <div class="flex items-center gap-2 text-sm text-muted-foreground">
                        <SparklesIcon class="size-4" />
                        {{ canEnhance ? 'Extra' : 'Remaining' }}
                      </div>
                      <div
                        class="motion-tabular mt-2 text-xl font-bold tracking-tight md:text-3xl"
                        :class="materialStatusClasses.foreground"
                      >
                        {{ formatNumber(canEnhance ? extraMaterials : remainingMaterials) }}
                      </div>
                      <div class="mt-1 text-xs text-muted-foreground">
                        {{ canEnhance ? 'after target' : 'still needed' }}
                      </div>
                    </div>
                  </Transition>
                </div>

                <div class="parade-success-surface rounded-2xl border border-success-border p-3 md:p-4">
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <CoinsIcon class="size-4" />
                    Fee
                  </div>
                  <div class="motion-tabular mt-2 text-xl font-bold tracking-tight md:text-3xl">{{ formatFee(requiredFeeMillions) }}</div>
                </div>
              </div>

              <Transition name="motion-pop" mode="out-in">
                <div
                  v-if="ascensionMaterial"
                  :key="ascensionMaterial.name"
                  class="rounded-lg border border-info-border bg-info-surface p-4"
                >
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2 text-sm font-medium">
                        <SparklesIcon class="size-4 text-info-foreground" />
                        Ascension material
                      </div>
                      <div class="mt-1 truncate text-sm text-muted-foreground">
                        {{ ascensionMaterial.name }}
                      </div>
                    </div>

                    <div class="grid gap-1 sm:min-w-36 sm:text-right">
                      <div class="text-xs text-muted-foreground">Required</div>
                      <div class="motion-tabular text-2xl font-semibold tracking-normal text-info-foreground">
                        {{ formatNumber(ascensionMaterial.total) }}
                      </div>
                      <div class="motion-tabular text-xs text-muted-foreground">
                        {{ formatNumber(ascensionMaterial.perItem) }} per item
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>

              <div class="hidden">
                <div class="rounded-lg bg-muted/20 p-3">
                  <div class="text-xs text-muted-foreground">Current cumulative</div>
                  <div class="mt-1 text-lg font-semibold">{{ formatNumber(currentCumulative * quantityNumber) }}</div>
                </div>
                <div class="rounded-lg bg-muted/20 p-3">
                  <div class="text-xs text-muted-foreground">Target cumulative</div>
                  <div class="mt-1 text-lg font-semibold">{{ formatNumber(targetCumulative * quantityNumber) }}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card class="parade-card rounded-[22px] border-t-4 border-t-chart-2">
            <CardHeader>
              <CardTitle class="text-lg">Upgrade steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="grid min-w-0">
                <Transition name="motion-swap">
                  <div :key="selectedStepsKey" class="col-start-1 row-start-1 min-w-0">
                    <Table
                      container-class="max-h-[420px] min-w-0 rounded-xl border"
                      class="motion-tabular min-w-[420px] [&_td]:py-3 [&_th]:h-10"
                    >
                      <TableHeader>
                        <TableRow>
                          <TableHead>Step</TableHead>
                          <TableHead>Material</TableHead>
                          <TableHead>Fee</TableHead>
                          <TableHead class="hidden">Cumulative</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow v-for="row in selectedRows" :key="row.step">
                          <TableCell>
                            <Badge variant="secondary" class="font-bold text-primary">{{ row.step }}</Badge>
                          </TableCell>
                          <TableCell>{{ formatNumber(parseNumber(row.material) * quantityNumber) }}</TableCell>
                          <TableCell>{{ formatFee(parseFeeToMillions(row.fee) * quantityNumber) }}</TableCell>
                          <TableCell class="hidden">{{ formatNumber(parseNumber(row.cumulative) * quantityNumber) }}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </Transition>
              </div>
            </CardContent>
          </Card>

          <Card id="upgrade-catalog" ref="catalogSection" class="parade-card scroll-mt-4 rounded-[22px] xl:col-span-2">
            <CardHeader>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle class="text-lg">Related items</CardTitle>
                  <CardDescription>
                    <Transition name="motion-fade" mode="out-in">
                      <span :key="catalogExpanded ? 'catalog' : 'quick'" class="motion-tabular block">
                        {{ catalogExpanded ? `${visibleCatalogItems.length} catalog entries` : 'Quick picks from the upgrade catalog' }}
                      </span>
                    </Transition>
                  </CardDescription>
                </div>

                <div ref="catalogSearchControl" class="relative h-11 w-full sm:w-[280px]">
                  <Transition name="motion-swap" @after-enter="focusCatalogSearch">
                    <div v-if="catalogExpanded" key="search" class="absolute inset-0">
                      <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        v-model="searchQuery"
                        class="h-11 pl-9"
                        placeholder="Search"
                        aria-label="Search upgrade catalog"
                        aria-controls="upgrade-catalog-list"
                      />
                    </div>
                    <Button
                      v-else
                      key="catalog-button"
                      variant="outline"
                      class="absolute right-0 top-0 min-h-11"
                      aria-controls="upgrade-catalog-list"
                      :aria-expanded="catalogExpanded"
                      @click="expandCatalog()"
                    >
                      Catalog
                    </Button>
                  </Transition>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea :class="catalogExpanded ? 'max-h-[460px]' : ''">
                <Transition name="motion-fade" mode="out-in">
                  <div
                    id="upgrade-catalog-list"
                    :key="catalogExpanded ? 'catalog' : 'quick-picks'"
                    class="grid gap-2"
                    :class="catalogExpanded ? '' : 'md:grid-cols-3'"
                  >
                    <button
                      v-for="item in visibleCatalogItems.slice(0, catalogExpanded ? visibleCatalogItems.length : 3)"
                      :key="item.value"
                      type="button"
                      class="grid min-h-11 gap-2 rounded-2xl border bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 sm:grid-cols-[minmax(0,1fr)_auto]"
                      :class="item.value === itemValue ? 'border-info-border bg-info-surface' : ''"
                      @click="selectCatalogItem(item.value)"
                    >
                      <span class="min-w-0">
                        <span class="block truncate text-sm font-medium">{{ item.name }}</span>
                        <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                          {{ item.summary.farm }} / {{ item.summary.quarter }}
                        </span>
                        <span
                          v-if="getAscensionMaterialLabel(item)"
                          class="mt-1 flex min-w-0 items-center gap-1 text-xs font-medium text-info-foreground"
                        >
                          <SparklesIcon class="size-3 shrink-0" />
                          <span class="truncate">{{ getAscensionMaterialLabel(item) }}</span>
                        </span>
                      </span>
                      <span class="flex flex-wrap items-center gap-2 sm:justify-end">
                        <Badge variant="secondary">{{ item.summary.max }}</Badge>
                        <Badge variant="outline">{{ item.summary.total }}</Badge>
                      </span>
                    </button>
                  </div>
                </Transition>
              </ScrollArea>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  </TooltipProvider>
</template>
