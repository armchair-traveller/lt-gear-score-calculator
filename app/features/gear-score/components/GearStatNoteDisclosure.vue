<script setup>
import { InfoIcon } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import { computed } from 'vue'

const props = defineProps({
  stat: {
    type: String,
    required: true,
  },
  notes: {
    type: Array,
    required: true,
  },
})

const { getAsset } = useGearScoreCalculatorContext()

const usesCoarsePointer = useMediaQuery('(pointer: coarse)')
const triggerLabel = computed(() => {
  const count = props.notes.length
  return count === 1
    ? `About ${props.stat}`
    : `${count} notes about ${props.stat}`
})
</script>

<template>
  <Tooltip
    v-if="!usesCoarsePointer"
    :delay-duration="250"
    :disable-hoverable-content="true"
    :ignore-non-keyboard-focus="true"
  >
    <TooltipTrigger as-child>
      <Button
        variant="ghost"
        size="icon-xs"
        class="-my-1 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        :aria-label="triggerLabel"
      >
        <InfoIcon aria-hidden="true" />
      </Button>
    </TooltipTrigger>

    <TooltipContent
      side="top"
      align="start"
      :side-offset="6"
      :collision-padding="12"
      class="w-80 items-start p-3 text-left"
    >
      <div class="flex w-full flex-col gap-3">
        <template v-for="(note, noteIndex) in notes" :key="note.id">
          <Separator v-if="noteIndex" />
          <div class="flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background/10">
              <img
                class="size-7 object-contain"
                :src="getAsset(note.image)"
                alt=""
              >
            </span>
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="font-semibold">{{ note.label }}</span>
              <span class="leading-relaxed text-background/80">{{ note.text }}</span>
            </div>
          </div>
        </template>
      </div>
    </TooltipContent>
  </Tooltip>

  <Popover v-else>
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-xs"
        class="-my-1 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
        :aria-label="triggerLabel"
      >
        <InfoIcon aria-hidden="true" />
      </Button>
    </PopoverTrigger>

    <PopoverContent
      side="bottom"
      align="start"
      :side-offset="6"
      :collision-padding="12"
    >
      <div class="flex flex-col gap-3">
        <template v-for="(note, noteIndex) in notes" :key="note.id">
          <Separator v-if="noteIndex" />
          <div class="flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <img
                class="size-7 object-contain"
                :src="getAsset(note.image)"
                alt=""
              >
            </span>
            <PopoverHeader class="min-w-0 text-left">
              <PopoverTitle>{{ note.label }}</PopoverTitle>
              <PopoverDescription class="leading-relaxed">
                {{ note.text }}
              </PopoverDescription>
            </PopoverHeader>
          </div>
        </template>
      </div>
    </PopoverContent>
  </Popover>
</template>
