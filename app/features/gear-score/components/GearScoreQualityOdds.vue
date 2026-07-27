<script setup>
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  CircleHelpIcon,
  RotateCcwIcon,
  Settings2Icon,
  SparklesIcon,
  TargetIcon,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { getQualityTargetPresetValues } from '@/features/gear-score/data.js'
import { formatProbability } from '@/features/gear-score/helpers.js'
import { cn } from '@/lib/utils'

const {
  gearType,
  qualityPlanEnchantMethod,
  qualityLineEnchantMethods,
  results,
  currentOddsEnchantMethodOptions,
  defaultQualityTargetPercent,
  hasCustomQualityTarget,
  qualityTargetPercent,
  movePendingQualityOddsLine,
  optimizeQualityOddsOrder,
  setAllQualityLineEnchantMethods,
  setQualityLineEnchantMethod,
  setQualityTargetPercent,
  resetQualityTarget,
} = useGearScoreCalculatorContext()

const qualityTargetDraft = ref('')
const targetError = ref('')
const targetDetailsOpen = ref(false)
const planDetailsOpen = ref(false)
const calculationNotesOpen = ref(false)
const methodOverridesOpen = ref(false)
const optimizationMessage = ref('')
const planAnnouncement = ref('')

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const materialPaths = [
  {
    key: 'untradeable',
    label: 'Untradeable',
  },
  {
    key: 'tradable',
    label: 'Tradable',
  },
]

const odds = computed(() => results.value.qualityOdds)
const pendingLines = computed(() => odds.value.lines.filter((line) => line.status === 'new'))
const activePendingLines = computed(() =>
  pendingLines.value.filter((line) => line.attemptChance > 0),
)
const targetMaterialPaths = computed(() =>
  materialPaths.map((path) => ({
    ...path,
    ...odds.value.materials.perTarget[path.key],
  })),
)
const hasLockedQuality = computed(() => odds.value.qualityText !== '—')

const practicalTargetPresets = computed(() =>
  getQualityTargetPresetValues(gearType.value).map((value) => ({
    id: String(value),
    label: `${value}%`,
    value,
  })),
)

const targetPresets = computed(() => {
  const benchmarkPreset = {
    id: 'sss',
    label: 'SSS',
    value: defaultQualityTargetPercent.value,
  }
  return [benchmarkPreset, ...practicalTargetPresets.value]
})

const hasQuickTargetPresets = computed(() => practicalTargetPresets.value.length > 0)

const selectedTargetPreset = computed(
  () =>
    targetPresets.value.find(
      (preset) => Math.abs(preset.value - qualityTargetPercent.value) < 0.005,
    )?.id,
)

const methodOverrideCount = computed(
  () =>
    activePendingLines.value.filter(
      (line) => qualityLineEnchantMethods.value[line.index] !== qualityPlanEnchantMethod.value,
    ).length,
)

const methodGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${currentOddsEnchantMethodOptions.value.length}, minmax(0, 1fr))`,
}))

const targetPresetGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${targetPresets.value.length}, minmax(0, 1fr))`,
}))

const outcomeSegmentStyles = computed(() => ({
  target: {
    width: `${clampPercent(odds.value.totalChance * 100)}%`,
  },
  kept: {
    width: `${clampPercent(odds.value.survivedMissChance * 100)}%`,
  },
  destroyed: {
    width: `${clampPercent(odds.value.destroyedChance * 100)}%`,
  },
}))

const hasKeptMissOutcome = computed(() => odds.value.survivedMissChance > 1e-9)
const hasDestroyedOutcome = computed(() => odds.value.destroyedChance > 1e-9)
const hasAlternateOutcomes = computed(() => hasKeptMissOutcome.value || hasDestroyedOutcome.value)

