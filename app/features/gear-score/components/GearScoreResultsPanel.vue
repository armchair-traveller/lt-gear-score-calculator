<script setup>
import {
  BookmarkPlusIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleAlertIcon,
  CirclePlusIcon,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { decimalStats } from '@/features/gear-score/data.js'
import { assignTraitNotesToLines } from '@/features/gear-score/stat-notes.js'
import { cn } from '@/lib/utils'

const {
  gearType,
  pieceType,
  resultMode,
  statType,
  statInput,
  results,
  selectedTraitRows,
  potentialGainText,
  supportsGearPlan,
  canSaveToGearPlan,
  gearPlanSaveSucceeded,
  hasRolledValue,
  supportsInputEnchantLevel,
  getInputMaxValueText,
  getInputEnchantLevelNumber,
  getProjectionEnchantLevel,
  hasSnapshotProjection,
  setResultMode,
  getFinalUpgrade,
  openSnapshot,
  saveCurrentGearToPlan,
  isInputOverMax,
  getPotentialLineTier,
  getTierClass,
} = useGearScoreCalculatorContext()

const resultView = ref('comparison')
const missingLinesOpen = ref(false)

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
})
const decimalNumberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const rolledLineIndexes = computed(() =>
  statType.value
    .map((_, index) => index)
    .filter((index) => hasRolledValue(index)),
)
const traitNotesByLineIndex = computed(() => assignTraitNotesToLines({
  traits: selectedTraitRows.value,
  statTypes: statType.value,
  lineIndexes: rolledLineIndexes.value,
}))
const missingLineIndexes = computed(() =>
  statType.value
    .map((_, index) => index)
    .filter((index) => !hasRolledValue(index)),
)
const hasResults = computed(() => rolledLineIndexes.value.length > 0)
const hasProjection = computed(() => hasSnapshotProjection())
const hasInvalidSnapshotLine = computed(() =>
  rolledLineIndexes.value.some((index) => isInputOverMax(index)),
)
const showOutcomeProjection = computed(() =>
  hasProjection.value && !hasInvalidSnapshotLine.value,
)
const canShareSnapshot = computed(() =>
  hasResults.value && !hasInvalidSnapshotLine.value,
)
const currentLevelLabel = computed(() => {
  if (!getFinalUpgrade(gearType.value)) {
    return 'Current'
  }

  const level = supportsInputEnchantLevel()
    ? getInputEnchantLevelNumber()
    : 2
  return `Lv.${level}`
})
const currentEndpointLabel = computed(() =>
  currentLevelLabel.value === 'Current'
    ? 'Now'
    : `Now · ${currentLevelLabel.value}`,
)
const projectedEndpointLabel = computed(() =>
  `Upgraded · Lv.${getProjectionEnchantLevel()}`,
)
const panelTitle = computed(() =>
  resultView.value === 'quality'
    ? `${pieceType.value} quality plan`
    : `${pieceType.value} ${hasProjection.value ? 'upgrade' : 'result'}`,
)
const currentOverallValue = computed(() =>
  resultMode.value === 'rating'
    ? results.value.DI
    : results.value.percent,
)
const currentOverallIsCompact = computed(() =>
  shouldCompactOverallValue(currentOverallValue.value),
)
const projectedOverallValue = computed(() =>
  resultMode.value === 'rating'
    ? results.value.potentialDI
    : results.value.potentialScore,
)
const projectedOverallIsRange = computed(() =>
  String(projectedOverallValue.value).includes('~'),
)
const projectedOverallIsCompact = computed(() =>
  shouldCompactOverallValue(projectedOverallValue.value),
)
const projectedOverallCompactRange = computed(() => {
  const values = String(projectedOverallValue.value)
    .split(' ~ ')
    .map((value) => value.replaceAll('%', ''))

  return `${values[0]}–${values.at(-1)}%`
})
const gainPointsText = computed(() => {
  const values = String(potentialGainText.value || '+0%')
    .split(' ~ ')
    .map((value) => value.replaceAll('%', ''))

  if (values.length === 1) {
    return `${values[0]} pts`
  }

  return `${values[0]}–${values.at(-1).replace(/^\+/, '')} pts`
})
const qualityOddsAvailable = computed(() => results.value.qualityOdds.available)
const linesNeededForPlan = computed(() =>
  Math.max(0, 3 - rolledLineIndexes.value.length),
)
const missingLinesLabel = computed(() => {
  const count = missingLineIndexes.value.length
  return `${count} ${count === 1 ? 'line' : 'lines'} not entered`
})
const pausedResultTitle = computed(() =>
  hasProjection.value ? 'Projection paused' : 'Result needs attention',
)
const footerNote = computed(() => {
  if (hasInvalidSnapshotLine.value) {
    return supportsGearPlan.value
      ? 'Correct over-cap values before sharing or saving this item.'
      : 'Correct over-cap values before sharing this item.'
  }

  if (!hasResults.value) {
    return supportsGearPlan.value
      ? 'Enter one line to share, or three to save this item to your plan.'
      : 'Enter one line to share this item.'
  }

  if (supportsGearPlan.value && !canSaveToGearPlan.value && linesNeededForPlan.value > 0) {
    const count = linesNeededForPlan.value
    return `Add ${count} more ${count === 1 ? 'line' : 'lines'} to save this item to your plan.`
  }

  return ''
})

