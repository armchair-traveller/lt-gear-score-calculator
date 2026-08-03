<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  CheckIcon,
  CircleAlertIcon,
  ClipboardIcon,
  GaugeIcon,
  TargetIcon,
  TrendingUpIcon,
} from '@lucide/vue'
import { getGearPlanEntryCalculatorPath } from '@/features/gear-plan/gear-share-url.js'

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  slot: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:open'])
const copyStatus = ref('idle')
let copyTimeout

const calculatorPath = computed(() =>
  getGearPlanEntryCalculatorPath(props.slot),
)

watch(
  () => props.slot?.id,
  () => setCopyStatus('idle'),
)

async function copyCalculatorLink() {
  if (!calculatorPath.value) {
    setCopyStatus('failed')
    return
  }

  try {
    const url = new URL(calculatorPath.value, window.location.origin).toString()
    await navigator.clipboard.writeText(url)
    setCopyStatus('copied')
  }
  catch {
    setCopyStatus('failed')
  }
}

function setCopyStatus(status) {
  clearTimeout(copyTimeout)
  copyStatus.value = status
  if (status !== 'idle') {
    copyTimeout = setTimeout(() => {
      copyStatus.value = 'idle'
    }, 1800)
  }
}

onBeforeUnmount(() => clearTimeout(copyTimeout))
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent
      side="right"
      class="gap-0 p-0 data-[side=right]:!w-full sm:data-[side=right]:!max-w-none md:data-[side=right]:!w-[520px]"
    >
      <template v-if="slot">
        <SheetHeader class="border-b bg-surface-raised px-5 py-4 pr-14">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-warning-border bg-warning-surface">
              <img class="size-10" :src="slot.image" alt="">
            </span>
            <div class="min-w-0">
              <SheetTitle class="truncate">{{ slot.pieceType }}</SheetTitle>
              <SheetDescription>{{ slot.gearType }} · Read-only build details</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div class="min-h-0 flex-1 overflow-y-auto bg-surface">
          <div class="grid gap-5 p-4 sm:p-5">
            <div class="grid grid-cols-3 gap-2">
              <div class="parade-metric p-3">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <GaugeIcon class="size-3.5" />
                  Current DI
                </div>
                <div class="motion-tabular mt-1 text-xl font-semibold">
                  {{ slot.result.currentDI.toFixed(2) }}%
                </div>
              </div>
              <div class="parade-metric p-3">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <TargetIcon class="size-3.5" />
                  Quality
                </div>
                <div class="motion-tabular mt-1 text-xl font-semibold">
                  {{ slot.result.qualityPercent.toFixed(0) }}%
                </div>
              </div>
              <div class="rounded-2xl border border-warning-border bg-warning-surface p-3">
                <div class="flex items-center gap-2 text-xs text-muted-foreground">
                  <TrendingUpIcon class="size-3.5" />
                  Potential
                </div>
                <div class="motion-tabular mt-1 text-xl font-semibold">
                  {{ slot.result.opportunityDI.toFixed(2) }}%
                </div>
              </div>
            </div>

            <GearPlanSlotPreview :slot="slot" :show-summary="false" />
          </div>
        </div>

        <SheetFooter class="border-t bg-surface-raised p-4 sm:flex-row sm:justify-end">
          <Button
            v-if="calculatorPath"
            type="button"
            variant="outline"
            :aria-label="copyStatus === 'copied'
              ? 'Calculator link copied'
              : copyStatus === 'failed'
                ? 'Retry copying calculator link'
                : `Copy ${slot.pieceType} calculator link`"
            @click="copyCalculatorLink"
          >
            <CheckIcon v-if="copyStatus === 'copied'" data-icon="inline-start" />
            <CircleAlertIcon v-else-if="copyStatus === 'failed'" data-icon="inline-start" />
            <ClipboardIcon v-else data-icon="inline-start" />
            {{ copyStatus === 'copied'
              ? 'Link copied'
              : copyStatus === 'failed'
                ? 'Try copying again'
                : 'Copy calculator link' }}
          </Button>
          <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {{ copyStatus === 'copied'
              ? `${slot.pieceType} calculator link copied.`
              : copyStatus === 'failed'
                ? 'Could not copy the calculator link.'
                : '' }}
          </p>
        </SheetFooter>
      </template>
      <template v-else>
        <SheetHeader>
          <SheetTitle>Gear details</SheetTitle>
          <SheetDescription>No gear piece is selected.</SheetDescription>
        </SheetHeader>
      </template>
    </SheetContent>
  </Sheet>
</template>
