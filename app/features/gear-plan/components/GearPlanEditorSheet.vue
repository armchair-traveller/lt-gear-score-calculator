<script setup>
import {
  CheckCircle2Icon,
  GaugeIcon,
  InfoIcon,
  TargetIcon,
  Trash2Icon,
  TrendingUpIcon,
} from '@lucide/vue'

const emit = defineEmits(['request-delete'])

const {
  editorOpen,
  editorStatType,
  editorStatInput,
  editorPickerOpen,
  isSharedPreview,
  selectedSlot,
  editorStatOptions,
  editorResult,
  isEditorStatSelectedOnOtherLine,
  selectEditorStat,
  setEditorPickerOpen,
  setEditorInput,
  getEditorMaxValue,
  getEditorLineMaxSummaryText,
  getEditorLineMaxPercentText,
  getEditorLineMaxPercentClass,
  isEditorInputOverMax,
  saveEditor,
  getLineStatusLabel,
  getStatStep,
} = useGearPlanContext()

function getLineStatusClass(status) {
  if (status === 'penta') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
  }
  if (status === 'partial') {
    return 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
  }
  return 'bg-muted text-muted-foreground'
}
</script>

<template>
  <Sheet v-model:open="editorOpen">
    <SheetContent
      side="right"
      class="gap-0 p-0 data-[side=right]:!w-full sm:data-[side=right]:!max-w-none md:data-[side=right]:!w-[680px]"
    >
      <template v-if="selectedSlot">
        <SheetHeader class="border-b px-5 py-4 pr-14">
          <div class="flex min-w-0 items-center gap-3">
            <img class="size-12 shrink-0 rounded-lg bg-muted p-1" :src="selectedSlot.image" alt="">
            <div class="min-w-0">
              <SheetTitle class="truncate">{{ selectedSlot.pieceType }} {{ selectedSlot.gearType }}</SheetTitle>
              <SheetDescription>
                Final values / optimal max-penta
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <div class="grid gap-5 p-4 sm:p-5">
            <div
              v-if="isSharedPreview"
              class="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200"
            >
              Shared planner preview is read-only.
            </div>

            <div class="grid gap-2 sm:grid-cols-3">
              <div class="rounded-lg bg-muted/20 p-3">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <GaugeIcon class="size-3.5" />
                  Current DI
                </div>
                <div class="mt-1 text-xl font-semibold">{{ editorResult.currentDI.toFixed(2) }}%</div>
              </div>
              <div class="rounded-lg bg-muted/20 p-3">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <TargetIcon class="size-3.5" />
                  Benchmark
                </div>
                <div class="mt-1 text-xl font-semibold">{{ editorResult.benchmarkDI.toFixed(2) }}%</div>
              </div>
              <div class="rounded-lg bg-muted/20 p-3">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUpIcon class="size-3.5" />
                  Potential
                </div>
                <div
                  class="mt-1 text-xl font-semibold"
                  :class="editorResult.opportunityDI > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'"
                >
                  {{ editorResult.opportunityDI.toFixed(2) }}%
                </div>
              </div>
            </div>

            <section class="grid gap-2">
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-sm font-semibold">Final enchant lines</h3>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground">{{ editorResult.filledLineCount }} / 5 lines</span>
                  <Badge
                    variant="outline"
                    :class="getLineStatusClass(editorResult.lineStatus)"
                  >
                    <CheckCircle2Icon v-if="editorResult.lineStatus === 'penta'" class="size-3.5" />
                    {{ getLineStatusLabel(editorResult) }}
                  </Badge>
                </div>
              </div>

              <GearStatLinesEditor
                :stat-types="editorStatType"
                :stat-inputs="editorStatInput"
                :stat-options="editorStatOptions"
                :picker-open="editorPickerOpen"
                :disabled="isSharedPreview"
                value-placeholder="Final value"
                :get-stat-step="getStatStep"
                :get-max-value="getEditorMaxValue"
                :get-line-max-summary-text="getEditorLineMaxSummaryText"
                :get-line-max-percent-text="getEditorLineMaxPercentText"
                :get-line-max-percent-class="getEditorLineMaxPercentClass"
                :is-input-over-max="isEditorInputOverMax"
                :is-stat-selected-on-other-line="isEditorStatSelectedOnOtherLine"
                @select-stat="selectEditorStat"
                @update-input="setEditorInput"
                @update-picker-open="setEditorPickerOpen"
              />
            </section>

            <section class="grid gap-3">
              <h3 class="text-sm font-semibold">Potential breakdown</h3>
              <div class="grid gap-2">
                <div class="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
                  <span class="text-muted-foreground">Roll values</span>
                  <div class="h-2 overflow-hidden rounded-sm bg-muted">
                    <div
                      class="h-full bg-amber-400 dark:bg-amber-500"
                      :style="{ width: `${editorResult.opportunityDI ? editorResult.rollGapDI / editorResult.opportunityDI * 100 : 0}%` }"
                    />
                  </div>
                  <span class="font-medium">{{ editorResult.rollGapDI.toFixed(2) }}%</span>
                </div>
                <div class="grid grid-cols-[120px_1fr_auto] items-center gap-3 text-sm">
                  <span class="text-muted-foreground">Piece gap</span>
                  <div class="h-2 overflow-hidden rounded-sm bg-muted">
                    <div
                      class="h-full bg-sky-500"
                      :style="{ width: `${editorResult.opportunityDI ? editorResult.pieceGapDI / editorResult.opportunityDI * 100 : 0}%` }"
                    />
                  </div>
                  <span class="font-medium">{{ editorResult.pieceGapDI.toFixed(2) }}%</span>
                </div>
              </div>
              <p class="text-xs text-muted-foreground">
                Roll gap measures filled lines. Piece gap includes missing lines and non-optimal stats.
              </p>
            </section>

            <section class="grid gap-2">
              <h3 class="text-sm font-semibold">Optimal max-penta benchmark</h3>
              <div class="flex flex-wrap gap-1.5">
                <Badge
                  v-for="stat in selectedSlot.item.Optimal"
                  :key="stat"
                  variant="secondary"
                >
                  {{ stat }}
                </Badge>
              </div>
              <p class="flex items-start gap-1.5 text-xs text-muted-foreground">
                <InfoIcon class="mt-0.5 size-3.5 shrink-0" />
                <span>The best stats may vary by class and build. Use this as a general damage benchmark.</span>
              </p>
            </section>
          </div>
        </div>

        <SheetFooter v-if="!isSharedPreview" class="border-t p-4 sm:flex-row sm:justify-between">
          <Button
            v-if="selectedSlot.entry"
            variant="outline"
            class="text-destructive hover:text-destructive"
            @click="emit('request-delete')"
          >
            <Trash2Icon />
            Delete
          </Button>
          <Button
            class="sm:ml-auto"
            :disabled="!editorResult.eligible"
            @click="saveEditor"
          >
            Save gear piece
          </Button>
        </SheetFooter>
      </template>
    </SheetContent>
  </Sheet>
</template>