const outcomeAriaLabel = computed(() => {
  if (odds.value.targetState === 'secured') {
    return `Target already secured at ${odds.value.targetQualityText}. No attempts or materials are needed.`
  }
  if (odds.value.targetState === 'impossible') {
    return `Target out of reach. A perfect finish reaches ${odds.value.plannedQualityMax.toFixed(2)}%, below the ${odds.value.targetQualityText} target.`
  }
  if (odds.value.targetState === 'no-rolls') {
    return `No damaging rolls remain. Fixed finish ${odds.value.plannedQualityText}; target ${odds.value.targetQualityText}.`
  }

  if (!hasAlternateOutcomes.value) {
    return `${odds.value.totalChanceText} hit the target. No copies end below target or are destroyed.`
  }
  if (!hasKeptMissOutcome.value) {
    return `${odds.value.totalChanceText} hit the target and ${odds.value.destroyedChanceText} are destroyed.`
  }
  if (!hasDestroyedOutcome.value) {
    return `${odds.value.totalChanceText} hit the target and ${odds.value.survivedMissChanceText} end below target.`
  }
  return `${odds.value.totalChanceText} hit the target, ${odds.value.survivedMissChanceText} end below target, and ${odds.value.destroyedChanceText} are destroyed.`
})

const liveAnnouncement = computed(() => planAnnouncement.value || outcomeAriaLabel.value)

const outcomeLabel = computed(() => {
  if (odds.value.targetState === 'secured') {
    return 'Target already secured'
  }
  if (odds.value.targetState === 'impossible') {
    return 'Target out of reach'
  }
  if (odds.value.targetState === 'no-rolls') {
    return 'No damaging rolls remain'
  }
  return 'Target chance'
})

const outcomeSummary = computed(() => {
  if (odds.value.targetState === 'secured') {
    return 'No enchanting needed.'
  }
  if (odds.value.targetState === 'impossible') {
    return `Best possible: ${odds.value.plannedQualityMax.toFixed(2)}%.`
  }
  if (odds.value.targetState === 'no-rolls') {
    return `Fixed finish: ${odds.value.plannedQualityText}.`
  }

  return ''
})

const runwayStyle = computed(() => {
  const plannedStart = clampPercent(odds.value.plannedQualityMin)
  const plannedEnd = clampPercent(odds.value.plannedQualityMax)

  return {
    planned: {
      left: `${plannedStart}%`,
      width: `${Math.max(plannedEnd - plannedStart, 0.8)}%`,
    },
    locked: {
      left: `${clampPercent(odds.value.qualityMax)}%`,
    },
    target: {
      left: `${clampPercent(odds.value.targetQuality)}%`,
    },
  }
})

const targetMarkerClass = computed(() =>
  cn(
    'absolute top-0 text-[10px] font-bold uppercase tracking-[0.08em] text-warning-foreground',
    odds.value.targetQuality <= 8
      ? 'translate-x-0'
      : odds.value.targetQuality >= 92
        ? '-translate-x-full'
        : '-translate-x-1/2',
  ),
)

const planLabel = computed(() => {
  const count = pendingLines.value.length
  if (!count) {
    return 'Plan'
  }
  return `Plan · ${count} ${count === 1 ? 'line' : 'lines'}`
})

const commonMethodLabel = computed(() => {
  const count = methodOverrideCount.value
  return count ? `Method · ${count} ${count === 1 ? 'override' : 'overrides'}` : 'Method'
})

const targetDisclosureLabel = computed(() => {
  const targetType = hasCustomQualityTarget.value ? 'custom target' : 'SSS target'
  return `Adjust ${targetType}, ${odds.value.targetQualityText}; view quality range`
})

watch(
  qualityTargetPercent,
  (value) => {
    qualityTargetDraft.value = Number(value).toFixed(2)
    targetError.value = ''
  },
  { immediate: true },
)

watch(gearType, () => {
  methodOverridesOpen.value = false
})

watch(
  [qualityLineEnchantMethods, qualityTargetPercent],
  () => {
    optimizationMessage.value = ''
    planAnnouncement.value = ''
  },
  { deep: true },
)

watch(
  odds,
  () => {
    optimizationMessage.value = ''
    planAnnouncement.value = ''
  },
  { flush: 'sync' },
)

function restoreQualityTargetDraft() {
  qualityTargetDraft.value = Number(qualityTargetPercent.value).toFixed(2)
  targetError.value = ''
}

