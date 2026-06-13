<script setup>
import {
  AlertCircleIcon,
  CheckIcon,
  EyeOffIcon,
  ImagePlusIcon,
  Loader2Icon,
  RotateCcwIcon,
  ScanTextIcon,
  UploadCloudIcon,
} from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
})

const emit = defineEmits(['update:open'])

const {
  gears,
  gearType,
  pieceType,
  applyGearImageImport,
} = useGearScoreCalculatorContext()

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

const previewItem = computed(() => {
  if (!importResult.value) {
    return null
  }

  return gears[importResult.value.gearType]?.[importResult.value.pieceType] ?? null
})
const previewStatOptions = computed(() => Object.keys(previewItem.value?.Stats ?? {}))
const activeLines = computed(() => importResult.value?.lines?.filter((line) => !line.ignored) ?? [])
const invalidLineCount = computed(() => activeLines.value.filter((line) => !isLineValid(line)).length)
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
const canApplyImport = computed(() =>
  Boolean(importResult.value)
  && activeLines.value.length > 0
  && invalidLineCount.value === 0
  && duplicateStats.value.length === 0,
)
const applyIssue = computed(() => {
  if (!importResult.value) {
    return ''
  }
  if (!activeLines.value.length) {
    return 'No importable enchant lines detected.'
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
    const body = new FormData()
    body.append('image', selectedFile.value)
    body.append('gearType', gearType.value)
    body.append('pieceType', pieceType.value)

    importResult.value = normalizeClientResult(await $fetch('/api/gear-image-import', {
      method: 'POST',
      body,
    }))
  }
  catch (requestError) {
    error.value = requestError?.data?.message
      || requestError?.statusMessage
      || requestError?.message
      || 'Could not read the uploaded image.'
  }
  finally {
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
      value: line.value || '',
      stat: statOptions.includes(line.stat) ? line.stat : '',
      ignored: Boolean(line.ignored),
    })),
  }
}

function updateLineStat(index, stat) {
  const line = importResult.value?.lines?.[index]
  if (!line) {
    return
  }

  line.stat = stat
  if (stat === otherStat && !Number(line.value)) {
    line.value = 1
  }
}

