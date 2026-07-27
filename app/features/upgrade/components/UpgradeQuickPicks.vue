<script setup>
import { ArrowRightIcon, SearchIcon } from '@lucide/vue'
import { computed } from 'vue'
import { useUpgradePlannerContext } from '@/features/upgrade/context.js'

const {
  selectedItem,
  recentItems,
  suggestedItems,
  openItemPicker,
  selectItem,
} = useUpgradePlannerContext()

const quickItems = computed(() => {
  const items = []
  for (const item of [...recentItems.value, ...suggestedItems.value]) {
    if (item.value === selectedItem.value?.value || items.some(entry => entry.value === item.value)) {
      continue
    }
    items.push(item)
  }
  return items.slice(0, 4)
})

const hasRecentAlternatives = computed(() =>
  recentItems.value.some(item => item.value !== selectedItem.value?.value),
)
</script>

<template>
  <section class="upgrade-quick-picks" aria-labelledby="upgrade-quick-picks-title">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="upgrade-kicker">{{ hasRecentAlternatives ? 'Recent work orders' : 'Nearby in the catalog' }}</p>
        <h2 id="upgrade-quick-picks-title" class="mt-1 text-xl font-bold tracking-tight">
          Keep another route within reach
        </h2>
      </div>
      <Button variant="outline" @click="openItemPicker">
        <SearchIcon data-icon="inline-start" />
        Browse all items
      </Button>
    </div>

    <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Button
        v-for="item in quickItems"
        :key="item.value"
        variant="outline"
        class="upgrade-pick-button h-auto min-w-0 justify-start"
        :aria-label="`Plan upgrades for ${item.name}`"
        @click="selectItem(item.value)"
      >
        <span class="min-w-0 flex-1 text-left">
          <strong class="block truncate">{{ item.name }}</strong>
          <span class="mt-1 block truncate text-xs font-normal text-muted-foreground">
            {{ item.summary.farm }} · {{ item.summary.quarter }}
          </span>
          <span class="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <span>{{ item.summary.max }}</span>
            <span>{{ item.summary.total }} material</span>
          </span>
        </span>
        <ArrowRightIcon data-icon="inline-end" class="shrink-0" />
      </Button>
    </div>
  </section>
</template>
