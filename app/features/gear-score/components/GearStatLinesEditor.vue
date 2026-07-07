<script setup>
import {
  CheckIcon,
  ChevronDownIcon,
  XIcon,
} from '@lucide/vue'

const props = defineProps({
  statTypes: { type: Array, required: true },
  statInputs: { type: Array, required: true },
  statOptions: { type: Array, required: true },
  pickerOpen: { type: Array, required: true },
  getStatStep: { type: Function, required: true },
  getMaxValue: { type: Function, required: true },
  getLineMaxSummaryText: { type: Function, required: true },
  getLineMaxPercentText: { type: Function, default: null },
  getLineMaxPercentClass: { type: Function, default: null },
  isInputOverMax: { type: Function, required: true },
  isStatSelectedOnOtherLine: { type: Function, required: true },
  disabled: { type: Boolean, default: false },
  valuePlaceholder: { type: String, default: 'Value' },
})

const emit = defineEmits([
  'select-stat',
  'update-input',
  'update-picker-open',
])

function getOptionalLineMaxPercentText(index) {
  return props.getLineMaxPercentText?.(index) ?? ''
}

function getOptionalLineMaxPercentClass(index) {
  return props.getLineMaxPercentClass?.(index) ?? ''
}

function hasInputValue(index) {
  const value = props.statInputs[index]
  return value !== '' && value !== null && value !== undefined
}
</script>

<template>
  <div class="overflow-hidden rounded-lg bg-muted/20">
    <div
      v-for="(_, index) in statTypes"
      :key="index"
      class="grid gap-2 p-3"
    >
      <div
        role="group"
        :aria-label="`Line ${index + 1}`"
        :class="[
          'group/line grid gap-1',
          getLineMaxPercentText
            ? 'sm:grid-cols-[minmax(0,1fr)_minmax(250px,290px)]'
            : 'sm:grid-cols-[minmax(0,1fr)_minmax(210px,240px)]',
        ]"
      >
        <Popover
          :open="pickerOpen[index] || false"
          @update:open="emit('update-picker-open', index, $event)"
        >
          <PopoverTrigger as-child>
            <Button
              :id="`stat-${index}`"
              variant="ghost"
              role="combobox"
              :disabled="disabled"
              :aria-label="`Line ${index + 1} stat`"
              :aria-expanded="pickerOpen[index] || false"
              class="h-10 w-full justify-between rounded-b-none rounded-t-3xl bg-input/50 px-3 font-normal shadow-none hover:bg-muted/60 focus-visible:ring-inset dark:bg-input/30 dark:hover:bg-input/40 sm:h-9 sm:rounded-l-3xl sm:rounded-r-none"
            >
              <span class="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  class="shrink-0 text-xs font-semibold text-muted-foreground"
                >
                  {{ index + 1 }}
                </span>
                <span class="min-w-0 truncate text-left">
                  {{ statTypes[index] || 'Select stat...' }}
                </span>
              </span>
              <ChevronDownIcon class="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[var(--reka-popover-trigger-width)] gap-0 p-0" align="start">
            <Command :model-value="statTypes[index]" highlight-on-hover>
              <CommandInput placeholder="Search stat..." />
              <ScrollArea type="always" class="max-h-72">
                <CommandList class="max-h-none overflow-visible pr-3">
                  <CommandEmpty>No stat found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      v-for="stat in statOptions"
                      :key="stat"
                      :value="stat"
                      :text-value="stat"
                      :disabled="isStatSelectedOnOtherLine(stat, index)"
                      @select="emit('select-stat', index, stat)"
                    >
                      <CheckIcon
                        :class="[
                          'size-4',
                          statTypes[index] === stat ? 'opacity-100' : 'opacity-0',
                        ]"
                      />
                      <span class="truncate">{{ stat }}</span>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </ScrollArea>
            </Command>
          </PopoverContent>
        </Popover>

        <div
          :class="[
            'h-10 rounded-b-3xl rounded-t-none border border-transparent bg-input/50 transition-[color,box-shadow,background-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-inset focus-within:ring-ring/30 dark:bg-input/30 sm:h-9 sm:rounded-l-none sm:rounded-r-3xl',
            isInputOverMax(index)
              ? 'border-destructive ring-3 ring-inset ring-destructive/20 dark:ring-destructive/40'
              : '',
          ]"
        >
          <InputGroup
            class="h-full rounded-none border-0 bg-transparent ring-0 has-[[data-slot=input-group-control]:focus-visible]:border-transparent has-[[data-slot=input-group-control]:focus-visible]:ring-0 has-[[data-slot][aria-invalid=true]]:border-transparent has-[[data-slot][aria-invalid=true]]:ring-0"
          >
            <InputGroupInput
              :id="`line-${index}-value`"
              :model-value="statInputs[index]"
              type="number"
              :disabled="disabled"
              :step="getStatStep(statTypes[index])"
              min="0"
              :max="getMaxValue(statTypes[index]) ?? undefined"
              inputmode="decimal"
              :placeholder="valuePlaceholder"
              :aria-label="`Line ${index + 1} value`"
              :aria-invalid="isInputOverMax(index)"
              class="min-w-[4.5rem]"
              @update:model-value="emit('update-input', index, $event)"
            />
            <InputGroupAddon align="inline-end" class="pr-3 text-xs">
              <Tooltip v-if="hasInputValue(index)">
                <TooltipTrigger as-child>
                  <InputGroupButton
                    size="icon-xs"
                    variant="ghost"
                    :aria-label="`Clear line ${index + 1} value`"
                    class="shrink-0 opacity-80 transition-opacity hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-focus-within/line:opacity-100 sm:group-hover/line:opacity-100"
                    @click="emit('update-input', index, '')"
                  >
                    <XIcon />
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>Clear value</TooltipContent>
              </Tooltip>
              <InputGroupText
                class="whitespace-nowrap text-xs font-medium"
                :class="isInputOverMax(index) ? 'text-destructive' : 'text-muted-foreground'"
              >
                <span>{{ getLineMaxSummaryText(index) }}</span>
                <span
                  v-if="getOptionalLineMaxPercentText(index)"
                  :class="getOptionalLineMaxPercentClass(index)"
                >
                  [{{ getOptionalLineMaxPercentText(index) }}]
                </span>
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
      <p v-if="isInputOverMax(index)" class="text-xs text-destructive">
        Value is over the final maximum.
      </p>
    </div>
  </div>
</template>