function commitQualityTarget() {
  const rawValue = String(qualityTargetDraft.value).trim()
  const target = Number(rawValue)
  if (!rawValue || !Number.isFinite(target) || target < 0 || target > 100) {
    targetError.value = 'Enter a target from 0 to 100.'
    return
  }

  if (!setQualityTargetPercent(target)) {
    targetError.value = 'Enter a target from 0 to 100.'
    return
  }

  qualityTargetDraft.value = Number(qualityTargetPercent.value).toFixed(2)
  targetError.value = ''
}

function cancelQualityTargetEdit(event) {
  restoreQualityTargetDraft()
  event?.currentTarget?.blur()
}

function applyTargetPreset(presetId) {
  const preset = targetPresets.value.find((option) => option.id === presetId)
  if (!preset) {
    return
  }

  if (setQualityTargetPercent(preset.value)) {
    restoreQualityTargetDraft()
  }
}

function restoreDefaultTarget() {
  resetQualityTarget()
  restoreQualityTargetDraft()
}

function setTargetDetailsOpen(open) {
  if (!open && targetError.value) {
    targetDetailsOpen.value = true
    return
  }

  targetDetailsOpen.value = open
}

function updateQualityLineEnchantMethod(lineIndex, method) {
  const option = currentOddsEnchantMethodOptions.value.find((item) => item.value === method)
  if (!option) {
    return
  }

  setQualityLineEnchantMethod(lineIndex, method)
  const line = pendingLines.value.find((item) => item.index === lineIndex)
  if (line) {
    planAnnouncement.value = `${line.stat} now uses ${option.label}.`
  }
}

function updateAllEnchantMethods(method) {
  const option = currentOddsEnchantMethodOptions.value.find((item) => item.value === method)
  if (!option) {
    return
  }

  setAllQualityLineEnchantMethods(method)
  planAnnouncement.value = `${option.label} applied to every roll.`
}

function isLineMethodOverride(line) {
  return qualityLineEnchantMethods.value[line.index] !== qualityPlanEnchantMethod.value
}

function optimizeOrder() {
  const result = optimizeQualityOddsOrder()
  if (!result) {
    return
  }

  if (!result.changed) {
    optimizationMessage.value = 'No order improves target chance; ties keep your order.'
  } else {
    const beforeText = formatProbability(result.beforeChance)
    const afterText = formatProbability(result.afterChance)
    optimizationMessage.value =
      beforeText === afterText
        ? `Order optimized; target chance improves slightly and still rounds to ${afterText}.`
        : `Target chance optimized: ${beforeText} → ${afterText}.`
  }
  planAnnouncement.value = optimizationMessage.value
}

function movePendingLine(line, direction) {
  const nextStep = line.pendingStep + direction
  optimizationMessage.value = ''
  movePendingQualityOddsLine(line.index, direction)
  planAnnouncement.value = `${line.stat} moved to step ${nextStep}.`
}

function clampPercent(value) {
  return Math.min(Math.max(Number(value) || 0, 0), 100)
}

function formatCount(value) {
  return Number.isFinite(value) ? compactNumberFormatter.format(value) : '—'
}

function formatCopyCount(value) {
  const noun = Math.abs(value - 1) < 1e-9 ? 'copy' : 'copies'
  return `${formatCount(value)} ${noun}`
}

function formatEly(value) {
  if (!Number.isFinite(value)) {
    return '—'
  }
  if (value === 0) {
    return '0'
  }
  if (value >= 1_000_000_000) {
    return `${compactNumberFormatter.format(value / 1_000_000_000)}b`
  }
  if (value >= 1_000_000) {
    return `${compactNumberFormatter.format(value / 1_000_000)}m`
  }
  return compactNumberFormatter.format(value)
}

function formatHammerCount(value) {
  if (!Number.isFinite(value)) {
    return '—'
  }

  const noun = Math.abs(value - 1) < 1e-9 ? 'hammer' : 'hammers'
  return `${formatCount(value)} ${noun}`
}

function formatMaterialPath(cost) {
  const parts = [formatHammerCount(cost.hammers)]
  if (Number.isFinite(cost.ely) && cost.ely > 0) {
    parts.push(`${formatEly(cost.ely)} Ely`)
  }
  return parts.join(' · ')
}

function formatAttemptCost(method) {
  return `per attempted roll: untradeable item, ${formatMaterialPath(method.costsByTradeability.untradeable)}; tradable item, ${formatMaterialPath(method.costsByTradeability.tradable)}`
}

