<script setup>
import { cn } from "@/lib/utils";

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
});
</script>

<template>
  <div
    data-slot="table-container"
    :class="cn('relative w-full overflow-x-auto', props.containerClass)"
  >
    <table
      data-slot="table"
      :class="cn('w-full caption-bottom text-sm', props.class)"
    >
      <slot />
    </table>
  </div>
</template>
