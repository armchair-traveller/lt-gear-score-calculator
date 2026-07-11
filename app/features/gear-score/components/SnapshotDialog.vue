<script setup>
import {
  CheckIcon,
  ClipboardIcon,
  DownloadIcon,
  ExpandIcon,
  LinkIcon,
  LoaderCircleIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  Share2Icon,
} from '@lucide/vue'

const {
  gearType,
  pieceType,
  resultMode,
  statType,
  statInput,
  snapshotOpen,
  snapshotImageUrl,
  snapshotIsGenerating,
  snapshotError,
  snapshotCopySucceeded,
  snapshotDownloadSucceeded,
  snapshotShareSucceeded,
  snapshotCanShare,
  snapshotCanCopy,
  snapshotExportAction,
  results,
  hasSnapshotProjection,
  hasRolledValue,
  supportsInputEnchantLevel,
  getInputEnchantLevelNumber,
  refreshSnapshot,
  copySnapshot,
  downloadSnapshot,
  shareSnapshot,
  generateURL,
  getLineScoreText,
  getPotentialLineText,
} = useGearScoreCalculatorContext()

const snapshotLinkError = ref('')
const snapshotLinkCopied = ref(false)
let snapshotLinkCopiedTimeout = null

watch(snapshotOpen, (isOpen) => {
  if (isOpen) {
    snapshotLinkError.value = ''
    snapshotLinkCopied.value = false
    clearTimeout(snapshotLinkCopiedTimeout)
  }
})

onUnmounted(() => clearTimeout(snapshotLinkCopiedTimeout))

const filledLineIndexes = computed(() =>
  statType.value
    .map((_, index) => index)
    .filter((index) => hasRolledValue(index)),
)

const hasProjection = computed(() => hasSnapshotProjection())
const metricName = computed(() => resultMode.value === 'rating' ? 'rating' : 'score')
const itemName = computed(() =>
  gearType.value.toLowerCase().includes(pieceType.value.toLowerCase())
    ? gearType.value
    : `${gearType.value} · ${pieceType.value}`,
)

const snapshotAlt = computed(() => {
  const currentLevel = supportsInputEnchantLevel(gearType.value)
    ? ` at Lv.${getInputEnchantLevelNumber(gearType.value)}`
    : ''
  const currentValue = resultMode.value === 'rating'
    ? `${results.value.DI}% rating`
    : `${results.value.percent}% score and tier ${results.value.tier}`

  if (!hasProjection.value) {
    return `${itemName.value} snapshot with a current ${currentValue}${currentLevel}.`
  }

  const projectedValue = resultMode.value === 'rating'
    ? `${results.value.potentialDI} rating`
    : `${results.value.potentialScore} score and tier ${results.value.potentialTier}`
  return `${itemName.value} snapshot comparing a current ${currentValue}${currentLevel} with an estimated ${projectedValue}.`
})

const actionStatus = computed(() => {
  if (snapshotShareSucceeded.value) {
    return 'Image shared.'
  }
  if (snapshotCopySucceeded.value) {
    return 'Image copied to clipboard.'
  }
  if (snapshotDownloadSucceeded.value) {
    return 'PNG saved.'
  }
  if (snapshotLinkCopied.value) {
    return 'Input link copied.'
  }
  return ''
})

function getProjectedLineValue(index) {
  const line = results.value.individual[index]
  return line.potentialMin === line.potentialMax
    ? line.potentialMin
    : `${line.potentialMin} to ${line.potentialMax}`
}

async function copyInputLink() {
  snapshotLinkError.value = ''
  snapshotLinkCopied.value = false
  const copiedState = await generateURL()
  if (!copiedState) {
    snapshotLinkError.value = 'Could not copy the input link. Check clipboard access and try again.'
    return
  }

  clearTimeout(snapshotLinkCopiedTimeout)
  snapshotLinkCopied.value = true
  snapshotLinkCopiedTimeout = setTimeout(() => {
    snapshotLinkCopied.value = false
  }, 1800)
}
</script>

