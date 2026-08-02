<script setup>
import {
  AlertCircleIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  ImagePlusIcon,
  Loader2Icon,
  RotateCcwIcon,
  ScanTextIcon,
  UploadCloudIcon,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open'])

const { gears, gearType, pieceType, applyGearImageImport } = useGearScoreCalculatorContext()

const otherStat = 'Other (Non-damaging)'
const openProxy = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value),
})
const fileInput = ref(null)
const selectedFile = ref(null)
const previewUrl = ref('')
const importResult = ref(null)
const error = ref('')
const isLoading = ref(false)
const isDragging = ref(false)
const lastEditedLineId = ref('')
let lineFeedbackTimeout

const previewItem = computed(() => {
  if (!importResult.value) {
    return null
  }

  return gears[importResult.value.gearType]?.[importResult.value.pieceType] ?? null
})
const previewStatOptions = computed(() => Object.keys(previewItem.value?.Stats ?? {}))
const activeLines = computed(() => importResult.value?.lines?.filter((line) => !line.ignored) ?? [])
const hasTooManyActiveLines = computed(() => activeLines.value.length > 5)
const invalidLineCount = computed(() => activeLines.value.filter((line) => !isLineValid(line)).length)
const ignoredLineCount = computed(() => importResult.value?.lines?.filter((line) => line.ignored).length ?? 0)
const duplicateStats = computed(() => {
  const seen = new Set()
  const duplicates = new Set()

  activeLines.value.forEach((line) => {
    if (!line.stat || line.stat === otherStat) {
      return
    }

    if (seen.has(line.stat)) {
      duplicates.add(line.stat)
      return
    }

    seen.add(line.stat)
  })

  return Array.from(duplicates)
})
const readyLineCount = computed(
  () => activeLines.value.filter((line) => isLineValid(line) && !isLineDuplicate(line)).length,
)
const importConfidenceText = computed(() =>
  importResult.value ? `${Math.round((importResult.value.confidence || 0) * 100)}%` : '',
)
const reviewSummary = computed(() => {
  if (isLoading.value) {
    return 'Reading'
  }
  if (!importResult.value) {
    return selectedFile.value ? 'Ready to parse' : 'Waiting for image'
  }
  if (canApplyImport.value) {
    return `${readyLineCount.value} ready`
  }
  if (!activeLines.value.length) {
    return 'No usable rows'
  }
  if (hasTooManyActiveLines.value) {
    return 'Too many rows'
  }
  if (duplicateStats.value.length) {
    return `${duplicateStats.value.length} duplicate`
  }
  if (invalidLineCount.value) {
    return `${invalidLineCount.value} needs review`
  }

  return 'Review rows'
})
const canApplyImport = computed(
  () =>
    Boolean(importResult.value) &&
    activeLines.value.length > 0 &&
    !hasTooManyActiveLines.value &&
    invalidLineCount.value === 0 &&
    duplicateStats.value.length === 0,
)
const applyIssue = computed(() => {
  if (!importResult.value) {
    return ''
  }
  if (!activeLines.value.length) {
    return 'No importable enchant lines detected.'
  }
  if (hasTooManyActiveLines.value) {
    return 'A gear-score evaluation supports at most five active enchant lines.'
  }
  if (invalidLineCount.value) {
    return 'Fix or ignore unresolved rows before applying.'
  }
  if (duplicateStats.value.length) {
    return `Duplicate stat: ${duplicateStats.value.join(', ')}`
  }

  return ''
})

watch(openProxy, (open) => {
  if (open) {
    addPasteListener()
    return
  }

  removePasteListener()
  resetImport()
})

onBeforeUnmount(() => {
  removePasteListener()
  revokePreviewUrl()
  clearTimeout(lineFeedbackTimeout)
})

function addPasteListener() {
  if (import.meta.client) {
    document.addEventListener('paste', handlePaste)
  }
}

function removePasteListener() {
  if (import.meta.client) {
    document.removeEventListener('paste', handlePaste)
  }
}

function openFilePicker() {
  fileInput.value?.click()
}

function handleFileSelect(event) {
  const [file] = event.target.files || []
  setSelectedFile(file)
  event.target.value = ''
}

function handleDrop(event) {
  isDragging.value = false
  const [file] = Array.from(event.dataTransfer?.files || []).filter((item) => item.type.startsWith('image/'))
  setSelectedFile(file)
}

