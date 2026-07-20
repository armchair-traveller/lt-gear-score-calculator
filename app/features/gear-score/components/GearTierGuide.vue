<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import { getTierGuideDetails } from '@/features/gear-score/tier-guide.js'

const props = defineProps({
  idPrefix: {
    type: String,
    default: 'current',
  },
  stateLabel: {
    type: String,
    default: 'Current',
  },
  tier: {
    type: String,
    default: '',
  },
  scorePercent: {
    type: [String, Number],
    default: null,
  },
  align: {
    type: String,
    default: 'start',
  },
})

const {
  gearType,
  pieceType,
  results,
  tierGuideRows,
  selectedTierRows,
  getTierClass,
} = useGearScoreCalculatorContext()

const tierPreviewOpen = ref(false)
const tierGuideOpen = ref(false)
const tierGuideTab = ref('evaluation')
const tierTrigger = ref(null)
const suppressTierPreview = ref(false)
let previewSuppressionTimeout = null

const dialogId = computed(() => `${props.idPrefix}-tier-guide-dialog`)
const displayTier = computed(() => props.tier || results.value.tier || '—')
const displayTierLabel = computed(() =>
  String(displayTier.value).replaceAll(' ~ ', '–'),
)
const activeTier = computed(() => String(displayTier.value).split(/\s+/)[0])
const hasTierRange = computed(() => String(displayTier.value).includes('~'))
const markerLabel = computed(() => props.stateLabel === 'Current' ? 'Current' : 'Projected')
const tierAriaLabel = computed(() =>
  `${markerLabel.value} overall tier ${String(displayTier.value).replaceAll(' ~ ', ' to ')}. Open tier guide.`,
)

const displayScorePercent = computed(() =>
  formatPercent(props.scorePercent ?? results.value.percent).replaceAll(' ~ ', '–'),
)

const tierDetails = computed(() => getTierGuideDetails({
  tierRows: selectedTierRows.value,
  guideRows: tierGuideRows,
  currentTier: activeTier.value,
  currentPercent: Number.parseFloat(String(props.scorePercent ?? results.value.percent)),
}))

const pointsToNextText = computed(() => {
  const points = tierDetails.value.pointsToNextTier
  if (points === null) {
    return ''
  }

  return `${points} score ${points === 1 ? 'point' : 'points'} away`
})

const nextTierText = computed(() => {
  if (hasTierRange.value) {
    return 'The projected tier range reflects the possible fully upgraded roll values.'
  }

  const { currentTierRow, nextTierRow, nextTierThreshold } = tierDetails.value
  if (!currentTierRow) {
    return 'Tier progress unavailable'
  }

  if (!nextTierRow) {
    return 'Highest listed tier reached'
  }

  if (nextTierThreshold === null) {
    return `${nextTierRow.tier} threshold unavailable`
  }

  return `${nextTierRow.tier} starts at ${nextTierThreshold}% · ${pointsToNextText.value}`
})

function formatPercent(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return '—'
  }

  return text.includes('%') ? text : `${text}%`
}

function formatScoreBand(value) {
  return String(value ?? '—').replaceAll(' - ', '–')
}

function openTierGuide() {
  tierPreviewOpen.value = false
  tierGuideOpen.value = true
}

function handleTierPreviewOpen(open) {
  if (open && (tierGuideOpen.value || suppressTierPreview.value)) {
    return
  }

  tierPreviewOpen.value = open
}

watch(tierGuideOpen, async (isOpen, wasOpen) => {
  if (isOpen) {
    tierPreviewOpen.value = false
    return
  }

  if (wasOpen) {
    suppressTierPreview.value = true
    await nextTick()
    tierTrigger.value?.focus({ preventScroll: true })

    clearTimeout(previewSuppressionTimeout)
    previewSuppressionTimeout = setTimeout(() => {
      suppressTierPreview.value = false
    }, 350)
  }
})

onBeforeUnmount(() => {
  clearTimeout(previewSuppressionTimeout)
})
</script>