<template>
  <Dialog v-model:open="snapshotOpen">
    <DialogContent
      class="max-h-[calc(100dvh-1rem)] grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-0 overflow-hidden p-0 sm:!max-w-4xl"
    >
      <DialogHeader class="px-5 py-4 pr-16 sm:px-6 sm:pr-16">
        <DialogTitle>Share snapshot</DialogTitle>
        <DialogDescription class="truncate">
          Item data · no account details
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 min-w-0 overflow-y-auto p-2 sm:p-4">
        <div class="grid place-items-center overflow-hidden rounded-lg border bg-surface-inset p-2 sm:p-5">
          <div
            v-if="snapshotIsGenerating"
            class="flex min-h-56 flex-col items-center justify-center gap-2 text-center text-muted-foreground sm:min-h-[520px]"
            role="status"
            aria-live="polite"
          >
            <LoaderCircleIcon class="size-6 animate-spin" aria-hidden="true" />
            <p>Preparing snapshot…</p>
          </div>

          <a
            v-else-if="snapshotImageUrl"
            class="relative mx-auto block max-w-full cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            :href="snapshotImageUrl"
            target="_blank"
            rel="noreferrer"
            aria-label="Open snapshot full size"
            title="Open snapshot full size"
          >
            <img
              class="max-h-[calc(100dvh-12rem)] w-auto max-w-full rounded-lg object-contain"
              :src="snapshotImageUrl"
              :alt="snapshotAlt"
              aria-describedby="snapshot-details"
            >
            <span
              class="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-surface-raised/90 text-muted-foreground shadow-sm sm:hidden"
              aria-hidden="true"
            >
              <ExpandIcon class="size-4" />
            </span>
          </a>

          <div
            v-else
            class="flex min-h-56 max-w-sm flex-col items-center justify-center gap-3 text-center sm:min-h-[520px]"
            :role="snapshotError ? 'alert' : undefined"
          >
            <div>
              <p class="font-medium">Preview unavailable</p>
              <p class="mt-1 text-sm text-muted-foreground">
                {{ snapshotError || 'Try preparing the snapshot again.' }}
              </p>
            </div>
            <Button variant="outline" size="sm" @click="refreshSnapshot">
              <RefreshCwIcon data-icon="inline-start" />
              Try again
            </Button>
          </div>

          <div id="snapshot-details" class="sr-only">
            <ul>
              <li v-for="index in filledLineIndexes" :key="`snapshot-summary-${index}`">
                {{ statType[index] }}: roll {{ statInput[index] }}, current {{ metricName }} {{ getLineScoreText(index) }}<template v-if="hasProjection">,
                  estimated roll after upgrade {{ getProjectedLineValue(index) }},
                  estimated {{ metricName }} {{ getPotentialLineText(index) }}</template>.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <Separator />

      <DialogFooter class="flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p
          v-if="snapshotLinkError || (snapshotError && snapshotImageUrl)"
          class="w-full text-sm text-destructive sm:min-w-0 sm:flex-1"
          role="alert"
        >
          {{ snapshotLinkError || snapshotError }}
        </p>
        <span v-else class="hidden sm:block sm:flex-1" aria-hidden="true" />

        <ButtonGroup class="w-full sm:w-auto" aria-label="Snapshot actions">
          <Button
            v-if="snapshotCanShare"
            class="flex-1 sm:flex-none"
            :disabled="snapshotIsGenerating || !snapshotImageUrl || Boolean(snapshotExportAction)"
            @click="shareSnapshot"
          >
            <LoaderCircleIcon v-if="snapshotExportAction === 'share'" class="animate-spin" data-icon="inline-start" />
            <CheckIcon v-else-if="snapshotShareSucceeded" data-icon="inline-start" />
            <Share2Icon v-else data-icon="inline-start" />
            {{ snapshotExportAction === 'share' ? 'Sharing…' : snapshotShareSucceeded ? 'Shared' : 'Share image' }}
          </Button>

          <Button
            v-else-if="snapshotCanCopy"
            class="flex-1 sm:flex-none"
            :disabled="snapshotIsGenerating || !snapshotImageUrl || Boolean(snapshotExportAction)"
            @click="copySnapshot"
          >
            <LoaderCircleIcon v-if="snapshotExportAction === 'copy'" class="animate-spin" data-icon="inline-start" />
            <CheckIcon v-else-if="snapshotCopySucceeded" data-icon="inline-start" />
            <ClipboardIcon v-else data-icon="inline-start" />
            {{ snapshotExportAction === 'copy' ? 'Copying…' : snapshotCopySucceeded ? 'Copied' : 'Copy image' }}
          </Button>

          <Button
            v-else
            class="flex-1 sm:flex-none"
            :disabled="snapshotIsGenerating || !snapshotImageUrl || Boolean(snapshotExportAction)"
            @click="downloadSnapshot"
          >
            <LoaderCircleIcon v-if="snapshotExportAction === 'download'" class="animate-spin" data-icon="inline-start" />
            <CheckIcon v-else-if="snapshotDownloadSucceeded" data-icon="inline-start" />
            <DownloadIcon v-else data-icon="inline-start" />
            {{ snapshotExportAction === 'download' ? 'Saving…' : snapshotDownloadSucceeded ? 'Saved' : 'Save PNG' }}
          </Button>

          <Button
            v-if="snapshotCanShare || snapshotCanCopy"
            variant="outline"
            :disabled="snapshotIsGenerating || !snapshotImageUrl || Boolean(snapshotExportAction)"
            @click="downloadSnapshot"
          >
            <LoaderCircleIcon v-if="snapshotExportAction === 'download'" class="animate-spin" data-icon="inline-start" />
            <CheckIcon v-else-if="snapshotDownloadSucceeded" data-icon="inline-start" />
            {{ snapshotExportAction === 'download' ? 'Saving…' : snapshotDownloadSucceeded ? 'Saved' : 'Save PNG' }}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="outline"
                size="icon"
                :disabled="snapshotIsGenerating || !snapshotImageUrl || Boolean(snapshotExportAction)"
                aria-label="More snapshot actions"
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem v-if="snapshotCanShare && snapshotCanCopy" @select="copySnapshot">
                  <ClipboardIcon />
                  Copy image
                </DropdownMenuItem>
                <DropdownMenuItem as-child>
                  <a :href="snapshotImageUrl" target="_blank" rel="noreferrer">
                    <ExpandIcon />
                    Open full size
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem @select="copyInputLink">
                  <CheckIcon v-if="snapshotLinkCopied" />
                  <LinkIcon v-else />
                  {{ snapshotLinkCopied ? 'Input link copied' : 'Copy inputs link' }}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>

        <p class="sr-only" aria-live="polite">{{ actionStatus }}</p>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
