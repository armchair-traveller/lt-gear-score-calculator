<script setup>
import { cn } from '@/lib/utils'

const props = defineProps({
  motionKey: {
    type: [String, Number, Boolean],
    required: true,
  },
  as: {
    type: String,
    default: 'span',
  },
  class: {
    type: [Boolean, null, String, Object, Array],
    default: undefined,
  },
})
</script>

<template>
  <component :is="props.as" :class="cn('motion-value-grid', props.class)">
    <Transition name="motion-swap">
      <span :key="String(props.motionKey)" class="col-start-1 row-start-1 block min-w-0">
        <slot />
      </span>
    </Transition>
  </component>
</template>