<template>
  <div class="inline-flex">
    <HoverCard
      :open="tierPreviewOpen"
      :open-delay="250"
      :close-delay="100"
      :enable-touch="false"
      @update:open="handleTierPreviewOpen"
    >
      <HoverCardTrigger as-child>
        <Button
          as-child
          variant="ghost"
          size="icon"
          class="h-11 w-auto min-w-11 rounded-full p-0 sm:h-8 sm:min-w-0 sm:px-1.5"
        >
          <button
            ref="tierTrigger"
            type="button"
            :aria-label="tierAriaLabel"
            aria-haspopup="dialog"
            :aria-expanded="tierGuideOpen"
            :aria-controls="dialogId"
            @click="openTierGuide"
          >
            <Badge
              variant="outline"
              class="h-6 px-2.5 font-semibold"
              :class="getTierClass(displayTier)"
            >
              Tier {{ displayTierLabel }}
            </Badge>
          </button>
        </Button>
      </HoverCardTrigger>

      <HoverCardContent
        side="bottom"
        :align="align"
        :side-offset="8"
        :collision-padding="12"
        class="w-80 p-3"
      >
        <div class="flex flex-col gap-3">
          <div>
            <div class="font-semibold">{{ markerLabel }} overall tier {{ displayTierLabel }}</div>
            <div class="motion-tabular text-xs text-muted-foreground">
              {{ displayScorePercent }} score
              <template v-if="tierDetails.currentTierRow && !hasTierRange">
                · {{ formatScoreBand(tierDetails.currentTierRow.Score) }} band
              </template>
            </div>
          </div>

          <Separator />

          <div>
            <div class="font-medium">
              {{ tierDetails.currentGuideRow?.comment || `${stateLabel} item tier` }}
            </div>
            <div class="mt-1 text-xs text-muted-foreground">{{ nextTierText }}</div>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>

    <Dialog v-model:open="tierGuideOpen">
      <DialogContent
        :id="dialogId"
        class="max-h-[calc(100dvh-1rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:!max-w-5xl"
      >
        <DialogHeader class="px-5 py-4 pr-16 sm:px-6 sm:pr-16">
          <DialogTitle>{{ stateLabel }} tier guide</DialogTitle>
          <DialogDescription>
            {{ pieceType }} {{ gearType }} · overall tier uses the five-line threshold
          </DialogDescription>
        </DialogHeader>

        <div class="min-h-0 min-w-0 overflow-y-auto px-4 pb-5 sm:px-6 sm:pb-6">
          <div class="grid gap-3 rounded-2xl border bg-surface-inset p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <Badge variant="outline" :class="getTierClass(displayTier)">
              Tier {{ displayTierLabel }}
            </Badge>
            <div class="min-w-0">
              <div class="motion-tabular font-medium">
                {{ displayScorePercent }} score
                <template v-if="tierDetails.currentTierRow && !hasTierRange">
                  · {{ formatScoreBand(tierDetails.currentTierRow.Score) }} band
                </template>
              </div>
              <div class="mt-1 text-sm text-muted-foreground">{{ nextTierText }}</div>
            </div>
          </div>

          <Tabs v-model="tierGuideTab" class="mt-4 min-w-0 gap-4">
            <TabsList class="w-full sm:w-fit" aria-label="Tier guide views">
              <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
              <TabsTrigger value="equivalence">Equivalence</TabsTrigger>
            </TabsList>

            <TabsContent value="evaluation" class="motion-tab-panel m-0 min-w-0">
              <div class="flex flex-col gap-3">
                <p class="text-sm text-muted-foreground">
                  Broad upgrade guidance. Actual value still depends on your class, build, and current stats.
                </p>
                <Table
                  container-class="max-h-[52vh] min-w-0 rounded-lg border bg-surface-raised"
                  class="min-w-[680px]"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tier</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead>Upgrade</TableHead>
                      <TableHead>Enchants</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="row in tierGuideRows"
                      :key="row.tier"
                      :data-state="tierDetails.currentGuideRow === row ? 'selected' : undefined"
                    >
                      <TableCell>
                        <div class="flex items-center gap-2">
                          <Badge variant="outline" :class="getTierClass(row.tier)">{{ row.tier }}</Badge>
                          <span v-if="tierDetails.currentGuideRow === row" class="text-xs text-muted-foreground">
                            {{ markerLabel }}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{{ row.comment }}</TableCell>
                      <TableCell>{{ row.upgrade }}</TableCell>
                      <TableCell>{{ row.enchants }}</TableCell>
                      <TableCell>{{ row.cost }}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="equivalence" class="motion-tab-panel m-0 min-w-0">
              <div class="flex flex-col gap-3">
                <p class="text-sm text-muted-foreground">
                  Overall score uses Penta. The other columns compare items with fewer completed enchant lines.
                </p>
                <Table
                  container-class="max-h-[52vh] min-w-0 rounded-lg border bg-surface-raised"
                  class="table-fixed min-w-[640px] [&_td]:py-2.5 [&_th]:h-10"
                >
                  <colgroup>
                    <col class="w-28">
                    <col class="w-24">
                    <col class="w-28">
                    <col class="w-20">
                    <col class="w-20">
                    <col class="w-20">
                    <col class="w-20">
                  </colgroup>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Score</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Penta (used)</TableHead>
                      <TableHead>Single</TableHead>
                      <TableHead>Duo</TableHead>
                      <TableHead>Trio</TableHead>
                      <TableHead>Quad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="row in selectedTierRows"
                      :key="row.tier"
                      :data-state="row.tier === activeTier ? 'selected' : undefined"
                    >
                      <TableCell>{{ row.Score }}</TableCell>
                      <TableCell>
                        <div class="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                          <Badge variant="outline" :class="getTierClass(row.tier)">{{ row.tier }}</Badge>
                          <span v-if="row.tier === activeTier" class="text-xs text-muted-foreground">
                            {{ markerLabel }}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{{ row.Penta }}</TableCell>
                      <TableCell>{{ row.Single }}</TableCell>
                      <TableCell>{{ row.Duo }}</TableCell>
                      <TableCell>{{ row.Trio }}</TableCell>
                      <TableCell>{{ row.Quad }}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
