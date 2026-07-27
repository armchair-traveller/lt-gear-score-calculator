<script setup>
import {
  CheckIcon,
  GemIcon,
  LockKeyholeIcon,
  MapPinIcon,
} from '@lucide/vue'
import { useUpgradePlannerContext } from '@/features/upgrade/context.js'

const {
  itemPickerOpen,
  selectedItem,
  availableItems,
  catalogGroups,
  selectItem,
} = useUpgradePlannerContext()

function getSearchText(item) {
  return [
    item.name,
    item.summary?.type,
    item.summary?.farm,
    item.summary?.quarter,
    item.summary?.max,
  ].filter(Boolean).join(' ')
}
</script>

<template>
  <Sheet v-model:open="itemPickerOpen">
    <SheetContent
      side="right"
      class="upgrade-catalog-sheet upgrade-theme gap-0 p-0 data-[side=right]:!w-full sm:data-[side=right]:!max-w-[640px]"
    >
      <SheetHeader class="border-b px-5 py-5 pr-14">
        <SheetTitle>Choose an upgrade item</SheetTitle>
        <SheetDescription>
          Search all {{ availableItems.length }} confirmed work orders by item, source, or release quarter.
        </SheetDescription>
      </SheetHeader>

      <Command
        :model-value="selectedItem.value"
        class="min-h-0 flex-1 rounded-none p-3"
        aria-label="Upgrade item catalog"
      >
        <CommandInput
          aria-label="Search upgrade items"
          placeholder="Search items, farms, or quarters…"
        />
        <CommandList class="mt-2 max-h-none flex-1">
          <CommandEmpty>No upgrade items match that search.</CommandEmpty>

          <CommandGroup
            v-for="group in catalogGroups"
            :key="group.label"
            :heading="group.label"
          >
            <CommandItem
              v-for="item in group.items"
              :key="item.value"
              :value="item.value"
              :text-value="getSearchText(item)"
              :disabled="item.disabled || !item.rows?.length"
              :data-current="selectedItem.value === item.value || undefined"
              class="mb-1 items-start py-3"
              @select="selectItem(item.value)"
            >
              <span class="upgrade-catalog-icon">
                <LockKeyholeIcon v-if="item.disabled || !item.rows?.length" />
                <GemIcon v-else />
              </span>

              <span class="min-w-0 flex-1">
                <span class="flex items-start gap-2">
                  <strong class="min-w-0 flex-1 text-sm leading-snug">
                    {{ item.name }}
                  </strong>
                  <CheckIcon
                    v-if="selectedItem.value === item.value"
                    class="mt-0.5 text-primary"
                  />
                </span>
                <span class="mt-1 flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  <MapPinIcon />
                  <span class="truncate">{{ item.summary.farm }}</span>
                </span>
                <span class="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">
                    {{ item.summary.max === '-' ? 'Unconfirmed' : `Max ${item.summary.max}` }}
                  </Badge>
                  <Badge v-if="item.summary.total !== 'Unconfirmed'" variant="outline">
                    {{ item.summary.total }} material
                  </Badge>
                </span>
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>

      <SheetFooter class="border-t px-5 py-3 text-xs text-muted-foreground">
        Unconfirmed entries remain visible for context but cannot be selected.
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
