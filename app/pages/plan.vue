<script setup>
import {
  ArrowLeftIcon,
  CalculatorIcon,
  CheckIcon,
  ClipboardIcon,
  InfoIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  TrendingUpIcon,
} from '@lucide/vue'

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
    <div class="min-h-screen bg-background text-foreground">
      <header class="bg-background/95 backdrop-blur shadow-[0_1px_12px_rgb(15_23_42_/_0.04)] dark:shadow-none">
        <div class="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/55">
              <img class="size-11" src="/smart_priring.png" alt="">
            </div>
            <div class="min-w-0">
              <h1 class="truncate text-lg font-semibold tracking-normal md:text-xl">Planner</h1>
              <p class="truncate text-xs text-muted-foreground">
                Final gear / optimal max-penta potential
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <ModeToggle />

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="outline" size="icon" as-child>
                  <NuxtLink :to="planner.homeHref">
                    <CalculatorIcon />
                    <span class="sr-only">Open gear score calculator</span>
                  </NuxtLink>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gear score calculator</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="outline" size="icon" as-child>
                  <NuxtLink :to="planner.upgradeHref">
                    <img class="size-5" src="/cool_priring.png" alt="">
                    <span class="sr-only">Open upgrade material calculator</span>
                  </NuxtLink>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upgrade calculator</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  variant="outline"
                  size="icon"
                  :disabled="!planner.eligibleSlots.length"
                  @click="planner.copyShareLink"
                >
                  <CheckIcon v-if="planner.shareCopied" class="text-emerald-600 dark:text-emerald-400" />
                  <ClipboardIcon v-else />
                  <span class="sr-only">Copy planner link</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{{ planner.shareCopied ? 'Copied' : 'Copy planner link' }}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button variant="outline" size="icon" @click="planner.plannerNotesOpen = true">
                  <InfoIcon />
                  <span class="sr-only">Open planner notes</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Planner notes</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button variant="outline" size="icon">
                  <MoreHorizontalIcon />
                  <span class="sr-only">More planner actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  :disabled="planner.isSharedPreview || !planner.eligibleSlots.length"
                  variant="destructive"
                  @click="resetOpen = true"
                >
                  <RotateCcwIcon />
                  Reset planner
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main class="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-5 md:px-6">
        <section
          v-if="planner.isSharedPreview"
          class="flex flex-col gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100 sm:flex-row sm:items-center sm:justify-between"
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

        <section class="grid gap-4 border-b pb-6 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(140px,190px))] lg:items-end">
          <div class="min-w-0">
            <div class="text-sm text-muted-foreground">Best next</div>
            <template v-if="planner.topPriority">
              <button
                type="button"
                class="mt-1 flex max-w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                @click="planner.openEditor(planner.topPriority.id)"
              >
                <img class="size-14 shrink-0 rounded-lg bg-muted p-1.5" :src="planner.topPriority.image" alt="">
                <div class="min-w-0">
                  <div class="truncate text-2xl font-semibold">{{ planner.topPriority.pieceType }}</div>
                  <div class="truncate text-sm text-muted-foreground">{{ planner.topPriority.gearType }}</div>
                </div>
              </button>
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" class="bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <TrendingUpIcon class="size-3.5" />
                  {{ planner.topPriority.result.opportunityDI.toFixed(2) }}% DI potential
                </Badge>
                <span class="text-sm text-muted-foreground">{{ planner.getPrimaryReason(planner.topPriority) }}</span>
              </div>
            </template>
            <template v-else>
              <div class="mt-1 text-2xl font-semibold">
                {{ planner.eligibleSlots.length ? 'No open potential' : 'No ranking yet' }}
              </div>
              <div v-if="planner.eligibleSlots.length" class="mt-1 text-sm text-muted-foreground">
                Entered pieces meet or exceed their curated benchmarks.
              </div>
            </template>
          </div>

          <div class="rounded-lg bg-muted/20 p-4">
            <div class="text-xs text-muted-foreground">Ranked</div>
            <div class="mt-1 text-2xl font-semibold">{{ planner.eligibleSlots.length }} / {{ planner.slotModels.length }}</div>
          </div>
          <div class="rounded-lg bg-muted/20 p-4">
            <div class="text-xs text-muted-foreground">Loadout quality</div>
            <div class="mt-1 text-2xl font-semibold">{{ planner.loadoutQualityPercent.toFixed(0) }}%</div>
          </div>
          <div class="rounded-lg bg-muted/20 p-4">
            <div class="text-xs text-muted-foreground">Potential</div>
            <div class="mt-1 text-2xl font-semibold">{{ planner.totalOpportunityDI.toFixed(2) }}%</div>
          </div>
        </section>

        <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
          <section class="grid content-start gap-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold">Potential ranking</h2>
                <p class="text-sm text-muted-foreground">Fully upgraded optimal max-penta benchmark</p>
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

          <section class="grid content-start gap-4">
            <div>
              <h2 class="text-base font-semibold">Gear slots</h2>
              <p class="text-sm text-muted-foreground">Latest {{ planner.slotModels.length }} pieces</p>
            </div>

            <div class="grid gap-5">
              <div v-for="group in planner.categoryGroups" :key="group.gearType" class="grid gap-2">
                <div class="text-xs font-medium uppercase text-muted-foreground">{{ group.gearType }}</div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                  <button
                    v-for="slot in group.slots"
                    :key="slot.id"
                    type="button"
                    class="grid min-h-24 gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    :class="slot.result.eligible ? 'bg-muted/15' : 'border-dashed'"
                    @click="planner.openEditor(slot.id)"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <img class="size-9 rounded-md bg-muted p-1" :src="slot.image" alt="">
                      <Badge
                        v-if="slot.result.eligible"
                        variant="outline"
                        :class="slot.result.opportunityDI <= 0.0001
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'"
                      >
                        {{ slot.result.qualityPercent.toFixed(0) }}%
                      </Badge>
                      <PlusIcon v-else class="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div class="truncate text-sm font-medium">{{ slot.pieceType }}</div>
                      <div v-if="slot.result.eligible" class="truncate text-xs text-muted-foreground">
                        {{ slot.result.opportunityDI <= 0.0001
                          ? `${planner.getLineStatusLabel(slot.result)} / ${slot.result.aboveBenchmark ? 'Above benchmark' : 'At benchmark'}`
                          : `${planner.getLineStatusLabel(slot.result)} / ${slot.result.opportunityDI.toFixed(2)}% DI open` }}
                      </div>
                    </div>
                  </button>
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
