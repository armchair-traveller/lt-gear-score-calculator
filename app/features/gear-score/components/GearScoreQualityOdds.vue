<script setup>
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  InfoIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TargetIcon,
  WandSparklesIcon,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { getQualityTargetPresetValues } from '@/features/gear-score/data.js'
import { formatProbability } from '@/features/gear-score/helpers.js'
import { cn } from '@/lib/utils'

const {
  gearType,
  qualityLineEnchantMethods,
  results,
  currentOddsEnchantMethodOptions,
  defaultQualityTargetPercent,
  hasCustomQualityTarget,
  qualityTargetPercent,
  platinumHammerElyValue,
  movePendingQualityOddsLine,
  optimizeQualityOddsOrder,
  setQualityLineEnchantMethod,
  setQualityTargetPercent,
  resetQualityTarget,
} = useGearScoreCalculatorContext()

const qualityTargetDraft = ref('')
const targetError = ref('')
const targetDetailsOpen = ref(false)
const rollDetailsOpen = ref(false)
const planDetailsOpen = ref(false)
const optimizationMessage = ref('')
const planAnnouncement = ref('')

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
})

const odds = computed(() => results.value.qualityOdds)
const pendingLines = computed(() => odds.value.lines.filter((line) => line.status === 'new'))
const activePendingLines = computed(() =>
  pendingLines.value.filter((line) => line.attemptChance > 0),
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

const commonPendingMethod = computed(() => {
  const methods = activePendingLines.value.map(
    (line) => qualityLineEnchantMethods.value[line.index],
  )
  return methods.length && methods.every((method) => method === methods[0]) ? methods[0] : undefined
})

const commonPendingMethodOption = computed(() =>
  currentOddsEnchantMethodOptions.value.find(
    (method) => method.value === commonPendingMethod.value,
  ),
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
  return 'Chance to reach target'
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

  return `About ${formatCount(odds.value.expectedStarts)} copies per success.`
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

const activeMethodSummary = computed(() =>
  currentOddsEnchantMethodOptions.value
    .map((method) => ({
      label: method.label,
      count: activePendingLines.value.filter(
        (line) => qualityLineEnchantMethods.value[line.index] === method.value,
      ).length,
    }))
    .filter((method) => method.count > 0)
    .map((method) => `${method.count}× ${method.label}`)
    .join(' · '),
)

const hasActiveSpecialMethod = computed(() =>
  activePendingLines.value.some(
    (line) => qualityLineEnchantMethods.value[line.index] === 'special',
  ),
)

const targetHammerValue = computed(() => {
  const materials = odds.value.materials.perTarget
  if (!Number.isFinite(materials.hammersMin) || !Number.isFinite(materials.hammersMax)) {
    return '—'
  }

  const minText = formatCount(materials.hammersMin)
  const maxText = formatCount(materials.hammersMax)
  if (minText === maxText) {
    return minText
  }
  if (hasActiveSpecialMethod.value) {
    return `${minText} untradeable / ${maxText} tradable`
  }
  return `${minText}–${maxText}`
})

const targetMaterialSummary = computed(() => {
  const materials = odds.value.materials.perTarget
  if (
    !Number.isFinite(materials.ely) ||
    !Number.isFinite(materials.hammersMin) ||
    !Number.isFinite(materials.hammersMax)
  ) {
    return 'Unavailable'
  }

  if (hasActiveSpecialMethod.value && materials.hammersMin !== materials.hammersMax) {
    return `${formatEly(materials.ely)} Ely + ${formatCount(materials.hammersMin)} untradeable / ${formatCount(materials.hammersMax)} tradable hammers`
  }

  return `${formatEly(materials.ely)} Ely + ${targetHammerValue.value} hammers`
})

const commonMethodCostSummary = computed(() => {
  const method = commonPendingMethodOption.value
  if (!method) {
    return `Mixed · ${activeMethodSummary.value}`
  }

  return formatCompactAttemptCost(method)
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
  if (typeof method === 'string') {
    setQualityLineEnchantMethod(lineIndex, method)
  }
}

function updateAllEnchantMethods(method) {
  if (typeof method === 'string') {
    activePendingLines.value.forEach((line) => {
      setQualityLineEnchantMethod(line.index, method)
    })
  }
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

function formatHammerRange(minValue, maxValue) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return '—'
  }

  const minText = formatCount(minValue)
  const maxText = formatCount(maxValue)
  return minText === maxText ? minText : `${minText}–${maxText}`
}

function formatMethodCost(method) {
  const hammerText = formatHammerRange(method.hammerCostMin, method.hammerCostMax)
  const hammerLabel = method.hammerCostMax === 1 ? 'hammer' : 'hammers'
  if (method.elyCost === 0) {
    return `${hammerText} ${hammerLabel} · no Ely`
  }
  return `${formatEly(method.elyCost)} Ely + ${hammerText} ${hammerLabel}`
}

function formatAttemptCost(method) {
  if (method.hammerCostMin !== method.hammerCostMax) {
    const elyText = method.elyCost === 0 ? 'no Ely' : `${formatEly(method.elyCost)} Ely`
    return `${formatCount(method.hammerCostMin)} untradeable hammers or ${formatCount(method.hammerCostMax)} tradable hammers · ${elyText} per attempted roll`
  }

  return `${formatMethodCost(method)} per attempted roll`
}

function formatCompactAttemptCost(method) {
  if (method.hammerCostMin !== method.hammerCostMax) {
    const elyText = method.elyCost === 0 ? 'no Ely' : `${formatEly(method.elyCost)} Ely`
    return `${formatCount(method.hammerCostMin)} untradeable / ${formatCount(method.hammerCostMax)} tradable hammers per roll · ${elyText}`
  }

  return `${formatMethodCost(method)} per roll`
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

    <div class="overflow-hidden rounded-2xl border bg-surface-raised">
      <section aria-labelledby="quality-outcome-heading">
        <Collapsible :open="targetDetailsOpen" @update:open="setTargetDetailsOpen">
          <div class="p-4 sm:p-5">
            <div class="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0">
                <h3
                  id="quality-outcome-heading"
                  class="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground"
                >
                  {{ outcomeLabel }}
                </h3>
                <MotionValue
                  :motion-key="odds.totalChanceText"
                  as="div"
                  class="motion-tabular mt-1 text-4xl font-bold tracking-[-0.05em] sm:text-5xl"
                >
                  {{ odds.totalChanceText }}
                </MotionValue>
                <p class="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {{ outcomeSummary }}
                </p>
              </div>

              <CollapsibleTrigger as-child>
                <Button
                  variant="outline"
                  size="sm"
                  class="w-full justify-between sm:w-auto"
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

            <template v-if="odds.targetState === 'active'">
              <div class="mt-5 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
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
                :class="
                  cn(
                    'mt-3 grid gap-3',
                    hasKeptMissOutcome && hasDestroyedOutcome ? 'grid-cols-2' : 'grid-cols-1',
                  )
                "
                aria-label="Other attempt outcomes"
              >
                <div v-if="hasKeptMissOutcome" class="min-w-0">
                  <dt
                    class="flex items-start gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-warning-foreground"
                  >
                    <span
                      class="mt-1 size-1.5 shrink-0 rounded-full bg-warning"
                      aria-hidden="true"
                    ></span>
                    End below target
                  </dt>
                  <dd class="motion-tabular mt-1 font-semibold">
                    {{ odds.survivedMissChanceText }}
                  </dd>
                </div>
                <div v-if="hasDestroyedOutcome" class="min-w-0">
                  <dt
                    class="flex items-start gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-destructive"
                  >
                    <span
                      class="mt-1 size-1.5 shrink-0 rounded-full bg-destructive"
                      aria-hidden="true"
                    ></span>
                    Destroyed
                  </dt>
                  <dd class="motion-tabular mt-1 font-semibold">
                    {{ odds.destroyedChanceText }}
                  </dd>
                </div>
              </dl>
            </template>
          </div>

          <CollapsibleContent>
            <Separator />
            <div
              class="grid min-w-0 gap-6 p-4 sm:p-5 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)]"
            >
              <FieldSet class="gap-4">
                <FieldLegend variant="label">Target</FieldLegend>

                <FieldGroup class="gap-4">
                  <Field :data-invalid="targetError ? true : undefined">
                    <div class="flex items-center justify-between gap-3">
                      <FieldLabel for="quality-target">Exact</FieldLabel>
                      <Button
                        v-if="hasCustomQualityTarget && !hasQuickTargetPresets"
                        variant="ghost"
                        size="xs"
                        @click="restoreDefaultTarget"
                      >
                        <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                        Use SSS
                      </Button>
                    </div>
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
                    <FieldError v-if="targetError" id="quality-target-error">
                      {{ targetError }}
                    </FieldError>
                  </Field>

                  <Field v-if="hasQuickTargetPresets">
                    <FieldLabel id="quality-preset-label">Quick targets</FieldLabel>
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
              </FieldSet>

              <section aria-labelledby="quality-range-heading">
                <div class="flex items-center gap-2">
                  <WandSparklesIcon class="size-4 text-info-foreground" aria-hidden="true" />
                  <h4 id="quality-range-heading" class="font-semibold">Quality range</h4>
                </div>
                <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                  100% is theoretical, not a practical target.
                </p>

                <div class="mt-4" aria-hidden="true">
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
                    <span class="absolute bottom-0 right-0 text-[10px] text-muted-foreground"
                      >100%</span
                    >
                  </div>
                </div>

                <dl class="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground"
                    >
                      Locked
                    </dt>
                    <dd class="motion-tabular mt-1 font-semibold">
                      {{ hasLockedQuality ? odds.qualityText.replaceAll(' ~ ', '–') : 'None' }}
                    </dd>
                  </div>
                  <div>
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground"
                    >
                      Possible finish
                    </dt>
                    <dd class="motion-tabular mt-1 font-semibold">
                      {{ odds.plannedQualityText.replaceAll(' ~ ', '–') }}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      <template v-if="odds.targetState === 'active' && activePendingLines.length">
        <Separator />
        <section aria-labelledby="quality-roll-plan-heading">
          <h3 id="quality-roll-plan-heading" class="sr-only">Roll plan</h3>
          <div
            class="grid min-w-0 gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.75fr)]"
          >
            <div class="min-w-0">
              <FieldGroup>
                <Field>
                  <FieldLabel id="quality-common-method-label">
                    Method ·
                    {{
                      activePendingLines.length === 1
                        ? activePendingLines[0].stat
                        : `${activePendingLines.length} rolls`
                    }}
                  </FieldLabel>
                  <ToggleGroup
                    type="single"
                    variant="outline"
                    :spacing="1"
                    :model-value="commonPendingMethod"
                    class="grid w-full gap-1"
                    :style="methodGridStyle"
                    aria-labelledby="quality-common-method-label"
                    @update:model-value="updateAllEnchantMethods"
                  >
                    <ToggleGroupItem
                      v-for="method in currentOddsEnchantMethodOptions"
                      :key="method.value"
                      :value="method.value"
                      class="min-w-0 flex-col gap-0 px-1 text-xs"
                      :aria-label="`${method.label}: ${method.successRate * 100}% success; ${formatAttemptCost(method)}`"
                    >
                      <span class="font-semibold">{{ method.label }}</span>
                      <span class="motion-tabular text-[10px] text-muted-foreground">
                        {{ method.successRate * 100 }}%
                      </span>
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <FieldDescription>{{ commonMethodCostSummary }}</FieldDescription>
                </Field>
              </FieldGroup>

              <p
                v-if="hasDestroyedOutcome"
                class="mt-3 flex items-center gap-2 text-xs font-medium text-destructive"
              >
                <ShieldAlertIcon class="size-4 shrink-0" aria-hidden="true" />
                Failure destroys a copy.
              </p>
            </div>

            <dl class="rounded-xl bg-surface-inset p-3">
              <div>
                <dt class="text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                  Avg. materials per success
                </dt>
                <dd class="motion-tabular mt-1 font-semibold">
                  {{ targetMaterialSummary }}
                </dd>
                <dd class="mt-1 text-xs text-muted-foreground">
                  Excludes replacement copies and rebuilt lines.
                </dd>
              </div>
            </dl>
          </div>

          <Collapsible v-if="pendingLines.length > 1" v-model:open="rollDetailsOpen">
            <Separator />
            <CollapsibleTrigger as-child>
              <Button
                variant="ghost"
                class="h-auto w-full justify-start rounded-none px-4 py-3 text-left sm:px-5"
              >
                <SparklesIcon data-icon="inline-start" aria-hidden="true" />
                <span class="min-w-0 flex-1 text-sm font-semibold">Order & per-roll odds</span>
                <ChevronDownIcon
                  data-icon="inline-end"
                  :class="cn('transition-transform', rollDetailsOpen && 'rotate-180')"
                  aria-hidden="true"
                />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <Separator />
              <div class="p-4 sm:p-5">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <p class="max-w-md text-xs leading-relaxed text-muted-foreground">
                    Optimizes target chance using roll ranges and methods—not rating, cost, or
                    survival. Lower-rated lines may go first; ties keep your order.
                  </p>
                  <Button variant="outline" size="sm" @click="optimizeOrder">
                    <SparklesIcon data-icon="inline-start" aria-hidden="true" />
                    Optimize order
                  </Button>
                </div>

                <p v-if="optimizationMessage" class="mt-3 text-xs font-medium text-info-foreground">
                  {{ optimizationMessage }}
                </p>

                <p class="mt-3 text-xs text-muted-foreground">Share of starting copies</p>

                <ol
                  class="mt-4 overflow-hidden rounded-xl border"
                  aria-label="Pending roll sequence"
                >
                  <li
                    v-for="(line, position) in pendingLines"
                    :key="`pending-quality-line-${line.index}`"
                  >
                    <div class="p-3 sm:p-4">
                      <div
                        class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3"
                      >
                        <div
                          class="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                        >
                          {{ line.pendingStep }}
                        </div>

                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-2">
                            <h4 class="font-semibold">{{ line.stat }}</h4>
                            <Badge v-if="line.attemptChance <= 0" variant="secondary">
                              Skipped by early stop
                            </Badge>
                          </div>
                          <p class="motion-tabular mt-1 text-xs text-muted-foreground">
                            Final range · {{ formatRangeText(line.range) }}
                          </p>
                        </div>

                        <div
                          class="flex items-center gap-1"
                          role="group"
                          :aria-label="`Reorder ${line.stat}`"
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            :disabled="position === 0"
                            :aria-label="`Move ${line.stat} earlier to step ${Math.max(1, position)}`"
                            @click="movePendingLine(line, -1)"
                          >
                            <ArrowUpIcon data-icon="inline-start" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            :disabled="position === pendingLines.length - 1"
                            :aria-label="`Move ${line.stat} later to step ${Math.min(pendingLines.length, position + 2)}`"
                            @click="movePendingLine(line, 1)"
                          >
                            <ArrowDownIcon data-icon="inline-start" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>

                      <template v-if="line.attemptChance > 0">
                        <FieldGroup class="mt-4">
                          <Field>
                            <FieldLabel :id="`quality-line-${line.index}-method-label`">
                              Method
                            </FieldLabel>
                            <ToggleGroup
                              type="single"
                              variant="outline"
                              :spacing="1"
                              :model-value="qualityLineEnchantMethods[line.index]"
                              class="grid w-full gap-1"
                              :style="methodGridStyle"
                              :aria-labelledby="`quality-line-${line.index}-method-label`"
                              @update:model-value="
                                updateQualityLineEnchantMethod(line.index, $event)
                              "
                            >
                              <ToggleGroupItem
                                v-for="method in currentOddsEnchantMethodOptions"
                                :key="method.value"
                                :value="method.value"
                                class="min-w-0 flex-col gap-0 px-1 text-xs"
                                :aria-label="`${method.label}: ${method.successRate * 100}% success for ${line.stat}; ${formatAttemptCost(method)}`"
                              >
                                <span class="font-semibold">{{ method.label }}</span>
                                <span class="motion-tabular text-[10px] text-muted-foreground">
                                  {{ method.successRate * 100 }}%
                                </span>
                              </ToggleGroupItem>
                            </ToggleGroup>
                            <FieldDescription>
                              {{ formatCompactAttemptCost(line) }}
                            </FieldDescription>
                          </Field>
                        </FieldGroup>

                        <dl
                          class="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-surface-inset p-2 text-center"
                        >
                          <div>
                            <dt
                              class="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground"
                            >
                              Reach roll
                            </dt>
                            <dd class="motion-tabular mt-1 text-xs font-semibold">
                              {{ line.attemptChanceText }}
                            </dd>
                          </div>
                          <div>
                            <dt
                              class="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground"
                            >
                              Finish here
                            </dt>
                            <dd class="motion-tabular mt-1 text-xs font-semibold">
                              {{ line.finishChanceText }}
                            </dd>
                          </div>
                          <div>
                            <dt
                              class="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground"
                            >
                              Target by here
                            </dt>
                            <dd class="motion-tabular mt-1 text-xs font-semibold">
                              {{ line.targetChanceAfterText }}
                            </dd>
                          </div>
                        </dl>
                      </template>
                    </div>
                    <Separator v-if="position < pendingLines.length - 1" />
                  </li>
                </ol>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </section>
      </template>

      <Separator />
      <Collapsible v-model:open="planDetailsOpen">
        <CollapsibleTrigger as-child>
          <Button
            variant="ghost"
            class="h-auto w-full justify-start rounded-none px-4 py-3 text-left sm:px-5"
          >
            <InfoIcon data-icon="inline-start" aria-hidden="true" />
            <span class="min-w-0 flex-1 text-sm font-semibold">Budget & assumptions</span>
            <ChevronDownIcon
              data-icon="inline-end"
              :class="cn('transition-transform', planDetailsOpen && 'rotate-180')"
              aria-hidden="true"
            />
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator />
          <div class="flex flex-col gap-5 p-4 sm:p-5">
            <section aria-labelledby="quality-budget-heading">
              <h3 id="quality-budget-heading" class="font-semibold">Copy budget</h3>

              <template v-if="odds.isTargetReachable">
                <dl class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div class="rounded-xl bg-surface-inset px-3 py-3">
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Copies / success
                    </dt>
                    <dd class="motion-tabular mt-1 text-lg font-semibold">
                      {{ formatCount(odds.expectedStarts) }}
                    </dd>
                  </div>
                  <div class="rounded-xl bg-surface-inset px-3 py-3">
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Copies for 90% chance
                    </dt>
                    <dd class="motion-tabular mt-1 text-lg font-semibold">
                      {{ formatCopyCount(odds.startsForHighConfidence) }}
                    </dd>
                  </div>
                  <div class="rounded-xl bg-surface-inset px-3 py-3">
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Destroyed / success
                    </dt>
                    <dd class="motion-tabular mt-1 text-lg font-semibold">
                      {{ formatCount(odds.expectedDestroyedItems) }}
                    </dd>
                  </div>
                  <div class="rounded-xl bg-surface-inset px-3 py-3">
                    <dt
                      class="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground"
                    >
                      Below target / success
                    </dt>
                    <dd class="motion-tabular mt-1 text-lg font-semibold">
                      {{ formatCount(odds.expectedKeptMisses) }}
                    </dd>
                  </div>
                </dl>
              </template>
              <p v-else class="mt-3 text-sm text-muted-foreground">
                Lower the target to see a copy budget.
              </p>
            </section>

            <Separator />

            <section aria-labelledby="quality-assumptions-heading">
              <h3 id="quality-assumptions-heading" class="font-semibold">Assumptions</h3>
              <dl
                class="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-xs leading-relaxed"
              >
                <dt class="font-semibold">Copy</dt>
                <dd class="text-muted-foreground">
                  Another piece with the same entered lines; blanks unattempted.
                </dd>

                <dt class="font-semibold">Lines</dt>
                <dd class="text-muted-foreground">
                  Entered damage stays fixed; non-damage is excluded; blank values are uniform
                  across base ranges.
                </dd>

                <dt class="font-semibold">Flow</dt>
                <dd class="text-muted-foreground">
                  One line at a time; failure destroys; stop at target or when unreachable.
                </dd>

                <dt class="font-semibold">Materials</dt>
                <dd class="text-muted-foreground">
                  Attempt costs only; replacements and rebuilt lines excluded.
                </dd>

                <dt class="font-semibold">Hammer</dt>
                <dd class="text-muted-foreground">
                  {{ formatEly(platinumHammerElyValue) }} Ely each; Ely and hammer totals stay
                  separate.
                </dd>
              </dl>
            </section>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  </div>
</template>
