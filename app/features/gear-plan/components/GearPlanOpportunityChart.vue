<script setup>
import { useMediaQuery } from '@vueuse/core'
import {
  ArrowDownRightIcon,
  CheckCircle2Icon,
} from '@lucide/vue'
import {
  gearPlanStatusClasses,
  getGearPlanOpportunityTextClass,
} from '@/features/gear-plan/status-styles.js'

const {
  rankedSlots,
  slotModels,
  maxChartDI,
  editorOpen,
  selectedSlot,
  lastSavedSlotId,
  openEditor,
  getPrimaryReason,
  getLineStatusLabel,
} = useGearPlanContext()

const hoverCardsEnabled = useMediaQuery('(hover: hover) and (pointer: fine) and (min-width: 768px)')

function getWidth(value) {
  return `${Math.max(0, Math.min(value / maxChartDI.value * 100, 100))}%`
}

function getScale(value) {
  return Math.max(0, Math.min(value / maxChartDI.value, 1))
}
</script>

<template>
  <section class="grid gap-3">
    <div class="hidden flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="text-base font-semibold">Potential</h2>
        <p class="text-sm text-muted-foreground">Common DI scale across ranked pieces</p>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm bg-chart-3" />
          Current
        </span>
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm bg-chart-2" />
          Roll gap
        </span>
        <span class="flex items-center gap-1.5">
          <span class="size-2.5 rounded-sm bg-chart-1" />
          Piece gap
        </span>
      </div>
    </div>

    <Transition name="motion-fade" mode="out-in">
      <TransitionGroup
        v-if="rankedSlots.length"
        key="ranking"
        name="motion-list"
        tag="div"
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
          <HoverCard
            :open="editorOpen || !hoverCardsEnabled ? false : undefined"
            :open-delay="250"
            :close-delay="100"
            :enable-touch="false"
          >
            <HoverCardTrigger as-child>
              <button
                type="button"
                :data-selected="editorOpen && selectedSlot?.id === slot.id"
                class="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-surface-raised p-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 data-[selected=true]:bg-info-surface sm:grid-cols-[minmax(190px,280px)_minmax(260px,1fr)_150px]"
                :class="{ 'motion-feedback': lastSavedSlotId === slot.id }"
                @click="openEditor(slot.id)"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <span class="motion-tabular w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                    {{ index + 1 }}
                  </span>
                  <img class="size-9 shrink-0 rounded-md bg-surface-inset p-1" :src="slot.image" alt="">
                  <div class="min-w-0">
                    <div class="truncate text-sm font-medium">{{ slot.pieceType }}</div>
                    <div class="truncate text-xs text-muted-foreground">
                      {{ slot.gearType }} / {{ getLineStatusLabel(slot.result) }}
                    </div>
                  </div>
                </div>

                <div class="hidden min-w-0 sm:block">
                  <div class="relative h-3 w-full overflow-hidden rounded-sm bg-surface-inset">
                    <span
                      aria-hidden="true"
                      class="motion-bar absolute inset-0 bg-chart-1"
                      :style="{ transform: `scaleX(${getScale(slot.result.currentDI + slot.result.rollGapDI + slot.result.pieceGapDI)})` }"
                    />
                    <span
                      aria-hidden="true"
                      class="motion-bar absolute inset-0 bg-chart-2"
                      :style="{ transform: `scaleX(${getScale(slot.result.currentDI + slot.result.rollGapDI)})` }"
                    />
                    <span
                      aria-hidden="true"
                      class="motion-bar absolute inset-0 bg-chart-3"
                      :style="{ transform: `scaleX(${getScale(slot.result.currentDI)})` }"
                    />
                    <div class="absolute inset-0 flex">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <span
                            class="h-full shrink-0"
                            :style="{ width: getWidth(slot.result.currentDI) }"
                          />
                        </TooltipTrigger>
                        <TooltipContent>{{ slot.result.currentDI.toFixed(2) }}% current DI</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <span
                            class="h-full shrink-0"
                            :style="{ width: getWidth(slot.result.rollGapDI) }"
                          />
                        </TooltipTrigger>
                        <TooltipContent>{{ slot.result.rollGapDI.toFixed(2) }}% roll-value gap</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <span
                            class="h-full shrink-0"
                            :style="{ width: getWidth(slot.result.pieceGapDI) }"
                          />
                        </TooltipTrigger>
                        <TooltipContent>{{ slot.result.pieceGapDI.toFixed(2) }}% piece gap</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div class="mt-1.5 truncate text-xs text-muted-foreground">
                    {{ getPrimaryReason(slot) }}
                  </div>
                </div>

                <span class="sr-only">
                  Current {{ slot.result.currentDI.toFixed(2) }}% DI;
                  roll-value gap {{ slot.result.rollGapDI.toFixed(2) }}%;
                  piece gap {{ slot.result.pieceGapDI.toFixed(2) }}%.
                </span>

                <div class="flex items-center justify-between gap-3 sm:justify-end">
                  <Badge
                    v-if="slot.result.opportunityDI <= 0.0001"
                    variant="outline"
                    :class="gearPlanStatusClasses.complete"
                  >
                    <CheckCircle2Icon class="size-3.5" />
                    {{ slot.result.aboveBenchmark ? 'Above benchmark' : 'At benchmark' }}
                  </Badge>
                  <template v-else>
                    <div class="text-right">
                      <div
                        class="motion-tabular flex items-center justify-end gap-1 text-sm font-semibold"
                        :class="getGearPlanOpportunityTextClass(slot.result.opportunityDI)"
                      >
                        <ArrowDownRightIcon class="size-3.5" />
                        {{ slot.result.opportunityDI.toFixed(2) }}% DI
                      </div>
                      <div class="motion-tabular text-xs text-muted-foreground">{{ slot.result.qualityPercent.toFixed(0) }}% quality</div>
                    </div>
                  </template>
                </div>
              </button>
            </HoverCardTrigger>
            <HoverCardContent
              side="bottom"
              align="end"
              :side-flip="false"
              :side-offset="8"
              :collision-padding="12"
              class="w-80 p-3"
            >
              <GearPlanSlotPreview :slot="slot" :show-summary="false" />
            </HoverCardContent>
          </HoverCard>
        </div>
      </TransitionGroup>

      <div v-else key="empty" class="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed bg-surface-inset p-8 text-center">
        <span class="flex size-20 items-center justify-center rounded-3xl bg-surface-raised">
          <img class="size-16 object-contain" src="/smart_priring.png" alt="">
        </span>
        <h3 class="mt-4 text-xl font-bold">Build your upgrade queue</h3>
        <p class="mt-1 max-w-md text-sm text-muted-foreground">Add the final values from at least three enchant lines. The planner will compare completed pieces and surface the largest opportunity.</p>
        <div class="mt-4 flex flex-wrap justify-center gap-2 text-xs font-semibold text-muted-foreground">
          <Badge variant="secondary">1 · Pick a slot</Badge>
          <Badge variant="secondary">2 · Enter final lines</Badge>
          <Badge variant="secondary">3 · Compare priority</Badge>
        </div>
        <Button class="mt-5" @click="slotModels[0] && openEditor(slotModels[0].id)">Add first gear piece</Button>
      </div>
    </Transition>
  </section>
</template>
