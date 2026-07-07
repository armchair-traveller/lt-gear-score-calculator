<script setup>
import { Primitive } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  orientation: { type: String, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false, default: "div" },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
</script>

<template>
  <Primitive
    role="group"
    :data-orientation="props.orientation"
    :as="props.as"
    :as-child="props.asChild"
    :class="cn('bg-muted gap-2 rounded-4xl border px-2.5 text-sm font-medium [&_svg:not([class*=size-])]:size-4 flex items-center [&_svg]:pointer-events-none', props.class)"
  >
    <slot />
  </Primitive>
</template>