function handlePaste(event) {
  if (!openProxy.value) {
    return
  }

  const [file] = Array.from(event.clipboardData?.files || []).filter((item) => item.type.startsWith('image/'))
  if (file) {
    setSelectedFile(file)
  }
}

function setSelectedFile(file) {
  if (!file) {
    return
  }

  if (!file.type.startsWith('image/')) {
    error.value = 'Use a PNG, JPEG, or WebP image.'
    return
  }

  selectedFile.value = file
  importResult.value = null
  error.value = ''
  revokePreviewUrl()
  previewUrl.value = URL.createObjectURL(file)
}

async function parseImage() {
  if (!selectedFile.value || isLoading.value) {
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    const selectedImage = selectedFile.value
    const body = new FormData()
    body.append('image', selectedImage, selectedImage.name)
    body.append('gearType', gearType.value)
    body.append('pieceType', pieceType.value)

    importResult.value = normalizeClientResult(
      await $fetch('/api/gear-image-import', {
        method: 'POST',
        body,
      }),
    )
  } catch (requestError) {
    error.value =
      requestError?.data?.message ||
      requestError?.statusMessage ||
      requestError?.message ||
      'Could not read the uploaded image.'
  } finally {
    isLoading.value = false
  }
}

function normalizeClientResult(result) {
  const statOptions = Object.keys(gears[result?.gearType]?.[result?.pieceType]?.Stats ?? {})

  return {
    ...result,
    lines: (result?.lines ?? []).map((line, index) => ({
      ...line,
      id: line.id || `line-${index}`,
      value: line.value ?? '',
      stat: statOptions.includes(line.stat) ? line.stat : '',
      ignored: Boolean(line.ignored),
      userEdited: false,
    })),
  }
}

function updateLineStat(index, stat) {
  const line = importResult.value?.lines?.[index]
  if (!line) {
    return
  }

  line.stat = stat
  line.userEdited = true
  if (stat === otherStat && !Number(line.value)) {
    line.value = 1
  }
  markLineEdited(line)
}

function setLineValue(index, value) {
  const line = importResult.value?.lines?.[index]
  if (line) {
    line.value = value
    line.userEdited = true
  }
}

function toggleIgnored(index) {
  const line = importResult.value?.lines?.[index]
  if (!line) {
    return
  }

  line.ignored = !line.ignored
  if (!line.ignored && line.stat === otherStat && !Number(line.value)) {
    line.value = 1
  }
  markLineEdited(line)
}

async function markLineEdited(line) {
  clearTimeout(lineFeedbackTimeout)
  lastEditedLineId.value = ''
  await nextTick()
  lastEditedLineId.value = line?.id ?? ''
  lineFeedbackTimeout = setTimeout(() => {
    lastEditedLineId.value = ''
  }, 220)
}

function isLineValid(line) {
  return (
    previewStatOptions.value.includes(line.stat) &&
    Number(line.value) > 0 &&
    (line.status !== 'needs_review' || line.userEdited)
  )
}

function isLineDuplicate(line) {
  return !line.ignored && Boolean(line.stat) && duplicateStats.value.includes(line.stat)
}

function getLineStatusLabel(line) {
  if (line.ignored) {
    return 'Ignored'
  }
  if (isLineDuplicate(line)) {
    return 'Duplicate'
  }
  if (!isLineValid(line)) {
    return 'Review'
  }
  if (line.stat === otherStat) {
    return 'Other'
  }

  return 'Ready'
}

function getLineStatusClass(line) {
  if (line.ignored) {
    return 'border-border bg-muted text-muted-foreground'
  }
  if (isLineDuplicate(line)) {
    return 'border-destructive/30 bg-destructive/10 text-destructive'
  }
  if (!isLineValid(line)) {
    return 'border-warning-border bg-warning-surface text-warning-foreground'
  }
  if (line.stat === otherStat) {
    return 'border-info-border bg-info-surface text-info-foreground'
  }

  return 'border-success-border bg-success-surface text-success-foreground'
}

function getLineShellClass(line) {
  if (line.ignored) {
    return 'border-border/60 bg-surface-inset/60 text-muted-foreground'
  }
  if (isLineDuplicate(line)) {
    return 'border-destructive/30 bg-destructive/5'
  }
  if (!isLineValid(line)) {
    return 'border-warning-border bg-warning-surface/60'
  }
  if (line.stat === otherStat) {
    return 'border-info-border bg-info-surface/60'
  }

  return 'border-success-border/50 bg-success-surface/30'
}

function getRollText(line) {
  return Number(line.rollPercent) > 0 ? `${line.rollPercent}%` : '-'
}