function formatRangeText(range) {
  return String(range).replaceAll(' ~ ', '–')
}
</script>

<template>
  <div class="min-w-0">
    <p class="sr-only" aria-live="polite" aria-atomic="true">
      {{ liveAnnouncement }}
    </p>

    <Collapsible v-model:open="planDetailsOpen">
      <div
        class="overflow-hidden rounded-2xl bg-gradient-to-br from-surface-inset to-info-surface/70"
      >
        <Collapsible :open="targetDetailsOpen" @update:open="setTargetDetailsOpen">
          <section aria-labelledby="quality-outcome-heading">
            <div class="p-4 sm:p-5">
              <div class="flex min-w-0 items-start justify-between gap-3">
                <div class="min-w-0">
                  <h3
                    id="quality-outcome-heading"
                    class="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    {{ outcomeLabel }}
                  </h3>
                  <MotionValue
                    :motion-key="odds.totalChanceText"
                    as="div"
                    class="motion-tabular mt-1 text-4xl font-bold tracking-[-0.05em]"
                  >
                    {{ odds.totalChanceText }}
                  </MotionValue>
                  <p v-if="outcomeSummary" class="mt-1 text-sm text-muted-foreground">
                    {{ outcomeSummary }}
                  </p>
                </div>

                <CollapsibleTrigger as-child>
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-8 shrink-0 bg-background/70 px-2.5 shadow-sm"
                    :aria-label="targetDisclosureLabel"
                  >
                    <TargetIcon data-icon="inline-start" aria-hidden="true" />
                    <span>
                      {{ hasCustomQualityTarget ? 'Target' : 'SSS' }} ·
                      {{ odds.targetQualityText }}
                    </span>
                    <ChevronDownIcon
                      data-icon="inline-end"
                      :class="cn('transition-transform', targetDetailsOpen && 'rotate-180')"
                      aria-hidden="true"
                    />
                  </Button>
                </CollapsibleTrigger>
              </div>

              <div v-if="odds.targetState === 'active'" class="mt-3">
                <p
                  id="quality-average-heading"
                  class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Average to succeed
                </p>
                <dl
                  class="mt-1.5 grid min-w-0 grid-cols-[minmax(5.5rem,0.65fr)_minmax(0,1.35fr)] divide-x"
                  aria-labelledby="quality-average-heading"
                >
                  <div class="min-w-0 pr-3 sm:pr-5">
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Matching copies
                    </dt>
                    <dd
                      class="motion-tabular mt-1 text-lg font-semibold tracking-[-0.03em] sm:text-xl"
                    >
                      ≈{{ formatCount(odds.expectedStarts) }}
                    </dd>
                  </div>
                  <div class="min-w-0 pl-3 sm:pl-5">
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Materials
                    </dt>
                    <dd class="mt-1 grid min-w-0 gap-1 text-[11px] sm:text-xs">
                      <span
                        v-for="path in targetMaterialPaths"
                        :key="path.key"
                        class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-baseline gap-2"
                      >
                        <span class="text-muted-foreground">{{ path.label }}</span>
                        <span class="motion-tabular min-w-0 break-words text-right font-semibold">
                          {{ formatMaterialPath(path) }}
                        </span>
                      </span>
                    </dd>
                  </div>
                </dl>
              </div>

              <template v-if="odds.targetState === 'active'">
                <div
                  class="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted"
                  aria-hidden="true"
                >
                  <span
                    class="bg-success"
                    :style="outcomeSegmentStyles.target"
                    aria-hidden="true"
                  ></span>
                  <span
                    class="bg-warning"
                    :style="outcomeSegmentStyles.kept"
                    aria-hidden="true"
                  ></span>
                  <span
                    class="bg-destructive"
                    :style="outcomeSegmentStyles.destroyed"
                    aria-hidden="true"
                  ></span>
                </div>

                <dl
                  v-if="hasAlternateOutcomes"
                  class="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5 text-xs"
                  aria-label="Other attempt outcomes"
                >
                  <div v-if="hasKeptMissOutcome" class="flex items-center gap-1.5">
                    <span
                      class="size-1.5 shrink-0 rounded-full bg-warning"
                      aria-hidden="true"
                    ></span>
                    <dt class="text-muted-foreground">End below target</dt>
                    <dd class="motion-tabular font-semibold">
                      {{ odds.survivedMissChanceText }}
                    </dd>
                  </div>
                  <div v-if="hasDestroyedOutcome" class="flex items-center gap-1.5">
                    <span
                      class="size-1.5 shrink-0 rounded-full bg-destructive"
                      aria-hidden="true"
                    ></span>
                    <dt class="text-muted-foreground">Destroyed</dt>
                    <dd class="motion-tabular font-semibold">
                      {{ odds.destroyedChanceText }}
                    </dd>
                  </div>
                </dl>
              </template>
            </div>

            <div
              v-if="odds.targetState === 'active' && activePendingLines.length"
              class="border-t border-border/60 px-4 py-2.5 sm:px-5"
            >
              <div
                class="grid min-w-0 gap-2.5 sm:grid-cols-[minmax(9rem,0.55fr)_minmax(0,1.45fr)] sm:items-center"
              >
                <div class="min-w-0">
                  <h4 id="quality-common-method-label" class="text-xs font-semibold">
                    {{ commonMethodLabel }}
                    <span class="sr-only">
                      for all rolls; selecting a method clears per-line overrides
                    </span>
                  </h4>
                </div>

                <ToggleGroup
                  type="single"
                  variant="outline"
                  :spacing="1"
                  :model-value="qualityPlanEnchantMethod"
                  class="grid w-full gap-1"
                  :style="methodGridStyle"
                  aria-labelledby="quality-common-method-label"
                >
                  <ToggleGroupItem
                    v-for="method in currentOddsEnchantMethodOptions"
                    :key="method.value"
                    :value="method.value"
                    class="min-w-0 gap-1 px-1.5 text-xs"
                    :aria-label="`${method.label}: ${method.successRate * 100}% success; ${formatAttemptCost(method)}`"
                    @click="updateAllEnchantMethods(method.value)"
                  >
                    <span class="truncate font-semibold">{{ method.label }}</span>
                    <span
                      class="motion-tabular hidden shrink-0 text-[10px] text-muted-foreground min-[360px]:inline"
                    >
                      {{ method.successRate * 100 }}%
                    </span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </section>

          <CollapsibleContent class="border-t border-border/60 bg-background/25">
            <div class="p-4 sm:p-5">
              <FieldGroup class="grid grid-cols-[minmax(6.5rem,0.7fr)_minmax(0,1.3fr)] gap-2">
                <Field
                  :class="cn(!hasQuickTargetPresets && 'col-span-2')"
                  :data-invalid="targetError ? true : undefined"
                >
                  <FieldLabel for="quality-target" class="sr-only">Exact target</FieldLabel>
                  <div class="flex items-center gap-2">
                    <InputGroup>
                      <InputGroupInput
                        id="quality-target"
                        v-model="qualityTargetDraft"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        max="100"
                        step="0.01"
                        class="motion-tabular"
                        :aria-invalid="targetError ? true : undefined"
                        :aria-describedby="targetError ? 'quality-target-error' : undefined"
                        @blur="commitQualityTarget"
                        @keydown.enter.prevent="$event.currentTarget.blur()"
                        @keydown.esc.prevent="cancelQualityTargetEdit"
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupText>%</InputGroupText>
                      </InputGroupAddon>
                    </InputGroup>
                    <Button
                      v-if="hasCustomQualityTarget && !hasQuickTargetPresets"
                      variant="ghost"
                      size="xs"
                      class="shrink-0"
                      @click="restoreDefaultTarget"
                    >
                      <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                      SSS
                    </Button>
                  </div>
                  <FieldError v-if="targetError" id="quality-target-error">
                    {{ targetError }}
                  </FieldError>
                </Field>

                <Field v-if="hasQuickTargetPresets">
                  <FieldLabel id="quality-preset-label" class="sr-only">Quick targets</FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    :spacing="1"
                    :model-value="selectedTargetPreset"
                    class="grid gap-1"
                    :style="targetPresetGridStyle"
                    aria-labelledby="quality-preset-label"
                  >
                    <ToggleGroupItem
                      v-for="preset in targetPresets"
                      :key="preset.id"
                      :value="preset.id"
                      class="min-w-0 px-1 text-xs"
                      @click="applyTargetPreset(preset.id)"
                    >
                      {{ preset.label }}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Field>
              </FieldGroup>

              <section class="mt-3" aria-label="Quality range">
                <div aria-hidden="true">
                  <div class="relative pb-5 pt-5">
                    <span :class="targetMarkerClass" :style="runwayStyle.target">Target</span>
                    <div class="relative h-2 rounded-full bg-muted shadow-inner">
                      <div
                        class="absolute inset-y-0 rounded-full border border-info-border bg-primary/25"
                        :style="runwayStyle.planned"
                      ></div>
                      <div
                        class="absolute -top-1 h-4 w-0.5 bg-warning"
                        :style="runwayStyle.target"
                      ></div>
                      <div
                        v-if="hasLockedQuality"
                        class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-success shadow-sm"
                        :style="runwayStyle.locked"
                      ></div>
                    </div>
                    <span class="absolute bottom-0 left-0 text-[10px] text-muted-foreground"
                      >0%</span
                    >
                    <span class="absolute bottom-0 right-0 text-[10px] text-muted-foreground">
                      100%
                    </span>
                  </div>
                </div>

                <dl class="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground"
                    >
                      Locked
                    </dt>
                    <dd class="motion-tabular mt-0.5 font-semibold">
                      {{ hasLockedQuality ? odds.qualityText.replaceAll(' ~ ', '–') : 'None' }}
                    </dd>
                  </div>
                  <div class="text-right">
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground"
                    >
                      Possible
                    </dt>
                    <dd class="motion-tabular mt-0.5 font-semibold">
                      {{ odds.plannedQualityText.replaceAll(' ~ ', '–') }}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <CollapsibleTrigger as-child>
          <Button
            variant="ghost"
            class="h-auto w-full justify-start rounded-none border-t border-border/60 px-4 py-2.5 text-left sm:px-5"
          >
            <SparklesIcon data-icon="inline-start" aria-hidden="true" />
            <span class="min-w-0 flex-1 text-xs font-semibold">{{ planLabel }}</span>
            <ChevronDownIcon
              data-icon="inline-end"
              :class="cn('transition-transform', planDetailsOpen && 'rotate-180')"
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent>
        <section
          v-if="odds.targetState === 'active' && pendingLines.length > 1"
          class="border-t py-5"
          aria-labelledby="quality-order-heading"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 items-center gap-1">
              <h3 id="quality-order-heading" class="font-semibold">Roll order</h3>
              <Tooltip :delay-duration="200">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="rounded-full text-muted-foreground"
                    aria-label="How roll-order optimization works"
                  >
                    <CircleHelpIcon aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent class="max-w-64">
                  Maximizes target chance. Ratings and material costs do not affect order.
                </TooltipContent>
              </Tooltip>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <Button
                :variant="methodOverridesOpen ? 'secondary' : 'ghost'"
                size="sm"
                :aria-pressed="methodOverridesOpen"
                @click="methodOverridesOpen = !methodOverridesOpen"
              >
                <Settings2Icon data-icon="inline-start" aria-hidden="true" />
                Per-line
                <span v-if="methodOverrideCount" class="motion-tabular">
                  · {{ methodOverrideCount }}
                </span>
              </Button>
              <Button variant="outline" size="sm" class="shrink-0" @click="optimizeOrder">
                <SparklesIcon data-icon="inline-start" aria-hidden="true" />
                Optimize
              </Button>
            </div>
          </div>

          <p v-if="optimizationMessage" class="mt-3 text-xs font-medium text-info-foreground">
            {{ optimizationMessage }}
          </p>

          <ol class="mt-4 border-y divide-y" aria-label="Pending roll sequence">
            <li
              v-for="(line, position) in pendingLines"
              :key="`pending-quality-line-${line.index}`"
              class="py-3"
            >
              <div
                :class="
                  cn(
                    'grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2',
                    methodOverridesOpen
                      ? 'sm:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,14rem)_auto]'
                      : 'sm:grid-cols-[auto_minmax(0,1fr)_auto]',
                  )
                "
              >
                <div
                  class="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                >
                  {{ line.pendingStep }}
                </div>

                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h4 class="font-semibold">{{ line.stat }}</h4>
                    <Badge v-if="line.attemptChance <= 0" variant="secondary">
                      Skipped by early stop
                    </Badge>
                    <Badge
                      v-else-if="!methodOverridesOpen && isLineMethodOverride(line)"
                      variant="outline"
                    >
                      <span class="sr-only">Method override:</span>
                      {{ line.enchantMethodLabel }}
                    </Badge>
                  </div>
                  <p class="motion-tabular mt-0.5 text-xs text-muted-foreground">
                    {{ formatRangeText(line.range) }}
                    <template v-if="line.attemptChance > 0">
                      · Reach {{ line.attemptChanceText }} · Finish {{ line.finishChanceText }} ·
                      Target
                      {{ line.targetChanceAfterText }}
                    </template>
                  </p>
                </div>

                <ToggleGroup
                  v-if="methodOverridesOpen && line.attemptChance > 0"
                  type="single"
                  variant="outline"
                  :spacing="1"
                  :model-value="qualityLineEnchantMethods[line.index]"
                  class="col-span-2 col-start-2 row-start-2 grid w-full gap-1 sm:col-span-1 sm:col-start-3 sm:row-start-1"
                  :style="methodGridStyle"
                  :aria-label="`Enchant method override for ${line.stat}`"
                  @update:model-value="updateQualityLineEnchantMethod(line.index, $event)"
                >
                  <ToggleGroupItem
                    v-for="method in currentOddsEnchantMethodOptions"
                    :key="method.value"
                    :value="method.value"
                    class="min-w-0 px-1 text-xs"
                    :aria-label="`${method.label}: ${method.successRate * 100}% success for ${line.stat}; ${formatAttemptCost(method)}`"
                  >
                    {{ method.label }}
                  </ToggleGroupItem>
                </ToggleGroup>

                <div
                  :class="
                    cn(
                      'col-start-3 row-start-1 flex items-center gap-1',
                      methodOverridesOpen ? 'sm:col-start-4' : 'sm:col-start-3',
                    )
                  "
                  role="group"
                  :aria-label="`Reorder ${line.stat}`"
                >
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    :disabled="position === 0"
                    :aria-label="`Move ${line.stat} earlier to step ${Math.max(1, position)}`"
                    @click="movePendingLine(line, -1)"
                  >
                    <ArrowUpIcon data-icon="inline-start" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    :disabled="position === pendingLines.length - 1"
                    :aria-label="`Move ${line.stat} later to step ${Math.min(pendingLines.length, position + 2)}`"
                    @click="movePendingLine(line, 1)"
                  >
                    <ArrowDownIcon data-icon="inline-start" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          </ol>
        </section>

        <section
          :class="
            cn('py-3', odds.targetState === 'active' && pendingLines.length > 1 && 'border-t')
          "
          aria-labelledby="quality-budget-heading"
        >
          <h3 id="quality-budget-heading" class="sr-only">Copy budget</h3>
          <dl v-if="odds.isTargetReachable" class="flex items-center justify-between gap-3">
            <dt class="text-xs font-medium text-muted-foreground">90% success chance</dt>
            <dd class="motion-tabular font-semibold">
              {{ formatCopyCount(odds.startsForHighConfidence) }}
            </dd>
          </dl>
          <p v-else class="text-xs text-muted-foreground">No copy budget at this target.</p>
        </section>

        <Collapsible v-model:open="calculationNotesOpen" class="border-t">
          <CollapsibleTrigger as-child>
            <Button
              variant="ghost"
              class="h-auto w-full justify-start rounded-none px-0 py-3 text-left"
            >
              <span class="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
                Calculation notes
              </span>
              <ChevronDownIcon
                data-icon="inline-end"
                :class="cn('transition-transform', calculationNotesOpen && 'rotate-180')"
                aria-hidden="true"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p class="pb-4 text-xs leading-relaxed text-muted-foreground">
              Starts with matching copies of the entered lines and stops at the target or when it
              becomes unreachable. Materials cover attempted rolls only; replacement copies and
              rebuilt lines are excluded.
            </p>
          </CollapsibleContent>
        </Collapsible>
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
