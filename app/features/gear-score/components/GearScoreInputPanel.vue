<script setup>
import {
  ChevronRightIcon,
  HashIcon,
  PercentIcon,
  RefreshCcwIcon,
  ScanTextIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from '@lucide/vue'
import { ref } from 'vue'

const {
  gearType,
  pieceType,
  inputValueMode,
  inputEnchantLevel,
  statType,
  statInput,
  statPickerOpen,
  gearSheetOpen,
  gearCategories,
  pieceOptions,
  currentItem,
  statOptions,
  selectedImage,
  selectedTraitRows,
  currentRecommendations,
  currentInputEnchantLevelOptions,
  getAsset,
  isStatSelectedOnOtherLine,
  selectStatType,
  supportsInputEnchantLevel,
  setInputEnchantLevel,
  setInputValueMode,
  getStatStep,
  getInputMaxValue,
  clearStatInputs,
  getSelectedRating,
  isInputOverMax,
  getLineMaxSummaryText,
} = useGearScoreCalculatorContext()

const imageImportOpen = ref(false)
const recommendationsOpen = ref(false)

function setStatInput(index, value) {
  statInput.value[index] = value
}

function setStatPickerOpen(index, value) {
  statPickerOpen.value[index] = value
}
</script>

<template>
  <section class="gear-score-input-panel grid content-start gap-4">
    <Card class="parade-card gap-0 rounded-[22px] py-0">
      <CardHeader class="p-0">
        <button
          type="button"
          class="group flex w-full items-center justify-between gap-3 rounded-t-lg px-4 py-4 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
          aria-label="Open gear selector"
          @click="gearSheetOpen = true"
        >
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 border-amber-300 bg-[linear-gradient(145deg,var(--parade-yellow-soft),white)] shadow-[0_8px_18px_rgb(239_178_26_/_0.14)]">
              <img class="size-11" :src="selectedImage" alt="">
            </span>
            <div class="min-w-0">
              <CardTitle class="truncate text-base">
                {{ pieceType }} {{ gearType }}
              </CardTitle>
              <CardDescription>
                Max rating {{ currentItem?.DI.toFixed(2) }}% / selected stats {{ getSelectedRating().toFixed(2) }}%
              </CardDescription>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1.5 rounded-xl border bg-secondary/70 px-2.5 py-1.5 text-xs font-semibold text-secondary-foreground transition-colors group-hover:bg-secondary group-hover:text-foreground">
            <SearchIcon class="size-3.5" />
            <span class="hidden @min-[30rem]/card-header:inline">Change gear</span>
            <ChevronRightIcon class="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      </CardHeader>

      <CardContent class="grid gap-4 p-4">
        <div
          class="grid grid-cols-2 gap-1"
          role="group"
          aria-label="Gear selection"
        >
          <div class="min-w-0">
            <Label for="gear-type" class="sr-only">Tier</Label>
            <Select v-model="gearType">
              <SelectTrigger
                id="gear-type"
                class="w-full justify-start rounded-l-3xl rounded-r-none *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-start *:data-[slot=select-value]:text-left"
              >
                <span class="flex shrink-0 items-center text-muted-foreground">
                  <SparklesIcon class="size-3.5" aria-hidden="true" />
                </span>
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="category in gearCategories" :key="category" :value="category">
                  {{ category }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="min-w-0">
            <Label for="piece-type" class="sr-only">Piece</Label>
            <Select v-model="pieceType">
              <SelectTrigger
                id="piece-type"
                class="w-full justify-start rounded-l-none rounded-r-3xl *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-start *:data-[slot=select-value]:text-left"
              >
                <span class="flex shrink-0 items-center text-muted-foreground">
                  <img class="size-4 rounded-sm" :src="selectedImage" alt="" aria-hidden="true">
                </span>
                <SelectValue placeholder="Piece" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="piece in pieceOptions" :key="piece" :value="piece">
                  {{ piece }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div v-if="supportsInputEnchantLevel()">
          <div
            class="grid gap-1 rounded-md bg-muted/70 p-1"
            :class="currentInputEnchantLevelOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-4'"
            role="group"
            aria-label="Input enchant level"
          >
            <button
              v-for="option in currentInputEnchantLevelOptions"
              :key="option.value"
              type="button"
              :aria-pressed="inputEnchantLevel === option.value"
              class="h-9 rounded-sm px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              :class="inputEnchantLevel === option.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'"
              @click="setInputEnchantLevel(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-end justify-between gap-2">
          <div>
            <Label id="input-value-mode-label" class="text-sm font-bold text-foreground">
              Current enchant values
            </Label>
            <p class="mt-0.5 text-xs text-muted-foreground">Choose a stat, then enter the value shown in game.</p>
          </div>
          <ToggleGroup
            :model-value="inputValueMode"
            type="single"
            variant="outline"
            size="sm"
            aria-labelledby="input-value-mode-label"
            @update:model-value="setInputValueMode"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <ToggleGroupItem value="value" aria-label="Actual values">
                  <HashIcon aria-hidden="true" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Actual values</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger as-child>
                <ToggleGroupItem value="percent" aria-label="Percent of max">
                  <PercentIcon aria-hidden="true" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Percent of max</TooltipContent>
            </Tooltip>
          </ToggleGroup>
        </div>

        <GearStatLinesEditor
          :stat-types="statType"
          :stat-inputs="statInput"
          :stat-options="statOptions"
          :picker-open="statPickerOpen"
          :get-stat-step="getStatStep"
          :get-max-value="getInputMaxValue"
          :value-mode="inputValueMode"
          :value-placeholder="inputValueMode === 'percent' ? 'Percent' : 'Value'"
          :get-line-max-summary-text="getLineMaxSummaryText"
          :is-input-over-max="isInputOverMax"
          :is-stat-selected-on-other-line="isStatSelectedOnOtherLine"
          @select-stat="selectStatType"
          @update-input="setStatInput"
          @update-picker-open="setStatPickerOpen"
        />

        <div class="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" @click="imageImportOpen = true">
            <ScanTextIcon data-icon="inline-start" />
            Import screenshot
          </Button>
          <Button variant="outline" size="sm" @click="clearStatInputs">
            <RefreshCcwIcon data-icon="inline-start" />
            Clear
          </Button>
          <Collapsible
            v-if="currentRecommendations"
            v-model:open="recommendationsOpen"
            :key="`${gearType}-${pieceType}`"
            class="col-span-2"
          >
            <CollapsibleTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="w-full justify-between"
                :class="{ 'rounded-b-none': recommendationsOpen }"
              >
                {{ recommendationsOpen ? 'Hide recommended options' : 'Recommended options' }}
                <ChevronRightIcon
                  data-icon="inline-end"
                  class="transition-transform"
                  :class="{ 'rotate-90': recommendationsOpen }"
                />
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent class="rounded-b-2xl border border-t-0 bg-secondary/30">
              <div class="grid gap-3 p-3">
                <div class="grid gap-2">
                  <div class="text-xs font-medium text-muted-foreground">Main</div>
                  <div class="flex flex-wrap gap-1.5">
                    <Badge
                      v-for="stat in currentRecommendations.main"
                      :key="`main-${stat}`"
                      variant="secondary"
                    >
                      {{ stat }}
                    </Badge>
                  </div>
                </div>

                <div class="grid gap-2">
                  <div class="text-xs font-medium text-muted-foreground">Secondary</div>
                  <div class="flex flex-wrap gap-1.5">
                    <Badge
                      v-for="stat in currentRecommendations.secondary"
                      :key="`secondary-${stat}`"
                      variant="outline"
                    >
                      {{ stat }}
                    </Badge>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>

    <GearImageImportDialog v-model:open="imageImportOpen" />

    <Card class="parade-card rounded-[22px]">
      <CardHeader>
        <CardTitle class="flex items-center gap-2 text-base">
          <ShieldCheckIcon class="size-4" />
          Stat Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div v-if="selectedTraitRows.length" class="grid gap-2">
          <div
            v-for="trait in selectedTraitRows"
            :key="trait.id"
            class="flex gap-3 rounded-lg bg-muted/20 p-3"
          >
            <img class="size-8 shrink-0" :src="getAsset(trait.image)" alt="">
            <div>
              <div class="text-sm font-medium">{{ trait.label }}</div>
              <div class="text-sm text-muted-foreground">{{ trait.text }}</div>
            </div>
          </div>
        </div>
        <div v-else class="rounded-lg bg-muted/20 p-4 text-sm text-muted-foreground">
          No special stat notes for the current rolled lines.
        </div>
      </CardContent>
    </Card>
  </section>
</template>
