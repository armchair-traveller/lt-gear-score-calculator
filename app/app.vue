<script setup>
import { normalizeAppRoutePath } from '@/utils/app-route.js'

const route = useRoute()
const appShell = provideAppShell()

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
    eyebrow: 'Upgrade materials',
    title: 'Plan your next upgrade.',
    description: '',
    showHelp: false,
  },
  '/plan': {
    active: 'planner',
    eyebrow: 'Gear planner',
    title: 'See which piece earns your effort next.',
    description: 'Rank your final pieces against a shared benchmark without losing sight of the actual gear slots.',
    showHelp: true,
  },
}

const shellRoute = computed(() =>
  shellRoutes[normalizeAppRoutePath(route.path)] ?? shellRoutes['/'],
)
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
