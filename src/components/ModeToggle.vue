<script setup>
import { computed } from 'vue'
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from '@lucide/vue'
import { useColorMode } from '@vueuse/core'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const mode = useColorMode({
  disableTransition: false,
  emitAuto: true,
})

const options = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
  { value: 'auto', label: 'System', icon: MonitorIcon },
]

const currentIcon = computed(() => {
  return options.find((option) => option.value === mode.value)?.icon ?? MonitorIcon
})
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="outline" size="icon">
        <component :is="currentIcon" class="transition-transform duration-200" />
        <span class="sr-only">Toggle theme</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-36">
      <DropdownMenuItem
        v-for="option in options"
        :key="option.value"
        class="justify-between"
        @click="mode = option.value"
      >
        <span class="flex items-center gap-2">
          <component :is="option.icon" class="size-4" />
          {{ option.label }}
        </span>
        <CheckIcon v-if="mode === option.value" class="size-4" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
