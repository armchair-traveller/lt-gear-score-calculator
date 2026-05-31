<script setup>
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
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
  <ScrollArea
    data-slot="table-container"
    :class="cn('w-full', props.containerClass)"
  >
    <table
      data-slot="table"
      :class="cn('w-full caption-bottom text-sm', props.class)"
    >
      <slot />
    </table>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
</template>
