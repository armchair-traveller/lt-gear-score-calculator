<script setup>
import {
  ArrowLeftIcon,
  CheckIcon,
  ClipboardIcon,
  InfoIcon,
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

const gearPlan = useGearPlan()
provideGearPlan(gearPlan)
const planner = reactive(gearPlan)

const resetOpen = ref(false)
const deleteOpen = ref(false)

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
  <TooltipProvider>
    <div class="parade-page">
      <AppShellHeader
        active="planner"
        eyebrow="Gear planner"
        title="See which piece earns your effort next."
        description="Rank your final pieces against a shared benchmark without losing sight of the actual gear slots."
        show-help
        @help="planner.plannerNotesOpen = true"
      >
        <template #utilities>
          <Button
            variant="outline"
            size="sm"
            :disabled="!planner.eligibleSlots.length"
            @click="planner.copyShareLink"
          >
            <CheckIcon v-if="planner.shareCopied" data-icon="inline-start" />
            <ClipboardIcon v-else data-icon="inline-start" />
            {{ planner.shareCopied ? 'Copied' : 'Share plan' }}
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
        </template>
      </AppShellHeader>

      <main class="parade-workspace grid gap-4">
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
            <template v-if="planner.topPriority">
              <HoverCard
                :open-delay="250"
                :close-delay="100"
                :enable-touch="false"
              >
                <HoverCardTrigger as-child>
                  <button
                    type="button"
                    class="mt-1 flex max-w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
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
                  {{ planner.topPriority.result.opportunityDI.toFixed(2) }}% DI potential
                </Badge>
                <span class="text-sm text-muted-foreground">{{ planner.getPrimaryReason(planner.topPriority) }}</span>
              </div>
            </template>
            <template v-else>
              <div class="mt-2 text-2xl font-bold">
                {{ planner.eligibleSlots.length ? 'No open potential' : 'No ranking yet' }}
              </div>
              <div v-if="planner.eligibleSlots.length" class="mt-1 text-sm text-muted-foreground">
                Entered pieces meet or exceed their curated benchmarks.
              </div>
            </template>
          </div>

          <div class="parade-metric">
            <div class="parade-metric-label">Ranked</div>
            <div class="parade-metric-value">{{ planner.eligibleSlots.length }} / {{ planner.slotModels.length }}</div>
            <p class="mt-1 text-xs text-muted-foreground">slots with 3+ lines</p>
          </div>
          <div class="parade-metric">
            <div class="parade-metric-label">Loadout quality</div>
            <div class="parade-metric-value">{{ planner.loadoutQualityPercent.toFixed(0) }}%</div>
            <p class="mt-1 text-xs text-muted-foreground">across ranked pieces</p>
          </div>
          <div class="parade-metric hidden lg:block">
            <div class="parade-metric-label">Potential</div>
            <div class="parade-metric-value">{{ planner.totalOpportunityDI.toFixed(2) }}%</div>
            <p class="mt-1 text-xs text-muted-foreground">total DI still open</p>
          </div>
        </section>

        <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section class="parade-card grid content-start gap-4 rounded-[22px] border bg-card p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-lg font-bold">Upgrade priority</h2>
                <p class="text-sm text-muted-foreground">Ranked by damage-impact opportunity.</p>
              </div>
              <Tabs v-model="planner.sortMode" class="w-auto">
                <TabsList>
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
              <Button variant="outline" size="sm" :disabled="!planner.eligibleSlots.length" @click="planner.copyShareLink">Share plan</Button>
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
                          @click="planner.openEditor(slot.id)"
                        >
                          <div class="flex items-start justify-between gap-2">
                            <img class="size-9 rounded-md bg-surface-raised p-1" :src="slot.image" alt="">
                            <Badge
                              variant="outline"
                              :class="getGearPlanOpportunityStatusClass(slot.result.opportunityDI)"
                            >
                              {{ slot.result.qualityPercent.toFixed(0) }}%
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
  </TooltipProvider>
</template>
