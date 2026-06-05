<script setup>
import { reactiveOmit, useCurrentElement } from "@vueuse/core";
import { ListboxItem, useForwardPropsEmits, useId } from "reka-ui";
import { cn } from "@/lib/utils";
import { useCommand, useCommandGroup } from ".";

const props = defineProps({
  value: { type: null, required: false },
  disabled: { type: Boolean, required: false },
  textValue: { type: String, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});
const emits = defineEmits(["select"]);

const delegatedProps = reactiveOmit(props, "class", "textValue");
const forwarded = useForwardPropsEmits(delegatedProps, emits);

const id = useId();
const { filterState, allItems, allGroups } = useCommand();
const groupContext = useCommandGroup();

const isRender = computed(() => {
  if (!filterState.search) {
    return true;
  }

  const filteredCurrentItem = filterState.filtered.items.get(id);
  if (filteredCurrentItem === undefined) {
    return true;
  }

  return filteredCurrentItem > 0;
});

const itemRef = ref();
const currentElement = useCurrentElement(itemRef);

onMounted(() => {
  if (!(currentElement.value instanceof HTMLElement)) {
    return;
  }

  allItems.value.set(
    id,
    props.textValue ?? currentElement.value.textContent ?? props.value?.toString() ?? "",
  );

  const groupId = groupContext?.id;
  if (groupId) {
    if (!allGroups.value.has(groupId)) {
      allGroups.value.set(groupId, new Set([id]));
    } else {
      allGroups.value.get(groupId)?.add(id);
    }
  }
});

onUnmounted(() => {
  allItems.value.delete(id);

  const groupId = groupContext?.id;
  if (groupId) {
    allGroups.value.get(groupId)?.delete(id);
  }
});
</script>

<template>
  <ListboxItem
    v-if="isRender"
    :id="id"
    ref="itemRef"
    data-slot="command-item"
    v-bind="forwarded"
    :class="cn('data-highlighted:bg-muted data-highlighted:text-foreground data-highlighted:*:[svg]:text-foreground hover:bg-muted hover:text-foreground hover:*:[svg]:text-foreground relative flex cursor-default items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium outline-hidden select-none in-data-[slot=dialog-content]:rounded-3xl [&_svg:not([class*=size-])]:size-4 group/command-item data-[disabled]:pointer-events-none data-[disabled]:cursor-not-allowed data-[disabled]:bg-transparent data-[disabled]:text-muted-foreground data-[disabled]:opacity-40 data-[disabled]:hover:bg-transparent data-[disabled]:hover:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0', props.class)"
    @select="filterState.search = ''"
  >
    <slot />
  </ListboxItem>
</template>
