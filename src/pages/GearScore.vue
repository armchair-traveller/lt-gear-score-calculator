<script setup>
import { TooltipProvider } from '@/components/ui/tooltip'
import DisclaimerDialog from '@/features/gear-score/components/DisclaimerDialog.vue'
import GearCatalogSheet from '@/features/gear-score/components/GearCatalogSheet.vue'
import GearScoreHeader from '@/features/gear-score/components/GearScoreHeader.vue'
import GearScoreInputPanel from '@/features/gear-score/components/GearScoreInputPanel.vue'
import GearScoreResultsPanel from '@/features/gear-score/components/GearScoreResultsPanel.vue'
import SnapshotDialog from '@/features/gear-score/components/SnapshotDialog.vue'
import { provideGearScoreCalculator } from '@/features/gear-score/context.js'
import { useGearScoreCalculator } from '@/features/gear-score/useGearScoreCalculator.js'

const calculator = useGearScoreCalculator()
provideGearScoreCalculator(calculator)
</script>

<template>
  <TooltipProvider>
    <div class="min-h-screen bg-background text-foreground">
      <GearScoreHeader />

      <main class="mx-auto grid w-full max-w-[1600px] gap-4 px-4 py-4 md:px-6 xl:grid-cols-[minmax(420px,560px)_minmax(0,1fr)]">
        <GearScoreInputPanel />
        <GearScoreResultsPanel />
      </main>

      <GearCatalogSheet />
      <SnapshotDialog />
      <DisclaimerDialog />
    </div>
  </TooltipProvider>
</template>
