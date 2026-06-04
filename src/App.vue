<script setup>
import { defineAsyncComponent } from 'vue'

const GearScorePage = defineAsyncComponent(() => import('@/pages/GearScore.vue'))
const GearPlanPage = defineAsyncComponent(() => import('@/pages/GearPlan.vue'))
const UpgradePage = defineAsyncComponent(() => import('@/pages/Upgrade.vue'))
const normalizedPath = window.location.pathname.replace(/\/$/, '')
const isUpgradePage = normalizedPath.endsWith('/upgrade')
const isGearPlanPage = normalizedPath.endsWith('/plan')
</script>

<template>
  <UpgradePage v-if="isUpgradePage" />
  <GearPlanPage v-else-if="isGearPlanPage" />
  <GearScorePage v-else />
</template>
