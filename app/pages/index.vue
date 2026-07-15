<script setup>
useHead({
  title: 'LaTale Enchant Calculator',
})

const calculator = useGearScoreCalculator()
provideGearScoreCalculator(calculator)
</script>

<template>
  <div class="parade-route">
    <GearScoreHeader />

    <main
      id="main-content"
      data-route-main="/"
      tabindex="-1"
      class="parade-workspace grid gap-4 xl:grid-cols-[minmax(390px,414px)_minmax(0,1fr)]"
    >
      <GearScoreInputPanel />
      <GearScoreResultsPanel />
    </main>

    <GearCatalogSheet />
    <SnapshotDialog />
    <DisclaimerDialog />
  </div>
</template>
