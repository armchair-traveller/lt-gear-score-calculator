<script setup>
import {
  formatTierProgressText,
  getTierGuideDetails,
} from '@/features/gear-score/tier-guide.js'

const {
  gearType,
  pieceType,
  resultMode,
  results,
  tierGuideRows,
  selectedTierRows,
  totalProgress,
  getTierClass,
} = useGearScoreCalculatorContext()

const tierPreviewOpen = ref(false)
const tierGuideOpen = ref(false)
const tierGuideTab = ref('evaluation')

let triggerPointerType = ''
let previewWasOpenOnPointerDown = false

const tierDetails = computed(() => getTierGuideDetails({
  tierRows: selectedTierRows.value,
  guideRows: tierGuideRows,
  currentTier: results.value.tier,
  currentPercent: results.value.percent,
}))

const pointsToNextText = computed(() => {
  const points = tierDetails.value.pointsToNextTier
  if (points === null) {
    return ''
  }

  return `${points} score ${points === 1 ? 'point' : 'points'} away`
})

const nextTierText = computed(() => {
  const { nextTierRow, nextTierThreshold } = tierDetails.value
  if (!nextTierRow || nextTierThreshold === null) {
    return 'Highest listed tier reached'
  }

  return `${nextTierRow.tier} starts at ${nextTierThreshold}% · ${pointsToNextText.value}`
})

const tierProgressText = computed(() => formatTierProgressText(tierDetails.value))

function handleTierPointerDown(event) {
  triggerPointerType = event.pointerType
  previewWasOpenOnPointerDown = tierPreviewOpen.value
}

function resetTierPointerState() {
  triggerPointerType = ''
  previewWasOpenOnPointerDown = false
}

function handleTierTriggerClick(event) {
  const isKeyboardActivation = event.detail === 0
  const shouldOnlyPreview = !isKeyboardActivation
    && triggerPointerType === 'touch'
    && !previewWasOpenOnPointerDown
  resetTierPointerState()

  if (shouldOnlyPreview) {
    return
  }

  tierPreviewOpen.value = false
  tierGuideOpen.value = true
}

function handleTierPreviewOpen(open) {
  if (open && tierGuideOpen.value) {
    return
  }

  tierPreviewOpen.value = open
}

watch(tierGuideOpen, (isOpen) => {
  if (isOpen) {
    tierPreviewOpen.value = false
  }
})
</script>

<template>
  <div>
    <MotionValue
      :motion-key="`${resultMode}:${resultMode === 'rating' ? results.DI : results.percent}:${results.tier}`"
      as="div"
      class="mt-1"
    >
      <span class="flex items-end gap-2">
        <span class="motion-tabular text-5xl font-bold tracking-[-0.06em] text-info-foreground">
          {{ resultMode === 'rating' ? `${results.DI}%` : `${results.percent}%` }}
        </span>

        <HoverCard
          :open="tierPreviewOpen"
          :open-delay="250"
          :close-delay="100"
          :enable-touch="true"
          @update:open="handleTierPreviewOpen"
        >
          <HoverCardTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="rounded-full"
              :aria-label="`Tier ${results.tier} details and guide`"
              aria-haspopup="dialog"
              :aria-expanded="tierGuideOpen"
              aria-controls="tier-guide-dialog"
              aria-describedby="tier-progress-summary"
              @pointerdown="handleTierPointerDown"
              @pointercancel="resetTierPointerState"
              @click="handleTierTriggerClick"
            >
              <Badge variant="outline" :class="getTierClass(results.tier)">
                {{ results.tier }}
              </Badge>
            </Button>
          </HoverCardTrigger>

          <HoverCardContent
            side="bottom"
            align="start"
            :side-offset="8"
            :collision-padding="12"
            class="w-80 p-3"
          >
            <div class="flex flex-col gap-3">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="font-semibold">Tier {{ results.tier }}</div>
                  <div class="motion-tabular text-xs text-muted-foreground">
                    {{ results.percent }}% score
                    <template v-if="tierDetails.currentTierRow">
                      · {{ tierDetails.currentTierRow.Score }} band
                    </template>
                  </div>
                </div>
                <Badge variant="outline" :class="getTierClass(results.tier)">
                  {{ results.tier }}
                </Badge>
              </div>

              <Separator />

              <div>
                <div class="font-medium">
                  {{ tierDetails.currentGuideRow?.comment || 'Current item tier' }}
                </div>
                <div class="mt-1 text-xs text-muted-foreground">{{ nextTierText }}</div>
              </div>

              <p class="text-xs text-muted-foreground">
                Overall item tier uses the five-line (Penta) threshold. Activate for the full guide; on touch, tap the tier again.
              </p>
            </div>
          </HoverCardContent>
        </HoverCard>
      </span>
    </MotionValue>

    <Progress :model-value="totalProgress" class="mt-4 h-2" />
    <p id="tier-progress-summary" class="motion-tabular mt-3 text-xs text-muted-foreground">
      {{ tierProgressText }}
    </p>

    <Dialog v-model:open="tierGuideOpen">
      <DialogContent
        id="tier-guide-dialog"
        class="max-h-[calc(100dvh-1rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:!max-w-5xl"
      >
        <DialogHeader class="px-5 py-4 pr-16 sm:px-6 sm:pr-16">
          <DialogTitle>Tier guide</DialogTitle>
          <DialogDescription>
            {{ pieceType }} {{ gearType }} · overall tier uses the five-line threshold
          </DialogDescription>
        </DialogHeader>

        <div class="min-h-0 min-w-0 overflow-y-auto px-4 pb-5 sm:px-6 sm:pb-6">
          <div class="grid gap-3 rounded-2xl border bg-surface-inset p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
            <Badge variant="outline" :class="getTierClass(results.tier)">
              Tier {{ results.tier }}
            </Badge>
            <div class="min-w-0">
              <div class="motion-tabular font-medium">
                {{ results.percent }}% score
                <template v-if="tierDetails.currentTierRow">
                  · {{ tierDetails.currentTierRow.Score }} band
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
                          <span v-if="tierDetails.currentGuideRow === row" class="text-xs text-muted-foreground">Current</span>
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
                  class="min-w-[720px] [&_td]:py-2.5 [&_th]:h-10"
                >
                  <TableHeader>
                    <TableRow>
                      <TableHead>Score</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Single</TableHead>
                      <TableHead>Duo</TableHead>
                      <TableHead>Trio</TableHead>
                      <TableHead>Quad</TableHead>
                      <TableHead>Penta (used)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow
                      v-for="row in selectedTierRows"
                      :key="row.tier"
                      :data-state="row.tier === results.tier ? 'selected' : undefined"
                    >
                      <TableCell>{{ row.Score }}</TableCell>
                      <TableCell>
                        <div class="flex items-center gap-2">
                          <Badge variant="outline" :class="getTierClass(row.tier)">{{ row.tier }}</Badge>
                          <span v-if="row.tier === results.tier" class="text-xs text-muted-foreground">Current</span>
                        </div>
                      </TableCell>
                      <TableCell>{{ row.Single }}</TableCell>
                      <TableCell>{{ row.Duo }}</TableCell>
                      <TableCell>{{ row.Trio }}</TableCell>
                      <TableCell>{{ row.Quad }}</TableCell>
                      <TableCell>{{ row.Penta }}</TableCell>
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
