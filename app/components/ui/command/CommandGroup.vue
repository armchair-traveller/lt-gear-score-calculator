<script setup>
import { reactiveOmit } from "@vueuse/core";
import { ListboxGroup, ListboxGroupLabel, useId } from "reka-ui";
import { cn } from "@/lib/utils";
import { provideCommandGroupContext, useCommand } from ".";

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

const delegatedProps = reactiveOmit(props, "class");
const { allGroups, filterState } = useCommand();
const id = useId();

const isRender = computed(() => (
  !filterState.search ? true : filterState.filtered.groups.has(id)
));

provideCommandGroupContext({ id });

onMounted(() => {
  if (!allGroups.value.has(id)) {
    allGroups.value.set(id, new Set());
  }
});

onUnmounted(() => {
  allGroups.value.delete(id);
});
</script>

<template>
  <ListboxGroup
    v-bind="delegatedProps"
    :id="id"
    data-slot="command-group"
    :class="cn('text-foreground **:[[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1.5 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-2 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium', props.class)"
    :hidden="isRender ? undefined : true"
  >
    <ListboxGroupLabel v-if="heading" data-slot="command-group-heading">
      {{ heading }}
    </ListboxGroupLabel>
    <slot />
  </ListboxGroup>
</template>