watch(qualityOddsAvailable, (available) => {
  if (!available && resultView.value === 'quality') {
    resultView.value = 'comparison'
  }
})

watch(() => missingLineIndexes.value.length, (count) => {
  if (!count) {
    missingLinesOpen.value = false
  }
})

function formatNumber(value, stat = '') {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return String(value || '—')
  }

  if (decimalStats.includes(stat)) {
    return decimalNumberFormatter.format(numericValue)
  }

  return numberFormatter.format(numericValue)
}

function formatRange(minValue, maxValue, formatter) {
  const minText = formatter(minValue)
  const maxText = formatter(maxValue)
  return minText === maxText ? minText : `${minText}–${maxText}`
}

function formatOverallValue(value) {
  const text = String(value ?? '').trim()
  if (!text) {
    return '—'
  }

  const rangeText = text.replaceAll(' ~ ', '–')
  return rangeText.includes('%') ? rangeText : `${rangeText}%`
}

function formatTierLabel(tier) {
  return String(tier || '—').replaceAll(' ~ ', '–')
}

function shouldCompactOverallValue(value) {
  return formatOverallValue(value).length >= 4
}

function getPotentialValueText(index) {
  const row = results.value.individual[index]
  const stat = statType.value[index]
  return formatRange(
    row.potentialMin,
    row.potentialMax,
    (value) => formatNumber(value, stat),
  )
}

function getInvalidRowText(index) {
  const stat = statType.value[index]
  const level = currentLevelLabel.value === 'Current'
    ? 'item'
    : currentLevelLabel.value
  return `Exceeds the ${level} maximum of ${formatNumber(getInputMaxValueText(stat), stat)}.`
}
</script>

