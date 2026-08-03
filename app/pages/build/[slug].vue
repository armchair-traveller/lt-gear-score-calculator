<script setup>
import { computed, ref } from 'vue'
import {
  AlertCircleIcon,
  RefreshCwIcon,
  Rows3Icon,
} from '@lucide/vue'
import { cn } from '@/lib/utils.js'
import { createEmptyGearPlan, parseGearPlanStrict } from '@/features/gear-plan/plan-validation.js'
import { useGearPlanReadModel } from '@/features/gear-plan/useGearPlanReadModel.js'
import { getGearPlanOpportunityStatusClass } from '@/features/gear-plan/status-styles.js'

const route = useRoute()
const slug = computed(() => getRouteValue(route.params.slug))
const requestPath = computed(() => `/api/build/${encodeURIComponent(slug.value)}`)
const selectedSlotId = ref('')
const detailOpen = ref(false)

const {
  data,
  status,
  error,
  refresh,
} = useFetch(requestPath, {
  server: false,
  headers: {
    accept: 'application/json',
  },
})

const build = computed(() => normalizePublicBuild(data.value))
const plan = computed(() => build.value?.plan ?? createEmptyGearPlan())
const {
  sortMode,
  slotModels,
  eligibleSlots,
  rankedSlots,
  topPriority,
  totalOpportunityDI,
  loadoutQualityPercent,
  categoryGroups,
  getPrimaryReason,
  getLineStatusLabel,
} = useGearPlanReadModel(plan)

const isLoading = computed(() => status.value === 'idle' || status.value === 'pending')
const hasError = computed(() =>
  status.value === 'error'
  || (status.value === 'success' && !build.value),
)
const responseCode = computed(() => getResponseCode(error.value))
const errorTitle = computed(() =>
  responseCode.value === 'PUBLIC_BUILD_NOT_FOUND'
    ? 'Build not found'
    : 'Build unavailable',
)
const errorDescription = computed(() =>
  responseCode.value === 'PUBLIC_BUILD_NOT_FOUND'
    ? 'This public build link does not exist or is no longer available.'
    : 'We could not load this public build right now. Try again in a moment.',
)
const ownerInitials = computed(() => getInitials(build.value?.owner.displayName))
const formattedUpdatedAt = computed(() => formatUpdatedAt(build.value?.updatedAt))
const selectedSlot = computed(() =>
  slotModels.value.find(slot => slot.id === selectedSlotId.value) ?? null,
)

useHead(() => ({
  title: build.value
    ? `${build.value.owner.displayName}’s build · LaTale Tools`
    : 'Shared build · LaTale Tools',
}))

function setSortMode(value) {
  if (value === 'impact' || value === 'quality') {
    sortMode.value = value
  }
}

function openSlot(slot) {
  if (!slot?.result?.eligible) {
    return
  }

  selectedSlotId.value = slot.id
  detailOpen.value = true
}

function normalizePublicBuild(value) {
  try {
    const displayName = String(value?.owner?.displayName ?? '').trim()
    const updatedAt = String(value?.updatedAt ?? '').trim()
    const timestamp = new Date(updatedAt)
    if (!displayName || !Number.isFinite(timestamp.getTime())) {
      return null
    }

    const image = String(value?.owner?.image ?? '').trim()
    return {
      owner: {
        displayName,
        image: /^https:\/\//i.test(image) ? image : '',
      },
      plan: parseGearPlanStrict(value.plan),
      updatedAt: timestamp.toISOString(),
    }
  }
  catch {
    return null
  }
}

function getRouteValue(value) {
  return String(Array.isArray(value) ? value[0] : value ?? '').trim()
}

function getResponseCode(fetchError) {
  const candidates = [
    fetchError?.data?.data?.code,
    fetchError?.data?.code,
    fetchError?.response?._data?.data?.code,
    fetchError?.response?._data?.code,
  ]

  return candidates.find(value => typeof value === 'string') ?? ''
}

