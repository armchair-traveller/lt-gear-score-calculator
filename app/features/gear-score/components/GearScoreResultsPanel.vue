<script setup>
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookmarkPlusIcon,
  CalculatorIcon,
  CameraIcon,
  CheckIcon,
  RotateCcwIcon,
  SparklesIcon,
  SwordsIcon,
  TablePropertiesIcon,
} from '@lucide/vue'
import {
  formatMaxRollPercent,
  getMaxRollPercentClass,
} from '@/features/gear-score/helpers.js'

const {
  gearType,
  pieceType,
  resultMode,
  statType,
  statInput,
  qualityLineEnchantMethods,
  results,
  tierGuideRows,
  selectedTierRows,
  totalProgress,
  potentialProgress,
  potentialGainText,
  currentOddsEnchantMethodOptions,
  qualityTargetPercent,
  supportsGearPlan,
  canSaveToGearPlan,
  gearPlanSaveSucceeded,
  hasRolledValue,
  getProjectionEnchantLevel,
  setResultMode,
  moveQualityOddsLine,
  setQualityLineEnchantMethod,
  setQualityTargetPercent,
  resetQualityTarget,
  getFinalUpgrade,
  openSnapshot,
  saveCurrentGearToPlan,
  clamp,
  getLineScoreText,
  isInputOverMax,
  getPotentialLineText,
  getPotentialLineTier,
  getTierClass,
  getRollStatusClass,
} = useGearScoreCalculatorContext()

const rolledLineIndexes = computed(() =>
  statType.value
    .map((_, index) => index)
    .filter((index) => hasRolledValue(index)),
)
const hasInvalidSnapshotLine = computed(() => rolledLineIndexes.value.some((index) => isInputOverMax(index)))
const canShareSnapshot = computed(() => rolledLineIndexes.value.length > 0 && !hasInvalidSnapshotLine.value)
const snapshotRequirement = computed(() => {
  if (hasInvalidSnapshotLine.value) {
    return 'Correct values above the item maximum before sharing.'
  }
  return ''
})

const emptyLineCount = computed(() => statType.value.length - rolledLineIndexes.value.length)
const emptyLineSummary = computed(() =>
  emptyLineCount.value === 1 ? '1 unfilled line' : `${emptyLineCount.value} unfilled lines`,
)

const qualityTargetDraft = ref('')

watch(qualityTargetPercent, (value) => {
  qualityTargetDraft.value = Number(value).toFixed(2)
}, { immediate: true })

function restoreQualityTargetDraft() {
  qualityTargetDraft.value = Number(qualityTargetPercent.value).toFixed(2)
}

function commitQualityTarget() {
  if (!setQualityTargetPercent(qualityTargetDraft.value)) {
    restoreQualityTargetDraft()
  }
  else {
    qualityTargetDraft.value = Number(qualityTargetPercent.value).toFixed(2)
  }
}

function cancelQualityTargetEdit(event) {
  restoreQualityTargetDraft()
  event?.currentTarget?.blur()
}

function updateQualityLineEnchantMethod(lineIndex, method) {
  if (typeof method === 'string') {
    setQualityLineEnchantMethod(lineIndex, method)
  }
}
</script>