function setLineValue(index, value) {
  const line = importResult.value?.lines?.[index]
  if (line) {
    line.value = value
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
}

function isLineValid(line) {
  return previewStatOptions.value.includes(line.stat) && Number(line.value) > 0
}

function getLineStatusLabel(line) {
  if (line.ignored) {
    return 'Ignored'
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
    return 'bg-muted text-muted-foreground'
  }
  if (!isLineValid(line)) {
    return 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
  }
  if (line.stat === otherStat) {
    return 'bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
  }

  return 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
}

function getRollText(line) {
  return Number(line.rollPercent) > 0 ? `${line.rollPercent}%` : '-'
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
    <DialogContent class="max-h-[92vh] overflow-y-auto rounded-lg p-0 sm:!max-w-5xl">
      <DialogHeader class="px-5 py-4 pr-14">
        <DialogTitle class="flex items-center gap-2 text-base">
          <ScanTextIcon class="size-4" />
          Import Screenshot
        </DialogTitle>
        <DialogDescription>
          {{ pieceType }} {{ gearType }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 px-5 pb-5 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
        <div class="grid content-start gap-3">
          <input
            ref="fileInput"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="hidden"
            tabindex="-1"
            aria-hidden="true"
            @change="handleFileSelect"
          >
          <button
            type="button"
            class="relative flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/20 p-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
            :class="isDragging ? 'border-ring bg-muted/40' : 'border-border'"
            @click="openFilePicker"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <img
              v-if="previewUrl"
              :src="previewUrl"
              alt=""
              class="max-h-[360px] w-full rounded-md object-contain"
            >
            <span v-else class="grid justify-items-center gap-3 text-center">
              <span class="flex size-12 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
                <UploadCloudIcon class="size-5" />
              </span>
              <span class="text-sm font-medium">Upload screenshot</span>
            </span>
          </button>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              class="min-w-24"
              :disabled="!selectedFile || isLoading"
              @click="parseImage"
            >
              <Loader2Icon v-if="isLoading" class="animate-spin" />
              <ImagePlusIcon v-else />
              {{ importResult ? 'Retry' : 'Parse' }}
            </Button>
            <Button
              variant="outline"
              :disabled="isLoading || (!selectedFile && !importResult)"
              @click="resetImport"
            >
              <RotateCcwIcon />
              Reset
            </Button>
          </div>
        </div>

        <div class="grid min-w-0 content-start gap-3">
          <div
            v-if="error"
            class="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircleIcon class="mt-0.5 size-4 shrink-0" />
            <span>{{ error }}</span>
          </div>

          <div
            v-if="isLoading"
            class="grid min-h-[260px] place-items-center rounded-lg bg-muted/15 p-6 text-center text-sm text-muted-foreground"
          >
            <span class="grid justify-items-center gap-3">
              <Loader2Icon class="size-6 animate-spin" />
              Reading enchant lines
            </span>
          </div>

          <div v-else-if="importResult" class="grid min-w-0 gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{{ importResult.pieceType }} {{ importResult.gearType }}</Badge>
              <Badge variant="secondary">Lv.{{ importResult.inputEnchantLevel }}</Badge>
              <Badge variant="outline">{{ Math.round((importResult.confidence || 0) * 100) }}%</Badge>
            </div>

            <div class="overflow-x-auto rounded-lg border">
              <table class="min-w-[760px] text-sm">
                <thead class="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th class="w-12 px-3 py-2 text-left font-medium">#</th>
                    <th class="px-3 py-2 text-left font-medium">Detected</th>
                    <th class="w-[260px] px-3 py-2 text-left font-medium">Stat</th>
                    <th class="w-28 px-3 py-2 text-left font-medium">Value</th>
                    <th class="w-20 px-3 py-2 text-left font-medium">Roll</th>
                    <th class="w-28 px-3 py-2 text-left font-medium">Status</th>
                    <th class="w-12 px-3 py-2 text-right font-medium">
                      <span class="sr-only">Ignore</span>
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr
                    v-for="(line, index) in importResult.lines"
                    :key="line.id"
                    :class="line.ignored ? 'bg-muted/15 text-muted-foreground' : ''"
                  >
                    <td class="px-3 py-2 align-top text-xs font-medium text-muted-foreground">
                      {{ index + 1 }}
                    </td>
                    <td class="max-w-[220px] px-3 py-2 align-top">
                      <div class="truncate font-medium">{{ line.detectedStat || 'Unknown' }}</div>
                      <div class="truncate text-xs text-muted-foreground">{{ line.rawText || line.reason }}</div>
                    </td>
                    <td class="px-3 py-2 align-top">
                      <Select
                        :model-value="line.stat"
                        :disabled="line.ignored"
                        @update:model-value="updateLineStat(index, $event)"
                      >
                        <SelectTrigger class="h-8 w-full">
                          <SelectValue placeholder="Select stat" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="stat in previewStatOptions"
                            :key="stat"
                            :value="stat"
                          >
                            {{ stat }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td class="px-3 py-2 align-top">
                      <Input
                        :model-value="line.value"
                        type="number"
                        min="0"
                        step="0.1"
                        :disabled="line.ignored"
                        class="h-8"
                        @update:model-value="setLineValue(index, $event)"
                      />
                    </td>
                    <td class="px-3 py-2 align-top text-xs text-muted-foreground">
                      {{ getRollText(line) }}
                    </td>
                    <td class="px-3 py-2 align-top">
                      <Badge variant="outline" :class="getLineStatusClass(line)">
                        {{ getLineStatusLabel(line) }}
                      </Badge>
                    </td>
                    <td class="px-3 py-2 text-right align-top">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            :aria-pressed="line.ignored"
                            @click="toggleIgnored(index)"
                          >
                            <EyeOffIcon />
                            <span class="sr-only">{{ line.ignored ? 'Use line' : 'Ignore line' }}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{{ line.ignored ? 'Use line' : 'Ignore line' }}</TooltipContent>
                      </Tooltip>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p class="min-h-5 text-sm text-muted-foreground">
                {{ applyIssue }}
              </p>
              <Button :disabled="!canApplyImport" @click="applyImport">
                <CheckIcon />
                Apply
              </Button>
            </div>
          </div>

          <div
            v-else
            class="grid min-h-[260px] place-items-center rounded-lg bg-muted/15 p-6 text-center text-sm text-muted-foreground"
          >
            <span>Ready for an equipment or enchant screenshot.</span>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