function getLineSourceText(line) {
  const sourceText = line.rawText || 'No source text'
  if (line.status === 'needs_review' && !line.userEdited && line.reason) {
    return `${sourceText} · ${line.reason}`
  }

  return line.rawText || line.reason || sourceText
}

function applyImport() {
  if (!canApplyImport.value) {
    return
  }

  applyGearImageImport(importResult.value)
  openProxy.value = false
}

function resetImport() {
  selectedFile.value = null
  importResult.value = null
  error.value = ''
  isLoading.value = false
  isDragging.value = false
  lastEditedLineId.value = ''
  clearTimeout(lineFeedbackTimeout)
  revokePreviewUrl()
}

function revokePreviewUrl() {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
}
</script>

<template>
  <Dialog v-model:open="openProxy">
    <DialogContent
      class="max-h-[92vh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-lg p-0 sm:!max-w-6xl"
    >
      <DialogHeader class="border-b px-5 py-4 pr-14">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <DialogTitle class="flex items-center gap-2 text-base">
              <ScanTextIcon class="size-4" />
              Import Screenshot
            </DialogTitle>
            <DialogDescription class="mt-1">
              {{ importResult ? `${importResult.pieceType} ${importResult.gearType}` : `${pieceType} ${gearType}` }}
            </DialogDescription>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{{ reviewSummary }}</Badge>
            <template v-if="importResult">
              <Badge variant="outline">Lv.{{ importResult.inputEnchantLevel }}</Badge>
              <Badge variant="outline">{{ importConfidenceText }}</Badge>
            </template>
          </div>
        </div>
      </DialogHeader>

      <div class="grid min-h-0 overflow-y-auto lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] lg:overflow-hidden">
        <div class="grid content-start gap-3 border-b p-4 lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="hidden"
            tabindex="-1"
            aria-hidden="true"
            @change="handleFileSelect"
          />
          <button
            type="button"
            class="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-dashed bg-surface-inset p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40 lg:min-h-[320px]"
            :class="isDragging ? 'border-info-border bg-info-surface' : 'border-border'"
            @click="openFilePicker"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <Transition name="motion-fade" mode="out-in">
              <img
                v-if="previewUrl"
                key="preview"
                :src="previewUrl"
                alt=""
                class="max-h-[46vh] w-full rounded-md object-contain"
              />
              <span v-else key="empty" class="grid justify-items-center gap-3 text-center">
                <span
                  class="flex size-12 items-center justify-center rounded-lg bg-surface-raised text-muted-foreground shadow-sm"
                >
                  <UploadCloudIcon class="size-5" />
                </span>
                <span class="text-sm font-medium">Upload screenshot</span>
              </span>
            </Transition>
          </button>

          <Transition name="motion-swap">
            <div v-if="selectedFile" class="min-w-0 rounded-lg border bg-surface-raised px-3 py-2 text-xs text-muted-foreground">
              <div class="truncate font-medium text-foreground">{{ selectedFile.name }}</div>
              <div class="motion-tabular">{{ Math.ceil(selectedFile.size / 1024) }} KB</div>
            </div>
          </Transition>

          <div class="grid grid-cols-2 gap-2">
            <Button class="w-full" :disabled="!selectedFile || isLoading" @click="parseImage">
              <Loader2Icon v-if="isLoading" class="animate-spin" />
              <ImagePlusIcon v-else />
              {{ importResult ? 'Retry' : 'Parse' }}
            </Button>
            <Button
              variant="outline"
              class="w-full"
              :disabled="isLoading || (!selectedFile && !importResult)"
              @click="resetImport"
            >
              <RotateCcwIcon />
              Reset
            </Button>
          </div>
        </div>

        <div class="grid min-h-0 min-w-0 gap-3 p-4 lg:grid-rows-[auto_minmax(0,1fr)]">
          <Transition name="motion-swap">
            <div
              v-if="error"
              class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              <AlertCircleIcon class="mt-0.5 size-4 shrink-0" />
              <span>{{ error }}</span>
            </div>
          </Transition>

          <Transition name="motion-fade" mode="out-in">
            <div
              v-if="isLoading"
              key="loading"
              class="grid min-h-[260px] place-items-center rounded-lg border bg-surface-inset p-6 text-center text-sm text-muted-foreground lg:min-h-0"
              role="status"
              aria-live="polite"
            >
              <span class="grid justify-items-center gap-3">
                <Loader2Icon class="size-6 animate-spin" />
                Reading enchant lines
              </span>
            </div>

            <div v-else-if="importResult" key="review" class="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{{ activeLines.length }} active</Badge>
              <Badge
                variant="outline"
                class="border-success-border bg-success-surface text-success-foreground"
              >
                {{ readyLineCount }} ready
              </Badge>
              <Badge
                v-if="invalidLineCount"
                variant="outline"
                class="border-warning-border bg-warning-surface text-warning-foreground"
              >
                {{ invalidLineCount }} review
              </Badge>
              <Badge
                v-if="duplicateStats.length"
                variant="outline"
                class="border-destructive/30 bg-destructive/10 text-destructive"
              >
                {{ duplicateStats.length }} duplicate
              </Badge>
              <Badge
                v-if="hasTooManyActiveLines"
                variant="destructive"
              >
                5 line maximum
              </Badge>
              <Badge v-if="ignoredLineCount" variant="outline"> {{ ignoredLineCount }} ignored </Badge>
            </div>

            <ScrollArea type="always" class="h-[52vh] min-h-[280px] rounded-lg lg:h-full lg:min-h-0">
              <div class="grid gap-2 pr-3">
                <article
                  v-for="(line, index) in importResult.lines"
                  :key="line.id"
                  :class="[
                    'grid gap-3 rounded-lg border p-3 text-sm transition-colors',
                    getLineShellClass(line),
                    { 'motion-feedback': lastEditedLineId === line.id },
                  ]"
                >
                  <div class="flex min-w-0 items-start gap-3">
                    <div
                      class="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-inset text-xs font-semibold text-muted-foreground"
                    >
                      {{ index + 1 }}
                    </div>

                    <div class="min-w-0 flex-1">
                      <div class="flex min-w-0 flex-wrap items-center gap-2">
                        <div class="min-w-0 max-w-full truncate font-medium">
                          {{ line.detectedStat || 'Unknown' }}
                        </div>
                        <Badge variant="outline" :class="getLineStatusClass(line)">
                          {{ getLineStatusLabel(line) }}
                        </Badge>
                        <Badge v-if="getRollText(line) !== '-'" variant="outline"> Roll {{ getRollText(line) }} </Badge>
                      </div>
                      <div class="mt-1 truncate text-xs text-muted-foreground">
                        {{ getLineSourceText(line) }}
                      </div>
                    </div>

                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          class="shrink-0"
                          :aria-pressed="line.ignored"
                          @click="toggleIgnored(index)"
                        >
                          <EyeIcon v-if="line.ignored" />
                          <EyeOffIcon v-else />
                          <span class="sr-only">{{ line.ignored ? 'Use line' : 'Ignore line' }}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{{ line.ignored ? 'Use line' : 'Ignore line' }}</TooltipContent>
                    </Tooltip>
                  </div>

                  <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_112px]">
                    <Select
                      :model-value="line.stat"
                      :disabled="line.ignored"
                      @update:model-value="updateLineStat(index, $event)"
                    >
                      <SelectTrigger class="h-9 w-full" :aria-label="`Line ${index + 1} stat`">
                        <SelectValue placeholder="Select stat" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem v-for="stat in previewStatOptions" :key="stat" :value="stat">
                          {{ stat }}
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      :model-value="line.value"
                      type="number"
                      min="0"
                      step="0.1"
                      :disabled="line.ignored"
                      class="h-9"
                      :aria-label="`Line ${index + 1} value`"
                      @update:model-value="setLineValue(index, $event)"
                      @change="markLineEdited(line)"
                    />
                  </div>
                </article>
              </div>
            </ScrollArea>
            </div>

            <div
              v-else
              key="empty"
              class="grid min-h-[260px] place-items-center rounded-lg border border-dashed bg-surface-inset p-6 text-center text-sm text-muted-foreground lg:min-h-0"
            >
              <span class="grid justify-items-center gap-3">
                <ScanTextIcon class="size-6" />
                {{ selectedFile ? 'Ready to parse' : 'No equip/enchant screenshot selected' }}
              </span>
            </div>
          </Transition>
        </div>
      </div>

      <div class="border-t bg-surface-raised px-5 py-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="min-h-5 text-sm" :class="applyIssue ? 'text-destructive' : 'text-muted-foreground'">
            {{
              applyIssue ||
              (importResult ? `${readyLineCount} rows ready to apply.` : 'Parse a screenshot to review rows.')
            }}
          </p>
          <Button :disabled="!canApplyImport" @click="applyImport">
            <CheckIcon />
            Apply
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
