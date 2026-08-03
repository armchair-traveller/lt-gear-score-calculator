<script setup>
import { useMediaQuery } from '@vueuse/core'
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleAlertIcon,
  ClipboardIcon,
  CloudDownloadIcon,
  CloudIcon,
  CloudUploadIcon,
  LaptopIcon,
  LoaderCircleIcon,
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
const route = useRoute()
const {
  isSignedIn,
  isAccountUnavailable,
  signInWithDiscord,
  refreshSession,
} = useAuth()
const unregisterHelpHandler = appShell.registerHelpHandler('planner', () => {
  planner.plannerNotesOpen = true
})

onBeforeUnmount(unregisterHelpHandler)

const resetOpen = ref(false)
const deleteOpen = ref(false)
const conflictOpen = ref(false)
const sharedAdoptionOpen = ref(false)
const hoverCardsEnabled = useMediaQuery('(hover: hover) and (pointer: fine) and (min-width: 768px)')

const sharedEntryCount = computed(() =>
  Object.keys(planner.displayedPlan?.slots ?? {}).length,
)

const sharedAdoptionDescription = computed(() => {
  const destination = isSignedIn.value
    ? 'on this device and across your signed-in devices'
    : 'on this device'

  return `This replaces ${formatEntryCount(planner.entryCount)} in your current planner ${destination} with ${formatEntryCount(sharedEntryCount.value)} from the shared link.`
})

const shareButtonText = computed(() => {
  if (planner.sharePending) {
    return 'Creating link…'
  }
  if (planner.shareCopied) {
    return 'Copied'
  }
  if (planner.shareFailed) {
    return 'Try again'
  }
  return planner.shareUsesPublicBuild ? 'Share build' : 'Share plan'
})

const shareButtonAriaLabel = computed(() => {
  if (planner.sharePending) {
    return 'Creating public build link'
  }
  if (planner.shareCopied) {
    return 'Build link copied'
  }
  if (planner.shareFailed) {
    return 'Retry sharing build'
  }
  return planner.shareUsesPublicBuild
    ? 'Share live public build'
    : 'Copy planner snapshot link'
})

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

watch(
  () => planner.syncStatus,
  (status) => {
    if (status === 'conflict') {
      conflictOpen.value = true
      return
    }

    conflictOpen.value = false
  },
  { immediate: true },
)

function startCloudSignIn() {
  void signInWithDiscord(route.fullPath)
}

function retryCloudSave() {
  if (isAccountUnavailable.value) {
    void refreshSession()
    return
  }

  planner.retry()
}

function keepDevicePlan() {
  planner.replaceCloudWithDevice()
  conflictOpen.value = false
}

function useCloudPlan() {
  planner.useCloudPlan()
  conflictOpen.value = false
}

function requestSharedAdoption() {
  if (Number(planner.entryCount) > 0) {
    sharedAdoptionOpen.value = true
    return
  }

  planner.useSharedPlan()
}

function confirmSharedAdoption() {
  if (planner.useSharedPlan()) {
    sharedAdoptionOpen.value = false
  }
}

function formatEntryCount(value) {
  const count = Math.max(0, Number(value) || 0)
  return `${count} gear ${count === 1 ? 'entry' : 'entries'}`
}

function formatSyncTimestamp(value) {
  if (!value) {
    return 'Update time unavailable'
  }

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Update time unavailable'
  }

  return `Updated ${new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)}`
}

function confirmReset() {
  if (planner.resetPlan()) {
    resetOpen.value = false
  }
}

function confirmDelete() {
  if (planner.deleteSelectedSlot()) {
    deleteOpen.value = false
  }
}
</script>

