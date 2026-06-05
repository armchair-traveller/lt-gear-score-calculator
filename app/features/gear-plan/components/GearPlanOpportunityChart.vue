<script setup>
import {
  ArrowDownRightIcon,
  CheckCircle2Icon,
} from '@lucide/vue'

const {
  rankedSlots,
  maxChartDI,
  openEditor,
  getPrimaryReason,
  getLineStatusLabel,
} = useGearPlanContext()

function getWidth(value) {
  return `${Math.max(0, Math.min(value / maxChartDI.value * 100, 100))}%`
}
</script>

<template>
  <section class="grid gap-3">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold">Potential</h2>
        <p class="text-sm text-muted-foreground">Common DI scale across ranked pieces</p>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm bg-foreground/80" />
          Current
        </span>
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm bg-amber-400 dark:bg-amber-500" />
          Roll gap
        </span>
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm bg-sky-500" />
          Piece gap
        </span>
      </div>
    </div>

    <div v-if="rankedSlots.length" class="overflow-hidden rounded-lg border">
      <button
        v-for="(slot, index) in rankedSlots"
        :key="slot.id"
        type="button"
        class="grid w-full gap-3 border-b p-3 text-left transition-colors last:border-b-0 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 sm:grid-cols-[minmax(190px,280px)_minmax(260px,1fr)_150px] sm:items-center"
        @click="openEditor(slot.id)"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span class="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
            {{ index + 1 }}
          </span>
          <img class="size-9 shrink-0 rounded-md bg-muted p-1" :src="slot.image" alt="">
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">{{ slot.pieceType }}</div>
            <div class="truncate text-xs text-muted-foreground">
              {{ slot.gearType }} / {{ getLineStatusLabel(slot.result) }}
            </div>
          </div>
        </div>

        <div class="min-w-0">
          <div class="flex h-3 w-full overflow-hidden rounded-sm bg-muted/70">
            <Tooltip>
              <TooltipTrigger as-child>
                <span
                  class="h-full shrink-0 bg-foreground/80"
                  :style="{ width: getWidth(slot.result.currentDI) }"
                />
              </TooltipTrigger>
              <TooltipContent>{{ slot.result.currentDI.toFixed(2) }}% current DI</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <span
                  class="h-full shrink-0 bg-amber-400 dark:bg-amber-500"
                  :style="{ width: getWidth(slot.result.rollGapDI) }"
                />
              </TooltipTrigger>
              <TooltipContent>{{ slot.result.rollGapDI.toFixed(2) }}% roll-value gap</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <span
                  class="h-full shrink-0 bg-sky-500"
                  :style="{ width: getWidth(slot.result.pieceGapDI) }"
                />
              </TooltipTrigger>
              <TooltipContent>{{ slot.result.pieceGapDI.toFixed(2) }}% piece gap</TooltipContent>
            </Tooltip>
          </div>
          <div class="mt-1.5 truncate text-xs text-muted-foreground">
            {{ getPrimaryReason(slot) }}
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 sm:justify-end">
          <Badge
            v-if="slot.result.opportunityDI <= 0.0001"
            variant="outline"
            class="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          >
            <CheckCircle2Icon class="size-3.5" />
            {{ slot.result.aboveBenchmark ? 'Above benchmark' : 'At benchmark' }}
          </Badge>
          <template v-else>
            <div class="text-right">
              <div class="flex items-center justify-end gap-1 text-sm font-semibold text-amber-700 dark:text-amber-300">
                <ArrowDownRightIcon class="size-3.5" />
                {{ slot.result.opportunityDI.toFixed(2) }}% DI
              </div>
              <div class="text-xs text-muted-foreground">{{ slot.result.qualityPercent.toFixed(0) }}% quality</div>
            </div>
          </template>
        </div>
      </button>
    </div>

    <div v-else class="rounded-lg border border-dashed p-8 text-center">
      <div class="text-sm font-medium">No ranked pieces yet</div>
      <div class="mt-1 text-sm text-muted-foreground">Enter at least 3 final lines on a gear slot to start ranking.</div>
    </div>
  </section>
</template>
