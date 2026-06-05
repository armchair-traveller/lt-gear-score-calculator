<script setup>
import {
  CameraIcon,
  CheckIcon,
  ClipboardIcon,
  DownloadIcon,
} from '@lucide/vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useGearScoreCalculatorContext } from '@/features/gear-score/context.js'

const {
  gearType,
  pieceType,
  snapshotOpen,
  snapshotImageUrl,
  snapshotIsGenerating,
  snapshotError,
  snapshotCopySucceeded,
  snapshotDownloadSucceeded,
  results,
  getFinalUpgrade,
  getSnapshotCurrentHeading,
  getSnapshotProjectedLevelLabel,
  formatGainRangeWithPrecision,
  copySnapshot,
  downloadSnapshot,
  getTierClass,
} = useGearScoreCalculatorContext()
</script>

<template>
  <Dialog v-model:open="snapshotOpen">
    <DialogContent class="max-h-[94vh] sm:!max-w-5xl overflow-y-auto rounded-lg p-0">
      <DialogHeader class="px-5 py-4 pr-14">
        <DialogTitle class="flex items-center gap-2">
          <CameraIcon class="size-4" />
          Snapshot
        </DialogTitle>
        <DialogDescription>
          {{ pieceType }} {{ gearType }} / {{ getFinalUpgrade(gearType) || 'Current results' }}
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div class="min-h-[320px] overflow-hidden rounded-lg bg-muted/30 p-2">
          <div
            v-if="snapshotIsGenerating"
            class="grid min-h-[320px] place-items-center text-sm text-muted-foreground"
          >
            Generating snapshot...
          </div>
          <img
            v-else-if="snapshotImageUrl"
            class="mx-auto max-h-[70vh] w-full rounded-md object-contain"
            :src="snapshotImageUrl"
            alt="Generated gear score snapshot"
          >
          <div v-else class="grid min-h-[320px] place-items-center text-sm text-muted-foreground">
            No snapshot yet.
          </div>
        </div>

        <div class="grid content-start gap-3">
          <Button
            :aria-label="snapshotCopySucceeded ? 'Copied image' : 'Copy image'"
            aria-live="polite"
            :disabled="snapshotIsGenerating || !snapshotImageUrl"
            @click="copySnapshot"
          >
            <CheckIcon v-if="snapshotCopySucceeded" />
            <ClipboardIcon v-else />
            {{ snapshotCopySucceeded ? 'Copied' : 'Copy image' }}
          </Button>
          <Button
            variant="outline"
            :aria-label="snapshotDownloadSucceeded ? 'Downloaded PNG' : 'Download PNG'"
            aria-live="polite"
            :disabled="snapshotIsGenerating || !snapshotImageUrl"
            @click="downloadSnapshot"
          >
            <CheckIcon v-if="snapshotDownloadSucceeded" />
            <DownloadIcon v-else />
            {{ snapshotDownloadSucceeded ? 'Downloaded' : 'Download PNG' }}
          </Button>
          <div class="grid gap-3 rounded-lg bg-muted/20 p-3">
            <div>
              <div class="text-xs font-medium uppercase text-muted-foreground">
                {{ getSnapshotCurrentHeading() }}
              </div>
              <div class="mt-1 flex items-center gap-2">
                <span class="text-xl font-semibold">{{ results.percent }}%</span>
                <Badge variant="outline" :class="getTierClass(results.tier)">
                  {{ results.tier }}
                </Badge>
              </div>
            </div>

            <div>
              <div class="text-xs font-medium uppercase text-muted-foreground">
                {{ getSnapshotProjectedLevelLabel() }}
              </div>
              <div class="mt-1 flex flex-wrap items-center gap-2">
                <span class="text-xl font-semibold">{{ results.potentialScore }}</span>
                <Badge variant="outline" :class="getTierClass(results.potentialTier)">
                  {{ results.potentialTier }}
                </Badge>
              </div>
              <div class="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                {{ formatGainRangeWithPrecision(results.potentialScore, Number(results.percent), 0) }} score
              </div>
            </div>
          </div>

          <p v-if="snapshotError" class="text-sm text-destructive">{{ snapshotError }}</p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
