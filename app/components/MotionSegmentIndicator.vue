<script setup>
const props = defineProps({
  count: {
    type: Number,
    required: true,
  },
  index: {
    type: Number,
    required: true,
  },
  gap: {
    type: Number,
    default: 0.25,
  },
  padding: {
    type: Number,
    default: 0.25,
  },
})

const indicatorStyle = computed(() => {
  const count = Math.max(1, props.count)
  const index = Math.max(0, Math.min(props.index, count - 1))
  const unavailableWidth = (props.padding * 2) + (props.gap * (count - 1))

  return {
    '--motion-segment-padding': `${props.padding}rem`,
    width: `calc((100% - ${unavailableWidth}rem) / ${count})`,
    transform: `translateX(calc(${index * 100}% + ${index * props.gap}rem))`,
  }
})
</script>

<template>
  <span aria-hidden="true" class="motion-segment-indicator" :style="indicatorStyle" />
</template>
