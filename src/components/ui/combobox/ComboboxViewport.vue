<script setup>
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const props = defineProps({
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
</script>

<template>
  <ScrollArea type="always" :class="cn('h-64 max-h-[var(--reka-combobox-content-available-height)] overflow-hidden', props.class)">
    <div data-slot="combobox-viewport" class="scroll-py-1 p-1">
      <slot />
    </div>
  </ScrollArea>
</template>
