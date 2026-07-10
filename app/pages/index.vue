<script setup>
const calculator = useGearScoreCalculator()
provideGearScoreCalculator(calculator)
</script>

<template>
  <TooltipProvider>
    <div class="parade-page">
      <GearScoreHeader />

      <main class="parade-workspace grid gap-4 xl:grid-cols-[minmax(390px,414px)_minmax(0,1fr)]">
        <GearScoreInputPanel />
        <GearScoreResultsPanel />
      </main>

      <GearCatalogSheet />
      <SnapshotDialog />
      <DisclaimerDialog />
    </div>
  </TooltipProvider>
</template>
