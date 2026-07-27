<script setup>
import { ChevronDownIcon, ChevronUpIcon, RouteIcon } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useUpgradePlannerContext } from '@/features/upgrade/context.js'
import UpgradeStepRow from '@/features/upgrade/components/UpgradeStepRow.vue'

const { selectedItem, plan } = useUpgradePlannerContext()
const expanded = ref(false)
const hasCollapsedSteps = computed(() => plan.value.steps.length > 9)
const firstSteps = computed(() =>
  hasCollapsedSteps.value ? plan.value.steps.slice(0, 5) : plan.value.steps,
)
const middleSteps = computed(() =>
  hasCollapsedSteps.value ? plan.value.steps.slice(5, -2) : [],
)
const lastSteps = computed(() =>
  hasCollapsedSteps.value ? plan.value.steps.slice(-2) : [],
)
const hiddenStepCount = computed(() => middleSteps.value.length)
const planKey = computed(() => [
  selectedItem.value?.value,
  plan.value.currentLevel,
  plan.value.targetLevel,
  plan.value.quantity,
].join(':'))

watch(planKey, () => {
  expanded.value = false
})
</script>

<template>
  <section class="upgrade-journey" aria-labelledby="upgrade-journey-title">
    <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p class="upgrade-kicker">Upgrade journey</p>
        <h3 id="upgrade-journey-title" class="mt-1 flex items-center gap-2 text-lg font-bold tracking-tight">
          <RouteIcon class="size-5 text-primary" />
          Every step in this work order
        </h3>
        <p class="mt-1 text-sm text-muted-foreground">
          Bars compare material cost within this selected range.
        </p>
      </div>
      <Badge variant="outline" class="motion-tabular self-start">
        {{ plan.steps.length }} step{{ plan.steps.length === 1 ? '' : 's' }}
      </Badge>
    </div>

    <Transition name="motion-fade" mode="out-in">
      <Collapsible
        :key="planKey"
        v-model:open="expanded"
        class="mt-5 flex flex-col gap-2"
        role="group"
        aria-label="Upgrade steps"
      >
        <UpgradeStepRow
          v-for="step in firstSteps"
          :key="step.step"
          :step="step"
        />

        <template v-if="hasCollapsedSteps">
          <CollapsibleTrigger as-child>
            <Button variant="ghost" class="upgrade-journey-toggle w-full">
              <ChevronUpIcon v-if="expanded" data-icon="inline-start" />
              <ChevronDownIcon v-else data-icon="inline-start" />
              {{ expanded ? 'Hide middle steps' : `Show ${hiddenStepCount} middle steps` }}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent class="flex flex-col gap-2" role="group">
            <UpgradeStepRow
              v-for="step in middleSteps"
              :key="step.step"
              :step="step"
            />
          </CollapsibleContent>

          <UpgradeStepRow
            v-for="step in lastSteps"
            :key="step.step"
            :step="step"
          />
        </template>
      </Collapsible>
    </Transition>
  </section>
</template>
