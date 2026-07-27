<script setup>
import { CheckIcon } from '@lucide/vue'
import { cn } from '@/lib/utils.js'
import { formatUpgradeFee, formatUpgradeNumber } from '@/features/upgrade/calculation.js'

const props = defineProps({
  step: {
    type: Object,
    required: true,
  },
})
</script>

<template>
  <div
    :class="cn('upgrade-step-row', props.step.affordable && 'is-affordable')"
    role="group"
    :aria-label="`${props.step.step}: ${formatUpgradeNumber(props.step.material)} material, ${formatUpgradeFee(props.step.feeMillions)}. ${props.step.affordable ? 'Covered by entered inventory.' : 'Not covered by entered inventory.'}`"
  >
    <span class="upgrade-step-node" aria-hidden="true">
      <CheckIcon v-if="props.step.affordable" />
      <span v-else>+{{ props.step.level }}</span>
    </span>

    <div class="min-w-0">
      <div class="flex items-baseline justify-between gap-3">
        <strong class="text-sm">{{ props.step.step }}</strong>
        <span class="motion-tabular shrink-0 text-sm font-semibold">
          {{ formatUpgradeNumber(props.step.material) }}
        </span>
      </div>
      <div class="upgrade-step-bar" aria-hidden="true">
        <span :style="{ width: `${props.step.barPercent}%` }" />
      </div>
      <div class="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
        <span>Enhancement material</span>
        <span class="motion-tabular">Running {{ formatUpgradeNumber(props.step.runningMaterial) }}</span>
      </div>
    </div>

    <div class="upgrade-step-fee">
      <span>Ely fee</span>
      <strong class="motion-tabular">{{ formatUpgradeFee(props.step.feeMillions) }}</strong>
    </div>
  </div>
</template>
