<script setup>
import {
  ArrowLeftIcon,
  CheckIcon,
  ClipboardIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  TrendingUpIcon,
} from '@lucide/vue'
import {
  gearPlanStatusClasses,
  getGearPlanOpportunityStatusClass,
} from '@/features/gear-plan/status-styles.js'

useHead({
  title: 'Planner · LaTale Tools',
})

const gearPlan = useGearPlan()
provideGearPlan(gearPlan)
const planner = reactive(gearPlan)
const appShell = useAppShellContext()
const unregisterHelpHandler = appShell.registerHelpHandler('planner', () => {
  planner.plannerNotesOpen = true
})

onBeforeUnmount(unregisterHelpHandler)

const resetOpen = ref(false)
const deleteOpen = ref(false)

const topPriorityMotionKey = computed(() => {
  const slot = planner.topPriority
  if (!slot) {
    return `empty:${planner.eligibleSlots.length}`
  }

  return [
    slot.id,
    planner.sortMode,
    slot.result.opportunityDI.toFixed(2),
    slot.result.qualityPercent.toFixed(0),
  ].join(':')
})

function confirmReset() {
  planner.resetPlan()
  resetOpen.value = false
}

function confirmDelete() {
  planner.deleteSelectedSlot()
  deleteOpen.value = false
}
</script>