<template>
  <div class="parade-route">
    <Teleport to="#app-shell-utilities">
      <div class="contents">
          <GearPlanSyncControl
            :status="isAccountUnavailable ? 'paused' : planner.syncStatus"
            :pause-reason="isAccountUnavailable ? 'cloud' : planner.pauseReason"
            @open-conflict="conflictOpen = true"
            @retry="retryCloudSave"
            @sign-in="startCloudSignIn"
          />
          <Button
            variant="outline"
            size="sm"
            class="w-32 justify-center"
            :disabled="!planner.canCopyShareLink"
            :aria-label="shareButtonAriaLabel"
            @click="planner.copyShareLink"
          >
            <Transition name="motion-swap" mode="out-in">
              <span :key="shareButtonText" class="flex items-center gap-2">
                <LoaderCircleIcon v-if="planner.sharePending" class="animate-spin" data-icon="inline-start" />
                <CheckIcon v-else-if="planner.shareCopied" data-icon="inline-start" />
                <CircleAlertIcon v-else-if="planner.shareFailed" data-icon="inline-start" />
                <ClipboardIcon v-else-if="!planner.sharePending" data-icon="inline-start" />
                {{ shareButtonText }}
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
                  :disabled="!planner.eligibleSlots.length"
                  @select="planner.copySnapshotLink"
                >
                  <CheckIcon v-if="planner.snapshotCopied" />
                  <ClipboardIcon v-else />
                  {{ planner.snapshotCopied ? 'Snapshot link copied' : 'Copy snapshot link' }}
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
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
      {{ planner.shareCopied
        ? (planner.shareUsesPublicBuild ? 'Public build link copied to clipboard.' : 'Planner snapshot link copied to clipboard.')
        : planner.shareFailed
          ? 'Could not copy the build link. Try again.'
          : '' }}
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
              <div class="text-sm opacity-80">Your planner has not been changed.</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" as-child>
              <NuxtLink to="/plan">
                <ArrowLeftIcon />
                My planner
              </NuxtLink>
            </Button>
            <Button @click="requestSharedAdoption">Use these entries</Button>
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
                    :open="planner.editorOpen || !hoverCardsEnabled ? false : undefined"
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
            <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div class="flex items-start justify-between gap-3 md:block">
                <div>
                  <h2 class="text-lg font-bold">Gear slots</h2>
                  <p class="text-sm text-muted-foreground">Select a slot to review or edit it.</p>
                </div>
                <GearPlanSyncControl
                  class="md:hidden"
                  :status="isAccountUnavailable ? 'paused' : planner.syncStatus"
                  :pause-reason="isAccountUnavailable ? 'cloud' : planner.pauseReason"
                  @open-conflict="conflictOpen = true"
                  @retry="retryCloudSave"
                  @sign-in="startCloudSignIn"
                />
              </div>
              <div class="flex w-full flex-wrap items-center justify-end gap-2 md:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  class="w-32 justify-center"
                  :disabled="!planner.canCopyShareLink"
                  :aria-label="shareButtonAriaLabel"
                  @click="planner.copyShareLink"
                >
                  <Transition name="motion-swap" mode="out-in">
                    <span :key="shareButtonText" class="flex items-center gap-2">
                      <LoaderCircleIcon v-if="planner.sharePending" class="animate-spin" data-icon="inline-start" />
                      <CheckIcon v-else-if="planner.shareCopied" data-icon="inline-start" />
                      <CircleAlertIcon v-else-if="planner.shareFailed" data-icon="inline-start" />
                      <ClipboardIcon v-else data-icon="inline-start" />
                      {{ shareButtonText }}
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
                        :disabled="!planner.eligibleSlots.length"
                        @select="planner.copySnapshotLink"
                      >
                        <CheckIcon v-if="planner.snapshotCopied" />
                        <ClipboardIcon v-else />
                        {{ planner.snapshotCopied ? 'Snapshot link copied' : 'Copy snapshot link' }}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
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
            </div>

            <div class="grid gap-5">
              <div v-for="group in planner.categoryGroups" :key="group.gearType" class="grid gap-2">
                <div class="text-xs font-medium uppercase text-muted-foreground">{{ group.gearType }}</div>
                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                  <template v-for="slot in group.slots" :key="slot.id">
                    <HoverCard
                      v-if="slot.result.eligible"
                      :open="planner.editorOpen || !hoverCardsEnabled ? false : undefined"
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

    <Dialog v-model:open="conflictOpen">
      <DialogContent class="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-lg sm:max-w-2xl">
        <DialogHeader class="pr-8">
          <DialogTitle>Choose which planner to keep</DialogTitle>
          <DialogDescription>
            We found different planners on this device and in your cloud account. Nothing will be overwritten until you choose.
          </DialogDescription>
        </DialogHeader>

        <div class="grid gap-3 sm:grid-cols-2">
          <Card size="sm" class="flex h-full flex-col">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <LaptopIcon class="size-4" />
                This device
              </CardTitle>
              <CardDescription>Keep the planner currently open in this browser.</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-1 flex-col gap-2">
              <Badge variant="secondary" class="self-start">
                {{ formatEntryCount(planner.conflict?.device?.entryCount) }}
              </Badge>
              <p class="text-sm text-muted-foreground">
                {{ formatSyncTimestamp(planner.conflict?.device?.updatedAt) }}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                class="h-auto w-full whitespace-normal py-2 text-center"
                @click="keepDevicePlan"
              >
                <CloudUploadIcon data-icon="inline-start" />
                Replace cloud with this device
              </Button>
            </CardFooter>
          </Card>

          <Card size="sm" class="flex h-full flex-col">
            <CardHeader>
              <CardTitle class="flex items-center gap-2">
                <CloudIcon class="size-4" />
                Cloud copy
              </CardTitle>
              <CardDescription>Replace this browser's planner with the account copy.</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-1 flex-col gap-2">
              <Badge variant="secondary" class="self-start">
                {{ formatEntryCount(planner.conflict?.cloud?.entryCount) }}
              </Badge>
              <p class="text-sm text-muted-foreground">
                {{ formatSyncTimestamp(planner.conflict?.cloud?.updatedAt) }}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                class="h-auto w-full whitespace-normal py-2 text-center"
                @click="useCloudPlan"
              >
                <CloudDownloadIcon data-icon="inline-start" />
                Use cloud plan
              </Button>
            </CardFooter>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="ghost" @click="conflictOpen = false">Decide later</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="sharedAdoptionOpen">
      <DialogContent class="rounded-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace your planner with these entries?</DialogTitle>
          <DialogDescription>{{ sharedAdoptionDescription }}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="sharedAdoptionOpen = false">Cancel</Button>
          <Button @click="confirmSharedAdoption">Replace planner</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="resetOpen">
        <DialogContent class="rounded-lg">
          <DialogHeader>
            <DialogTitle>Reset planner?</DialogTitle>
            <DialogDescription>
              {{ isSignedIn
                ? 'This permanently removes every gear entry from your planner across signed-in devices.'
                : 'This permanently removes every gear entry saved on this device.' }}
            </DialogDescription>
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
            <DialogDescription>
              {{ isSignedIn
                ? 'The slot will return to its empty state across signed-in devices.'
                : 'The slot will return to its empty state on this device.' }}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" @click="deleteOpen = false">Cancel</Button>
            <Button variant="destructive" @click="confirmDelete">Delete entry</Button>
          </DialogFooter>
        </DialogContent>
    </Dialog>
  </div>
</template>
