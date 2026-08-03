<script setup>
import { normalizeAppRoutePath } from '@/utils/app-route.js'

const route = useRoute()
const appShell = provideAppShell()
const auth = provideAuth()
provideGearPlanPersistence({ auth })

const shellRoutes = {
  '/': {
    active: 'calculator',
    eyebrow: 'Gear score · live calculation',
    title: 'A clearer path to your next upgrade.',
    description: 'Enter the rolls you have now, compare their strength, and see what the fully upgraded piece could become.',
    showHelp: true,
  },
  '/upgrade': {
    active: 'upgrade',
    eyebrow: 'Upgrade workbench · live material plan',
    title: 'Chart the cost before you commit.',
    description: 'Build a work order from any starting level, see what your inventory can cover, and inspect every material step.',
    showHelp: false,
  },
  '/plan': {
    active: 'planner',
    eyebrow: 'Gear planner',
    title: 'See which piece earns your effort next.',
    description: 'Rank your final pieces against a shared benchmark without losing sight of the actual gear slots.',
    showHelp: true,
  },
  '/auth/error': {
    active: 'auth',
    eyebrow: 'Account access',
    title: 'Your tools are still ready.',
    description: 'Discord sign-in did not finish. The calculator, upgrade workbench, and local planner remain available without an account.',
    showHelp: false,
  },
}

const normalizedRoutePath = computed(() => normalizeAppRoutePath(route.path))
const isPublicBuildRoute = computed(() => normalizedRoutePath.value.startsWith('/build/'))
const shellRoute = computed(() => {
  if (isPublicBuildRoute.value) {
    return {
      active: 'planner',
      eyebrow: 'Shared build · live planner',
      title: 'See the whole loadout at a glance.',
      description: 'Review this player’s current gear, upgrade priority, and final enchant lines.',
      showHelp: false,
    }
  }

  return shellRoutes[normalizedRoutePath.value] ?? shellRoutes['/']
})
</script>

<template>
  <TooltipProvider>
    <div class="parade-page">
      <AppShellHeader
        :active="shellRoute.active"
        :eyebrow="shellRoute.eyebrow"
        :title="shellRoute.title"
        :description="shellRoute.description"
        :show-help="shellRoute.showHelp"
        @help="appShell.openHelp(shellRoute.active)"
      >
        <template #utilities>
          <div id="app-shell-utilities" class="parade-shell-utilities" />
        </template>
      </AppShellHeader>

      <NuxtRouteAnnouncer />
      <NuxtPage />
    </div>
  </TooltipProvider>
</template>
