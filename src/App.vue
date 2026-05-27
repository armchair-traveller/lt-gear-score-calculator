<script setup>
import { defineAsyncComponent } from 'vue'

const GearScorePage = defineAsyncComponent(() => import('@/pages/GearScore.vue'))
const UpgradePage = defineAsyncComponent(() => import('@/pages/Upgrade.vue'))
const normalizedPath = window.location.pathname.replace(/\/$/, '')
const isUpgradePage = normalizedPath.endsWith('/upgrade')
</script>

<template>
  <UpgradePage v-if="isUpgradePage" />
  <GearScorePage v-else />
</template>