<template>
  <section class="grid content-start gap-4">
    <Card class="parade-card rounded-[22px]">
      <CardHeader>
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle class="flex items-center gap-2 text-base">
              <CalculatorIcon class="size-4" />
              Results
            </CardTitle>
            <CardDescription>{{ pieceType }} {{ gearType }}</CardDescription>
          </div>

          <div class="flex flex-wrap items-center gap-2 sm:justify-end">
            <ToggleGroup
              :model-value="resultMode"
              type="single"
              variant="outline"
              size="sm"
              class="sm:order-last"
              aria-label="Result display mode"
              @update:model-value="setResultMode"
            >
              <ToggleGroupItem value="score">Score</ToggleGroupItem>
              <ToggleGroupItem value="rating">Rating</ToggleGroupItem>
            </ToggleGroup>

            <ButtonGroup aria-label="Result actions">
              <Button
                variant="outline"
                size="sm"
                :disabled="!canShareSnapshot"
                :title="snapshotRequirement || undefined"
                :aria-describedby="snapshotRequirement ? 'snapshot-requirement' : undefined"
                @click="openSnapshot($event.currentTarget)"
              >
                <CameraIcon data-icon="inline-start" />
                Share snapshot
              </Button>

              <Button
                v-if="supportsGearPlan"
                variant="outline"
                size="sm"
                class="min-w-24"
                :disabled="!canSaveToGearPlan"
                @click="saveCurrentGearToPlan"
              >
                <Transition name="motion-swap" mode="out-in">
                  <span
                    :key="gearPlanSaveSucceeded ? 'saved' : 'save'"
                    class="inline-flex items-center gap-1"
                  >
                    <CheckIcon v-if="gearPlanSaveSucceeded" data-icon="inline-start" />
                    <BookmarkPlusIcon v-else data-icon="inline-start" />
                    {{ gearPlanSaveSucceeded ? 'Added' : 'Add to plan' }}
                  </span>
                </Transition>
              </Button>
            </ButtonGroup>

            <Transition name="motion-fade">
              <p
                v-if="snapshotRequirement"
                id="snapshot-requirement"
                class="w-full text-xs text-muted-foreground sm:text-right"
                aria-live="polite"
              >
                {{ snapshotRequirement }}
              </p>
            </Transition>
          </div>
        </div>
      </CardHeader>

      <CardContent class="grid gap-4">
        <div class="grid gap-3 lg:grid-cols-[220px_1fr]">
          <div class="rounded-2xl border border-info-border bg-info-surface p-4">
            <div class="parade-section-kicker">Current strength</div>
            <div class="mt-1 flex items-end gap-2">
              <div class="motion-tabular text-5xl font-bold tracking-[-0.06em] text-info-foreground">
                {{ resultMode === 'rating' ? `${results.DI}%` : `${results.percent}%` }}
              </div>
              <Badge variant="outline" :class="getTierClass(results.tier)">
                {{ results.tier }}
              </Badge>
            </div>
            <Progress :model-value="totalProgress" class="mt-4 h-2" />
          </div>

          <div class="min-h-32">
            <Transition name="motion-swap" mode="out-in">
              <div
                v-if="rolledLineIndexes.length > 0"
                key="current-results"
                class="min-h-32 divide-y divide-border/60 overflow-hidden rounded-2xl border bg-surface-inset"
              >
                <TransitionGroup
                  name="motion-list"
                  tag="div"
                  class="motion-list-collapse divide-y divide-border/60"
                >
                  <div
                    v-for="index in rolledLineIndexes"
                    :key="`result-${index}`"
                    class="grid gap-2 bg-surface-raised/45 p-3"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="min-w-0">
                        <div class="truncate text-sm font-medium">
                          {{ statType[index] }}
                        </div>
                        <div class="motion-tabular text-xs text-muted-foreground">
                          {{ statInput[index] }}
                        </div>
                      </div>
                      <div class="flex items-center gap-2">
                        <span class="motion-tabular text-sm font-semibold">{{ getLineScoreText(index) }}</span>
                        <Badge variant="outline" :class="getTierClass(results.individual[index].tier)">
                          {{ results.individual[index].tier }}
                        </Badge>
                      </div>
                    </div>
                    <Progress :model-value="clamp(Number(results.individual[index].percent), 0, 100)" class="h-1.5" />
                  </div>
                </TransitionGroup>
                <div
                  v-if="emptyLineCount > 0"
                  class="bg-surface-inset px-3 py-2 text-xs text-muted-foreground"
                >
                  {{ emptyLineSummary }}
                </div>
              </div>
              <div
                v-else
                key="current-empty"
                class="flex min-h-32 items-center gap-4 rounded-2xl border border-dashed bg-surface-inset p-5"
              >
                <img class="size-16 shrink-0 object-contain" src="/smart_priring.png" alt="">
                <div>
                  <h3 class="font-bold">Add your first enchant value</h3>
                  <p class="mt-1 max-w-md text-sm text-muted-foreground">Results update immediately as you enter each line. Start with the values shown on your item.</p>
                </div>
              </div>
            </Transition>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card v-if="getFinalUpgrade(gearType) !== ''" class="parade-card rounded-[22px]">
      <Tabs default-value="summary" class="min-w-0 gap-6">
        <CardHeader>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <CardTitle class="flex items-center gap-2 text-base">
                <SparklesIcon class="size-4" />
                {{ getFinalUpgrade(gearType) }} Projection
              </CardTitle>
              <CardDescription>
                Lv.{{ getProjectionEnchantLevel() }} {{ pieceType }} {{ gearType }}
              </CardDescription>
            </div>

            <TabsList class="w-fit max-w-full">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="lines">Lines</TabsTrigger>
              <TabsTrigger v-if="results.qualityOdds.available" value="quality">Quality odds</TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>

        <CardContent class="min-w-0">
          <TabsContent value="summary" class="motion-tab-panel m-0">
            <div class="grid gap-3 lg:grid-cols-[220px_1fr]">
              <div class="parade-projection-card rounded-2xl border border-warning-border p-4">
                <div class="text-sm text-muted-foreground">Projected</div>
                <div class="mt-1 flex items-end gap-2">
                  <div class="motion-tabular text-4xl font-bold tracking-[-0.05em] text-warning-foreground">
                    {{ resultMode === 'rating' ? results.potentialDI : results.potentialScore }}
                  </div>
                  <Badge variant="outline" :class="getTierClass(results.potentialTier)">
                    {{ results.potentialTier }}
                  </Badge>
                </div>
                <div class="motion-tabular mt-2 text-sm text-success-foreground">{{ potentialGainText }} gain</div>
                <Progress :model-value="potentialProgress" class="mt-4 h-2" />
              </div>

              <div class="min-h-32">
                <Transition name="motion-swap" mode="out-in">
                  <div
                    v-if="rolledLineIndexes.length > 0"
                    key="potential-results"
                    class="h-full min-h-32 divide-y divide-border/60 overflow-hidden rounded-2xl border bg-surface-inset"
                  >
                    <TransitionGroup
                      name="motion-list"
                      tag="div"
                      class="motion-list-collapse divide-y divide-border/60"
                    >
                      <div
                        v-for="index in rolledLineIndexes"
                        :key="`potential-${index}`"
                        class="grid gap-2 bg-surface-raised/45 p-3"
                      >
                        <div class="flex flex-wrap items-center justify-between gap-2">
                          <div class="min-w-0">
                            <div class="truncate text-sm font-medium">
                              {{ statType[index] }}:
                              <span class="motion-tabular">
                                <template v-if="results.individual[index].potentialMin === results.individual[index].potentialMax">
                                  {{ results.individual[index].potentialMin }}
                                </template>
                                <template v-else>
                                  {{ results.individual[index].potentialMin }} ~ {{ results.individual[index].potentialMax }}
                                </template>
                              </span>
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            <span class="motion-tabular text-sm font-semibold">{{ getPotentialLineText(index) }}</span>
                            <Badge variant="outline" :class="getTierClass(getPotentialLineTier(index))">
                              {{ getPotentialLineTier(index) }}
                            </Badge>
                          </div>
                        </div>
                        <Progress :model-value="clamp(Number(results.individual[index].potentialMinPerc), 0, 100)" class="h-1.5" />
                      </div>
                    </TransitionGroup>
                    <div
                      v-if="emptyLineCount > 0"
                      class="bg-surface-inset px-3 py-2 text-xs text-muted-foreground"
                    >
                      {{ emptyLineSummary }}
                    </div>
                  </div>
                  <div
                    v-else
                    key="potential-empty"
                    class="flex h-full min-h-32 items-center rounded-2xl border border-dashed bg-surface-inset p-5"
                  >
                    <p class="text-sm text-muted-foreground">Your fully upgraded projection will appear here once at least one enchant value is entered.</p>
                  </div>
                </Transition>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="lines" class="motion-tab-panel m-0 min-w-0">
            <Table container-class="max-h-[360px] min-w-0 rounded-lg border bg-surface-raised" class="min-w-[520px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Stat</TableHead>
                  <TableHead>Current</TableHead>
                  <TableHead>Max upgrade</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="(_, index) in statType" :key="`line-table-${index}`">
                  <TableCell class="font-medium">{{ statType[index] }}</TableCell>
                  <TableCell>{{ statInput[index] || '-' }}</TableCell>
                  <TableCell>
                    <span v-if="results.individual[index].potentialMin === results.individual[index].potentialMax">
                      {{ results.individual[index].potentialMin || '-' }}
                    </span>
                    <span v-else>
                      {{ results.individual[index].potentialMin }} ~ {{ results.individual[index].potentialMax }}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" :class="getTierClass(getPotentialLineTier(index))">
                      {{ getPotentialLineTier(index) }}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent v-if="results.qualityOdds.available" value="quality" class="motion-tab-panel m-0 grid min-w-0 gap-4">
            <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] sm:items-end">
              <div class="min-w-0">
                <div class="text-sm text-muted-foreground">Chance to reach target</div>
                <div class="motion-tabular mt-1 text-3xl font-semibold tracking-normal">{{ results.qualityOdds.totalChanceText }}</div>
              </div>

              <div class="min-w-0">
                <div class="text-xs text-muted-foreground">Target quality</div>
                <div class="mt-1 flex items-center gap-1.5">
                  <InputGroup class="h-9 min-w-0">
                    <InputGroupInput
                      v-model="qualityTargetDraft"
                      type="number"
                      inputmode="decimal"
                      min="0"
                      max="100"
                      step="0.01"
                      aria-label="Quality target percentage"
                      class="motion-tabular"
                      @blur="commitQualityTarget"
                      @keydown.enter.prevent="$event.currentTarget.blur()"
                      @keydown.esc.prevent="cancelQualityTargetEdit"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>%</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="size-9 shrink-0"
                        aria-label="Reset to SSS-equivalent target"
                        @click="resetQualityTarget"
                      >
                        <RotateCcwIcon class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reset to SSS equivalent</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>

            <dl
              class="grid divide-y divide-border/60 overflow-hidden rounded-xl border bg-surface-inset md:divide-x md:divide-y-0"
              :class="results.qualityOdds.showProjectedQuality
                ? 'md:grid-cols-[1fr_1.4fr_1fr_1fr]'
                : 'md:grid-cols-3'"
            >
              <div class="px-3 py-3">
                <dt class="text-xs text-muted-foreground">Quality</dt>
                <dd class="motion-tabular mt-1 text-lg font-semibold">{{ results.qualityOdds.qualityText }}</dd>
              </div>
              <div v-if="results.qualityOdds.showProjectedQuality" class="px-3 py-3">
                <dt class="text-xs text-muted-foreground">Projected quality</dt>
                <dd class="motion-tabular mt-1 text-lg font-semibold">{{ results.qualityOdds.plannedQualityText }}</dd>
              </div>
              <div class="px-3 py-3">
                <dt class="text-xs text-muted-foreground">Base rolls</dt>
                <dd class="motion-tabular mt-1 text-lg font-semibold">{{ results.qualityOdds.baseRollText }}</dd>
              </div>
              <div class="px-3 py-3 md:last:pr-0">
                <dt class="text-xs text-muted-foreground">Full survival</dt>
                <dd class="motion-tabular mt-1 text-lg font-semibold">{{ results.qualityOdds.survivalChanceText }}</dd>
              </div>
            </dl>

            <Table container-class="max-h-[320px] min-w-0 rounded-lg border bg-surface-raised" class="min-w-[660px]">
              <TableHeader>
                <TableRow>
                  <TableHead class="w-[104px]">Order</TableHead>
                  <TableHead>Stat</TableHead>
                  <TableHead class="w-[210px]">
                    {{ currentOddsEnchantMethodOptions.length > 1 ? 'Roll method / state' : 'Roll state' }}
                  </TableHead>
                  <TableHead>Fully upgraded value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TransitionGroup name="motion-list">
                  <TableRow v-for="(line, position) in results.qualityOdds.lines" :key="`quality-line-${line.index}`">
                    <TableCell>
                      <div class="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          class="touch-target size-7"
                          :disabled="position === 0"
                          title="Move earlier"
                          aria-label="Move earlier"
                          @click="moveQualityOddsLine(position, -1)"
                        >
                          <ArrowUpIcon class="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="touch-target size-7"
                          :disabled="position === results.qualityOdds.lines.length - 1"
                          title="Move later"
                          aria-label="Move later"
                          @click="moveQualityOddsLine(position, 1)"
                        >
                          <ArrowDownIcon class="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell class="font-medium">{{ line.stat }}</TableCell>
                    <TableCell>
                      <ToggleGroup
                        v-if="currentOddsEnchantMethodOptions.length > 1 && line.status === 'new'"
                        type="single"
                        orientation="horizontal"
                        :spacing="1"
                        :model-value="qualityLineEnchantMethods[line.index]"
                        class="grid h-11 w-[190px] grid-cols-2 gap-1 rounded-md bg-surface-inset p-1"
                        :aria-label="`${line.stat} roll method`"
                        @update:model-value="updateQualityLineEnchantMethod(line.index, $event)"
                      >
                        <ToggleGroupItem
                          v-for="method in currentOddsEnchantMethodOptions"
                          :key="method.value"
                          :value="method.value"
                          class="h-9 min-w-0 flex-1 flex-col gap-0 rounded-sm px-1 text-xs leading-none text-muted-foreground shadow-none hover:bg-surface-raised/70 hover:text-foreground data-[state=on]:bg-surface-raised data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                          :aria-label="`${method.label}: ${method.successRate * 100}% success rate for ${line.stat}`"
                        >
                          <span class="font-medium">{{ method.label }}</span>
                          <span class="motion-tabular mt-1 text-[11px] text-muted-foreground">{{ method.successRate * 100 }}%</span>
                        </ToggleGroupItem>
                      </ToggleGroup>
                      <span v-else :class="getRollStatusClass(line.status)">{{ line.rollText }}</span>
                    </TableCell>
                    <TableCell class="motion-tabular">
                      <span>{{ line.range }}</span>
                      <span
                        v-if="Number.isFinite(line.maxRollPercent)"
                        class="ml-1 font-medium"
                        :class="getMaxRollPercentClass(line.maxRollPercent)"
                      >
                        [{{ formatMaxRollPercent(line.maxRollPercent) }}]
                      </span>
                    </TableCell>
                  </TableRow>
                </TransitionGroup>
              </TableBody>
            </Table>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>

    <div class="grid gap-4 2xl:grid-cols-2">
      <Card class="parade-card rounded-[22px]">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <SwordsIcon class="size-4" />
            Tier Evaluation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table container-class="rounded-lg border bg-surface-raised">
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
              <TableRow v-for="row in tierGuideRows" :key="row.tier">
                <TableCell>
                  <Badge variant="outline" :class="getTierClass(row.tier)">{{ row.tier }}</Badge>
                </TableCell>
                <TableCell>{{ row.comment }}</TableCell>
                <TableCell>{{ row.upgrade }}</TableCell>
                <TableCell>{{ row.enchants }}</TableCell>
                <TableCell>{{ row.cost }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card class="parade-card rounded-[22px]">
        <CardHeader>
          <CardTitle class="flex items-center gap-2 text-base">
            <TablePropertiesIcon class="size-4" />
            Tier Equivalence
          </CardTitle>
          <CardDescription>{{ pieceType }} {{ gearType }}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table
            container-class="max-h-[360px] min-w-0 rounded-lg border bg-surface-raised"
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
                <TableHead>Penta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in selectedTierRows" :key="row.tier">
                <TableCell>{{ row.Score }}</TableCell>
                <TableCell>
                  <Badge variant="outline" :class="getTierClass(row.tier)">{{ row.tier }}</Badge>
                </TableCell>
                <TableCell>{{ row.Single }}</TableCell>
                <TableCell>{{ row.Duo }}</TableCell>
                <TableCell>{{ row.Trio }}</TableCell>
                <TableCell>{{ row.Quad }}</TableCell>
                <TableCell>{{ row.Penta }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  </section>
</template>