<template>
  <div class="parade-route">
    <Teleport to="#app-shell-utilities">
      <div class="contents">
          <Button
            variant="outline"
            size="sm"
            class="w-28 justify-center"
            :disabled="!planner.eligibleSlots.length"
            :aria-label="planner.shareCopied ? 'Planner link copied' : 'Share plan'"
            @click="planner.copyShareLink"
          >
            <Transition name="motion-swap" mode="out-in">
              <span :key="planner.shareCopied ? 'copied' : 'share'" class="flex items-center gap-2">
                <CheckIcon v-if="planner.shareCopied" data-icon="inline-start" />
                <ClipboardIcon v-else data-icon="inline-start" />
                {{ planner.shareCopied ? 'Copied' : 'Share plan' }}
              </span>
            </Transition>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon" aria-label="Planner actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  :disabled="planner.isSharedPreview || !planner.eligibleSlots.length"
                  variant="destructive"
                  @click="resetOpen = true"
                >
                  <RotateCcwIcon />
                  Reset planner
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>
    </Teleport>

    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ planner.shareCopied ? 'Planner link copied to clipboard.' : '' }}
    </p>
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ planner.saveFeedbackMessage }}
    </p>

    <main
      id="main-content"
      data-route-main="/plan"
      tabindex="-1"
      class="parade-workspace grid gap-4"
    >
        <section
          v-if="planner.isSharedPreview"
          class="flex flex-col gap-3 rounded-lg border border-info-border bg-info-surface p-4 text-info-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex items-start gap-3">
            <ShieldAlertIcon class="mt-0.5 size-5 shrink-0" />
            <div>
              <div class="font-medium">Shared planner preview</div>
              <div class="text-sm opacity-80">Your locally saved entries have not been changed.</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" as-child>
              <NuxtLink to="/plan">
                <ArrowLeftIcon />
                My planner
              </NuxtLink>
            </Button>
            <Button @click="planner.useSharedPlan">Use these entries</Button>
          </div>
        </section>

        <section
          v-if="planner.shareError"
          class="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="flex items-start gap-3">
            <ShieldAlertIcon class="mt-0.5 size-5 shrink-0" />
            <div>
              <div class="font-medium">Could not open shared planner</div>
              <div class="text-sm opacity-80">{{ planner.shareError }}</div>
            </div>
          </div>
          <Button variant="outline" class="self-start sm:self-auto" as-child>
            <NuxtLink to="/plan">
              <ArrowLeftIcon />
              My planner
            </NuxtLink>
          </Button>
        </section>

        <section class="parade-card grid grid-cols-2 gap-3 rounded-[22px] border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(140px,160px))] lg:items-stretch">
          <div class="col-span-2 min-w-0 rounded-2xl border border-info-border bg-info-surface p-4 lg:col-span-1">
            <div class="parade-metric-label">Best next upgrade</div>
            <div class="min-h-28">
              <Transition name="motion-swap" mode="out-in">
                <div v-if="planner.topPriority" :key="topPriorityMotionKey">
                  <HoverCard
                    :open-delay="250"
                    :close-delay="100"
                    :enable-touch="false"
                  >
                    <HoverCardTrigger as-child>
                      <button
                        type="button"
                        class="mt-1 flex max-w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        :class="{ 'motion-feedback': planner.lastSavedSlotId === planner.topPriority.id }"
                        :aria-label="`Edit top priority: ${planner.topPriority.pieceType}`"
                        @click="planner.openEditor(planner.topPriority.id)"
                      >
                        <img class="size-14 shrink-0 rounded-lg bg-surface-inset p-1.5" :src="planner.topPriority.image" alt="">
                        <div class="min-w-0">
                          <div class="truncate text-2xl font-semibold">{{ planner.topPriority.pieceType }}</div>
                          <div class="truncate text-sm text-muted-foreground">{{ planner.topPriority.gearType }}</div>
                        </div>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent
                      side="bottom"
                      align="start"
                      :side-offset="8"
                      :collision-padding="12"
                      class="w-80 p-3"
                    >
                      <GearPlanSlotPreview :slot="planner.topPriority" />
                    </HoverCardContent>
                  </HoverCard>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" :class="gearPlanStatusClasses.opportunity">
                      <TrendingUpIcon class="size-3.5" />
                      <span class="motion-tabular">{{ planner.topPriority.result.opportunityDI.toFixed(2) }}% DI potential</span>
                    </Badge>
                    <span class="text-sm text-muted-foreground">{{ planner.getPrimaryReason(planner.topPriority) }}</span>
                  </div>
                </div>
                <div v-else :key="topPriorityMotionKey">
                  <div class="mt-2 text-2xl font-bold">
                    {{ planner.eligibleSlots.length ? 'No open potential' : 'No ranking yet' }}
                  </div>
                  <div v-if="planner.eligibleSlots.length" class="mt-1 text-sm text-muted-foreground">
                    Entered pieces meet or exceed their curated benchmarks.
                  </div>
                </div>
              </Transition>
            </div>
          </div>

          <div class="parade-metric">
            <div class="parade-metric-label">Ranked</div>
            <div class="parade-metric-value motion-tabular">
              <Transition name="motion-swap" mode="out-in">
                <span :key="planner.eligibleSlots.length" class="block">{{ planner.eligibleSlots.length }} / {{ planner.slotModels.length }}</span>
              </Transition>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">slots with 3+ lines</p>
          </div>
          <div class="parade-metric">
            <div class="parade-metric-label">Loadout quality</div>
            <div class="parade-metric-value motion-tabular">
              <Transition name="motion-swap" mode="out-in">
                <span :key="planner.loadoutQualityPercent.toFixed(0)" class="block">{{ planner.loadoutQualityPercent.toFixed(0) }}%</span>
              </Transition>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">across ranked pieces</p>
          </div>
          <div class="parade-metric hidden lg:block">
            <div class="parade-metric-label">Potential</div>
            <div class="parade-metric-value motion-tabular">
              <Transition name="motion-swap" mode="out-in">
                <span :key="planner.totalOpportunityDI.toFixed(2)" class="block">{{ planner.totalOpportunityDI.toFixed(2) }}%</span>
              </Transition>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">total DI still open</p>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section class="parade-card grid content-start gap-4 rounded-[22px] border bg-card p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold">Upgrade priority</h2>
                <Transition name="motion-swap" mode="out-in">
                  <p :key="planner.sortMode" class="text-sm text-muted-foreground">
                    {{ planner.sortMode === 'impact'
                      ? 'Ranked by damage-impact opportunity.'
                      : 'Lowest loadout quality ranks first.' }}
                  </p>
                </Transition>
              </div>
              <Tabs v-model="planner.sortMode" class="w-auto">
                <TabsList
                  aria-label="Rank upgrade priority"
                >
                  <TabsTrigger value="impact">Impact</TabsTrigger>
                  <TabsTrigger value="quality">Quality</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <GearPlanOpportunityChart />
          </section>

          <section class="parade-card grid content-start gap-4 rounded-[22px] border bg-card p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold">Gear slots</h2>
                <p class="text-sm text-muted-foreground">Select a slot to review or edit it.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                class="w-28 justify-center"
                :disabled="!planner.eligibleSlots.length"
                :aria-label="planner.shareCopied ? 'Planner link copied' : 'Share plan'"
                @click="planner.copyShareLink"
              >
                <Transition name="motion-swap" mode="out-in">
                  <span :key="planner.shareCopied ? 'copied' : 'share'">
                    {{ planner.shareCopied ? 'Copied' : 'Share plan' }}
                  </span>
                </Transition>
              </Button>
            </div>

            <div class="grid gap-5">
              <div v-for="group in planner.categoryGroups" :key="group.gearType" class="grid gap-2">
                <div class="text-xs font-medium uppercase text-muted-foreground">{{ group.gearType }}</div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                  <template v-for="slot in group.slots" :key="slot.id">
                    <HoverCard
                      v-if="slot.result.eligible"
                      :open-delay="250"
                      :close-delay="100"
                      :enable-touch="false"
                    >
                      <HoverCardTrigger as-child>
                        <button
                          type="button"
                          :data-selected="planner.editorOpen && planner.selectedSlot?.id === slot.id"
                          class="grid min-h-24 min-w-0 gap-2 rounded-lg border bg-surface-inset p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[selected=true]:border-primary data-[selected=true]:bg-info-surface"
                          :class="{ 'motion-feedback': planner.lastSavedSlotId === slot.id }"
                          @click="planner.openEditor(slot.id)"
                        >
                          <div class="flex items-start justify-between gap-2">
                            <img class="size-9 rounded-md bg-surface-raised p-1" :src="slot.image" alt="">
                            <Badge
                              variant="outline"
                              :class="getGearPlanOpportunityStatusClass(slot.result.opportunityDI)"
                            >
                              <span class="motion-tabular">{{ slot.result.qualityPercent.toFixed(0) }}%</span>
                            </Badge>
                          </div>
                          <div class="min-w-0">
                            <div class="truncate text-sm font-medium">{{ slot.pieceType }}</div>
                            <div class="truncate text-xs text-muted-foreground">
                              {{ slot.result.opportunityDI <= 0.0001
                                ? `${planner.getLineStatusLabel(slot.result)} / ${slot.result.aboveBenchmark ? 'Above benchmark' : 'At benchmark'}`
                                : `${planner.getLineStatusLabel(slot.result)} / ${slot.result.opportunityDI.toFixed(2)}% DI open` }}
                            </div>
                          </div>
                        </button>
                      </HoverCardTrigger>
                      <HoverCardContent
                        side="left"
                        align="start"
                        :side-offset="8"
                        :collision-padding="12"
                        class="w-80 p-3"
                      >
                        <GearPlanSlotPreview :slot="slot" />
                      </HoverCardContent>
                    </HoverCard>
                    <template v-else>
                      <button
                        type="button"
                        :data-selected="planner.editorOpen && planner.selectedSlot?.id === slot.id"
                        class="grid min-h-24 min-w-0 gap-2 rounded-lg border border-dashed bg-surface-inset/50 p-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[selected=true]:border-primary data-[selected=true]:border-solid data-[selected=true]:bg-info-surface"
                        :class="{ 'motion-feedback': planner.lastSavedSlotId === slot.id }"
                        @click="planner.openEditor(slot.id)"
                      >
                        <div class="flex items-start justify-between gap-2">
                          <img class="size-9 rounded-md bg-surface-raised p-1" :src="slot.image" alt="">
                          <PlusIcon class="size-4 text-muted-foreground" />
                        </div>
                        <div class="min-w-0">
                          <div class="truncate text-sm font-medium">{{ slot.pieceType }}</div>
                        </div>
                      </button>
                    </template>
                  </template>
                </div>
              </div>
            </div>
          </section>
        </div>
    </main>

    <GearPlanEditorSheet @request-delete="deleteOpen = true" />
    <GearPlanNotesDialog />

    <Dialog v-model:open="resetOpen">
        <DialogContent class="rounded-lg">
          <DialogHeader>
            <DialogTitle>Reset planner?</DialogTitle>
            <DialogDescription>This permanently removes every locally saved gear entry.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="resetOpen = false">Cancel</Button>
            <Button variant="destructive" @click="confirmReset">Reset planner</Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteOpen">
        <DialogContent class="rounded-lg">
          <DialogHeader>
            <DialogTitle>Delete this gear entry?</DialogTitle>
            <DialogDescription>The slot will return to its empty state.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="deleteOpen = false">Cancel</Button>
            <Button variant="destructive" @click="confirmDelete">Delete entry</Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  </div>
</template>
