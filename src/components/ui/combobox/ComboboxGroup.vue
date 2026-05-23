<script setup>
import { reactiveOmit } from "@vueuse/core";
import { ComboboxGroup, ComboboxLabel } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  heading: { type: String, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});

const delegatedProps = reactiveOmit(props, "class", "heading");
</script>

<template>
  <ComboboxGroup
    data-slot="combobox-group"
    v-bind="delegatedProps"
    :class="cn('overflow-hidden text-foreground', props.class)"
  >
    <ComboboxLabel v-if="heading" class="text-muted-foreground px-2 py-1.5 text-xs">
      {{ heading }}
    </ComboboxLabel>
    <slot />
  </ComboboxGroup>
</template>
