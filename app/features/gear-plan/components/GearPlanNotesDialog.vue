<script setup>
import {
  BarChart3Icon,
  CheckCircle2Icon,
  ListPlusIcon,
  MousePointerClickIcon,
  ShieldAlertIcon,
  SparklesIcon,
} from '@lucide/vue'

const {
  plannerNotesOpen,
  acceptPlannerNotes,
} = useGearPlanContext()

const steps = [
  {
    icon: MousePointerClickIcon,
    title: 'Choose a gear slot',
    text: 'Open any slot from the list, then select the stats on your actual piece.',
  },
  {
    icon: ListPlusIcon,
    title: 'Enter final values',
    text: 'Use the values shown after the piece is fully upgraded. Three filled lines are required for ranking; all five count as penta.',
  },
  {
    icon: BarChart3Icon,
    title: 'Save and compare',
    text: 'Save each piece, then use Impact to prioritize total DI gain or Quality to find the weakest piece relative to its benchmark.',
  },
]
</script>

<template>
  <Dialog v-model:open="plannerNotesOpen">
    <DialogContent class="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Planner notes</DialogTitle>
        <DialogDescription>
          Compare your final gear and find the upgrades with the most open damage potential.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-5 text-sm">
        <ol class="grid gap-4 sm:grid-cols-3">
          <li
            v-for="(step, index) in steps"
            :key="step.title"
            class="grid content-start gap-2 border-t pt-3"
          >
            <div class="flex items-center gap-2 font-medium">
              <span class="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-inset text-xs">
                {{ index + 1 }}
              </span>
              <component :is="step.icon" class="size-4 text-muted-foreground" />
              <span>{{ step.title }}</span>
            </div>
            <p class="leading-5 text-muted-foreground">{{ step.text }}</p>
          </li>
        </ol>

        <section class="grid gap-2">
          <h3 class="font-medium">Reading the planner</h3>
          <dl class="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            <div>
              <dt class="font-medium">Current DI</dt>
              <dd class="mt-0.5 leading-5 text-muted-foreground">Estimated damage impact from the final values you entered.</dd>
            </div>
            <div>
              <dt class="font-medium">Potential</dt>
              <dd class="mt-0.5 leading-5 text-muted-foreground">The open DI between your piece and its curated optimal max-penta benchmark.</dd>
            </div>
            <div>
              <dt class="font-medium text-warning-foreground">Roll gap</dt>
              <dd class="mt-0.5 leading-5 text-muted-foreground">Potential gained by improving the values of your selected stats.</dd>
            </div>
            <div>
              <dt class="font-medium text-info-foreground">Piece gap</dt>
              <dd class="mt-0.5 leading-5 text-muted-foreground">Potential from missing lines or replacing non-optimal stats.</dd>
            </div>
            <div>
              <dt class="font-medium">Best next</dt>
              <dd class="mt-0.5 leading-5 text-muted-foreground">The ranked piece with the highest open DI potential.</dd>
            </div>
            <div>
              <dt class="font-medium">Quality</dt>
              <dd class="mt-0.5 leading-5 text-muted-foreground">Your current DI as a percentage of the benchmark for that slot.</dd>
            </div>
          </dl>
        </section>

        <section class="grid gap-2 border-t pt-4">
          <p class="flex items-start gap-2 leading-5 text-muted-foreground">
            <SparklesIcon class="mt-0.5 size-4 shrink-0" />
            <span>The optimal max-penta benchmark is a general damage target. The best stats can vary by class, build, and content.</span>
          </p>
          <p class="flex items-start gap-2 leading-5 text-muted-foreground">
            <ShieldAlertIcon class="mt-0.5 size-4 shrink-0" />
            <span>Shared planner previews are read-only until you choose <strong class="font-medium text-foreground">Use these entries</strong>.</span>
          </p>
        </section>
      </div>

      <DialogFooter>
        <Button @click="acceptPlannerNotes">
          <CheckCircle2Icon />
          Got it
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
