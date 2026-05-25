<script setup>
import { SearchIcon } from "@lucide/vue";
import { reactiveOmit } from "@vueuse/core";
import { ListboxFilter, useForwardProps } from "reka-ui";
import { cn } from "@/lib/utils";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";
import { useCommand } from ".";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps({
  disabled: { type: Boolean, required: false },
  autoFocus: { type: Boolean, required: false, default: true },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});

const delegatedProps = reactiveOmit(props, "class");
const forwardedProps = useForwardProps(delegatedProps);
const { filterState } = useCommand();
</script>

<template>
  <div data-slot="command-input-wrapper" class="p-1 pb-0">
    <InputGroup class="bg-input/50 h-9">
      <ListboxFilter
        v-bind="{ ...forwardedProps, ...$attrs }"
        v-model="filterState.search"
        data-slot="command-input"
        :class="cn('w-full px-2.5 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50', props.class)"
      />
      <InputGroupAddon>
        <SearchIcon class="size-4 shrink-0 opacity-50" />
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>
