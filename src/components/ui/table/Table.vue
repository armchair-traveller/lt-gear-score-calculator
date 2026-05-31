<script setup>
import { ScrollAreaCorner, ScrollAreaRoot, ScrollAreaViewport } from 'reka-ui'

import ScrollBar from '@/components/ui/scroll-area/ScrollBar.vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  containerClass: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
})
</script>

<template>
  <ScrollAreaRoot
    data-slot="table-container"
    :class="cn('relative w-full overflow-hidden', props.containerClass)"
  >
    <ScrollAreaViewport
      data-slot="table-viewport"
      class="size-full [max-height:inherit] rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
    >
      <table
        data-slot="table"
        :class="cn('w-full caption-bottom text-sm', props.class)"
      >
        <slot />
      </table>
    </ScrollAreaViewport>
    <ScrollBar orientation="horizontal" />
    <ScrollBar />
    <ScrollAreaCorner />
  </ScrollAreaRoot>
</template>
