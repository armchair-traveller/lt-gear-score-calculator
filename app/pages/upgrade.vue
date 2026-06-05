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

const router = useRouter()
const initialItem = getAvailableItems()[0]
const itemValue = ref(initialItem?.value ?? '')
const currentLevel = ref('0')
const targetLevel = ref(String(initialItem?.rows?.length ?? 1))
const ownedMaterials = ref(0)
const quantity = ref(1)
const searchQuery = ref('')
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
    <div class="min-h-screen bg-background text-foreground">
      <header class="bg-background/95 backdrop-blur shadow-[0_1px_12px_rgb(15_23_42_/_0.04)] dark:shadow-none">
        <div class="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/55">
              <img class="size-11" src="/cool_priring.png" alt="">
            </div>
            <div class="min-w-0">
              <h1 class="truncate text-lg font-semibold tracking-normal md:text-xl">
                Upgrade Material Calculator
              </h1>
              <p class="truncate text-xs text-muted-foreground">
                {{ selectedItem?.summary?.farm }} / {{ selectedItem?.summary?.quarter }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <ModeToggle />

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="outline" size="icon" as-child>
                  <NuxtLink :to="homeHref">
                    <ArrowLeftIcon />
                    <span class="sr-only">Open enchant calculator</span>
                  </NuxtLink>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Enchant calculator</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="outline" size="icon" as-child>
                  <NuxtLink :to="planHref">
                    <img class="size-5" src="/smart_priring.png" alt="">
                    <span class="sr-only">Open planner</span>
                  </NuxtLink>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Planner</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <main class="mx-auto grid w-full max-w-[1600px] gap-4 px-4 py-4 md:px-6 xl:grid-cols-[minmax(420px,560px)_minmax(0,1fr)]">
        <section class="grid content-start gap-4">
          <Card class="rounded-lg">
            <CardHeader>
              <CardTitle class="flex items-center gap-2 text-base">
                <CalculatorIcon class="size-4" />
                Goal
              </CardTitle>
              <CardDescription>{{ selectedItem?.summary?.type }}</CardDescription>
            </CardHeader>
            <CardContent class="grid gap-4">
              <div class="grid gap-2">
                <Label for="upgrade-item">Item</Label>
                <Select v-model="itemValue">
                  <SelectTrigger
                    id="upgrade-item"
                    class="w-full justify-start *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-start *:data-[slot=select-value]:text-left"
                  >
                    <SparklesIcon class="size-3.5 shrink-0 text-muted-foreground" />
                    <SelectValue placeholder="Select item" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="item in availableItems" :key="item.value" :value="item.value">
                      {{ item.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
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

              <div class="grid gap-3 sm:grid-cols-2">
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

              <div class="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" @click="setRange(currentLevelNumber, Math.min(maxLevel, currentLevelNumber + 1))">
                  Next
                </Button>
                <Button variant="secondary" size="sm" @click="setRange(0, maxLevel)">
                  +0 to max
                </Button>
                <Button variant="outline" size="sm" @click="setRange(currentLevelNumber, maxLevel)">
                  Current to max
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card class="rounded-lg">
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

        <section class="grid content-start gap-4">
          <Card class="rounded-lg">
            <CardHeader>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle class="flex items-center gap-2 text-base">
                    <PackageIcon class="size-4" />
                    Materials
                  </CardTitle>
                  <CardDescription>
                    +{{ currentLevelNumber }} to +{{ targetLevelNumber }} / {{ quantityNumber }} item{{ quantityNumber === 1 ? '' : 's' }}
                  </CardDescription>
                </div>

                <Badge
                  variant="outline"
                  class="w-fit"
                  :class="canEnhance
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'"
                >
                  <CheckCircle2Icon v-if="canEnhance" class="size-3.5" />
                  <TriangleAlertIcon v-else class="size-3.5" />
                  {{ canEnhance ? 'Ready' : 'Missing' }}
                </Badge>
              </div>
            </CardHeader>

            <CardContent class="grid gap-4">
              <div class="grid gap-3 md:grid-cols-4">
                <div class="rounded-lg bg-muted/20 p-4">
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <PackageIcon class="size-4" />
                    Required
                  </div>
                  <div class="mt-2 text-3xl font-semibold tracking-normal">{{ formatNumber(requiredMaterials) }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">{{ formatCompactNumber(requiredMaterials) }} total</div>
                </div>

                <div class="rounded-lg bg-muted/20 p-4">
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <Layers3Icon class="size-4" />
                    Owned
                  </div>
                  <div class="mt-2 text-3xl font-semibold tracking-normal">{{ formatNumber(ownedMaterialNumber) }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">{{ completionPercent.toFixed(0) }}% covered</div>
                </div>

                <div class="rounded-lg bg-muted/20 p-4">
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <SparklesIcon class="size-4" />
                    {{ canEnhance ? 'Extra' : 'Remaining' }}
                  </div>
                  <div
                    class="mt-2 text-3xl font-semibold tracking-normal"
                    :class="canEnhance ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'"
                  >
                    {{ formatNumber(canEnhance ? extraMaterials : remainingMaterials) }}
                  </div>
                  <div class="mt-1 text-xs text-muted-foreground">
                    {{ canEnhance ? 'after target' : 'still needed' }}
                  </div>
                </div>

                <div class="rounded-lg bg-muted/20 p-4">
                  <div class="flex items-center gap-2 text-sm text-muted-foreground">
                    <CoinsIcon class="size-4" />
                    Fee
                  </div>
                  <div class="mt-2 text-3xl font-semibold tracking-normal">{{ formatFee(requiredFeeMillions) }}</div>
                  <div class="mt-1 text-xs text-muted-foreground">{{ selectedRows.length }} step{{ selectedRows.length === 1 ? '' : 's' }}</div>
                </div>
              </div>

              <Progress :model-value="completionPercent" class="h-2" />

              <div
                v-if="ascensionMaterial"
                class="rounded-lg border border-sky-200/80 bg-sky-50/70 p-4 dark:border-sky-900/70 dark:bg-sky-950/35"
              >
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2 text-sm font-medium">
                      <SparklesIcon class="size-4 text-sky-700 dark:text-sky-300" />
                      Ascension material
                    </div>
                    <div class="mt-1 truncate text-sm text-muted-foreground">
                      {{ ascensionMaterial.name }}
                    </div>
                  </div>

                  <div class="grid gap-1 sm:min-w-36 sm:text-right">
                    <div class="text-xs text-muted-foreground">Required</div>
                    <div class="text-2xl font-semibold tracking-normal text-sky-800 dark:text-sky-200">
                      {{ formatNumber(ascensionMaterial.total) }}
                    </div>
                    <div class="text-xs text-muted-foreground">
                      {{ formatNumber(ascensionMaterial.perItem) }} per item
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid gap-3 md:grid-cols-2">
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

          <Card class="rounded-lg">
            <CardHeader>
              <CardTitle class="text-base">Upgrade Steps</CardTitle>
              <CardDescription>{{ selectedItem?.summary?.type }}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table
                container-class="max-h-[420px] min-w-0 rounded-lg border"
                class="min-w-[600px] [&_td]:py-2.5 [&_th]:h-10"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Step</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Cumulative</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="row in selectedRows" :key="row.step">
                    <TableCell class="font-medium">{{ row.step }}</TableCell>
                    <TableCell>{{ formatNumber(parseNumber(row.material) * quantityNumber) }}</TableCell>
                    <TableCell>{{ formatFee(parseFeeToMillions(row.fee) * quantityNumber) }}</TableCell>
                    <TableCell>{{ formatNumber(parseNumber(row.cumulative) * quantityNumber) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card class="rounded-lg">
            <CardHeader>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle class="text-base">Catalog</CardTitle>
                  <CardDescription>{{ visibleCatalogItems.length }} entries</CardDescription>
                </div>

                <div class="relative w-full sm:w-[280px]">
                  <SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    v-model="searchQuery"
                    class="pl-9"
                    placeholder="Search"
                    aria-label="Search upgrade catalog"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea class="max-h-[460px] rounded-lg border">
                <div class="grid">
                  <button
                    v-for="item in visibleCatalogItems"
                    :key="item.value"
                    type="button"
                    class="grid gap-2 border-b px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40 sm:grid-cols-[minmax(0,1fr)_auto]"
                    :class="item.value === itemValue ? 'bg-muted/55' : ''"
                    @click="selectCatalogItem(item.value)"
                  >
                    <span class="min-w-0">
                      <span class="block truncate text-sm font-medium">{{ item.name }}</span>
                      <span class="mt-0.5 block truncate text-xs text-muted-foreground">
                        {{ item.summary.farm }} / {{ item.summary.quarter }}
                      </span>
                      <span
                        v-if="getAscensionMaterialLabel(item)"
                        class="mt-1 flex min-w-0 items-center gap-1 text-xs font-medium text-sky-700 dark:text-sky-300"
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
              </ScrollArea>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  </TooltipProvider>
</template>