<template>
  <section class="grid content-start">
    <Card class="parade-card gap-0 rounded-[22px] py-0">
      <CardHeader class="px-5 py-5 sm:px-6 sm:py-6">
        <CardTitle class="text-lg sm:text-xl">
          <h2 id="gear-result-title">{{ panelTitle }}</h2>
        </CardTitle>

        <CardAction v-if="resultView === 'comparison'" class="self-center">
          <ToggleGroup
            :model-value="resultMode"
            type="single"
            size="sm"
            class="motion-segmented grid grid-cols-2 gap-1 overflow-hidden rounded-lg bg-muted p-1"
            aria-label="Result display"
            @update:model-value="setResultMode"
          >
            <MotionSegmentIndicator :count="2" :index="resultMode === 'rating' ? 1 : 0" />
            <ToggleGroupItem
              value="score"
              class="rounded-md! border-0! bg-transparent! px-2.5 shadow-none! data-[state=on]:bg-transparent!"
            >
              Score
            </ToggleGroupItem>
            <ToggleGroupItem
              value="rating"
              class="rounded-md! border-0! bg-transparent! px-2.5 shadow-none! data-[state=on]:bg-transparent!"
            >
              Rating
            </ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>

      <Tabs v-model="resultView" class="min-w-0 gap-0">
        <CardContent class="flex min-w-0 flex-col px-5 pb-0 sm:px-6">
          <template v-if="resultView === 'comparison' && hasResults">
            <div
              :class="cn(
                'relative mt-5 grid overflow-hidden rounded-2xl bg-gradient-to-br from-surface-inset to-info-surface/70',
                showOutcomeProjection
                  ? 'min-h-56 grid-cols-2 min-[360px]:min-h-44 min-[360px]:grid-cols-[minmax(0,1fr)_4.75rem_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]'
                  : 'min-h-44 grid-cols-1 sm:grid-cols-2',
              )"
              role="group"
              aria-label="Overall item result"
            >
              <div
                :class="cn(
                  'relative flex min-w-0 flex-col justify-center px-2 py-5 min-[360px]:px-4 min-[360px]:py-7 sm:px-7 sm:py-8',
                  !showOutcomeProjection && 'items-center text-center sm:items-start sm:text-left',
                )"
              >
                <span class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {{ currentEndpointLabel }}
                </span>
                <div
                  v-if="hasInvalidSnapshotLine"
                  class="mt-2 text-2xl font-semibold tracking-[-0.03em] text-destructive sm:text-3xl"
                >
                  Invalid
                </div>
                <div
                  v-else
                  class="mt-2 flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <MotionValue
                    :motion-key="`${resultMode}:${currentOverallValue}`"
                    as="div"
                    class="min-w-0"
                  >
                    <span
                      :class="cn(
                        'motion-tabular font-bold tracking-[-0.055em] sm:text-5xl',
                        currentOverallIsCompact ? 'text-2xl' : 'text-3xl',
                      )"
                    >
                      {{ formatOverallValue(currentOverallValue) }}
                    </span>
                  </MotionValue>
                  <GearTierGuide
                    id-prefix="current"
                    state-label="Current"
                  />
                </div>
              </div>

              <div
                v-if="showOutcomeProjection"
                class="relative col-span-2 row-start-2 flex min-w-0 flex-col items-center justify-center px-4 pb-5 text-center min-[360px]:col-span-1 min-[360px]:row-start-auto min-[360px]:px-1 min-[360px]:pb-0 sm:px-3"
                role="group"
                aria-label="Projected gain"
              >
                <Badge
                  variant="outline"
                  class="motion-tabular h-7 border-success-border bg-success-surface px-2.5 font-bold text-success-foreground shadow-sm"
                >
                  {{ gainPointsText }}
                </Badge>
                <div class="mt-3 flex w-full items-center" aria-hidden="true">
                  <span class="size-1.5 shrink-0 rounded-full bg-primary/55"></span>
                  <Separator class="h-px flex-1 bg-primary/35" />
                  <span class="size-1.5 shrink-0 rounded-full bg-primary"></span>
                </div>
              </div>

              <div
                v-if="showOutcomeProjection"
                class="relative col-start-2 row-start-1 flex min-w-0 flex-col items-end justify-center px-2 py-5 text-right min-[360px]:col-start-auto min-[360px]:row-start-auto min-[360px]:px-4 min-[360px]:py-7 sm:px-7 sm:py-8"
              >
                <span class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {{ projectedEndpointLabel }}
                </span>
                <div class="mt-2 flex min-w-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
                  <MotionValue
                    :motion-key="`${resultMode}:${projectedOverallValue}`"
                    as="div"
                    class="min-w-0"
                  >
                    <span
                      :class="cn(
                        'motion-tabular font-bold tracking-[-0.06em] text-info-foreground',
                        projectedOverallIsRange
                          ? 'text-2xl sm:text-4xl'
                          : projectedOverallIsCompact
                            ? 'text-2xl sm:text-5xl'
                            : 'text-3xl sm:text-5xl',
                      )"
                    >
                      <template v-if="projectedOverallIsRange">
                        <span class="hidden sm:inline">
                          {{ formatOverallValue(projectedOverallValue) }}
                        </span>
                        <span
                          :class="cn(
                            'inline-block whitespace-nowrap leading-none sm:hidden',
                            resultMode === 'rating' ? 'text-[1.05rem]' : 'text-2xl',
                          )"
                          :aria-label="formatOverallValue(projectedOverallValue)"
                        >
                          <span aria-hidden="true">{{ projectedOverallCompactRange }}</span>
                        </span>
                      </template>
                      <template v-else>
                        {{ formatOverallValue(projectedOverallValue) }}
                      </template>
                    </span>
                  </MotionValue>
                  <GearTierGuide
                    id-prefix="projected"
                    state-label="Projected"
                    :tier="results.potentialTier"
                    :score-percent="results.potentialScore"
                    align="end"
                  />
                </div>
              </div>

              <div
                v-else
                class="flex min-h-24 items-center justify-center gap-3 border-t border-border/60 px-5 py-5 sm:justify-start sm:border-l sm:border-t-0"
                :role="hasInvalidSnapshotLine ? 'alert' : undefined"
              >
                <span
                  :class="cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    hasInvalidSnapshotLine
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-success-surface text-success-foreground',
                  )"
                >
                  <CircleAlertIcon
                    v-if="hasInvalidSnapshotLine"
                    class="size-4"
                    aria-hidden="true"
                  />
                  <CheckIcon v-else class="size-4" aria-hidden="true" />
                </span>
                <div>
                  <div class="font-semibold">
                    {{ hasInvalidSnapshotLine ? pausedResultTitle : 'Final state' }}
                  </div>
                  <div class="mt-0.5 text-xs text-muted-foreground">
                    {{ hasInvalidSnapshotLine ? 'Fix the over-cap value below.' : 'No upgrades remaining.' }}
                  </div>
                </div>
              </div>
            </div>
          </template>

          <Empty
            v-else-if="resultView === 'comparison'"
            class="mt-5 min-h-40 flex-row justify-start bg-surface-inset px-5 py-6 text-left"
          >
            <EmptyMedia class="mb-0">
              <img class="size-14 shrink-0 object-contain" src="/smart_priring.png" alt="">
            </EmptyMedia>
            <EmptyHeader class="items-start gap-1">
              <EmptyTitle class="text-base">Add your first enchant value</EmptyTitle>
              <EmptyDescription>
                Enter a value from your item to see its result.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>

          <div class="order-first flex min-w-0 border-b">
            <TabsList
              variant="line"
              class="grid h-auto min-h-10 w-full min-w-0 grid-cols-2 bg-transparent p-0"
              aria-label="Result details"
            >
              <TabsTrigger
                value="comparison"
                class="min-w-0 whitespace-normal px-2 py-1.5 text-center leading-tight"
              >
                Lines
              </TabsTrigger>
              <TabsTrigger
                v-if="qualityOddsAvailable"
                value="quality"
                class="min-w-0 whitespace-normal px-2 py-1.5 text-center leading-tight"
              >
                Quality odds
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value="comparison"
            class="motion-tab-panel m-0 min-w-0 pb-5"
          >
            <section v-if="hasResults" aria-label="Entered stat lines">
              <Table
                container-class="min-w-0"
                class="block table-fixed md:table"
                aria-label="Entered stat line results"
              >
                <colgroup v-if="hasProjection">
                  <col class="w-[36%]">
                  <col class="w-[27%]">
                  <col class="w-[37%]">
                </colgroup>
                <colgroup v-else>
                  <col class="w-[45%]">
                  <col class="w-[55%]">
                </colgroup>

                <TableHeader class="block md:table-header-group">
                  <TableRow
                    :class="cn(
                      'grid border-b hover:bg-transparent md:table-row',
                      hasProjection ? 'grid-cols-2' : 'grid-cols-1',
                    )"
                  >
                    <TableHead
                      id="stat-heading"
                      scope="col"
                      class="hidden h-11 px-0 text-[10px] uppercase tracking-[0.08em] text-muted-foreground md:table-cell"
                    >
                      Stat
                    </TableHead>
                    <TableHead
                      id="current-endpoint-heading"
                      scope="col"
                      class="block h-auto px-0 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground md:table-cell md:h-11 md:py-0 md:font-medium"
                    >
                      {{ currentEndpointLabel }}
                    </TableHead>
                    <TableHead
                      v-if="hasProjection"
                      id="projected-endpoint-heading"
                      scope="col"
                      class="block h-auto px-0 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground md:table-cell md:h-11 md:py-0 md:text-left md:font-medium"
                    >
                      {{ projectedEndpointLabel }}
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody class="block md:table-row-group">
                  <TableRow
                    v-for="index in rolledLineIndexes"
                    :key="`comparison-${index}`"
                    class="grid grid-cols-2 gap-x-6 border-b py-4 hover:bg-transparent md:table-row md:py-0"
                    :data-invalid="isInputOverMax(index) || undefined"
                  >
                    <TableCell
                      role="rowheader"
                      headers="stat-heading"
                      class="col-span-2 block min-w-0 whitespace-normal p-0 md:table-cell md:py-5 md:pr-5"
                    >
                      <div class="flex min-w-0 items-center gap-1 font-medium leading-tight">
                        <span class="min-w-0">
                          {{ statType[index] || `Stat line ${index + 1}` }}
                        </span>
                        <GearStatNoteDisclosure
                          v-if="traitNotesByLineIndex.has(index)"
                          :stat="statType[index]"
                          :notes="traitNotesByLineIndex.get(index)"
                        />
                      </div>
                      <p
                        v-if="isInputOverMax(index)"
                        class="mt-1.5 text-xs leading-relaxed text-destructive"
                      >
                        {{ getInvalidRowText(index) }}
                      </p>
                    </TableCell>

                    <TableCell
                      headers="current-endpoint-heading"
                      :class="cn(
                        'block min-w-0 whitespace-normal p-0 pt-3 md:table-cell md:py-5',
                        hasProjection ? 'md:pr-5' : 'col-span-2',
                      )"
                    >
                      <div class="motion-tabular flex min-w-0 flex-wrap items-center gap-2">
                        <span
                          :class="cn(
                            'font-semibold',
                            isInputOverMax(index) && 'text-destructive',
                          )"
                        >
                          {{ formatNumber(statInput[index], statType[index]) }}
                        </span>
                        <span class="sr-only">Current tier:</span>
                        <Badge
                          v-if="!isInputOverMax(index)"
                          variant="outline"
                          :class="getTierClass(results.individual[index].tier)"
                        >
                          {{ formatTierLabel(results.individual[index].tier) }}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell
                      v-if="hasProjection"
                      headers="projected-endpoint-heading"
                      class="block min-w-0 whitespace-normal p-0 pt-3 text-right md:table-cell md:py-5 md:text-left"
                    >
                      <div
                        v-if="!isInputOverMax(index)"
                        class="motion-tabular flex min-w-0 flex-wrap items-center justify-end gap-2 md:justify-start"
                      >
                        <span class="min-w-0 font-semibold text-info-foreground">
                          {{ getPotentialValueText(index) }}
                        </span>
                        <span class="sr-only">Projected tier:</span>
                        <Badge
                          variant="outline"
                          :class="getTierClass(getPotentialLineTier(index))"
                        >
                          {{ formatTierLabel(getPotentialLineTier(index)) }}
                        </Badge>
                      </div>
                      <span v-else class="text-muted-foreground">—</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Collapsible
                v-if="missingLineIndexes.length"
                v-model:open="missingLinesOpen"
                class="border-t"
              >
                <CollapsibleTrigger as-child>
                  <Button
                    variant="ghost"
                    class="h-auto w-full justify-start rounded-none px-0 py-3 text-left"
                  >
                    <CirclePlusIcon data-icon="inline-start" aria-hidden="true" />
                    <span class="min-w-0 flex-1 text-xs font-semibold">
                      {{ missingLinesLabel }}
                    </span>
                    <ChevronDownIcon
                      data-icon="inline-end"
                      :class="cn('transition-transform', missingLinesOpen && 'rotate-180')"
                      aria-hidden="true"
                    />
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent class="rounded-xl bg-surface-inset">
                  <template
                    v-for="(index, missingIndex) in missingLineIndexes"
                    :key="`missing-${index}`"
                  >
                    <Separator v-if="missingIndex" />
                    <div class="flex min-w-0 items-center gap-3 px-3 py-2.5">
                      <span class="motion-tabular w-5 shrink-0 text-xs text-muted-foreground">
                        {{ index + 1 }}
                      </span>
                      <span class="truncate text-xs font-medium">
                        {{ statType[index] || `Stat line ${index + 1}` }}
                      </span>
                    </div>
                  </template>
                </CollapsibleContent>
              </Collapsible>
            </section>
          </TabsContent>

          <TabsContent
            v-if="qualityOddsAvailable"
            value="quality"
            class="motion-tab-panel m-0 min-w-0 py-5"
          >
            <GearScoreQualityOdds />
          </TabsContent>
        </CardContent>
      </Tabs>

      <CardFooter
        class="rounded-b-none flex-col items-stretch justify-between gap-3 border-t bg-surface-inset px-5 py-4 sm:flex-row sm:items-center sm:px-6"
      >
        <p
          v-if="footerNote"
          id="result-footer-note"
          :class="cn(
            'max-w-md text-xs leading-relaxed',
            hasInvalidSnapshotLine ? 'text-destructive' : 'text-muted-foreground',
          )"
          aria-live="polite"
        >
          {{ footerNote }}
        </p>

        <div
          :class="cn(
            'flex w-full items-center gap-2 sm:w-auto',
            !footerNote && 'sm:ml-auto',
          )"
          role="group"
          aria-label="Result actions"
        >
          <Button
            :variant="canShareSnapshot ? 'default' : 'outline'"
            size="sm"
            class="flex-1 sm:flex-none"
            :disabled="!canShareSnapshot"
            :aria-describedby="footerNote ? 'result-footer-note' : undefined"
            @click="openSnapshot($event.currentTarget)"
          >
            <CameraIcon data-icon="inline-start" aria-hidden="true" />
            Share
          </Button>

          <Button
            v-if="supportsGearPlan"
            variant="outline"
            size="sm"
            class="min-w-28 flex-1 sm:flex-none"
            :disabled="!canSaveToGearPlan"
            :aria-describedby="footerNote ? 'result-footer-note' : undefined"
            @click="saveCurrentGearToPlan"
          >
            <Transition name="motion-swap" mode="out-in">
              <span
                :key="gearPlanSaveSucceeded ? 'saved' : 'save'"
                class="inline-flex items-center gap-1"
              >
                <CheckIcon
                  v-if="gearPlanSaveSucceeded"
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                <BookmarkPlusIcon
                  v-else
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                {{ gearPlanSaveSucceeded ? 'Saved' : 'Save to plan' }}
              </span>
            </Transition>
          </Button>
        </div>
      </CardFooter>
    </Card>
  </section>
</template>
