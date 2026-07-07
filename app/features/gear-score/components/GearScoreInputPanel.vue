<script setup>
import {
  ChevronRightIcon,
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
  valueButton,
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
  getStatStep,
  getInputMaxValue,
  setValues,
  getSelectedRating,
  isInputOverMax,
  getLineMaxSummaryText,
} = useGearScoreCalculatorContext()

const imageImportOpen = ref(false)
const quickFillPercentOptions = Array.from({ length: 9 }, (_, index) => String(60 + index * 5))

function setStatInput(index, value) {
  statInput.value[index] = value
}

function setStatPickerOpen(index, value) {
  statPickerOpen.value[index] = value
}
</script>

<template>
  <section class="grid gap-4">
    <Card class="gap-0 rounded-lg py-0">
      <CardHeader class="p-0">
        <button
          type="button"
          class="group flex w-full items-center justify-between gap-3 rounded-t-lg px-4 py-4 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
          aria-label="Open gear selector"
          @click="gearSheetOpen = true"
        >
          <div class="flex min-w-0 items-center gap-3">
            <img class="size-12 shrink-0 rounded-lg bg-muted p-1" :src="selectedImage" alt="">
            <div class="min-w-0">
              <CardTitle class="truncate text-base">
                {{ pieceType }} {{ gearType }}
              </CardTitle>
              <CardDescription>
                Max rating {{ currentItem?.DI.toFixed(2) }}% / selected stats {{ getSelectedRating().toFixed(2) }}%
              </CardDescription>
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-foreground">
            <SearchIcon class="size-3.5" />
            <span class="hidden sm:inline">Change gear</span>
            <ChevronRightIcon class="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </button>
      </CardHeader>

      <CardContent class="grid gap-4 p-4">
        <div
          class="grid gap-1 sm:grid-cols-2"
          role="group"
          aria-label="Gear selection"
        >
          <div class="min-w-0">
            <Label for="gear-type" class="sr-only">Tier</Label>
            <Select v-model="gearType">
              <SelectTrigger
                id="gear-type"
                class="w-full justify-start rounded-b-none rounded-t-3xl sm:rounded-l-3xl sm:rounded-r-none *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-start *:data-[slot=select-value]:text-left"
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
                class="w-full justify-start rounded-b-3xl rounded-t-none sm:rounded-l-none sm:rounded-r-3xl *:data-[slot=select-value]:min-w-0 *:data-[slot=select-value]:flex-1 *:data-[slot=select-value]:justify-start *:data-[slot=select-value]:text-left"
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
            :class="currentInputEnchantLevelOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'"
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

        <GearStatLinesEditor
          :stat-types="statType"
          :stat-inputs="statInput"
          :stat-options="statOptions"
          :picker-open="statPickerOpen"
          :get-stat-step="getStatStep"
          :get-max-value="getInputMaxValue"
          :get-line-max-summary-text="getLineMaxSummaryText"
          :is-input-over-max="isInputOverMax"
          :is-stat-selected-on-other-line="isStatSelectedOnOtherLine"
          @select-stat="selectStatType"
          @update-input="setStatInput"
          @update-picker-open="setStatPickerOpen"
        />

        <div class="grid gap-3 rounded-lg bg-muted/15 p-3">
          <div class="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" @click="imageImportOpen = true">
              <ScanTextIcon />
              Import
            </Button>
            <Button variant="outline" size="sm" @click="setValues(0, 0)">
              <RefreshCcwIcon />
              Clear
            </Button>
            <Button variant="secondary" size="sm" @click="setValues(3, valueButton)">Trio</Button>
            <Button variant="secondary" size="sm" @click="setValues(4, valueButton)">Quad</Button>
            <Button variant="secondary" size="sm" @click="setValues(5, valueButton)">Penta</Button>

            <Select v-model="valueButton">
              <SelectTrigger class="ml-auto w-[110px]">
                <SelectValue placeholder="Value" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="percent in quickFillPercentOptions" :key="percent" :value="percent">
                    {{ percent }}%
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Collapsible
          v-if="currentRecommendations"
          v-slot="{ open }"
          :key="`${gearType}-${pieceType}`"
          class="rounded-lg bg-muted/15"
        >
          <CollapsibleTrigger as-child>
            <Button
              variant="ghost"
              class="h-auto w-full justify-between rounded-lg px-3 py-2.5 text-left text-sm"
            >
              <span>View recommended options</span>
              <ChevronRightIcon
                class="size-4 text-muted-foreground transition-transform"
                :class="{ 'rotate-90': open }"
              />
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div class="grid gap-3 px-3 pb-3 pt-1">
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
      </CardContent>
    </Card>

    <GearImageImportDialog v-model:open="imageImportOpen" />

    <Card class="rounded-lg">
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
