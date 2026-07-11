<script setup>
import { computed } from 'vue'
import {
  formatMaxRollPercent,
  formatStatValue,
  getMaxRollPercentClass,
} from '@/features/gear-score/helpers.js'

const props = defineProps({
  slot: { type: Object, required: true },
  showSummary: { type: Boolean, default: true },
})

const slotModel = computed(() => props.slot)
const result = computed(() => slotModel.value.result)
const filledLines = computed(() =>
  result.value.lines.filter((line) => line.filled),
)
</script>

<template>
  <div class="grid gap-3">
    <div v-if="showSummary" class="grid grid-cols-2 gap-2">
      <div class="rounded-lg bg-surface-inset p-3">
        <div class="text-xs text-muted-foreground">Current DI</div>
        <div class="mt-1 text-lg font-semibold">{{ result.currentDI.toFixed(2) }}%</div>
      </div>
      <div class="rounded-lg bg-surface-inset p-3">
        <div class="text-xs text-muted-foreground">Benchmark</div>
        <div class="mt-1 text-lg font-semibold">{{ result.benchmarkDI.toFixed(2) }}%</div>
      </div>
    </div>

    <Separator v-if="showSummary" />

    <section v-if="filledLines.length" class="grid gap-2">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-xs font-medium text-muted-foreground">Final enchant lines</h3>
        <span class="text-xs font-medium">{{ result.filledLineCount }} / 5</span>
      </div>
      <div class="grid gap-1.5">
        <div
          v-for="line in filledLines"
          :key="line.index"
          class="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs"
        >
          <span class="min-w-0 truncate">{{ line.stat }}</span>
          <span class="font-medium">{{ formatStatValue(line.value, line.stat) }}</span>
          <span
            v-if="formatMaxRollPercent(line.maxPercent)"
            class="shrink-0 font-medium"
            :class="getMaxRollPercentClass(line.maxPercent)"
          >
            [{{ formatMaxRollPercent(line.maxPercent) }}]
          </span>
        </div>
      </div>
    </section>

    <Separator v-if="filledLines.length" />

    <section class="grid gap-2">
      <h3 class="text-xs font-medium text-muted-foreground">Optimal max-penta</h3>
      <div class="flex flex-wrap gap-1.5">
        <Badge
          v-for="stat in slotModel.item.Optimal"
          :key="stat"
          variant="secondary"
          class="max-w-full truncate"
        >
          {{ stat }}
        </Badge>
      </div>
    </section>
  </div>
</template>
