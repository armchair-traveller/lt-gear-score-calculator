<script setup>
import {
  ArrowDownIcon,
  ArrowUpIcon,
  RotateCcwIcon,
} from '@lucide/vue'
import { ref, watch } from 'vue'
import {
  formatMaxRollPercent,
  getMaxRollPercentClass,
} from '@/features/gear-score/helpers.js'

const {
  qualityLineEnchantMethods,
  results,
  currentOddsEnchantMethodOptions,
  qualityTargetPercent,
  moveQualityOddsLine,
  setQualityLineEnchantMethod,
  setQualityTargetPercent,
  resetQualityTarget,
  getRollStatusClass,
} = useGearScoreCalculatorContext()

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
    return
  }

  qualityTargetDraft.value = Number(qualityTargetPercent.value).toFixed(2)
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
  <div class="grid min-w-0 gap-4">
    <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] sm:items-end">
      <div class="min-w-0">
        <div class="text-sm text-muted-foreground">Chance to reach target</div>
        <MotionValue
          :motion-key="results.qualityOdds.totalChanceText"
          as="div"
          class="motion-tabular mt-1 text-3xl font-semibold tracking-normal"
        >
          {{ results.qualityOdds.totalChanceText }}
        </MotionValue>
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
                class="shrink-0"
                aria-label="Reset to SSS-equivalent target"
                @click="resetQualityTarget"
              >
                <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
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
        <MotionValue
          :motion-key="results.qualityOdds.qualityText"
          as="dd"
          class="motion-tabular mt-1 text-lg font-semibold"
        >
          {{ results.qualityOdds.qualityText }}
        </MotionValue>
      </div>
      <div v-if="results.qualityOdds.showProjectedQuality" class="px-3 py-3">
        <dt class="text-xs text-muted-foreground">Projected quality</dt>
        <MotionValue
          :motion-key="results.qualityOdds.plannedQualityText"
          as="dd"
          class="motion-tabular mt-1 text-lg font-semibold"
        >
          {{ results.qualityOdds.plannedQualityText }}
        </MotionValue>
      </div>
      <div class="px-3 py-3">
        <dt class="text-xs text-muted-foreground">Base rolls</dt>
        <MotionValue
          :motion-key="results.qualityOdds.baseRollText"
          as="dd"
          class="motion-tabular mt-1 text-lg font-semibold"
        >
          {{ results.qualityOdds.baseRollText }}
        </MotionValue>
      </div>
      <div class="px-3 py-3">
        <dt class="text-xs text-muted-foreground">Full survival</dt>
        <MotionValue
          :motion-key="results.qualityOdds.survivalChanceText"
          as="dd"
          class="motion-tabular mt-1 text-lg font-semibold"
        >
          {{ results.qualityOdds.survivalChanceText }}
        </MotionValue>
      </div>
    </dl>

    <Table
      container-class="max-h-[320px] min-w-0 rounded-lg border bg-surface-raised"
      class="min-w-[660px]"
    >
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
          <TableRow
            v-for="(line, position) in results.qualityOdds.lines"
            :key="`quality-line-${line.index}`"
          >
            <TableCell>
              <div class="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="touch-target"
                  :disabled="position === 0"
                  title="Move earlier"
                  aria-label="Move earlier"
                  @click="moveQualityOddsLine(position, -1)"
                >
                  <ArrowUpIcon data-icon="inline-start" aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="touch-target"
                  :disabled="position === results.qualityOdds.lines.length - 1"
                  title="Move later"
                  aria-label="Move later"
                  @click="moveQualityOddsLine(position, 1)"
                >
                  <ArrowDownIcon data-icon="inline-start" aria-hidden="true" />
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
                  <span class="motion-tabular mt-1 text-[11px] text-muted-foreground">
                    {{ method.successRate * 100 }}%
                  </span>
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
  </div>
</template>