function getInitials(value) {
  const words = String(value ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  return words.length
    ? words.slice(0, 2).map(word => word[0]).join('').toUpperCase()
    : 'LT'
}

function formatUpdatedAt(value) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>

<template>
  <div class="parade-route">
    <main
      id="main-content"
      data-route-main="/build"
      tabindex="-1"
      class="parade-workspace grid gap-4"
    >
      <template v-if="isLoading">
        <Card class="parade-card">
          <CardHeader>
            <div class="flex items-center gap-3">
              <Skeleton class="size-10 rounded-full" />
              <div class="flex flex-col gap-2">
                <Skeleton class="h-5 w-44" />
                <Skeleton class="h-4 w-64 max-w-full" />
              </div>
            </div>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Skeleton v-for="index in 4" :key="index" class="h-24" />
          </CardContent>
        </Card>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card class="parade-card">
            <CardHeader>
              <Skeleton class="h-5 w-40" />
              <Skeleton class="h-4 w-64 max-w-full" />
            </CardHeader>
            <CardContent class="flex flex-col gap-2">
              <Skeleton v-for="index in 5" :key="index" class="h-16" />
            </CardContent>
          </Card>
          <Card class="parade-card">
            <CardHeader>
              <Skeleton class="h-5 w-28" />
              <Skeleton class="h-4 w-48 max-w-full" />
            </CardHeader>
            <CardContent class="grid grid-cols-2 gap-2">
              <Skeleton v-for="index in 8" :key="index" class="h-24" />
            </CardContent>
          </Card>
        </div>
      </template>

      <Card v-else-if="hasError" class="parade-card">
        <CardHeader class="sr-only">
          <CardTitle>{{ errorTitle }}</CardTitle>
          <CardDescription>{{ errorDescription }}</CardDescription>
        </CardHeader>
        <CardContent>
          <Empty class="min-h-[420px]">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <AlertCircleIcon />
              </EmptyMedia>
              <EmptyTitle>{{ errorTitle }}</EmptyTitle>
              <EmptyDescription>{{ errorDescription }}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent class="flex flex-row flex-wrap justify-center gap-2">
              <Button variant="outline" @click="refresh()">
                <RefreshCwIcon data-icon="inline-start" />
                Try again
              </Button>
              <Button as-child>
                <NuxtLink to="/plan">Open planner</NuxtLink>
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>

      <template v-else-if="build">
        <Card class="parade-card">
          <CardHeader class="gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
            <div class="flex min-w-0 items-center gap-3">
              <Avatar size="lg">
                <AvatarImage
                  v-if="build.owner.image"
                  :src="build.owner.image"
                  :alt="`${build.owner.displayName}’s Discord avatar`"
                />
                <AvatarFallback>{{ ownerInitials }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0">
                <CardTitle class="truncate">{{ build.owner.displayName }}’s build</CardTitle>
                <CardDescription>
                  Updated <time :datetime="build.updatedAt">{{ formattedUpdatedAt }}</time>
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" class="self-start sm:self-auto">
              Live build
            </Badge>
          </CardHeader>
          <CardContent class="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div class="parade-metric">
              <div class="parade-metric-label">Ranked</div>
              <div class="parade-metric-value motion-tabular">
                {{ eligibleSlots.length }} / {{ slotModels.length }}
              </div>
              <p class="mt-1 text-xs text-muted-foreground">slots with 3+ lines</p>
            </div>
            <div class="parade-metric">
              <div class="parade-metric-label">Loadout quality</div>
              <div class="parade-metric-value motion-tabular">
                {{ loadoutQualityPercent.toFixed(0) }}%
              </div>
              <p class="mt-1 text-xs text-muted-foreground">across ranked pieces</p>
            </div>
            <div class="parade-metric">
              <div class="parade-metric-label">Potential</div>
              <div class="parade-metric-value motion-tabular">
                {{ totalOpportunityDI.toFixed(2) }}%
              </div>
              <p class="mt-1 text-xs text-muted-foreground">total DI still open</p>
            </div>
            <div class="parade-metric">
              <div class="parade-metric-label">Best next upgrade</div>
              <div class="mt-2 flex min-w-0 items-center gap-2">
                <img
                  v-if="topPriority"
                  class="size-9 shrink-0 rounded-md bg-surface-raised p-1"
                  :src="topPriority.image"
                  alt=""
                >
                <div class="min-w-0">
                  <div class="truncate text-base font-semibold">
                    {{ topPriority?.pieceType ?? (eligibleSlots.length ? 'No open potential' : 'No ranking yet') }}
                  </div>
                  <div class="truncate text-xs text-muted-foreground">
                    {{ topPriority
                      ? getPrimaryReason(topPriority)
                      : eligibleSlots.length
                        ? 'Every ranked piece meets its benchmark'
                        : 'Add ranked pieces to compare' }}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card class="parade-card">
            <CardHeader class="gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Upgrade priority</CardTitle>
                <CardDescription>
                  {{ sortMode === 'impact'
                    ? 'Largest damage-impact opportunity first.'
                    : 'Lowest loadout quality first.' }}
                </CardDescription>
              </div>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                :model-value="sortMode"
                aria-label="Rank upgrade priority"
                @update:model-value="setSortMode"
              >
                <ToggleGroupItem value="impact">Impact</ToggleGroupItem>
                <ToggleGroupItem value="quality">Quality</ToggleGroupItem>
              </ToggleGroup>
            </CardHeader>
            <CardContent>
              <div
                v-if="rankedSlots.length"
                class="overflow-hidden rounded-lg border bg-surface-inset"
                role="list"
                aria-label="Ranked gear upgrade opportunities"
              >
                <div
                  v-for="(slot, index) in rankedSlots"
                  :key="slot.id"
                  class="border-b last:border-b-0"
                  role="listitem"
                >
                  <button
                    type="button"
                    :class="cn(
                      'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-surface-raised p-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:grid-cols-[minmax(200px,1fr)_minmax(160px,0.8fr)_auto]',
                      index === 0 && 'bg-info-surface',
                    )"
                    :aria-label="`View ${slot.pieceType} details, ranked ${index + 1}`"
                    @click="openSlot(slot)"
                  >
                    <div class="flex min-w-0 items-center gap-3">
                      <span class="motion-tabular w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                        {{ index + 1 }}
                      </span>
                      <img class="size-9 shrink-0 rounded-md bg-surface-inset p-1" :src="slot.image" alt="">
                      <div class="min-w-0">
                        <div class="truncate text-sm font-medium">{{ slot.pieceType }}</div>
                        <div class="truncate text-xs text-muted-foreground">
                          {{ slot.gearType }} · {{ getLineStatusLabel(slot.result) }}
                        </div>
                      </div>
                    </div>
                    <div class="hidden min-w-0 sm:block">
                      <div class="truncate text-xs text-muted-foreground">
                        {{ getPrimaryReason(slot) }}
                      </div>
                    </div>
                    <div class="text-right">
                      <div class="motion-tabular text-sm font-semibold">
                        {{ sortMode === 'impact'
                          ? `${slot.result.opportunityDI.toFixed(2)}% DI`
                          : `${slot.result.qualityPercent.toFixed(0)}% quality` }}
                      </div>
                      <div class="motion-tabular text-xs text-muted-foreground">
                        {{ sortMode === 'impact'
                          ? `${slot.result.qualityPercent.toFixed(0)}% quality`
                          : `${slot.result.opportunityDI.toFixed(2)}% DI open` }}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              <Empty v-else class="min-h-80 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Rows3Icon />
                  </EmptyMedia>
                  <EmptyTitle>No ranked gear yet</EmptyTitle>
                  <EmptyDescription>
                    This live build does not have any gear pieces with at least three filled enchant lines right now.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>

          <Card class="parade-card">
            <CardHeader>
              <CardTitle>All gear slots</CardTitle>
              <CardDescription>Filled slots open read-only details. Empty slots are shown for context.</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-5">
              <section v-for="group in categoryGroups" :key="group.gearType" class="grid gap-2">
                <h2 class="text-xs font-medium uppercase text-muted-foreground">{{ group.gearType }}</h2>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                  <template v-for="slot in group.slots" :key="slot.id">
                    <button
                      v-if="slot.result.eligible"
                      type="button"
                      class="grid min-h-24 min-w-0 gap-2 rounded-lg border bg-surface-inset p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      :aria-label="`View ${slot.pieceType} details`"
                      @click="openSlot(slot)"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <img class="size-9 rounded-md bg-surface-raised p-1" :src="slot.image" alt="">
                        <Badge
                          variant="outline"
                          :class="getGearPlanOpportunityStatusClass(slot.result.opportunityDI)"
                        >
                          <span class="motion-tabular">{{ slot.result.qualityPercent.toFixed(0) }}%</span>
                        </Badge>
                      </div>
                      <div class="min-w-0">
                        <div class="truncate text-sm font-medium">{{ slot.pieceType }}</div>
                        <div class="truncate text-xs text-muted-foreground">
                          {{ slot.result.opportunityDI <= 0.0001
                            ? (slot.result.aboveBenchmark ? 'Above benchmark' : 'At benchmark')
                            : `${slot.result.opportunityDI.toFixed(2)}% DI open` }}
                        </div>
                      </div>
                    </button>

                    <div
                      v-else
                      class="grid min-h-24 min-w-0 gap-2 rounded-lg border border-dashed bg-muted p-3 text-left text-muted-foreground"
                      :aria-label="`${slot.pieceType} slot is empty`"
                    >
                      <div class="flex items-start justify-between gap-2">
                        <img class="size-9 rounded-md bg-surface-raised p-1 grayscale opacity-60" :src="slot.image" alt="">
                        <Badge variant="secondary">Empty</Badge>
                      </div>
                      <div class="min-w-0">
                        <div class="truncate text-sm font-medium">{{ slot.pieceType }}</div>
                        <div class="truncate text-xs text-muted-foreground">No saved gear</div>
                      </div>
                    </div>
                  </template>
                </div>
              </section>
            </CardContent>
          </Card>
        </div>

        <GearPlanPublicSlotSheet v-model:open="detailOpen" :slot="selectedSlot" />
      </template>
    </main>
  </div>
</template>
