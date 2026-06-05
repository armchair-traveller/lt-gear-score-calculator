<script setup>
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
