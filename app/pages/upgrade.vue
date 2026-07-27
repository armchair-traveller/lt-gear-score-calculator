<script setup>
import { provideUpgradePlanner } from '@/features/upgrade/context.js'
import { useUpgradePlanner } from '@/features/upgrade/useUpgradePlanner.js'
import UpgradeItemPickerSheet from '@/features/upgrade/components/UpgradeItemPickerSheet.vue'
import UpgradeQuickPicks from '@/features/upgrade/components/UpgradeQuickPicks.vue'
import UpgradeWorkbench from '@/features/upgrade/components/UpgradeWorkbench.vue'

useHead({
  title: 'Upgrade Workbench · LaTale Tools',
})

const planner = useUpgradePlanner()
provideUpgradePlanner(planner)
</script>

<template>
  <div class="parade-route upgrade-page upgrade-theme">
    <main
      id="main-content"
      data-route-main="/upgrade"
      tabindex="-1"
      class="parade-workspace upgrade-workspace"
    >
      <UpgradeWorkbench />
      <UpgradeQuickPicks />
    </main>

    <UpgradeItemPickerSheet />
  </div>
</template>
