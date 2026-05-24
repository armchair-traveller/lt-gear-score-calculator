<script setup>
import { ChevronDownIcon } from "@lucide/vue";
import { reactiveOmit } from "@vueuse/core";
import { ComboboxInput, useForwardPropsEmits } from "reka-ui";
import { ref } from "vue";
import { cn } from "@/lib/utils";
import { InputGroup, InputGroupAddon } from "@/components/ui/input-group";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps({
  modelValue: { type: String, required: false },
  autoFocus: { type: Boolean, required: false },
  disabled: { type: Boolean, required: false },
  displayValue: { type: Function, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
});

const emits = defineEmits(["update:modelValue"]);

const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardPropsEmits(delegatedProps, emits);
const shouldSelectOnFocus = ref(false);

function handlePointerDown(event) {
  shouldSelectOnFocus.value =
    event.target instanceof HTMLInputElement &&
    document.activeElement !== event.target;
}

function handleFocus(event) {
  const shouldSelect = shouldSelectOnFocus.value;
  shouldSelectOnFocus.value = false;

  if (!shouldSelect || !(event.target instanceof HTMLInputElement)) {
    return;
  }

  requestAnimationFrame(() => {
    if (document.activeElement === event.target) {
      event.target.select();
    }
  });
}
</script>

<template>
  <InputGroup>
    <ComboboxInput
      data-slot="combobox-input"
      v-bind="{ ...$attrs, ...forwarded }"
      :class="cn('flex-1 px-2.5 outline-hidden disabled:cursor-not-allowed disabled:opacity-50', props.class)"
      @pointerdown.capture="handlePointerDown"
      @focus="handleFocus"
    />
    <InputGroupAddon align="inline-end">
      <ChevronDownIcon class="size-4 shrink-0 opacity-50" />
    </InputGroupAddon>
  </InputGroup>
</template>
